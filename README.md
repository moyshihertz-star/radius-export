# Radius — DevSecOps Cloud Blast Radius & IAM Hypothesis Console

Radius analyzes planned cloud infrastructure and IAM changes **before** they reach production, calculates a transparent **0–100 Blast Radius Risk Score**, and tracks granted IAM permissions as **time-boxed hypotheses** backed by runtime telemetry.

## Key Features

- **Blast Radius Simulation Engine (`src/lib/radius-engine.server.ts`)**: Runs a 3-hop reverse BFS ($O(|V| + |E|)$) across the dependency graph to identify every direct and transitive upstream service impacted by an IAM or infrastructure change.
- **Terraform Plan & AWS IAM Policy Parser (`src/lib/iac-parser.ts`)**: Parses `terraform show -json` (`resource_changes[]`), raw AWS IAM Policy JSON (`Statement[]`), and cloud topology JSON—automatically detecting wildcard actions (`*`, `s3:*`) and sensitive data store access (`pii`, `compliance`).
- **CI/CD Webhook Gatekeeper (`POST /api/public/ingest` & `.github/workflows/radius-gatekeeper.yml`)**: Authenticated webhook endpoint (`x-radius-ingest-key`) that scores CI changes, logs to the compliance audit trail, and returns `requiresApproval: true` when `verdict === "high"`.
- **Autonomous Permission Hypotheses Agent (`src/lib/agent-runner.server.ts`)**: Evaluates granted IAM actions/resources against observed runtime telemetry (`used`), computes minimal least-privilege diffs (`keep` / `reduce` / `remove`), and supports mandatory justification overrides (**Keep with reason**).
- **Interactive Dependency Map (`src/routes/_authenticated/app.map.tsx`)**: Directional SVG graph with clickable node blast-radius inspection, search, sensitivity/PII filters, automatic hierarchical layout (`computeAutoLayout`), and cloud topology JSON import.
- **Compliance Audit Trail (`src/routes/_authenticated/app.audit.tsx`)**: Immutable audit log with **CSV / JSON export**, one-click CI webhook testing, ingest key rotation, and mandatory reviewer justification notes on high-risk approvals.
- **Bilingual UI (`src/lib/i18n.tsx`)**: Full English (`LTR`) and Hebrew (`RTL`) localization.

## Quick Start

```sh
npm install
npm run dev
```

- **Zero-Config Local Mode**: If `.env` is not set, Radius automatically uses a durable local store persisted to `.radius-local-db.json` seeded with a 14-resource cloud topology, 4 changes, 6 hypotheses, and 3 agent runs.
- **Supabase Cloud Mode**: Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in `.env` and apply the migrations in `drizzle/migrations/` (`0000` → `0001` → `0002`).

## Testing & Verification

```sh
npm test          # Run the automated unit test suite (node --test)
npx tsc --noEmit  # Run strict TypeScript typechecking
npm run lint      # Run ESLint
npm run build     # Build client & SSR Nitro bundles
```
