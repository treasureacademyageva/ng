#!/usr/bin/env python3
"""Validate evaluation and Nigerian-language human review gates; fail closed."""
from __future__ import annotations

import csv
import json
import re
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_DECISIONS = {"PENDING", "APPROVED", "CHANGES_REQUIRED"}
AI_NAMES = {"ai", "assistant", "arena agent", "chatgpt", "claude", "gemini"}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_cases(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def load_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def valid_review_date(value: str) -> bool:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value or ""):
        return False
    try:
        return date.fromisoformat(value) <= date.today()
    except ValueError:
        return False


def validate_track(name: str, path: Path, cases: list[dict], required_role: str, errors: list[str]) -> dict:
    rows = load_csv(path)
    case_ids = [case["id"] for case in cases]
    row_ids = [row.get("case_id", "") for row in rows]
    if len(row_ids) != len(set(row_ids)):
        errors.append(f"{name}: duplicate case_id")
    missing = sorted(set(case_ids) - set(row_ids))
    extra = sorted(set(row_ids) - set(case_ids))
    if missing:
        errors.append(f"{name}: {len(missing)} case(s) missing")
    if extra:
        errors.append(f"{name}: {len(extra)} unknown case(s)")
    by_id = {row.get("case_id"): row for row in rows}
    statuses = Counter()
    for case_id in case_ids:
        row = by_id.get(case_id)
        if not row:
            continue
        decision = row.get("decision", "")
        statuses[decision] += 1
        if decision not in ALLOWED_DECISIONS:
            errors.append(f"{name}/{case_id}: invalid decision {decision!r}")
            continue
        if decision == "PENDING":
            continue
        reviewer = row.get("reviewer_name", "").strip()
        if not reviewer or reviewer.casefold() in AI_NAMES:
            errors.append(f"{name}/{case_id}: named human reviewer required")
        if row.get("reviewer_role", "").strip() != required_role:
            errors.append(f"{name}/{case_id}: reviewer_role must be {required_role}")
        if not valid_review_date(row.get("reviewed_at", "").strip()):
            errors.append(f"{name}/{case_id}: valid reviewed_at date required")
        if decision == "CHANGES_REQUIRED" and not row.get("notes", "").strip():
            errors.append(f"{name}/{case_id}: changes require notes")
    approved = statuses["APPROVED"]
    return {
        "file": str(path.relative_to(ROOT)),
        "rows": len(rows),
        "approved": approved,
        "pending": statuses["PENDING"],
        "changes_required": statuses["CHANGES_REQUIRED"],
        "complete": len(rows) == len(cases) and approved == len(cases),
    }


def validate_languages(policy: dict, manifest: dict, errors: list[str]) -> dict:
    settings = policy["human_review"]
    roles = settings["languages_requiring_qualified_review"]
    path = ROOT / settings["language_review_file"]
    rows = load_csv(path)
    keys = [(row.get("source_id", ""), row.get("language", "")) for row in rows]
    if len(keys) != len(set(keys)):
        errors.append("language: duplicate source/language row")
    by_key = {key: row for key, row in zip(keys, rows)}
    approved = 0
    pending = 0
    for row in rows:
        decision = row.get("decision", "")
        if decision not in ALLOWED_DECISIONS:
            errors.append(f"language/{row.get('source_id')}: invalid decision {decision!r}")
            continue
        if decision == "PENDING":
            pending += 1
            continue
        language = row.get("language", "")
        expected_role = roles.get(language)
        if not expected_role:
            errors.append(f"language/{row.get('source_id')}: unsupported review language {language!r}")
            continue
        if not row.get("reviewer_name", "").strip() or row.get("reviewer_name", "").casefold() in AI_NAMES:
            errors.append(f"language/{row.get('source_id')}: named human reviewer required")
        if row.get("reviewer_role", "").strip() != expected_role:
            errors.append(f"language/{row.get('source_id')}: reviewer_role must be {expected_role}")
        if not valid_review_date(row.get("reviewed_at", "").strip()):
            errors.append(f"language/{row.get('source_id')}: valid reviewed_at date required")
        if decision == "APPROVED":
            approved += 1
    required_training = []
    for source in manifest["sources"]:
        if not source.get("enabled") or not source.get("approved_for_training", source.get("reviewed", False)):
            continue
        language = source.get("language")
        if language not in roles:
            continue
        required_training.append(source["id"])
        row = by_key.get((source["id"], language))
        if not row or row.get("decision") != "APPROVED":
            errors.append(f"language/{source['id']}: training approval requires completed qualified {language} review")
    return {
        "file": str(path.relative_to(ROOT)),
        "rows": len(rows),
        "approved": approved,
        "pending": pending,
        "training_sources_requiring_review": required_training,
        "training_language_gate_complete": not required_training or all(
            by_key.get((source["id"], source["language"]), {}).get("decision") == "APPROVED"
            for source in manifest["sources"]
            if source.get("enabled")
            and source.get("approved_for_training", source.get("reviewed", False))
            and source.get("language") in roles
        ),
    }


