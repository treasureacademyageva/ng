"""Deterministic exact and near-duplicate detection for document units."""
from __future__ import annotations

import hashlib
import re
from dataclasses import asdict, dataclass

WORD_RE = re.compile(r"[^\W_]+(?:['’][^\W_]+)?", re.UNICODE)


def tokens(text: str) -> list[str]:
    return [match.group(0).casefold().replace("’", "'") for match in WORD_RE.finditer(text)]


def exact_digest(text: str) -> str:
    normalized = " ".join(tokens(text))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def word_shingles(words: list[str], size: int = 5) -> set[int]:
    if len(words) < size:
        return set()
    return {
        int.from_bytes(hashlib.blake2b(" ".join(words[i:i + size]).encode("utf-8"), digest_size=8).digest(), "big")
        for i in range(len(words) - size + 1)
    }


def simhash(values: set[int]) -> int:
    if not values:
        return 0
    weights = [0] * 64
    for value in values:
        for bit in range(64):
            weights[bit] += 1 if value & (1 << bit) else -1
    signature = 0
    for bit, weight in enumerate(weights):
        if weight >= 0:
            signature |= 1 << bit
    return signature


@dataclass(frozen=True)
class DuplicateMatch:
    duplicate_id: str
    kept_id: str
    kind: str
    similarity: float
    duplicate_words: int
    kept_words: int

    def to_dict(self) -> dict:
        return asdict(self)


class NearDuplicateIndex:
    """Keep the first unit and flag later exact or high-overlap near duplicates."""

    def __init__(self, threshold: float = 0.88, min_words: int = 30, fingerprints: int = 16):
        if not 0 < threshold <= 1:
            raise ValueError("threshold must be within (0, 1]")
        if fingerprints < 1:
            raise ValueError("fingerprints must be positive")
        self.threshold = threshold
        self.min_words = min_words
        self.fingerprints = fingerprints
        self.exact: dict[str, int] = {}
        self.buckets: dict[int, set[int]] = {}
        self.documents: list[dict] = []

    def _bucket_keys(self, shingles: set[int]):
        return sorted(shingles)[: self.fingerprints]

    def add_or_match(self, document_id: str, text: str) -> DuplicateMatch | None:
        words = tokens(text)
        digest = hashlib.sha256(" ".join(words).encode("utf-8")).hexdigest()
        exact_index = self.exact.get(digest)
        if exact_index is not None:
            kept = self.documents[exact_index]
            return DuplicateMatch(document_id, kept["id"], "exact", 1.0, len(words), len(kept["words"]))

        shingles = word_shingles(words)
        signature = simhash(shingles)
        candidate_indexes: set[int] = set()
        if len(words) >= self.min_words and shingles:
            for key in self._bucket_keys(shingles):
                candidate_indexes.update(self.buckets.get(key, set()))
            for index in sorted(candidate_indexes):
                kept = self.documents[index]
                kept_words = kept["words"]
                if len(kept_words) < self.min_words:
                    continue
                length_ratio = min(len(words), len(kept_words)) / max(len(words), len(kept_words))
                if length_ratio < 0.75:
                    continue
                shared = len(shingles & kept["shingles"])
                denominator = min(len(shingles), len(kept["shingles"]))
                similarity = shared / denominator if denominator else 0.0
                if similarity >= self.threshold:
                    return DuplicateMatch(
                        document_id, kept["id"], "near", similarity, len(words), len(kept_words)
                    )

        index = len(self.documents)
        self.documents.append({"id": document_id, "words": words, "shingles": shingles, "signature": signature})
        self.exact[digest] = index
        if len(words) >= self.min_words and shingles:
            for key in self._bucket_keys(shingles):
                self.buckets.setdefault(key, set()).add(index)
        return None
