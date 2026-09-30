import csv
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PILOT = ROOT / "data/authoring/pilot-balanced-v1-review.csv"
RIGHTS = ROOT / "data/authoring/rights-confirmation.json"


def pilot_rows():
    with PILOT.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def test_balanced_pilot_covers_every_subject_class_without_approval():
    rows = pilot_rows()
    assert len(rows) == 96
    assert Counter(row["subject"] for row in rows) == {"mathematics": 48, "english": 48}
    assert Counter(row["primary_class"] for row in rows) == {str(grade): 16 for grade in range(1, 7)}
    assert all(row["responsible_creator"] == "Treasure Academy Ageva" for row in rows)
    assert all(row["draft_status"] == "NOT_STARTED" for row in rows)
    assert all(row["teacher_decision"] == "PENDING" for row in rows)
    assert all(row["safeguarding_decision"] == "PENDING" for row in rows)
    assert all(row["approved_for_training"] == "false" for row in rows)


def test_internal_rights_do_not_claim_open_distribution():
    rights = json.loads(RIGHTS.read_text(encoding="utf-8"))
    assert rights["status"] == "CONFIRMED_INTERNAL_MODEL_USE"
    assert rights["open_license"] is None
    assert rights["public_corpus_distribution_permitted"] is False
    assert rights["training_approval_inferred"] is False


def test_independent_pilot_validator_passes():
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts/validate_primary_pilot_manifest.py")],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    report = json.loads(result.stdout)
    assert report["samples"] == 96
    assert report["training_approved"] == 0
    assert report["errors"] == []
