from __future__ import annotations

from typing import Any

from contextos.domain.models import Conflict, Fact, FactStatus, Namespace, SourceRecord
from contextos.services.conflict_engine import ConflictEngine
from contextos.storage.repository import InMemoryRepository


# ---------------------------------------------------------------------------
# Source adapter protocol – simple plugin pattern so callers can register
# custom extractors without subclassing IngestionService.
# ---------------------------------------------------------------------------

class SourceAdapter:
    """Override `can_handle` and `extract` to build a custom source adapter."""

    #: file extensions this adapter handles, e.g. ["json", "jsonl"]
    extensions: list[str] = []
    #: folder-name keywords this adapter handles, e.g. ["hr", "hrms"]
    source_type_keywords: list[str] = []

    def can_handle(self, source_type: str, extension: str | None = None) -> bool:
        kw = source_type.lower()
        return any(k in kw for k in self.source_type_keywords)

    def extract(self, source: SourceRecord, namespace: Namespace) -> list[Fact]:
        raise NotImplementedError


# Global adapter registry — populated by registering SourceAdapter instances.
_ADAPTER_REGISTRY: list[SourceAdapter] = []


def register_adapter(adapter: SourceAdapter) -> None:
    """Register a custom SourceAdapter globally."""
    _ADAPTER_REGISTRY.append(adapter)


