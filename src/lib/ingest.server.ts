import type { Json, Tables } from "@/integrations/supabase/types";
import { parseIacPayload } from "./iac-parser";
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

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: org, error: orgErr } = await supabaseAdmin
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
      supabaseAdmin.from("resources").select("*").eq("org_id", org.id).order("key"),
      supabaseAdmin.from("edges").select("*").eq("org_id", org.id),
      supabaseAdmin.from("policy_weights").select("*").eq("org_id", org.id).maybeSingle(),
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

  const { data: inserted, error: insertErr } = await supabaseAdmin
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

  await supabaseAdmin.from("audit_log").insert({
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
