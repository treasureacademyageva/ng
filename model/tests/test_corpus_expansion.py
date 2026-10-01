import csv
import hashlib
import importlib.util
import io
import json
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
sys.path.insert(0, str(ROOT / "scripts"))


def load_script(name):
    path = ROOT / "scripts" / name
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


STAGE = load_script("stage_open_candidates.py")
POLICY = json.loads((ROOT / "data/candidate-intake-policy.json").read_text())
REGISTRY = json.loads((ROOT / "data/source-candidates.json").read_text())


def test_01_item_registry_preserves_research_and_has_complete_item_schema():
    assert len(REGISTRY["candidates"]) == 10
    assert len(REGISTRY["items"]) == 54
    assert all(not STAGE.validate_candidate(item, POLICY) for item in REGISTRY["items"])


def test_02_item_licences_have_exact_evidence_urls_and_attribution():
    for item in REGISTRY["items"]:
        licence = item["license"]
        assert licence["url"].startswith("https://")
        assert licence["evidence_url"].startswith("https://")
        assert item["attribution"] and licence["attribution"]
        assert licence["commercial_use"] is True and licence["derivatives"] is True


def test_03_candidate_registry_and_review_packet_cannot_approve_training():
    assert all(item["training_eligible"] is False for item in REGISTRY["items"])
    assert all(item["approval_status"] == "NOT_APPROVED" for item in REGISTRY["items"])
    with (ROOT / "data/reviews/candidate-intake-review.csv").open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 54
    assert all(row["approval_decision"] == "PENDING" for row in rows)


def test_04_noncommercial_and_noderivatives_licences_fail_closed():
    base = REGISTRY["items"][0]
    for identifier in ("CC-BY-NC-4.0", "CC-BY-ND-4.0", "CC-BY-NC-ND-4.0"):
        item = json.loads(json.dumps(base))
        item["license"]["identifier"] = identifier
        allowed, errors = STAGE.validate_license(item, POLICY)
        assert allowed is False
        assert any("blocked" in error or "allowlisted" in error for error in errors)


def test_05_public_availability_or_unknown_licence_never_counts_as_permission():
    item = json.loads(json.dumps(REGISTRY["items"][0]))
    item["license"].update({"identifier": "UNKNOWN", "status": "PUBLICLY_AVAILABLE"})
    allowed, errors = STAGE.validate_license(item, POLICY)
    assert not allowed and errors


def test_06_url_allowlist_blocks_http_credentials_ports_and_unknown_hosts():
    bad = [
        "http://www.gutenberg.org/book.txt",
        "https://user:pass@www.gutenberg.org/book.txt",
        "https://www.gutenberg.org:8443/book.txt",
        "https://example.com/book.txt",
    ]
    for url in bad:
        with pytest.raises(ValueError):
            STAGE.validate_url(url, POLICY)


def test_07_redirect_checks_reject_cross_host_downgrade_and_filename_change():
    source = "https://archive.org/download/item/book.txt"
    assert STAGE.redirect_allowed(source, "https://ia800000.us.archive.org/x/item/book.txt", POLICY)
    assert not STAGE.redirect_allowed(source, "http://ia800000.us.archive.org/x/item/book.txt", POLICY)
    assert not STAGE.redirect_allowed(source, "https://evil.example/x/book.txt", POLICY)
    assert not STAGE.redirect_allowed(source, "https://ia800000.us.archive.org/x/item/other.txt", POLICY)


def test_08_download_bounds_and_content_type_are_enforced_before_staging(monkeypatch):
    class Response:
        def __init__(self, content_type, length, body=b"hello"):
            self.headers = {"Content-Type": content_type, "Content-Length": str(length)}
            self.body = body
        def __enter__(self): return self
        def __exit__(self, *args): return False
        def geturl(self): return "https://www.gutenberg.org/book.txt"
        def read(self, amount): return self.body[:amount]
    class Opener:
        response = None
        def open(self, *args, **kwargs): return self.response
    opener = Opener()
    monkeypatch.setattr(STAGE.urllib.request, "build_opener", lambda *args: opener)
    opener.response = Response("text/html", 5)
    with pytest.raises(ValueError, match="content type"):
        STAGE.bounded_download("https://www.gutenberg.org/book.txt", POLICY, ["text/plain"])
    opener.response = Response("text/plain", POLICY["maximum_download_bytes"] + 1)
    with pytest.raises(ValueError, match="declares"):
        STAGE.bounded_download("https://www.gutenberg.org/book.txt", POLICY, ["text/plain"])


