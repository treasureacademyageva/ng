#!/usr/bin/env python3
"""Build private, read-only human-review workbooks and a committed handoff manifest.

The workbooks contain staged/licensed or internally owned text and therefore
remain under ignored data/staging. This command never records a human decision.
"""
from __future__ import annotations

import csv
import hashlib
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "data/source-candidates.json"
CANDIDATE_REVIEWS = ROOT / "data/reviews/candidate-intake-review.csv"
PILOT = ROOT / "data/authoring/pilot-balanced-v1-review.csv"
DRAFTS = ROOT / "data/staging/authoring/pilot-v1-drafts.jsonl"
OUTPUT_DIR = ROOT / "data/staging/review-workbooks"
REPORT = ROOT / "reports/human-review-handoff.json"

STYLE = """
:root { color-scheme: light; --ink:#172033; --muted:#596579; --line:#cdd6e4; --accent:#174ea6; --hold:#8a4b08; }
* { box-sizing: border-box; } body { margin:0; font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif; color:var(--ink); background:#f4f7fb; }
main { max-width:1000px; margin:auto; padding:32px 20px 80px; } h1,h2,h3 { line-height:1.2; } h1 { color:var(--accent); }
.notice { background:#fff5d6; border:1px solid #e4bd58; padding:14px 16px; border-radius:10px; }
.item { background:white; border:1px solid var(--line); border-radius:12px; padding:22px; margin:22px 0; break-inside:avoid; }
.meta { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:8px 18px; color:var(--muted); }
.text { white-space:pre-wrap; background:#f8fafc; border:1px solid var(--line); border-radius:8px; padding:16px; margin-top:14px; }
.checklist { margin:14px 0 0; padding:14px 18px; border-left:4px solid var(--accent); background:#f7faff; }
code { overflow-wrap:anywhere; } a { color:var(--accent); } .hold { color:var(--hold); font-weight:700; }
@media print { body { background:white; } main { max-width:none; } .item { break-inside:avoid; } }
""".strip()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def page(title: str, introduction: str, sections: list[str]) -> str:
    return (
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        f"<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{html.escape(title)}</title>"
        f"<style>{STYLE}</style></head><body><main><h1>{html.escape(title)}</h1>"
        f"<div class=\"notice\">{introduction}</div>{''.join(sections)}</main></body></html>\n"
    )


def meta(values: list[tuple[str, object]]) -> str:
    return "<div class=\"meta\">" + "".join(
        f"<div><strong>{html.escape(label)}:</strong> {html.escape(str(value))}</div>" for label, value in values
    ) + "</div>"


def checklist(items: list[str]) -> str:
    return "<div class=\"checklist\"><strong>Review prompts</strong><ul>" + "".join(
        f"<li>☐ {html.escape(item)}</li>" for item in items
    ) + "</ul></div>"


def load_candidate_texts(items: list[dict]) -> dict[str, str]:
    collection_cache: dict[Path, dict[str, str]] = {}
    texts = {}
    for item in items:
        paths = item["staging_paths"]
        if "extracted" in paths:
            text = (ROOT / paths["extracted"]).read_text(encoding="utf-8")
        else:
            collection = ROOT / paths["extracted_collection"]
            if collection not in collection_cache:
                collection_cache[collection] = {
                    row["document_id"]: row["text"] for row in read_jsonl(collection)
                }
            text = collection_cache[collection][item["id"]]
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        if digest != item["extracted_sha256"]:
            raise SystemExit(f"{item['id']}: staged text hash mismatch while building review workbook")
        texts[item["id"]] = text
    return texts


