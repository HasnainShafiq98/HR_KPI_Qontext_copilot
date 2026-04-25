import json
from pathlib import Path

from contextos.domain.models import SourceRecord
from contextos.services.conflict_engine import ConflictEngine
from contextos.services.dataset_ingestion import DatasetIngestionService
from contextos.services.ingestion import IngestionService
from contextos.storage.repository import InMemoryRepository


def _build_services(tmp_state: Path):
    repo = InMemoryRepository(persist_path=str(tmp_state))
    conflict_engine = ConflictEngine(repo)
    ingestion = IngestionService(repo, conflict_engine)
    dataset_ingestion = DatasetIngestionService(ingestion)
    return repo, ingestion, dataset_ingestion


def test_duplicate_ingest_dedupes_same_fact(tmp_path: Path):
    state_file = tmp_path / "state.json"
    repo, ingestion, _ = _build_services(state_file)

    source = SourceRecord(
        source_system="hrms",
        source_type="hr",
        source_uri="hrms://employee/1",
        payload={"entity": "emp_1", "title": "Engineer"},
    )
    ingestion.ingest(source)

    source2 = SourceRecord(
        source_system="hrms",
        source_type="hr",
        source_uri="hrms://employee/1",
        payload={"entity": "emp_1", "title": "Engineer"},
    )
    ingestion.ingest(source2)

    facts = [f for f in repo.facts.values() if f.subject == "emp_1" and f.predicate == "title"]
    assert len(facts) == 1
    assert len(facts[0].source_record_ids) == 2


def test_dataset_sync_ingests_only_changed_files(tmp_path: Path):
    dataset_dir = tmp_path / "dataset"
    dataset_dir.mkdir()
    file_path = dataset_dir / "employees.json"
    file_path.write_text(json.dumps([{"entity": "emp_1", "title": "Engineer"}]), encoding="utf-8")

    state_file = tmp_path / "state.json"
    _, _, dataset_ingestion = _build_services(state_file)

    first = dataset_ingestion.ingest_dataset(root_path=str(dataset_dir), include_extensions=["json"])
    assert first["files_processed"] == 1
    assert first["files_changed"] == 1

    second = dataset_ingestion.sync_dataset(root_path=str(dataset_dir), include_extensions=["json"])
    assert second["files_processed"] == 0
    assert second["files_unchanged"] == 1

    file_path.write_text(json.dumps([{"entity": "emp_1", "title": "Senior Engineer"}]), encoding="utf-8")
    third = dataset_ingestion.sync_dataset(root_path=str(dataset_dir), include_extensions=["json"])
    assert third["files_processed"] == 1
    assert third["files_changed"] == 1


def test_repository_persistence_reload(tmp_path: Path):
    state_file = tmp_path / "state.json"
    repo1, ingestion, _ = _build_services(state_file)

    ingestion.ingest(
        SourceRecord(
            source_system="hrms",
            source_type="hr",
            source_uri="hrms://employee/2",
            payload={"entity": "emp_2", "title": "Manager"},
        )
    )

    assert state_file.exists()

    repo2 = InMemoryRepository(persist_path=str(state_file))
    assert len(repo2.facts) >= 1
    assert any(f.subject == "emp_2" for f in repo2.facts.values())
