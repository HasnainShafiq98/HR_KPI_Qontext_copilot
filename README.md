# ContextOS

ContextOS turns fragmented enterprise data into a living, inspectable company brain.

This repository contains an MVP boilerplate for:
- format-agnostic ingestion into atomic facts
- virtual memory file system (`/static`, `/procedural`, `/trajectory`)
- conflict resolution with human queue
- provenance-aware retrieval for AI agents and humans
- lightweight dashboard + graph visualization shell

## Project Layout

- `docs/` - architecture, roadmap, and data contracts
- `apps/api/` - FastAPI service for ingest/query/conflicts/provenance
- `apps/web/` - minimal UI scaffold for browser/dashboard
- `data/` - local raw and processed data folders
- `scripts/` - helper scripts and dev automation

## Quick Start

1. Create a Python environment and install API deps:

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Run the API:

```bash
uvicorn contextos.api.main:app --reload --port 8000
```

3. Open the web shell:

```bash
cd ../../apps/web
python3 -m http.server 8080
```

Then visit:
- API docs: `http://localhost:8000/docs`
- UI shell: `http://localhost:8080`

## MVP Milestones

See `docs/implementation-plan.md` for a phased roadmap.
