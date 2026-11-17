import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Tables } from "@/integrations/supabase/types";
import type { PolicyWeights } from "./radius-types";

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env["SUPABASE_URL"] && process.env["SUPABASE_PUBLISHABLE_KEY"]);
}

const LOCAL_DB_PATH = resolve(process.cwd(), ".radius-local-db.json");

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";

const RES_IDS: Record<string, string> = {
  "iam-role-payments": "10000000-0000-4000-8000-000000000001",
  "payments-service": "10000000-0000-4000-8000-000000000002",
  "auth-service": "10000000-0000-4000-8000-000000000003",
  "admin-console": "10000000-0000-4000-8000-000000000004",
  "audit-log": "10000000-0000-4000-8000-000000000005",
  "s3-payments-bucket": "10000000-0000-4000-8000-000000000006",
  "customer-db": "10000000-0000-4000-8000-000000000007",
  "billing-api": "10000000-0000-4000-8000-000000000008",
  "notify-svc": "10000000-0000-4000-8000-000000000009",
  "cache-layer": "10000000-0000-4000-8000-000000000010",
  "third-party-webhook": "10000000-0000-4000-8000-000000000011",
  "search-idx": "10000000-0000-4000-8000-000000000012",
  "reporting-service": "10000000-0000-4000-8000-000000000013",
  "s3-reports-bucket": "10000000-0000-4000-8000-000000000014",
};

