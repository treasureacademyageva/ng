#!/usr/bin/env python3
"""Validate item-level candidate provenance and fail closed on approvals."""
from __future__ import annotations

import csv
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEX64 = re.compile(r"[0-9a-f]{64}")
REQUIRED_ITEM_FIELDS = {
    "id", "title", "creator", "publisher", "external_item_id", "source_url", "acquisition_url",
    "source_revision", "provenance", "language", "level", "primary_subject", "secondary_subjects", "coverage_tags",
    "context_class", "context_evidence", "license", "attribution", "expected_content_types",
    "extraction_method", "managed_by", "acquisition_status", "review_status", "staging_status",
    "approval_status", "training_eligible", "rejection_reason", "original_sha256", "extracted_sha256",
    "metrics", "privacy", "quality", "duplicates",
}
REQUIRED_LICENSE_FIELDS = {
    "identifier", "status", "url", "evidence_url", "attribution", "commercial_use", "derivatives",
    "share_alike", "jurisdiction",
}


def main() -> None:
    registry = json.loads((ROOT / "data/source-candidates.json").read_text(encoding="utf-8"))
    policy = json.loads((ROOT / "data/candidate-intake-policy.json").read_text(encoding="utf-8"))
    errors: list[str] = []
    ids = set()
    status_counts = Counter()
    subject_counts = Counter()
    context_counts = Counter()
    for item in registry.get("items", []):
        item_id = item.get("id", "")
        if not item_id or item_id in ids:
            errors.append(f"duplicate or missing item id: {item_id!r}")
        ids.add(item_id)
        missing = sorted(REQUIRED_ITEM_FIELDS - set(item))
        if missing:
            errors.append(f"{item_id}: missing {', '.join(missing)}")
            continue
        status_counts[item["staging_status"]] += 1
        subject_counts[item["primary_subject"]] += 1
        context_counts[item["context_class"]] += 1
        if item["primary_subject"] not in policy["canonical_primary_subjects"]:
            errors.append(f"{item_id}: noncanonical primary subject")
        if any(value not in policy["canonical_primary_subjects"] for value in item["secondary_subjects"]):
            errors.append(f"{item_id}: noncanonical secondary subject")
        if item["context_class"] not in policy["context_classes"]:
            errors.append(f"{item_id}: invalid context class")
        context = item.get("context_evidence") or {}
        if not all(context.get(field) for field in ("basis", "evidence_url", "excerpt")):
            errors.append(f"{item_id}: incomplete context evidence")
        licence = item.get("license") or {}
        missing_licence = sorted(REQUIRED_LICENSE_FIELDS - set(licence))
        if missing_licence:
            errors.append(f"{item_id}: incomplete licence fields: {', '.join(missing_licence)}")
        if licence.get("identifier") in set(policy["commercial_compatible_licenses"]) | set(policy["conditional_licenses"]):
            if licence.get("commercial_use") is not True or licence.get("derivatives") is not True:
                errors.append(f"{item_id}: open licence flags disagree")
        if item["training_eligible"] is not False:
            errors.append(f"{item_id}: candidate registry cannot grant training eligibility")
        if item["approval_status"] not in {"NOT_APPROVED", "REJECTED"}:
            errors.append(f"{item_id}: invalid approval status")
        if item["staging_status"] in {"STAGED_UNAPPROVED", "LICENSE_EXCLUDED", "QUARANTINED"}:
            if not HEX64.fullmatch(item.get("original_sha256") or ""):
                errors.append(f"{item_id}: staged original hash missing")
            if not HEX64.fullmatch(item.get("extracted_sha256") or ""):
                errors.append(f"{item_id}: staged extracted hash missing")
            metrics = item.get("metrics") or {}
            if not all(isinstance(metrics.get(field), int) and metrics[field] >= 0 for field in (
                "characters", "words", "estimated_bpe_tokens"
            )):
                errors.append(f"{item_id}: staged metrics incomplete")
        if item["staging_status"] == "QUARANTINED" and not item.get("rejection_reason"):
            errors.append(f"{item_id}: quarantine reason missing")
        if item["staging_status"] == "LICENSE_EXCLUDED":
            if licence.get("identifier") not in policy["conditional_licenses"]:
                errors.append(f"{item_id}: only conditional licences may use LICENSE_EXCLUDED")
            if item.get("review_status") != "LICENCE_HOLD" or not item.get("rejection_reason"):
                errors.append(f"{item_id}: licence exclusion must retain hold and reason")
            if (item.get("licence_disposition") or {}).get("decision") != "EXCLUDE_FROM_TRAINING":
                errors.append(f"{item_id}: licence exclusion disposition missing")
        resolution = item.get("automated_hold_resolution")
        if resolution:
            if item["staging_status"] != "STAGED_UNAPPROVED":
                errors.append(f"{item_id}: resolved hold must remain staged-unapproved")
            if resolution.get("original_sha256") != item["original_sha256"] or resolution.get("extracted_sha256") != item["extracted_sha256"]:
                errors.append(f"{item_id}: automated hold resolution is not hash-bound")
            if resolution.get("scope") != "staging only; no human or training approval":
                errors.append(f"{item_id}: automated hold resolution scope is invalid")

    expected_subjects = set(policy["canonical_primary_subjects"])
    covered_subjects = set(subject_counts)
    for item in registry.get("items", []):
        covered_subjects.update(item.get("secondary_subjects", []))
    if not expected_subjects <= covered_subjects:
        errors.append(f"item registry does not cover all canonical subjects: {sorted(expected_subjects - covered_subjects)}")

    review_path = ROOT / "data/reviews/candidate-intake-review.csv"
    with review_path.open(newline="", encoding="utf-8") as handle:
        reviews = list(csv.DictReader(handle))
    review_ids = [row.get("item_id", "") for row in reviews]
    if len(review_ids) != len(set(review_ids)):
        errors.append("candidate review packet has duplicate item IDs")
    if set(review_ids) != {
        item["id"] for item in registry["items"] if item.get("original_sha256") and item.get("extracted_sha256")
    }:
        errors.append("candidate review packet does not match hash-bound staged items")
    for row in reviews:
        item = next(value for value in registry["items"] if value["id"] == row["item_id"])
        if row["original_sha256"] != item["original_sha256"] or row["extracted_sha256"] != item["extracted_sha256"]:
            errors.append(f"{row['item_id']}: review packet hash mismatch")
        if row.get("staging_status") != item["staging_status"]:
            errors.append(f"{row['item_id']}: review packet staging status mismatch")
        for field in ("licence_decision", "teacher_decision", "safeguarding_decision", "language_decision", "approval_decision"):
            if row.get(field) != "PENDING":
                errors.append(f"{row['item_id']}: {field} must remain PENDING in generated packet")

    pre_review_path = ROOT / "reports/candidate-pre-review.json"
    if not pre_review_path.exists():
        errors.append("candidate automated pre-review report is missing")
        pre_review = {"results": []}
    else:
        pre_review = json.loads(pre_review_path.read_text(encoding="utf-8"))
    pre_review_results = pre_review.get("results", [])
    pre_review_by_id = {row.get("id"): row for row in pre_review_results}
    if set(pre_review_by_id) != ids or len(pre_review_results) != len(ids):
        errors.append("candidate automated pre-review does not cover each item exactly once")
    for item in registry.get("items", []):
        result = pre_review_by_id.get(item["id"])
        if not result:
            continue
        hashes = result.get("hashes") or {}
        if hashes.get("original_sha256") != item["original_sha256"] or hashes.get("extracted_sha256") != item["extracted_sha256"]:
            errors.append(f"{item['id']}: automated pre-review hash mismatch")
        if result.get("teacher_review") != "PENDING_NAMED_HUMAN" or result.get("safeguarding_review") != "PENDING_NAMED_HUMAN":
            errors.append(f"{item['id']}: automated pre-review may not fill human reviews")
        if result.get("final_approval") != "PENDING_NAMED_HUMAN" or result.get("training_approved") is not False:
            errors.append(f"{item['id']}: automated pre-review may not grant approval")
        should_hold = item["staging_status"] == "LICENSE_EXCLUDED"
        if bool(result.get("automated_blockers")) != should_hold:
            errors.append(f"{item['id']}: automated pre-review blocker state mismatch")

    report = {
        "schema": registry.get("schema"),
        "preserved_research_collections": len(registry.get("candidates", [])),
        "item_candidates": len(registry.get("items", [])),
        "staging_statuses": dict(sorted(status_counts.items())),
        "primary_subjects": dict(sorted(subject_counts.items())),
        "contexts": dict(sorted(context_counts.items())),
        "review_rows": len(reviews),
        "training_eligible_items": sum(bool(item.get("training_eligible")) for item in registry.get("items", [])),
        "errors": errors,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
