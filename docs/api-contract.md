# API Contract (MVP)

## Health
- `GET /health`

## Ingestion
- `POST /ingest`
  - body: `IngestRequest`
  - result: ingestion summary

## Facts
- `GET /facts`
  - query: namespace, subject, predicate

- `GET /facts/{fact_id}`
  - result: fact + provenance + linked facts

## Conflicts
- `GET /conflicts`
- `POST /conflicts/{conflict_id}/resolve`
  - body: selected fact id + optional reusable rule

## Retrieval (Agents)
- `POST /query`
  - body: query intent + filters
  - result: ranked facts with confidence, provenance links, staleness flags

## Metrics
- `GET /metrics/context-health`
- `GET /metrics/ingestion-progress`
