#!/usr/bin/env python3
"""Build the hash-bound manifest for the balanced private original-content pilot."""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "data/authoring/primary-math-english-briefs.csv"
RIGHTS = ROOT / "data/authoring/rights-confirmation.json"
OUTPUT = ROOT / "data/authoring/pilot-balanced-v1-review.csv"
FIELDS = [
    "sample_id", "brief_id", "brief_sha256", "subject", "coverage_tag", "primary_class", "topic",
    "responsible_creator", "creator_type", "rights_holder", "rights_status", "open_license",
    "draft_status", "content_sha256", "teacher_decision", "teacher_reviewer_name", "teacher_reviewer_role",
    "teacher_reviewed_at", "safeguarding_decision", "safeguarding_reviewer_name",
    "safeguarding_reviewer_role", "safeguarding_reviewed_at", "approved_for_training", "notes",
]
PRESERVED = {
    "creator_type", "draft_status", "content_sha256", "teacher_decision", "teacher_reviewer_name",
    "teacher_reviewer_role", "teacher_reviewed_at", "safeguarding_decision", "safeguarding_reviewer_name",
    "safeguarding_reviewer_role", "safeguarding_reviewed_at", "approved_for_training", "notes",
}


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def main() -> None:
    briefs = read_csv(QUEUE)
    previous = {row["sample_id"]: row for row in read_csv(OUTPUT)}
    rights = json.loads(RIGHTS.read_text(encoding="utf-8"))
    rows = []
    for brief in briefs:
        sample_id = f"pilot-v1-{brief['brief_id']}"
        row = {
            "sample_id": sample_id,
            "brief_id": brief["brief_id"],
            "brief_sha256": brief["brief_sha256"],
            "subject": brief["subject"],
            "coverage_tag": brief["coverage_tag"],
            "primary_class": brief["primary_class"],
            "topic": brief["topic"],
            "responsible_creator": rights["rights_holder"],
            "creator_type": "AI_ASSISTED_PLANNED",
            "rights_holder": rights["rights_holder"],
            "rights_status": rights["status"],
            "open_license": "",
            "draft_status": "NOT_STARTED",
            "content_sha256": "",
            "teacher_decision": "PENDING",
            "teacher_reviewer_name": "",
            "teacher_reviewer_role": "",
            "teacher_reviewed_at": "",
            "safeguarding_decision": "PENDING",
            "safeguarding_reviewer_name": "",
            "safeguarding_reviewer_role": "",
            "safeguarding_reviewed_at": "",
            "approved_for_training": "false",
            "notes": "Private draft text must stay in ignored staging; commit only this hash-bound review record.",
        }
        old = previous.get(sample_id, {})
        if old.get("brief_sha256") == row["brief_sha256"]:
            for field in PRESERVED:
                row[field] = old.get(field, row[field])
        rows.append(row)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(json.dumps({
        "pilot": "balanced-v1",
        "samples": len(rows),
        "rights_status": rights["status"],
        "drafts_started": sum(row["draft_status"] != "NOT_STARTED" for row in rows),
        "training_approved": sum(row["approved_for_training"].lower() == "true" for row in rows),
    }, indent=2))


if __name__ == "__main__":
    main()
