"""SQLite-backed repository for ContextOS.

Drop-in replacement for InMemoryRepository. All data is serialised as JSON
and persisted into a lightweight SQLite database.  The schema is intentionally
simple: one ``kv_store`` table keyed by collection name.

Usage (env-driven)::

    CONTEXTOS_STORAGE_BACKEND=sqlite
    CONTEXTOS_STATE_FILE=/path/to/contextos.sqlite

The container will pick the right backend based on the env vars.
"""
from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from pydantic import ValidationError

from contextos.domain.models import Conflict, Fact, FactAuditEntry, ResolutionRule, SourceRecord


_SCHEMA = """
CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


class SqliteRepository:
    """SQLite-backed repository compatible with InMemoryRepository."""

    def __init__(self, db_path: str) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        # In-memory caches
        self.sources: dict[str, SourceRecord] = {}
        self.facts: dict[str, Fact] = {}
        self.conflicts: dict[str, Conflict] = {}
        self.rules: dict[str, ResolutionRule] = {}
        self.fact_audit_log: dict[str, list[FactAuditEntry]] = defaultdict(list)
        self.path_index: dict[str, list[str]] = defaultdict(list)
        self.file_signatures: dict[str, int] = {}
        self.integrity_report: dict[str, str | bool | None] = {
            "ok": True,
            "message": "sqlite state loaded",
            "backup_path": None,
        }

        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.execute(_SCHEMA)
        self._conn.commit()
        self._load()

    # ------------------------------------------------------------------
    # Public mutating API (same surface as InMemoryRepository)
    # ------------------------------------------------------------------

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

    def remove_rule(self, rule_id: str) -> None:
        self.rules.pop(rule_id, None)
        self.save()

    def add_fact_audit(self, entry: FactAuditEntry) -> None:
        self.fact_audit_log[entry.fact_id].append(entry)
        self.save()

    def get_fact_audit(self, fact_id: str) -> list[FactAuditEntry]:
        return list(self.fact_audit_log.get(fact_id, []))

    def set_file_signature(self, file_path: str, signature: int) -> None:
        self.file_signatures[file_path] = signature
        self.save()

    def get_file_signature(self, file_path: str) -> int | None:
        return self.file_signatures.get(file_path)

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self) -> None:
        data = {
            "sources": {k: v.model_dump(mode="json") for k, v in self.sources.items()},
            "facts": {k: v.model_dump(mode="json") for k, v in self.facts.items()},
            "conflicts": {k: v.model_dump(mode="json") for k, v in self.conflicts.items()},
            "rules": {k: v.model_dump(mode="json") for k, v in self.rules.items()},
            "fact_audit_log": {
                k: [e.model_dump(mode="json") for e in entries]
                for k, entries in self.fact_audit_log.items()
            },
            "path_index": dict(self.path_index),
            "file_signatures": self.file_signatures,
        }
        json_blob = json.dumps(data)
        self._conn.execute(
            "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)",
            ("state", json_blob),
        )
        self._conn.commit()

    def _load(self) -> None:
        row = self._conn.execute(
            "SELECT value FROM kv_store WHERE key = 'state'"
        ).fetchone()
        if row is None:
            return
        try:
            raw = json.loads(row[0])
            self.sources = {k: SourceRecord(**v) for k, v in raw.get("sources", {}).items()}
            self.facts = {k: Fact(**v) for k, v in raw.get("facts", {}).items()}
            self.conflicts = {k: Conflict(**v) for k, v in raw.get("conflicts", {}).items()}
            self.rules = {k: ResolutionRule(**v) for k, v in raw.get("rules", {}).items()}
            self.fact_audit_log = defaultdict(
                list,
                {
                    k: [FactAuditEntry(**e) for e in entries]
                    for k, entries in raw.get("fact_audit_log", {}).items()
                },
            )
            self.path_index = defaultdict(list, raw.get("path_index", {}))
            self.file_signatures = {k: int(v) for k, v in raw.get("file_signatures", {}).items()}
            self.integrity_report = {
                "ok": True,
                "message": "sqlite state loaded",
                "backup_path": None,
            }
        except (json.JSONDecodeError, ValidationError, ValueError, TypeError) as exc:
            self.integrity_report = {
                "ok": False,
                "message": f"sqlite state reset after integrity error: {exc}",
                "backup_path": None,
            }

    def close(self) -> None:
        self._conn.close()
