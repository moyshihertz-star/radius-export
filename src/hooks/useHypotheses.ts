import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAgentRuns, getHypotheses } from "@/lib/hypotheses.functions";
import type { AgentRun, HypothesesData } from "@/lib/hypotheses-types";

export const HYPOTHESES_QUERY_KEY = ["radius", "hypotheses"] as const;
export const AGENT_RUNS_QUERY_KEY = ["radius", "agent-runs"] as const;

function useRealtime(tables: string[], keys: readonly (readonly string[])[]) {
  const queryClient = useQueryClient();
  const tableKey = tables.join(",");

  useEffect(() => {
    if (!import.meta.env["VITE_SUPABASE_URL"]) return;
    const channel = supabase.channel(`radius-hyp-${Math.random().toString(36).slice(2)}`);
    for (const table of tableKey.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        for (const key of keys) queryClient.invalidateQueries({ queryKey: key });
      });
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, tableKey]);
}

export function useHypotheses() {
  const fetchHypotheses = useServerFn(getHypotheses);
  useRealtime(["hypotheses"], [HYPOTHESES_QUERY_KEY]);

  return useQuery<HypothesesData>({
    queryKey: HYPOTHESES_QUERY_KEY,
    queryFn: () => fetchHypotheses(),
  });
}

export function useAgentRuns() {
  const fetchRuns = useServerFn(getAgentRuns);
  useRealtime(["agent_runs"], [AGENT_RUNS_QUERY_KEY]);

  return useQuery<AgentRun[]>({
    queryKey: AGENT_RUNS_QUERY_KEY,
    queryFn: () => fetchRuns(),
  });
}
