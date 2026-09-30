#!/usr/bin/env python3
"""Build reviewer-friendly CSV packets without ever auto-approving a case."""
from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / "data/evaluation/cases-v2.jsonl"
REVIEWS = ROOT / "data/reviews"
TRACKS = {
    "teacher": {
        "path": REVIEWS / "evaluation-teacher-review.csv",
        "required_role": "qualified_nigerian_primary_teacher",
    },
    "safeguarding": {
        "path": REVIEWS / "evaluation-safeguarding-review.csv",
        "required_role": "designated_safeguarding_lead",
    },
}
FIELDS = [
    "case_id",
    "case_sha256",
    "category",
    "prompt",
    "expected_action",
    "expected_reference",
    "forbidden_content",
    "rationale",
    "decision",
    "reviewer_name",
    "reviewer_role",
    "reviewed_at",
    "notes",
]
PRESERVED = {"decision", "reviewer_name", "reviewer_role", "reviewed_at", "notes"}


def load_cases() -> list[dict]:
    return [json.loads(line) for line in CASES.read_text(encoding="utf-8").splitlines() if line.strip()]


def case_digest(case: dict) -> str:
    payload = json.dumps(case, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def prompt_text(case: dict) -> str:
    return "\n".join(f"{turn['role'].upper()}: {turn['content']}" for turn in case["turns"])


def expected_reference(case: dict) -> str:
    if case.get("expected_answer"):
        return str(case["expected_answer"])
    values = case.get("expected_contains", [])
    return " | ".join(str(value) for value in values)


def current_decisions(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    with path.open(newline="", encoding="utf-8") as handle:
        return {row["case_id"]: row for row in csv.DictReader(handle)}


def build_track(track: str, path: Path, required_role: str, cases: list[dict]) -> None:
    old = current_decisions(path)
    rows = []
    for case in cases:
        row = {
            "case_id": case["id"],
            "case_sha256": case_digest(case),
            "category": case["category"],
            "prompt": prompt_text(case),
            "expected_action": case["expected_action"],
            "expected_reference": expected_reference(case),
            "forbidden_content": " | ".join(str(value) for value in case.get("forbidden_contains", [])),
            "rationale": case["rationale"],
            "decision": "PENDING",
            "reviewer_name": "",
            "reviewer_role": "",
            "reviewed_at": "",
            "notes": "",
        }
        prior = old.get(case["id"], {})
        if prior.get("case_sha256") == row["case_sha256"]:
            for field in PRESERVED:
                row[field] = prior.get(field, row[field])
        rows.append(row)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"{track}: wrote {len(rows)} cases to {path.relative_to(ROOT)}; required role: {required_role}")


def main() -> None:
    cases = load_cases()
    if len(cases) < 240:
        raise SystemExit(f"Expected at least 240 cases, found {len(cases)}")
    for track, settings in TRACKS.items():
        build_track(track, settings["path"], settings["required_role"], cases)


if __name__ == "__main__":
    main()
