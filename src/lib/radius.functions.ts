import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json, Tables } from "@/integrations/supabase/types";
import { z } from "zod";
import { computeAutoLayout } from "./graph-layout";
import { parseTopologyPayload } from "./iac-parser";
import { getLocalStore, saveLocalStore } from "./local-store.server";
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
type Ctx = { supabase: TypedSupabase | null; userId: string };

async function loadGraph(supabase: TypedSupabase | null) {
  if (!supabase) {
    const store = getLocalStore();
    return {
      resources: store.resources.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        type: r.type,
        sensitivity: r.sensitivity,
        tags: r.tags ?? [],
        x: r.x,
        y: r.y,
      })),
      edges: store.edges.map((e) => ({
        from: e.from_resource_id,
        to: e.to_resource_id,
      })),
      weights: store.weights,
    };
  }

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

    if (!supabase) {
      const store = getLocalStore();
      return {
        orgName: store.org.name,
        resources,
        edges,
        weights,
        changes: store.changes.map((c) => toChange(c, resources, edges, weights)),
      };
    }

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

    if (!supabase) {
      const store = getLocalStore();
      const id = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      store.changes.unshift({
        id,
        org_id: store.org.id,
        title: data.title?.trim() || "Untitled custom change",
        author: store.displayName || "you",
        target_resource_id: data.targetResourceId,
        new_access_resource_id: data.newAccessResourceId ?? null,
        scope_broadened: data.scopeBroadened,
        status: "pending",
        score: result.score,
        verdict: result.verdict,
        breakdown: result.breakdown as unknown as Json,
        source: "manual",
        decided_by: null,
        decided_at: null,
        created_at: nowIso,
      });
      store.auditLog.unshift({
        id: crypto.randomUUID(),
        org_id: store.org.id,
        change_id: id,
        action: "created",
        actor_id: userId,
        actor_name: store.displayName,
        details: { score: result.score, verdict: result.verdict },
        created_at: nowIso,
      });
      saveLocalStore();
      return { id };
    }

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
        note: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const { resources, edges, weights } = await loadGraph(supabase);
    const trimmedNote = data.note?.trim() || undefined;

    if (!supabase) {
      const store = getLocalStore();
      const row = store.changes.find((c) => c.id === data.changeId);
      if (!row) throw new Error("Change not found");
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
      if (
        data.decision === "approved" &&
        result.verdict === "high" &&
        (!trimmedNote || trimmedNote.length < 3)
      ) {
        throw new Error("High-risk changes require a reviewer justification note (3+ chars)");
      }
      const nowIso = new Date().toISOString();
      row.status = data.decision;
      row.score = result.score;
      row.verdict = result.verdict;
      row.breakdown = result.breakdown as unknown as Json;
      row.decided_by = data.decision === "pending" ? null : userId;
      row.decided_at = data.decision === "pending" ? null : nowIso;

      store.auditLog.unshift({
        id: crypto.randomUUID(),
        org_id: store.org.id,
        change_id: data.changeId,
        action: data.decision,
        actor_id: userId,
        actor_name: store.displayName,
        details: {
          score: result.score,
          verdict: result.verdict,
          ...(trimmedNote ? { note: trimmedNote } : {}),
        },
        created_at: nowIso,
      });
      saveLocalStore();
      return { ok: true };
    }

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
    if (
      data.decision === "approved" &&
      result.verdict === "high" &&
      (!trimmedNote || trimmedNote.length < 3)
    ) {
      throw new Error("High-risk changes require a reviewer justification note (3+ chars)");
    }

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
      details: {
        score: result.score,
        verdict: result.verdict,
        ...(trimmedNote ? { note: trimmedNote } : {}),
      } as unknown as Json,
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

    if (!supabase) {
      const store = getLocalStore();
      store.weights = w;
      store.auditLog.unshift({
        id: crypto.randomUUID(),
        org_id: store.org.id,
        change_id: null,
        action: "policy_weights_updated",
        actor_id: userId,
        actor_name: store.displayName,
        details: w as unknown as Json,
        created_at: new Date().toISOString(),
      });
      saveLocalStore();
      return w;
    }

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

    if (!supabase) {
      const store = getLocalStore();
      const row = store.changes.find((c) => c.id === data.changeId);
      if (!row) throw new Error("Change not found");
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
    }

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

    if (!supabase) {
      const store = getLocalStore();
      return {
        orgName: store.org.name,
        ingestKey: store.org.ingest_key,
        entries: store.auditLog.map((row) => ({
          id: row.id,
          action: row.action,
          actorName: row.actor_name,
          changeId: row.change_id,
          details: JSON.stringify(row.details ?? {}),
          createdAt: row.created_at,
        })),
      };
    }

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

