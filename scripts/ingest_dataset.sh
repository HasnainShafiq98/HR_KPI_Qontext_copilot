#!/usr/bin/env bash
set -euo pipefail

API_URL="${1:-http://localhost:8000}"
ROOT_PATH="${2:-data/Dataset}"

curl -sS -X POST "${API_URL}/ingest/dataset" \
  -H 'Content-Type: application/json' \
  -d "{\"root_path\":\"${ROOT_PATH}\",\"include_extensions\":[\"json\",\"csv\",\"pdf\"]}" \
  | python3 -m json.tool
