#!/usr/bin/env python3
"""Apply general quality, privacy, leakage and duplicate scans to pinned stories."""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from stage_open_candidates import (
    approved_deduper,
    deduplicate_text,
    estimate_bpe_tokens,
    heldout_shingles,
    leakage_scan,
    load_json,
    scan_privacy,
    scan_quality,
    sha256_bytes,
)

ROOT = Path(__file__).resolve().parents[1]
COLLECTIONS = ["english", "pidgin", "hausa", "yoruba"]


def main() -> None:
    policy = load_json(ROOT / "data/candidate-intake-policy.json")
    registry_path = ROOT / "data/source-candidates.json"
    registry = load_json(registry_path)
    by_id = {item["id"]: item for item in registry["items"]}
    benchmark = heldout_shingles()
    index = approved_deduper(policy)
    results = []
    for collection in COLLECTIONS:
        path = ROOT / f"data/staging/storybooks-nigeria-{collection}-cc-by.jsonl"
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            record = json.loads(line)
            item = by_id[record["document_id"]]
            text = record["text"]
            quality = scan_quality(text, policy)
            privacy = scan_privacy(text, policy)
            leakage = leakage_scan(text, benchmark)
            deduplicated, duplicates = deduplicate_text(item["id"], text, index)
            # The specialised output is retained byte-for-byte. A duplicate finding
            # quarantines the item instead of silently rewriting its review hash.
            bpe_tokens, method = estimate_bpe_tokens(text)
            reasons = list(quality["errors"])
            if privacy:
                reasons.append(f"{len(privacy)} potential personal-data pattern(s)")
            if leakage["blocked"]:
                reasons.append("held-out evaluation overlap detected")
            if duplicates["removed_exact"] or duplicates["removed_near"]:
                reasons.append("exact or near duplicate found")
            status = "QUARANTINED" if reasons else "STAGED_UNAPPROVED"
            item.update({
                "staging_status": status,
                "review_status": "PENDING_HUMAN_REVIEW",
                "approval_status": "NOT_APPROVED",
                "training_eligible": False,
                "rejection_reason": "; ".join(reasons) if reasons else None,
                "extracted_sha256": sha256_bytes(text.encode("utf-8")),
                "metrics": {
                    "original_bytes": item.get("metrics", {}).get("original_bytes"),
                    "characters": len(text),
                    "words": quality["words"],
                    "estimated_bpe_tokens": bpe_tokens,
                    "bpe_method": method,
                },
                "privacy": {"status": "WARNING" if privacy else "NO_PATTERN_DETECTED", "warnings": privacy},
                "quality": quality,
                "duplicates": duplicates,
                "leakage": leakage,
            })
            results.append({
                "id": item["id"], "status": status, "quality": quality,
                "privacy": item["privacy"], "duplicates": duplicates, "leakage": leakage,
            })
    registry_path.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    report = {
        "version": 1,
        "status": "SCANNED_STAGED_ONLY_NOT_TRAINING_APPROVED",
        "items": len(results),
        "status_counts": dict(sorted(Counter(row["status"] for row in results).items())),
        "privacy_warning_items": sum(bool(row["privacy"]["warnings"]) for row in results),
        "quality_error_items": sum(bool(row["quality"]["errors"]) for row in results),
        "leakage_blocked_items": sum(row["leakage"]["blocked"] for row in results),
        "duplicate_items": sum(bool(row["duplicates"]["matches"]) for row in results),
        "training_approved_items": 0,
        "results": results,
    }
    output = ROOT / "reports/storybook-candidate-scan.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
