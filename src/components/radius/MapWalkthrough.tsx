import { useEffect, useMemo, useState } from "react";
import { GraphSvg } from "./GraphSvg";
import { useI18n } from "@/lib/i18n";
import type { ConsoleData, RadiusChange } from "@/lib/radius-types";

const STEP_MS = 4200;
const TOTAL_STEPS = 5;

function pickExample(changes: RadiusChange[]): RadiusChange | null {
  return (
    changes.find((c) => c.scopeBroadened && c.newAccessResourceId) ??
    changes.find((c) => c.simulation.consumers.length > 0) ??
    changes[0] ??
    null
  );
}

export function MapWalkthrough({ data }: { data: ConsoleData }) {
  const { t } = useI18n();
  const example = useMemo(() => pickExample(data.changes), [data.changes]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      setStep((s) => {
        if (s >= TOTAL_STEPS - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [playing, step]);

  if (!example) return <div className="empty-note">{t("walk.noData")}</div>;

  const byId = new Map(data.resources.map((r) => [r.id, r]));
  const sim = example.simulation;
  const targetName = byId.get(example.targetResourceId)?.name ?? "—";
  const accessName = example.newAccessResourceId
    ? (byId.get(example.newAccessResourceId)?.name ?? "—")
    : "—";

  const hop1 = sim.consumers.filter((c) => c.hop === 1);
  const deeper = sim.consumers.filter((c) => c.hop > 1);

  const hitIds = new Set<string>();
  if (step >= 1) hitIds.add(example.targetResourceId);
  if (step >= 2) hop1.forEach((c) => hitIds.add(c.id));
  if (step >= 3) deeper.forEach((c) => hitIds.add(c.id));
  if (step >= 4 && example.newAccessResourceId) hitIds.add(example.newAccessResourceId);

  const totalImpacted = sim.consumers.length + (example.newAccessResourceId ? 1 : 0);

  const bodies = [
    t("walk.s0.body", { target: targetName, access: accessName }),
    t("walk.s1.body", { target: targetName }),
    t("walk.s2.body", { target: targetName, count: hop1.length }),
    t("walk.s3.body", { count: deeper.length }),
    t("walk.s4.body", { count: totalImpacted, score: sim.score }),
  ];

  return (
    <div className="panel walk-panel">
      <div className="panel-head">
        <h3>{t("walk.title")}</h3>
        <span className="env-tag">{t("walk.step", { n: step + 1, total: TOTAL_STEPS })}</span>
      </div>

      <div className="walk-body">
        <div className="walk-graph">
          {step === 0 ? (
            <GraphSvg resources={data.resources} edges={data.edges} />
          ) : (
            <GraphSvg
              resources={data.resources}
              edges={data.edges}
              highlight={{
                targetId: example.targetResourceId,
                hitIds,
                newAccessId: step >= 4 ? example.newAccessResourceId : null,
              }}
            />
          )}
        </div>


        <div className="walk-side">
          <div className="walk-change mono">{example.title}</div>
          <div className="walk-step-title">{t(`walk.s${step}.title`)}</div>
          <p className="walk-step-body animate-fade-in" key={step}>
            {bodies[step]}
          </p>

          {step === TOTAL_STEPS - 1 && (
            <div className={`walk-verdict verdict-${sim.verdict}`}>{t(`verdict.${sim.verdict}`)}</div>
          )}

          <div className="walk-dots">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                className={`walk-dot ${i === step ? "on" : ""}`}
                aria-label={t("walk.step", { n: i + 1, total: TOTAL_STEPS })}
                onClick={() => {
                  setPlaying(false);
                  setStep(i);
                }}
              />
            ))}
          </div>

          <div className="walk-actions">
            <button
              className="btn-run"
              onClick={() => {
                if (playing) {
                  setPlaying(false);
                  return;
                }
                if (step >= TOTAL_STEPS - 1) setStep(0);
                setPlaying(true);
              }}
            >
              {playing
                ? t("walk.pause")
                : step >= TOTAL_STEPS - 1
                  ? t("walk.replay")
                  : t("walk.play")}
            </button>
            <button
              className="btn-ghost"
              disabled={step >= TOTAL_STEPS - 1}
              onClick={() => {
                setPlaying(false);
                setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
              }}
            >
              {t("walk.next")}
            </button>
          </div>

          <div className="walk-hint">{t("walk.hint")}</div>
        </div>
      </div>
    </div>
  );
}
