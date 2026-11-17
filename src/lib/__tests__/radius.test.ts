import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bfsConsumers,
  clampWeights,
  normalizeWeights,
  resolveChangeSimulation,
  simulate,
} from "../radius-engine.server.ts";
import type { PolicyWeights, RadiusEdge, RadiusResource } from "../radius-types.ts";
import {
  daysLeft,
  mapAgentRun,
  mapHypothesis,
  roleNameOf,
  summarize,
} from "../hypotheses-engine.server.ts";
import { daysLeftTone } from "../hypotheses-types.ts";
import { parseIacPayload } from "../iac-parser.ts";
import { evaluateHypothesisUsage } from "../agent-runner.server.ts";
import { computeAutoLayout } from "../graph-layout.ts";

const DEFAULT_WEIGHTS: PolicyWeights = {
  threshold: 70,
  sensHigh: 14,
  sensMedium: 7,
  sensLow: 3,
  scopeBonus: 22,
  complianceBonus: 20,
};

const DEMO_RESOURCES: RadiusResource[] = [
  {
    id: "iam-role-payments",
    key: "iam-role-payments",
    name: "iam-role:payments-role",
    type: "role",
    sensitivity: "high",
    tags: ["prod"],
    x: 450,
    y: 230,
  },
  {
    id: "payments-service",
    key: "payments-service",
    name: "payments-service",
    type: "service",
    sensitivity: "high",
    tags: ["prod"],
    x: 290,
    y: 150,
  },
  {
    id: "auth-service",
    key: "auth-service",
    name: "auth-service",
    type: "service",
    sensitivity: "high",
    tags: ["prod"],
    x: 290,
    y: 320,
  },
  {
    id: "admin-console",
    key: "admin-console",
    name: "admin-console",
    type: "service",
    sensitivity: "high",
    tags: ["prod", "sensitive-access"],
    x: 610,
    y: 150,
  },
  {
    id: "audit-log",
    key: "audit-log",
    name: "audit-log",
    type: "service",
    sensitivity: "medium",
    tags: ["compliance"],
    x: 610,
    y: 320,
  },
  {
    id: "s3-payments-bucket",
    key: "s3-payments-bucket",
    name: "s3://payments-bucket",
    type: "storage",
    sensitivity: "high",
    tags: ["prod", "pii"],
    x: 450,
    y: 70,
  },
  {
    id: "customer-db",
    key: "customer-db",
    name: "customer-db",
    type: "database",
    sensitivity: "high",
    tags: ["prod", "pii", "compliance"],
    x: 450,
    y: 400,
  },
  {
    id: "billing-api",
    key: "billing-api",
    name: "billing-api",
    type: "service",
    sensitivity: "high",
    tags: ["prod"],
    x: 130,
    y: 70,
  },
  {
    id: "notify-svc",
    key: "notify-svc",
    name: "notify-svc",
    type: "service",
    sensitivity: "low",
    tags: ["prod"],
    x: 130,
    y: 230,
  },
  {
    id: "cache-layer",
    key: "cache-layer",
    name: "cache-layer",
    type: "service",
    sensitivity: "low",
    tags: ["prod"],
    x: 20,
    y: 20,
  },
  {
    id: "third-party-webhook",
    key: "third-party-webhook",
    name: "webhook.partner.io",
    type: "external",
    sensitivity: "medium",
    tags: ["external"],
    x: 20,
    y: 280,
  },
];

const DEMO_EDGES: RadiusEdge[] = [
  { from: "payments-service", to: "iam-role-payments" },
  { from: "auth-service", to: "iam-role-payments" },
  { from: "admin-console", to: "iam-role-payments" },
  { from: "audit-log", to: "iam-role-payments" },
  { from: "iam-role-payments", to: "s3-payments-bucket" },
  { from: "billing-api", to: "payments-service" },
  { from: "notify-svc", to: "payments-service" },
  { from: "cache-layer", to: "billing-api" },
  { from: "third-party-webhook", to: "notify-svc" },
];

