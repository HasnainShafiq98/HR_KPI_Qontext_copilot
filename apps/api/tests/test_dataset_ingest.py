import json
from pathlib import Path

from fastapi.testclient import TestClient

from contextos.api.main import app


def test_dataset_ingest_endpoint(tmp_path: Path):
    sample_file = tmp_path / "employees.json"
    sample_file.write_text(
        json.dumps(
            [
                {"emp_id": "emp_1", "Name": "Asha", "Level": "EN10"},
                {"emp_id": "emp_2", "Name": "Ravi", "Level": "EN11"},
            ]
        ),
        encoding="utf-8",
    )

    client = TestClient(app)
    response = client.post(
        "/ingest/dataset",
        json={
            "root_path": str(tmp_path),
            "include_extensions": ["json"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["files_processed"] == 1
    assert body["sources_ingested"] == 2
    assert body["facts_created"] > 0