interface LocalStoreState {
  org: {
    id: string;
    name: string;
    ingest_key: string;
  };
  userId: string;
  displayName: string;
  weights: PolicyWeights;
  resources: Tables<"resources">[];
  edges: Tables<"edges">[];
  changes: Tables<"changes">[];
  hypotheses: Tables<"hypotheses">[];
  agentRuns: Tables<"agent_runs">[];
  auditLog: Tables<"audit_log">[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function createInitialStore(): LocalStoreState {
  const now = Date.now();
  const iso = (offsetMs = 0) => new Date(now + offsetMs).toISOString();

  const resources: Tables<"resources">[] = [
    {
      id: RES_IDS["iam-role-payments"]!,
      org_id: ORG_ID,
      key: "iam-role-payments",
      name: "iam-role:payments-role",
      type: "role",
      sensitivity: "high",
      tags: ["prod"],
      x: 450,
      y: 230,
      created_at: iso(),
    },
    {
      id: RES_IDS["payments-service"]!,
      org_id: ORG_ID,
      key: "payments-service",
      name: "payments-service",
      type: "service",
      sensitivity: "high",
      tags: ["prod"],
      x: 290,
      y: 150,
      created_at: iso(),
    },
    {
      id: RES_IDS["auth-service"]!,
      org_id: ORG_ID,
      key: "auth-service",
      name: "auth-service",
      type: "service",
      sensitivity: "high",
      tags: ["prod"],
      x: 290,
      y: 320,
      created_at: iso(),
    },
    {
      id: RES_IDS["admin-console"]!,
      org_id: ORG_ID,
      key: "admin-console",
      name: "admin-console",
      type: "service",
      sensitivity: "high",
      tags: ["prod", "sensitive-access"],
      x: 610,
      y: 150,
      created_at: iso(),
    },
    {
      id: RES_IDS["audit-log"]!,
      org_id: ORG_ID,
      key: "audit-log",
      name: "audit-log",
      type: "service",
      sensitivity: "medium",
      tags: ["compliance"],
      x: 610,
      y: 320,
      created_at: iso(),
    },
    {
      id: RES_IDS["s3-payments-bucket"]!,
      org_id: ORG_ID,
      key: "s3-payments-bucket",
      name: "s3://payments-bucket",
      type: "storage",
      sensitivity: "high",
      tags: ["prod", "pii"],
      x: 450,
      y: 70,
      created_at: iso(),
    },
    {
      id: RES_IDS["customer-db"]!,
      org_id: ORG_ID,
      key: "customer-db",
      name: "customer-db",
      type: "database",
      sensitivity: "high",
      tags: ["prod", "pii", "compliance"],
      x: 450,
      y: 400,
      created_at: iso(),
    },
    {
      id: RES_IDS["billing-api"]!,
      org_id: ORG_ID,
      key: "billing-api",
      name: "billing-api",
      type: "service",
      sensitivity: "high",
      tags: ["prod"],
      x: 130,
      y: 70,
      created_at: iso(),
    },
    {
      id: RES_IDS["notify-svc"]!,
      org_id: ORG_ID,
      key: "notify-svc",
      name: "notify-svc",
      type: "service",
      sensitivity: "low",
      tags: ["prod"],
      x: 130,
      y: 230,
      created_at: iso(),
    },
    {
      id: RES_IDS["cache-layer"]!,
      org_id: ORG_ID,
      key: "cache-layer",
      name: "cache-layer",
      type: "service",
      sensitivity: "low",
      tags: ["prod"],
      x: 20,
      y: 20,
      created_at: iso(),
    },
    {
      id: RES_IDS["third-party-webhook"]!,
      org_id: ORG_ID,
      key: "third-party-webhook",
      name: "webhook.partner.io",
      type: "external",
      sensitivity: "medium",
      tags: ["external"],
      x: 20,
      y: 280,
      created_at: iso(),
    },
    {
      id: RES_IDS["search-idx"]!,
      org_id: ORG_ID,
      key: "search-idx",
      name: "search-idx",
      type: "service",
      sensitivity: "low",
      tags: ["prod"],
      x: 790,
      y: 70,
      created_at: iso(),
    },
    {
      id: RES_IDS["reporting-service"]!,
      org_id: ORG_ID,
      key: "reporting-service",
      name: "reporting-service",
      type: "service",
      sensitivity: "medium",
      tags: ["prod"],
      x: 790,
      y: 230,
      created_at: iso(),
    },
    {
      id: RES_IDS["s3-reports-bucket"]!,
      org_id: ORG_ID,
      key: "s3-reports-bucket",
      name: "s3://reports-bucket",
      type: "storage",
      sensitivity: "medium",
      tags: ["prod"],
      x: 790,
      y: 400,
      created_at: iso(),
    },
  ];

  const edgePairs: [string, string][] = [
    ["payments-service", "iam-role-payments"],
    ["auth-service", "iam-role-payments"],
    ["admin-console", "iam-role-payments"],
    ["audit-log", "iam-role-payments"],
    ["iam-role-payments", "s3-payments-bucket"],
    ["billing-api", "payments-service"],
    ["notify-svc", "payments-service"],
    ["cache-layer", "billing-api"],
    ["third-party-webhook", "notify-svc"],
    ["search-idx", "customer-db"],
    ["reporting-service", "s3-payments-bucket"],
    ["reporting-service", "s3-reports-bucket"],
  ];

  const edges: Tables<"edges">[] = edgePairs.map(([f, t], idx) => ({
    id: `20000000-0000-4000-8000-${String(idx + 1).padStart(12, "0")}`,
    org_id: ORG_ID,
    from_resource_id: RES_IDS[f]!,
    to_resource_id: RES_IDS[t]!,
    created_at: iso(),
  }));

  const changes: Tables<"changes">[] = [
    {
      id: "30000000-0000-4000-8000-000000000001",
      org_id: ORG_ID,
      title: "update-payments-iam-role",
      author: "d.cohen",
      target_resource_id: RES_IDS["iam-role-payments"]!,
      new_access_resource_id: RES_IDS["customer-db"]!,
      scope_broadened: true,
      status: "pending",
      score: null,
      verdict: null,
      breakdown: [],
      source: "manual",
      decided_by: null,
      decided_at: null,
      created_at: iso(-1 * HOUR_MS),
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      org_id: ORG_ID,
      title: "add-cache-ttl-config",
      author: "r.levi",
      target_resource_id: RES_IDS["cache-layer"]!,
      new_access_resource_id: null,
      scope_broadened: false,
      status: "pending",
      score: null,
      verdict: null,
      breakdown: [],
      source: "manual",
      decided_by: null,
      decided_at: null,
      created_at: iso(-2 * HOUR_MS),
    },
    {
      id: "30000000-0000-4000-8000-000000000003",
      org_id: ORG_ID,
      title: "broaden-admin-console-access",
      author: "n.katz",
      target_resource_id: RES_IDS["admin-console"]!,
      new_access_resource_id: RES_IDS["customer-db"]!,
      scope_broadened: true,
      status: "pending",
      score: null,
      verdict: null,
      breakdown: [],
      source: "manual",
      decided_by: null,
      decided_at: null,
      created_at: iso(-3 * HOUR_MS),
    },
    {
      id: "30000000-0000-4000-8000-000000000004",
      org_id: ORG_ID,
      title: "rotate-webhook-secret",
      author: "a.mizrahi",
      target_resource_id: RES_IDS["third-party-webhook"]!,
      new_access_resource_id: null,
      scope_broadened: false,
      status: "pending",
      score: null,
      verdict: null,
      breakdown: [],
      source: "manual",
      decided_by: null,
      decided_at: null,
      created_at: iso(-4 * HOUR_MS),
    },
  ];

  const hypotheses: Tables<"hypotheses">[] = [
    {
      id: `${ORG_ID}#reports`,
      org_id: ORG_ID,
      sid: "RadiusHypothesis_14d_reports",
      label: "reports",
      file: "policies/payments-role.json",
      role_arn: "arn:aws:iam::123456789012:role/payments-role",
      granted_actions: ["s3:*"],
      granted_resources: ["arn:aws:s3:::payments-bucket/*"],
      created_at: iso(-15 * DAY_MS),
      expires_at: iso(-1 * DAY_MS),
      window_days: 14,
      used: [
        {
          action: "s3:GetObject",
          count: 4012,
          resources: ["arn:aws:s3:::payments-bucket/invoices/*"],
          last: iso(-1 * DAY_MS),
        },
        {
          action: "s3:ListBucket",
          count: 37,
          resources: ["arn:aws:s3:::payments-bucket"],
          last: iso(-2 * DAY_MS),
        },
      ],
      reduced: {
        Action: ["s3:GetObject", "s3:ListBucket"],
        Resource: ["arn:aws:s3:::payments-bucket/invoices/*", "arn:aws:s3:::payments-bucket"],
      },
      verdict: "reduce",
      status: "pr_open",
      reduction_pr_url: "https://github.com/acme/infra/pull/482",
      keep_reason: null,
      last_checked_at: iso(-3 * HOUR_MS),
      reduced_at: null,
    },
    {
      id: `${ORG_ID}#billing-export`,
      org_id: ORG_ID,
      sid: "RadiusHypothesis_14d_billing-export",
      label: "billing-export",
      file: "policies/billing-role.json",
      role_arn: "arn:aws:iam::123456789012:role/billing-role",
      granted_actions: ["dynamodb:*", "sqs:SendMessage"],
      granted_resources: [
        "arn:aws:dynamodb:eu-west-1:123456789012:table/invoices",
        "arn:aws:sqs:eu-west-1:123456789012:billing-queue",
      ],
      created_at: iso(-12 * DAY_MS),
      expires_at: iso(2 * DAY_MS),
      window_days: 14,
      used: [
        {
          action: "dynamodb:Query",
          count: 880,
          resources: ["arn:aws:dynamodb:eu-west-1:123456789012:table/invoices"],
          last: iso(-4 * HOUR_MS),
        },
        {
          action: "sqs:SendMessage",
          count: 210,
          resources: ["arn:aws:sqs:eu-west-1:123456789012:billing-queue"],
          last: iso(-5 * HOUR_MS),
        },
      ],
      reduced: {
        Action: ["dynamodb:Query", "sqs:SendMessage"],
        Resource: [
          "arn:aws:dynamodb:eu-west-1:123456789012:table/invoices",
          "arn:aws:sqs:eu-west-1:123456789012:billing-queue",
        ],
      },
      verdict: "reduce",
      status: "evidence",
      reduction_pr_url: null,
      keep_reason: null,
      last_checked_at: iso(-2 * HOUR_MS),
      reduced_at: null,
    },
    {
      id: `${ORG_ID}#incident-debug`,
      org_id: ORG_ID,
      sid: "RadiusHypothesis_7d_incident-debug",
      label: "incident-debug",
      file: "policies/oncall-role.json",
      role_arn: "arn:aws:iam::123456789012:role/oncall-role",
      granted_actions: ["logs:*", "ec2:Describe*"],
      granted_resources: ["*"],
      created_at: iso(-2 * DAY_MS),
      expires_at: iso(5 * DAY_MS),
      window_days: 7,
      used: [
        {
          action: "logs:FilterLogEvents",
          count: 64,
          resources: ["arn:aws:logs:eu-west-1:123456789012:log-group:/aws/lambda/payments"],
          last: iso(-2 * HOUR_MS),
        },
      ],
      reduced: null,
      verdict: null,
      status: "active",
      reduction_pr_url: null,
      keep_reason: null,
      last_checked_at: iso(-1 * HOUR_MS),
      reduced_at: null,
    },
    {
      id: `${ORG_ID}#analytics-read`,
      org_id: ORG_ID,
      sid: "RadiusHypothesis_30d_analytics-read",
      label: "analytics-read",
      file: "policies/analytics-role.json",
      role_arn: "arn:aws:iam::123456789012:role/analytics-role",
      granted_actions: ["athena:*", "glue:GetTable", "s3:GetObject"],
      granted_resources: ["arn:aws:s3:::reports-bucket/*"],
      created_at: iso(-9 * DAY_MS),
      expires_at: iso(21 * DAY_MS),
      window_days: 30,
      used: [
        {
          action: "athena:StartQueryExecution",
          count: 140,
          resources: ["*"],
          last: iso(-6 * HOUR_MS),
        },
        {
          action: "s3:GetObject",
          count: 1520,
          resources: ["arn:aws:s3:::reports-bucket/daily/*"],
          last: iso(-5 * HOUR_MS),
        },
      ],
      reduced: null,
      verdict: null,
      status: "active",
      reduction_pr_url: null,
      keep_reason: null,
      last_checked_at: iso(-5 * HOUR_MS),
      reduced_at: null,
    },
    {
      id: `${ORG_ID}#legacy-admin`,
      org_id: ORG_ID,
      sid: "RadiusHypothesis_14d_legacy-admin",
      label: "legacy-admin",
      file: "policies/legacy-role.json",
      role_arn: "arn:aws:iam::123456789012:role/legacy-migration-role",
      granted_actions: ["iam:*", "s3:*"],
      granted_resources: ["*"],
      created_at: iso(-20 * DAY_MS),
      expires_at: iso(-6 * DAY_MS),
      window_days: 14,
      used: [],
      reduced: { Action: [], Resource: [] },
      verdict: "remove",
      status: "expired",
      reduction_pr_url: null,
      keep_reason: null,
      last_checked_at: iso(-6 * HOUR_MS),
      reduced_at: null,
    },
    {
      id: `${ORG_ID}#search-index`,
      org_id: ORG_ID,
      sid: "RadiusVerified_search-index",
      label: "search-index",
      file: "policies/search-role.json",
      role_arn: "arn:aws:iam::123456789012:role/search-role",
      granted_actions: ["s3:*", "sqs:*"],
      granted_resources: ["arn:aws:s3:::search-bucket/*", "*"],
      created_at: iso(-40 * DAY_MS),
      expires_at: iso(-11 * DAY_MS),
      window_days: 30,
      used: [
        {
          action: "s3:GetObject",
          count: 9800,
          resources: ["arn:aws:s3:::search-bucket/index/*"],
          last: iso(-12 * DAY_MS),
        },
      ],
      reduced: {
        Action: ["s3:GetObject"],
        Resource: ["arn:aws:s3:::search-bucket/index/*"],
      },
      verdict: "reduce",
      status: "merged",
      reduction_pr_url: "https://github.com/acme/infra/pull/451",
      keep_reason: null,
      last_checked_at: iso(-11 * DAY_MS),
      reduced_at: iso(-10 * DAY_MS),
    },
  ];

  const agentRuns: Tables<"agent_runs">[] = [
    {
      id: 3,
      org_id: ORG_ID,
      ran_at: iso(-3 * HOUR_MS),
      summary: {
        scanned_policies: 7,
        hypotheses: 6,
        expired: 2,
        prs_opened: 1,
        cloudtrail_events: 18422,
        window: "24h",
      },
    },
    {
      id: 2,
      org_id: ORG_ID,
      ran_at: iso(-27 * HOUR_MS),
      summary: {
        scanned_policies: 7,
        hypotheses: 6,
        expired: 1,
        prs_opened: 0,
        cloudtrail_events: 17110,
        window: "24h",
      },
    },
    {
      id: 1,
      org_id: ORG_ID,
      ran_at: iso(-51 * HOUR_MS),
      summary: {
        scanned_policies: 6,
        hypotheses: 5,
        expired: 1,
        prs_opened: 1,
        cloudtrail_events: 16044,
        window: "24h",
      },
    },
  ];

  const auditLog: Tables<"audit_log">[] = [
    {
      id: "40000000-0000-4000-8000-000000000001",
      org_id: ORG_ID,
      change_id: "30000000-0000-4000-8000-000000000001",
      action: "seeded_environment",
      actor_id: USER_ID,
      actor_name: "system",
      details: { resources: 14, edges: 12, changes: 4, hypotheses: 6 },
      created_at: iso(-4 * HOUR_MS),
    },
  ];

  return {
    org: {
      id: ORG_ID,
      name: "acme-cloud-org",
      ingest_key: "radius_demo_ingest_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
    },
    userId: USER_ID,
    displayName: "sec-reviewer",
    weights: {
      threshold: 70,
      sensHigh: 14,
      sensMedium: 7,
      sensLow: 3,
      scopeBonus: 22,
      complianceBonus: 20,
    },
    resources,
    edges,
    changes,
    hypotheses,
    agentRuns,
    auditLog,
  };
}

const g = globalThis as unknown as { __radiusLocalStore?: LocalStoreState };

export function saveLocalStore(): void {
  if (!g.__radiusLocalStore) return;
  try {
    writeFileSync(LOCAL_DB_PATH, JSON.stringify(g.__radiusLocalStore, null, 2), "utf-8");
  } catch {
    // Ignore write errors in read-only / serverless environments
  }
}

export function getLocalStore(): LocalStoreState {
  if (!g.__radiusLocalStore) {
    try {
      if (existsSync(LOCAL_DB_PATH)) {
        const raw = readFileSync(LOCAL_DB_PATH, "utf-8");
        const parsed = JSON.parse(raw) as LocalStoreState;
        if (parsed && parsed.org && Array.isArray(parsed.resources)) {
          g.__radiusLocalStore = parsed;
          return g.__radiusLocalStore;
        }
      }
    } catch {
      // Fall back to fresh initial store if file is missing or corrupt
    }
    g.__radiusLocalStore = createInitialStore();
    saveLocalStore();
  }
  return g.__radiusLocalStore;
}
