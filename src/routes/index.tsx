import { createFileRoute, Link } from "@tanstack/react-router";
import { RadiusLogo } from "@/components/radius/RadiusLogo";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radius — know what will change before production" },
      {
        name: "description",
        content:
          "Radius analyzes every cloud permission and configuration change, computes a transparent risk score and shows exactly which services are impacted.",
      },
      { property: "og:title", content: "Radius — risk analysis for cloud infrastructure changes" },
      {
        property: "og:description",
        content:
          "A transparent risk engine, a dependency map and a blast radius simulation for every change.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, toggleLang } = useI18n();

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ width: "min(560px, 94vw)" }}>
        <div
          className="logo"
          style={{ marginBottom: 18, display: "flex", justifyContent: "space-between" }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <RadiusLogo />
            Radius
          </span>
          <button className="lang-btn" onClick={toggleLang} title={t("nav.langTitle")}>
            {t("nav.lang")}
          </button>
        </div>
        <h1>{t("landing.title")}</h1>
        <p className="auth-sub" style={{ marginTop: 10 }}>
          {t("landing.sub")}
        </p>
        <Link to="/app/changes" className="new-btn btn-full" style={{ display: "inline-block" }}>
          {t("landing.cta")}
        </Link>
      </div>
    </div>
  );
}
