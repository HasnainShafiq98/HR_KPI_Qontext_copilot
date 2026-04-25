from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from contextos.domain.models import SourceRecord
from contextos.services.ingestion import IngestionService


class DatasetIngestionService:
    def __init__(self, ingestion: IngestionService) -> None:
        self.ingestion = ingestion

    def ingest_dataset(
        self,
        root_path: str,
        include_extensions: list[str] | None = None,
        max_files: int | None = None,
        max_records_per_file: int | None = None,
    ) -> dict[str, Any]:
        return self._ingest_internal(
            root_path=root_path,
            include_extensions=include_extensions,
            max_files=max_files,
            max_records_per_file=max_records_per_file,
            changed_only=False,
        )

    def sync_dataset(
        self,
        root_path: str,
        include_extensions: list[str] | None = None,
        max_files: int | None = None,
        max_records_per_file: int | None = None,
    ) -> dict[str, Any]:
        return self._ingest_internal(
            root_path=root_path,
            include_extensions=include_extensions,
            max_files=max_files,
            max_records_per_file=max_records_per_file,
            changed_only=True,
        )

    def _ingest_internal(
        self,
        root_path: str,
        include_extensions: list[str] | None = None,
        max_files: int | None = None,
        max_records_per_file: int | None = None,
        changed_only: bool = False,
    ) -> dict[str, Any]:
        root = Path(root_path)
        extensions = self._normalize_extensions(include_extensions or ["json", "csv", "pdf"])

        files = [
            p
            for p in sorted(root.rglob("*"))
            if p.is_file() and p.suffix.lower().lstrip(".") in extensions and p.name != ".DS_Store"
        ]

        if max_files is not None:
            files = files[:max_files]

        summary = {
            "root_path": str(root),
            "extensions": sorted(extensions),
            "files_scanned": len(files),
            "files_processed": 0,
            "files_changed": 0,
            "files_unchanged": 0,
            "sources_ingested": 0,
            "facts_created": 0,
            "conflicts_created": 0,
            "files_skipped": [],
            "errors": [],
        }

        for file_path in files:
            try:
                file_key = str(file_path)
                current_signature = int(file_path.stat().st_mtime_ns)
                previous_signature = self.ingestion.repo.get_file_signature(file_key)
                if changed_only and previous_signature == current_signature:
                    summary["files_unchanged"] += 1
                    continue

                summary["files_changed"] += 1
                records = self._load_records(file_path, max_records_per_file)
                if not records:
                    summary["files_skipped"].append(str(file_path))
                    continue

                source_type = self._infer_source_type(file_path)
                source_system = self._infer_source_system(file_path)

                file_sources = 0
                file_facts = 0
                file_conflicts = 0

                for idx, record in enumerate(records):
                    payload = self._normalize_payload(record, file_path, idx)
                    source = SourceRecord(
                        source_system=source_system,
                        source_type=source_type,
                        source_uri=f"file://{file_path}",
                        payload=payload,
                    )
                    facts, conflicts = self.ingestion.ingest(source)
                    file_sources += 1
                    file_facts += len(facts)
                    file_conflicts += len(conflicts)

                summary["sources_ingested"] += file_sources
                summary["facts_created"] += file_facts
                summary["conflicts_created"] += file_conflicts
                summary["files_processed"] += 1
                self.ingestion.repo.set_file_signature(file_key, current_signature)
            except Exception as exc:  # pragma: no cover - best-effort ingest
                summary["errors"].append({"file": str(file_path), "error": str(exc)})

        return summary

    def _normalize_extensions(self, include_extensions: list[str]) -> set[str]:
        return {ext.lower().lstrip(".") for ext in include_extensions if ext.strip()}

    def _load_records(self, file_path: Path, max_records_per_file: int | None) -> list[dict[str, Any]]:
        ext = file_path.suffix.lower()
        records: list[dict[str, Any]]

        if ext == ".json":
            with file_path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
            if isinstance(data, list):
                records = [self._coerce_dict(item) for item in data]
            elif isinstance(data, dict):
                records = [data]
            else:
                records = [{"value": str(data)}]

        elif ext == ".csv":
            with file_path.open("r", encoding="utf-8", newline="") as handle:
                reader = csv.DictReader(handle)
                records = [dict(row) for row in reader]

        elif ext == ".pdf":
            # PDF text extraction is intentionally deferred; we still register
            # the document as a provenance-aware record in procedural memory.
            records = [
                {
                    "entity": file_path.stem,
                    "document_name": file_path.name,
                    "document_path": str(file_path),
                    "document_extension": "pdf",
                }
            ]

        else:
            return []

        if max_records_per_file is not None:
            return records[:max_records_per_file]
        return records

    def _normalize_payload(self, record: dict[str, Any], file_path: Path, index: int) -> dict[str, Any]:
        payload = dict(record)
        payload.setdefault("entity", self._infer_entity(payload, file_path, index))
        payload.setdefault("record_index", index)
        payload.setdefault("source_file", str(file_path))
        return payload

    def _infer_entity(self, payload: dict[str, Any], file_path: Path, index: int) -> str:
        for key in (
            "entity",
            "emp_id",
            "employee_id",
            "customer_id",
            "id",
            "email_id",
            "conversation_id",
            "thread_id",
            "resume_id",
            "Title",
            "title",
        ):
            value = payload.get(key)
            if value not in (None, ""):
                return str(value)

        return f"{file_path.stem}_{index}"

    def _infer_source_type(self, file_path: Path) -> str:
        parts = {part.lower() for part in file_path.parts}
        name = file_path.name.lower()

        if file_path.suffix.lower() == ".pdf" or "policy" in name or "policy_documents" in parts:
            return "policy"
        if "employee" in name or "human_resource_management" in parts:
            return "hr"
        if "customer" in name or "crm" in parts or "sales" in name:
            return "crm"
        if "ticket" in name or "it_service_management" in parts:
            return "ticket"
        if "email" in name or "mail" in name:
            return "email"
        if "conversation" in name or "post" in name or "overflow" in name:
            return "project"

        return "project"

    def _infer_source_system(self, file_path: Path) -> str:
        parts = {part.lower() for part in file_path.parts}

        if "human_resource_management" in parts:
            return "hrms"
        if "customer_relation_management" in parts:
            return "crm"
        if "it_service_management" in parts:
            return "itsm"
        if "enterprise_mail_system" in parts:
            return "mail"
        if "policy_documents" in parts:
            return "policy_docs"
        if "collaboration_tools" in parts:
            return "collaboration"
        if "workspace" in parts:
            return "github"

        return "qontext"

    def _coerce_dict(self, value: Any) -> dict[str, Any]:
        if isinstance(value, dict):
            return value
        return {"value": str(value)}
