import csv
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_script(name: str):
    path = ROOT / "scripts" / name
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


def read_csv(path: Path):
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def test_readiness_policy_keeps_data_and_authorisation_gates_closed():
    policy = json.loads((ROOT / "data/readiness-policy.json").read_text())
    assert policy["corpus"]["minimum_train_bpe_tokens"] == 10_000_000
    assert policy["corpus"]["maximum_single_subject_character_share"] <= 0.35
    assert policy["corpus"]["minimum_nigerian_context_character_share"] >= 0.30
    assert len(policy["corpus"]["required_coverage_tags"]) == 7
    assert len(policy["human_review"]["staged_story_review_files"]) == 4
    assert policy["benchmark"]["repeat_only_after_all_data_gates_pass"] is True
    assert policy["benchmark"]["long_run_requires_separate_written_authorisation"] is True


def test_candidate_registry_cannot_approve_training():
    data = json.loads((ROOT / "data/source-candidates.json").read_text())
    ids = [row["id"] for row in data["candidates"]]
    assert len(ids) == len(set(ids))
    assert len(ids) >= 8
    assert all(row["training_eligible"] is False for row in data["candidates"])
    restricted = {"NO_AFFIRMATIVE_TRAINING_LICENCE", "OUT_OF_SCOPE"}
    assert all(not row["training_eligible"] for row in data["candidates"] if row["license_status"] in restricted)


def test_review_packets_cover_every_case_without_auto_approval():
    cases = [json.loads(line) for line in (ROOT / "data/evaluation/cases-v2.jsonl").read_text().splitlines() if line]
    expected = {case["id"] for case in cases}
    for filename in ("evaluation-teacher-review.csv", "evaluation-safeguarding-review.csv"):
        rows = read_csv(ROOT / "data/reviews" / filename)
        assert {row["case_id"] for row in rows} == expected
        assert len(rows) == len(cases) == 240
        assert all(row["decision"] in {"PENDING", "APPROVED", "CHANGES_REQUIRED"} for row in rows)
        assert all(row["case_sha256"] for row in rows)


def test_story_review_packets_keep_all_human_decisions_pending():
    expected = {"english": 29, "pidgin": 7, "hausa": 4, "yoruba": 6}
    all_ids = set()
    for language, count in expected.items():
        rows = read_csv(ROOT / "data/reviews" / f"storybooks-nigeria-{language}-review.csv")
        ids = {row["document_id"] for row in rows}
        assert len(rows) == len(ids) == count
        assert not all_ids.intersection(ids)
        all_ids.update(ids)
        assert {row["license"] for row in rows} <= {"CC-BY-3.0", "CC-BY-4.0"}
        assert all(row["teacher_decision"] == "PENDING" for row in rows)
        assert all(row["safeguarding_decision"] == "PENDING" for row in rows)
    assert len(all_ids) == 46


def test_pending_human_review_files_are_valid_but_gate_is_incomplete():
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts/validate_human_reviews.py")],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    report = json.loads(result.stdout)
    assert report["evaluation_cases"] == 240
    assert report["teacher"]["approved"] == 0
    assert report["safeguarding"]["approved"] == 0
    assert report["staged_stories"]["documents"] == 46
    assert all(item["teacher"]["approved"] == 0 for item in report["staged_stories"]["collections"])
    assert all(item["safeguarding"]["approved"] == 0 for item in report["staged_stories"]["collections"])
    assert report["human_review_gate_complete"] is False
    assert report["errors"] == []


def test_pdf_normalization_removes_only_volatile_document_ids():
    fetcher = load_script("fetch_open_data.py")
    first = b"wrapper%PDF-1.7\nbody\n/ID [<ABC123> <ABC123>]\n%%EOF"
    second = b"wrapper%PDF-1.7\nbody\n/ID [<DEF456> <DEF456>]\n%%EOF"
    normalized_first = fetcher.normalize_pdf(first)
    normalized_second = fetcher.normalize_pdf(second)
    assert normalized_first == normalized_second
    assert normalized_first.startswith(b"%PDF-1.7")
    assert len(normalized_first) == len(first) - len(b"wrapper")


def test_story_review_packet_preserves_only_hash_matched_decisions(tmp_path):
    stage = load_script("stage_storybooks_nigeria.py")
    path = tmp_path / "reviews.csv"
    record = {
        "document_id": "story-1", "text_sha256": "a" * 64, "title": "Story",
        "creator": "Author", "license": "CC-BY-4.0", "storybooks_nigeria_url": "https://example.test/story",
    }
    stage.write_review_packet(path, [record])
    rows = read_csv(path)
    rows[0].update({
        "teacher_decision": "APPROVED", "teacher_reviewer_name": "A Teacher",
        "teacher_reviewer_role": "qualified_nigerian_primary_teacher", "teacher_reviewed_at": "2026-09-30",
    })
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=stage.STORY_REVIEW_FIELDS, lineterminator="\n")
        writer.writeheader(); writer.writerows(rows)
    stage.write_review_packet(path, [record])
    assert read_csv(path)[0]["teacher_decision"] == "APPROVED"
    stage.write_review_packet(path, [{**record, "text_sha256": "b" * 64}])
    assert read_csv(path)[0]["teacher_decision"] == "PENDING"


def test_story_stager_accepts_by_and_rejects_nc_metadata():
    stage = load_script("stage_storybooks_nigeria.py")
    markdown = """# A test story\n\n##\nA child reads a useful book.\n\n##\n* License: [CC-BY]\n* Text: Test Author\n* Illustration: Test Artist\n* Language: en\n"""
    row = stage.markdown_record("9999", markdown)
    assert row["title"] == "A test story"
    assert row["source_license"] == "CC-BY"
    assert row["text"] == "A child reads a useful book."
    assert stage.exact_site_license("9999", '<a href="https://creativecommons.org/licenses/by/3.0/">CC</a>') == ("by", "3.0")
    assert stage.exact_site_license("9999", '<a href="https://creativecommons.org/licenses/by-nc/3.0/">CC</a>') == ("by-nc", "3.0")


def test_story_stager_extracts_published_language_text_once():
    stage = load_script("stage_storybooks_nigeria.py")
    html = '''
    <h1><span class="def">Labarin Gwaji</span></h1>
    <div class="level1-txt def"><h3>Sashe na farko.</h3></div>
    <div class="level1-txt l1"><h3>English duplicate.</h3></div>
    <div class="level1-txt l2"><h3>Sashe na farko.</h3></div>
    <a href="/stories/ha/level1">Level 1</a>
    <span class="colophon-heading">Written by:</span> Marubuci</h5>
    <span class="colophon-heading">Illustrated by:</span> Mai Zane</h5>
    <span class="colophon-heading">Translated by:</span> Mai Fassara</h5>
    '''
    row = stage.html_record("9998", html, "ha")
    assert row["title"] == "Labarin Gwaji"
    assert row["text"] == "Sashe na farko."
    assert row["translator"] == "Mai Fassara"
    assert row["reading_level"] == 1
