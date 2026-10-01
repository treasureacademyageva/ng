#!/usr/bin/env python3
"""Record structural, privacy and duplication checks for private pilot drafts.

This report is automated evidence only. It never supplies curriculum, teacher,
safeguarding or final training approval.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

from deduplication import NearDuplicateIndex
from generate_primary_pilot_drafts import build_content, words

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "data/authoring/primary-math-english-briefs.csv"
PILOT = ROOT / "data/authoring/pilot-balanced-v1-review.csv"
POLICY = ROOT / "data/candidate-intake-policy.json"
OUTPUT = ROOT / "reports/primary-pilot-pre-review.json"
REQUIRED_HEADINGS = [
    "LEARNING PURPOSE", "LESSON EXPLANATION", "MODEL OR WORKED EXAMPLE",
    "GUIDED PRACTICE", "INDEPENDENT PRACTICE", "ANSWER AND REVIEW GUIDE", "CLOSING CHECK",
]
PROHIBITED_ALIGNMENT_CLAIMS = [
    "napps-issued", "official napps", "issued by napps", "nerdc lesson text",
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def main() -> None:
    briefs = read_csv(QUEUE)
    pilot = {row["brief_id"]: row for row in read_csv(PILOT)}
    policy = json.loads(POLICY.read_text(encoding="utf-8"))
    privacy_patterns = {
        name: re.compile(pattern, re.IGNORECASE)
        for name, pattern in policy["privacy_patterns"].items()
    }
    duplicate_index = NearDuplicateIndex(threshold=0.88, min_words=30)
    results = []
    for index, brief in enumerate(briefs):
        row = pilot[brief["brief_id"]]
        content = build_content(brief, index)
        digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
        blockers = []
        heading_checks = {heading: f"\n{heading}\n" in f"\n{content}\n" for heading in REQUIRED_HEADINGS}
        if not all(heading_checks.values()):
            blockers.append("required lesson section missing")
        word_count = words(content)
        target = int(brief["target_words_per_document"])
        if word_count < target:
            blockers.append("below brief word target")
        if word_count > 600:
            blockers.append("above pilot concision limit")
        if digest != row["content_sha256"]:
            blockers.append("manifest content hash mismatch")
        privacy_hits = {
            name: len(pattern.findall(content))
            for name, pattern in privacy_patterns.items()
            if pattern.search(content)
        }
        if privacy_hits:
            blockers.append("potential personal-data pattern")
        url_count = len(re.findall(r"https?://|www\.", content, re.IGNORECASE))
        if url_count:
            blockers.append("unexpected URL in original draft")
        claim_hits = [claim for claim in PROHIBITED_ALIGNMENT_CLAIMS if claim in content.casefold()]
        if claim_hits:
            blockers.append("prohibited NAPPS/NERDC source claim")
        duplicate = duplicate_index.add_or_match(row["sample_id"], content)
        if duplicate:
            blockers.append(f"{duplicate.kind} duplicate of {duplicate.kept_id}")
        if row["creator_type"] != "AI_ASSISTED" or row["draft_status"] != "DRAFTED":
            blockers.append("draft provenance/status mismatch")
        if row["teacher_decision"] != "PENDING" or row["safeguarding_decision"] != "PENDING":
            blockers.append("generated human decision is not pending")
        if row["approved_for_training"].lower() != "false":
            blockers.append("draft must not be training-approved")
        results.append({
            "sample_id": row["sample_id"],
            "brief_id": brief["brief_id"],
            "brief_sha256": brief["brief_sha256"],
            "content_sha256": digest,
            "subject": brief["subject"],
            "primary_class": int(brief["primary_class"]),
            "topic": brief["topic"],
            "words": word_count,
            "target_words": target,
            "required_sections": heading_checks,
            "privacy_pattern_hits": privacy_hits,
            "unexpected_urls": url_count,
            "prohibited_alignment_claims": claim_hits,
            "exact_or_near_duplicate": None if not duplicate else {
                "kind": duplicate.kind, "kept_id": duplicate.kept_id, "similarity": duplicate.similarity,
            },
            "automated_blockers": blockers,
            "ready_for_named_teacher_and_safeguarding_review": not blockers,
            "teacher_review": "PENDING_NAMED_HUMAN",
            "safeguarding_review": "PENDING_NAMED_HUMAN",
            "training_approved": False,
        })
    report = {
        "version": 1,
        "checked_at": "2026-10-01",
        "status": "AUTOMATED_PRE_REVIEW_ONLY_HUMAN_DECISIONS_UNCHANGED",
        "scope": "Deterministic structure, hash, length, privacy-pattern, URL, source-claim and exact/near-duplicate checks",
        "limitations": [
            "Curriculum fit requires a qualified Nigerian primary teacher.",
            "Age fit, contextual safety and privacy judgment require the designated safeguarding lead.",
            "Automated checks cannot grant final or training approval.",
        ],
        "documents": len(results),
        "subjects": dict(Counter(row["subject"] for row in results)),
        "classes": dict(Counter(f"P{row['primary_class']}" for row in results)),
        "ready_for_named_human_review": sum(row["ready_for_named_teacher_and_safeguarding_review"] for row in results),
        "held_by_automated_checks": sum(not row["ready_for_named_teacher_and_safeguarding_review"] for row in results),
        "privacy_pattern_hits": sum(sum(row["privacy_pattern_hits"].values()) for row in results),
        "unexpected_urls": sum(row["unexpected_urls"] for row in results),
        "prohibited_alignment_claims": sum(len(row["prohibited_alignment_claims"]) for row in results),
        "exact_or_near_duplicate_documents": sum(row["exact_or_near_duplicate"] is not None for row in results),
        "named_teacher_approvals": 0,
        "named_safeguarding_approvals": 0,
        "training_approved_documents": 0,
        "results": results,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "results"}, indent=2, ensure_ascii=False))
    raise SystemExit(1 if report["held_by_automated_checks"] else 0)


if __name__ == "__main__":
    main()
