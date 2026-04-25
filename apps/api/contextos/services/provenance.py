from __future__ import annotations

from contextos.storage.repository import InMemoryRepository


class ProvenanceService:
    def __init__(self, repo: InMemoryRepository) -> None:
        self.repo = repo

    def get_fact_lineage(self, fact_id: str):
        fact = self.repo.facts[fact_id]
        return [self.repo.sources[src_id] for src_id in fact.source_record_ids if src_id in self.repo.sources]