class IngestionService:
    EXTRACTOR_REGISTRY = {
        "policy": "_extract_with_nested_flattening",
        "sop": "_extract_with_nested_flattening",
        "email": "_extract_with_nested_flattening",
        "crm": "_extract_with_nested_flattening",
        "hr": "_extract_with_nested_flattening",
        "ticket": "_extract_with_nested_flattening",
        "project": "_extract_with_nested_flattening",
    }

    def __init__(self, repo: InMemoryRepository, conflict_engine: ConflictEngine) -> None:
        self.repo = repo
        self.conflict_engine = conflict_engine

    def ingest(self, source: SourceRecord, skip_graph_links: bool = False) -> tuple[list[Fact], list[Conflict]]:
        """Ingest a single SourceRecord.

        Args:
            source: The record to ingest.
            skip_graph_links: Set True during bulk ingest — caller should call
                ``build_graph_links()`` once after all records are processed.
        """
        self.repo.sources[source.id] = source  # skip redundant save()

        namespace = self._infer_namespace(source.source_type)
        extracted_facts = self._extract_atomic_facts(source, namespace)

        conflicts: list[Conflict] = []
        for fact in extracted_facts:
            existing = self._find_existing(fact.subject, fact.predicate, fact.path)

            if existing and existing.object_value == fact.object_value:
                if source.id not in existing.source_record_ids:
                    existing.source_record_ids.append(source.id)
                existing.updated_at = source.observed_at
                continue  # no save here — batched below

            # Add fact directly to avoid per-fact save()
            self.repo.facts[fact.id] = fact
            self.repo.path_index[fact.path].append(fact.id)

            if existing and existing.object_value != fact.object_value:
                conflict = Conflict(
                    reason=f"Conflicting values for {fact.subject}.{fact.predicate}",
                    candidate_fact_ids=[existing.id, fact.id],
                )
                self.repo.conflicts[conflict.id] = conflict
                resolved, _ = self.conflict_engine.auto_resolve(conflict.id)
                if not resolved:
                    existing.status = FactStatus.CONFLICTED
                    fact.status = FactStatus.CONFLICTED
                conflicts.append(conflict)

        if not skip_graph_links:
            new_ids = [f.id for f in extracted_facts if f.id in self.repo.facts]
            self._link_cosubject(new_ids)
            self._link_cross_entity(new_ids)

        self.repo.save()
        return extracted_facts, conflicts

    def build_graph_links(self, fact_ids: list[str]) -> None:
        """Build graph links for a batch of fact IDs (called once per file during bulk ingest).

        Much cheaper than calling per-record because the subjects index is built once
        and the back-link scan only touches facts with matching subjects.
        """
        if not fact_ids:
            return

        # Co-subject links — group by subject first to avoid O(n²) cross-subject work
        by_subject: dict[str, list[str]] = {}
        for fid in fact_ids:
            f = self.repo.facts.get(fid)
            if f:
                by_subject.setdefault(f.subject, []).append(fid)

        for subject_ids in by_subject.values():
            self._link_cosubject(subject_ids)

        # Cross-entity links
        self._link_cross_entity(fact_ids)
        self._back_link(fact_ids)

    def _link_cosubject(self, ids: list[str], max_links: int = 50) -> None:
        """Link facts that share the same subject to each other (capped to avoid O(n²))."""
        capped = ids[:max_links]
        for i, fid_a in enumerate(capped):
            for fid_b in capped[i + 1:]:
                fact_a = self.repo.facts.get(fid_a)
                fact_b = self.repo.facts.get(fid_b)
                if fact_a and fact_b:
                    if fid_b not in fact_a.linked_fact_ids:
                        fact_a.linked_fact_ids.append(fid_b)
                    if fid_a not in fact_b.linked_fact_ids:
                        fact_b.linked_fact_ids.append(fid_a)

    def _link_cross_entity(self, new_ids: list[str]) -> None:
        """Forward cross-entity links: fact.object_value matches another entity's subject."""
        subjects_index: dict[str, list[str]] = {}
        for fid, f in self.repo.facts.items():
            subjects_index.setdefault(f.subject.lower().strip(), []).append(fid)

        for fid in new_ids:
            fact = self.repo.facts.get(fid)
            if not fact:
                continue
            candidate = fact.object_value.lower().strip()
            if len(candidate) < 3:  # skip trivially short values
                continue
            if candidate in subjects_index:
                for target_fid in subjects_index[candidate][:20]:  # cap fan-out
                    if target_fid != fid and target_fid not in fact.linked_fact_ids:
                        fact.linked_fact_ids.append(target_fid)
                    target_fact = self.repo.facts.get(target_fid)
                    if target_fact and fid not in target_fact.linked_fact_ids:
                        target_fact.linked_fact_ids.append(fid)

    def _back_link(self, new_ids: list[str]) -> None:
        """Back-link: when a new entity is ingested, link existing facts that reference it."""
        new_subjects = {
            self.repo.facts[fid].subject.lower().strip()
            for fid in new_ids
            if fid in self.repo.facts
        }
        if not new_subjects:
            return
        for fid_existing, f_existing in self.repo.facts.items():
            if fid_existing in set(new_ids):
                continue
            candidate = f_existing.object_value.lower().strip()
            if len(candidate) < 3 or candidate not in new_subjects:
                continue
            for fid in new_ids:
                f_new = self.repo.facts.get(fid)
                if not f_new or f_new.subject.lower().strip() != candidate:
                    continue
                if fid not in f_existing.linked_fact_ids:
                    f_existing.linked_fact_ids.append(fid)
                if fid_existing not in f_new.linked_fact_ids:
                    f_new.linked_fact_ids.append(fid_existing)




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
        extractor_name = self.EXTRACTOR_REGISTRY.get(source.source_type.lower(), "_extract_with_nested_flattening")
        extractor = getattr(self, extractor_name, self._extract_with_nested_flattening)
        return extractor(source, namespace)

    def _extract_with_nested_flattening(self, source: SourceRecord, namespace: Namespace) -> list[Fact]:
        facts: list[Fact] = []
        entity = source.payload.get("entity", source.source_type)
        for key, value in source.payload.items():
            for flat_key, flat_value in self._flatten_value(str(key), value):
                path = f"/{namespace.value}/{entity}/{flat_key}"
                facts.append(
                    Fact(
                        namespace=namespace,
                        path=path,
                        subject=str(entity),
                        predicate=str(flat_key),
                        object_value=flat_value,
                        confidence=self._confidence_for_value(flat_key, flat_value),
                        source_record_ids=[source.id],
                    )
                )

        return facts

    def _flatten_value(self, key: str, value: Any) -> list[tuple[str, str]]:
        if isinstance(value, (str, int, float, bool)):
            return [(key, str(value))]
        if value is None:
            return []
        if isinstance(value, list):
            rows: list[tuple[str, str]] = []
            for idx, item in enumerate(value):
                rows.extend(self._flatten_value(f"{key}[{idx}]", item))
            return rows
        if isinstance(value, dict):
            rows = []
            for sub_key, sub_value in value.items():
                rows.extend(self._flatten_value(f"{key}.{sub_key}", sub_value))
            return rows
        return [(key, str(value))]

    def _confidence_for_value(self, key: str, value: str) -> float:
        base = 0.72
        if "[" in key or "." in key:
            base -= 0.02
        if value.lower() in {"unknown", "n/a", "none", ""}:
            base -= 0.15
        return max(0.4, min(0.98, base))

    def _find_existing(self, subject: str, predicate: str, path: str) -> Fact | None:
        candidate_ids = self.repo.path_index.get(path, [])
        for fact_id in candidate_ids:
            fact = self.repo.facts[fact_id]
            if fact.subject == subject and fact.predicate == predicate:
                return fact
        return None
