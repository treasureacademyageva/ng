import csv
import json
import re
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
    assert all(row["creator_type"] == "AI_ASSISTED" for row in rows)
    assert all(row["draft_status"] == "DRAFTED" for row in rows)
    assert all(re.fullmatch(r"[0-9a-f]{64}", row["content_sha256"]) for row in rows)
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
    assert report["draft_statuses"] == {"DRAFTED": 96}
    assert report["automated_pre_review_ready"] == 96
    assert report["automated_pre_review_held"] == 0
    assert report["training_approved"] == 0
    assert report["errors"] == []


def test_generation_report_records_substantive_private_unapproved_drafts():
    report = json.loads((ROOT / "reports/primary-draft-generation.json").read_text(encoding="utf-8"))
    assert report["documents"] == 96
    assert report["subjects"] == {"mathematics": 48, "english": 48}
    assert report["minimum_document_words"] >= 300
    assert report["exact_or_near_duplicate_documents"] == 0
    assert report["teacher_approved"] == 0
    assert report["safeguarding_approved"] == 0
    assert report["training_approved"] == 0


def test_pilot_automated_pre_review_is_complete_without_human_approval():
    report = json.loads((ROOT / "reports/primary-pilot-pre-review.json").read_text(encoding="utf-8"))
    assert report["documents"] == 96
    assert report["ready_for_named_human_review"] == 96
    assert report["held_by_automated_checks"] == 0
    assert report["privacy_pattern_hits"] == 0
    assert report["unexpected_urls"] == 0
    assert report["prohibited_alignment_claims"] == 0
    assert report["exact_or_near_duplicate_documents"] == 0
    assert report["named_teacher_approvals"] == 0
    assert report["named_safeguarding_approvals"] == 0
    assert report["training_approved_documents"] == 0


def test_private_human_review_handoff_has_no_generated_decisions():
    report = json.loads((ROOT / "reports/human-review-handoff.json").read_text(encoding="utf-8"))
    assert report["candidate_licence_reviews_pending"] == 54
    assert report["candidate_teacher_reviews_ready"] == 50
    assert report["candidate_safeguarding_reviews_ready"] == 50
    assert report["conditional_rights_legal_reviews_required"] == 4
    assert report["pilot_teacher_reviews_ready"] == 96
    assert report["pilot_safeguarding_reviews_ready"] == 96
    assert report["human_review_decisions_filled"] == 0
    assert report["training_approvals_granted"] == 0
    assert all(re.fullmatch(r"[0-9a-f]{64}", row["sha256"]) for row in report["workbooks"].values())


def test_private_interactive_review_portal_covers_all_tracks_without_importing_decisions():
    report = json.loads((ROOT / "reports/review-portal.json").read_text(encoding="utf-8"))
    assert report["tracks"] == {
        "candidate_licence": 54,
        "candidate_teacher": 50,
        "candidate_safeguarding": 50,
        "pilot_teacher": 96,
        "pilot_safeguarding": 96,
        "conditional_legal": 4,
    }
    assert re.fullmatch(r"[0-9a-f]{64}", report["sha256"])
    assert report["human_decisions_imported"] == 0
    assert report["training_approvals_granted"] == 0