def test_09_path_traversal_is_rejected_for_urls_output_ids_and_epubs():
    with pytest.raises(ValueError):
        STAGE.validate_url("https://www.gutenberg.org/a/../secret.txt", POLICY)
    with pytest.raises(ValueError):
        STAGE.safe_output_path(Path("/tmp/staging"), "../escape", ".txt")
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        archive.writestr("../escape.xhtml", "<p>bad</p>")
    with pytest.raises(ValueError, match="path-traversal"):
        STAGE.extract_epub(stream.getvalue())


def test_10_plain_text_extraction_is_deterministic_and_strips_gutenberg_wrapper():
    item = {"extraction_method": "plain-text"}
    data = b"header\n*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\nLesson text.\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***\nfooter"
    first, _ = STAGE.extract_text(data, item)
    second, _ = STAGE.extract_text(data, item)
    assert first == second == "Lesson text."


def test_11_mediawiki_extraction_requires_the_pinned_revision():
    payload = json.dumps({"parse": {"revid": 12, "displaytitle": "Test", "text": {"*": "<p>Hello pupils.</p>"}}}).encode()
    text, meta = STAGE.extract_mediawiki_json(payload, "12")
    assert "Hello pupils" in text and meta["revision"] == "12"
    with pytest.raises(ValueError, match="revision mismatch"):
        STAGE.extract_mediawiki_json(payload, "13")


def test_12_corrupt_or_too_short_extraction_is_quarantinable():
    quality = STAGE.scan_quality("\ufffd\ufffd\x00", POLICY)
    assert quality["errors"]
    assert "replacement-character rate exceeds policy" in quality["errors"]


def test_13_privacy_scanner_detects_and_masks_contact_and_bank_patterns():
    text = "Contact pupil@example.org or +234 803 123 4567. Bank account 1234567890."
    warnings = STAGE.scan_privacy(text, POLICY)
    assert {row["kind"] for row in warnings} >= {"email", "international_phone", "bank_account_candidate"}
    assert all("example.org" not in row["masked"] and "1234567890" not in row["masked"] for row in warnings)


def test_14_context_classification_requires_explicit_evidence_not_keywords():
    item = json.loads(json.dumps(REGISTRY["items"][0]))
    item["title"] = "Nigeria Nigeria Nigeria"
    item["context_class"] = "uncertain"
    assert STAGE.classify_context(item, POLICY) == "uncertain"
    item["context_evidence"] = {"basis": "", "evidence_url": "", "excerpt": ""}
    with pytest.raises(ValueError, match="context classification"):
        STAGE.classify_context(item, POLICY)


def test_15_primary_and_secondary_subjects_cover_all_required_canonical_areas():
    covered = set()
    for item in REGISTRY["items"]:
        assert item["primary_subject"] in POLICY["canonical_primary_subjects"]
        covered.add(item["primary_subject"])
        covered.update(item["secondary_subjects"])
    assert covered == set(POLICY["canonical_primary_subjects"])


def test_16_exact_and_near_duplicates_are_removed_with_machine_readable_matches():
    index = STAGE.NearDuplicateIndex(threshold=0.8, min_words=5)
    original = "one two three four five six seven eight nine ten eleven twelve"
    index.add_or_match("approved:1", original)
    text = original + "\n\n" + "one two three four five six seven eight nine ten eleven changed"
    cleaned, report = STAGE.deduplicate_text("candidate", text, index)
    assert report["removed_exact"] == 1
    assert report["removed_near"] == 1
    assert cleaned == ""


def test_17_review_decisions_survive_only_when_both_hashes_match(tmp_path):
    path = tmp_path / "reviews.csv"
    item = json.loads(json.dumps(REGISTRY["items"][0]))
    item.update({"id": "test-item", "original_sha256": "a" * 64, "extracted_sha256": "b" * 64})
    STAGE.update_review_packet(path, [item])
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    rows[0]["teacher_decision"] = "APPROVED"
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=STAGE.REVIEW_FIELDS, lineterminator="\n")
        writer.writeheader(); writer.writerows(rows)
    STAGE.update_review_packet(path, [item])
    with path.open(newline="", encoding="utf-8") as handle:
        assert list(csv.DictReader(handle))[0]["teacher_decision"] == "APPROVED"
    item["extracted_sha256"] = "c" * 64
    STAGE.update_review_packet(path, [item])
    with path.open(newline="", encoding="utf-8") as handle:
        assert list(csv.DictReader(handle))[0]["teacher_decision"] == "PENDING"


