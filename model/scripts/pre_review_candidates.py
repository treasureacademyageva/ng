#!/usr/bin/env python3
"""Produce automated pre-review evidence while leaving human decisions untouched."""
from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    registry = json.loads((ROOT / "data/source-candidates.json").read_text(encoding="utf-8"))
    packet_path = ROOT / "data/reviews/candidate-intake-review.csv"
    with packet_path.open(newline="", encoding="utf-8") as handle:
        packet = {row["item_id"]: row for row in csv.DictReader(handle)}
    results = []
    for item in registry["items"]:
        review = packet[item["id"]]
        if any(review[field] != "PENDING" for field in (
            "licence_decision", "teacher_decision", "safeguarding_decision", "approval_decision"
        )):
            raise SystemExit(f"{item['id']}: generated human decisions must remain PENDING")
        licence_hold = item.get("staging_status") == "LICENSE_EXCLUDED"
        quality_errors = []
        quality = item.get("quality") or {}
        if isinstance(quality.get("errors"), list):
            quality_errors.extend(quality["errors"])
        for phase in ("before_deduplication", "after_deduplication"):
            quality_errors.extend((quality.get(phase) or {}).get("errors", []))
        privacy_warnings = len((item.get("privacy") or {}).get("warnings", []))
        privacy_resolved = bool((item.get("automated_hold_resolution") or {}).get("code") == "PRIVACY_FALSE_POSITIVE_ARITHMETIC_OCR")
        leakage_blocked = bool((item.get("leakage") or {}).get("blocked"))
        automated_blockers = []
        if licence_hold:
            automated_blockers.append("licence disposition excludes training")
        if quality_errors and not item.get("automated_hold_resolution"):
            automated_blockers.extend(quality_errors)
        if privacy_warnings and not privacy_resolved:
            automated_blockers.append("unresolved privacy warning")
        if leakage_blocked:
            automated_blockers.append("held-out leakage")
        results.append({
            "id": item["id"],
            "hashes": {
                "original_sha256": item["original_sha256"],
                "extracted_sha256": item["extracted_sha256"],
            },
            "automated_licence_precheck": "HOLD_EXCLUDED" if licence_hold else "EVIDENCE_COMPLETE",
            "automated_quality_precheck": "NO_BLOCKER" if not quality_errors or item.get("automated_hold_resolution") else "HOLD",
            "automated_privacy_precheck": "NO_BLOCKER" if not privacy_warnings or privacy_resolved else "HOLD",
            "automated_leakage_precheck": "NO_BLOCKER" if not leakage_blocked else "HOLD",
            "language_review": "NOT_REQUIRED_CURRENT_OWNER_POLICY",
            "teacher_review": "PENDING_NAMED_HUMAN",
            "safeguarding_review": "PENDING_NAMED_HUMAN",
            "final_approval": "PENDING_NAMED_HUMAN",
            "automated_blockers": automated_blockers,
            "ready_for_human_review": not automated_blockers,
            "training_approved": False,
        })
    report = {
        "version": 1,
        "status": "AUTOMATED_PRE_REVIEW_ONLY_HUMAN_DECISIONS_UNCHANGED",
        "items": len(results),
        "ready_for_human_review": sum(row["ready_for_human_review"] for row in results),
        "held_or_excluded": sum(not row["ready_for_human_review"] for row in results),
        "licence_prechecks": dict(Counter(row["automated_licence_precheck"] for row in results)),
        "language_review_policy": "NOT_REQUIRED_CURRENT_OWNER_POLICY",
        "named_teacher_approvals": 0,
        "named_safeguarding_approvals": 0,
        "training_approved_items": 0,
        "results": results,
    }
    output = ROOT / "reports/candidate-pre-review.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
