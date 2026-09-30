import csv
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "data/authoring/primary-math-english-briefs.csv"


def rows():
    with QUEUE.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def test_primary_authoring_queue_has_balanced_class_coverage():
    data = rows()
    assert len(data) == 96
    assert Counter(row["subject"] for row in data) == {"mathematics": 48, "english": 48}
    assert all(
        sum(row["subject"] == subject and row["primary_class"] == str(primary_class) for row in data) == 8
        for subject in ("mathematics", "english")
        for primary_class in range(1, 7)
    )


def test_authoring_queue_records_the_owner_selected_organisation():
    data = rows()
    assert all(row["brief_status"] == "ASSIGNED" for row in data)
    assert all(row["assigned_author"] == "Treasure Academy Ageva" for row in data)
    assert all(len(row["brief_sha256"]) == 64 for row in data)
    assert sum(int(row["pilot_documents"]) for row in data) == 288
    assert sum(int(row["full_target_documents"]) for row in data) == 3_840


def test_independent_authoring_validator_passes():
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts/validate_primary_authoring_queue.py")],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    report = json.loads(result.stdout)
    assert report["briefs"] == 96
    assert report["training_approved_documents"] == 0
    assert report["errors"] == []
