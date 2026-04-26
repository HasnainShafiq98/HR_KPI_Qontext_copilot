# ContextOS API Contract (MVP)

Base URL (local): `http://localhost:8000`

## Authentication

Authentication is optional in the MVP.

- If `CONTEXTOS_API_KEY` is not set, all endpoints are open.
- If `CONTEXTOS_API_KEY` is set, these endpoints require `X-Api-Key`:
  - `POST /ingest/upload`
  - `GET /facts/{fact_id}/neighbors`
  - `GET /graph/stats`

## Health

### `GET /health`

Returns service and persisted state integrity status.

## Ingestion

### `POST /ingest`

Ingest one source payload.

Request body: `IngestRequest`

- `source_system: string`
- `source_type: string`
- `source_uri: string`
- `payload: object`

Response body: `IngestResponse`

- `source_record_id`
- `facts_created`
- `conflicts_created`

### `POST /ingest/dataset`

Bulk ingest from local filesystem dataset.

Request body: `DatasetIngestRequest`

- `root_path: string` (default `data/Dataset`)
- `include_extensions: string[]` (default `["json","csv","pdf"]`)
- `max_files: number | null` (default `500`, cap `5000`)
- `max_records_per_file: number | null` (default `1000`, cap `10000`)
- `sample_records_per_file: number | null` (default `45`, cap `500`)
- `sample_seed: number | null`

Response body: `DatasetIngestResponse`

- summary counts (`files_scanned`, `files_processed`, `facts_created`, ...)
- `file_diffs[]` with per-file status
- `errors[]`

### `POST /ingest/upload`

Multipart upload ingest for one or more JSON/CSV/PDF files.

- Form field: `files`
- Query params:
  - `sample_records_per_file` (default `45`)
  - `sample_seed` (optional)

Returns `DatasetIngestResponse` with `root_path` set to `uploaded files`.

## Sync

### `POST /sync/dataset`

Changed-files-only ingest with optional dry-run preview.

Request body: `SyncDatasetRequest`

- same shape as dataset ingest plus `dry_run: boolean`

Response body: `SyncDatasetResponse`

- includes `files_changed`, `files_unchanged`, and `file_diffs`
- `file_diffs.status` values: `changed | unchanged | skipped | removed | error`

## Facts

### `GET /facts`

Query params:

- `namespace`
- `subject`
- `predicate`
- `offset` (default `0`)
- `limit` (default `200`, max `1000`)

Returns fact list.

### `GET /facts/paged`

Same filters as `/facts`.

Returns:

- `items`
- `total`
- `offset`
- `limit`

### `GET /facts/{fact_id}`

Returns:

- `fact`
- `provenance`
- `linked_facts`
- `audit_trail`

### `PATCH /facts/{fact_id}`

Update a fact value and/or status.

Request body: `UpdateFactRequest`

- `object_value?: string`
- `status?: "active" | "stale" | "conflicted"`
- `actor?: string`
- `reason?: string`

Returns updated fact and persisted audit entry.

## Conflicts and Rules

### `GET /conflicts`

Query params:

- `include_candidates` (default `false`)
- `statuses` CSV (default `open,escalated`)
- `offset` (default `0`)
- `limit` (default `200`, max `1000`)

Returns paged conflict payload.

### `POST /conflicts/{conflict_id}/resolve`

Two actions:

- Resolve:
  - `action: "resolve"`
  - `selected_fact_id` (required)
  - `create_rule` (optional)
  - `rule_name` (optional)
- Escalate:
  - `action: "escalate"`
  - `actor`, `escalation_reason`, `assigned_to`, `priority` (optional)

### `GET /rules`

Query params: `offset`, `limit`

Returns paged rules with usage counters.

### `POST /rules`

Create manual rule.

Request body: `CreateRuleRequest`

- `name`
- `namespace?`
- `predicate?`
- `preferred_source_system?`
- `strategy` (default `prefer_source_system`)

### `DELETE /rules/{rule_id}`

Deletes a rule.

## Retrieval

### `POST /query`

Request body: `QueryRequest`

- `text`
- `namespace?`
- `subject?`
- `predicate?`
- `limit` (default `20`, max `500`)

Returns ranked hits with fact, provenance, staleness flag, and retrieval score.

## Metrics

### `GET /metrics/context-health`

Returns:

- `facts_total`
- `confidence_avg`
- `status_distribution`
- `conflicts_total`
- `conflicts_open`

### `GET /metrics/ingestion-progress`

Returns:

- `sources_processed`
- `facts_created`
- `conflicts_detected`
- `resolved_conflicts`

## Graph

### `GET /facts/{fact_id}/neighbors`

Query params:

- `depth` (default `1`, min `1`, max `4`)

Returns BFS neighborhood graph payload (`nodes`, `edges`, counts).

### `GET /graph/stats`

Returns graph-level structural summary statistics.
