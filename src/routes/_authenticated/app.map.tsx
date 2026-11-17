import { createFileRoute } from "@tanstack/react-router";
import { useConsole } from "@/hooks/useConsole";
import { GraphSvg } from "@/components/radius/GraphSvg";
import { MapWalkthrough } from "@/components/radius/MapWalkthrough";
import { useI18n } from "@/lib/i18n";

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

function MapPage() {
  const { data, isLoading } = useConsole();
  const { t } = useI18n();

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h3>{t("map.title")}</h3>
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
            <GraphSvg resources={data.resources} edges={data.edges} />
          )}
        </div>
      </div>

      {data && <MapWalkthrough data={data} />}
    </>
  );
}
