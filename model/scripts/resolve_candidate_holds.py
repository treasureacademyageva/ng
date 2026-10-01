#!/usr/bin/env python3
"""Apply exact hash-bound dispositions without granting human approval.

Five known automated holds are resolved for staging only. CC BY-SA and
US-public-domain items are fail-closed as licence-excluded. Review-packet and
scan-report states are synchronised, while all generated human decisions remain
PENDING and every candidate remains ineligible for training.
"""
from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "data/source-candidates.json"
REVIEW_PACKET = ROOT / "data/reviews/candidate-intake-review.csv"

STAGING_RESOLUTIONS = {
    "storybooks-nigeria-en-0262": {
        "code": "ACCEPT_INTENTIONAL_STORY_REPETITION_FOR_STAGING",
        "reason": "Repeated dialogue is internal to the source story and is retained as intentional narrative repetition.",
        "original_sha256": "17cca581cb243f9aee884c7405434c7c0474c4b1a5f3fc435c9652d3e38fd1f6",
        "extracted_sha256": "a9efa00ae6816367376c4b8ac5a83bdd47923edceca596b6ea9cc11f5f6edb1e",
    },
    "storybooks-nigeria-ha-0087": {
        "code": "ACCEPT_EARLY_READER_REFRAIN_FOR_STAGING",
        "reason": "The repeated question is an intentional early-reader refrain, not corpus padding.",
        "original_sha256": "d19091b05e35c522ac35eea875ad850cd4ce9d30ae9026ea8f4c3aeab299e89a",
        "extracted_sha256": "286335a670aedd078ba417474f008deb6a0629bdbf0a33f14fa4fba2850ae5a2",
    },
    "storybooks-nigeria-yo-0087": {
        "code": "ACCEPT_EARLY_READER_REFRAIN_FOR_STAGING",
        "reason": "The repeated question is an intentional early-reader refrain, not corpus padding.",
        "original_sha256": "16f41809aa6869691aa3d1a13d4eab549de11d5dad8b03756aa38cb503397631",
        "extracted_sha256": "22f81c6484fa08b21667fbac251241c9e6949a707c911ca77c687e239384e787",
    },
    "storybooks-nigeria-yo-0302": {
        "code": "ACCEPT_SHORT_EARLY_READER_FOR_STAGING",
        "reason": "The complete source is a deliberately short beginning reader; short length is retained and still needs teacher/safeguarding review.",
        "original_sha256": "d15d40529dbc299459a065df00f15ab4911168d4a3a6fec61b3ce6785a7f1f17",
        "extracted_sha256": "6fc5ca1ff653f9a3aba19d03bd4458bed3e8d55fd8ccc8a64d922cc5c41c3517",
    },
    "siyavula-mathematics-grade-6-cnx-col11030": {
        "code": "PRIVACY_FALSE_POSITIVE_ARITHMETIC_OCR",
        "reason": "The masked warning is an OCR arithmetic puzzle beginning with a plus sign, not a phone number or personal record.",
        "original_sha256": "3aeaae7f7a90b298be587bb1d00b1729eb212cf91d3b0de35fd8a20496971e52",
        "extracted_sha256": "ee20e9c0e2598980265dce858e960de0932aba00883847b82de056a9b9cfa5f7",
    },
}

REVIEW_FIELDS = [
    "item_id", "original_sha256", "extracted_sha256", "title", "creator", "language",
    "primary_subject", "context_class", "license", "source_url", "staging_status",
    "licence_decision", "licence_reviewer_name", "licence_reviewer_role", "licence_reviewed_at", "licence_notes",
    "teacher_decision", "teacher_reviewer_name", "teacher_reviewer_role", "teacher_reviewed_at", "teacher_notes",
    "safeguarding_decision", "safeguarding_reviewer_name", "safeguarding_reviewer_role",
    "safeguarding_reviewed_at", "safeguarding_notes",
    "language_decision", "language_reviewer_name", "language_reviewer_role", "language_reviewed_at", "language_notes",
    "approval_decision", "approval_reviewer_name", "approval_reviewer_role", "approval_reviewed_at", "approval_notes",
]
DECISION_FIELDS = {field for field in REVIEW_FIELDS if any(
    token in field for token in ("decision", "reviewer_name", "reviewer_role", "reviewed_at", "_notes")
)}


