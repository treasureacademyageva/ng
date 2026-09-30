#!/usr/bin/env python3
"""Fetch public NAPPS-aligned topic schedules as non-training alignment metadata.

Only week labels and topic headings are retained. Source explanations, lesson text,
activities and objectives are deliberately not copied.
"""
from __future__ import annotations

import csv
import hashlib
import html
import json
import re
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/authoring/napps-alignment-sources.json"
OUTPUT = ROOT / "data/authoring/napps-primary-english-mathematics-alignment.csv"
STAGING = ROOT / "data/staging/napps-alignment"
REPORT = STAGING / "report.json"
FIELDS = [
    "alignment_id", "primary_class", "subject", "term", "week", "topic", "source_id",
    "source_url", "source_topic_index_sha256", "source_modified_at", "instructional", "verification_status",
    "training_eligible", "authoring_status",
]
BLOCK = re.compile(r"<(?P<tag>h2|p)\b[^>]*>(?P<body>.*?)</(?P=tag)>", re.I | re.S)
TABLE = re.compile(r"<table\b[^>]*>(.*?)</table>", re.I | re.S)
ROW = re.compile(r"<tr\b[^>]*>(.*?)</tr>", re.I | re.S)
CELL = re.compile(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", re.I | re.S)
NON_INSTRUCTIONAL = re.compile(r"\b(exam|examination|revision|closing|break|test)\b", re.I)


def plain(fragment: str) -> str:
    fragment = re.sub(r"<br\s*/?>", " ", fragment, flags=re.I)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    return " ".join(html.unescape(fragment).split())


def slug(value: str) -> str:
    value = value.lower().replace("–", "-").replace("—", "-")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def fetch(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "TreasureAcademy-CurriculumAlignment/1.0 (+https://treasureacademyageva.vercel.app)"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        if response.status != 200:
            raise RuntimeError(f"{url}: HTTP {response.status}")
        return response.read()


def extract(source: dict, raw: bytes) -> tuple[list[dict[str, str]], list[str]]:
    primary_class = int(source["primary_class"])
    text = raw.decode("utf-8", "replace")
    rows = []
    warnings = []
    combinations = Counter()
    for match in BLOCK.finditer(text):
        heading = plain(match.group("body"))
        upper = heading.upper()
        if "TERM" not in upper or not ("ENGLISH LANGUAGE" in upper or "MATHEMATICS" in upper):
            continue
        if f"PRIMARY {primary_class}" not in upper and f"(PRIMARY {primary_class})" not in upper:
            continue
        term_match = re.search(r"\b(FIRST|SECOND|THIRD) TERM\b", upper)
        if not term_match:
            continue
        subject = "english" if "ENGLISH LANGUAGE" in upper else "mathematics"
        term = term_match.group(1).lower()
        table = TABLE.search(text, match.end())
        if not table:
            warnings.append(f"P{primary_class} {subject} {term}: no table after heading")
            continue
        extracted = 0
        for row_match in ROW.finditer(table.group(1)):
            cells = [plain(cell) for cell in CELL.findall(row_match.group(1))]
            if len(cells) < 2 or cells[0].strip().lower() == "week":
                continue
            week, topic = cells[0].strip(), cells[1].strip()
            if not week or not topic:
                continue
            alignment_id = f"napps-web-p{primary_class}-{subject}-{term}-{slug(week)}"
            rows.append({
                "alignment_id": alignment_id,
                "primary_class": str(primary_class),
                "subject": subject,
                "term": term,
                "week": week,
                "topic": topic,
                "source_id": source["id"],
                "source_url": source["url"],
                "source_topic_index_sha256": "",
                "source_modified_at": source["modified_at"],
                "instructional": str(NON_INSTRUCTIONAL.search(topic) is None).lower(),
                "verification_status": source["verification_status"],
                "training_eligible": "false",
                "authoring_status": "READY_FOR_ORIGINAL_AUTHORING",
            })
            extracted += 1
        combinations[(subject, term)] += 1
        if extracted < 8:
            warnings.append(
                f"P{primary_class} {subject} {term}: only {extracted} published schedule rows; school copy must confirm completeness"
            )
    expected = {(subject, term) for subject in ("english", "mathematics") for term in ("first", "second", "third")}
    found = set(combinations)
    for subject, term in sorted(expected - found):
        warnings.append(f"P{primary_class} {subject} {term}: schedule missing")
    canonical_topics = [
        {key: row[key] for key in ("primary_class", "subject", "term", "week", "topic")}
        for row in rows
    ]
    topic_index_sha256 = hashlib.sha256(
        json.dumps(canonical_topics, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    for row in rows:
        row["source_topic_index_sha256"] = topic_index_sha256
    return rows, warnings


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    STAGING.mkdir(parents=True, exist_ok=True)
    all_rows = []
    warnings = []
    source_reports = []
    for source in manifest["public_alignment_sources"]:
        raw = fetch(source["url"])
        raw_path = STAGING / f"primary-{source['primary_class']}.html"
        raw_path.write_bytes(raw)
        rows, source_warnings = extract(source, raw)
        all_rows.extend(rows)
        warnings.extend(source_warnings)
        page_text = plain(raw.decode("utf-8", "replace")).lower()
        common_markers = ["english studies", "mathematics", "nigerian history", "social and citizenship studies"]
        level_markers = (
            ["basic science", "physical and health education", "cultural and creative arts"]
            if int(source["primary_class"]) <= 3
            else ["basic science", "basic digital literacy", "pre-vocational studies", "french"]
        )
        national_structure_markers_present = all(marker in page_text for marker in common_markers + level_markers)
        if not national_structure_markers_present:
            warnings.append(f"P{source['primary_class']}: revised national subject-structure markers are incomplete")
        source_reports.append({
            "id": source["id"],
            "primary_class": source["primary_class"],
            "raw_sha256": hashlib.sha256(raw).hexdigest(),
            "bytes": len(raw),
            "rows": len(rows),
            "national_structure_markers_present": national_structure_markers_present,
        })
    ids = [row["alignment_id"] for row in all_rows]
    if len(ids) != len(set(ids)):
        raise RuntimeError("duplicate alignment IDs extracted")
    all_rows.sort(key=lambda row: (
        int(row["primary_class"]), row["subject"], {"first": 1, "second": 2, "third": 3}[row["term"]], row["week"]
    ))
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(all_rows)
    combinations = Counter((row["primary_class"], row["subject"], row["term"]) for row in all_rows)
    report = {
        "manifest": str(MANIFEST.relative_to(ROOT)),
        "output": str(OUTPUT.relative_to(ROOT)),
        "sources": source_reports,
        "rows": len(all_rows),
        "instructional_rows": sum(row["instructional"] == "true" for row in all_rows),
        "class_subject_term_combinations": len(combinations),
        "required_combinations": 36,
        "official_napps_edition_verified": manifest["official_status"]["latest_official_edition_verified"],
        "training_eligible_rows": 0,
        "warnings": warnings,
    }
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
