from __future__ import annotations

from contextos.domain.models import FactStatus, RetrievalHit
from contextos.storage.repository import InMemoryRepository


class RetrievalService:
    def __init__(self, repo: InMemoryRepository) -> None:
        self.repo = repo

    def query(self, text: str, namespace=None, subject=None, predicate=None):
        terms = [t.lower() for t in text.split() if t.strip()]
        hits: list[RetrievalHit] = []

        for fact in self.repo.facts.values():
            if namespace and fact.namespace != namespace:
                continue
            if subject and fact.subject != subject:
                continue
            if predicate and fact.predicate != predicate:
                continue

            haystack = f"{fact.subject} {fact.predicate} {fact.object_value} {fact.path}".lower()
            if terms and not any(term in haystack for term in terms):
                continue

            provenance = [self.repo.sources[sid] for sid in fact.source_record_ids if sid in self.repo.sources]
            hits.append(
                RetrievalHit(
                    fact=fact,
                    staleness_flag=fact.status in {FactStatus.STALE, FactStatus.CONFLICTED},
                    provenance=provenance,
                )
            )

        return sorted(hits, key=lambda h: h.fact.confidence, reverse=True)
