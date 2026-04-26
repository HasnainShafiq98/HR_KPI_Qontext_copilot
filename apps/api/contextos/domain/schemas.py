from pydantic import BaseModel, Field

from contextos.domain.models import FactStatus, Namespace


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
    max_files: int | None = Field(default=500, ge=1, le=5000)
    max_records_per_file: int | None = Field(default=1000, ge=1, le=10000)
    sample_records_per_file: int | None = Field(default=45, ge=1, le=500)
    sample_seed: int | None = None


class FileDiffSummary(BaseModel):
    file: str
    status: str
    sources_ingested: int = 0
    facts_created: int = 0
    conflicts_created: int = 0
    error: str | None = None


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
    file_diffs: list[FileDiffSummary] = Field(default_factory=list)
    sample_records_per_file: int | None = None
    sample_seed: int | None = None


class SyncDatasetRequest(BaseModel):
    root_path: str = "data/Dataset"
    include_extensions: list[str] = Field(default_factory=lambda: ["json", "csv", "pdf"])
    max_files: int | None = Field(default=500, ge=1, le=5000)
    max_records_per_file: int | None = Field(default=1000, ge=1, le=10000)
    dry_run: bool = False
    sample_records_per_file: int | None = Field(default=45, ge=1, le=500)
    sample_seed: int | None = None


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
    dry_run: bool = False
    file_diffs: list[FileDiffSummary] = Field(default_factory=list)
    sample_records_per_file: int | None = None
    sample_seed: int | None = None


class QueryRequest(BaseModel):
    text: str
    namespace: Namespace | None = None
    subject: str | None = None
    predicate: str | None = None
    limit: int = Field(default=20, ge=1, le=500)


class ResolveConflictRequest(BaseModel):
    action: str = "resolve"
    selected_fact_id: str | None = None
    create_rule: bool = False
    rule_name: str | None = None
    actor: str = "user"
    escalation_reason: str | None = None
    assigned_to: str | None = None
    priority: str | None = None


class ConflictListResponse(BaseModel):
    items: list[dict]
    total: int
    offset: int
    limit: int
    statuses: list[str] = Field(default_factory=list)


class UpdateFactRequest(BaseModel):
    object_value: str | None = None
    status: FactStatus | None = None
    actor: str = "user"
    reason: str | None = None


class CreateRuleRequest(BaseModel):
    name: str
    namespace: Namespace | None = None
    predicate: str | None = None
    preferred_source_system: str | None = None
    strategy: str = "prefer_source_system"


class RuleListResponse(BaseModel):
    items: list[dict]
    total: int
    offset: int
    limit: int
