#!/usr/bin/env python3
"""Safely stage exact, openly licensed candidate items without approving them.

The registry is the URL allowlist. Downloads are bounded, redirects are checked
before following, originals remain under ignored data/staging, and every output
is hash-bound to a pending human-review packet. This command cannot add a
candidate to sources.json or grant training approval.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import html
import io
import json
import mimetypes
import re
import ssl
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
sys.path.insert(0, str(ROOT / "scripts"))
from deduplication import NearDuplicateIndex, tokens  # noqa: E402

USER_AGENT = "TreasureEDU/0.2 licensed-corpus-staging; contact treasuregroupofschool@gmail.com"
REVIEW_FIELDS = [
    "item_id", "original_sha256", "extracted_sha256", "title", "creator", "language",
    "primary_subject", "context_class", "license", "source_url", "staging_status",
    "licence_decision", "licence_reviewer_name", "licence_reviewer_role", "licence_reviewed_at", "licence_notes",
    "teacher_decision", "teacher_reviewer_name", "teacher_reviewer_role", "teacher_reviewed_at", "teacher_notes",
    "safeguarding_decision", "safeguarding_reviewer_name", "safeguarding_reviewer_role",
    "safeguarding_reviewed_at", "safeguarding_notes",
    "language_decision", "language_reviewer_name", "language_reviewer_role", "language_reviewed_at", "language_notes",
    "approval_decision", "approval_reviewer_name", "approval_reviewer_role", "approval_reviewed_at", "approval_notes",
]
DECISION_FIELDS = {field for field in REVIEW_FIELDS if any(
    token in field for token in ("decision", "reviewer_name", "reviewer_role", "reviewed_at", "_notes")
)}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def normalized_content_type(value: str | None) -> str:
    return (value or "").split(";", 1)[0].strip().lower()


def safe_output_path(base: Path, item_id: str, suffix: str) -> Path:
    """Return an output path only for conservative IDs contained by base."""
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,119}", item_id):
        raise ValueError(f"unsafe candidate id: {item_id!r}")
    if not re.fullmatch(r"\.[a-z0-9]{1,10}", suffix):
        raise ValueError(f"unsafe suffix: {suffix!r}")
    base = base.resolve()
    result = (base / f"{item_id}{suffix}").resolve()
    if base not in result.parents:
        raise ValueError("output path escapes staging root")
    return result


def validate_url(url: str, policy: dict, *, exact_url: str | None = None) -> urllib.parse.SplitResult:
    try:
        parsed = urllib.parse.urlsplit(url)
    except ValueError as exc:
        raise ValueError(f"invalid URL: {exc}") from exc
    if parsed.scheme not in policy["allowed_schemes"]:
        raise ValueError(f"URL scheme is not allowlisted: {parsed.scheme!r}")
    if parsed.username or parsed.password:
        raise ValueError("URL credentials are forbidden")
    host = (parsed.hostname or "").lower()
    if host not in policy["allowed_hosts"]:
        raise ValueError(f"URL host is not allowlisted: {host!r}")
    if parsed.port not in (None, 443):
        raise ValueError("non-standard URL ports are forbidden")
    decoded_path = urllib.parse.unquote(parsed.path)
    if "\x00" in decoded_path or any(part == ".." for part in PurePosixPath(decoded_path).parts):
        raise ValueError("URL path traversal is forbidden")
    if exact_url is not None and url != exact_url:
        raise ValueError("candidate acquisition URL does not match the exact allowlisted URL")
    return parsed


def redirect_allowed(source_url: str, target_url: str, policy: dict) -> bool:
    """Allow HTTPS redirects only to explicit hosts or configured host suffixes."""
    source = urllib.parse.urlsplit(source_url)
    target = urllib.parse.urlsplit(urllib.parse.urljoin(source_url, target_url))
    if target.scheme not in policy["allowed_schemes"] or target.username or target.password:
        return False
    if target.port not in (None, 443):
        return False
    host = (target.hostname or "").lower()
    host_ok = host in policy["allowed_hosts"] or any(
        host.endswith(suffix) and host != suffix.lstrip(".")
        for suffix in policy.get("allowed_redirect_host_suffixes", [])
    )
    decoded_path = urllib.parse.unquote(target.path)
    if not host_ok or "\x00" in decoded_path or any(part == ".." for part in PurePosixPath(decoded_path).parts):
        return False
    # A redirect may add a CDN item prefix, but may not silently change the filename.
    source_name = PurePosixPath(source.path).name
    target_name = PurePosixPath(target.path).name
    return not source_name or source_name == target_name


class CheckedRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, policy: dict, audit: list[dict]):
        super().__init__()
        self.policy = policy
        self.audit = audit

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        target = urllib.parse.urljoin(req.full_url, newurl)
        if len(self.audit) >= self.policy["max_redirects"]:
            raise urllib.error.HTTPError(req.full_url, 508, "redirect limit exceeded", headers, fp)
        if not redirect_allowed(req.full_url, target, self.policy):
            raise urllib.error.HTTPError(req.full_url, 403, "redirect target is not allowlisted", headers, fp)
        self.audit.append({"status": code, "from": req.full_url, "to": target})
        return super().redirect_request(req, fp, code, msg, headers, target)


def bounded_download(url: str, policy: dict, expected_types: list[str]) -> tuple[bytes, dict]:
    validate_url(url, policy, exact_url=url)
    redirects: list[dict] = []
    opener = urllib.request.build_opener(CheckedRedirectHandler(policy, redirects))
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "identity"})
    limit = int(policy["maximum_download_bytes"])
    with opener.open(request, timeout=int(policy["timeout_seconds"])) as response:
        final_url = response.geturl()
        if final_url != url and not redirect_allowed(url, final_url, policy):
            raise ValueError("final response URL is not allowlisted")
        content_type = normalized_content_type(response.headers.get("Content-Type"))
        expected = {value.lower() for value in expected_types}
        if content_type not in expected or content_type not in policy["allowed_content_types"]:
            raise ValueError(f"unexpected content type: {content_type!r}")
        length = response.headers.get("Content-Length")
        if length and int(length) > limit:
            raise ValueError(f"download declares {int(length):,} bytes; limit is {limit:,}")
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError(f"download exceeds {limit:,} bytes")
    if not data:
        raise ValueError("download is empty")
    return data, {
        "requested_url": url,
        "final_url": final_url,
        "redirects": redirects,
        "content_type": content_type,
        "bytes": len(data),
    }


class VisibleTextParser(HTMLParser):
    SKIP = {"script", "style", "svg", "noscript"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.parts: list[str] = []
        self.block = False

    def handle_starttag(self, tag: str, attrs):  # noqa: ANN001
        if tag.lower() in self.SKIP:
            self.depth += 1
        if tag.lower() in {"p", "li", "h1", "h2", "h3", "h4", "br", "tr", "section"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str):
        if tag.lower() in self.SKIP and self.depth:
            self.depth -= 1
        if tag.lower() in {"p", "li", "h1", "h2", "h3", "h4", "tr", "section"}:
            self.parts.append("\n")

    def handle_data(self, data: str):
        if not self.depth:
            self.parts.append(data)

    def text(self) -> str:
        return " ".join("".join(self.parts).replace("\xa0", " ").split("\n"))


def html_to_text(value: str) -> str:
    parser = VisibleTextParser()
    parser.feed(value)
    parser.close()
    rough = html.unescape("\n".join(part.strip() for part in re.split(r"\n+", "".join(parser.parts)) if part.strip()))
    return re.sub(r"[ \t]+", " ", rough)


def strip_gutenberg(text: str) -> str:
    start = re.search(r"\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*", text, re.I)
    if start:
        text = text[start.end():]
    end = re.search(r"\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK", text, re.I)
    if end:
        text = text[:end.start()]
    return text


def clean_text(text: str, extraction_method: str) -> str:
    text = unicodedata.normalize("NFKC", text).replace("\r\n", "\n").replace("\r", "\n")
    if extraction_method == "plain-text" and "PROJECT GUTENBERG EBOOK" in text[:5000].upper():
        text = strip_gutenberg(text)
    text = text.replace("\x0c", "\n\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.strip()


def extract_pdf(data: bytes) -> str:
    marker = data.find(b"%PDF-")
    if marker < 0:
        raise ValueError("PDF signature is missing")
    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise ValueError("pypdf is required for PDF extraction") from exc
    reader = PdfReader(io.BytesIO(data[marker:]), strict=True)
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text(extraction_mode="layout") or "")
    return "\n\n".join(pages)


def extract_epub(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = archive.namelist()
        for name in names:
            path = PurePosixPath(name)
            if path.is_absolute() or any(part == ".." for part in path.parts):
                raise ValueError("EPUB contains a path-traversal member")
        html_names = sorted(
            name for name in names if PurePosixPath(name).suffix.lower() in {".html", ".htm", ".xhtml"}
        )
        if not html_names:
            raise ValueError("EPUB has no HTML content")
        chunks = []
        for name in html_names:
            value = archive.read(name).decode("utf-8", errors="strict")
            chunks.append(html_to_text(value))
    return "\n\n".join(chunk for chunk in chunks if chunk.strip())


def extract_mediawiki_json(data: bytes, expected_revision: str) -> tuple[str, dict]:
    payload = json.loads(data.decode("utf-8"))
    parsed = payload.get("parse", {})
    revision = str(parsed.get("revid", ""))
    if revision != str(expected_revision):
        raise ValueError(f"MediaWiki revision mismatch: expected {expected_revision}, received {revision}")
    html_value = parsed.get("text", {}).get("*") if isinstance(parsed.get("text"), dict) else parsed.get("text")
    if not isinstance(html_value, str):
        raise ValueError("MediaWiki response has no parse.text HTML")
    return html_to_text(html_value), {"revision": revision, "display_title": parsed.get("displaytitle")}


def extract_text(data: bytes, item: dict) -> tuple[str, dict]:
    method = item["extraction_method"]
    extra: dict = {}
    if method == "plain-text":
        raw = data.decode("utf-8", errors="strict")
    elif method == "mediawiki-pinned-revision-html":
        raw, extra = extract_mediawiki_json(data, item["source_revision"])
    elif method == "pdf-text":
        raw = extract_pdf(data)
    elif method == "epub-spine-text":
        raw = extract_epub(data)
    else:
        raise ValueError(f"unsupported extraction method: {method!r}")
    return clean_text(raw, method), extra


def paragraph_units(text: str) -> list[str]:
    units = []
    for value in re.split(r"\n\s*\n", text):
        value = " ".join(value.split())
        if len(value) >= 20:
            units.append(value)
    if not units and text.strip():
        units = [" ".join(text.split())]
    return units


def masked_sample(value: str) -> str:
    if len(value) <= 4:
        return "*" * len(value)
    return value[:2] + "*" * min(12, len(value) - 4) + value[-2:]


def scan_privacy(text: str, policy: dict) -> list[dict]:
    warnings = []
    flags = re.I | re.M
    for name, pattern in policy["privacy_patterns"].items():
        for match in re.finditer(pattern, text, flags):
            before = text[max(0, match.start() - 28):match.start()].casefold()
            if name == "bank_account_candidate" and not re.search(r"(?:account|acct|bank|transfer)\W{0,20}$", before):
                continue
            warnings.append({"kind": name, "offset": match.start(), "masked": masked_sample(match.group(0))})
            if len(warnings) >= 50:
                return warnings
    return warnings


def scan_quality(text: str, policy: dict) -> dict:
    length = max(1, len(text))
    controls = sum(ord(char) < 32 and char not in "\n\t" for char in text)
    replacements = text.count("\ufffd")
    alphanumeric = sum(char.isalnum() for char in text)
    words = tokens(text)
    limits = policy["quality_limits"]
    errors = []
    if len(text) < policy["minimum_extracted_characters"]:
        errors.append("extracted text is too short")
    if len(words) < limits["minimum_word_count"]:
        errors.append("extracted word count is too low")
    if replacements / length > limits["maximum_replacement_character_rate"]:
        errors.append("replacement-character rate exceeds policy")
    if controls / length > limits["maximum_control_character_rate"]:
        errors.append("control-character rate exceeds policy")
    if alphanumeric / length < limits["minimum_alphanumeric_character_share"]:
        errors.append("alphanumeric-character share is below policy")
    return {
        "characters": len(text),
        "words": len(words),
        "replacement_characters": replacements,
        "control_characters": controls,
        "alphanumeric_character_share": alphanumeric / length,
        "errors": errors,
    }


def estimate_bpe_tokens(text: str) -> tuple[int, str]:
    tokenizer_path = ROOT / "data/pretraining/tokenizer-8k.json"
    if tokenizer_path.exists():
        try:
            from tokenizers import Tokenizer
            tokenizer = Tokenizer.from_file(str(tokenizer_path))
            return len(tokenizer.encode(text).ids), "treasure_edu_bpe_8192"
        except Exception:
            pass
    return max(1, round(len(text.encode("utf-8")) / 4)), "utf8_bytes_divided_by_4_fallback"


def classify_context(item: dict, policy: dict) -> str:
    evidence = item.get("context_evidence") or {}
    context = item.get("context_class")
    if context not in policy["context_classes"]:
        raise ValueError(f"invalid context class: {context!r}")
    required = {"basis", "evidence_url", "excerpt"}
    if not required <= set(evidence) or not all(str(evidence[field]).strip() for field in required):
        raise ValueError("context classification requires basis, evidence_url and excerpt")
    if not str(evidence["evidence_url"]).startswith("https://"):
        raise ValueError("context evidence URL must use HTTPS")
    # Classification is declarative and evidence-bound; no geography is guessed from keywords.
    return context


def validate_license(item: dict, policy: dict) -> tuple[bool, list[str]]:
    licence = item.get("license") or {}
    identifier = licence.get("identifier", "")
    errors = []
    for field in ("identifier", "status", "url", "evidence_url", "attribution"):
        if not licence.get(field):
            errors.append(f"license.{field} is required")
    if any(token in identifier.upper() for token in policy["blocked_license_tokens"]):
        errors.append(f"blocked licence: {identifier}")
    recognised = set(policy["commercial_compatible_licenses"]) | set(policy["conditional_licenses"])
    if identifier not in recognised:
        errors.append(f"licence is not allowlisted: {identifier}")
    return not errors, errors


def validate_candidate(item: dict, policy: dict) -> list[str]:
    errors = []
    required = {
        "id", "title", "creator", "publisher", "external_item_id", "source_url", "acquisition_url",
        "source_revision", "provenance", "language", "level", "primary_subject", "secondary_subjects", "coverage_tags",
        "context_class", "context_evidence", "license", "attribution", "expected_content_types",
        "extraction_method", "acquisition_status", "review_status", "staging_status", "approval_status",
        "training_eligible", "rejection_reason", "original_sha256", "extracted_sha256", "metrics",
        "privacy", "quality", "duplicates",
    }
    missing = sorted(required - set(item))
    if missing:
        errors.append("missing fields: " + ", ".join(missing))
        return errors
    if item["training_eligible"] is not False or item["approval_status"] not in {"NOT_APPROVED", "REJECTED"}:
        errors.append("candidate registry may not grant training approval")
    if item["primary_subject"] not in policy["canonical_primary_subjects"]:
        errors.append(f"invalid primary_subject: {item['primary_subject']!r}")
    if not isinstance(item["secondary_subjects"], list) or any(
        value not in policy["canonical_primary_subjects"] for value in item["secondary_subjects"]
    ):
        errors.append("secondary_subjects must use canonical subject labels")
    if item["extraction_method"] not in policy["allowed_extraction_methods"]:
        errors.append(f"invalid extraction method: {item['extraction_method']!r}")
    try:
        validate_url(item["acquisition_url"], policy, exact_url=item["acquisition_url"])
        classify_context(item, policy)
    except ValueError as exc:
        errors.append(str(exc))
    _, licence_errors = validate_license(item, policy)
    errors.extend(licence_errors)
    if not item["expected_content_types"] or any(
        value not in policy["allowed_content_types"] for value in item["expected_content_types"]
    ):
        errors.append("expected_content_types are missing or not allowlisted")
    return errors


def benchmark_hashes(policy: dict) -> dict[str, str]:
    result = {}
    for relative in policy["protected_benchmark_paths"]:
        path = ROOT / relative
        if not path.exists():
            raise ValueError(f"protected benchmark path is missing: {relative}")
        result[relative] = sha256_bytes(path.read_bytes())
    return result


def heldout_shingles() -> set[str]:
    path = ROOT / "data/evaluation/cases-v2.jsonl"
    values = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        text = " ".join(str(value) for value in case.values() if isinstance(value, (str, int, float)))
        words = tokens(text)
        values.update(" ".join(words[index:index + 12]) for index in range(max(0, len(words) - 11)))
    return values


def leakage_scan(text: str, benchmark_values: set[str]) -> dict:
    words = tokens(text)
    candidate = {" ".join(words[index:index + 12]) for index in range(max(0, len(words) - 11))}
    overlap = sorted(candidate & benchmark_values)
    return {
        "method": "exact_normalized_12_word_shingles",
        "shared_shingles": len(overlap),
        "samples": overlap[:5],
        "blocked": bool(overlap),
    }


def approved_deduper(policy: dict) -> NearDuplicateIndex:
    settings = policy["deduplication"]
    index = NearDuplicateIndex(
        threshold=float(settings["near_duplicate_threshold"]),
        min_words=int(settings["minimum_words"]),
    )
    corpus = ROOT / "data/pretraining/corpus.txt"
    if corpus.exists():
        text = corpus.read_text(encoding="utf-8", errors="replace")
        for number, unit in enumerate(paragraph_units(text), 1):
            index.add_or_match(f"approved:{number}", unit)
    return index


def deduplicate_text(item_id: str, text: str, index: NearDuplicateIndex) -> tuple[str, dict]:
    kept = []
    matches = []
    units = paragraph_units(text)
    for number, unit in enumerate(units, 1):
        match = index.add_or_match(f"{item_id}:{number}", unit)
        if match:
            matches.append(match.to_dict())
        else:
            kept.append(unit)
    return "\n\n".join(kept), {
        "input_units": len(units),
        "kept_units": len(kept),
        "removed_exact": sum(row["kind"] == "exact" for row in matches),
        "removed_near": sum(row["kind"] == "near" for row in matches),
        "matches": matches,
    }


def suffix_for(item: dict, content_type: str) -> str:
    explicit = item.get("original_extension")
    if explicit:
        return explicit
    return {
        "application/epub+zip": ".epub",
        "application/json": ".json",
        "application/pdf": ".pdf",
        "text/html": ".html",
        "text/plain": ".txt",
    }.get(content_type, mimetypes.guess_extension(content_type) or ".bin")


def update_review_packet(path: Path, items: list[dict]) -> None:
    existing = {}
    if path.exists():
        with path.open(newline="", encoding="utf-8") as handle:
            existing = {row.get("item_id", ""): row for row in csv.DictReader(handle)}
    rows = []
    for item in sorted(items, key=lambda row: row["id"]):
        if not item.get("original_sha256") or not item.get("extracted_sha256"):
            continue
        row = {
            "item_id": item["id"],
            "original_sha256": item["original_sha256"],
            "extracted_sha256": item["extracted_sha256"],
            "title": item["title"],
            "creator": item["creator"],
            "language": item["language"],
            "primary_subject": item["primary_subject"],
            "context_class": item["context_class"],
            "license": item["license"]["identifier"],
            "source_url": item["source_url"],
            "staging_status": item["staging_status"],
        }
        for field in REVIEW_FIELDS:
            if field not in row:
                row[field] = "PENDING" if field.endswith("_decision") else ""
        prior = existing.get(item["id"], {})
        if (
            prior.get("original_sha256") == row["original_sha256"]
            and prior.get("extracted_sha256") == row["extracted_sha256"]
        ):
            for field in DECISION_FIELDS:
                row[field] = prior.get(field, row[field])
        rows.append(row)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=REVIEW_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def stage_item(item: dict, policy: dict, index: NearDuplicateIndex, benchmark_values: set[str]) -> dict:
    errors = validate_candidate(item, policy)
    if errors:
        item.update({
            "acquisition_status": "NOT_ACQUIRED",
            "staging_status": "REJECTED",
            "approval_status": "REJECTED",
            "review_status": "NOT_REVIEWABLE",
            "training_eligible": False,
            "rejection_reason": "; ".join(errors),
        })
        return {"id": item["id"], "status": "REJECTED", "errors": errors}

    original_root = ROOT / "data/staging/originals/open-candidates"
    extracted_root = ROOT / "data/staging/extracted/open-candidates"
    original_root.mkdir(parents=True, exist_ok=True)
    extracted_root.mkdir(parents=True, exist_ok=True)
    try:
        data, download = bounded_download(item["acquisition_url"], policy, item["expected_content_types"])
        original_path = safe_output_path(original_root, item["id"], suffix_for(item, download["content_type"]))
        original_path.write_bytes(data)
        extracted, extraction = extract_text(data, item)
        quality_before = scan_quality(extracted, policy)
        privacy = scan_privacy(extracted, policy)
        leakage = leakage_scan(extracted, benchmark_values)
        deduplicated, duplicates = deduplicate_text(item["id"], extracted, index)
        quality_after = scan_quality(deduplicated, policy)
        extracted_path = safe_output_path(extracted_root, item["id"], ".txt")
        extracted_path.write_text(deduplicated, encoding="utf-8")
        bpe_tokens, bpe_method = estimate_bpe_tokens(deduplicated)
        item.setdefault("provenance", {}).update({
            "retrieved_at": "2026-09-30",
            "acquisition_method": "bounded_exact_url_download",
            "requested_url": download["requested_url"],
            "final_url": download["final_url"],
            "redirects": download["redirects"],
            "content_type": download["content_type"],
            "source_revision": item["source_revision"],
            "licence_evidence_url": item["license"]["evidence_url"],
        })
        quarantine_reasons = list(quality_before["errors"]) + list(quality_after["errors"])
        if privacy:
            quarantine_reasons.append(f"{len(privacy)} potential personal-data pattern(s)")
        if leakage["blocked"]:
            quarantine_reasons.append("held-out evaluation overlap detected")
        if not deduplicated.strip():
            quarantine_reasons.append("all extracted units are duplicates")
        status = "QUARANTINED" if quarantine_reasons else "STAGED_UNAPPROVED"
        item.update({
            "acquisition_status": "ACQUIRED",
            "staging_status": status,
            "review_status": "PENDING_HUMAN_REVIEW",
            "approval_status": "NOT_APPROVED",
            "training_eligible": False,
            "rejection_reason": "; ".join(quarantine_reasons) if quarantine_reasons else None,
            "original_sha256": sha256_bytes(data),
            "extracted_sha256": sha256_bytes(deduplicated.encode("utf-8")),
            "metrics": {
                "original_bytes": len(data),
                "characters": len(deduplicated),
                "words": len(tokens(deduplicated)),
                "estimated_bpe_tokens": bpe_tokens,
                "bpe_method": bpe_method,
            },
            "privacy": {"status": "WARNING" if privacy else "NO_PATTERN_DETECTED", "warnings": privacy},
            "quality": {"before_deduplication": quality_before, "after_deduplication": quality_after},
            "duplicates": {
                **{key: value for key, value in duplicates.items() if key != "matches"},
                "matches_count": len(duplicates["matches"]),
                "matches_report": "reports/candidate-staging-report.json",
            },
            "leakage": leakage,
            "staging_paths": {
                "original": str(original_path.relative_to(ROOT)),
                "extracted": str(extracted_path.relative_to(ROOT)),
            },
        })
        return {
            "id": item["id"],
            "status": status,
            "download": download,
            "extraction": {"method": item["extraction_method"], **extraction},
            "hashes": {"original_sha256": item["original_sha256"], "extracted_sha256": item["extracted_sha256"]},
            "metrics": item["metrics"],
            "quality": item["quality"],
            "privacy": item["privacy"],
            "duplicates": duplicates,
            "leakage": leakage,
            "quarantine_reasons": quarantine_reasons,
        }
    except Exception as exc:
        item.update({
            "acquisition_status": "ACQUISITION_FAILED",
            "staging_status": "QUARANTINED",
            "review_status": "NOT_REVIEWABLE",
            "approval_status": "NOT_APPROVED",
            "training_eligible": False,
            "rejection_reason": f"acquisition or extraction failed: {exc}",
        })
        return {"id": item["id"], "status": "QUARANTINED", "errors": [str(exc)]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", default="data/source-candidates.json")
    parser.add_argument("--policy", default="data/candidate-intake-policy.json")
    parser.add_argument("--report", default="reports/candidate-staging-report.json")
    parser.add_argument("--review-packet", default="data/reviews/candidate-intake-review.csv")
    parser.add_argument("--candidate", action="append", default=[])
    parser.add_argument("--no-update-registry", action="store_true")
    args = parser.parse_args()

    registry_path = ROOT / args.registry
    policy = load_json(ROOT / args.policy)
    registry = load_json(registry_path)
    protected_before = benchmark_hashes(policy)
    benchmark_values = heldout_shingles()
    index = approved_deduper(policy)
    selected = set(args.candidate)
    results = []
    seen = set()
    for item in registry.get("items", []):
        if item["id"] in seen:
            raise SystemExit(f"duplicate item id: {item['id']}")
        seen.add(item["id"])
        if selected and item["id"] not in selected:
            continue
        if item.get("managed_by") == "stage_storybooks_nigeria.py":
            continue
        results.append(stage_item(item, policy, index, benchmark_values))
    missing = selected - {row["id"] for row in registry.get("items", [])}
    if missing:
        raise SystemExit("unknown candidate id(s): " + ", ".join(sorted(missing)))

    protected_after = benchmark_hashes(policy)
    if protected_after != protected_before:
        raise SystemExit("protected benchmark files changed during staging")
    if not args.no_update_registry:
        registry["checked_at"] = "2026-09-30"
        registry_path.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    update_review_packet(ROOT / args.review_packet, registry.get("items", []))
    duplicate_details = []
    for row in results:
        duplicates = row.get("duplicates") or {}
        matches = duplicates.pop("matches", [])
        if matches:
            duplicate_details.append({"id": row["id"], "matches": matches})
        duplicates["matches_count"] = len(matches)
        duplicates["match_samples"] = matches[:10]
        duplicates["full_matches_path"] = "data/staging/reports/open-candidate-duplicate-matches.json"
    duplicate_details_path = ROOT / "data/staging/reports/open-candidate-duplicate-matches.json"
    duplicate_details_path.parent.mkdir(parents=True, exist_ok=True)
    duplicate_details_path.write_text(
        json.dumps({"items": duplicate_details}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    status_counts = Counter(row["status"] for row in results)
    report = {
        "version": 1,
        "status": "STAGING_ONLY_NO_TRAINING_APPROVAL",
        "policy": args.policy,
        "registry": args.registry,
        "items_attempted": len(results),
        "status_counts": dict(sorted(status_counts.items())),
        "protected_benchmark_hashes_before": protected_before,
        "protected_benchmark_hashes_after": protected_after,
        "benchmark_files_unchanged": protected_before == protected_after,
        "review_packet": args.review_packet,
        "duplicate_details": {
            "path": str(duplicate_details_path.relative_to(ROOT)),
            "sha256": sha256_bytes(duplicate_details_path.read_bytes()),
            "items_with_matches": len(duplicate_details),
        },
        "training_approved_items": 0,
        "results": results,
    }
    report_path = ROOT / args.report
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
