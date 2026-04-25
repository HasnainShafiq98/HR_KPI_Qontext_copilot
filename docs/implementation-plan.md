# ContextOS Implementation Plan

## 1. Problem and Scope

ContextOS creates a continuously updated enterprise memory layer where each fact is:
- atomic
- source-linked
- confidence-scored
- conflict-aware

MVP goals:
- ingest mixed enterprise records
- extract and normalize facts
- expose memory through VFS-style paths
- resolve easy conflicts automatically
- route ambiguous conflicts to human queue
- provide retrieval API for agents + backend contract for Lovable UI

## 2. Target Architecture

1. Ingestion Layer
- Input adapters for emails, CRM rows, tickets, HR docs, policy docs
- Normalization to canonical event envelopes
- Fact extraction into atomic fact records

2. Memory Core
- Virtual filesystem namespaces:
  - `/static` (employees/customers/products)
  - `/procedural` (SOPs/policies/rules)
  - `/trajectory` (projects/tasks/progress)
- Fact registry with confidence and timestamps
- Graph links between facts and source records

3. Conflict and Provenance
- Auto-resolution by authority + recency
- Human conflict queue for ambiguous cases
- Rule learning from human resolutions
- Provenance timeline per fact

4. Retrieval Interfaces
- Agent API: structured query returning fact + confidence + provenance + staleness
- Human UI: browse memory tree, inspect evidence, resolve conflicts

## 3. Data Contracts (MVP)

Core entities:
- `SourceRecord`: raw source metadata + payload pointer
- `Fact`: subject/predicate/object + path + confidence + status
- `FactEdge`: fact-to-fact relation
- `Conflict`: competing fact candidates + reason + queue status
- `ResolutionRule`: reusable conflict decision rule

## 4. Delivery Phases

Phase 0: Foundation (this boilerplate)
- repo structure, API shell, UI shell, models, stub services

Phase 1: Ingestion + Extraction
- add source adapters
- implement parser and fact extractor
- persist source provenance
- support bulk dataset ingestion entrypoint (`POST /ingest/dataset`)

Phase 2: Graph + Resolution
- graph storage and adjacency updates
- authority/recency conflict resolver
- queue APIs and manual resolution flow

Phase 3: Sync + Monitoring
- incremental updates from source changes
- confidence recalculation
- staleness scanning
- dashboard metrics endpoints

Phase 4: Harden + Scale
- auth and RBAC
- queue SLOs and audit trails
- indexing and performance tuning

## 5. Tooling Integration Map

- Qontext: primary ingestion input source
- Aikido: security posture checks for data handling and pipeline surface
- Gradium: fact quality score before commit to memory graph
- Entire: developer context capture during build/debug
- Tavily: optional external enrichment/validation for uncertain facts

## 6. Success Metrics

- Conflict auto-resolution rate
- Human queue size and time-to-resolution
- Median retrieval latency for agent queries
- Share of facts with full provenance
- Staleness ratio across namespaces

## 7. Next Build Tasks

1. Implement CSV/JSON adapters under `services/ingestion.py`
2. Add SQLite/Postgres persistence in `storage/repository.py`
3. Replace in-memory conflict queue with persistent workflow
4. Add auth and tenant isolation
5. Add graph UI (Cytoscape or D3) in `apps/web`