export const syncCloudTopology = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        payload: z.string().min(2),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ addedResources: number; addedEdges: number }> => {
    const { supabase, userId } = context as unknown as Ctx;
    const parsed = parseTopologyPayload(data.payload);

    if (!supabase) {
      const store = getLocalStore();
      const nowIso = new Date().toISOString();
      const byKey = new Map(store.resources.map((r) => [r.key, r]));
      let addedResources = 0;

      for (const node of parsed.resources) {
        const existing = byKey.get(node.key);
        if (existing) {
          existing.name = node.name;
          existing.type = node.type;
          existing.sensitivity = node.sensitivity;
          existing.tags = node.tags;
        } else {
          const created: Tables<"resources"> = {
            id: crypto.randomUUID(),
            org_id: store.org.id,
            key: node.key,
            name: node.name,
            type: node.type,
            sensitivity: node.sensitivity,
            tags: node.tags,
            x: 0,
            y: 0,
            created_at: nowIso,
          };
          store.resources.push(created);
          byKey.set(node.key, created);
          addedResources += 1;
        }
      }

      let addedEdges = 0;
      for (const edge of parsed.edges) {
        const fromRes = byKey.get(edge.from);
        const toRes = byKey.get(edge.to);
        if (!fromRes || !toRes) continue;
        const exists = store.edges.some(
          (e) => e.from_resource_id === fromRes.id && e.to_resource_id === toRes.id,
        );
        if (!exists) {
          store.edges.push({
            id: crypto.randomUUID(),
            org_id: store.org.id,
            from_resource_id: fromRes.id,
            to_resource_id: toRes.id,
            created_at: nowIso,
          });
          addedEdges += 1;
        }
      }

      // Auto-layout any newly added resources (x=0, y=0)
      const laidOut = computeAutoLayout(
        store.resources.map((r) => ({
          id: r.id,
          key: r.key,
          name: r.name,
          type: r.type,
          sensitivity: r.sensitivity,
          tags: r.tags,
          x: r.x,
          y: r.y,
        })),
        store.edges.map((e) => ({ from: e.from_resource_id, to: e.to_resource_id })),
      );
      const posById = new Map(laidOut.map((r) => [r.id, r]));
      for (const r of store.resources) {
        if (r.x === 0 && r.y === 0) {
          const p = posById.get(r.id);
          if (p) {
            r.x = p.x;
            r.y = p.y;
          }
        }
      }

      store.auditLog.unshift({
        id: crypto.randomUUID(),
        org_id: store.org.id,
        change_id: null,
        action: "topology_synced",
        actor_id: userId,
        actor_name: store.displayName,
        details: { addedResources, addedEdges },
        created_at: nowIso,
      });
      saveLocalStore();

      return { addedResources, addedEdges };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.org_id) throw new Error("Organization profile not found");

    const { data: existingRows } = await supabase.from("resources").select("*");
    const byKey = new Map((existingRows ?? []).map((r) => [r.key, r]));
    let addedResources = 0;

    for (const node of parsed.resources) {
      if (!byKey.has(node.key)) {
        const { data: ins } = await supabase
          .from("resources")
          .insert({
            org_id: profile.org_id,
            key: node.key,
            name: node.name,
            type: node.type,
            sensitivity: node.sensitivity,
            tags: node.tags,
            x: 450,
            y: 230,
          })
          .select("*")
          .single();
        if (ins) {
          byKey.set(node.key, ins);
          addedResources += 1;
        }
      }
    }

    let addedEdges = 0;
    for (const edge of parsed.edges) {
      const fromRes = byKey.get(edge.from);
      const toRes = byKey.get(edge.to);
      if (!fromRes || !toRes) continue;
      const { error: eErr } = await supabase.from("edges").insert({
        org_id: profile.org_id,
        from_resource_id: fromRes.id,
        to_resource_id: toRes.id,
      });
      if (!eErr) addedEdges += 1;
    }

    await supabase.from("audit_log").insert({
      org_id: profile.org_id,
      action: "topology_synced",
      actor_id: userId,
      actor_name: profile.display_name ?? null,
      details: { addedResources, addedEdges },
    });

    return { addedResources, addedEdges };
  });

export const rotateIngestKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ingestKey: string }> => {
    const { supabase, userId } = context as unknown as Ctx;
    const newKey = `radius_ingest_${crypto.randomUUID().replace(/-/g, "")}`;

    if (!supabase) {
      const store = getLocalStore();
      store.org.ingest_key = newKey;
      store.auditLog.unshift({
        id: crypto.randomUUID(),
        org_id: store.org.id,
        change_id: null,
        action: "ingest_key_rotated",
        actor_id: userId,
        actor_name: store.displayName,
        details: { key_prefix: newKey.slice(0, 18) + "…" },
        created_at: new Date().toISOString(),
      });
      saveLocalStore();
      return { ingestKey: newKey };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.org_id) throw new Error("Organization profile not found");

    const { error } = await supabase
      .from("organizations")
      .update({ ingest_key: newKey })
      .eq("id", profile.org_id);
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert({
      org_id: profile.org_id,
      action: "ingest_key_rotated",
      actor_id: userId,
      actor_name: profile.display_name ?? null,
      details: { key_prefix: newKey.slice(0, 18) + "…" },
    });

    return { ingestKey: newKey };
  });
