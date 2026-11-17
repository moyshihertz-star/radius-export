import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Tables } from "@/integrations/supabase/types";
import { mapAgentRun, mapHypothesis, summarize } from "./hypotheses-engine.server";
import type { AgentRun, HypothesesData } from "./hypotheses-types";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

export const getHypotheses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HypothesesData> => {
    const { supabase } = context as unknown as Ctx;
    const { data, error } = await supabase
      .from("hypotheses")
      .select("*")
      .order("expires_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows: Tables<"hypotheses">[] = data ?? [];
    const now = Date.now();
    return {
      hypotheses: rows.map((r) => mapHypothesis(r, now)),
      summary: summarize(rows, now),
    };
  });

export const getAgentRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgentRun[]> => {
    const { supabase } = context as unknown as Ctx;
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
