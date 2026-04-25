# Demo Script (Challenge Judging)

## 0. Setup (30s)
1. Start API and frontend (see `docs/runbook.md`).
2. Show `/health` response including persisted `state_integrity`.

## 1. Enterprise Context Ingestion (1.5m)
1. Open `/ingest`.
2. Run `Full ingest`.
3. Narrate outcomes:
   - files scanned/processed
   - facts created
   - conflicts created
4. Show dashboard KPIs (`/`): facts total, confidence, open conflicts.

Judging points covered: ingestion breadth, observability, data quality baseline.

## 2. Incremental Sync + Scale Safety (1.5m)
1. Switch ingest page to `Incremental sync`.
2. Run with `dry_run=true`.
3. Highlight per-file diff table (`changed/unchanged/error`) with no write side effects.
4. Run sync apply (`dry_run=false`) and show only changed files processed.
5. Mention server guardrails: paged reads + capped limits for large queries.

Judging points covered: production-readiness, scalability, operational control.

## 3. Provenance-First Conflict Resolution (2m)
1. Open `/conflicts`.
2. Pick one conflict and show both candidate values + real provenance (`/facts/{id}`).
3. Escalate one conflict to human queue, resolve another, and create reusable rule.
4. Open rules table to show created rule and usage metrics.

Judging points covered: trust, explainability, human-in-the-loop governance.

## 4. Fact Editing with Audit Trail (1m)
1. Open `/fs`.
2. Edit a fact value and status.
3. Show provenance/audit indicators in detail pane.
4. Confirm via API (`GET /facts/{id}`) that `audit_trail` persisted.

Judging points covered: data stewardship, compliance posture, traceability.

## 5. Retrieval Quality (1m)
1. In dashboard `Ask ContextOS`, run 1-2 business questions.
2. Show top answers with confidence + source attribution.

Judging points covered: agent-readiness and decision support quality.

## 6. Close (30s)
1. Recap:
   - persistent memory
   - conflict governance + rule learning
   - incremental sync with dry-run safety
   - provenance + auditability end-to-end
