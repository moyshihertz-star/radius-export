import { useState } from "react";
import { toast } from "sonner";
import { parseIacPayload } from "@/lib/iac-parser";
import { useI18n } from "@/lib/i18n";
import type { RadiusResource } from "@/lib/radius-types";

interface Props {
  resources: RadiusResource[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (v: {
    title: string;
    targetResourceId: string;
    newAccessResourceId: string | null;
    scopeBroadened: boolean;
  }) => void;
}

export function NewChangeModal({ resources, busy, onClose, onSubmit }: Props) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(resources[0]?.id ?? "");
  const [newAccess, setNewAccess] = useState("");
  const [scope, setScope] = useState(false);
  const [showIac, setShowIac] = useState(false);
  const [iacJson, setIacJson] = useState("");

  const handleParseIac = () => {
    try {
      const parsed = parseIacPayload(iacJson, resources);
      setTitle(parsed.title);
      setTarget(parsed.targetResourceId);
      setNewAccess(parsed.newAccessResourceId ?? "");
      setScope(parsed.scopeBroadened);
      toast.success(t("modal.parseSuccess"));
    } catch {
      toast.error(t("modal.parseError"));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("modal.title")}</h3>
        <div style={{ marginBottom: 14 }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ width: "100%", textAlign: "start", fontSize: 12.5 }}
            onClick={() => setShowIac((v) => !v)}
          >
            {showIac ? "▾ " : "▸ "}
            {t("modal.importIac")}
          </button>
          {showIac && (
            <div className="subcard" style={{ marginTop: 8, marginBottom: 0 }}>
              <textarea
                className="keep-input mono"
                rows={4}
                placeholder={t("modal.iacPlaceholder")}
                value={iacJson}
                onChange={(e) => setIacJson(e.target.value)}
              />
              <button
                type="button"
                className="btn-run"
                style={{ marginTop: 8 }}
                disabled={!iacJson.trim()}
                onClick={handleParseIac}
              >
                {t("modal.parseBtn")}
              </button>
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="f_title">{t("modal.name")}</label>
          <input
            id="f_title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("modal.namePlaceholder")}
          />
        </div>
        <div className="field">
          <label htmlFor="f_target">{t("modal.target")}</label>
          <select
            id="f_target"
            value={target}
            onChange={(e) => {
              const nextTarget = e.target.value;
              setTarget(nextTarget);
              if (newAccess === nextTarget) setNewAccess("");
            }}
          >
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f_newaccess">{t("modal.newAccess")}</label>
          <select id="f_newaccess" value={newAccess} onChange={(e) => setNewAccess(e.target.value)}>
            <option value="">{t("modal.newAccessNone")}</option>
            {resources
              .filter((r) => r.id !== target)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </div>
        <div className="checkfield">
          <input
            id="f_scope"
            type="checkbox"
            checked={scope}
            onChange={(e) => setScope(e.target.checked)}
          />
          <label htmlFor="f_scope" style={{ margin: 0 }}>
            {t("modal.scope")}
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose} type="button">
            {t("common.cancel")}
          </button>
          <button
            className="btn-run"
            type="button"
            disabled={busy || !target}
            onClick={() =>
              onSubmit({
                title,
                targetResourceId: target,
                newAccessResourceId: newAccess || null,
                scopeBroadened: scope,
              })
            }
          >
            {t("modal.run")}
          </button>
        </div>
      </div>
    </div>
  );
}