def validate_story_reviews(policy: dict, errors: list[str]) -> dict:
    tracks = {
        "teacher": "qualified_nigerian_primary_teacher",
        "safeguarding": "designated_safeguarding_lead",
    }
    collections = []
    all_complete = True
    all_ids = set()
    for spec in policy["human_review"]["staged_story_review_files"]:
        path = ROOT / spec["path"]
        rows = load_csv(path)
        ids = [row.get("document_id", "") for row in rows]
        if not rows:
            errors.append(f"staged_stories/{spec['id']}: review packet is empty or missing")
        if len(ids) != len(set(ids)) or any(not value for value in ids):
            errors.append(f"staged_stories/{spec['id']}: duplicate or missing document_id")
        overlap = all_ids.intersection(ids)
        if overlap:
            errors.append(f"staged_stories/{spec['id']}: document IDs overlap another packet")
        all_ids.update(ids)
        result = {
            "id": spec["id"],
            "language": spec["language"],
            "file": str(path.relative_to(ROOT)),
            "rows": len(rows),
        }
        complete = bool(rows)
        for track, required_role in tracks.items():
            statuses = Counter()
            for row in rows:
                decision = row.get(f"{track}_decision", "")
                statuses[decision] += 1
                if decision not in ALLOWED_DECISIONS:
                    errors.append(
                        f"staged_stories/{spec['id']}/{row.get('document_id')}/{track}: invalid decision {decision!r}"
                    )
                    continue
                if decision == "PENDING":
                    continue
                reviewer = row.get(f"{track}_reviewer_name", "").strip()
                if not reviewer or reviewer.casefold() in AI_NAMES:
                    errors.append(
                        f"staged_stories/{spec['id']}/{row.get('document_id')}/{track}: named human reviewer required"
                    )
                if row.get(f"{track}_reviewer_role", "").strip() != required_role:
                    errors.append(
                        f"staged_stories/{spec['id']}/{row.get('document_id')}/{track}: reviewer_role must be {required_role}"
                    )
                if not valid_review_date(row.get(f"{track}_reviewed_at", "").strip()):
                    errors.append(
                        f"staged_stories/{spec['id']}/{row.get('document_id')}/{track}: valid reviewed_at date required"
                    )
                if decision == "CHANGES_REQUIRED" and not row.get(f"{track}_notes", "").strip():
                    errors.append(
                        f"staged_stories/{spec['id']}/{row.get('document_id')}/{track}: changes require notes"
                    )
            result[track] = {
                "approved": statuses["APPROVED"],
                "pending": statuses["PENDING"],
                "changes_required": statuses["CHANGES_REQUIRED"],
            }
            complete = complete and statuses["APPROVED"] == len(rows)
        result["complete"] = complete
        all_complete = all_complete and complete
        collections.append(result)
    return {
        "collections": collections,
        "documents": len(all_ids),
        "complete": bool(collections) and all_complete,
    }

def validate_candidates(errors: list[str]) -> dict:
    path = ROOT / "data/source-candidates.json"
    data = load_json(path)
    ids = set()
    eligible = []
    required = {
        "id", "title", "provider", "license_status", "observed_license",
        "intended_coverage_tags", "languages", "grade_band", "intake_status",
        "training_eligible", "next_action", "notes",
    }
    for candidate in data.get("candidates", []):
        cid = candidate.get("id")
        if not cid or cid in ids:
            errors.append(f"candidates: duplicate/missing id {cid!r}")
        ids.add(cid)
        missing = sorted(required - set(candidate))
        if missing:
            errors.append(f"candidates/{cid}: missing {', '.join(missing)}")
        if candidate.get("training_eligible"):
            eligible.append(cid)
            errors.append(f"candidates/{cid}: candidate registry cannot grant training eligibility")
        if candidate.get("license_status") in {"NO_AFFIRMATIVE_TRAINING_LICENCE", "OUT_OF_SCOPE"} and candidate.get("training_eligible"):
            errors.append(f"candidates/{cid}: incompatible candidate marked eligible")
    return {
        "file": str(path.relative_to(ROOT)),
        "candidates": len(data.get("candidates", [])),
        "training_eligible": eligible,
    }


def main() -> None:
    policy = load_json(ROOT / "data/readiness-policy.json")
    cases = load_cases(ROOT / policy["human_review"]["evaluation_case_file"])
    manifest = load_json(ROOT / "data/sources.json")
    errors: list[str] = []
    human = policy["human_review"]
    teacher = validate_track(
        "teacher", ROOT / human["teacher_review_file"], cases, human["teacher_required_role"], errors
    )
    safeguarding = validate_track(
        "safeguarding", ROOT / human["safeguarding_review_file"], cases,
        human["safeguarding_required_role"], errors
    )
    language = validate_languages(policy, manifest, errors)
    staged_stories = validate_story_reviews(policy, errors)
    candidates = validate_candidates(errors)
    report = {
        "evaluation_cases": len(cases),
        "teacher": teacher,
        "safeguarding": safeguarding,
        "language": language,
        "staged_stories": staged_stories,
        "candidates": candidates,
        "human_review_gate_complete": (
            teacher["complete"]
            and safeguarding["complete"]
            and language["training_language_gate_complete"]
            and staged_stories["complete"]
        ),
        "errors": errors,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