describe("radius-engine: bfsConsumers", () => {
  it("finds 1-hop, 2-hop, and 3-hop upstream consumers in reverse edge direction", () => {
    const hits = bfsConsumers("iam-role-payments", DEMO_EDGES, 3);
    const byHop = new Map(hits.map((h) => [h.id, h.hop]));

    assert.equal(hits.length, 8);
    // Hop 1
    assert.equal(byHop.get("payments-service"), 1);
    assert.equal(byHop.get("auth-service"), 1);
    assert.equal(byHop.get("admin-console"), 1);
    assert.equal(byHop.get("audit-log"), 1);
    // Hop 2
    assert.equal(byHop.get("billing-api"), 2);
    assert.equal(byHop.get("notify-svc"), 2);
    // Hop 3
    assert.equal(byHop.get("cache-layer"), 3);
    assert.equal(byHop.get("third-party-webhook"), 3);
    // Downstream target (s3-payments-bucket) is NOT a consumer
    assert.equal(byHop.has("s3-payments-bucket"), false);
  });

  it("stops at maxHops and handles cycles safely without duplicates", () => {
    const cyclicEdges: RadiusEdge[] = [
      { from: "n1", to: "target" },
      { from: "n2", to: "n1" },
      { from: "n3", to: "n2" },
      { from: "n4", to: "n3" }, // 4th hop - should be ignored when maxHops = 3
      { from: "target", to: "n2" }, // cycle back to target
      { from: "n1", to: "n3" }, // cycle between consumers
    ];
    const hits = bfsConsumers("target", cyclicEdges, 3);
    assert.deepEqual(hits, [
      { id: "n1", hop: 1 },
      { id: "n2", hop: 2 },
      { id: "n3", hop: 3 },
    ]);
  });

  it("records shortest hop distance in diamond dependency graphs", () => {
    const diamondEdges: RadiusEdge[] = [
      { from: "direct-and-indirect", to: "target" },
      { from: "mid", to: "target" },
      { from: "direct-and-indirect", to: "mid" },
    ];
    const hits = bfsConsumers("target", diamondEdges, 3);
    const byId = new Map(hits.map((h) => [h.id, h.hop]));
    assert.equal(hits.length, 2);
    assert.equal(byId.get("direct-and-indirect"), 1);
    assert.equal(byId.get("mid"), 1);
  });
});

