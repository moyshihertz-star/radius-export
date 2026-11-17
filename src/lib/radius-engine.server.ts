import type {
  BreakdownItem,
  ConsumerHit,
  PolicyWeights,
  RadiusEdge,
  RadiusResource,
  SimulationResult,
  Verdict,
} from "./radius-types";

/**
 * Ported 1:1 from the Radius prototype engine (bfsConsumers + simulate).
 * Runs on the server only, so scores cannot be manipulated from the browser.
 */
export function bfsConsumers(
  targetId: string,
  edges: RadiusEdge[],
  maxHops: number,
): ConsumerHit[] {
  const visited = new Set<string>([targetId]);
  let frontier: string[] = [targetId];
  const found: ConsumerHit[] = [];

  for (let hop = 1; hop <= maxHops; hop++) {
    const next: string[] = [];
    edges.forEach(({ from, to }) => {
      if (frontier.includes(to) && !visited.has(from)) {
        visited.add(from);
        next.push(from);
        found.push({ id: from, hop });
      }
    });
    if (next.length === 0) break;
    frontier = next;
  }
  return found;
}

export interface SimulateInput {
  targetId: string;
  newAccessId: string | null;
  scopeBroadened: boolean;
}

const HOP_WEIGHT: Record<number, number> = { 1: 1, 2: 0.6, 3: 0.35 };

export function simulate(
  change: SimulateInput,
  resources: RadiusResource[],
  edges: RadiusEdge[],
  weights: PolicyWeights,
): SimulationResult {
  const byId = new Map(resources.map((r) => [r.id, r]));
  const effectiveEdges = edges.slice();
  if (change.newAccessId) {
    effectiveEdges.push({ from: change.targetId, to: change.newAccessId });
  }

  const consumers = bfsConsumers(change.targetId, effectiveEdges, 3);
  const targetNode = byId.get(change.targetId);
  const newResourceNode = change.newAccessId ? (byId.get(change.newAccessId) ?? null) : null;

  const breakdown: BreakdownItem[] = [];
  let score = 15;
  breakdown.push({
    label: "Baseline change in the production environment",
    points: 15,
    key: "bd.base",
  });

  if (targetNode?.sensitivity === "high") {
    score += 8;
    breakdown.push({
      label: "Target resource is classified as high sensitivity",
      points: 8,
      key: "bd.targetHigh",
    });
  }

  let consumerPts = 0;
  consumers.forEach((c) => {
    const n = byId.get(c.id);
    if (!n) return;
    const w =
      n.sensitivity === "high"
        ? weights.sensHigh
        : n.sensitivity === "medium"
          ? weights.sensMedium
          : weights.sensLow;
    consumerPts += w * (HOP_WEIGHT[c.hop] ?? 0);
  });
  if (consumerPts > 0) {
    consumerPts = Math.round(consumerPts);
    score += consumerPts;
    breakdown.push({
      label: `${consumers.length} services depend on the changed resource`,
      points: consumerPts,
      key: "bd.dependents",
      params: { count: consumers.length },
    });
  }

  if (change.scopeBroadened) {
    score += weights.scopeBonus;
    breakdown.push({
      label: "Permission scope broadened to a wildcard",
      points: weights.scopeBonus,
      key: "bd.wildcard",
    });
  }

  if (
    newResourceNode &&
    (newResourceNode.tags.includes("pii") || newResourceNode.tags.includes("compliance"))
  ) {
    score += weights.complianceBonus;
    breakdown.push({
      label: `New access to a sensitive resource (${newResourceNode.name})`,
      points: weights.complianceBonus,
      key: "bd.sensitiveAccess",
      params: { name: newResourceNode.name },
    });
  }


  score = Math.min(100, Math.round(score));
  const verdict: Verdict =
    score >= weights.threshold
      ? "high"
      : score >= Math.round(weights.threshold * 0.55)
        ? "medium"
        : "low";

  return {
    targetId: change.targetId,
    newResourceId: change.newAccessId,
    consumers,
    score,
    verdict,
    breakdown,
  };
}

export function normalizeWeights(row: {
  threshold: number;
  sens_high_weight: number;
  sens_medium_weight: number;
  sens_low_weight: number;
  scope_bonus: number;
  compliance_bonus: number;
}): PolicyWeights {
  return {
    threshold: row.threshold,
    sensHigh: row.sens_high_weight,
    sensMedium: row.sens_medium_weight,
    sensLow: row.sens_low_weight,
    scopeBonus: row.scope_bonus,
    complianceBonus: row.compliance_bonus,
  };
}

export function clampWeights(w: PolicyWeights): PolicyWeights {
  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Math.round(Number.isFinite(v) ? v : min)));
  return {
    threshold: clamp(w.threshold, 30, 95),
    sensHigh: clamp(w.sensHigh, 4, 30),
    sensMedium: clamp(w.sensMedium, 1, 30),
    sensLow: clamp(w.sensLow, 0, 30),
    scopeBonus: clamp(w.scopeBonus, 0, 40),
    complianceBonus: clamp(w.complianceBonus, 0, 40),
  };
}
