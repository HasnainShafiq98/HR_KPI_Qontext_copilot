# ContextOS

ContextOS turns fragmented enterprise data into a living, inspectable company brain.

This repository contains an MVP boilerplate for:
- format-agnostic ingestion into atomic facts
- virtual memory file system (`/static`, `/procedural`, `/trajectory`)
- conflict resolution with human queue
- provenance-aware retrieval for AI agents and humans
- backend APIs for a Lovable-built UI

## Project Layout

- `docs/` - architecture, roadmap, and data contracts
- `apps/api/` - FastAPI service for ingest/query/conflicts/provenance
- `apps/web/` - legacy local UI shell (optional, UI is expected in Lovable)
- `data/` - local raw and processed data folders
- `scripts/` - helper scripts and dev automation

## Quick Start

1. Create a Python environment and install API deps:

```bash
cd apps/api
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Run the API:

```bash
uvicorn contextos.api.main:app --reload --port 8000
```

3. Ingest the provided dataset:

```bash
make dataset-ingest
```

This runs in demo mode: 45 records are randomly sampled per file (seed 42) so ingestion completes in seconds rather than hours. To ingest all records without sampling:

```bash
make dataset-ingest-full
```

To control sampling from the shell:

```bash
SAMPLE_SIZE=30 SAMPLE_SEED=7 ./scripts/ingest_dataset.sh
```

Then visit:
- API docs: `http://localhost:8000/docs`

## MVP Milestones

See `docs/implementation-plan.md` for a phased roadmap.

## Lovable UI Handoff

Use `docs/lovable-handoff.md` as the contract for building the UI in Lovable against this backend.

## Entire Setup

Use `docs/entire-setup.md` to enable Entire CLI for Codex session checkpointing in this repo.
