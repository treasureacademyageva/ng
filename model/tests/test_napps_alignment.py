import csv
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/authoring/napps-alignment-sources.json"
ALIGNMENT = ROOT / "data/authoring/napps-primary-english-mathematics-alignment.csv"


def alignment_rows():
    with ALIGNMENT.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def test_napps_alignment_covers_all_classes_subjects_and_terms():
    rows = alignment_rows()
    combinations = {(row["primary_class"], row["subject"], row["term"]) for row in rows}
    expected = {
        (str(primary_class), subject, term)
        for primary_class in range(1, 7)
        for subject in ("english", "mathematics")
        for term in ("first", "second", "third")
    }
    assert combinations == expected
    assert len(rows) >= 300
    assert sum(row["instructional"] == "true" for row in rows) >= 200


def test_napps_web_material_is_alignment_only_and_fail_closed():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    rows = alignment_rows()
    assert manifest["official_status"]["latest_official_edition_verified"] is False
    assert manifest["alignment_policy"]["training_eligible"] is False
    assert manifest["alignment_policy"]["copy_source_explanations_or_lessons"] is False
    assert manifest["alignment_policy"]["owner_authorized_for_original_authoring"] is True
    assert manifest["national_curriculum_crosscheck"]["status"] == "ALIGNED_AT_STRUCTURE_AND_PEDAGOGY_LEVEL"
    assert len(manifest["public_alignment_sources"]) == 6
    assert all(row["training_eligible"] == "false" for row in rows)
    assert all(row["authoring_status"] == "READY_FOR_ORIGINAL_AUTHORING" for row in rows)
    assert all(row["verification_status"] == "ALIGNED_TO_2025_NATIONAL_STRUCTURE_NOT_NAPPS_ISSUED" for row in rows)


def test_napps_alignment_stores_topic_headings_not_source_lessons():
    rows = alignment_rows()
    assert all(set(row) == {
        "alignment_id", "primary_class", "subject", "term", "week", "topic", "source_id",
        "source_url", "source_topic_index_sha256", "source_modified_at", "instructional", "verification_status",
        "training_eligible", "authoring_status",
    } for row in rows)
    assert max(len(row["topic"]) for row in rows) <= 140
    assert all(len(row["source_topic_index_sha256"]) == 64 for row in rows)


def test_independent_napps_alignment_validator_passes():
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts/validate_napps_alignment.py")],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    report = json.loads(result.stdout)
    assert report["class_subject_term_combinations"] == 36
    assert report["official_napps_edition_verified"] is False
    assert report["training_eligible_rows"] == 0
    assert report["authoring_ready_rows"] == report["rows"]
    assert report["errors"] == []