def sync_review_packet(items: list[dict]) -> None:
    existing = {}
    if REVIEW_PACKET.exists():
        with REVIEW_PACKET.open(newline="", encoding="utf-8") as handle:
            existing = {row["item_id"]: row for row in csv.DictReader(handle)}
    rows = []
    for item in items:
        row = {
            "item_id": item["id"], "original_sha256": item["original_sha256"],
            "extracted_sha256": item["extracted_sha256"], "title": item["title"],
            "creator": item["creator"], "language": item["language"],
            "primary_subject": item["primary_subject"], "context_class": item["context_class"],
            "license": item["license"]["identifier"], "source_url": item["source_url"],
            "staging_status": item["staging_status"],
        }
        for field in REVIEW_FIELDS:
            row.setdefault(field, "PENDING" if field.endswith("_decision") else "")
        prior = existing.get(item["id"], {})
        if (prior.get("original_sha256") == row["original_sha256"]
                and prior.get("extracted_sha256") == row["extracted_sha256"]):
            for field in DECISION_FIELDS:
                row[field] = prior.get(field, row[field])
        rows.append(row)
    with REVIEW_PACKET.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=REVIEW_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def sync_scan_report(path: Path, items_by_id: dict[str, dict]) -> None:
    if not path.exists():
        return
    report = json.loads(path.read_text(encoding="utf-8"))
    results = report.get("results", [])
    for result in results:
        item = items_by_id.get(result.get("id"))
        if not item:
            continue
        result["status"] = item["staging_status"]
        if item.get("automated_hold_resolution"):
            result["automated_hold_resolution"] = item["automated_hold_resolution"]
            result["quarantine_reasons"] = []
        if item.get("licence_disposition"):
            result["licence_disposition"] = item["licence_disposition"]
    report["status"] = "POST_SCAN_DISPOSITIONS_RECORDED_NO_TRAINING_APPROVAL"
    report["status_counts"] = dict(sorted(Counter(row.get("status", "") for row in results).items()))
    report["resolved_automated_holds"] = sum(bool(row.get("automated_hold_resolution")) for row in results)
    report["licence_excluded_items"] = sum(row.get("status") == "LICENSE_EXCLUDED" for row in results)
    report["training_approved_items"] = 0
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    by_id = {item["id"]: item for item in data["items"]}
    errors = []
    resolved = []
    for item_id, disposition in STAGING_RESOLUTIONS.items():
        item = by_id.get(item_id)
        if not item:
            errors.append(f"missing item: {item_id}")
            continue
        item_errors = []
        for field in ("original_sha256", "extracted_sha256"):
            if item.get(field) != disposition[field]:
                item_errors.append(f"{item_id}: {field} differs from reviewed resolution hash")
        if item_errors:
            errors.extend(item_errors)
            continue
        prior = item.get("automated_hold_resolution") or {}
        prior_reason = prior.get("prior_reason", item.get("rejection_reason"))
        item.update({
            "staging_status": "STAGED_UNAPPROVED", "review_status": "PENDING_HUMAN_REVIEW",
            "approval_status": "NOT_APPROVED", "training_eligible": False, "rejection_reason": None,
            "automated_hold_resolution": {
                "code": disposition["code"], "reason": disposition["reason"], "resolved_at": "2026-09-30",
                "original_sha256": disposition["original_sha256"],
                "extracted_sha256": disposition["extracted_sha256"], "prior_reason": prior_reason,
                "scope": "staging only; no human or training approval",
            },
        })
        resolved.append(item_id)

    licence_excluded = []
    for item in data["items"]:
        licence = item.get("license", {}).get("identifier")
        if licence not in {"CC-BY-SA-4.0", "US-PUBLIC-DOMAIN"}:
            continue
        reason = (
            "Excluded from training because downstream share-alike treatment for model artefacts has not been legally approved."
            if licence == "CC-BY-SA-4.0"
            else "Excluded from training because Project Gutenberg verifies US public-domain status only and Nigerian-jurisdiction clearance is not recorded."
        )
        item.update({
            "staging_status": "LICENSE_EXCLUDED", "review_status": "LICENCE_HOLD",
            "approval_status": "NOT_APPROVED", "training_eligible": False, "rejection_reason": reason,
            "licence_disposition": {
                "decision": "EXCLUDE_FROM_TRAINING", "reason": reason, "decided_at": "2026-09-30",
                "basis": "fail-closed project policy; not legal advice",
            },
        })
        licence_excluded.append(item["id"])

    if errors:
        raise SystemExit("\n".join(errors))
    REGISTRY.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    sync_review_packet(data["items"])
    sync_scan_report(ROOT / "reports/candidate-staging-report.json", by_id)
    sync_scan_report(ROOT / "reports/storybook-candidate-scan.json", by_id)
    report = {
        "version": 1, "status": "DISPOSITIONS_RECORDED_NO_TRAINING_APPROVAL",
        "staging_holds_resolved": resolved, "licence_excluded_items": licence_excluded,
        "language_review_policy": "OWNER_DEFERRED_FOR_CURRENT_EXPERIMENTAL_CORPUS",
        "human_review_decisions_filled": 0, "training_approved_items": 0,
    }
    output = ROOT / "reports/candidate-dispositions.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
