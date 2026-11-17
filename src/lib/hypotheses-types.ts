export type HypothesisStatus =
  "active" | "evidence" | "expired" | "pr_open" | "merged" | "kept_with_reason";

export type HypothesisVerdict = "keep" | "reduce" | "remove";

export interface UsedEntry {
  action: string;
  count: number;
  resources: string[];
  last: string | null;
}

export interface DiffLine {
  value: string;
  kept: boolean;
}

export interface HypothesisDiff {
  actions: DiffLine[];
  resources: DiffLine[];
  hasProposal: boolean;
}

export interface Hypothesis {
  id: string;
  sid: string;
  label: string | null;
  file: string;
  roleArn: string;
  roleName: string;
  grantedActions: string[];
  grantedResources: string[];
  createdAt: string;
  expiresAt: string;
  daysLeft: number;
  windowDays: number;
  used: UsedEntry[];
  reducedActions: string[];
  reducedResources: string[];
  diff: HypothesisDiff;
  verdict: HypothesisVerdict | null;
  status: HypothesisStatus;
  reductionPrUrl: string | null;
  keepReason: string | null;
  lastCheckedAt: string | null;
}

export interface HypothesesSummary {
  active: number;
  expiringThisWeek: number;
  openPrs: number;
  removedLast30Days: number;
}

export interface AgentRun {
  id: number;
  ranAt: string;
  summary: string | null;
}

export interface HypothesesData {
  hypotheses: Hypothesis[];
  summary: HypothesesSummary;
}

export function daysLeftTone(days: number): "ok" | "warn" | "bad" {
  if (days < 3) return "bad";
  if (days <= 7) return "warn";
  return "ok";
}