describe("radius-engine: simulate", () => {
  it("computes full blast radius score and high verdict for update-payments-iam-role", () => {
    const res = simulate(
      {
        targetId: "iam-role-payments",
        newAccessId: "customer-db",
        scopeBroadened: true,
      },
      DEMO_RESOURCES,
      DEMO_EDGES,
      DEFAULT_WEIGHTS,
    );

    // Base (15) + Target high (8) + Consumers (62) + Scope (22) + PII/Compliance (20) = 127 -> clamped to 100
    assert.equal(res.score, 100);
    assert.equal(res.verdict, "high");
    assert.equal(res.consumers.length, 8);
    assert.equal(res.breakdown.length, 5);
  });

  it("computes low risk verdict for leaf service with no dependents", () => {
    const res = simulate(
      {
        targetId: "cache-layer",
        newAccessId: null,
        scopeBroadened: false,
      },
      DEMO_RESOURCES,
      DEMO_EDGES,
      DEFAULT_WEIGHTS,
    );

    assert.equal(res.score, 15);
    assert.equal(res.verdict, "low");
    assert.equal(res.consumers.length, 0);
    assert.equal(res.breakdown.length, 1);
  });

  it("assigns medium verdict when score is between 0.55 * threshold and threshold", () => {
    const res = simulate(
      {
        targetId: "third-party-webhook",
        newAccessId: null,
        scopeBroadened: true,
      },
      DEMO_RESOURCES,
      DEMO_EDGES,
      DEFAULT_WEIGHTS,
    );

    // Base (15) + Wildcard (22) = 37; with threshold = 60 -> 0.55*60 = 33 -> medium
    const mediumRes = simulate(
      {
        targetId: "third-party-webhook",
        newAccessId: null,
        scopeBroadened: true,
      },
      DEMO_RESOURCES,
      DEMO_EDGES,
      { ...DEFAULT_WEIGHTS, threshold: 60 },
    );
    assert.equal(res.score, 37);
    assert.equal(res.verdict, "low"); // 37 < round(70 * 0.55) = 39
    assert.equal(mediumRes.score, 37);
    assert.equal(mediumRes.verdict, "medium");
  });

  it("preserves historical score and verdict on decided changes while recomputing pending changes", () => {
    const strictWeights: PolicyWeights = {
      ...DEFAULT_WEIGHTS,
      threshold: 30,
      scopeBonus: 40,
    };

    const approvedSim = resolveChangeSimulation(
      {
        target_resource_id: "cache-layer",
        new_access_resource_id: null,
        scope_broadened: true,
        status: "approved",
        score: 28,
        verdict: "low",
        breakdown: [{ label: "Historical snapshot", points: 28, key: "bd.base" }],
      },
      DEMO_RESOURCES,
      DEMO_EDGES,
      strictWeights,
    );

    const pendingSim = resolveChangeSimulation(
      {
        target_resource_id: "cache-layer",
        new_access_resource_id: null,
        scope_broadened: true,
        status: "pending",
        score: 28,
        verdict: "low",
        breakdown: [{ label: "Historical snapshot", points: 28, key: "bd.base" }],
      },
      DEMO_RESOURCES,
      DEMO_EDGES,
      strictWeights,
    );

    assert.equal(approvedSim.score, 28);
    assert.equal(approvedSim.verdict, "low");
    assert.equal(approvedSim.breakdown[0]?.label, "Historical snapshot");

    assert.equal(pendingSim.score, 55); // 15 base + 40 scopeBonus
    assert.equal(pendingSim.verdict, "high"); // >= 30 threshold
  });
});

describe("radius-engine: clampWeights & normalizeWeights", () => {
  it("normalizes DB snake_case columns to PolicyWeights", () => {
    const norm = normalizeWeights({
      threshold: 75,
      sens_high_weight: 16,
      sens_medium_weight: 8,
      sens_low_weight: 4,
      scope_bonus: 25,
      compliance_bonus: 18,
    });
    assert.deepEqual(norm, {
      threshold: 75,
      sensHigh: 16,
      sensMedium: 8,
      sensLow: 4,
      scopeBonus: 25,
      complianceBonus: 18,
    });
  });

  it("clamps out-of-range and NaN weights to safe bounds", () => {
    const clamped = clampWeights({
      threshold: 150,
      sensHigh: 1,
      sensMedium: -5,
      sensLow: 99,
      scopeBonus: Number.NaN,
      complianceBonus: 45.6,
    });
    assert.deepEqual(clamped, {
      threshold: 95,
      sensHigh: 4,
      sensMedium: 1,
      sensLow: 30,
      scopeBonus: 0,
      complianceBonus: 40,
    });
  });
});