def candidate_content_sections(items: list[dict], texts: dict[str, str], role: str) -> list[str]:
    prompts = (
        [
            "Check curriculum usefulness, factual accuracy and suitability for the stated primary level.",
            "Identify vocabulary, examples or assumptions that need adaptation for Nigerian primary learners.",
            "Choose APPROVED, CHANGES_REQUIRED or REJECTED and give notes where changes are required.",
        ] if role == "teacher" else [
            "Check age fit, dignity, stereotypes, distressing material and unsafe instructions.",
            "Check that the text does not request or expose private pupil, family, contact or financial information.",
            "Choose APPROVED, CHANGES_REQUIRED or REJECTED and give notes where changes are required.",
        ]
    )
    sections = []
    for number, item in enumerate(items, 1):
        resolution = item.get("automated_hold_resolution") or {}
        sections.append(
            f"<section class=\"item\"><h2>{number}. {html.escape(item['title'])}</h2>"
            + meta([
                ("Item ID", item["id"]), ("Creator", item["creator"]), ("Language", item["language"]),
                ("Primary subject", item["primary_subject"]), ("Context", item["context_class"]),
                ("Licence", item["license"]["identifier"]), ("Content SHA-256", item["extracted_sha256"]),
                ("Prior automated hold", resolution.get("code", "none")),
            ])
            + checklist(prompts)
            + f"<div class=\"text\">{html.escape(texts[item['id']])}</div></section>"
        )
    return sections


def candidate_licence_sections(items: list[dict]) -> list[str]:
    sections = []
    for number, item in enumerate(items, 1):
        licence = item["license"]
        disposition = item.get("licence_disposition") or {}
        hold = f"<p class=\"hold\">Current hold: {html.escape(disposition.get('reason', item.get('rejection_reason') or 'none'))}</p>" if item["staging_status"] == "LICENSE_EXCLUDED" else ""
        sections.append(
            f"<section class=\"item\"><h2>{number}. {html.escape(item['title'])}</h2>"
            + meta([
                ("Item ID", item["id"]), ("Creator", item["creator"]), ("Publisher", item["publisher"]),
                ("Exact item URL", item["source_url"]), ("Revision", item["source_revision"]),
                ("Licence", licence["identifier"]), ("Licence status", licence["status"]),
                ("Evidence URL", licence["evidence_url"]), ("Attribution", item["attribution"]),
                ("Staging status", item["staging_status"]), ("Original SHA-256", item["original_sha256"]),
                ("Extracted SHA-256", item["extracted_sha256"]),
            ]) + hold + checklist([
                "Open the exact licence evidence and confirm it applies to this exact revision/item.",
                "Confirm attribution, commercial-use and derivative permissions are recorded accurately.",
                "For a conditional-rights item, obtain appropriate legal advice rather than guessing.",
                "Record the licence decision, real reviewer identity, role, date and notes in candidate-intake-review.csv.",
            ]) + "</section>"
        )
    return sections


def pilot_sections(records: list[dict], role: str) -> list[str]:
    prompts = (
        [
            "Check the topic, explanation, worked/model example and answers against the Primary class.",
            "Check Nigerian classroom usefulness, clarity, progression and required corrections.",
            "Choose APPROVED, CHANGES_REQUIRED or REJECTED and record a real name, role, date and notes.",
        ] if role == "teacher" else [
            "Check age fit, inclusive language, stereotypes, distress, risky activities and privacy.",
            "Confirm fictional examples do not invite disclosure of pupil, family, contact or financial details.",
            "Choose APPROVED, CHANGES_REQUIRED or REJECTED and record a real name, role, date and notes.",
        ]
    )
    sections = []
    for number, record in enumerate(records, 1):
        sections.append(
            f"<section class=\"item\"><h2>{number}. {html.escape(record['title'])}</h2>"
            + meta([
                ("Sample ID", record["sample_id"]), ("Brief ID", record["brief_id"]),
                ("Subject", record["subject"]), ("Primary class", record["primary_class"]),
                ("Topic", record["topic"]), ("Creator type", record["creator_type"]),
                ("Rights", record["rights_status"]), ("Words", record["words"]),
                ("Content SHA-256", record["content_sha256"]),
            ]) + checklist(prompts)
            + f"<div class=\"text\">{html.escape(record['content'])}</div></section>"
        )
    return sections


def write_workbook(name: str, title: str, introduction: str, sections: list[str]) -> dict:
    path = OUTPUT_DIR / name
    content = page(title, introduction, sections).encode("utf-8")
    path.write_bytes(content)
    return {
        "path": str(path.relative_to(ROOT)), "sha256": sha256_bytes(content),
        "bytes": len(content), "sections": len(sections), "tracked": False,
    }


