import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from contextos.api.main import app
from contextos.services.conflict_engine import ConflictEngine
from contextos.services.dataset_ingestion import DatasetIngestionService
from contextos.services.ingestion import IngestionService
from contextos.storage.repository import InMemoryRepository


def _make_service() -> DatasetIngestionService:
    repo = InMemoryRepository()
    conflicts = ConflictEngine(repo)
    ingestion = IngestionService(repo, conflicts)
    return DatasetIngestionService(ingestion)


def _write_records(path: Path, n: int) -> Path:
    records = [{"emp_id": f"emp_{i}", "name": f"Person {i}"} for i in range(n)]
    f = path / "data.json"
    f.write_text(json.dumps(records), encoding="utf-8")
    return f


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


def test_sample_records_per_file_caps_records(tmp_path: Path):
    _write_records(tmp_path, 200)
    svc = _make_service()
    result = svc.ingest_dataset(
        root_path=str(tmp_path),
        include_extensions=["json"],
        sample_records_per_file=40,
        sample_seed=1,
    )
    assert result["sources_ingested"] == 40


def test_sample_seed_is_deterministic(tmp_path: Path):
    _write_records(tmp_path, 200)

    def _run(seed):
        svc = _make_service()
        return svc.ingest_dataset(
            root_path=str(tmp_path),
            include_extensions=["json"],
            sample_records_per_file=40,
            sample_seed=seed,
        )

    run_a1 = _run(7)
    run_a2 = _run(7)
    run_b = _run(99)

    # Both seed=7 runs produce the same source count and same fact count
    assert run_a1["sources_ingested"] == run_a2["sources_ingested"] == 40
    assert run_a1["facts_created"] == run_a2["facts_created"]

    # Different seed still samples the right count (200 choose 40 space is huge)
    assert run_b["sources_ingested"] == 40


def test_sample_smaller_than_records_returns_all(tmp_path: Path):
    _write_records(tmp_path, 10)
    svc = _make_service()
    result = svc.ingest_dataset(
        root_path=str(tmp_path),
        include_extensions=["json"],
        sample_records_per_file=40,
        sample_seed=1,
    )
    assert result["sources_ingested"] == 10


def test_pdf_sampling_no_op(tmp_path: Path):
    pdf_file = tmp_path / "policy.pdf"
    pdf_file.write_bytes(b"%PDF-1.4 fake content")
    svc = _make_service()
    result = svc.ingest_dataset(
        root_path=str(tmp_path),
        include_extensions=["pdf"],
        sample_records_per_file=40,
        sample_seed=1,
    )
    assert result["sources_ingested"] == 1


def test_sample_runs_before_max_records_truncation(tmp_path: Path):
    _write_records(tmp_path, 200)
    svc = _make_service()
    result = svc.ingest_dataset(
        root_path=str(tmp_path),
        include_extensions=["json"],
        sample_records_per_file=80,
        max_records_per_file=20,
        sample_seed=1,
    )
    assert result["sources_ingested"] == 20
