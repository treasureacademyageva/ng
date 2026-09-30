#!/usr/bin/env python3
"""Validate fail-closed NAPPS alignment metadata without approving source text."""
from __future__ import annotations

import csv
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/authoring/napps-alignment-sources.json"
ALIGNMENT = ROOT / "data/authoring/napps-primary-english-mathematics-alignment.csv"
HEX64 = re.compile(r"^[0-9a-f]{64}$")
EXPECTED_COMBINATIONS = {
    (str(primary_class), subject, term)
    for primary_class in range(1, 7)
    for subject in ("english", "mathematics")
    for term in ("first", "second", "third")
}


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    with ALIGNMENT.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    errors = []
    warnings = []
    ids = [row.get("alignment_id", "") for row in rows]
    if not ids or len(ids) != len(set(ids)) or any(not value for value in ids):
        errors.append("alignment IDs are missing or duplicated")
    source_by_id = {source["id"]: source for source in manifest["public_alignment_sources"]}
    if len(source_by_id) != 6 or set(source["primary_class"] for source in source_by_id.values()) != set(range(1, 7)):
        errors.append("source manifest must contain one public alignment source for every Primary class")
    combinations = Counter()
    for row in rows:
        alignment_id = row.get("alignment_id", "unknown")
        combination = (row.get("primary_class", ""), row.get("subject", ""), row.get("term", ""))
        combinations[combination] += 1
        source = source_by_id.get(row.get("source_id", ""))
        if not source:
            errors.append(f"{alignment_id}: unknown source ID")
            continue
        if row.get("source_url") != source["url"] or row.get("source_modified_at") != source["modified_at"]:
            errors.append(f"{alignment_id}: source provenance mismatch")
        if row.get("primary_class") != str(source["primary_class"]):
            errors.append(f"{alignment_id}: source/class mismatch")
        if not HEX64.fullmatch(row.get("source_topic_index_sha256", "")):
            errors.append(f"{alignment_id}: invalid canonical topic-index SHA-256")
        if row.get("verification_status") != "ALIGNED_TO_2025_NATIONAL_STRUCTURE_NOT_NAPPS_ISSUED":
            errors.append(f"{alignment_id}: national-structure alignment status mismatch")
        if row.get("training_eligible") != "false":
            errors.append(f"{alignment_id}: alignment source must not be training eligible")
        if row.get("authoring_status") != "READY_FOR_ORIGINAL_AUTHORING":
            errors.append(f"{alignment_id}: owner-authorized planning status mismatch")
        if row.get("instructional") not in {"true", "false"}:
            errors.append(f"{alignment_id}: invalid instructional flag")
        topic = row.get("topic", "")
        if not topic or len(topic) > 140:
            errors.append(f"{alignment_id}: missing or overlong topic heading")
    found_combinations = set(combinations)
    if found_combinations != EXPECTED_COMBINATIONS:
        errors.append(
            f"class/subject/term coverage mismatch; missing={sorted(EXPECTED_COMBINATIONS - found_combinations)}, "
            f"extra={sorted(found_combinations - EXPECTED_COMBINATIONS)}"
        )
    for combination, count in sorted(combinations.items()):
        if count < 8:
            warnings.append(f"{combination}: only {count} public schedule rows; official school copy must confirm completeness")
    official_verified = manifest["official_status"]["latest_official_edition_verified"]
    if official_verified:
        errors.append("official latest-edition verification cannot be true without a hash-bound school-supplied document record")
    if manifest["alignment_policy"]["training_eligible"]:
        errors.append("alignment policy must remain non-training")
    if not manifest["alignment_policy"]["owner_authorized_for_original_authoring"]:
        errors.append("owner planning authorization is missing")
    if manifest["national_curriculum_crosscheck"]["status"] != "ALIGNED_AT_STRUCTURE_AND_PEDAGOGY_LEVEL":
        errors.append("new national curriculum cross-check status mismatch")
    report = {
        "manifest": str(MANIFEST.relative_to(ROOT)),
        "alignment": str(ALIGNMENT.relative_to(ROOT)),
        "sources": len(source_by_id),
        "rows": len(rows),
        "instructional_rows": sum(row.get("instructional") == "true" for row in rows),
        "class_subject_term_combinations": len(found_combinations),
        "official_napps_edition_verified": official_verified,
        "training_eligible_rows": sum(row.get("training_eligible") == "true" for row in rows),
        "authoring_ready_rows": sum(row.get("authoring_status") == "READY_FOR_ORIGINAL_AUTHORING" for row in rows),
        "warnings": warnings,
        "errors": errors,
    }
    print(json.dumps(report, indent=2))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
