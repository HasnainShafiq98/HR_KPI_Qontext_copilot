from __future__ import annotations

from datetime import datetime, timezone

from contextos.domain.models import ConflictStatus, FactStatus, Namespace, ResolutionRule
from contextos.storage.repository import InMemoryRepository


class ConflictEngine:
    SOURCE_AUTHORITY_RANK = {
        "hrms": 100,
        "hr": 90,
        "policy_docs": 85,
        "itsm": 75,
        "crm": 70,
        "github": 65,
        "collaboration": 50,
        "mail": 40,
        "email": 40,
        "qontext": 30,
    }

    def __init__(self, repo: InMemoryRepository) -> None:
        self.repo = repo

    def list_open(self):
        return [c for c in self.repo.conflicts.values() if c.status == ConflictStatus.OPEN]

    def auto_resolve(self, conflict_id: str) -> tuple[bool, str | None]:
        conflict = self.repo.conflicts[conflict_id]
        candidates = [self.repo.facts[fact_id] for fact_id in conflict.candidate_fact_ids if fact_id in self.repo.facts]
        if len(candidates) < 2:
            return False, None

        resolved_fact_id = self._resolve_by_rule(candidates)
        if resolved_fact_id:
            self._apply_resolution(conflict_id, resolved_fact_id, auto_resolved=True, strategy="rule")
            return True, "rule"

        namespace = candidates[0].namespace
        if namespace in (Namespace.STATIC, Namespace.PROCEDURAL):
            resolved_fact_id = self._resolve_by_authority(candidates)
            if resolved_fact_id:
                self._apply_resolution(conflict_id, resolved_fact_id, auto_resolved=True, strategy="authority")
                return True, "authority"

        if namespace == Namespace.TRAJECTORY:
            resolved_fact_id = self._resolve_by_recency(candidates)
            if resolved_fact_id:
                self._apply_resolution(conflict_id, resolved_fact_id, auto_resolved=True, strategy="recency")
                return True, "recency"

        return False, None

    def resolve(self, conflict_id: str, selected_fact_id: str, create_rule: bool, rule_name: str | None):
        self._apply_resolution(
            conflict_id=conflict_id,
            selected_fact_id=selected_fact_id,
            auto_resolved=False,
            strategy="manual",
        )

        created_rule = None
        if create_rule:
            selected = self.repo.facts[selected_fact_id]
            selected_source = self._source_system_for_fact(selected)
            created_rule = ResolutionRule(
                name=rule_name or "manual-resolution-rule",
                namespace=Namespace(selected.namespace),
                predicate=selected.predicate,
                preferred_source_system=selected_source,
                strategy="prefer_source_system",
            )
            self.repo.add_rule(created_rule)

        return self.repo.conflicts[conflict_id], created_rule

    def _apply_resolution(
        self,
        conflict_id: str,
        selected_fact_id: str,
        auto_resolved: bool,
        strategy: str,
    ) -> None:
        conflict = self.repo.conflicts[conflict_id]
        for fact_id in conflict.candidate_fact_ids:
            fact = self.repo.facts[fact_id]
            fact.status = FactStatus.ACTIVE if fact_id == selected_fact_id else FactStatus.STALE

        conflict.status = ConflictStatus.RESOLVED
        conflict.resolved_fact_id = selected_fact_id
        conflict.auto_resolved = auto_resolved
        conflict.resolution_strategy = strategy
        self.repo.save()

    def _resolve_by_rule(self, candidates) -> str | None:
        if not candidates:
            return None
        namespace = candidates[0].namespace
        predicate = candidates[0].predicate

        matching_rules = [
            rule
            for rule in self.repo.rules.values()
            if (rule.namespace is None or rule.namespace == namespace)
            and (rule.predicate is None or rule.predicate == predicate)
            and rule.strategy == "prefer_source_system"
            and rule.preferred_source_system
        ]

        for rule in matching_rules:
            matches = [
                fact.id for fact in candidates if self._source_system_for_fact(fact) == rule.preferred_source_system
            ]
            if len(matches) == 1:
                return matches[0]
        return None

    def _resolve_by_authority(self, candidates) -> str | None:
        ranked = []
        for fact in candidates:
            source = self._source_system_for_fact(fact)
            ranked.append((self.SOURCE_AUTHORITY_RANK.get(source, 0), fact.id))

        ranked.sort(reverse=True)
        if not ranked or (len(ranked) > 1 and ranked[0][0] == ranked[1][0]):
            return None
        return ranked[0][1]

    def _resolve_by_recency(self, candidates) -> str | None:
        scored = []
        for fact in candidates:
            scored.append((self._observed_at_for_fact(fact).timestamp(), fact.id))

        scored.sort(reverse=True)
        if not scored or (len(scored) > 1 and scored[0][0] == scored[1][0]):
            return None
        return scored[0][1]

    def _source_system_for_fact(self, fact) -> str:
        if not fact.source_record_ids:
            return "unknown"
        source = self.repo.sources.get(fact.source_record_ids[-1])
        if not source:
            return "unknown"
        return source.source_system.lower()

    def _observed_at_for_fact(self, fact) -> datetime:
        if not fact.source_record_ids:
            return datetime.fromtimestamp(0, tz=timezone.utc)
        source = self.repo.sources.get(fact.source_record_ids[-1])
        if not source:
            return datetime.fromtimestamp(0, tz=timezone.utc)
        return source.observed_at
