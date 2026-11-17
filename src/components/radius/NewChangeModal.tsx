import { useState } from "react";
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("modal.title")}</h3>
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
