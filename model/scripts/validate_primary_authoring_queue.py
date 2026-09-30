#!/usr/bin/env python3
"""Validate the original Nigerian primary maths/English authoring queue."""
from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "data/authoring/primary-math-english-briefs.csv"
REQUIRED_FIELDS = {
    "brief_id", "brief_sha256", "subject", "coverage_tag", "primary_class", "topic",
    "required_formats", "pilot_documents", "full_target_documents", "target_words_per_document",
    "nigerian_context_requirement", "brief_status", "assigned_author", "notes",
}
ALLOWED_STATUS = {"NOT_STARTED", "ASSIGNED", "DRAFTING", "PILOT_DRAFT_COMPLETE", "ON_HOLD"}


def main() -> None:
    errors = []
    with QUEUE.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        fields = set(reader.fieldnames or [])
    missing_fields = sorted(REQUIRED_FIELDS - fields)
    if missing_fields:
        errors.append(f"missing fields: {', '.join(missing_fields)}")
    ids = [row.get("brief_id", "") for row in rows]
    if len(ids) != len(set(ids)) or any(not value for value in ids):
        errors.append("duplicate or missing brief_id")
    subjects = Counter()
    classes = Counter()
    statuses = Counter()
    full_documents = 0
    target_words = 0
    for row in rows:
        brief_id = row.get("brief_id", "unknown")
        subject = row.get("subject", "")
        subjects[subject] += 1
        classes[f"{subject}:p{row.get('primary_class', '')}"] += 1
        status = row.get("brief_status", "")
        statuses[status] += 1
        if status not in ALLOWED_STATUS:
            errors.append(f"{brief_id}: invalid brief_status {status!r}")
        if status in {"ASSIGNED", "DRAFTING", "PILOT_DRAFT_COMPLETE"} and not row.get("assigned_author", "").strip():
            errors.append(f"{brief_id}: status {status} requires assigned_author")
        if len(row.get("brief_sha256", "")) != 64:
            errors.append(f"{brief_id}: invalid brief_sha256")
        try:
            primary_class = int(row["primary_class"])
            pilot = int(row["pilot_documents"])
            full = int(row["full_target_documents"])
            words = int(row["target_words_per_document"])
        except (KeyError, ValueError):
            errors.append(f"{brief_id}: invalid numeric field")
            continue
        if primary_class not in range(1, 7) or not (0 < pilot <= full) or words < 150:
            errors.append(f"{brief_id}: numeric targets outside policy")
        full_documents += full
        target_words += full * words
        expected_tag = {
            "mathematics": "nigerian_primary_mathematics",
            "english": "nigerian_english_reading_composition",
        }.get(subject)
        if row.get("coverage_tag") != expected_tag:
            errors.append(f"{brief_id}: subject/coverage tag mismatch")
    if len(rows) != 96:
        errors.append(f"expected 96 briefs, found {len(rows)}")
    if subjects != Counter({"mathematics": 48, "english": 48}):
        errors.append(f"subject distribution is {dict(subjects)}")
    if any(classes[f"{subject}:p{grade}"] != 8 for subject in ("mathematics", "english") for grade in range(1, 7)):
        errors.append("every subject/class combination must contain eight briefs")
    report = {
        "queue": str(QUEUE.relative_to(ROOT)),
        "briefs": len(rows),
        "subjects": dict(subjects),
        "statuses": dict(statuses),
        "full_target_documents": full_documents,
        "approximate_full_target_words": target_words,
        "training_approved_documents": 0,
        "errors": errors,
    }
    print(json.dumps(report, indent=2))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
