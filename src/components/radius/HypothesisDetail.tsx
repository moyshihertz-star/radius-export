import { useEffect, useState } from "react";
import { useI18n, daysLeftKey } from "@/lib/i18n";
import { daysLeftTone, type Hypothesis } from "@/lib/hypotheses-types";

interface Props {
  hypothesis: Hypothesis;
  onKeep: (reason: string) => void;
  saving: boolean;
}

export function HypothesisDetail({ hypothesis, onKeep, saving }: Props) {
  const { t, locale } = useI18n();
  const [reason, setReason] = useState("");
  const h = hypothesis;

  useEffect(() => {
    setReason("");
  }, [h.id]);

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const tone = daysLeftTone(h.daysLeft);
  const dl = daysLeftKey(h.daysLeft);

  return (
    <div className="panel">
      <div className="detail-top">
        <div>
          <div className="detail-title">{h.label ?? h.sid}</div>
          <div className="detail-sub">
            <span className="mono">{h.roleName}</span> ·{" "}
            {t("hyp.window", { days: h.windowDays, date: formatDate(h.lastCheckedAt) })}
          </div>
        </div>
        <div className="hyp-detail-tags">
          <span className={`days-pill days-${tone}`}>{t(dl.key, dl.params)}</span>
          <span className={`status-chip hyp-status-${h.status}`}>{t(`hypStatus.${h.status}`)}</span>
        </div>
      </div>

      <div className="hyp-detail-body">
        <div className="subcard diff-card">
          <h4>{t("hyp.diffTitle")}</h4>
          {h.diff.hasProposal ? (
            <p className="diff-note">
              {t("hyp.diffNote", {
                verdict: h.verdict ? t(`hypVerdict.${h.verdict}`) : t("hypVerdict.proposal"),
              })}
            </p>
          ) : (
            <p className="diff-note">{t("hyp.diffPending")}</p>
          )}

          <div className="diff-grid">
            <div>
              <div className="diff-col-title">Action</div>
              {h.diff.actions.length === 0 && (
                <div className="empty-note">{t("common.noValues")}</div>
              )}
              {h.diff.actions.map((line) => (
                <div key={`a-${line.value}`} className={`diff-line ${line.kept ? "keep" : "drop"}`}>
                  <span className="diff-sign">{line.kept ? "+" : "−"}</span>
                  <span className="mono">{line.value}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="diff-col-title">Resource</div>
              {h.diff.resources.length === 0 && (
                <div className="empty-note">{t("common.noValues")}</div>
              )}
              {h.diff.resources.map((line) => (
                <div key={`r-${line.value}`} className={`diff-line ${line.kept ? "keep" : "drop"}`}>
                  <span className="diff-sign">{line.kept ? "+" : "−"}</span>
                  <span className="mono">{line.value}</span>
                </div>
              ))}
            </div>
          </div>

          {h.reductionPrUrl && (
            <a className="pr-link" href={h.reductionPrUrl} target="_blank" rel="noreferrer">
              {t("hyp.prLink")}
            </a>
          )}
        </div>

        <div className="hyp-side">
          <div className="subcard">
            <h4>{t("hyp.observed")}</h4>
            {h.used.length === 0 ? (
              <div className="empty-note">{t("hyp.observedEmpty")}</div>
            ) : (
              <table className="used-table">
                <thead>
                  <tr>
                    <th>{t("hyp.thAction")}</th>
                    <th>{t("hyp.thCount")}</th>
                    <th>{t("hyp.thResources")}</th>
                    <th>{t("hyp.thLast")}</th>
                  </tr>
                </thead>
                <tbody>
                  {h.used.map((u) => (
                    <tr key={u.action}>
                      <td className="mono">{u.action}</td>
                      <td>{u.count.toLocaleString(locale)}</td>
                      <td className="mono used-res">{u.resources.join(", ") || "—"}</td>
                      <td>{formatDate(u.last)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="subcard">
            <h4>{t("hyp.granted")}</h4>
            <div className="granted-block">
              <div className="diff-col-title">Action</div>
              <div className="mono granted-list">{h.grantedActions.join(", ") || "—"}</div>
              <div className="diff-col-title">Resource</div>
              <div className="mono granted-list">{h.grantedResources.join(", ") || "—"}</div>
              <div className="diff-col-title">{t("hyp.file")}</div>
              <div className="mono granted-list">{h.file}</div>
            </div>
          </div>

          <div className="subcard">
            <h4>{t("hyp.keepTitle")}</h4>
            {h.keepReason ? (
              <div className="keep-reason-saved">
                <strong>{t("hyp.keepSaved")}</strong> {h.keepReason}
              </div>
            ) : null}
            <textarea
              className="keep-input"
              rows={3}
              placeholder={t("hyp.keepPlaceholder")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              className="btn-run"
              disabled={saving || reason.trim().length < 3}
              onClick={() => onKeep(reason.trim())}
            >
              {saving ? t("hyp.keepSaving") : t("hyp.keepAction")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
