# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (FastAPI, Python 3.10+)
```bash
# Setup
cd apps/api && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# Run API (port 8000)
uvicorn contextos.api.main:app --reload --port 8000
# or: make api-run

# Tests
cd apps/api && pytest -q
# Single test: pytest tests/test_ingestion.py::test_name -q

# Ingest sample data (API must be running)
make dataset-ingest
```

### Frontend (React 19 + Vite)
```bash
cd apps/front-end
npm install
npm run dev       # dev server
npm run build     # production build
npm run lint      # ESLint
npm run format    # Prettier
```

## Architecture

**ContextOS** is an enterprise knowledge graph / memory OS that ingests fragmented data into atomic facts with conflict resolution, provenance tracking, and AI agent retrieval.

### Backend (`apps/api/contextos/`)

**Layers:**
- `api/` — FastAPI routes and app init. 40+ REST endpoints.
- `domain/` — Core models (`Fact`, `Conflict`, `SourceRecord`, `ResolutionRule`) and Pydantic schemas.
- `services/` — Business logic: ingestion, conflict resolution, retrieval, provenance, metrics.
- `storage/` — `InMemoryRepository` (default, JSON-persisted to `data/processed/`) or `SqliteRepository` (set `CONTEXTOS_STORAGE_BACKEND=sqlite`).
- `core/container.py` — Singleton DI container; all services are instantiated here and injected into routes.

**Key services:**
- `IngestionService` — Extracts atomic facts, infers namespace (`static`/`procedural`/`trajectory`), builds graph edges (linked facts).
- `ConflictEngine` — Auto-resolves conflicts via authority ranking (HRMS > HR > Policy > ITSM > CRM > Email), recency (trajectory namespace), or rules.
- `RetrievalService` — Text + filter-based fact queries with confidence scoring.
- `ProvenanceService` — Lineage from fact → source records + audit trail for manual edits.

**Auth:** Optional `X-Api-Key` header; controlled by `CONTEXTOS_API_KEY` env var.

### Frontend (`apps/front-end/src/`)

File-based routing via TanStack Router. Routes:
- `/` — Dashboard (health metrics, conflict trends)
- `/ingest` — File upload / dataset ingestion
- `/fs` — Virtual filesystem browser (namespace/path tree)
- `/conflicts` — Conflict resolution queue
- `/graph` — Knowledge graph visualization

`lib/api.ts` contains all typed API client functions. No global state manager — React hooks + local state only. UI built on Radix UI primitives + Tailwind CSS.

### Data Flow

Ingest → extract atomic facts → detect conflicts → auto-resolve (authority/recency/rule) → persist to repo → available for query/retrieval.

Facts are keyed by `(subject, predicate, path/namespace)`. A differing `object_value` for the same key creates a `Conflict`.
