import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mapAgentRun, mapHypothesis, summarize } from "./hypotheses-engine.server";
import type { AgentRun, HypothesesData } from "./hypotheses-types";

export const getHypotheses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HypothesesData> => {
    const supabase = (context as any).supabase;
    const { data, error } = await supabase
      .from("hypotheses")
      .select("*")
      .order("expires_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Record<string, any>[];
    const now = Date.now();
    return {
      hypotheses: rows.map((r) => mapHypothesis(r, now)),
      summary: summarize(rows, now),
    };
  });

export const getAgentRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgentRun[]> => {
    const supabase = (context as any).supabase;
    const { data, error } = await supabase
      .from("agent_runs")
      .select("*")
      .order("ran_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, any>[]).map(mapAgentRun);
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
    const supabase = (context as any).supabase;
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
      actor_id: (context as any).userId,
      details: { hypothesis_id: data.id, reason: data.reason },
    });

    return { ok: true };
  });
