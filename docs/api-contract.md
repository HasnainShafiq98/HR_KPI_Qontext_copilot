# API Contract (MVP)

## Health
- `GET /health`

## Ingestion
- `POST /ingest`
  - body: `IngestRequest`
  - result: ingestion summary
- `POST /ingest/dataset`
  - body: `DatasetIngestRequest`
  - result: bulk ingestion summary (`files_processed`, `sources_ingested`, `facts_created`, `conflicts_created`)
- `POST /sync/dataset`
  - body: `SyncDatasetRequest`
  - supports `dry_run` for preview-only sync
  - result: changed-files-only ingestion summary (`files_changed`, `files_unchanged`) + per-file diff summary (`file_diffs`: `changed|unchanged|skipped|removed|error`)

## Facts
- `GET /facts`
  - query: namespace, subject, predicate, offset, limit
  - server-side capped (`limit <= 1000`)
- `GET /facts/paged`
  - query: namespace, subject, predicate, offset, limit
  - server-side capped (`limit <= 1000`)
  - result: paginated facts (`items`, `total`, `offset`, `limit`)

- `GET /facts/{fact_id}`
  - result: fact + provenance + linked facts + `audit_trail`
- `PATCH /facts/{fact_id}`
  - body: update `object_value` and/or `status` (+ optional `actor`, `reason`)
  - result: updated fact + persisted audit entry

## Conflicts
- `GET /conflicts`
  - query: `include_candidates=true` to return candidate fact payloads inline
  - query: `statuses=open,escalated,resolved`
  - query: offset, limit (`limit <= 1000`)
  - result: paged payload (`items`, `total`, `offset`, `limit`, `statuses`)
- `POST /conflicts/{conflict_id}/resolve`
  - body action `resolve` (selected fact id + optional reusable rule) or action `escalate` (reason/assignee/priority)
- `GET /rules`
  - query: offset, limit
  - result: paged rules (`items`, `total`, `offset`, `limit`) with usage counters
- `POST /rules`
  - body: rule payload (name/namespace/predicate/source/strategy)
  - result: created rule
- `DELETE /rules/{rule_id}`
  - result: deletion acknowledgment

## Retrieval (Agents)
- `POST /query`
  - body: query intent + filters + `limit`
  - result: ranked facts with confidence, provenance links, staleness flags, retrieval score

## Metrics
- `GET /metrics/context-health`
- `GET /metrics/ingestion-progress`

## Health
- `GET /health`
  - includes persisted state integrity status (`state_integrity`)
