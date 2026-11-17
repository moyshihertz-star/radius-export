import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useConsole, CONSOLE_QUERY_KEY } from "@/hooks/useConsole";
import { previewPolicy, saveWeights } from "@/lib/radius.functions";
import { useI18n } from "@/lib/i18n";
import type { PolicyWeights, SimulationResult } from "@/lib/radius-types";

export const Route = createFileRoute("/_authenticated/app/policy")({
  head: () => ({
    meta: [
      { title: "Risk policy — Radius" },
      {
        name: "description",
        content: "Tune the risk engine weights and the approval threshold of your organization.",
      },
      { property: "og:title", content: "Risk policy — Radius" },
      { property: "og:description", content: "Tune your organization's risk engine weights." },
    ],
  }),
  component: PolicyPage,
});

const SLIDERS: { key: keyof PolicyWeights; min: number; max: number }[] = [
  { key: "threshold", min: 30, max: 95 },
  { key: "sensHigh", min: 4, max: 30 },
  { key: "sensMedium", min: 1, max: 30 },
  { key: "sensLow", min: 0, max: 30 },
  { key: "scopeBonus", min: 0, max: 40 },
  { key: "complianceBonus", min: 0, max: 40 },
];

function PolicyPage() {
  const { data, isLoading } = useConsole();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PolicyWeights | null>(null);
  const [previewChangeId, setPreviewChangeId] = useState<string>("");
  const [previewResult, setPreviewResult] = useState<SimulationResult | null>(null);
  const saveFn = useServerFn(saveWeights);
  const previewFn = useServerFn(previewPolicy);

  useEffect(() => {
    if (data) {
      setDraft(data.weights);
      setPreviewChangeId((cur) => cur || data.changes[0]?.id || "");
    }
  }, [data]);

  useEffect(() => {
    if (!draft || !previewChangeId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void previewFn({ data: { changeId: previewChangeId, weights: draft } })
        .then((res) => {
          if (!cancelled) setPreviewResult(res);
        })
        .catch(() => {
          // Ignore transient preview errors while dragging sliders
        });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draft, previewChangeId, previewFn]);

  const mutation = useMutation({
    mutationFn: (w: PolicyWeights) => saveFn({ data: w }),
    onSuccess: async () => {
      toast.success(t("policy.saved"));
      await queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY });
    },
    onError: () => toast.error(t("policy.saveFailed")),
  });

  if (isLoading || !draft) return <div className="empty-note">{t("policy.loading")}</div>;

  const fallbackSim = data?.changes.find((c) => c.id === previewChangeId)?.simulation ?? null;
  const activeSim = previewResult ?? fallbackSim;

  return (
    <div className="policy-grid">
      <div className="panel policy-panel">
        <div className="panel-head">
          <h3>{t("policy.title")}</h3>
        </div>
        <div style={{ padding: 20 }}>
          <p className="detail-sub" style={{ marginBottom: 20 }}>
            {t("policy.intro")}
          </p>
          {SLIDERS.map((s) => (
            <div className="slider-row" key={s.key}>
              <div className="slider-label">
                <span>{t(`policy.${s.key}`)}</span>
                <span className="slider-value">{draft[s.key]}</span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                value={draft[s.key]}
                onChange={(e) => setDraft({ ...draft, [s.key]: Number(e.target.value) })}
              />
              <div className="slider-hint">{t(`policy.${s.key}Hint`)}</div>
            </div>
          ))}
          <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
            <button
              className="btn-run"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(draft)}
            >
              {t("policy.save")}
            </button>
            <button className="btn-ghost" onClick={() => data && setDraft(data.weights)}>
              {t("policy.reset")}
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>{t("policy.previewTitle")}</h3>
        </div>
        <div style={{ padding: 20 }}>
          <p className="detail-sub" style={{ marginBottom: 16 }}>
            {t("policy.previewSub")}
          </p>
          {data && data.changes.length > 0 ? (
            <>
              <div className="field">
                <label htmlFor="preview_change">{t("policy.previewSelect")}</label>
                <select
                  id="preview_change"
                  value={previewChangeId}
                  onChange={(e) => setPreviewChangeId(e.target.value)}
                >
                  {data.changes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {activeSim && (
                <div className="subcard" style={{ marginBottom: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 14,
                    }}
                  >
                    <span className="detail-title">
                      {t("changes.score", { score: activeSim.score })}
                    </span>
                    <span className={`verdict-pill verdict-${activeSim.verdict}`}>
                      {t(`verdict.${activeSim.verdict}`)}
                    </span>
                  </div>
                  <div className="live-note" style={{ marginBottom: 12 }}>
                    {t("detail.outOf", { threshold: draft.threshold })}
                  </div>
                  {activeSim.breakdown.map((b, i) => (
                    <div className="breakdown-row" key={i}>
                      <span>{b.key ? t(b.key, b.params) : b.label}</span>
                      <span className="breakdown-pts">+{b.points}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty-note">{t("changes.empty")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
