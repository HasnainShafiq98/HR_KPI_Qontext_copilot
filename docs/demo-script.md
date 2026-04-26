# Demo Script (Challenge / Judge Flow)

Target length: 7-8 minutes.

## 0. Setup (30s)

1. Confirm API and frontend are live (`/health`, dashboard loads).
2. Mention that ContextOS persists state and exposes provenance-first memory.

## 1. Enterprise Ingestion (90s)

1. Open `/ingest`.
2. Run dataset ingest in sampled mode.
3. Call out returned totals:
   - `files_processed`
   - `sources_ingested`
   - `facts_created`
   - `conflicts_created`
4. Navigate to dashboard (`/`) and point to context-health KPIs.

Judging themes: ingestion breadth, observability, baseline quality.

## 2. Incremental Sync Safety (90s)

1. Stay on `/ingest` and switch to sync.
2. Run dry-run (`dry_run=true`) and show `file_diffs` without writes.
3. Run apply (`dry_run=false`) and show changed-only processing.
4. Explain large-data guardrails: paged endpoints and limit caps.

Judging themes: production readiness, scalability, operational control.

## 3. Conflict Governance (120s)

1. Open `/conflicts`.
2. Pick a conflict and inspect candidate facts + provenance.
3. Escalate one conflict with reason/assignee/priority.
4. Resolve another conflict and create a reusable rule.
5. Show rules table and usage metrics.

Judging themes: trust, explainability, human-in-the-loop workflows.

## 4. Fact Stewardship + Audit Trail (60s)

1. Open `/fs`.
2. Edit a fact value/status.
3. Show detail panel with provenance + audit trail.
4. Optionally verify with `GET /facts/{fact_id}`.

Judging themes: governance, compliance, traceability.

## 5. Retrieval Quality (60s)

1. Use "Ask ContextOS" on dashboard.
2. Run 1-2 business questions.
3. Highlight scored answers with staleness flags and source attribution.

Judging themes: agent readiness and decision support.

## 6. Graph Exploration (45s)

1. Open `/graph`.
2. Show how one fact links to neighboring facts.
3. Mention optional protected graph stats endpoint for backend analytics.

Judging themes: knowledge connectivity and context depth.

## 7. Close (30s)

1. Recap:
   - persistent memory with provenance
   - conflict governance with rule learning
   - safe incremental sync
   - retrieval and graph context for humans + agents
