from __future__ import annotations

from collections import defaultdict

from contextos.domain.models import Conflict, Fact, ResolutionRule, SourceRecord


class InMemoryRepository:
    def __init__(self) -> None:
        self.sources: dict[str, SourceRecord] = {}
        self.facts: dict[str, Fact] = {}
        self.conflicts: dict[str, Conflict] = {}
        self.rules: dict[str, ResolutionRule] = {}
        self.path_index: dict[str, list[str]] = defaultdict(list)

    def add_source(self, source: SourceRecord) -> None:
        self.sources[source.id] = source

    def add_fact(self, fact: Fact) -> None:
        self.facts[fact.id] = fact
        self.path_index[fact.path].append(fact.id)

    def add_conflict(self, conflict: Conflict) -> None:
        self.conflicts[conflict.id] = conflict

    def add_rule(self, rule: ResolutionRule) -> None:
        self.rules[rule.id] = rule
