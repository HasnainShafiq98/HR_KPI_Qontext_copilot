from fastapi import APIRouter, HTTPException

from contextos.core.container import container
from contextos.domain.models import SourceRecord
from contextos.domain.schemas import (
    DatasetIngestRequest,
    DatasetIngestResponse,
    IngestRequest,
    IngestResponse,
    QueryRequest,
    ResolveConflictRequest,
    SyncDatasetRequest,
    SyncDatasetResponse,
)

router = APIRouter()


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
    return {"status": "ok", "service": "contextos-api"}


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


@router.post('/sync/dataset', response_model=SyncDatasetResponse)
def sync_dataset(payload: SyncDatasetRequest):
    summary = container.dataset_ingestion.sync_dataset(
        root_path=payload.root_path,
        include_extensions=payload.include_extensions,
        max_files=payload.max_files,
        max_records_per_file=payload.max_records_per_file,
    )
    return SyncDatasetResponse(**summary)


@router.get('/facts')
def list_facts(namespace: str | None = None, subject: str | None = None, predicate: str | None = None):
    facts = list(container.repo.facts.values())
    if namespace:
        facts = [f for f in facts if f.namespace.value == namespace]
    if subject:
        facts = [f for f in facts if f.subject == subject]
    if predicate:
        facts = [f for f in facts if f.predicate == predicate]
    return [_serialize_fact(f) for f in facts]


@router.get('/facts/paged')
def list_facts_paged(
    namespace: str | None = None,
    subject: str | None = None,
    predicate: str | None = None,
    offset: int = 0,
    limit: int = 200,
):
    facts = list(container.repo.facts.values())
    if namespace:
        facts = [f for f in facts if f.namespace.value == namespace]
    if subject:
        facts = [f for f in facts if f.subject == subject]
    if predicate:
        facts = [f for f in facts if f.predicate == predicate]

    total = len(facts)
    sliced = facts[offset : offset + max(1, min(limit, 5000))]
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

    return {"fact": _serialize_fact(fact), "provenance": provenance, "linked_facts": [_serialize_fact(f) for f in linked]}


@router.get('/conflicts')
def list_conflicts(include_candidates: bool = False):
    conflicts = container.conflicts.list_open()
    if not include_candidates:
        return conflicts

    result = []
    for conflict in conflicts:
        payload = conflict.model_dump()
        payload["candidate_facts"] = [
            _serialize_fact(container.repo.facts[fact_id])
            for fact_id in conflict.candidate_fact_ids
            if fact_id in container.repo.facts
        ]
        result.append(payload)
    return result


@router.post('/conflicts/{conflict_id}/resolve')
def resolve_conflict(conflict_id: str, request: ResolveConflictRequest):
    if conflict_id not in container.repo.conflicts:
        raise HTTPException(status_code=404, detail='conflict not found')

    conflict, rule = container.conflicts.resolve(
        conflict_id=conflict_id,
        selected_fact_id=request.selected_fact_id,
        create_rule=request.create_rule,
        rule_name=request.rule_name,
    )
    return {"conflict": conflict, "created_rule": rule}


@router.get('/rules')
def list_rules():
    return list(container.repo.rules.values())


@router.post('/query')
def query(request: QueryRequest):
    results = container.retrieval.query(
        text=request.text,
        namespace=request.namespace,
        subject=request.subject,
        predicate=request.predicate,
    )
    return {"count": len(results), "hits": results}


@router.get('/metrics/context-health')
def context_health():
    return container.metrics.context_health()


@router.get('/metrics/ingestion-progress')
def ingestion_progress():
    return container.metrics.ingestion_progress()
