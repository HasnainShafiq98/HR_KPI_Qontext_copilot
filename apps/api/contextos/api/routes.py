import os
import shutil
import tempfile
from collections import deque
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Security, UploadFile
from fastapi.security.api_key import APIKeyHeader

from contextos.core.container import container
from contextos.domain.models import FactAuditEntry, SourceRecord
from contextos.domain.schemas import (
    ConflictListResponse,
    CreateRuleRequest,
    DatasetIngestRequest,
    DatasetIngestResponse,
    IngestRequest,
    IngestResponse,
    QueryRequest,
    ResolveConflictRequest,
    SyncDatasetRequest,
    SyncDatasetResponse,
    UpdateFactRequest,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Optional API-key auth — set CONTEXTOS_API_KEY env var to enable.
# Left open by default so the demo works without configuration.
# ---------------------------------------------------------------------------
_API_KEY_HEADER = APIKeyHeader(name="X-Api-Key", auto_error=False)
_REQUIRED_KEY = os.environ.get("CONTEXTOS_API_KEY", "")


def _check_api_key(api_key: str | None = Security(_API_KEY_HEADER)) -> None:
    """Dependency: validates API key when CONTEXTOS_API_KEY env var is set."""
    if _REQUIRED_KEY and api_key != _REQUIRED_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _source_system_for_fact(fact):
    if not fact.source_record_ids:
        return "unknown"
    source = container.repo.sources.get(fact.source_record_ids[-1])
    if not source:
        return "unknown"
    return source.source_system


def _serialize_fact(fact):
    payload = fact.model_dump()
    payload["source_system"] = _source_system_for_fact(fact)
    return payload


@router.get('/health')
def health():
    return {
        "status": "ok",
        "service": "contextos-api",
        "state_integrity": container.repo.integrity_report,
    }


@router.post('/ingest', response_model=IngestResponse)
def ingest(payload: IngestRequest):
    source = SourceRecord(**payload.model_dump())
    facts, conflicts = container.ingestion.ingest(source)
    return IngestResponse(
        source_record_id=source.id,
        facts_created=len(facts),
        conflicts_created=len(conflicts),
    )


@router.post('/ingest/dataset', response_model=DatasetIngestResponse)
def ingest_dataset(payload: DatasetIngestRequest):
    summary = container.dataset_ingestion.ingest_dataset(
        root_path=payload.root_path,
        include_extensions=payload.include_extensions,
        max_files=payload.max_files,
        max_records_per_file=payload.max_records_per_file,
    )
    return DatasetIngestResponse(**summary)


@router.post('/ingest/upload', response_model=DatasetIngestResponse)
async def ingest_upload(
    files: list[UploadFile] = File(...),
    _: None = Depends(_check_api_key),
):
    """Upload one or more JSON / CSV / PDF files and ingest them immediately.

    Files are written to a temporary directory, processed by the dataset
    ingestion pipeline, and the temp directory is removed afterwards.
    """
    ALLOWED = {"json", "csv", "pdf"}
    tmp_dir = tempfile.mkdtemp(prefix="contextos_upload_")
    try:
        saved: list[str] = []
        for upload in files:
            filename = upload.filename or "upload"
            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            if ext not in ALLOWED:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type: {filename!r}. Allowed: json, csv, pdf",
                )
            dest = os.path.join(tmp_dir, filename)
            with open(dest, "wb") as fh:
                content = await upload.read()
                fh.write(content)
            saved.append(dest)

        if not saved:
            raise HTTPException(status_code=400, detail="No files were uploaded")

        summary = container.dataset_ingestion.ingest_dataset(
            root_path=tmp_dir,
            include_extensions=list(ALLOWED),
        )
        # Replace the temp path in the response so the UI shows the original filenames
        summary["root_path"] = "uploaded files"
        return DatasetIngestResponse(**summary)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post('/sync/dataset', response_model=SyncDatasetResponse)
def sync_dataset(payload: SyncDatasetRequest):
    summary = container.dataset_ingestion.sync_dataset(
        root_path=payload.root_path,
        include_extensions=payload.include_extensions,
        max_files=payload.max_files,
        max_records_per_file=payload.max_records_per_file,
        dry_run=payload.dry_run,
    )
    return SyncDatasetResponse(**summary)


@router.get('/facts')
def list_facts(
    namespace: str | None = None,
    subject: str | None = None,
    predicate: str | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=1000),
):
    facts = list(container.repo.facts.values())
    if namespace:
        facts = [f for f in facts if f.namespace.value == namespace]
    if subject:
        facts = [f for f in facts if f.subject == subject]
    if predicate:
        facts = [f for f in facts if f.predicate == predicate]
    sliced = facts[offset : offset + limit]
    return [_serialize_fact(f) for f in sliced]


