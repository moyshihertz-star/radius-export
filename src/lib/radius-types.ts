export type ResourceType = "service" | "role" | "database" | "storage" | "external";
export type Sensitivity = "high" | "medium" | "low";
export type ChangeStatus = "pending" | "approved" | "blocked";
export type Verdict = "high" | "medium" | "low";

export interface RadiusResource {
  id: string;
  key: string;
  name: string;
  type: ResourceType;
  sensitivity: Sensitivity;
  tags: string[];
  x: number;
  y: number;
}

export interface RadiusEdge {
  from: string;
  to: string;
}

export interface PolicyWeights {
  threshold: number;
  sensHigh: number;
  sensMedium: number;
  sensLow: number;
  scopeBonus: number;
  complianceBonus: number;
}

export interface BreakdownItem {
  label: string;
  points: number;
  key?: string;
  params?: Record<string, string | number>;
}

export interface ConsumerHit {
  id: string;
  hop: number;
}

export interface SimulationResult {
  targetId: string;
  newResourceId: string | null;
  consumers: ConsumerHit[];
  score: number;
  verdict: Verdict;
  breakdown: BreakdownItem[];
}

export interface RadiusChange {
  id: string;
  title: string;
  author: string;
  targetResourceId: string;
  newAccessResourceId: string | null;
  scopeBroadened: boolean;
  status: ChangeStatus;
  source: string;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  simulation: SimulationResult;
}

export interface ConsoleData {
  orgName: string;
  resources: RadiusResource[];
  edges: RadiusEdge[];
  weights: PolicyWeights;
  changes: RadiusChange[];
}

export interface AuditEntry {
  id: string;
  action: string;
  actorName: string | null;
  changeId: string | null;
  details: string;
  createdAt: string;
}

export interface AuditAndCiData {
  orgName: string;
  ingestKey: string;
  entries: AuditEntry[];
}

export const TYPE_COLOR: Record<ResourceType, string> = {
  role: "#FF7A45",
  service: "#4C86FF",
  database: "#B26BFF",
  storage: "#B26BFF",
  external: "#5B6672",
};
