import json
from pathlib import Path

from fastapi.testclient import TestClient

from contextos.api.main import app
from contextos.core.container import container
from contextos.domain.models import SourceRecord


def setup_function():
    container.repo.sources.clear()
    container.repo.facts.clear()
    container.repo.conflicts.clear()
    container.repo.rules.clear()
    container.repo.fact_audit_log.clear()
    container.repo.path_index.clear()
    container.repo.file_signatures.clear()


def test_fact_edit_flow_and_audit_trail():
    client = TestClient(app)

    container.ingestion.ingest(
        SourceRecord(
            source_system="hrms",
            source_type="hr",
            source_uri="hrms://employee/10",
            payload={"entity": "emp_10", "title": "Engineer"},
        )
    )
    facts = client.get("/facts/paged?limit=10").json()["items"]
    target = next(f for f in facts if f["subject"] == "emp_10" and f["predicate"] == "title")

    patch = client.patch(
        f"/facts/{target['id']}",
        json={
            "object_value": "Senior Engineer",
            "status": "active",
            "actor": "qa-test",
            "reason": "manual correction",
        },
    )
    assert patch.status_code == 200
    assert patch.json()["fact"]["object_value"] == "Senior Engineer"

    detail = client.get(f"/facts/{target['id']}")
    assert detail.status_code == 200
    audit = detail.json()["audit_trail"]
    assert len(audit) >= 1
    assert audit[-1]["actor"] == "qa-test"
    assert audit[-1]["new_value"] == "Senior Engineer"


def test_rules_crud_endpoints():
    client = TestClient(app)

    created = client.post(
        "/rules",
        json={
            "name": "Prefer HR title",
            "namespace": "static",
            "predicate": "title",
            "preferred_source_system": "hrms",
            "strategy": "prefer_source_system",
        },
    )
    assert created.status_code == 200
    rule_id = created.json()["id"]

    rules = client.get("/rules?offset=0&limit=20")
    assert rules.status_code == 200
    payload = rules.json()
    assert payload["total"] >= 1
    assert any(item["id"] == rule_id for item in payload["items"])

    deleted = client.delete(f"/rules/{rule_id}")
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True


def test_sync_dataset_dry_run_and_diff_summary(tmp_path: Path):
    client = TestClient(app)

    dataset_dir = tmp_path / "dataset"
    dataset_dir.mkdir()
    file_path = dataset_dir / "employees.json"
    file_path.write_text(json.dumps([{"entity": "emp_1", "title": "Engineer"}]), encoding="utf-8")

    first_ingest = client.post(
        "/ingest/dataset",
        json={"root_path": str(dataset_dir), "include_extensions": ["json"]},
    )
    assert first_ingest.status_code == 200

    unchanged_dry_run = client.post(
        "/sync/dataset",
        json={"root_path": str(dataset_dir), "include_extensions": ["json"], "dry_run": True},
    )
    assert unchanged_dry_run.status_code == 200
    unchanged_body = unchanged_dry_run.json()
    assert unchanged_body["dry_run"] is True
    assert unchanged_body["files_unchanged"] == 1
    assert unchanged_body["file_diffs"][0]["status"] == "unchanged"

    file_path.write_text(json.dumps([{"entity": "emp_1", "title": "Staff Engineer"}]), encoding="utf-8")

    changed_dry_run = client.post(
        "/sync/dataset",
        json={"root_path": str(dataset_dir), "include_extensions": ["json"], "dry_run": True},
    )
    assert changed_dry_run.status_code == 200
    changed_body = changed_dry_run.json()
    assert changed_body["dry_run"] is True
    assert changed_body["files_changed"] == 1
    assert changed_body["file_diffs"][0]["status"] == "changed"
    assert changed_body["sources_ingested"] == 0

    changed_apply = client.post(
        "/sync/dataset",
        json={"root_path": str(dataset_dir), "include_extensions": ["json"], "dry_run": False},
    )
    assert changed_apply.status_code == 200
    assert changed_apply.json()["sources_ingested"] > 0


def test_conflict_escalation_flow():
    client = TestClient(app)

    container.ingestion.ingest(
        SourceRecord(
            source_system="mail",
            source_type="hr",
            source_uri="mail://1",
            payload={"entity": "emp_40", "title": "Engineer"},
        )
    )
    container.ingestion.ingest(
        SourceRecord(
            source_system="crm",
            source_type="crm",
            source_uri="crm://1",
            payload={"entity": "emp_40", "title": "Senior Engineer"},
        )
    )

    conflicts = client.get("/conflicts?include_candidates=true&statuses=open").json()["items"]
    if not conflicts:
        return
    conflict_id = conflicts[0]["id"]

    escalated = client.post(
        f"/conflicts/{conflict_id}/resolve",
        json={
            "action": "escalate",
            "actor": "qa-test",
            "escalation_reason": "ambiguous",
            "assigned_to": "reviewer",
            "priority": "high",
        },
    )
    assert escalated.status_code == 200
    conflict = escalated.json()["conflict"]
    assert conflict["status"] == "escalated"
    assert conflict["escalated_by"] == "qa-test"
    assert conflict["assigned_to"] == "reviewer"
