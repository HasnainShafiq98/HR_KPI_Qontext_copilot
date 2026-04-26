.PHONY: api-install api-run api-test web-run sample-ingest dataset-ingest dataset-ingest-full

api-install:
	cd apps/api && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

api-run:
	cd apps/api && . .venv/bin/activate && uvicorn contextos.api.main:app --reload --port 8000

api-test:
	cd apps/api && . .venv/bin/activate && pytest -q

web-run:
	cd apps/web && python3 -m http.server 8080

sample-ingest:
	./scripts/bootstrap_sample_data.sh

dataset-ingest:
	curl -sS -X POST "http://localhost:8000/ingest/dataset" \
	  -H 'Content-Type: application/json' \
	  -d '{"root_path":"data/Dataset","include_extensions":["json","csv","pdf"],"sample_records_per_file":45,"sample_seed":42}' | python3 -m json.tool

dataset-ingest-full:
	curl -sS -X POST "http://localhost:8000/ingest/dataset" \
	  -H 'Content-Type: application/json' \
	  -d '{"root_path":"data/Dataset","include_extensions":["json","csv","pdf"],"sample_records_per_file":null}' | python3 -m json.tool
