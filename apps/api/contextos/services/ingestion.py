from __future__ import annotations

from contextos.domain.models import Conflict, Fact, FactStatus, Namespace, SourceRecord
from contextos.services.conflict_engine import ConflictEngine
from contextos.storage.repository import InMemoryRepository


class IngestionService:
    def __init__(self, repo: InMemoryRepository, conflict_engine: ConflictEngine) -> None:
        self.repo = repo
        self.conflict_engine = conflict_engine

    def ingest(self, source: SourceRecord) -> tuple[list[Fact], list[Conflict]]:
        self.repo.add_source(source)

        namespace = self._infer_namespace(source.source_type)
        extracted_facts = self._extract_atomic_facts(source, namespace)

        conflicts: list[Conflict] = []
        for fact in extracted_facts:
            existing = self._find_existing(fact.subject, fact.predicate, fact.path)
            self.repo.add_fact(fact)

            if existing and existing.object_value != fact.object_value:
                conflict = Conflict(
                    reason=f"Conflicting values for {fact.subject}.{fact.predicate}",
                    candidate_fact_ids=[existing.id, fact.id],
                )
                self.repo.add_conflict(conflict)
                resolved, _ = self.conflict_engine.auto_resolve(conflict.id)
                if not resolved:
                    existing.status = FactStatus.CONFLICTED
                    fact.status = FactStatus.CONFLICTED
                conflicts.append(conflict)

        return extracted_facts, conflicts

    def _infer_namespace(self, source_type: str) -> Namespace:
        mapping = {
            "hr": Namespace.STATIC,
            "crm": Namespace.STATIC,
            "policy": Namespace.PROCEDURAL,
            "sop": Namespace.PROCEDURAL,
            "ticket": Namespace.TRAJECTORY,
            "project": Namespace.TRAJECTORY,
            "email": Namespace.TRAJECTORY,
        }
        return mapping.get(source_type.lower(), Namespace.TRAJECTORY)

    def _extract_atomic_facts(self, source: SourceRecord, namespace: Namespace) -> list[Fact]:
        # MVP extractor: converts top-level scalar keys into facts.
        # Replace with parser adapters + NER/event extraction in Phase 1.
        facts: list[Fact] = []
        entity = source.payload.get("entity", source.source_type)

        for key, value in source.payload.items():
            if isinstance(value, (str, int, float, bool)):
                path = f"/{namespace.value}/{entity}/{key}"
                facts.append(
                    Fact(
                        namespace=namespace,
                        path=path,
                        subject=str(entity),
                        predicate=str(key),
                        object_value=str(value),
                        confidence=0.7,
                        source_record_ids=[source.id],
                    )
                )

        return facts

    def _find_existing(self, subject: str, predicate: str, path: str) -> Fact | None:
        candidate_ids = self.repo.path_index.get(path, [])
        for fact_id in candidate_ids:
            fact = self.repo.facts[fact_id]
            if fact.subject == subject and fact.predicate == predicate:
                return fact
        return None