describe("hypotheses-engine", () => {
  const fixedNow = new Date("2026-11-17T12:00:00Z").getTime();

  it("extracts roleNameOf from AWS IAM role ARN", () => {
    assert.equal(roleNameOf("arn:aws:iam::123456789012:role/payments-worker"), "payments-worker");
    assert.equal(roleNameOf("simple-role"), "simple-role");
  });

  it("calculates daysLeft and daysLeftTone accurately", () => {
    const inTwoDays = new Date(fixedNow + 2 * 86400_000).toISOString();
    const inFiveDays = new Date(fixedNow + 5 * 86400_000).toISOString();
    const inTenDays = new Date(fixedNow + 10 * 86400_000).toISOString();

    assert.equal(daysLeft(inTwoDays, fixedNow), 2);
    assert.equal(daysLeftTone(2), "bad");
    assert.equal(daysLeft(inFiveDays, fixedNow), 5);
    assert.equal(daysLeftTone(5), "warn");
    assert.equal(daysLeft(inTenDays, fixedNow), 10);
    assert.equal(daysLeftTone(10), "ok");
  });

  it("maps hypothesis row and builds action/resource reduction diff", () => {
    const h = mapHypothesis(
      {
        id: "hyp-1",
        sid: "AllowS3Payments",
        label: "Payments S3 Access",
        file: "infra/iam.tf",
        role_arn: "arn:aws:iam::123:role/payments-role",
        granted_actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        granted_resources: ["arn:aws:s3:::payments/*"],
        created_at: "2026-11-01T00:00:00Z",
        expires_at: "2026-11-20T12:00:00Z",
        window_days: 14,
        used: [
          {
            action: "s3:GetObject",
            count: 42,
            resources: ["arn:aws:s3:::payments/*"],
            last: "2026-11-16T00:00:00Z",
          },
        ],
        reduced: {
          Action: ["s3:GetObject"],
          Resource: ["arn:aws:s3:::payments/*"],
        },
        verdict: "reduce",
        status: "pr_open",
        reduction_pr_url: "https://github.com/acme/infra/pull/482",
      },
      fixedNow,
    );

    assert.equal(h.roleName, "payments-role");
    assert.equal(h.daysLeft, 3);
    assert.equal(h.diff.hasProposal, true);
    assert.deepEqual(h.diff.actions, [
      { value: "s3:GetObject", kept: true },
      { value: "s3:PutObject", kept: false },
      { value: "s3:DeleteObject", kept: false },
    ]);
  });

  it("summarizes hypotheses metrics across statuses and dates", () => {
    const rows = [
      {
        status: "active",
        expires_at: new Date(fixedNow + 3 * 86400_000).toISOString(),
        reduced_at: null,
      },
      {
        status: "evidence",
        expires_at: new Date(fixedNow + 12 * 86400_000).toISOString(),
        reduced_at: null,
      },
      {
        status: "pr_open",
        expires_at: new Date(fixedNow + 1 * 86400_000).toISOString(),
        reduced_at: null,
      },
      {
        status: "merged",
        expires_at: new Date(fixedNow - 2 * 86400_000).toISOString(),
        reduced_at: new Date(fixedNow - 5 * 86400_000).toISOString(),
      },
    ];

    const summary = summarize(rows, fixedNow);
    assert.deepEqual(summary, {
      active: 2,
      expiringThisWeek: 2,
      openPrs: 1,
      removedLast30Days: 1,
    });
  });

  it("maps agent_runs summary JSON safely", () => {
    const run = mapAgentRun({
      id: 7,
      ran_at: "2026-11-17T09:00:00Z",
      summary: { checked: 6, reduced: 2 },
    });
    assert.equal(run.id, 7);
    assert.equal(run.summary, JSON.stringify({ checked: 6, reduced: 2 }, null, 2));
  });
});

describe("enterprise: iac-parser (parseIacPayload)", () => {
  it("parses Terraform plan JSON (terraform show -json) and detects wildcard + target + new access", () => {
    const tfPlan = {
      resource_changes: [
        {
          address: "aws_iam_role_policy.payments_policy",
          name: "payments_policy",
          change: {
            after: {
              role: "iam-role-payments",
              policy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                  {
                    Effect: "Allow",
                    Action: ["s3:*", "rds:Connect"],
                    Resource: ["arn:aws:rds:us-east-1:123456789012:db/customer-db"],
                  },
                ],
              }),
            },
          },
        },
      ],
    };

    const parsed = parseIacPayload(tfPlan, DEMO_RESOURCES);
    assert.equal(parsed.title, "tf: aws_iam_role_policy.payments_policy");
    assert.equal(parsed.targetResourceId, "iam-role-payments");
    assert.equal(parsed.newAccessResourceId, "customer-db");
    assert.equal(parsed.scopeBroadened, true);
    assert.deepEqual(parsed.detectedActions, ["s3:*", "rds:Connect"]);
  });

  it("parses raw AWS IAM Policy JSON with specific actions (scopeBroadened = false)", () => {
    const iamJson = JSON.stringify({
      role: "admin-console",
      Statement: [
        {
          Effect: "Allow",
          Action: ["s3:GetObject"],
          Resource: ["arn:aws:s3:::payments-bucket/reports/*"],
        },
      ],
    });

    const parsed = parseIacPayload(iamJson, DEMO_RESOURCES);
    assert.equal(parsed.targetResourceId, "admin-console");
    assert.equal(parsed.newAccessResourceId, "s3-payments-bucket");
    assert.equal(parsed.scopeBroadened, false);
  });
});