@router.get('/facts/paged')
def list_facts_paged(
    namespace: str | None = None,
    subject: str | None = None,
    predicate: str | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=1000),
):
    facts = list(container.repo.facts.values())
    if namespace:
        facts = [f for f in facts if f.namespace.value == namespace]
    if subject:
        facts = [f for f in facts if f.subject == subject]
    if predicate:
        facts = [f for f in facts if f.predicate == predicate]

    total = len(facts)
    sliced = facts[offset : offset + limit]
    return {
        "items": [_serialize_fact(f) for f in sliced],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.get('/facts/{fact_id}')
def get_fact(fact_id: str):
    fact = container.repo.facts.get(fact_id)
    if not fact:
        raise HTTPException(status_code=404, detail='fact not found')

    provenance = container.provenance.get_fact_lineage(fact_id)
    linked = [container.repo.facts[fid] for fid in fact.linked_fact_ids if fid in container.repo.facts]

    return {
        "fact": _serialize_fact(fact),
        "provenance": provenance,
        "linked_facts": [_serialize_fact(f) for f in linked],
        "audit_trail": [entry.model_dump(mode="json") for entry in container.repo.get_fact_audit(fact_id)],
    }


@router.patch('/facts/{fact_id}')
def update_fact(fact_id: str, payload: UpdateFactRequest):
    fact = container.repo.facts.get(fact_id)
    if not fact:
        raise HTTPException(status_code=404, detail='fact not found')

    if payload.object_value is None and payload.status is None:
        raise HTTPException(status_code=400, detail='at least one field must be updated')

    previous_value = fact.object_value
    previous_status = fact.status

    if payload.object_value is not None:
        fact.object_value = payload.object_value
    if payload.status is not None:
        fact.status = payload.status
    fact.updated_at = datetime.now(timezone.utc)
    container.repo.save()

    audit_entry = FactAuditEntry(
        fact_id=fact_id,
        action="manual_edit",
        actor=payload.actor or "user",
        reason=payload.reason,
        previous_value=previous_value,
        new_value=fact.object_value,
        previous_status=previous_status,
        new_status=fact.status,
    )
    container.repo.add_fact_audit(audit_entry)

    return {
        "fact": _serialize_fact(fact),
        "audit_entry": audit_entry.model_dump(mode="json"),
    }


@router.get('/conflicts', response_model=ConflictListResponse)
def list_conflicts(
    include_candidates: bool = False,
    statuses: str = "open,escalated",
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=1000),
):
    requested_statuses = set()
    for raw in [value.strip().lower() for value in statuses.split(",") if value.strip()]:
        if raw == "open":
            requested_statuses.add("open")
        elif raw == "escalated":
            requested_statuses.add("escalated")
        elif raw == "resolved":
            requested_statuses.add("resolved")
    if not requested_statuses:
        requested_statuses = {"open", "escalated"}

    filtered_conflicts = [c for c in container.repo.conflicts.values() if c.status.value in requested_statuses]
    all_conflicts = sorted(filtered_conflicts, key=lambda c: c.created_at, reverse=True)
    conflicts = all_conflicts[offset : offset + limit]

    if not include_candidates:
        return {
            "items": [conflict.model_dump(mode="json") for conflict in conflicts],
            "total": len(all_conflicts),
            "offset": offset,
            "limit": limit,
            "statuses": sorted(requested_statuses),
        }

    result = []
    for conflict in conflicts:
        payload = conflict.model_dump()
        payload["candidate_facts"] = [
            _serialize_fact(container.repo.facts[fact_id])
            for fact_id in conflict.candidate_fact_ids
            if fact_id in container.repo.facts
        ]
        result.append(payload)
    return {
        "items": result,
        "total": len(all_conflicts),
        "offset": offset,
        "limit": limit,
        "statuses": sorted(requested_statuses),
    }