def main() -> None:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    items = registry["items"]
    candidate_reviews = read_csv(CANDIDATE_REVIEWS)
    if len(candidate_reviews) != 54 or any(
        row[field] != "PENDING" for row in candidate_reviews
        for field in ("licence_decision", "teacher_decision", "safeguarding_decision", "approval_decision")
    ):
        raise SystemExit("candidate human decisions must remain pending before generated handoff")
    ready_candidates = [item for item in items if item["staging_status"] == "STAGED_UNAPPROVED"]
    excluded_candidates = [item for item in items if item["staging_status"] == "LICENSE_EXCLUDED"]
    texts = load_candidate_texts(ready_candidates)
    pilot_rows = read_csv(PILOT)
    if len(pilot_rows) != 96 or any(
        row["teacher_decision"] != "PENDING" or row["safeguarding_decision"] != "PENDING"
        or row["approved_for_training"].lower() != "false" for row in pilot_rows
    ):
        raise SystemExit("pilot human decisions must remain pending and training approval false")
    draft_records = read_jsonl(DRAFTS)
    if {row["sample_id"] for row in pilot_rows} != {row["sample_id"] for row in draft_records}:
        raise SystemExit("private draft set does not match pilot manifest")
    for record in draft_records:
        if hashlib.sha256(record["content"].encode("utf-8")).hexdigest() != record["content_sha256"]:
            raise SystemExit(f"{record['sample_id']}: private draft hash mismatch")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    intro = (
        "<strong>Read-only handoff.</strong> This generated workbook is evidence for a real named reviewer. "
        "Do not treat checkboxes, generation or file hashes as a decision. Record decisions only in the referenced CSV, "
        "with the reviewer’s real name, required role and date."
    )
    workbooks = {
        "candidate_licence": write_workbook(
            "candidate-licence-review.html", "Candidate licence evidence review", intro,
            candidate_licence_sections(items),
        ),
        "candidate_teacher": write_workbook(
            "candidate-teacher-review.html", "Candidate teacher review — 50 staged items", intro,
            candidate_content_sections(ready_candidates, texts, "teacher"),
        ),
        "candidate_safeguarding": write_workbook(
            "candidate-safeguarding-review.html", "Candidate safeguarding review — 50 staged items", intro,
            candidate_content_sections(ready_candidates, texts, "safeguarding"),
        ),
        "pilot_teacher": write_workbook(
            "primary-pilot-teacher-review.html", "Original primary pilot teacher review — 96 drafts", intro,
            pilot_sections(draft_records, "teacher"),
        ),
        "pilot_safeguarding": write_workbook(
            "primary-pilot-safeguarding-review.html", "Original primary pilot safeguarding review — 96 drafts", intro,
            pilot_sections(draft_records, "safeguarding"),
        ),
        "conditional_rights": write_workbook(
            "conditional-rights-legal-brief.html", "Conditional-rights legal brief — 4 excluded items", intro,
            candidate_licence_sections(excluded_candidates),
        ),
    }
    report = {
        "version": 1,
        "generated_at": "2026-10-01",
        "status": "PRIVATE_READ_ONLY_REVIEW_HANDOFF_HUMAN_DECISIONS_UNCHANGED",
        "candidate_items": len(items),
        "candidate_licence_reviews_pending": len(items),
        "candidate_teacher_reviews_ready": len(ready_candidates),
        "candidate_safeguarding_reviews_ready": len(ready_candidates),
        "conditional_rights_legal_reviews_required": len(excluded_candidates),
        "pilot_teacher_reviews_ready": len(draft_records),
        "pilot_safeguarding_reviews_ready": len(draft_records),
        "human_review_decisions_filled": 0,
        "training_approvals_granted": 0,
        "decision_record_files": [
            "data/reviews/candidate-intake-review.csv",
            "data/authoring/pilot-balanced-v1-review.csv",
        ],
        "workbooks": workbooks,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
