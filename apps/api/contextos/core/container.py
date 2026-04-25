from contextos.services.conflict_engine import ConflictEngine
from contextos.services.dataset_ingestion import DatasetIngestionService
from contextos.services.ingestion import IngestionService
from contextos.services.metrics import MetricsService
from contextos.services.provenance import ProvenanceService
from contextos.services.retrieval import RetrievalService
from contextos.storage.repository import InMemoryRepository


class Container:
    def __init__(self) -> None:
        repo = InMemoryRepository()
        self.repo = repo
        self.ingestion = IngestionService(repo)
        self.dataset_ingestion = DatasetIngestionService(self.ingestion)
        self.conflicts = ConflictEngine(repo)
        self.provenance = ProvenanceService(repo)
        self.retrieval = RetrievalService(repo)
        self.metrics = MetricsService(repo)


container = Container()
