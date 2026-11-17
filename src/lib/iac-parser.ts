import type { RadiusResource } from "./radius-types";

export interface ParsedIacChange {
  title: string;
  author: string;
  targetResourceId: string;
  newAccessResourceId: string | null;
  scopeBroadened: boolean;
  detectedActions: string[];
  detectedResources: string[];
}

function toStringList(val: unknown): string[] {
  if (typeof val === "string") return [val];
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === "string");
  return [];
}

function hasWildcardActionOrResource(actions: string[], resources: string[]): boolean {
  for (const a of actions) {
    const trimmed = a.trim();
    if (trimmed === "*" || trimmed.endsWith(":*") || trimmed.includes("*")) {
      return true;
    }
  }
  for (const r of resources) {
    const trimmed = r.trim();
    if (trimmed === "*") {
      return true;
    }
  }
  return false;
}

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchResourceByHint(
  hints: string[],
  resources: RadiusResource[],
  excludeId?: string,
  preferTypes?: RadiusResource["type"][],
): RadiusResource | null {
  const candidates = excludeId ? resources.filter((r) => r.id !== excludeId) : resources;
  if (candidates.length === 0) return null;

  // 1. Exact ID, key, or name match
  for (const rawHint of hints) {
    const h = rawHint.trim().toLowerCase();
    if (!h || h === "*") continue;
    const exact = candidates.find(
      (r) => r.id.toLowerCase() === h || r.key.toLowerCase() === h || r.name.toLowerCase() === h,
    );
    if (exact) return exact;
  }

  // 2. Normalized token containment match
  const ordered = preferTypes
    ? [
        ...candidates.filter((c) => preferTypes.includes(c.type)),
        ...candidates.filter((c) => !preferTypes.includes(c.type)),
      ]
    : candidates;

  for (const rawHint of hints) {
    const normHint = normalizeToken(rawHint);
    if (normHint.length < 3) continue;
    for (const r of ordered) {
      const normKey = normalizeToken(r.key);
      const normName = normalizeToken(r.name);
      if (
        (normKey.length >= 4 && normHint.includes(normKey)) ||
        (normName.length >= 4 && normHint.includes(normName)) ||
        (normHint.length >= 5 && (normKey.includes(normHint) || normName.includes(normHint)))
      ) {
        return r;
      }
    }
  }

  return null;
}

function extractStatementsFromPolicyObject(policyObj: Record<string, unknown>): {
  actions: string[];
  resources: string[];
} {
  const actions: string[] = [];
  const resources: string[] = [];
  const rawStatements = policyObj["Statement"] ?? policyObj["statement"];
  const list = Array.isArray(rawStatements)
    ? rawStatements
    : rawStatements && typeof rawStatements === "object"
      ? [rawStatements]
      : [];

  for (const st of list) {
    if (!st || typeof st !== "object" || Array.isArray(st)) continue;
    const rec = st as Record<string, unknown>;
    const effect = typeof rec["Effect"] === "string" ? rec["Effect"].toLowerCase() : "allow";
    if (effect === "deny") continue;
    actions.push(...toStringList(rec["Action"] ?? rec["action"] ?? rec["actions"]));
    resources.push(...toStringList(rec["Resource"] ?? rec["resource"] ?? rec["resources"]));
  }
  return { actions, resources };
}

