import type {
  AgentRun,
  Hypothesis,
  HypothesesSummary,
  HypothesisDiff,
  UsedEntry,
} from "./hypotheses-types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function roleNameOf(arn: string): string {
  const parts = arn.split("/");
  return parts[parts.length - 1] || arn;
}

export function daysLeft(expiresAt: string, now = Date.now()): number {
  return Math.floor((new Date(expiresAt).getTime() - now) / DAY_MS);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function parseUsed(value: unknown): UsedEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
      action: typeof r["action"] === "string" ? r["action"] : "—",
      count: typeof r["count"] === "number" ? r["count"] : 0,
      resources: toStringArray(r["resources"]),
      last: typeof r["last"] === "string" ? r["last"] : null,
    };
  });
}

function buildDiff(
  grantedActions: string[],
  grantedResources: string[],
  reducedActions: string[],
  reducedResources: string[],
  hasProposal: boolean,
): HypothesisDiff {
  const actionSet = new Set(reducedActions);
  const resourceSet = new Set(reducedResources);

  const actions = [
    ...grantedActions.map((value) => ({ value, kept: hasProposal ? actionSet.has(value) : true })),
    ...reducedActions
      .filter((value) => !grantedActions.includes(value))
      .map((value) => ({ value, kept: true })),
  ];
  const resources = [
    ...grantedResources.map((value) => ({
      value,
      kept: hasProposal ? resourceSet.has(value) : true,
    })),
    ...reducedResources
      .filter((value) => !grantedResources.includes(value))
      .map((value) => ({ value, kept: true })),
  ];

  return { actions, resources, hasProposal };
}

export function mapHypothesis(row: Record<string, any>, now = Date.now()): Hypothesis {
  const reduced = (row["reduced"] ?? null) as Record<string, unknown> | null;
  const reducedActions = toStringArray(reduced?.["Action"]);
  const reducedResources = toStringArray(reduced?.["Resource"]);
  const grantedActions = toStringArray(row["granted_actions"]);
  const grantedResources = toStringArray(row["granted_resources"]);
  const hasProposal = reduced !== null;

  return {
    id: row["id"],
    sid: row["sid"],
    label: row["label"] ?? null,
    file: row["file"],
    roleArn: row["role_arn"],
    roleName: roleNameOf(row["role_arn"]),
    grantedActions,
    grantedResources,
    createdAt: row["created_at"],
    expiresAt: row["expires_at"],
    daysLeft: daysLeft(row["expires_at"], now),
    windowDays: row["window_days"],
    used: parseUsed(row["used"]),
    reducedActions,
    reducedResources,
    diff: buildDiff(grantedActions, grantedResources, reducedActions, reducedResources, hasProposal),
    verdict: row["verdict"] ?? null,
    status: row["status"],
    reductionPrUrl: row["reduction_pr_url"] ?? null,
    keepReason: row["keep_reason"] ?? null,
    lastCheckedAt: row["last_checked_at"] ?? null,
  };
}

export function summarize(rows: Record<string, any>[], now = Date.now()): HypothesesSummary {
  let active = 0;
  let expiringThisWeek = 0;
  let openPrs = 0;
  let removedLast30Days = 0;

  for (const row of rows) {
    const left = daysLeft(row["expires_at"], now);
    if (row["status"] === "active" || row["status"] === "evidence") active += 1;
    if (left >= 0 && left <= 7 && row["status"] !== "merged") expiringThisWeek += 1;
    if (row["status"] === "pr_open") openPrs += 1;
    const reducedAt = row["reduced_at"] ? new Date(row["reduced_at"]).getTime() : null;
    if (row["status"] === "merged" && reducedAt !== null && now - reducedAt <= 30 * DAY_MS) {
      removedLast30Days += 1;
    }
  }

  return { active, expiringThisWeek, openPrs, removedLast30Days };
}

export function mapAgentRun(row: Record<string, any>): AgentRun {
  const summary = row["summary"];
  return {
    id: row["id"],
    ranAt: row["ran_at"],
    summary: summary == null ? null : JSON.stringify(summary, null, 2),
  };
}
