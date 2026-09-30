#!/usr/bin/env python3
"""Stage commercial-compatible Storybooks Nigeria text for human review.

English, Nigerian Pidgin, Hausa and Yoruba are extracted from pinned upstream
commits. Staging is separate from sources.json and never approves training use.
Every selected story still needs teacher and safeguarding review; Nigerian
Pidgin, Hausa and Yoruba additionally remain blocked on qualified speakers.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import html as html_lib
import io
import json
import re
import tarfile
import urllib.request
from collections import Counter
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
SITE_COMMIT = "dd104b90d4274ebd1395bdbf4d68cc5b7e56c5d4"
SOURCE_COMMIT = "b5c3d5b2266ad936e5f20fa878e839b32b02b4ba"
SITE_ARCHIVE = f"https://codeload.github.com/global-asp/storybooks-nigeria/tar.gz/{SITE_COMMIT}"
SOURCE_ARCHIVE = f"https://codeload.github.com/global-asp/asp-source/tar.gz/{SOURCE_COMMIT}"
USER_AGENT = "TreasureEDU/0.1 licensed corpus staging; contact treasuregroupofschool@gmail.com"
MAX_ARCHIVE_BYTES = 25 * 1024 * 1024
LANGUAGE_STAGING = {
    "pcm": {"name": "Nigerian Pidgin", "bcp47": "pcm-NG", "slug": "pidgin", "catalogue": 7, "accepted": 7, "excluded": 0},
    "ha": {"name": "Hausa", "bcp47": "ha", "slug": "hausa", "catalogue": 6, "accepted": 4, "excluded": 2},
    "yo": {"name": "Yoruba", "bcp47": "yo", "slug": "yoruba", "catalogue": 8, "accepted": 6, "excluded": 2},
}


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=90) as response:
        data = response.read(MAX_ARCHIVE_BYTES + 1)
    if len(data) > MAX_ARCHIVE_BYTES:
        raise ValueError(f"archive exceeds {MAX_ARCHIVE_BYTES} bytes")
    return data


def archive_files(data: bytes) -> dict[str, bytes]:
    result = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        for member in archive.getmembers():
            if not member.isfile():
                continue
            parts = PurePosixPath(member.name).parts
            if len(parts) < 2:
                continue
            relative = "/".join(parts[1:])
            extracted = archive.extractfile(member)
            if extracted:
                result[relative] = extracted.read()
    return result


def markdown_record(story_id: str, raw: str) -> dict:
    title_match = re.search(r"(?m)^# (.+)$", raw)
    license_match = re.search(r"(?m)^\* License: \[([^\]]+)\]$", raw)
    creator_match = re.search(r"(?m)^\* Text: (.+)$", raw)
    illustrator_match = re.search(r"(?m)^\* Illustration: (.+)$", raw)
    language_match = re.search(r"(?m)^\* Language: (.+)$", raw)
    required = [title_match, license_match, creator_match, illustrator_match, language_match]
    if not all(required):
        raise ValueError(f"{story_id}: incomplete source metadata")
    body = raw[: license_match.start()]
    body = re.sub(r"(?m)^#{1,2}\s*", "", body)
    paragraphs = [" ".join(chunk.split()) for chunk in re.split(r"\n\s*\n", body)]
    paragraphs = [chunk for chunk in paragraphs if chunk]
    if paragraphs and paragraphs[0] == title_match.group(1).strip():
        paragraphs = paragraphs[1:]
    text = "\n\n".join(paragraphs).strip()
    if len(text) < 20:
        raise ValueError(f"{story_id}: extracted story is too short")
    return {
        "id": story_id,
        "title": title_match.group(1).strip(),
        "creator": creator_match.group(1).strip(),
        "illustrator": illustrator_match.group(1).strip(),
        "language": language_match.group(1).strip(),
        "source_license": license_match.group(1).strip(),
        "text": text,
    }


def exact_site_license(story_id: str, html: str) -> tuple[str, str]:
    matches = re.findall(r"https://creativecommons\.org/licenses/(by(?:-nc)?)/(\d+\.\d+)/", html, re.I)
    if not matches:
        raise ValueError(f"{story_id}: site page has no exact Creative Commons licence URL")
    family, version = matches[0]
    if any(item != matches[0] for item in matches):
        raise ValueError(f"{story_id}: conflicting Creative Commons licence URLs")
    return family.lower(), version


def html_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    return " ".join(html_lib.unescape(value).split())


def html_record(story_id: str, raw: str, language: str) -> dict:
    title = re.search(r'<h1><span class="def">(.*?)</span>', raw, re.S)
    creator = re.search(r'<span class="colophon-heading">Written by:</span>\s*(.*?)</h5>', raw, re.S)
    illustrator = re.search(r'<span class="colophon-heading">Illustrated by:</span>\s*(.*?)</h5>', raw, re.S)
    translator = re.search(r'<span class="colophon-heading">Translated by:</span>\s*(.*?)</h5>', raw, re.S)
    level = re.search(rf'/stories/{re.escape(language)}/level(\d+)">Level\s+\d+</a>', raw, re.S)
    chunks = re.findall(r'<div class="[^"]*\bdef\b[^"]*"><h3>\s*(.*?)\s*</h3></div>', raw, re.S)
    paragraphs = [html_text(value) for value in chunks]
    paragraphs = [value for value in paragraphs if value]
    required = [title, creator, illustrator, level]
    if not all(required) or not paragraphs:
        raise ValueError(f"{story_id}: incomplete published story metadata or text")
    return {
        "id": story_id,
        "title": html_text(title.group(1)),
        "creator": html_text(creator.group(1)),
        "illustrator": html_text(illustrator.group(1)),
        "translator": html_text(translator.group(1)) if translator else None,
        "reading_level": int(level.group(1)),
        "text": "\n\n".join(paragraphs),
    }


def stage_language(site: dict[str, bytes], code: str, settings: dict) -> tuple[list[dict], list[dict]]:
    pattern = re.compile(rf"^stories/{re.escape(code)}/(\d{{4}})/index\.html$")
    story_ids = sorted(match.group(1) for path in site if (match := pattern.match(path)))
    if len(story_ids) != settings["catalogue"]:
        raise SystemExit(
            f"Pinned {settings['name']} catalogue changed: expected {settings['catalogue']}, found {len(story_ids)}"
        )
    accepted = []
    excluded = []
    for story_id in story_ids:
        page = site[f"stories/{code}/{story_id}/index.html"].decode("utf-8")
        family, version = exact_site_license(story_id, page)
        if family != "by":
            excluded.append({
                "id": story_id,
                "site_license": f"CC-{family.upper()}-{version}",
                "reason": "non-commercial or incompatible licence",
            })
            continue
        record = html_record(story_id, page, code)
        record.update({
            "document_id": f"storybooks-nigeria-{code}-{story_id}",
            "language": settings["bcp47"],
            "license": f"CC-BY-{version}",
            "license_url": f"https://creativecommons.org/licenses/by/{version}/",
            "storybooks_nigeria_url": f"https://global-asp.github.io/storybooks-nigeria/stories/{code}/{story_id}/",
            "site_commit": SITE_COMMIT,
            "review_status": "pending_qualified_language_teacher_and_safeguarding_review",
            "approved_for_training": False,
        })
        record["text_sha256"] = hashlib.sha256(record["text"].encode("utf-8")).hexdigest()
        accepted.append(record)
    if len(accepted) != settings["accepted"] or len(excluded) != settings["excluded"]:
        raise SystemExit(
            f"Pinned {settings['name']} licence selection changed: expected "
            f"{settings['accepted']} accepted/{settings['excluded']} excluded, found {len(accepted)}/{len(excluded)}"
        )
    return accepted, excluded


STORY_REVIEW_FIELDS = [
    "document_id", "text_sha256", "title", "creator", "license", "source_url",
    "teacher_decision", "teacher_reviewer_name", "teacher_reviewer_role", "teacher_reviewed_at", "teacher_notes",
    "safeguarding_decision", "safeguarding_reviewer_name", "safeguarding_reviewer_role",
    "safeguarding_reviewed_at", "safeguarding_notes",
]
STORY_REVIEW_DECISION_FIELDS = {
    "teacher_decision", "teacher_reviewer_name", "teacher_reviewer_role", "teacher_reviewed_at", "teacher_notes",
    "safeguarding_decision", "safeguarding_reviewer_name", "safeguarding_reviewer_role",
    "safeguarding_reviewed_at", "safeguarding_notes",
}


def write_review_packet(path: Path, records: list[dict]) -> None:
    existing = {}
    if path.exists():
        with path.open(newline="", encoding="utf-8") as handle:
            existing = {row["document_id"]: row for row in csv.DictReader(handle)}
    rows = []
    for record in records:
        row = {
            "document_id": record["document_id"],
            "text_sha256": record["text_sha256"],
            "title": record["title"],
            "creator": record["creator"],
            "license": record["license"],
            "source_url": record["storybooks_nigeria_url"],
            "teacher_decision": "PENDING",
            "teacher_reviewer_name": "",
            "teacher_reviewer_role": "",
            "teacher_reviewed_at": "",
            "teacher_notes": "",
            "safeguarding_decision": "PENDING",
            "safeguarding_reviewer_name": "",
            "safeguarding_reviewer_role": "",
            "safeguarding_reviewed_at": "",
            "safeguarding_notes": "",
        }
        prior = existing.get(record["document_id"], {})
        if prior.get("text_sha256") == row["text_sha256"]:
            for field in STORY_REVIEW_DECISION_FIELDS:
                row[field] = prior.get(field, row[field])
        rows.append(row)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=STORY_REVIEW_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="data/staging/storybooks-nigeria-english-cc-by.jsonl")
    parser.add_argument("--report", default="data/staging/storybooks-nigeria-english-cc-by-report.json")
    parser.add_argument("--review-packet", default="data/reviews/storybooks-nigeria-english-review.csv")
    args = parser.parse_args()

    site_data = download(SITE_ARCHIVE)
    source_data = download(SOURCE_ARCHIVE)
    site = archive_files(site_data)
    source = archive_files(source_data)
    site_pattern = re.compile(r"^stories/en/(\d{4})/index\.html$")
    story_ids = sorted(match.group(1) for path in site if (match := site_pattern.match(path)))
    if len(story_ids) != 40:
        raise SystemExit(f"Pinned Storybooks Nigeria catalogue changed: expected 40 English stories, found {len(story_ids)}")

    accepted = []
    excluded = []
    for story_id in story_ids:
        matches = [path for path in source if re.fullmatch(rf"en/{story_id}_.+\.md", path)]
        if len(matches) != 1:
            raise SystemExit(f"{story_id}: expected one source markdown file, found {len(matches)}")
        record = markdown_record(story_id, source[matches[0]].decode("utf-8"))
        family, version = exact_site_license(story_id, site[f"stories/en/{story_id}/index.html"].decode("utf-8"))
        if record["source_license"] == "CC-BY" and family == "by":
            record.update({
                "document_id": f"storybooks-nigeria-en-{story_id}",
                "license": f"CC-BY-{version}",
                "license_url": f"https://creativecommons.org/licenses/by/{version}/",
                "storybooks_nigeria_url": f"https://global-asp.github.io/storybooks-nigeria/stories/en/{story_id}/",
                "source_markdown_url": f"https://github.com/global-asp/asp-source/blob/{SOURCE_COMMIT}/{matches[0]}",
                "site_commit": SITE_COMMIT,
                "source_commit": SOURCE_COMMIT,
                "review_status": "pending_nigerian_teacher_and_safeguarding_review",
                "approved_for_training": False,
                "text_sha256": hashlib.sha256(record["text"].encode("utf-8")).hexdigest(),
            })
            accepted.append(record)
        else:
            excluded.append({
                "id": story_id,
                "source_license": record["source_license"],
                "site_license": f"CC-{family.upper()}-{version}",
                "reason": "non-commercial or incompatible licence",
            })

    if len(accepted) != 29 or len(excluded) != 11:
        raise SystemExit(f"Pinned licence selection changed: expected 29 accepted/11 excluded, found {len(accepted)}/{len(excluded)}")

    output = ROOT / args.output
    report_path = ROOT / args.report
    review_packet = ROOT / args.review_packet
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in accepted), encoding="utf-8")
    write_review_packet(review_packet, accepted)

    additional_languages = {}
    for code, settings in LANGUAGE_STAGING.items():
        language_records, language_excluded = stage_language(site, code, settings)
        language_output = ROOT / f"data/staging/storybooks-nigeria-{settings['slug']}-cc-by.jsonl"
        language_review = ROOT / f"data/reviews/storybooks-nigeria-{settings['slug']}-review.csv"
        language_output.write_text(
            "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in language_records), encoding="utf-8"
        )
        write_review_packet(language_review, language_records)
        additional_languages[code] = {
            "name": settings["name"],
            "catalogue_items": settings["catalogue"],
            "staged_cc_by_items": len(language_records),
            "staged_licenses": dict(sorted(Counter(row["license"] for row in language_records).items())),
            "excluded_incompatible_items": len(language_excluded),
            "staged_characters": sum(len(row["text"]) for row in language_records),
            "output": str(language_output.relative_to(ROOT)),
            "output_sha256": hashlib.sha256(language_output.read_bytes()).hexdigest(),
            "review_packet": str(language_review.relative_to(ROOT)),
            "excluded": language_excluded,
        }

    report = {
        "status": "STAGED_ONLY_NOT_TRAINING_APPROVED",
        "site_commit": SITE_COMMIT,
        "source_commit": SOURCE_COMMIT,
        "site_archive_sha256": hashlib.sha256(site_data).hexdigest(),
        "source_archive_sha256": hashlib.sha256(source_data).hexdigest(),
        "catalogue_items": len(story_ids),
        "staged_cc_by_items": len(accepted),
        "staged_licenses": dict(sorted(Counter(row["license"] for row in accepted).items())),
        "excluded_incompatible_items": len(excluded),
        "staged_characters": sum(len(row["text"]) for row in accepted),
        "output_sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "review_packet": str(review_packet.relative_to(ROOT)),
        "additional_languages": additional_languages,
        "excluded": excluded,
        "next_gate": "Nigerian primary teacher and safeguarding review of every staged story",
    }
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
