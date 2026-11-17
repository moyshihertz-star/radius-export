import { useMemo } from "react";
import { GraphSvg } from "./GraphSvg";
import { useI18n } from "@/lib/i18n";
import type { ConsoleData, RadiusChange } from "@/lib/radius-types";

interface Props {
  change: RadiusChange;
  data: ConsoleData;
  onDecide: (decision: "approved" | "blocked") => void;
  deciding: boolean;
}

export function ChangeDetail({ change, data, onDecide, deciding }: Props) {
  const { t, locale } = useI18n();
  const byId = useMemo(() => new Map(data.resources.map((r) => [r.id, r])), [data.resources]);
  const result = change.simulation;
  const targetNode = byId.get(change.targetResourceId);
  const newResourceNode = result.newResourceId ? byId.get(result.newResourceId) : null;

  const hitIds = new Set<string>([
    change.targetResourceId,
    ...result.consumers.map((c) => c.id),
    ...(newResourceNode ? [newResourceNode.id] : []),
  ]);

  const gaugeColor =
    result.verdict === "high"
      ? "var(--signal)"
      : result.verdict === "medium"
        ? "var(--warn)"
        : "var(--confirm)";

  return (
    <div className="panel">
      <div className="detail-top">
        <div>
          <div className="detail-title">{change.title}</div>
          <div className="detail-sub">
            {change.author} · {t("detail.target", { name: targetNode?.name ?? "—" })}
            {change.scopeBroadened ? t("detail.scope") : ""}
          </div>
        </div>
        <span className={`verdict-pill verdict-${result.verdict}`}>
          {t(`verdict.${result.verdict}`)}
        </span>
      </div>

      <div className="detail-body">
        <div>
          <div className="subcard">
            <h4>{t("detail.blast")}</h4>
            <GraphSvg
              resources={data.resources}
              edges={data.edges}
              highlight={{
                targetId: change.targetResourceId,
                hitIds,
                newAccessId: change.newAccessResourceId,
              }}
            />
          </div>
          <div className="subcard">
            <h4>
              {t("detail.impacted", {
                count: result.consumers.length + (newResourceNode ? 1 : 0),
              })}
            </h4>
            <ul className="imp-list">
              {newResourceNode && (
                <li className="imp-item">
                  <div>
                    <div>{newResourceNode.name}</div>
                    <div className="imp-reason">{t("detail.newAccessReason")}</div>
                  </div>
                  <span className={`badge badge-${newResourceNode.sensitivity}`}>
                    {t("detail.newResource")}
                  </span>
                </li>
              )}
              {result.consumers.length === 0 && !newResourceNode ? (
                <div className="empty-note">{t("detail.noDependents")}</div>
              ) : (
                result.consumers.map((c) => {
                  const n = byId.get(c.id);
                  if (!n) return null;
                  return (
                    <li className="imp-item" key={c.id}>
                      <div>
                        <div>{n.name}</div>
                        <div className="imp-reason">
                          {t("detail.dependsOn", {
                            name: targetNode?.name ?? "—",
                            hops: c.hop === 1 ? t("detail.hop") : t("detail.hops", { n: c.hop }),
                          })}
                        </div>
                      </div>
                      <span className={`badge badge-${n.sensitivity}`}>
                        {t(`sensitivity.${n.sensitivity}`)}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>

        <div>
          <div className="subcard">
            <h4>{t("detail.riskScore")}</h4>
            <div className="gauge-box">
              <svg width="150" height="80" viewBox="0 0 150 80">
                <path
                  d="M10,75 A65,65 0 0,1 140,75"
                  fill="none"
                  stroke="#242D38"
                  strokeWidth="11"
                />
                <path
                  d="M10,75 A65,65 0 0,1 140,75"
                  fill="none"
                  stroke={gaugeColor}
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={`${(result.score / 100) * 204} 204`}
                />
              </svg>
              <div className="gauge-score" style={{ color: gaugeColor }}>
                {result.score}
              </div>
              <div className="gauge-verdict-label">
                {t("detail.outOf", { threshold: data.weights.threshold })}
              </div>
            </div>
          </div>
          <div className="subcard">
            <h4>{t("detail.breakdown")}</h4>
            {result.breakdown.map((b, i) => (
              <div className="breakdown-row" key={i}>
                <span>{b.key ? t(b.key, b.params) : b.label}</span>
                <span className="breakdown-pts">+{b.points}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="action-row">
        <button
          className="btn-approve"
          onClick={() => onDecide("approved")}
          disabled={deciding || change.status === "approved"}
        >
          {t("detail.approve")}
        </button>
        <button
          className="btn-block"
          onClick={() => onDecide("blocked")}
          disabled={deciding || change.status === "blocked"}
        >
          {t("detail.block")}
        </button>
        {change.decidedAt && (
          <span className="decided-note">
            {t(change.status === "approved" ? "detail.decidedApproved" : "detail.decidedBlocked", {
              date: new Date(change.decidedAt).toLocaleString(locale),
            })}
          </span>
        )}
      </div>
    </div>
  );
}
