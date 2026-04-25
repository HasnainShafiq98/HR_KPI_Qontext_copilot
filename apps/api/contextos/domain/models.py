from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class Namespace(str, Enum):
    STATIC = "static"
    PROCEDURAL = "procedural"
    TRAJECTORY = "trajectory"


class ConflictStatus(str, Enum):
    OPEN = "open"
    RESOLVED = "resolved"


class FactStatus(str, Enum):
    ACTIVE = "active"
    STALE = "stale"
    CONFLICTED = "conflicted"


class SourceRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    source_system: str
    source_type: str
    source_uri: str
    observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payload: dict[str, Any] = Field(default_factory=dict)


class Fact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    namespace: Namespace
    path: str
    subject: str
    predicate: str
    object_value: str
    confidence: float = Field(ge=0.0, le=1.0)
    status: FactStatus = FactStatus.ACTIVE
    source_record_ids: list[str] = Field(default_factory=list)
    linked_fact_ids: list[str] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Conflict(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    reason: str
    candidate_fact_ids: list[str]
    status: ConflictStatus = ConflictStatus.OPEN
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_fact_id: str | None = None


class ResolutionRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    namespace: Namespace | None = None
    predicate: str | None = None
    preferred_source_system: str | None = None
    strategy: str


class RetrievalHit(BaseModel):
    fact: Fact
    staleness_flag: bool
    provenance: list[SourceRecord]
