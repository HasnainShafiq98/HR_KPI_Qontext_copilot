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


class QueryRequest(BaseModel):
    text: str
    namespace: Namespace | None = None
    subject: str | None = None
    predicate: str | None = None


class ResolveConflictRequest(BaseModel):
    selected_fact_id: str
    create_rule: bool = False
    rule_name: str | None = None
