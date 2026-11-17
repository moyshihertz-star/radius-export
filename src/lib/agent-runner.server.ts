import { daysLeft, type HypothesisRowLike } from "./hypotheses-engine.server.ts";
import type { HypothesisStatus, HypothesisVerdict } from "./hypotheses-types";

export interface EvaluatedHypothesisUpdate {
  id: string;
  verdict: HypothesisVerdict;
  status: HypothesisStatus;
  reduced: {
    Action: string[];
    Resource: string[];
  };
  last_checked_at: string;
}

function toStrings(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === "string");
}

export function evaluateHypothesisUsage(
  row: HypothesisRowLike,
  now = Date.now(),
): EvaluatedHypothesisUpdate | null {
  if (row.status === "merged" || row.status === "kept_with_reason") {
    return null;
  }

  const grantedActions = toStrings(row.granted_actions);
  const grantedResources = toStrings(row.granted_resources);
  const rawUsed = Array.isArray(row.used) ? row.used : [];

  const observedActionSet = new Set<string>();
  const observedResourceSet = new Set<string>();

  for (const entry of rawUsed) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const rec = entry as Record<string, unknown>;
    const action = typeof rec["action"] === "string" ? rec["action"].trim() : "";
    const count = typeof rec["count"] === "number" ? rec["count"] : 0;
    if (!action || count <= 0) continue;
    observedActionSet.add(action);
    for (const r of toStrings(rec["resources"])) {
      if (r.trim()) observedResourceSet.add(r.trim());
    }
  }

  const observedActions = Array.from(observedActionSet);
  const observedResources =
    observedResourceSet.size > 0 ? Array.from(observedResourceSet) : grantedResources;

  const left = daysLeft(row.expires_at, now);
  const nowIso = new Date(now).toISOString();

  if (observedActions.length === 0) {
    return {
      id: row.id,
      verdict: "remove",
      status: left < 0 ? "expired" : "pr_open",
      reduced: {
        Action: [],
        Resource: [],
      },
      last_checked_at: nowIso,
    };
  }

  const hadWildcardAction = grantedActions.some((a) => a.includes("*"));
  const hadWildcardResource = grantedResources.some((r) => r.trim() === "*");
  const actionCountReduced = observedActions.length < grantedActions.length;
  const resourceCountReduced = observedResources.length < grantedResources.length;

  if (hadWildcardAction || hadWildcardResource || actionCountReduced || resourceCountReduced) {
    return {
      id: row.id,
      verdict: "reduce",
      status: "pr_open",
      reduced: {
        Action: observedActions,
        Resource: observedResources,
      },
      last_checked_at: nowIso,
    };
  }

  return {
    id: row.id,
    verdict: "keep",
    status: "active",
    reduced: {
      Action: grantedActions,
      Resource: grantedResources,
    },
    last_checked_at: nowIso,
  };
}
