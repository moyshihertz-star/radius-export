import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CONSOLE_QUERY_KEY, useConsole } from "@/hooks/useConsole";
import { GraphSvg } from "@/components/radius/GraphSvg";
import { MapWalkthrough } from "@/components/radius/MapWalkthrough";
import { computeAutoLayout } from "@/lib/graph-layout";
import { useI18n } from "@/lib/i18n";
import { syncCloudTopology } from "@/lib/radius.functions";

export const Route = createFileRoute("/_authenticated/app/map")({
  head: () => ({
    meta: [
      { title: "Dependency map — Radius" },
      {
        name: "description",
        content: "The full dependency map between services, permissions and data stores.",
      },
      { property: "og:title", content: "Dependency map — Radius" },
      {
        property: "og:description",
        content: "The full dependency map of your cloud infrastructure.",
      },
    ],
  }),
  component: MapPage,
});

type FilterMode = "all" | "high" | "pii";

function MapPage() {
  const { data, isLoading } = useConsole();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const syncFn = useServerFn(syncCloudTopology);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [autoLayout, setAutoLayout] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [topologyJson, setTopologyJson] = useState("");

  const syncMutation = useMutation({
    mutationFn: (payload: string) => syncFn({ data: { payload } }),
    onSuccess: async (res) => {
      setSyncOpen(false);
      setTopologyJson("");
      toast.success(t("map.syncSuccess", { res: res.addedResources, edges: res.addedEdges }));
      await queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY });
    },
    onError: () => toast.error(t("map.syncError")),
  });

  const displayedResources = useMemo(() => {
    if (!data) return [];
    const base = autoLayout ? computeAutoLayout(data.resources, data.edges) : data.resources;
    const q = search.trim().toLowerCase();
    return base.filter((r) => {
      if (filter === "high" && r.sensitivity !== "high") return false;
      if (filter === "pii" && !r.tags.includes("pii") && !r.tags.includes("compliance")) {
        return false;
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.key.toLowerCase().includes(q) ||
        r.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [data, autoLayout, filter, search]);

  return (
    <>
      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 10 }}>
          <h3>{t("map.title")}</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder={t("map.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--hairline)",
                color: "var(--fg)",
                padding: "5px 10px",
                borderRadius: 6,
                fontSize: 12.5,
              }}
            />
            {(["all", "high", "pii"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`tab-btn ${filter === mode ? "active" : ""}`}
                style={{ padding: "5px 10px", fontSize: 12 }}
                onClick={() => setFilter(mode)}
              >
                {t(
                  mode === "all"
                    ? "map.filterAll"
                    : mode === "high"
                      ? "map.filterHigh"
                      : "map.filterPii",
                )}
              </button>
            ))}
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: "5px 12px", fontSize: 12 }}
              onClick={() => setAutoLayout((v) => !v)}
            >
              {autoLayout ? t("map.savedLayout") : t("map.autoLayout")}
            </button>
            <button
              type="button"
              className="new-btn"
              style={{ padding: "5px 12px", fontSize: 12 }}
              onClick={() => setSyncOpen(true)}
            >
              {t("map.syncBtn")}
            </button>
          </div>
        </div>
        <div className="map-legend">
          <span>
            <span className="legend-dot" style={{ background: "#FF7A45" }} />
            {t("map.legendRole")}
          </span>
          <span>
            <span className="legend-dot" style={{ background: "#4C86FF" }} />
            {t("map.legendService")}
          </span>
          <span>
            <span className="legend-dot" style={{ background: "#B26BFF" }} />
            {t("map.legendData")}
          </span>
          <span>
            <span className="legend-dot" style={{ background: "#5B6672" }} />
            {t("map.legendExternal")}
          </span>
        </div>
        <div style={{ padding: 20 }}>
          {isLoading || !data ? (
            <div className="empty-note">{t("map.loading")}</div>
          ) : (
            <GraphSvg resources={displayedResources} edges={data.edges} />
          )}
        </div>
      </div>

      {data && <MapWalkthrough data={data} />}

      {syncOpen && (
        <div className="modal-backdrop" onClick={() => setSyncOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t("map.syncTitle")}</h3>
            <textarea
              className="keep-input mono"
              rows={6}
              placeholder={t("map.syncPlaceholder")}
              value={topologyJson}
              onChange={(e) => setTopologyJson(e.target.value)}
            />
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button type="button" className="btn-ghost" onClick={() => setSyncOpen(false)}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn-run"
                disabled={syncMutation.isPending || !topologyJson.trim()}
                onClick={() => syncMutation.mutate(topologyJson)}
              >
                {t("map.syncAction")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
