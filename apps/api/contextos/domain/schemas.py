from pydantic import BaseModel, Field

from contextos.domain.models import Namespace


class IngestRequest(BaseModel):
    source_system: str = Field(..., examples=["qontext"])
    source_type: str = Field(..., examples=["email", "crm", "ticket", "policy"])
    source_uri: str
    payload: dict


class IngestResponse(BaseModel):
    source_record_id: str
    facts_created: int
    conflicts_created: int


class DatasetIngestRequest(BaseModel):
    root_path: str = "data/Dataset"
    include_extensions: list[str] = Field(default_factory=lambda: ["json", "csv", "pdf"])
    max_files: int | None = None
    max_records_per_file: int | None = None


class DatasetIngestResponse(BaseModel):
    root_path: str
    extensions: list[str]
    files_scanned: int
    files_processed: int
    files_changed: int
    files_unchanged: int
    sources_ingested: int
    facts_created: int
    conflicts_created: int
    files_skipped: list[str]
    errors: list[dict]


class SyncDatasetRequest(BaseModel):
    root_path: str = "data/Dataset"
    include_extensions: list[str] = Field(default_factory=lambda: ["json", "csv", "pdf"])
    max_files: int | None = None
    max_records_per_file: int | None = None


class SyncDatasetResponse(BaseModel):
    root_path: str
    extensions: list[str]
    files_scanned: int
    files_processed: int
    files_changed: int
    files_unchanged: int
    sources_ingested: int
    facts_created: int
    conflicts_created: int
    files_skipped: list[str]
    errors: list[dict]


class QueryRequest(BaseModel):
    text: str
    namespace: Namespace | None = None
    subject: str | None = None
    predicate: str | None = None


class ResolveConflictRequest(BaseModel):
    selected_fact_id: str
    create_rule: bool = False
    rule_name: str | None = None
