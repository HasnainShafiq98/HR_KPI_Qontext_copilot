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
  - result: changed-files-only ingestion summary (`files_changed`, `files_unchanged`) for incremental sync

## Facts
- `GET /facts`
  - query: namespace, subject, predicate
- `GET /facts/paged`
  - query: namespace, subject, predicate, offset, limit
  - result: paginated facts (`items`, `total`, `offset`, `limit`)

- `GET /facts/{fact_id}`
  - result: fact + provenance + linked facts

## Conflicts
- `GET /conflicts`
  - query: `include_candidates=true` to return candidate fact payloads inline
- `POST /conflicts/{conflict_id}/resolve`
  - body: selected fact id + optional reusable rule
- `GET /rules`
  - result: learned reusable conflict rules

## Retrieval (Agents)
- `POST /query`
  - body: query intent + filters
  - result: ranked facts with confidence, provenance links, staleness flags

## Metrics
- `GET /metrics/context-health`
- `GET /metrics/ingestion-progress`
