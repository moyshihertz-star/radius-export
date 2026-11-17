import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAuditAndCi } from "@/lib/radius.functions";
import { useI18n } from "@/lib/i18n";
import type { AuditAndCiData, AuditEntry } from "@/lib/radius-types";

export const Route = createFileRoute("/_authenticated/app/audit")({
  head: () => ({
    meta: [
      { title: "Audit & CI — Radius" },
      {
        name: "description",
        content: "Compliance audit log and CI/CD webhook integration for Radius.",
      },
    ],
  }),
  component: AuditPage,
});

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(entries: AuditEntry[]): string {
  const escape = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const header = "id,created_at,action,actor_name,change_id,details";
  const rows = entries.map((e) =>
    [e.id, e.createdAt, e.action, e.actorName, e.changeId, e.details].map(escape).join(","),
  );
  return [header, ...rows].join("\n");
}

function AuditPage() {
  const fetchAudit = useServerFn(getAuditAndCi);
  const { t, locale } = useI18n();

  const { data, isLoading, error } = useQuery<AuditAndCiData>({
    queryKey: ["radius", "audit-ci"],
    queryFn: () => fetchAudit(),
  });

  if (isLoading) return <div className="empty-note">{t("common.loading")}</div>;
  if (error || !data) return <div className="empty-note">{t("changes.loadError")}</div>;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-radius.app";
  const endpointUrl = `${origin}/api/public/ingest`;
  const curlSnippet = `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-radius-ingest-key: ${data.ingestKey}" \\
  -d '{
    "title": "tf: aws_iam_role_policy.payments",
    "author": "github-actions",
    "target": "iam-role-payments",
    "iamPolicy": {
      "Statement": [{
        "Effect": "Allow",
        "Action": ["s3:*", "rds:*"],
        "Resource": ["arn:aws:rds:::db:customer-db"]
      }]
    }
  }'`;

  const copyText = (value: string) => {
    void navigator.clipboard.writeText(value).then(() => toast.success(t("audit.copied")));
  };

  return (
    <div className="policy-grid">
      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 8 }}>
          <h3>{t("audit.title")}</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: "5px 12px", fontSize: 12 }}
              onClick={() => downloadBlob("radius-audit-log.csv", toCsv(data.entries), "text/csv")}
            >
              {t("audit.exportCsv")}
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: "5px 12px", fontSize: 12 }}
              onClick={() =>
                downloadBlob(
                  "radius-audit-log.json",
                  JSON.stringify(data.entries, null, 2),
                  "application/json",
                )
              }
            >
              {t("audit.exportJson")}
            </button>
          </div>
        </div>
        {data.entries.length === 0 && (
          <div className="empty-note" style={{ padding: 18 }}>
            {t("audit.empty")}
          </div>
        )}
        {data.entries.map((entry) => (
          <div className="run-row" key={entry.id}>
            <div className="run-time">
              <div>
                {new Date(entry.createdAt).toLocaleString(locale, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className="mono" style={{ marginTop: 4 }}>
                {entry.actorName ?? "system"}
              </div>
            </div>
            <div>
              <span
                className="status-chip status-pending"
                style={{ marginBottom: 6, display: "inline-block" }}
              >
                {entry.action}
              </span>
              <pre className="run-summary mono">{entry.details}</pre>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>{t("audit.ciTitle")}</h3>
        </div>
        <div style={{ padding: 20 }}>
          <p className="detail-sub" style={{ marginBottom: 16 }}>
            {t("audit.ciSub")}
          </p>

          <div className="subcard">
            <div className="diff-col-title">{t("audit.endpoint")}</div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span className="mono">{endpointUrl}</span>
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => copyText(endpointUrl)}
              >
                {t("audit.copy")}
              </button>
            </div>
          </div>

          <div className="subcard">
            <div className="diff-col-title">{t("audit.ingestKey")}</div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span className="mono">{data.ingestKey || "—"}</span>
              {data.ingestKey && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => copyText(data.ingestKey)}
                >
                  {t("audit.copy")}
                </button>
              )}
            </div>
          </div>

          <div className="subcard" style={{ marginBottom: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span className="diff-col-title" style={{ marginBottom: 0 }}>
                {t("audit.exampleCurl")}
              </span>
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => copyText(curlSnippet)}
              >
                {t("audit.copy")}
              </button>
            </div>
            <pre className="run-summary mono" style={{ whiteSpace: "pre-wrap" }}>
              {curlSnippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
