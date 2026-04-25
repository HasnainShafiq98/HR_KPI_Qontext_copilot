import os
from pathlib import Path

from contextos.services.conflict_engine import ConflictEngine
from contextos.services.dataset_ingestion import DatasetIngestionService
from contextos.services.ingestion import IngestionService
from contextos.services.metrics import MetricsService
from contextos.services.provenance import ProvenanceService
from contextos.services.retrieval import RetrievalService
from contextos.storage.repository import InMemoryRepository


class Container:
    def __init__(self) -> None:
        repo_root = Path(__file__).resolve().parents[4]

        backend = os.environ.get("CONTEXTOS_STORAGE_BACKEND", "json").lower()
        state_file_env = os.environ.get("CONTEXTOS_STATE_FILE", "")

        if backend == "sqlite":
            from contextos.storage.sqlite_repository import SqliteRepository
            sqlite_path = state_file_env or str(repo_root / "data" / "processed" / "contextos_state.sqlite")
            repo: InMemoryRepository = SqliteRepository(db_path=sqlite_path)  # type: ignore[assignment]
        else:
            state_file = state_file_env or str(repo_root / "data" / "processed" / "contextos_state.json")
            repo = InMemoryRepository(persist_path=state_file)

        self.repo = repo
        self.conflicts = ConflictEngine(repo)
        self.ingestion = IngestionService(repo, self.conflicts)
        self.dataset_ingestion = DatasetIngestionService(self.ingestion)
        self.provenance = ProvenanceService(repo)
        self.retrieval = RetrievalService(repo)
        self.metrics = MetricsService(repo)


container = Container()

