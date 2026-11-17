import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json, Tables } from "@/integrations/supabase/types";
import { z } from "zod";
import {
  clampWeights,
  normalizeWeights,
  resolveChangeSimulation,
  simulate,
} from "./radius-engine.server";
import type {
  AuditAndCiData,
  ConsoleData,
  PolicyWeights,
  RadiusChange,
  RadiusEdge,
  RadiusResource,
  SimulationResult,
} from "./radius-types";

type TypedSupabase = SupabaseClient<Database>;
type Ctx = { supabase: TypedSupabase; userId: string };

async function loadGraph(supabase: TypedSupabase) {
  const [{ data: resources, error: rErr }, { data: edges, error: eErr }, { data: weights }] =
    await Promise.all([
      supabase.from("resources").select("*").order("key"),
      supabase.from("edges").select("*"),
      supabase.from("policy_weights").select("*").maybeSingle(),
    ]);
  if (rErr) throw new Error(rErr.message);
  if (eErr) throw new Error(eErr.message);

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

  return { resources: mappedResources, edges: mappedEdges, weights: mappedWeights };
}

export function toChange(
  row: Tables<"changes">,
  resources: RadiusResource[],
  edges: RadiusEdge[],
  weights: PolicyWeights,
): RadiusChange {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    targetResourceId: row.target_resource_id,
    newAccessResourceId: row.new_access_resource_id,
    scopeBroadened: row.scope_broadened,
    status: row.status,
    source: row.source,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    simulation: resolveChangeSimulation(row, resources, edges, weights),
  };
}

export const getConsole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConsoleData> => {
    const { supabase } = context as unknown as Ctx;
    const { resources, edges, weights } = await loadGraph(supabase);

    const [{ data: changes, error }, { data: org }] = await Promise.all([
      supabase.from("changes").select("*").order("created_at", { ascending: false }),
      supabase.from("organizations").select("name").maybeSingle(),
    ]);
    if (error) throw new Error(error.message);

    return {
      orgName: org?.name ?? "radius",
      resources,
      edges,
      weights,
      changes: (changes ?? []).map((c: Tables<"changes">) =>
        toChange(c, resources, edges, weights),
      ),
    };
  });

export const createChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().max(160).optional(),
        targetResourceId: z.string().uuid(),
        newAccessResourceId: z.string().uuid().nullable().optional(),
        scopeBroadened: z.boolean().default(false),
      })
      .refine((v) => !v.newAccessResourceId || v.newAccessResourceId !== v.targetResourceId, {
        message: "Target resource and new access resource must be different",
        path: ["newAccessResourceId"],
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context as unknown as Ctx;
    const { resources, edges, weights } = await loadGraph(supabase);

    const result = simulate(
      {
        targetId: data.targetResourceId,
        newAccessId: data.newAccessResourceId ?? null,
        scopeBroadened: data.scopeBroadened,
      },
      resources,
      edges,
      weights,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, org_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.org_id) throw new Error("Organization profile not found");

    const { data: inserted, error } = await supabase
      .from("changes")
      .insert({
        org_id: profile.org_id,
        title: data.title?.trim() || "Untitled custom change",
        author: profile.display_name || "you",
        target_resource_id: data.targetResourceId,
        new_access_resource_id: data.newAccessResourceId ?? null,
        scope_broadened: data.scopeBroadened,
        score: result.score,
        verdict: result.verdict,
        breakdown: result.breakdown as unknown as Json,
        source: "manual",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert({
      org_id: profile.org_id,
      change_id: inserted.id,
      action: "created",
      actor_id: userId,
      actor_name: profile.display_name ?? null,
      details: { score: result.score, verdict: result.verdict },
    });

    return { id: inserted.id };
  });

export const decideChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        changeId: z.string().uuid(),
        decision: z.enum(["approved", "blocked", "pending"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const { resources, edges, weights } = await loadGraph(supabase);

    const { data: row, error: readErr } = await supabase
      .from("changes")
      .select("*")
      .eq("id", data.changeId)
      .single();
    if (readErr) throw new Error(readErr.message);

    const result = simulate(
      {
        targetId: row.target_resource_id,
        newAccessId: row.new_access_resource_id,
        scopeBroadened: row.scope_broadened,
      },
      resources,
      edges,
      weights,
    );

    const { error } = await supabase
      .from("changes")
      .update({
        status: data.decision,
        score: result.score,
        verdict: result.verdict,
        breakdown: result.breakdown as unknown as Json,
        decided_by: data.decision === "pending" ? null : userId,
        decided_at: data.decision === "pending" ? null : new Date().toISOString(),
      })
      .eq("id", data.changeId);
    if (error) throw new Error(error.message);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, org_id")
      .eq("id", userId)
      .maybeSingle();

    await supabase.from("audit_log").insert({
      org_id: profile?.org_id ?? row.org_id,
      change_id: data.changeId,
      action: data.decision,
      actor_id: userId,
      actor_name: profile?.display_name ?? null,
      details: { score: result.score, verdict: result.verdict },
    });

    return { ok: true };
  });

export const saveWeights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        threshold: z.number(),
        sensHigh: z.number(),
        sensMedium: z.number(),
        sensLow: z.number(),
        scopeBonus: z.number(),
        complianceBonus: z.number(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PolicyWeights> => {
    const { supabase, userId } = context as unknown as Ctx;
    const w = clampWeights(data);

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.org_id) throw new Error("Organization profile not found");

    const { error } = await supabase.from("policy_weights").upsert({
      org_id: profile.org_id,
      threshold: w.threshold,
      sens_high_weight: w.sensHigh,
      sens_medium_weight: w.sensMedium,
      sens_low_weight: w.sensLow,
      scope_bonus: w.scopeBonus,
      compliance_bonus: w.complianceBonus,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return w;
  });

export const previewPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        changeId: z.string().uuid(),
        weights: z.object({
          threshold: z.number(),
          sensHigh: z.number(),
          sensMedium: z.number(),
          sensLow: z.number(),
          scopeBonus: z.number(),
          complianceBonus: z.number(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SimulationResult> => {
    const { supabase } = context as unknown as Ctx;
    const { resources, edges } = await loadGraph(supabase);
    const { data: row, error } = await supabase
      .from("changes")
      .select("target_resource_id, new_access_resource_id, scope_broadened")
      .eq("id", data.changeId)
      .single();
    if (error) throw new Error(error.message);

    return simulate(
      {
        targetId: row.target_resource_id,
        newAccessId: row.new_access_resource_id,
        scopeBroadened: row.scope_broadened,
      },
      resources,
      edges,
      clampWeights(data.weights),
    );
  });

export const getAuditAndCi = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditAndCiData> => {
    const { supabase } = context as unknown as Ctx;

    const [{ data: org, error: orgErr }, { data: logs, error: logErr }] = await Promise.all([
      supabase.from("organizations").select("name, ingest_key").maybeSingle(),
      supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (orgErr) throw new Error(orgErr.message);
    if (logErr) throw new Error(logErr.message);

    return {
      orgName: org?.name ?? "radius",
      ingestKey: org?.ingest_key ?? "",
      entries: (logs ?? []).map((row: Tables<"audit_log">) => ({
        id: row.id,
        action: row.action,
        actorName: row.actor_name,
        changeId: row.change_id,
        details: JSON.stringify(row.details ?? {}),
        createdAt: row.created_at,
      })),
    };
  });
