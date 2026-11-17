import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useConsole, CONSOLE_QUERY_KEY } from "@/hooks/useConsole";
import { ChangeDetail } from "@/components/radius/ChangeDetail";
import { NewChangeModal } from "@/components/radius/NewChangeModal";
import { createChange, decideChange } from "@/lib/radius.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/changes")({
  head: () => ({
    meta: [
      { title: "Pending changes — Radius" },
      {
        name: "description",
        content: "The cloud infrastructure change queue, its risk scores and impacted resources.",
      },
      { property: "og:title", content: "Pending changes — Radius" },
      { property: "og:description", content: "The cloud change queue and its risk scores." },
    ],
  }),
  component: ChangesPage,
});

function ChangesPage() {
  const { data, isLoading, error } = useConsole();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const decideFn = useServerFn(decideChange);
  const createFn = useServerFn(createChange);

  useEffect(() => {
    const first = data?.changes[0];
    if (!first) return;
    setSelectedId((cur) => (cur && data.changes.some((c) => c.id === cur) ? cur : first.id));
  }, [data]);

  const decideMutation = useMutation({
    mutationFn: (vars: {
      changeId: string;
      decision: "approved" | "blocked";
      note?: string | undefined;
    }) => decideFn({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(t(vars.decision === "approved" ? "changes.approved" : "changes.blocked"));
      void queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["radius", "audit-ci"] });
    },
    onError: () => toast.error(t("changes.actionFailed")),
  });

  const createMutation = useMutation({
    mutationFn: (vars: {
      title: string;
      targetResourceId: string;
      newAccessResourceId: string | null;
      scopeBroadened: boolean;
    }) => createFn({ data: vars }),
    onSuccess: async (res) => {
      setModalOpen(false);
      setSelectedId(res.id);
      toast.success(t("changes.simulationSaved"));
      await queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY });
    },
    onError: () => toast.error(t("changes.createFailed")),
  });

  if (isLoading) return <div className="empty-note">{t("changes.loading")}</div>;
  if (error || !data) return <div className="auth-error">{t("changes.loadError")}</div>;

  const selected = data.changes.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="dash-grid">
      <div className="panel">
        <div className="panel-head">
          <h3>{t("changes.title", { count: data.changes.length })}</h3>
          <button className="new-btn" onClick={() => setModalOpen(true)}>
            {t("changes.new")}
          </button>
        </div>
        {data.changes.length === 0 && (
          <div className="empty-note" style={{ padding: 18 }}>
            {t("changes.empty")}
          </div>
        )}
        {data.changes.map((c) => (
          <button
            key={c.id}
            className={`change-item ${c.id === selectedId ? "selected" : ""}`}
            onClick={() => setSelectedId(c.id)}
          >
            <div className="change-title">{c.title}</div>
            <div className="change-meta">
              <span>
                {c.author} · {t("changes.score", { score: c.simulation.score })}
              </span>
              <span className={`status-chip status-${c.status}`}>{t(`status.${c.status}`)}</span>
            </div>
          </button>
        ))}
      </div>

      {selected ? (
        <ChangeDetail
          change={selected}
          data={data}
          deciding={decideMutation.isPending}
          onDecide={(decision, note) =>
            decideMutation.mutate({ changeId: selected.id, decision, note })
          }
        />
      ) : (
        <div className="panel" style={{ padding: 22 }}>
          <div className="empty-note">{t("changes.pick")}</div>
        </div>
      )}

      {modalOpen && (
        <NewChangeModal
          resources={data.resources}
          busy={createMutation.isPending}
          onClose={() => setModalOpen(false)}
          onSubmit={(v) => createMutation.mutate(v)}
        />
      )}
    </div>
  );
}
