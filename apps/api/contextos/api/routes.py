from fastapi import APIRouter, HTTPException

from contextos.core.container import container
from contextos.domain.models import SourceRecord
from contextos.domain.schemas import IngestRequest, IngestResponse, QueryRequest, ResolveConflictRequest

router = APIRouter()


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


@router.get('/facts')
def list_facts(namespace: str | None = None, subject: str | None = None, predicate: str | None = None):
    facts = list(container.repo.facts.values())
    if namespace:
        facts = [f for f in facts if f.namespace.value == namespace]
    if subject:
        facts = [f for f in facts if f.subject == subject]
    if predicate:
        facts = [f for f in facts if f.predicate == predicate]
    return facts


@router.get('/facts/{fact_id}')
def get_fact(fact_id: str):
    fact = container.repo.facts.get(fact_id)
    if not fact:
        raise HTTPException(status_code=404, detail='fact not found')

    provenance = container.provenance.get_fact_lineage(fact_id)
    linked = [container.repo.facts[fid] for fid in fact.linked_fact_ids if fid in container.repo.facts]

    return {"fact": fact, "provenance": provenance, "linked_facts": linked}


@router.get('/conflicts')
def list_conflicts():
    return container.conflicts.list_open()


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
