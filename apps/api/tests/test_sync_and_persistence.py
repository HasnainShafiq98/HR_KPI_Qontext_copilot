import json
from pathlib import Path
from datetime import datetime, timezone

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


def test_dataset_sync_reconciles_removed_files(tmp_path: Path):
    dataset_dir = tmp_path / "dataset"
    dataset_dir.mkdir()
    file_path = dataset_dir / "employees.json"
    file_path.write_text(json.dumps([{"entity": "emp_7", "title": "Engineer"}]), encoding="utf-8")

    state_file = tmp_path / "state.json"
    repo, _, dataset_ingestion = _build_services(state_file)

    first = dataset_ingestion.ingest_dataset(root_path=str(dataset_dir), include_extensions=["json"])
    assert first["files_processed"] == 1

    file_path.unlink()
    second = dataset_ingestion.sync_dataset(root_path=str(dataset_dir), include_extensions=["json"])

    removed = [row for row in second["file_diffs"] if row["status"] == "removed"]
    assert len(removed) == 1
    assert removed[0]["file"].endswith("employees.json")
    assert any(f.status.value == "stale" for f in repo.facts.values())


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


def test_auto_resolution_not_for_authority_tie(tmp_path: Path):
    repo, ingestion, _ = _build_services(tmp_path / "state-authority-tie.json")
    repo.sources.clear()
    repo.facts.clear()
    repo.conflicts.clear()
    repo.rules.clear()
    repo.path_index.clear()

    ingestion.ingest(
        SourceRecord(
            source_system="custom_a",
            source_type="hr",
            source_uri="custom://employee/9/a",
            payload={"entity": "emp_9", "title": "Engineer"},
        )
    )
    ingestion.ingest(
        SourceRecord(
            source_system="custom_b",
            source_type="hr",
            source_uri="custom://employee/9/b",
            payload={"entity": "emp_9", "title": "Senior Engineer"},
        )
    )

    open_conflicts = [c for c in repo.conflicts.values() if c.status.value == "open"]
    assert len(open_conflicts) == 1


def test_auto_resolution_not_for_recency_tie(tmp_path: Path):
    repo, ingestion, _ = _build_services(tmp_path / "state-recency-tie.json")
    repo.sources.clear()
    repo.facts.clear()
    repo.conflicts.clear()
    repo.rules.clear()
    repo.path_index.clear()

    observed_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    ingestion.ingest(
        SourceRecord(
            source_system="mail",
            source_type="project",
            source_uri="mail://task-5/a",
            observed_at=observed_at,
            payload={"entity": "task_5", "status": "in_progress"},
        )
    )
    ingestion.ingest(
        SourceRecord(
            source_system="collaboration",
            source_type="project",
            source_uri="chat://task-5/b",
            observed_at=observed_at,
            payload={"entity": "task_5", "status": "done"},
        )
    )

    open_conflicts = [c for c in repo.conflicts.values() if c.status.value == "open"]
    assert len(open_conflicts) == 1


def test_repository_integrity_recovery_on_corrupt_state(tmp_path: Path):
    state_file = tmp_path / "corrupt-state.json"
    state_file.write_text("{this is not valid json", encoding="utf-8")

    repo = InMemoryRepository(persist_path=str(state_file))

    assert repo.integrity_report["ok"] is False
    assert repo.integrity_report["backup_path"] is not None
    assert Path(str(repo.integrity_report["backup_path"])).exists()
    assert repo.facts == {}
