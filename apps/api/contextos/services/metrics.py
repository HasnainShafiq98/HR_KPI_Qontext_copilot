from __future__ import annotations

from collections import Counter

from contextos.domain.models import ConflictStatus, FactStatus
from contextos.storage.repository import InMemoryRepository


class MetricsService:
    def __init__(self, repo: InMemoryRepository) -> None:
        self.repo = repo

    def context_health(self):
        fact_status = Counter(f.status for f in self.repo.facts.values())
        total_conflicts = len(self.repo.conflicts)
        open_conflicts = len([c for c in self.repo.conflicts.values() if c.status == ConflictStatus.OPEN])

        return {
            "facts_total": len(self.repo.facts),
            "confidence_avg": self._confidence_avg(),
            "status_distribution": {k.value: v for k, v in fact_status.items()},
            "conflicts_total": total_conflicts,
            "conflicts_open": open_conflicts,
        }

    def ingestion_progress(self):
        return {
            "sources_processed": len(self.repo.sources),
            "facts_created": len(self.repo.facts),
            "conflicts_detected": len(self.repo.conflicts),
            "resolved_conflicts": len(
                [c for c in self.repo.conflicts.values() if c.status == ConflictStatus.RESOLVED]
            ),
        }

    def _confidence_avg(self):
        if not self.repo.facts:
            return 0.0
        return sum(f.confidence for f in self.repo.facts.values()) / len(self.repo.facts)
