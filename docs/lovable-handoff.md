# Lovable Handoff (Backend Integration Contract)

This document is the contract for building and iterating UI against the current ContextOS backend.

## Base URL

- Local API: `http://localhost:8000`
- Local frontend default: `http://localhost:5173`

## Auth Model

MVP auth is optional.

- If backend env `CONTEXTOS_API_KEY` is unset: no API key required.
- If set: include header `X-Api-Key: <value>` for protected endpoints:
  - `POST /ingest/upload`
  - `GET /facts/{fact_id}/neighbors`
  - `GET /graph/stats`

## Core Endpoints For UI

### Health + dashboard cards

- `GET /health`
- `GET /metrics/context-health`
- `GET /metrics/ingestion-progress`

### Ingest page

- `POST /ingest/dataset`
- `POST /sync/dataset`
- `POST /ingest/upload` (multipart files)

Useful request defaults:

```json
{
  "root_path": "data/Dataset",
  "include_extensions": ["json", "csv", "pdf"],
  "sample_records_per_file": 45,
  "sample_seed": 42
}
```

Sync supports `dry_run` for preview-only execution.

### Memory browser (`/fs`)

- `GET /facts/paged?namespace=<static|procedural|trajectory>&offset=0&limit=200`
- `GET /facts/{fact_id}`
- `PATCH /facts/{fact_id}`

`GET /facts/{fact_id}` includes:

- `fact`
- `provenance[]`
- `linked_facts[]`
- `audit_trail[]`

### Conflict queue (`/conflicts`)

- `GET /conflicts?include_candidates=true&statuses=open,escalated,resolved`
- `POST /conflicts/{conflict_id}/resolve`

Resolve action body:

```json
{
  "action": "resolve",
  "selected_fact_id": "<fact_id>",
  "create_rule": true,
  "rule_name": "Prefer HRMS for employee title"
}
```

Escalate action body:

```json
{
  "action": "escalate",
  "actor": "analyst",
  "assigned_to": "data-steward",
  "priority": "high",
  "escalation_reason": "Conflicting source values"
}
```

Rules management:

- `GET /rules`
- `POST /rules`
- `DELETE /rules/{rule_id}`

### Query console (`/` or dedicated panel)

- `POST /query`

Example body:

```json
{
  "text": "What changed in IT policy this month?",
  "limit": 20
}
```

### Graph view (`/graph`)

- `GET /facts/{fact_id}/neighbors?depth=2`
- `GET /graph/stats`

## UI Behaviors To Preserve

- Always show confidence and provenance together.
- Surface conflict status (`open`, `escalated`, `resolved`) clearly.
- Make dry-run vs apply states explicit on sync.
- Preserve audit history visibility for manual edits.
- Respect server paging (`offset`, `limit`) and max limits.

## Error Handling Expectations

- `400` for invalid payload or unsupported upload type.
- `401` for missing/invalid API key when protected mode is enabled.
- `404` for unknown fact/conflict/rule IDs.
- `5xx` as backend runtime error; show per-file failures from ingest `errors[]`.

## Notes

- PDFs are stored as provenance-aware records (OCR/text extraction not implemented yet).
- Dataset paths are resolved from repository root when relative (for example `data/Dataset`).
