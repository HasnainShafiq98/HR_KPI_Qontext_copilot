from __future__ import annotations

import math
import re
from collections import Counter
from datetime import datetime, timezone

from contextos.domain.models import FactStatus, RetrievalHit
from contextos.storage.repository import InMemoryRepository


# ---------------------------------------------------------------------------
# TF-IDF cosine-similarity retrieval
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-zA-Z0-9_]+", text.lower()) if t]


def _tf(tokens: list[str]) -> dict[str, float]:
    if not tokens:
        return {}
    counts = Counter(tokens)
    n = len(tokens)
    return {term: count / n for term, count in counts.items()}


def _cosine(vec_a: dict[str, float], vec_b: dict[str, float]) -> float:
    common = set(vec_a) & set(vec_b)
    if not common:
        return 0.0
    dot = sum(vec_a[t] * vec_b[t] for t in common)
    mag_a = math.sqrt(sum(v * v for v in vec_a.values()))
    mag_b = math.sqrt(sum(v * v for v in vec_b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


class RetrievalService:
    """Semantic retrieval using TF-IDF cosine similarity with keyword fallback."""

    def __init__(self, repo: InMemoryRepository) -> None:
        self.repo = repo

    def query(self, text: str, namespace=None, subject=None, predicate=None):
        query_tokens = _tokenize(text)
        query_tf = _tf(query_tokens)
        hits: list[RetrievalHit] = []

        # Build IDF from all facts in scope
        all_facts = list(self.repo.facts.values())
        if namespace:
            all_facts = [f for f in all_facts if f.namespace.value == namespace]

        # Document-frequency for IDF
        df: dict[str, int] = Counter()
        doc_tfs: dict[str, dict[str, float]] = {}
        for fact in all_facts:
            tokens = _tokenize(f"{fact.subject} {fact.predicate} {fact.object_value} {fact.path}")
            fact_tf = _tf(tokens)
            doc_tfs[fact.id] = fact_tf
            for term in fact_tf:
                df[term] += 1

        N = max(len(all_facts), 1)

        def idf(term: str) -> float:
            return math.log((N + 1) / (df.get(term, 0) + 1)) + 1.0

        # TF-IDF weighted query vector
        query_tfidf = {t: w * idf(t) for t, w in query_tf.items()}

        for fact in all_facts:
            if subject and fact.subject != subject:
                continue
            if predicate and fact.predicate != predicate:
                continue

            fact_tfidf = {t: w * idf(t) for t, w in doc_tfs.get(fact.id, {}).items()}
            semantic_score = _cosine(query_tfidf, fact_tfidf)

            # Keyword fallback for short queries (gives non-zero score on exact matches)
            haystack = f"{fact.subject} {fact.predicate} {fact.object_value} {fact.path}".lower()
            kw_score = self._keyword_score(fact, query_tokens, haystack)

            # Blend: semantic dominates, keyword boosts exact hits
            blended = 0.7 * semantic_score + 0.3 * kw_score

            if blended == 0 and not query_tokens:
                blended = 1.0  # empty query returns everything

            # Only return facts that have some relevance
            if blended <= 0.0 and query_tokens:
                continue

            provenance = [self.repo.sources[sid] for sid in fact.source_record_ids if sid in self.repo.sources]
            confidence = float(fact.confidence)
            freshness = self._freshness_score(provenance)
            staleness_penalty = 0.0 if fact.status == FactStatus.ACTIVE else -0.25
            final_score = blended + confidence * 0.05 + freshness * 0.03 + staleness_penalty

            hits.append(
                RetrievalHit(
                    fact=fact,
                    staleness_flag=fact.status in {FactStatus.STALE, FactStatus.CONFLICTED},
                    provenance=provenance,
                    retrieval_score=final_score,
                )
            )

        return sorted(hits, key=lambda h: (h.retrieval_score, h.fact.confidence), reverse=True)

    def _keyword_score(self, fact, terms: list[str], haystack: str) -> float:
        if not terms:
            return 1.0
        token_matches = sum(1 for t in terms if t in haystack)
        base = token_matches / len(terms)
        exact_subject = 1.0 if any(t == fact.subject.lower() for t in terms) else 0.0
        exact_pred = 1.0 if any(t == fact.predicate.lower() for t in terms) else 0.0
        return base * 0.5 + exact_subject * 0.3 + exact_pred * 0.2

    def _freshness_score(self, provenance) -> float:
        if not provenance:
            return 0.0
        latest = max((source.observed_at for source in provenance), default=None)
        if latest is None:
            return 0.0
        age_seconds = (datetime.now(timezone.utc) - latest).total_seconds()
        if age_seconds <= 3600:
            return 1.0
        if age_seconds <= 86400:
            return 0.6
        if age_seconds <= 7 * 86400:
            return 0.3
        return 0.1

