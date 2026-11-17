import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { HypothesisDetail } from "@/components/radius/HypothesisDetail";
import { useHypotheses, HYPOTHESES_QUERY_KEY } from "@/hooks/useHypotheses";
import { keepWithReason } from "@/lib/hypotheses.functions";
import { daysLeftTone } from "@/lib/hypotheses-types";
import { useI18n, daysLeftKey } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/hypotheses")({
  head: () => ({
    meta: [
      { title: "Permission hypotheses — Radius" },
      {
        name: "description",
        content:
          "Permissions with an expiry date, what was actually used and what the agent proposes to reduce.",
      },
      { property: "og:title", content: "Permission hypotheses — Radius" },
      {
        property: "og:description",
        content: "A permission either proves it is needed, or it goes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HypothesesPage,
});

const VERDICT_CLASS: Record<string, string> = {
  keep: "hyp-verdict-keep",
  reduce: "hyp-verdict-reduce",
  remove: "hyp-verdict-remove",
};

function HypothesesPage() {
  const { data, isLoading, error } = useHypotheses();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const keepFn = useServerFn(keepWithReason);

  useEffect(() => {
    const first = data?.hypotheses[0];
    if (!first) return;
    setSelectedId((cur) => (cur && data.hypotheses.some((h) => h.id === cur) ? cur : first.id));
  }, [data]);

  const keepMutation = useMutation({
    mutationFn: (vars: { id: string; reason: string }) => keepFn({ data: vars }),
    onSuccess: () => {
      toast.success(t("hyp.saved"));
      void queryClient.invalidateQueries({ queryKey: HYPOTHESES_QUERY_KEY });
    },
    onError: () => toast.error(t("hyp.saveFailed")),
  });

  if (isLoading) return <div className="empty-note">{t("hyp.loading")}</div>;
  if (error) return <div className="empty-note">{t("hyp.loadError")}</div>;
  if (!data) return null;

  const selected = data.hypotheses.find((h) => h.id === selectedId) ?? null;

  const stats = [
    { key: "hyp.statActive", value: data.summary.active },
    { key: "hyp.statExpiring", value: data.summary.expiringThisWeek },
    { key: "hyp.statPrs", value: data.summary.openPrs },
    { key: "hyp.statRemoved", value: data.summary.removedLast30Days },
  ];

  return (
    <>
      <div className="stat-row">
        {stats.map((s) => (
          <div className="stat-card" key={s.key}>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{t(s.key)}</div>
          </div>
        ))}
      </div>

      <div className="hyp-grid">
        <div className="panel">
          <div className="panel-head">
            <h3>{t("hyp.title")}</h3>
            <span className="env-tag">{t("hyp.sorted")}</span>
          </div>
          {data.hypotheses.length === 0 && <div className="empty-note">{t("hyp.empty")}</div>}
          {data.hypotheses.map((h) => {
            const dl = daysLeftKey(h.daysLeft);
            return (
              <div
                key={h.id}
                className={`change-item ${h.id === selectedId ? "selected" : ""}`}
                onClick={() => setSelectedId(h.id)}
              >
                <div className="change-title">{h.label ?? h.sid}</div>
                <div className="change-meta">
                  <span className="mono">{h.roleName}</span>
                  <span className={`days-pill days-${daysLeftTone(h.daysLeft)}`}>
                    {t(dl.key, dl.params)}
                  </span>
                  <span className={`status-chip hyp-status-${h.status}`}>
                    {t(`hypStatus.${h.status}`)}
                  </span>
                  {h.verdict && (
                    <span className={`status-chip ${VERDICT_CLASS[h.verdict]}`}>{h.verdict}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selected ? (
          <HypothesisDetail
            hypothesis={selected}
            saving={keepMutation.isPending}
            onKeep={(reason) => keepMutation.mutate({ id: selected.id, reason })}
          />
        ) : (
          <div className="panel">
            <div className="empty-note">{t("hyp.pick")}</div>
          </div>
        )}
      </div>
    </>
  );
}
