import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json, Tables } from "@/integrations/supabase/types";
import { evaluateHypothesisUsage } from "./agent-runner.server";
import { mapAgentRun, mapHypothesis, summarize } from "./hypotheses-engine.server";
import type { AgentRun, HypothesesData } from "./hypotheses-types";
import { getLocalStore } from "./local-store.server";

type Ctx = { supabase: SupabaseClient<Database> | null; userId: string };

export const getHypotheses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HypothesesData> => {
    const { supabase } = context as unknown as Ctx;
    const now = Date.now();

    if (!supabase) {
      const store = getLocalStore();
      const sorted = [...store.hypotheses].sort(
        (a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime(),
      );
      return {
        hypotheses: sorted.map((r) => mapHypothesis(r, now)),
        summary: summarize(sorted, now),
      };
    }

    const { data, error } = await supabase
      .from("hypotheses")
      .select("*")
      .order("expires_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows: Tables<"hypotheses">[] = data ?? [];
    return {
      hypotheses: rows.map((r) => mapHypothesis(r, now)),
      summary: summarize(rows, now),
    };
  });

export const getAgentRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgentRun[]> => {
    const { supabase } = context as unknown as Ctx;

    if (!supabase) {
      const store = getLocalStore();
      return store.agentRuns.map(mapAgentRun);
    }

    const { data, error } = await supabase
      .from("agent_runs")
      .select("*")
      .order("ran_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapAgentRun);
  });

export const keepWithReason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1),
        reason: z.string().trim().min(3).max(600),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;

    if (!supabase) {
      const store = getLocalStore();
      const row = store.hypotheses.find((h) => h.id === data.id);
      if (!row) throw new Error("Hypothesis not found");
      row.keep_reason = data.reason;
      row.status = "kept_with_reason";
      store.auditLog.unshift({
        id: crypto.randomUUID(),
        org_id: store.org.id,
        change_id: null,
        action: "hypothesis_kept_with_reason",
        actor_id: userId,
        actor_name: store.displayName,
        details: { hypothesis_id: data.id, reason: data.reason },
        created_at: new Date().toISOString(),
      });
      return { ok: true };
    }

    const { data: updated, error } = await supabase
      .from("hypotheses")
      .update({ keep_reason: data.reason, status: "kept_with_reason" })
      .eq("id", data.id)
      .select("id, org_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Hypothesis not found");

    await supabase.from("audit_log").insert({
      org_id: updated.org_id,
      action: "hypothesis_kept_with_reason",
      actor_id: userId,
      details: { hypothesis_id: data.id, reason: data.reason },
    });

    return { ok: true };
  });

export const runHypothesesAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const now = Date.now();
    let checked = 0;
    let reducedCount = 0;
    let removeCount = 0;
    let keptCount = 0;

    if (!supabase) {
      const store = getLocalStore();
      for (const row of store.hypotheses) {
        const evaluated = evaluateHypothesisUsage(row, now);
        if (!evaluated) continue;
        checked += 1;
        if (evaluated.verdict === "reduce") reducedCount += 1;
        else if (evaluated.verdict === "remove") removeCount += 1;
        else keptCount += 1;

        row.verdict = evaluated.verdict;
        row.status = evaluated.status;
        row.reduced = evaluated.reduced as unknown as Json;
        row.last_checked_at = evaluated.last_checked_at;
      }

      const summaryPayload = {
        checked,
        proposals_reduce: reducedCount,
        proposals_remove: removeCount,
        verified_keep: keptCount,
        triggered_by: store.displayName,
      };

      const nextRun: Tables<"agent_runs"> = {
        id: (store.agentRuns[0]?.id ?? 0) + 1,
        org_id: store.org.id,
        ran_at: new Date(now).toISOString(),
        summary: summaryPayload as unknown as Json,
      };
      store.agentRuns.unshift(nextRun);

      store.auditLog.unshift({
        id: crypto.randomUUID(),
        org_id: store.org.id,
        change_id: null,
        action: "agent_run_completed",
        actor_id: userId,
        actor_name: store.displayName,
        details: summaryPayload as unknown as Json,
        created_at: nextRun.ran_at,
      });

      return mapAgentRun(nextRun);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.org_id) throw new Error("Organization profile not found");

    const { data: rows, error } = await supabase.from("hypotheses").select("*");
    if (error) throw new Error(error.message);

    for (const row of rows ?? []) {
      const evaluated = evaluateHypothesisUsage(row, now);
      if (!evaluated) continue;
      checked += 1;
      if (evaluated.verdict === "reduce") reducedCount += 1;
      else if (evaluated.verdict === "remove") removeCount += 1;
      else keptCount += 1;

      await supabase
        .from("hypotheses")
        .update({
          verdict: evaluated.verdict,
          status: evaluated.status,
          reduced: evaluated.reduced as unknown as Json,
          last_checked_at: evaluated.last_checked_at,
        })
        .eq("id", evaluated.id);
    }

    const summaryPayload = {
      checked,
      proposals_reduce: reducedCount,
      proposals_remove: removeCount,
      verified_keep: keptCount,
      triggered_by: profile.display_name || "console",
    };

    const { data: insertedRun, error: runErr } = await supabase
      .from("agent_runs")
      .insert({
        org_id: profile.org_id,
        ran_at: new Date(now).toISOString(),
        summary: summaryPayload as unknown as Json,
      })
      .select("*")
      .single();
    if (runErr) throw new Error(runErr.message);

    await supabase.from("audit_log").insert({
      org_id: profile.org_id,
      action: "agent_run_completed",
      actor_id: userId,
      actor_name: profile.display_name ?? null,
      details: summaryPayload as unknown as Json,
    });

    return mapAgentRun(insertedRun);
  });
