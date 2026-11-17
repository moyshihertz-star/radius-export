import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AGENT_RUNS_QUERY_KEY, HYPOTHESES_QUERY_KEY, useAgentRuns } from "@/hooks/useHypotheses";
import { runHypothesesAgent } from "@/lib/hypotheses.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/runs")({
  head: () => ({
    meta: [
      { title: "Agent runs — Radius" },
      {
        name: "description",
        content: "Run history of the Radius agent and a summary of each run.",
      },
      { property: "og:title", content: "Agent runs — Radius" },
      { property: "og:description", content: "When the agent ran and what it found each time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RunsPage,
});

function RunsPage() {
  const { data, isLoading, error } = useAgentRuns();
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const runAgentFn = useServerFn(runHypothesesAgent);
  const runs = data ?? [];

  const runMutation = useMutation({
    mutationFn: () => runAgentFn(),
    onSuccess: async () => {
      toast.success(t("runs.completed"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: AGENT_RUNS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: HYPOTHESES_QUERY_KEY }),
      ]);
    },
    onError: () => toast.error(t("runs.failed")),
  });

  if (isLoading) return <div className="empty-note">{t("runs.loading")}</div>;
  if (error) return <div className="empty-note">{t("runs.loadError")}</div>;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t("runs.title")}</h3>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="env-tag">{t("runs.last")}</span>
          <button
            className="new-btn"
            disabled={runMutation.isPending}
            onClick={() => runMutation.mutate()}
          >
            {runMutation.isPending ? t("runs.running") : t("runs.runNow")}
          </button>
        </div>
      </div>
      {runs.length === 0 && <div className="empty-note">{t("runs.empty")}</div>}
      {runs.map((run) => (
        <div className="run-row" key={run.id}>
          <div className="run-time">
            {new Date(run.ranAt).toLocaleString(locale, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <pre className="run-summary mono">{run.summary ?? "—"}</pre>
        </div>
      ))}
    </div>
  );
}