def test_18_staging_is_gitignored_and_training_preparation_never_reads_it():
    result = subprocess.run(
        ["git", "check-ignore", "model/data/staging/probe.txt"], cwd=REPO,
        check=True, capture_output=True, text=True,
    )
    assert "model/data/staging/probe.txt" in result.stdout
    prepare = (ROOT / "scripts/prepare_data.py").read_text(encoding="utf-8")
    assert "data/staging" not in prepare and "source-candidates" not in prepare


def test_19_protected_benchmark_hashes_are_unchanged_and_candidates_do_not_leak():
    report = json.loads((ROOT / "reports/candidate-staging-report.json").read_text())
    assert report["benchmark_files_unchanged"] is True
    assert report["protected_benchmark_hashes_before"] == report["protected_benchmark_hashes_after"]
    for relative, digest in report["protected_benchmark_hashes_after"].items():
        assert hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() == digest
    assert all(not (item.get("leakage") or {}).get("blocked") for item in REGISTRY["items"])


def test_20_long_run_is_closed_and_experimental_model_is_disconnected_from_production():
    audit = json.loads((ROOT / "reports/corpus-expansion-audit.json").read_text())
    assert audit["long_run_ready"] is False
    assert audit["decision"] == "DO NOT AUTHORISE LONG RUN"
    assert audit["candidate_controls"]["training_approved_items"] == 0
    assert audit["authoring_plan"]["automated_pre_review"] == {
        "documents": 96,
        "ready_for_named_human_review": 96,
        "held_by_automated_checks": 0,
        "training_approved_documents": 0,
    }
    assert audit["authoring_plan"]["private_human_review_handoff"]["human_review_decisions_filled"] == 0
    assert audit["authoring_plan"]["interactive_review_portal"]["tracks"]["pilot_teacher"] == 96
    assert audit["authoring_plan"]["interactive_review_portal"]["human_decisions_imported"] == 0
    assert audit["weighted_completion"]["official_policy_completion_percentage"] < 100
    vercel = (REPO / "vercel.json").read_text(encoding="utf-8")
    production = (REPO / "ai/main.py").read_text(encoding="utf-8")
    assert "model/checkpoints" not in vercel + production
    assert "model/data/pretraining" not in vercel + production


def test_21_hash_bound_hold_resolutions_and_licence_exclusions_fail_closed():
    statuses = {item["id"]: item for item in REGISTRY["items"]}
    assert sum(item["staging_status"] == "STAGED_UNAPPROVED" for item in statuses.values()) == 50
    assert sum(item["staging_status"] == "LICENSE_EXCLUDED" for item in statuses.values()) == 4
    assert sum(item["staging_status"] == "QUARANTINED" for item in statuses.values()) == 0
    resolved = [item for item in statuses.values() if item.get("automated_hold_resolution")]
    assert len(resolved) == 5
    for item in resolved:
        disposition = item["automated_hold_resolution"]
        assert item["staging_status"] == "STAGED_UNAPPROVED"
        assert disposition["original_sha256"] == item["original_sha256"]
        assert disposition["extracted_sha256"] == item["extracted_sha256"]
        assert disposition["scope"] == "staging only; no human or training approval"
    excluded = [item for item in statuses.values() if item["staging_status"] == "LICENSE_EXCLUDED"]
    assert {item["license"]["identifier"] for item in excluded} == {"CC-BY-SA-4.0", "US-PUBLIC-DOMAIN"}
    assert all(item["licence_disposition"]["decision"] == "EXCLUDE_FROM_TRAINING" for item in excluded)
    assert all(item["training_eligible"] is False for item in excluded)


def test_22_automated_pre_review_covers_all_items_without_human_impersonation():
    report = json.loads((ROOT / "reports/candidate-pre-review.json").read_text(encoding="utf-8"))
    assert report["items"] == 54
    assert report["ready_for_human_review"] == 50
    assert report["held_or_excluded"] == 4
    assert report["language_review_policy"] == "NOT_REQUIRED_CURRENT_OWNER_POLICY"
    assert report["named_teacher_approvals"] == 0
    assert report["named_safeguarding_approvals"] == 0
    assert report["training_approved_items"] == 0
    assert all(row["teacher_review"] == "PENDING_NAMED_HUMAN" for row in report["results"])
    assert all(row["safeguarding_review"] == "PENDING_NAMED_HUMAN" for row in report["results"])
