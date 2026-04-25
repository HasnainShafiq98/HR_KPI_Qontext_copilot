#!/usr/bin/env bash
set -euo pipefail

API_URL="${1:-http://localhost:8000}"

curl -sS -X POST "${API_URL}/ingest" \
  -H 'Content-Type: application/json' \
  -d '{
    "source_system": "qontext",
    "source_type": "hr",
    "source_uri": "qontext://hr/employee/123",
    "payload": {
      "entity": "employee_123",
      "name": "Asha Patel",
      "title": "Senior Analyst",
      "department": "Finance"
    }
  }'

echo

curl -sS -X POST "${API_URL}/ingest" \
  -H 'Content-Type: application/json' \
  -d '{
    "source_system": "email",
    "source_type": "email",
    "source_uri": "mail://thread/abc",
    "payload": {
      "entity": "employee_123",
      "title": "Lead Analyst"
    }
  }'

echo

curl -sS "${API_URL}/conflicts"
echo
