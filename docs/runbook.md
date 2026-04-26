# ContextOS Runbook

This runbook covers local development, ingest operations, sync workflows, and conflict/fact governance.

## 1. Start Services

### Backend API (Terminal 1)

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn contextos.api.main:app --reload --port 8000
```

Sanity check:

```bash
curl -sS http://localhost:8000/health | python3 -m json.tool
```

### Frontend (Terminal 2)

```bash
cd apps/front-end
npm install
npm run dev
```

Optional API override:

```bash
export VITE_API_BASE_URL=http://localhost:8000
```

## 2. Initial Dataset Ingest

### Fast path (demo sampling)

From repository root:

```bash
make dataset-ingest
```

This sends `sample_records_per_file=45` and `sample_seed=42`.

### Full ingest (no sampling)

```bash
make dataset-ingest-full
```

### Direct API call

```bash
curl -sS -X POST http://localhost:8000/ingest/dataset \
  -H "Content-Type: application/json" \
  -d '{
    "root_path":"data/Dataset",
    "include_extensions":["json","csv","pdf"],
    "max_files":500,
    "max_records_per_file":1000,
    "sample_records_per_file":45,
    "sample_seed":42
  }' | python3 -m json.tool
```

## 3. Validate System State

```bash
curl -sS http://localhost:8000/metrics/context-health | python3 -m json.tool
curl -sS "http://localhost:8000/facts/paged?offset=0&limit=20" | python3 -m json.tool
curl -sS "http://localhost:8000/conflicts?include_candidates=true" | python3 -m json.tool
```

UI checks:

- `/` for headline health metrics.
- `/ingest` for ingest/sync controls.
- `/fs` for fact browsing and detail drill-down.
- `/conflicts` for conflict queue and rules.
- `/graph` for linked-fact exploration.

## 4. Recurring Sync Workflow

### Preview only (`dry_run=true`)

```bash
curl -sS -X POST http://localhost:8000/sync/dataset \
  -H "Content-Type: application/json" \
  -d '{
    "root_path":"data/Dataset",
    "include_extensions":["json","csv","pdf"],
    "dry_run":true,
    "sample_records_per_file":45,
    "sample_seed":42
  }' | python3 -m json.tool
```

### Apply sync (`dry_run=false`)

```bash
curl -sS -X POST http://localhost:8000/sync/dataset \
  -H "Content-Type: application/json" \
  -d '{
    "root_path":"data/Dataset",
    "include_extensions":["json","csv","pdf"],
    "dry_run":false,
    "sample_records_per_file":45,
    "sample_seed":42
  }' | python3 -m json.tool
```

Interpretation notes:

- `file_diffs.status=changed` means file was processed.
- `file_diffs.status=unchanged` means signature matched previous sync.
- `file_diffs.status=removed` means source file disappeared; linked facts are marked stale.
- `errors` and `file_diffs.status=error` identify per-file failures.

## 5. Conflict Review Workflow

1. Open `/conflicts`.
2. Inspect candidates and provenance for each conflict.
3. Resolve (`action=resolve`) or escalate (`action=escalate`) as needed.
4. Optionally create a reusable rule from manual resolution.
5. Audit and prune rules through `GET /rules` and `DELETE /rules/{rule_id}`.

Escalation example:

```bash
curl -sS -X POST http://localhost:8000/conflicts/<conflict_id>/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "action":"escalate",
    "actor":"ops-user",
    "assigned_to":"data-steward",
    "priority":"high",
    "escalation_reason":"source disagreement needs manual verification"
  }' | python3 -m json.tool
```

## 6. Fact Edit Workflow

1. Open `/fs` and locate a fact.
2. Edit `object_value` and/or `status`.
3. Confirm persistence via fact detail (`audit_trail`).

API example:

```bash
curl -sS -X PATCH http://localhost:8000/facts/<fact_id> \
  -H "Content-Type: application/json" \
  -d '{
    "object_value":"Updated Value",
    "status":"active",
    "actor":"analyst",
    "reason":"Verified from latest policy"
  }' | python3 -m json.tool
```

## 7. Retrieval Workflow

```bash
curl -sS -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "text":"Who owns IT asset policy updates?",
    "limit":20
  }' | python3 -m json.tool
```

The response includes ranked hits with provenance, retrieval score, and staleness flags.

## 8. Optional API Key Mode

Set backend key before starting API:

```bash
export CONTEXTOS_API_KEY="replace-me"
```

Then include `X-Api-Key` for protected endpoints:

- `POST /ingest/upload`
- `GET /facts/{fact_id}/neighbors`
- `GET /graph/stats`