export function parseIacPayload(rawInput: unknown, resources: RadiusResource[]): ParsedIacChange {
  let obj: Record<string, unknown>;
  if (typeof rawInput === "string") {
    const parsed = JSON.parse(rawInput) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("IaC payload must be a JSON object");
    }
    obj = parsed as Record<string, unknown>;
  } else if (rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)) {
    obj = rawInput as Record<string, unknown>;
  } else {
    throw new Error("IaC payload must be a JSON object or JSON string");
  }

  const detectedActions: string[] = [];
  const detectedResources: string[] = [];
  const targetHints: string[] = [];
  const accessHints: string[] = [];
  let inferredTitle = typeof obj["title"] === "string" ? obj["title"].trim() : "";
  const author =
    typeof obj["author"] === "string" && obj["author"].trim() ? obj["author"].trim() : "ci-bot";

  // Explicit hints
  for (const k of [
    "targetResourceId",
    "targetResourceKey",
    "target",
    "role",
    "roleArn",
    "role_arn",
  ]) {
    if (typeof obj[k] === "string" && obj[k]) targetHints.push(obj[k]);
  }
  for (const k of ["newAccessResourceId", "newAccessResourceKey", "newAccess"]) {
    if (typeof obj[k] === "string" && obj[k]) accessHints.push(obj[k]);
  }

  // Direct IAM Policy statements on root or nested iamPolicy
  const policyCandidate =
    obj["iamPolicy"] && typeof obj["iamPolicy"] === "object" && !Array.isArray(obj["iamPolicy"])
      ? (obj["iamPolicy"] as Record<string, unknown>)
      : obj;

  const rootExtracted = extractStatementsFromPolicyObject(policyCandidate);
  detectedActions.push(...rootExtracted.actions);
  detectedResources.push(...rootExtracted.resources);

  // Terraform plan JSON: resource_changes[]
  const tfRoot =
    obj["terraformPlan"] &&
    typeof obj["terraformPlan"] === "object" &&
    !Array.isArray(obj["terraformPlan"])
      ? (obj["terraformPlan"] as Record<string, unknown>)
      : obj;

  if (Array.isArray(tfRoot["resource_changes"])) {
    const changes = tfRoot["resource_changes"];
    for (const rc of changes) {
      if (!rc || typeof rc !== "object" || Array.isArray(rc)) continue;
      const rcObj = rc as Record<string, unknown>;
      const address = typeof rcObj["address"] === "string" ? rcObj["address"] : "";
      const name = typeof rcObj["name"] === "string" ? rcObj["name"] : "";
      if (!inferredTitle && address) inferredTitle = `tf: ${address}`;
      if (name) targetHints.push(name);
      if (address) targetHints.push(address);

      const change =
        rcObj["change"] && typeof rcObj["change"] === "object" && !Array.isArray(rcObj["change"])
          ? (rcObj["change"] as Record<string, unknown>)
          : null;
      const after =
        change?.["after"] && typeof change["after"] === "object" && !Array.isArray(change["after"])
          ? (change["after"] as Record<string, unknown>)
          : null;

      if (after) {
        for (const field of ["role", "name", "role_arn", "service"]) {
          if (typeof after[field] === "string") targetHints.push(after[field]);
        }
        for (const field of ["bucket", "database", "resource_arn", "target_arn"]) {
          if (typeof after[field] === "string") accessHints.push(after[field]);
        }
        detectedActions.push(...toStringList(after["actions"]));
        detectedResources.push(...toStringList(after["resources"]));

        const rawPolicy = after["policy"];
        if (typeof rawPolicy === "string") {
          try {
            const parsedPol = JSON.parse(rawPolicy) as unknown;
            if (parsedPol && typeof parsedPol === "object" && !Array.isArray(parsedPol)) {
              const ext = extractStatementsFromPolicyObject(parsedPol as Record<string, unknown>);
              detectedActions.push(...ext.actions);
              detectedResources.push(...ext.resources);
            }
          } catch {
            // Ignore non-JSON policy string
          }
        } else if (rawPolicy && typeof rawPolicy === "object" && !Array.isArray(rawPolicy)) {
          const ext = extractStatementsFromPolicyObject(rawPolicy as Record<string, unknown>);
          detectedActions.push(...ext.actions);
          detectedResources.push(...ext.resources);
        }
      }
    }
  }

  accessHints.push(...detectedResources);

  const matchedTarget =
    matchResourceByHint(targetHints, resources, undefined, ["role", "service"]) ??
    resources.find((r) => r.type === "role") ??
    resources[0];

  if (!matchedTarget) {
    throw new Error("Organization has no resources to match against");
  }

  const matchedAccess = matchResourceByHint(accessHints, resources, matchedTarget.id, [
    "database",
    "storage",
    "external",
  ]);

  const explicitScope =
    typeof obj["scopeBroadened"] === "boolean" ? obj["scopeBroadened"] : undefined;
  const scopeBroadened =
    explicitScope ?? hasWildcardActionOrResource(detectedActions, detectedResources);

  if (!inferredTitle) {
    inferredTitle = matchedAccess
      ? `grant-${matchedTarget.key}-access-to-${matchedAccess.key}`
      : `update-${matchedTarget.key}-policy`;
  }

  return {
    title: inferredTitle.slice(0, 160),
    author,
    targetResourceId: matchedTarget.id,
    newAccessResourceId: matchedAccess?.id ?? null,
    scopeBroadened,
    detectedActions,
    detectedResources,
  };
}
