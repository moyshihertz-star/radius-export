import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getConsole } from "@/lib/radius.functions";
import type { ConsoleData } from "@/lib/radius-types";

export const CONSOLE_QUERY_KEY = ["radius", "console"] as const;

export function useConsole() {
  const fetchConsole = useServerFn(getConsole);
  const queryClient = useQueryClient();

  const query = useQuery<ConsoleData>({
    queryKey: CONSOLE_QUERY_KEY,
    queryFn: () => fetchConsole(),
  });

  useEffect(() => {
    if (!import.meta.env["VITE_SUPABASE_URL"]) return;
    // Unique topic per hook instance: several components use this hook at once,
    // and reusing one topic makes the second subscription throw.
    const channel = supabase
      .channel(`radius-console-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "changes" }, () => {
        queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "policy_weights" }, () => {
        queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
