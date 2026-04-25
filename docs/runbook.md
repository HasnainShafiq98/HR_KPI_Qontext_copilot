# ContextOS Runbook

## 1. Start Services

### API
```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn contextos.api.main:app --reload --port 8000
```

### Frontend
```bash
cd apps/front-end
npm install
npm run dev
```

If needed:
```bash
export VITE_API_BASE_URL=http://localhost:8000
```

## 2. Initial Ingest

Run full ingest from UI (`/ingest`) with mode `Full ingest`, or via API:
```bash
curl -X POST http://localhost:8000/ingest/dataset \
  -H "Content-Type: application/json" \
  -d '{"root_path":"data/Dataset","include_extensions":["json","csv","pdf"],"max_files":500,"max_records_per_file":1000}'
```

Validate:
1. `GET /metrics/context-health`
2. `GET /facts/paged?offset=0&limit=50`
3. `GET /conflicts?include_candidates=true`

## 3. Recurring Sync

### Preview changes (dry run)
```bash
curl -X POST http://localhost:8000/sync/dataset \
  -H "Content-Type: application/json" \
  -d '{"root_path":"data/Dataset","include_extensions":["json","csv","pdf"],"dry_run":true}'
```

### Apply changed files
```bash
curl -X POST http://localhost:8000/sync/dataset \
  -H "Content-Type: application/json" \
  -d '{"root_path":"data/Dataset","include_extensions":["json","csv","pdf"],"dry_run":false}'
```

Use `file_diffs` in response/UI to inspect per-file `changed/unchanged/error`.
`removed` rows indicate source files that disappeared; related facts are marked stale.

## 4. Conflict Review Workflow

1. Open `/conflicts` in frontend.
2. Review each conflict with provenance pulled from `GET /facts/{id}`.
3. Resolve with left/right winner, or escalate to human review queue.
4. Optionally check `Create rule from this resolution`.
5. Verify rule set and usage counters in `GET /rules`.
6. Remove stale rules with `DELETE /rules/{rule_id}`.

## 5. Fact Edit Workflow

1. Open `/fs`.
2. Select entity and fact row.
3. Edit value or status.
4. Backend persists through `PATCH /facts/{id}`.
5. Confirm changes in `GET /facts/{id}` (`audit_trail` + provenance).
