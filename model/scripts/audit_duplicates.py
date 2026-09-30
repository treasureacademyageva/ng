#!/usr/bin/env python3
"""Audit exact/near duplicates across approved sources and ignored staging."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from deduplication import NearDuplicateIndex, tokens
from prepare_data import source_text, units

ROOT = Path(__file__).resolve().parents[1]


def current_documents() -> list[dict]:
    manifest = json.loads((ROOT / "data/sources.json").read_text(encoding="utf-8"))
    documents = []
    for source in manifest["sources"]:
        if not source.get("enabled") or not source.get("approved_for_training", source.get("reviewed", False)):
            continue
        text = source_text(source)
        if not text:
            continue
        for index, unit in enumerate(units(text), 1):
            documents.append({
                "id": f"approved:{source['id']}:{index:05d}",
                "source_id": source["id"],
                "state": "approved_current",
                "text": unit,
            })
    return documents


def staged_documents() -> list[dict]:
    documents = []
    for path in sorted((ROOT / "data/staging").glob("*.jsonl")):
        for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            row = json.loads(line)
            text = row.get("text")
            if not text:
                continue
            documents.append({
                "id": row.get("document_id", f"staged:{path.stem}:{line_number}"),
                "source_id": path.stem,
                "state": "staged_unapproved",
                "text": text,
            })
    return documents


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold", type=float, default=0.88)
    parser.add_argument("--min-words", type=int, default=30)
    parser.add_argument("--output", default="data/staging/duplicate-audit.json")
    args = parser.parse_args()

    documents = current_documents() + staged_documents()
    index = NearDuplicateIndex(threshold=args.threshold, min_words=args.min_words)
    duplicates = []
    states = Counter()
    sources = Counter()
    words = 0
    metadata_by_id = {}
    for document in documents:
        states[document["state"]] += 1
        sources[document["source_id"]] += 1
        words += len(tokens(document["text"]))
        metadata_by_id[document["id"]] = document
        match = index.add_or_match(document["id"], document["text"])
        if match:
            row = match.to_dict()
            kept = metadata_by_id[match.kept_id]
            row.update({
                "duplicate_state": document["state"],
                "kept_state": kept["state"],
                "duplicate_source": document["source_id"],
                "kept_source": kept["source_id"],
            })
            duplicates.append(row)

    kinds = Counter(row["kind"] for row in duplicates)
    relationships = Counter(f"{row['duplicate_state']}->{row['kept_state']}" for row in duplicates)
    report = {
        "status": "ANALYSIS_ONLY_NO_TRAINING_APPROVAL",
        "threshold": args.threshold,
        "minimum_words_for_near_duplicate_check": args.min_words,
        "documents_scanned": len(documents),
        "documents_by_state": dict(states),
        "documents_by_source": dict(sources),
        "words_scanned": words,
        "unique_documents_kept": len(index.documents),
        "duplicates": {
            "exact": kinds["exact"],
            "near": kinds["near"],
            "total": len(duplicates),
            "by_relationship": dict(relationships),
        },
        "duplicate_pairs": duplicates,
    }
    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
