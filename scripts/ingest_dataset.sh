#!/usr/bin/env bash
set -euo pipefail

API_URL="${1:-http://localhost:8000}"
ROOT_PATH="${2:-data/Dataset}"
SAMPLE_SIZE="${SAMPLE_SIZE:-45}"

# Build optional seed fragment — omit the key entirely when SAMPLE_SEED is unset
if [ -n "${SAMPLE_SEED:-}" ]; then
  SEED_FRAGMENT=",\"sample_seed\":${SAMPLE_SEED}"
else
  SEED_FRAGMENT=""
fi

curl -sS -X POST "${API_URL}/ingest/dataset" \
  -H 'Content-Type: application/json' \
  -d "{\"root_path\":\"${ROOT_PATH}\",\"include_extensions\":[\"json\",\"csv\",\"pdf\"],\"sample_records_per_file\":${SAMPLE_SIZE}${SEED_FRAGMENT}}" \
  | python3 -m json.tool
