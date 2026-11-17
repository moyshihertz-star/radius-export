import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useConsole, CONSOLE_QUERY_KEY } from "@/hooks/useConsole";
import { saveWeights } from "@/lib/radius.functions";
import { useI18n } from "@/lib/i18n";
import type { PolicyWeights } from "@/lib/radius-types";

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
  { key: "threshold", min: 30, max: 90 },
  { key: "sensHigh", min: 0, max: 40 },
  { key: "sensMedium", min: 0, max: 40 },
  { key: "sensLow", min: 0, max: 40 },
  { key: "scopeBonus", min: 0, max: 40 },
  { key: "complianceBonus", min: 0, max: 40 },
];

function PolicyPage() {
  const { data, isLoading } = useConsole();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PolicyWeights | null>(null);
  const saveFn = useServerFn(saveWeights);

  useEffect(() => {
    if (data) setDraft(data.weights);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (w: PolicyWeights) => saveFn({ data: w }),
    onSuccess: async () => {
      toast.success(t("policy.saved"));
      await queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY });
    },
    onError: () => toast.error(t("policy.saveFailed")),
  });

  if (isLoading || !draft) return <div className="empty-note">{t("policy.loading")}</div>;

  return (
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
  );
}
