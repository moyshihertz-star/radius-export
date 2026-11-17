import { createFileRoute, Outlet, useRouterState, Link } from "@tanstack/react-router";
import { RadiusLogo } from "@/components/radius/RadiusLogo";
import { useConsole } from "@/hooks/useConsole";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app")({
  component: ConsoleLayout,
});

const TABS = [
  { to: "/app/changes", key: "nav.changes" },
  { to: "/app/hypotheses", key: "nav.hypotheses" },
  { to: "/app/map", key: "nav.map" },
  { to: "/app/policy", key: "nav.policy" },
  { to: "/app/runs", key: "nav.runs" },
] as const;

function ConsoleLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data } = useConsole();
  const { t, toggleLang } = useI18n();

  return (
    <>
      <div className="topbar">
        <div className="logo">
          <RadiusLogo />
          Radius
        </div>
        <div className="tabs">
          {TABS.map((tab) => (
            <Link key={tab.to} to={tab.to}>
              <span className={`tab-btn ${pathname === tab.to ? "active" : ""}`}>{t(tab.key)}</span>
            </Link>
          ))}
        </div>
        <div className="topbar-right">
          <button className="lang-btn" onClick={toggleLang} title={t("nav.langTitle")}>
            {t("nav.lang")}
          </button>
          <span className="env-tag">production · {data?.orgName ?? "…"}</span>
        </div>
      </div>
      <div className="app-shell">
        <Outlet />
      </div>
    </>
  );
}
