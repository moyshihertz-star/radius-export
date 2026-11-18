import type { Database, Json, Tables } from "@/integrations/supabase/types";
import { parseIacPayload } from "./iac-parser";
import { getLocalStore, isSupabaseConfigured, saveLocalStore } from "./local-store.server";
import { normalizeWeights, simulate } from "./radius-engine.server";
import type { PolicyWeights, RadiusEdge, RadiusResource } from "./radius-types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handlePublicIngest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  const headerKey =
    request.headers.get("x-radius-ingest-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const ingestKey = headerKey.trim();
  if (!ingestKey) {
    return jsonResponse({ error: "Missing x-radius-ingest-key header" }, 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body" }, 400);
  }

  if (!isSupabaseConfigured()) {
    const store = getLocalStore();
    if (ingestKey !== store.org.ingest_key) {
      return jsonResponse({ error: "Invalid ingest key" }, 401);
    }
    const mappedResources: RadiusResource[] = store.resources.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      type: r.type,
      sensitivity: r.sensitivity,
      tags: r.tags ?? [],
      x: r.x,
      y: r.y,
    }));
    const mappedEdges: RadiusEdge[] = store.edges.map((e) => ({
      from: e.from_resource_id,
      to: e.to_resource_id,
    }));

    let parsed;
    try {
      parsed = parseIacPayload(rawBody, mappedResources);
    } catch (err) {
      return jsonResponse(
        { error: err instanceof Error ? err.message : "Could not parse IaC payload" },
        400,
      );
    }

    const result = simulate(
      {
        targetId: parsed.targetResourceId,
        newAccessId: parsed.newAccessResourceId,
        scopeBroadened: parsed.scopeBroadened,
      },
      mappedResources,
      mappedEdges,
      store.weights,
    );

    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    store.changes.unshift({
      id,
      org_id: store.org.id,
      title: parsed.title,
      author: parsed.author,
      target_resource_id: parsed.targetResourceId,
      new_access_resource_id: parsed.newAccessResourceId,
      scope_broadened: parsed.scopeBroadened,
      status: "pending",
      score: result.score,
      verdict: result.verdict,
      breakdown: result.breakdown as unknown as Json,
      source: "ci",
      decided_by: null,
      decided_at: null,
      created_at: nowIso,
    });

    store.auditLog.unshift({
      id: crypto.randomUUID(),
      org_id: store.org.id,
      change_id: id,
      action: "ingested_from_ci",
      actor_id: null,
      actor_name: parsed.author,
      details: {
        score: result.score,
        verdict: result.verdict,
        detected_actions: parsed.detectedActions,
        detected_resources: parsed.detectedResources,
      } as unknown as Json,
      created_at: nowIso,
    });
    saveLocalStore();

    return jsonResponse({
      id,
      organization: store.org.name,
      title: parsed.title,
      score: result.score,
      verdict: result.verdict,
      threshold: store.weights.threshold,
      requiresApproval: result.verdict === "high",
      impactedCount: result.consumers.length,
      consumers: result.consumers,
      breakdown: result.breakdown,
    });
  }

  let dbClient;
  if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    dbClient = supabaseAdmin;
  } else {
    const { createClient } = await import("@supabase/supabase-js");
    const sbUrl = process.env["SUPABASE_URL"] || import.meta.env?.["VITE_SUPABASE_URL"];
    const sbKey =
      process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"];
    dbClient = createClient<Database>(sbUrl!, sbKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await dbClient.auth.signInWithPassword({
      email: "demo@radius.local",
      password: "RadiusDemo2026!",
    });
  }

  const { data: org, error: orgErr } = await dbClient
    .from("organizations")
    .select("id, name")
    .eq("ingest_key", ingestKey)
    .maybeSingle();

  if (orgErr) {
    return jsonResponse({ error: orgErr.message }, 500);
  }
  if (!org) {
    return jsonResponse({ error: "Invalid ingest key" }, 401);
  }

  const [{ data: resources, error: rErr }, { data: edges, error: eErr }, { data: weights }] =
    await Promise.all([
      dbClient.from("resources").select("*").eq("org_id", org.id).order("key"),
      dbClient.from("edges").select("*").eq("org_id", org.id),
      dbClient.from("policy_weights").select("*").eq("org_id", org.id).maybeSingle(),
    ]);

  if (rErr || eErr) {
    return jsonResponse({ error: rErr?.message ?? eErr?.message ?? "Failed to load graph" }, 500);
  }

  const mappedResources: RadiusResource[] = (resources ?? []).map((r: Tables<"resources">) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    type: r.type,
    sensitivity: r.sensitivity,
    tags: r.tags ?? [],
    x: r.x,
    y: r.y,
  }));

  const mappedEdges: RadiusEdge[] = (edges ?? []).map((e: Tables<"edges">) => ({
    from: e.from_resource_id,
    to: e.to_resource_id,
  }));

  const mappedWeights: PolicyWeights = weights
    ? normalizeWeights(weights)
    : {
        threshold: 70,
        sensHigh: 14,
        sensMedium: 7,
        sensLow: 3,
        scopeBonus: 22,
        complianceBonus: 20,
      };

  let parsed;
  try {
    parsed = parseIacPayload(rawBody, mappedResources);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Could not parse IaC payload" },
      400,
    );
  }

  const result = simulate(
    {
      targetId: parsed.targetResourceId,
      newAccessId: parsed.newAccessResourceId,
      scopeBroadened: parsed.scopeBroadened,
    },
    mappedResources,
    mappedEdges,
    mappedWeights,
  );

  const { data: inserted, error: insertErr } = await dbClient
    .from("changes")
    .insert({
      org_id: org.id,
      title: parsed.title,
      author: parsed.author,
      target_resource_id: parsed.targetResourceId,
      new_access_resource_id: parsed.newAccessResourceId,
      scope_broadened: parsed.scopeBroadened,
      score: result.score,
      verdict: result.verdict,
      breakdown: result.breakdown as unknown as Json,
      source: "ci",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return jsonResponse({ error: insertErr?.message ?? "Failed to save change" }, 500);
  }

  await dbClient.from("audit_log").insert({
    org_id: org.id,
    change_id: inserted.id,
    action: "ingested_from_ci",
    actor_name: parsed.author,
    details: {
      score: result.score,
      verdict: result.verdict,
      detected_actions: parsed.detectedActions,
      detected_resources: parsed.detectedResources,
    } as unknown as Json,
  });

  return jsonResponse({
    id: inserted.id,
    organization: org.name,
    title: parsed.title,
    score: result.score,
    verdict: result.verdict,
    threshold: mappedWeights.threshold,
    requiresApproval: result.verdict === "high",
    impactedCount: result.consumers.length,
    consumers: result.consumers,
    breakdown: result.breakdown,
  });
}