@router.post('/conflicts/{conflict_id}/resolve')
def resolve_conflict(conflict_id: str, request: ResolveConflictRequest):
    if conflict_id not in container.repo.conflicts:
        raise HTTPException(status_code=404, detail='conflict not found')

    action = request.action.lower().strip()
    if action == "escalate":
        conflict = container.conflicts.escalate(
            conflict_id=conflict_id,
            actor=request.actor,
            reason=request.escalation_reason,
            assigned_to=request.assigned_to,
            priority=request.priority,
        )
        return {"conflict": conflict, "created_rule": None}

    if not request.selected_fact_id:
        raise HTTPException(status_code=400, detail='selected_fact_id is required for resolve action')

    conflict, rule = container.conflicts.resolve(
        conflict_id=conflict_id,
        selected_fact_id=request.selected_fact_id,
        create_rule=request.create_rule,
        rule_name=request.rule_name,
    )
    return {"conflict": conflict, "created_rule": rule}


@router.get('/rules')
def list_rules(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=1000),
):
    all_rules = list(container.repo.rules.values())
    items = all_rules[offset : offset + limit]
    return {
        "items": [rule.model_dump(mode="json") for rule in items],
        "total": len(all_rules),
        "offset": offset,
        "limit": limit,
    }


@router.post('/rules')
def create_rule(payload: CreateRuleRequest):
    rule = container.conflicts.create_rule(
        name=payload.name,
        namespace=payload.namespace,
        predicate=payload.predicate,
        preferred_source_system=payload.preferred_source_system,
        strategy=payload.strategy,
    )
    return rule.model_dump(mode="json")


@router.delete('/rules/{rule_id}')
def delete_rule(rule_id: str):
    if rule_id not in container.repo.rules:
        raise HTTPException(status_code=404, detail='rule not found')
    container.repo.remove_rule(rule_id)
    return {"deleted": True, "rule_id": rule_id}


@router.post('/query')
def query(request: QueryRequest):
    results = container.retrieval.query(
        text=request.text,
        namespace=request.namespace,
        subject=request.subject,
        predicate=request.predicate,
    )[: request.limit]
    return {"count": len(results), "hits": results}


@router.get('/metrics/context-health')
def context_health():
    return container.metrics.context_health()


@router.get('/metrics/ingestion-progress')
def ingestion_progress():
    return container.metrics.ingestion_progress()


# ---------------------------------------------------------------------------
# Graph traversal endpoints
# ---------------------------------------------------------------------------

@router.get('/facts/{fact_id}/neighbors')
def get_fact_neighbors(
    fact_id: str,
    depth: int = Query(default=1, ge=1, le=4),
    _: None = Depends(_check_api_key),
):
    """BFS traversal of the linked-fact graph starting from `fact_id`.

    Returns all reachable facts within `depth` hops, with an edge list for
    rendering in the knowledge-graph view.
    """
    root = container.repo.facts.get(fact_id)
    if not root:
        raise HTTPException(status_code=404, detail='fact not found')

    visited: dict[str, int] = {fact_id: 0}  # fact_id -> hop distance
    queue: deque[tuple[str, int]] = deque([(fact_id, 0)])
    edges: list[dict] = []

    while queue:
        current_id, current_depth = queue.popleft()
        if current_depth >= depth:
            continue
        current_fact = container.repo.facts.get(current_id)
        if not current_fact:
            continue
        for linked_id in current_fact.linked_fact_ids:
            if linked_id not in container.repo.facts:
                continue
            if linked_id not in visited:
                visited[linked_id] = current_depth + 1
                queue.append((linked_id, current_depth + 1))
            edges.append({"source": current_id, "target": linked_id, "depth": current_depth + 1})

    nodes = [
        {"fact": _serialize_fact(container.repo.facts[fid]), "hop": hop}
        for fid, hop in visited.items()
        if fid in container.repo.facts
    ]
    return {
        "root_fact_id": fact_id,
        "depth": depth,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "nodes": nodes,
        "edges": edges,
    }


@router.get('/graph/stats')
def graph_stats(_: None = Depends(_check_api_key)):
    """Summary statistics about the knowledge graph structure."""
    facts = list(container.repo.facts.values())
    total_links = sum(len(f.linked_fact_ids) for f in facts)
    connected = sum(1 for f in facts if f.linked_fact_ids)
    subjects = {f.subject for f in facts}
    predicates = {f.predicate for f in facts}
    namespace_dist: dict[str, int] = {}
    for f in facts:
        namespace_dist[f.namespace.value] = namespace_dist.get(f.namespace.value, 0) + 1
    return {
        "total_facts": len(facts),
        "total_links": total_links,
        "connected_facts": connected,
        "isolated_facts": len(facts) - connected,
        "unique_subjects": len(subjects),
        "unique_predicates": len(predicates),
        "namespace_distribution": namespace_dist,
        "avg_links_per_fact": round(total_links / max(len(facts), 1), 2),
    }
