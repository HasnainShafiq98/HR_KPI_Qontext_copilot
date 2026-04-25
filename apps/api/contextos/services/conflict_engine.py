from __future__ import annotations

from contextos.domain.models import ConflictStatus, FactStatus, Namespace, ResolutionRule
from contextos.storage.repository import InMemoryRepository


class ConflictEngine:
    def __init__(self, repo: InMemoryRepository) -> None:
        self.repo = repo

    def list_open(self):
        return [c for c in self.repo.conflicts.values() if c.status == ConflictStatus.OPEN]

    def resolve(self, conflict_id: str, selected_fact_id: str, create_rule: bool, rule_name: str | None):
        conflict = self.repo.conflicts[conflict_id]
        for fact_id in conflict.candidate_fact_ids:
            fact = self.repo.facts[fact_id]
            fact.status = FactStatus.ACTIVE if fact_id == selected_fact_id else FactStatus.STALE

        conflict.status = ConflictStatus.RESOLVED
        conflict.resolved_fact_id = selected_fact_id

        created_rule = None
        if create_rule:
            selected = self.repo.facts[selected_fact_id]
            created_rule = ResolutionRule(
                name=rule_name or "manual-resolution-rule",
                namespace=Namespace(selected.namespace),
                predicate=selected.predicate,
                strategy="prefer_selected_candidate",
            )
            self.repo.add_rule(created_rule)

        return conflict, created_rule
