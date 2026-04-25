from datetime import datetime, timedelta, timezone

from contextos.domain.models import ConflictStatus, SourceRecord
from contextos.services.conflict_engine import ConflictEngine
from contextos.services.ingestion import IngestionService
from contextos.storage.repository import InMemoryRepository


def _build_services():
    repo = InMemoryRepository()
    conflict_engine = ConflictEngine(repo)
    ingestion = IngestionService(repo, conflict_engine)
    return repo, conflict_engine, ingestion


def test_auto_resolve_by_authority_for_static_conflict():
    repo, _, ingestion = _build_services()

    ingestion.ingest(
        SourceRecord(
            source_system="mail",
            source_type="hr",
            source_uri="mail://thread/1",
            payload={"entity": "emp_1", "title": "Senior Analyst"},
        )
    )
    ingestion.ingest(
        SourceRecord(
            source_system="hrms",
            source_type="hr",
            source_uri="hrms://employee/1",
            payload={"entity": "emp_1", "title": "Director"},
        )
    )

    assert len(repo.conflicts) == 1
    conflict = next(iter(repo.conflicts.values()))
    assert conflict.status == ConflictStatus.RESOLVED
    assert conflict.auto_resolved is True
    assert conflict.resolution_strategy == "authority"

    facts = [f for f in repo.facts.values() if f.subject == "emp_1" and f.predicate == "title"]
    winning = next(f for f in facts if f.id == conflict.resolved_fact_id)
    assert winning.object_value == "Director"


def test_auto_resolve_by_recency_for_trajectory_conflict():
    repo, _, ingestion = _build_services()

    older = datetime.now(timezone.utc) - timedelta(days=2)
    newer = datetime.now(timezone.utc)

    ingestion.ingest(
        SourceRecord(
            source_system="mail",
            source_type="email",
            source_uri="mail://thread/task-1-old",
            observed_at=older,
            payload={"entity": "task_1", "status": "in_progress"},
        )
    )
    ingestion.ingest(
        SourceRecord(
            source_system="mail",
            source_type="email",
            source_uri="mail://thread/task-1-new",
            observed_at=newer,
            payload={"entity": "task_1", "status": "done"},
        )
    )

    conflict = next(iter(repo.conflicts.values()))
    assert conflict.status == ConflictStatus.RESOLVED
    assert conflict.auto_resolved is True
    assert conflict.resolution_strategy == "recency"

    resolved = repo.facts[conflict.resolved_fact_id]
    assert resolved.object_value == "done"


def test_learned_manual_rule_gets_reused():
    repo, conflict_engine, ingestion = _build_services()

    ingestion.ingest(
        SourceRecord(
            source_system="hrms",
            source_type="hr",
            source_uri="hrms://employee/20",
            payload={"entity": "emp_20", "department": "Engineering"},
        )
    )
    ingestion.ingest(
        SourceRecord(
            source_system="crm",
            source_type="crm",
            source_uri="crm://employee/20",
            payload={"entity": "emp_20", "department": "Product"},
        )
    )

    first_conflict = next(iter(repo.conflicts.values()))
    crm_fact = next(
        f.id
        for f in repo.facts.values()
        if f.subject == "emp_20" and f.predicate == "department" and f.object_value == "Product"
    )
    conflict_engine.resolve(
        conflict_id=first_conflict.id,
        selected_fact_id=crm_fact,
        create_rule=True,
        rule_name="prefer-crm-department",
    )

    ingestion.ingest(
        SourceRecord(
            source_system="hrms",
            source_type="hr",
            source_uri="hrms://employee/21",
            payload={"entity": "emp_21", "department": "Finance"},
        )
    )
    ingestion.ingest(
        SourceRecord(
            source_system="crm",
            source_type="crm",
            source_uri="crm://employee/21",
            payload={"entity": "emp_21", "department": "Growth"},
        )
    )

    second_conflict = sorted(repo.conflicts.values(), key=lambda c: c.created_at)[-1]
    assert second_conflict.status == ConflictStatus.RESOLVED
    assert second_conflict.auto_resolved is True
    assert second_conflict.resolution_strategy == "rule"
    assert repo.facts[second_conflict.resolved_fact_id].object_value == "Growth"
