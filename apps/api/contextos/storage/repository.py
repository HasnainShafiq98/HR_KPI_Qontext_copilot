from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import json

from contextos.domain.models import Conflict, Fact, ResolutionRule, SourceRecord


class InMemoryRepository:
    def __init__(self, persist_path: str | None = None) -> None:
        self.persist_path = Path(persist_path) if persist_path else None
        self.sources: dict[str, SourceRecord] = {}
        self.facts: dict[str, Fact] = {}
        self.conflicts: dict[str, Conflict] = {}
        self.rules: dict[str, ResolutionRule] = {}
        self.path_index: dict[str, list[str]] = defaultdict(list)
        self.file_signatures: dict[str, int] = {}
        if self.persist_path:
            self._load()

    def add_source(self, source: SourceRecord) -> None:
        self.sources[source.id] = source
        self.save()

    def add_fact(self, fact: Fact) -> None:
        self.facts[fact.id] = fact
        self.path_index[fact.path].append(fact.id)
        self.save()

    def add_conflict(self, conflict: Conflict) -> None:
        self.conflicts[conflict.id] = conflict
        self.save()

    def add_rule(self, rule: ResolutionRule) -> None:
        self.rules[rule.id] = rule
        self.save()

    def set_file_signature(self, file_path: str, signature: int) -> None:
        self.file_signatures[file_path] = signature
        self.save()

    def get_file_signature(self, file_path: str) -> int | None:
        return self.file_signatures.get(file_path)

    def save(self) -> None:
        if not self.persist_path:
            return
        self.persist_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "sources": {k: v.model_dump(mode="json") for k, v in self.sources.items()},
            "facts": {k: v.model_dump(mode="json") for k, v in self.facts.items()},
            "conflicts": {k: v.model_dump(mode="json") for k, v in self.conflicts.items()},
            "rules": {k: v.model_dump(mode="json") for k, v in self.rules.items()},
            "path_index": {k: v for k, v in self.path_index.items()},
            "file_signatures": self.file_signatures,
        }
        self.persist_path.write_text(json.dumps(data), encoding="utf-8")

    def _load(self) -> None:
        if not self.persist_path or not self.persist_path.exists():
            return
        raw = json.loads(self.persist_path.read_text(encoding="utf-8"))
        self.sources = {k: SourceRecord(**v) for k, v in raw.get("sources", {}).items()}
        self.facts = {k: Fact(**v) for k, v in raw.get("facts", {}).items()}
        self.conflicts = {k: Conflict(**v) for k, v in raw.get("conflicts", {}).items()}
        self.rules = {k: ResolutionRule(**v) for k, v in raw.get("rules", {}).items()}
        self.path_index = defaultdict(list, raw.get("path_index", {}))
        self.file_signatures = {k: int(v) for k, v in raw.get("file_signatures", {}).items()}
