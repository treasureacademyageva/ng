import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))


def load_script(name):
    path = SCRIPTS / name
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


SERVER = load_script("serve_review_portal.py")


def test_review_server_allowed_sets_match_controlled_workloads():
    allowed = SERVER.allowed_records()
    assert len(allowed["candidate_licence"]) == 54
    assert len(allowed["candidate_teacher"]) == 50
    assert len(allowed["candidate_safeguarding"]) == 50
    assert len(allowed["pilot_teacher"]) == 96
    assert len(allowed["pilot_safeguarding"]) == 96
    assert len(allowed["conditional_legal"]) == 4


def test_review_server_accepts_hash_bound_pending_notes_without_approval():
    allowed = SERVER.allowed_records()
    item_id, digest = next(iter(allowed["pilot_teacher"].items()))
    key, review = SERVER.validate_review({
        "track": "pilot_teacher",
        "itemId": item_id,
        "review": {
            "reviewerName": "",
            "reviewerRole": "qualified_nigerian_primary_teacher",
            "reviewedAt": "",
            "decision": "PENDING",
            "notes": "Owner preliminary note only.",
            "confirmed": False,
            "contentSha256": digest,
        },
    }, allowed)
    assert key == f"pilot_teacher:{item_id}"
    assert review["decision"] == "PENDING"
    assert review["confirmed"] is False


def test_review_server_rejects_wrong_hash_role_or_unsupported_decision():
    allowed = SERVER.allowed_records()
    item_id, digest = next(iter(allowed["pilot_teacher"].items()))
    base = {
        "track": "pilot_teacher",
        "itemId": item_id,
        "review": {
            "reviewerName": "Real Reviewer",
            "reviewerRole": "qualified_nigerian_primary_teacher",
            "reviewedAt": "2026-10-01",
            "decision": "APPROVED",
            "notes": "",
            "confirmed": True,
            "contentSha256": digest,
        },
    }
    wrong_hash = json.loads(json.dumps(base))
    wrong_hash["review"]["contentSha256"] = "0" * 64
    with pytest.raises(ValueError, match="hash"):
        SERVER.validate_review(wrong_hash, allowed)
    wrong_role = json.loads(json.dumps(base))
    wrong_role["review"]["reviewerRole"] = "owner"
    with pytest.raises(ValueError, match="role"):
        SERVER.validate_review(wrong_role, allowed)
    wrong_decision = json.loads(json.dumps(base))
    wrong_decision["review"]["decision"] = "TRAINING_APPROVED"
    with pytest.raises(ValueError, match="decision"):
        SERVER.validate_review(wrong_decision, allowed)


def test_export_never_grants_training_approval():
    state = SERVER.empty_state()
    exported = SERVER.export_state(state)
    assert exported["trainingApprovalGranted"] is False
    assert exported["reviews"] == []
