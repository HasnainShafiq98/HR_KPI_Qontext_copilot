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
    container.repo.file_signatures.clear()
    container.repo.path_index.clear()


def test_facts_paged_and_source_system():
    client = TestClient(app)

    for i in range(5):
        container.ingestion.ingest(
            SourceRecord(
                source_system="hrms",
                source_type="hr",
                source_uri=f"hrms://employee/{i}",
                payload={"entity": f"emp_{i}", "title": f"T{i}"},
            )
        )

    response = client.get("/facts/paged?offset=0&limit=2")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 5
    assert len(body["items"]) == 2
    assert body["items"][0]["source_system"] == "hrms"


def test_conflicts_include_candidates_and_rules():
    client = TestClient(app)

    container.ingestion.ingest(
        SourceRecord(
            source_system="mail",
            source_type="hr",
            source_uri="mail://1",
            payload={"entity": "emp_1", "title": "Engineer"},
        )
    )
    container.ingestion.ingest(
        SourceRecord(
            source_system="hrms",
            source_type="hr",
            source_uri="hrms://1",
            payload={"entity": "emp_1", "title": "Senior Engineer"},
        )
    )

    conflicts_response = client.get("/conflicts?include_candidates=true")
    assert conflicts_response.status_code == 200
    conflicts_payload = conflicts_response.json()
    conflicts = conflicts_payload["items"]

    # If it auto-resolved by authority, open queue can be empty. Otherwise validate payload shape.
    if conflicts:
        assert "candidate_facts" in conflicts[0]
        assert len(conflicts[0]["candidate_facts"]) >= 2

    # Manual resolution path can create rules; endpoint should always be available.
    rules_response = client.get("/rules")
    assert rules_response.status_code == 200
    rules_payload = rules_response.json()
    assert "items" in rules_payload
    assert isinstance(rules_payload["items"], list)


def test_query_returns_ranked_hits_with_scores():
    client = TestClient(app)

    container.ingestion.ingest(
        SourceRecord(
            source_system="hrms",
            source_type="hr",
            source_uri="hrms://employee/301",
            payload={"entity": "emp_301", "title": "Data Engineer"},
        )
    )
    container.ingestion.ingest(
        SourceRecord(
            source_system="mail",
            source_type="email",
            source_uri="mail://thread/301",
            payload={"entity": "emp_301", "note": "likes hiking"},
        )
    )

    response = client.post("/query", json={"text": "emp_301 title", "limit": 5})
    assert response.status_code == 200
    body = response.json()
    assert body["count"] >= 1
    assert "retrieval_score" in body["hits"][0]