describe("enterprise: agent-runner (evaluateHypothesisUsage)", () => {
  const fixedNow = new Date("2026-11-17T12:00:00Z").getTime();

  it("proposes remove when zero actions were observed", () => {
    const res = evaluateHypothesisUsage(
      {
        id: "h-remove",
        sid: "UnusedRole",
        file: "iam.tf",
        role_arn: "arn:aws:iam::123:role/unused",
        granted_actions: ["s3:GetObject", "s3:PutObject"],
        granted_resources: ["arn:aws:s3:::payments/*"],
        created_at: "2026-11-01T00:00:00Z",
        expires_at: "2026-11-20T00:00:00Z",
        window_days: 14,
        used: [],
        status: "active",
      },
      fixedNow,
    );

    assert.ok(res);
    assert.equal(res.verdict, "remove");
    assert.equal(res.status, "pr_open");
    assert.deepEqual(res.reduced, { Action: [], Resource: [] });
  });

  it("proposes reduce when wildcard or superset of actions was granted", () => {
    const res = evaluateHypothesisUsage(
      {
        id: "h-reduce",
        sid: "WildcardS3",
        file: "iam.tf",
        role_arn: "arn:aws:iam::123:role/payments",
        granted_actions: ["s3:*"],
        granted_resources: ["*"],
        created_at: "2026-11-01T00:00:00Z",
        expires_at: "2026-11-20T00:00:00Z",
        window_days: 14,
        used: [
          {
            action: "s3:GetObject",
            count: 19,
            resources: ["arn:aws:s3:::payments/*"],
          },
        ],
        status: "evidence",
      },
      fixedNow,
    );

    assert.ok(res);
    assert.equal(res.verdict, "reduce");
    assert.equal(res.status, "pr_open");
    assert.deepEqual(res.reduced, {
      Action: ["s3:GetObject"],
      Resource: ["arn:aws:s3:::payments/*"],
    });
  });

  it("skips terminal statuses (merged / kept_with_reason)", () => {
    const res = evaluateHypothesisUsage(
      {
        id: "h-kept",
        sid: "KeptRole",
        file: "iam.tf",
        role_arn: "arn:aws:iam::123:role/kept",
        granted_actions: ["s3:*"],
        granted_resources: ["*"],
        created_at: "2026-11-01T00:00:00Z",
        expires_at: "2026-11-20T00:00:00Z",
        window_days: 14,
        used: [],
        status: "kept_with_reason",
      },
      fixedNow,
    );
    assert.equal(res, null);
  });
});

describe("enterprise: graph-layout (computeAutoLayout)", () => {
  it("organizes resources into hierarchical columns by dependency layer", () => {
    const zeroed = DEMO_RESOURCES.map((r) => ({ ...r, x: 0, y: 0 }));
    const laidOut = computeAutoLayout(zeroed, DEMO_EDGES);
    const byId = new Map(laidOut.map((r) => [r.id, r]));

    assert.equal(laidOut.length, DEMO_RESOURCES.length);
    // Entry/external column < Core service column < Role column < Data store column
    assert.ok((byId.get("third-party-webhook")?.x ?? 0) < (byId.get("payments-service")?.x ?? 0));
    assert.ok((byId.get("payments-service")?.x ?? 0) < (byId.get("iam-role-payments")?.x ?? 0));
    assert.ok((byId.get("iam-role-payments")?.x ?? 0) < (byId.get("customer-db")?.x ?? 0));
  });
});
