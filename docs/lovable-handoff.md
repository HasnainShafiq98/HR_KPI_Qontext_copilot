# Lovable Handoff (Backend Contract)

This backend is the system of record for ContextOS memory.
Build the UI in Lovable against the API endpoints below.

## Base URL

- Local: `http://localhost:8000`

## Core Endpoints

1. `GET /health`
- Service health check.

2. `POST /ingest/dataset`
- Bulk ingests local dataset files.
- Example body:

```json
{
  "root_path": "data/Dataset",
  "include_extensions": ["json", "csv", "pdf"],
  "max_files": null,
  "max_records_per_file": null
}
```

3. `GET /metrics/context-health`
- Dashboard card: confidence distribution + conflict counters.

4. `GET /metrics/ingestion-progress`
- Dashboard card: ingestion progress stats.

5. `GET /facts?namespace=static|procedural|trajectory`
- File-system browser list.

6. `GET /facts/{fact_id}`
- Detail drawer: fact + provenance + linked facts.

7. `GET /conflicts`
- Conflict queue table.

8. `POST /conflicts/{conflict_id}/resolve`
- Resolve conflict and optionally create a reusable rule.

9. `POST /query`
- Agent-style retrieval endpoint.

## Suggested Lovable Screens

1. Context Health Dashboard
- Ingestion progress, open conflicts, confidence average.

2. Memory Browser
- Three root buckets: `/static`, `/procedural`, `/trajectory`.
- Fact list + fact detail panel.

3. Conflict Queue
- List unresolved conflicts and resolve actions.

4. Agent Query Console
- Text query + results with confidence and provenance.

## Notes

- Facts are atomic scalar facts extracted from records.
- PDFs are currently registered as provenance records (no OCR extraction yet).
- UI should surface source links and confidence to preserve trust.
