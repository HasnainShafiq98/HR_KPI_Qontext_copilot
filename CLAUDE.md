# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (FastAPI, Python 3.10+)

```bash
# Setup
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run API
uvicorn contextos.api.main:app --reload --port 8000
# or from repo root: make api-run

# Tests
pytest -q
# Single test example:
pytest tests/test_dataset_ingest.py::test_dataset_ingest_endpoint -q

# Ingest sample dataset (API must be running)
cd /path/to/repo
make dataset-ingest
```

### Frontend (React 19 + Vite)

```bash
cd apps/front-end
npm install
npm run dev
npm run build
npm run lint
npm run format
```

If needed:

```bash
export VITE_API_BASE_URL=http://localhost:8000
```

## Architecture

ContextOS is an enterprise memory platform that ingests fragmented records into atomic facts with provenance tracking, conflict governance, and retrieval for AI/human workflows.

### Backend (`apps/api/contextos/`)

Layers:

- `api/` - FastAPI routes and app setup.
- `domain/` - models and request/response schemas.
- `services/` - ingestion, conflict engine, retrieval, provenance, and metrics logic.
- `storage/` - JSON-backed in-memory repository (default) and SQLite-backed repository option.
- `core/container.py` - singleton dependency container wiring services together.

Storage behavior:

- Default backend: JSON (`data/processed/contextos_state.json`)
- Optional backend: SQLite (`CONTEXTOS_STORAGE_BACKEND=sqlite`)
- Optional state override: `CONTEXTOS_STATE_FILE=/custom/path`

Auth behavior:

- Optional API key mode via `CONTEXTOS_API_KEY`
- Protected endpoints (when key is set): upload ingest and graph APIs

### Frontend (`apps/front-end/src/`)

TanStack Router file-based routes:

- `/` dashboard and query panel
- `/ingest` dataset ingest and sync controls
- `/fs` fact browser and detail view
- `/conflicts` conflict queue and rule management
- `/graph` linked-fact graph exploration

`src/lib/api.ts` contains typed API wrappers used by routes.

## Data Flow

1. Ingest source records.
2. Extract and normalize atomic facts.
3. Detect conflicts on conflicting fact keys.
4. Auto-resolve using rules/authority/recency where possible.
5. Persist facts, conflicts, rules, provenance, and audits.
6. Serve retrieval, metrics, and graph APIs to UI/agents.
