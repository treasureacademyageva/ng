#!/usr/bin/env python3
"""Fail-closed validation for the balanced private primary-content pilot manifest."""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

from generate_primary_pilot_drafts import build_content, words

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "data/authoring/primary-math-english-briefs.csv"
RIGHTS = ROOT / "data/authoring/rights-confirmation.json"
PILOT = ROOT / "data/authoring/pilot-balanced-v1-review.csv"
PRE_REVIEW = ROOT / "reports/primary-pilot-pre-review.json"
HEX64 = re.compile(r"^[0-9a-f]{64}$")
DECISIONS = {"PENDING", "APPROVED", "CHANGES_REQUIRED", "REJECTED"}
DRAFT_STATUSES = {"NOT_STARTED", "DRAFTED", "REVISED", "REJECTED"}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def main() -> None:
    queue_rows = read_csv(QUEUE)
    queue = {row["brief_id"]: row for row in queue_rows}
    queue_index = {row["brief_id"]: index for index, row in enumerate(queue_rows)}
    rows = read_csv(PILOT)
    rights = json.loads(RIGHTS.read_text(encoding="utf-8"))
    errors = []
    seen = set()
    for row in rows:
        sample_id = row.get("sample_id", "")
        brief_id = row.get("brief_id", "")
        brief = queue.get(brief_id)
        if not sample_id or sample_id in seen:
            errors.append(f"duplicate or missing sample_id: {sample_id!r}")
        seen.add(sample_id)
        if not brief:
            errors.append(f"{sample_id}: unknown brief_id {brief_id!r}")
            continue
        if sample_id != f"pilot-v1-{brief_id}":
            errors.append(f"{sample_id}: sample_id/brief_id mismatch")
        if row.get("brief_sha256") != brief["brief_sha256"]:
            errors.append(f"{sample_id}: stale brief hash")
        if row.get("responsible_creator") != rights["rights_holder"] or row.get("rights_holder") != rights["rights_holder"]:
            errors.append(f"{sample_id}: rights holder/responsible creator mismatch")
        if row.get("rights_status") != rights["status"] or row.get("open_license"):
            errors.append(f"{sample_id}: internal-use rights status mismatch")
        draft_status = row.get("draft_status", "")
        if draft_status not in DRAFT_STATUSES:
            errors.append(f"{sample_id}: invalid draft_status {draft_status!r}")
        content_hash = row.get("content_sha256", "")
        if draft_status in {"DRAFTED", "REVISED"} and not HEX64.fullmatch(content_hash):
            errors.append(f"{sample_id}: drafted text requires content_sha256")
        if draft_status == "NOT_STARTED" and content_hash:
            errors.append(f"{sample_id}: NOT_STARTED sample cannot have content hash")
        creator_type = row.get("creator_type", "")
        if creator_type not in {"AI_ASSISTED_PLANNED", "AI_ASSISTED", "HUMAN"}:
            errors.append(f"{sample_id}: invalid creator_type {creator_type!r}")
        if draft_status in {"DRAFTED", "REVISED"} and creator_type == "AI_ASSISTED_PLANNED":
            errors.append(f"{sample_id}: completed draft cannot remain AI_ASSISTED_PLANNED")
        if draft_status == "DRAFTED" and creator_type == "AI_ASSISTED":
            expected_content = build_content(brief, queue_index[brief_id])
            expected_hash = hashlib.sha256(expected_content.encode("utf-8")).hexdigest()
            if content_hash != expected_hash:
                errors.append(f"{sample_id}: content hash differs from deterministic private draft")
            if words(expected_content) < int(brief["target_words_per_document"]):
                errors.append(f"{sample_id}: deterministic private draft is below target words")
        for prefix in ("teacher", "safeguarding"):
            decision = row.get(f"{prefix}_decision", "")
            if decision not in DECISIONS:
                errors.append(f"{sample_id}: invalid {prefix} decision {decision!r}")
            if decision != "PENDING" and not all(row.get(f"{prefix}_{field}", "").strip() for field in ("reviewer_name", "reviewer_role", "reviewed_at")):
                errors.append(f"{sample_id}: non-pending {prefix} decision requires named, dated reviewer")
        approved = row.get("approved_for_training", "").lower()
        if approved not in {"true", "false"}:
            errors.append(f"{sample_id}: approved_for_training must be true or false")
        eligible = (
            draft_status == "REVISED"
            and HEX64.fullmatch(content_hash) is not None
            and row.get("teacher_decision") == "APPROVED"
            and row.get("safeguarding_decision") == "APPROVED"
            and all(row.get(field, "").strip() for field in (
                "teacher_reviewer_name", "teacher_reviewer_role", "teacher_reviewed_at",
                "safeguarding_reviewer_name", "safeguarding_reviewer_role", "safeguarding_reviewed_at",
            ))
        )
        if approved == "true" and not eligible:
            errors.append(f"{sample_id}: training approval violates draft/review gates")
        if eligible and approved != "true":
            errors.append(f"{sample_id}: fully approved record must set approved_for_training true explicitly")
    if len(rows) != len(queue) or set(row.get("brief_id", "") for row in rows) != set(queue):
        errors.append(f"pilot must cover every queue brief exactly once: {len(rows)}/{len(queue)} rows")

    if not PRE_REVIEW.exists():
        errors.append("automated pilot pre-review report is missing")
        pre_review = {"results": []}
    else:
        pre_review = json.loads(PRE_REVIEW.read_text(encoding="utf-8"))
    pre_results = pre_review.get("results", [])
    pre_by_id = {row.get("sample_id"): row for row in pre_results}
    manifest_by_id = {row.get("sample_id"): row for row in rows}
    if set(pre_by_id) != set(manifest_by_id) or len(pre_results) != len(rows):
        errors.append("automated pilot pre-review does not cover every sample exactly once")
    for sample_id, row in manifest_by_id.items():
        result = pre_by_id.get(sample_id)
        if not result:
            continue
        if result.get("content_sha256") != row.get("content_sha256"):
            errors.append(f"{sample_id}: automated pre-review content hash mismatch")
        if result.get("automated_blockers"):
            errors.append(f"{sample_id}: automated pre-review blocker remains")
        if result.get("teacher_review") != "PENDING_NAMED_HUMAN" or result.get("safeguarding_review") != "PENDING_NAMED_HUMAN":
            errors.append(f"{sample_id}: automated pre-review may not fill human decisions")
        if result.get("training_approved") is not False:
            errors.append(f"{sample_id}: automated pre-review may not grant training approval")
    if pre_review.get("held_by_automated_checks") != 0:
        errors.append("automated pilot pre-review must have zero unresolved machine blockers")
    if pre_review.get("training_approved_documents") != 0:
        errors.append("automated pilot pre-review must grant zero training approvals")

    report = {
        "pilot": str(PILOT.relative_to(ROOT)),
        "samples": len(rows),
        "subjects": dict(Counter(row.get("subject", "") for row in rows)),
        "classes": dict(Counter(f"P{row.get('primary_class', '')}" for row in rows)),
        "rights_status": rights["status"],
        "public_corpus_distribution_permitted": rights["public_corpus_distribution_permitted"],
        "draft_statuses": dict(Counter(row.get("draft_status", "") for row in rows)),
        "teacher_decisions": dict(Counter(row.get("teacher_decision", "") for row in rows)),
        "safeguarding_decisions": dict(Counter(row.get("safeguarding_decision", "") for row in rows)),
        "automated_pre_review_ready": pre_review.get("ready_for_named_human_review", 0),
        "automated_pre_review_held": pre_review.get("held_by_automated_checks", 0),
        "training_approved": sum(row.get("approved_for_training", "").lower() == "true" for row in rows),
        "errors": errors,
    }
    print(json.dumps(report, indent=2))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
