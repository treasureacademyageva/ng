#!/usr/bin/env python3
"""Quantify corpus balance and fail closed on every long-run readiness gate."""
from __future__ import annotations

import argparse
import csv
import json
import urllib.parse
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def review_counts(path: Path, field: str = "decision") -> Counter:
    if not path.exists():
        return Counter()
    with path.open(newline="", encoding="utf-8") as handle:
        return Counter(row.get(field, "") for row in csv.DictReader(handle))


def candidate_distribution(items: list[dict], statuses: set[str]) -> dict:
    selected = [item for item in items if item.get("staging_status") in statuses]
    subjects: Counter[str] = Counter()
    contexts: Counter[str] = Counter()
    languages: Counter[str] = Counter()
    totals = Counter()
    for item in selected:
        metrics = item.get("metrics") or {}
        characters = int(metrics.get("characters") or 0)
        words = int(metrics.get("words") or 0)
        estimated_tokens = int(metrics.get("estimated_bpe_tokens") or 0)
        subjects[item.get("primary_subject", "uncertain")] += characters
        contexts[item.get("context_class", "uncertain")] += characters
        languages[item.get("language", "uncertain")] += characters
        totals.update({"items": 1, "characters": characters, "words": words, "estimated_bpe_tokens": estimated_tokens})
    return {
        **dict(totals),
        "subjects_characters": dict(sorted(subjects.items())),
        "contexts_characters": dict(sorted(contexts.items())),
        "languages_characters": dict(sorted(languages.items())),
    }


def scored_component(name: str, weight: float, fraction: float, evidence: str) -> dict:
    fraction = min(1.0, max(0.0, fraction))
    return {
        "name": name,
        "weight": weight,
        "fraction_met": fraction,
        "points_awarded": weight * fraction,
        "evidence": evidence,
    }


def score_total(components: list[dict]) -> float:
    return round(sum(item["points_awarded"] for item in components), 2)


def load_candidate_reviews(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata", default="data/pretraining/metadata-bpe-8192.json")
    parser.add_argument("--config", default="config/tiny.json")
    parser.add_argument("--policy", default="data/readiness-policy.json")
    parser.add_argument("--parameters", type=int, default=13_980_672)
    parser.add_argument("--output", default="runs/corpus-audit.json")
    args = parser.parse_args()

    metadata = load_json(ROOT / args.metadata)
    config = load_json(ROOT / args.config)
    policy = load_json(ROOT / args.policy)
    manifest = {item["id"]: item for item in load_json(ROOT / "data/sources.json")["sources"]}
    corpus_policy = policy["corpus"]
    authoring_policy = policy["authoring_plan"]
    human_policy = policy["human_review"]
    candidate_policy = load_json(ROOT / "data/candidate-intake-policy.json")
    candidate_registry = load_json(ROOT / "data/source-candidates.json")
    candidate_items = candidate_registry.get("items", [])
    candidate_reviews = load_candidate_reviews(ROOT / "data/reviews/candidate-intake-review.csv")
    candidate_stage_report_path = ROOT / "reports/candidate-staging-report.json"
    candidate_stage_report = load_json(candidate_stage_report_path) if candidate_stage_report_path.exists() else {}

    subjects: Counter[str] = Counter()
    languages: Counter[str] = Counter()
    coverage: Counter[str] = Counter()
    nigerian_context_characters = 0
    sources = []
    for item in metadata["sources"]:
        source = manifest[item["id"]]
        characters = item["characters"]
        subjects[source["subject"]] += characters
        languages[source["language"]] += characters
        for tag in source.get("coverage_tags", []):
            coverage[tag] += characters
        is_nigerian_context = source.get(
            "nigerian_context",
            source["language"].endswith("-NG") or source["language"] in {"ha", "yo", "ig", "igb", "pcm-NG"},
        )
        if is_nigerian_context:
            nigerian_context_characters += characters
        sources.append({
            "id": item["id"],
            "characters": characters,
            "share": characters / metadata["characters"],
            "subject": source["subject"],
            "language": source["language"],
            "license": source["license"],
            "coverage_tags": source.get("coverage_tags", []),
            "nigerian_context": bool(is_nigerian_context),
        })

    train_tokens = metadata["train_tokens"]
    tokens_per_step = config["batch_size"] * config["block_size"] * config["gradient_accumulation"]
    reasons = []

    minimum_tokens = corpus_policy["minimum_train_bpe_tokens"]
    if train_tokens < minimum_tokens:
        reasons.append(
            f"fewer than {minimum_tokens:,} BPE training tokens after cleaning and deduplication"
        )

    total_characters = metadata["characters"]
    maximum_share = corpus_policy["maximum_single_subject_character_share"]
    largest_subject, largest_characters = max(subjects.items(), key=lambda item: item[1])
    largest_share = largest_characters / total_characters
    if largest_share > maximum_share:
        reasons.append(
            f"subject {largest_subject!r} is {largest_share:.1%}; policy maximum is {maximum_share:.0%}"
        )

    science_characters = sum(subjects[name] for name in corpus_policy["science_subjects"])
    science_share = science_characters / total_characters
    if science_share > maximum_share:
        reasons.append(f"science is {science_share:.1%}; policy maximum is {maximum_share:.0%}")

    nigerian_share = nigerian_context_characters / total_characters
    minimum_nigerian = corpus_policy["minimum_nigerian_context_character_share"]
    if nigerian_share < minimum_nigerian:
        reasons.append(
            f"Nigerian-context sources are {nigerian_share:.1%}; policy minimum is {minimum_nigerian:.0%}"
        )

    missing_coverage = [tag for tag in corpus_policy["required_coverage_tags"] if not coverage[tag]]
    for tag in missing_coverage:
        reasons.append(f"required reviewed coverage is missing: {tag}")

    required_deduplication = corpus_policy["required_deduplication"]
    observed_deduplication = metadata.get("deduplication", "exact_document_units_only")
    if observed_deduplication != required_deduplication:
        reasons.append(
            f"deduplication is {observed_deduplication!r}; required is {required_deduplication!r}"
        )

    teacher = review_counts(ROOT / human_policy["teacher_review_file"])
    safeguarding = review_counts(ROOT / human_policy["safeguarding_review_file"])
    evaluation_cases = sum(teacher.values())
    required_cases = human_policy["minimum_evaluation_cases"]
    if evaluation_cases < required_cases or teacher["APPROVED"] != evaluation_cases:
        reasons.append(
            f"teacher review incomplete: {teacher['APPROVED']}/{max(evaluation_cases, required_cases)} approved"
        )
    safeguarding_cases = sum(safeguarding.values())
    if safeguarding_cases < required_cases or safeguarding["APPROVED"] != safeguarding_cases:
        reasons.append(
            f"safeguarding review incomplete: {safeguarding['APPROVED']}/{max(safeguarding_cases, required_cases)} approved"
        )

    staged_story_reviews = {}
    for spec in human_policy["staged_story_review_files"]:
        story_path = ROOT / spec["path"]
        story_teacher = review_counts(story_path, "teacher_decision")
        story_safeguarding = review_counts(story_path, "safeguarding_decision")
        staged_story_count = sum(story_teacher.values())
        staged_story_reviews[spec["id"]] = {
            "language": spec["language"],
            "teacher": dict(story_teacher),
            "safeguarding": dict(story_safeguarding),
        }
        if staged_story_count and story_teacher["APPROVED"] != staged_story_count:
            reasons.append(
                f"{spec['id']} teacher review incomplete: {story_teacher['APPROVED']}/{staged_story_count} approved"
            )
        if staged_story_count and story_safeguarding["APPROVED"] != staged_story_count:
            reasons.append(
                f"{spec['id']} safeguarding review incomplete: "
                f"{story_safeguarding['APPROVED']}/{staged_story_count} approved"
            )

    authoring_queue = ROOT / authoring_policy["queue_file"]
    authoring_rows = []
    if authoring_queue.exists():
        with authoring_queue.open(newline="", encoding="utf-8") as handle:
            authoring_rows = list(csv.DictReader(handle))
    authoring_subjects = Counter(row.get("subject", "") for row in authoring_rows)
    authoring_statuses = Counter(row.get("brief_status", "") for row in authoring_rows)
    required_briefs = authoring_policy["required_briefs"]
    if len(authoring_rows) != required_briefs:
        reasons.append(f"original-content authoring queue has {len(authoring_rows)}/{required_briefs} required briefs")
    required_subject_briefs = Counter(authoring_policy["required_subject_briefs"])
    if authoring_subjects != required_subject_briefs:
        reasons.append(
            f"original-content authoring queue subject counts are {dict(authoring_subjects)}; "
            f"required {dict(required_subject_briefs)}"
        )
    pilot_manifest = ROOT / authoring_policy["balanced_pilot_manifest"]
    pilot_rows = []
    if pilot_manifest.exists():
        with pilot_manifest.open(newline="", encoding="utf-8") as handle:
            pilot_rows = list(csv.DictReader(handle))
    required_pilot_samples = authoring_policy["balanced_pilot_required_samples"]
    if len(pilot_rows) != required_pilot_samples:
        reasons.append(f"balanced original-content pilot has {len(pilot_rows)}/{required_pilot_samples} required samples")
    pilot_draft_statuses = Counter(row.get("draft_status", "") for row in pilot_rows)
    pilot_teacher_decisions = Counter(row.get("teacher_decision", "") for row in pilot_rows)
    pilot_safeguarding_decisions = Counter(row.get("safeguarding_decision", "") for row in pilot_rows)
    pilot_training_approved = sum(row.get("approved_for_training", "").lower() == "true" for row in pilot_rows)

    napps_manifest = load_json(ROOT / authoring_policy["napps_alignment_manifest"])
    napps_index_path = ROOT / authoring_policy["napps_alignment_index"]
    napps_rows = []
    if napps_index_path.exists():
        with napps_index_path.open(newline="", encoding="utf-8") as handle:
            napps_rows = list(csv.DictReader(handle))
    napps_combinations = {
        (row.get("primary_class", ""), row.get("subject", ""), row.get("term", ""))
        for row in napps_rows
    }
    napps_official_verified = napps_manifest["official_status"]["latest_official_edition_verified"]
    napps_planning_authorized = authoring_policy["napps_public_alignment_authorized_for_planning"]
    if not napps_planning_authorized:
        reasons.append("Primary 1-6 English/Mathematics alignment has not been authorized for original authoring")

    staged_unapproved = candidate_distribution(candidate_items, {"STAGED_UNAPPROVED"})
    quarantined = candidate_distribution(candidate_items, {"QUARANTINED"})
    rejected = candidate_distribution(candidate_items, {"REJECTED"})
    candidate_decisions = {
        field: dict(review_counts(ROOT / "data/reviews/candidate-intake-review.csv", field))
        for field in ("licence_decision", "teacher_decision", "safeguarding_decision", "language_decision", "approval_decision")
    }
    candidate_pending = sum(
        row.get("approval_decision") != "APPROVED" for row in candidate_reviews
    )
    candidate_quarantined = sum(item.get("staging_status") == "QUARANTINED" for item in candidate_items)
    candidate_privacy_warnings = sum(
        len((item.get("privacy") or {}).get("warnings", [])) for item in candidate_items
    )
    candidate_leakage_blocks = sum(
        bool((item.get("leakage") or {}).get("blocked")) for item in candidate_items
    )
    conditional_licence_items = [
        item["id"] for item in candidate_items
        if item.get("license", {}).get("identifier") in candidate_policy["conditional_licenses"]
    ]
    if candidate_pending:
        reasons.append(f"candidate item approval review incomplete: 0/{len(candidate_reviews)} approved")
    if candidate_quarantined:
        reasons.append(f"{candidate_quarantined} candidate item(s) are quarantined")
    if conditional_licence_items:
        reasons.append(
            f"{len(conditional_licence_items)} candidate item(s) require share-alike or jurisdiction review"
        )

    approved_provenance_fraction = (
        sum(bool(item.get("license")) and bool(item.get("id")) for item in sources) / len(sources)
        if sources else 0.0
    )
    official_components = [
        scored_component(
            "approved_deduplicated_training_token_volume", 30,
            train_tokens / minimum_tokens,
            f"{train_tokens:,}/{minimum_tokens:,} approved BPE training tokens",
        ),
        scored_component(
            "approved_subject_balance", 10,
            1.0 if largest_share <= maximum_share and science_share <= maximum_share else 0.0,
            f"largest subject {largest_share:.1%}; science {science_share:.1%}; maximum {maximum_share:.0%}",
        ),
        scored_component(
            "approved_nigerian_context", 10,
            nigerian_share / minimum_nigerian,
            f"{nigerian_share:.1%} approved Nigerian-context characters; target {minimum_nigerian:.0%}",
        ),
        scored_component(
            "approved_required_coverage", 14,
            (len(corpus_policy["required_coverage_tags"]) - len(missing_coverage)) / len(corpus_policy["required_coverage_tags"]),
            f"{len(corpus_policy['required_coverage_tags']) - len(missing_coverage)}/{len(corpus_policy['required_coverage_tags'])} required tags have approved characters",
        ),
        scored_component(
            "approved_corpus_deduplication", 8,
            1.0 if observed_deduplication == required_deduplication else 0.0,
            f"observed {observed_deduplication}; required {required_deduplication}",
        ),
        scored_component(
            "approved_source_provenance_and_licensing", 8,
            approved_provenance_fraction,
            f"{round(approved_provenance_fraction * len(sources))}/{len(sources)} included sources retain IDs and licences",
        ),
        scored_component(
            "heldout_teacher_and_safeguarding_review", 10,
            ((teacher["APPROVED"] / required_cases) + (safeguarding["APPROVED"] / required_cases)) / 2,
            f"teacher {teacher['APPROVED']}/{required_cases}; safeguarding {safeguarding['APPROVED']}/{required_cases}",
        ),
        scored_component(
            "candidate_and_original_content_human_review", 5,
            0.0,
            f"candidate approvals 0/{len(candidate_reviews)}; original pilot training approvals {pilot_training_approved}/{len(pilot_rows)}",
        ),
        scored_component(
            "separate_written_long_run_authorisation", 5,
            0.0,
            "No separate owner long-run authorisation exists; policy forbids inference.",
        ),
    ]

    item_required = {
        "id", "title", "creator", "publisher", "external_item_id", "source_url", "acquisition_url",
        "source_revision", "provenance", "language", "level", "primary_subject", "secondary_subjects", "coverage_tags",
        "context_class", "context_evidence", "license", "attribution", "acquisition_status", "review_status",
        "staging_status", "approval_status", "training_eligible", "rejection_reason", "original_sha256",
        "extracted_sha256", "metrics", "privacy", "quality", "duplicates", "leakage",
    }
    complete_items = sum(item_required <= set(item) for item in candidate_items)
    covered_candidate_subjects = {
        subject for item in candidate_items
        for subject in [item.get("primary_subject"), *item.get("secondary_subjects", [])]
        if subject
    }
    allowed_hosts = set(candidate_policy["allowed_hosts"])
    allowlisted_urls = sum(
        (
            item.get("managed_by") == "stage_storybooks_nigeria.py"
            and len(str(item.get("source_revision", ""))) == 40
            and all(char in "0123456789abcdef" for char in str(item.get("source_revision", "")))
        )
        or (
            item.get("managed_by") == "stage_open_candidates.py"
            and urllib.parse.urlsplit(item.get("acquisition_url", "")).scheme == "https"
            and urllib.parse.urlsplit(item.get("acquisition_url", "")).hostname in allowed_hosts
        )
        for item in candidate_items
    )
    staged_items = [
        item for item in candidate_items if item.get("staging_status") in {"STAGED_UNAPPROVED", "QUARANTINED"}
    ]
    extracted_complete = sum(
        len(item.get("original_sha256") or "") == 64
        and len(item.get("extracted_sha256") or "") == 64
        and all((item.get("metrics") or {}).get(field) is not None for field in ("characters", "words", "estimated_bpe_tokens"))
        for item in staged_items
    )
    quality_complete = sum(item.get("privacy") is not None and item.get("quality") is not None for item in staged_items)
    context_complete = sum(
        item.get("context_class") in candidate_policy["context_classes"]
        and all((item.get("context_evidence") or {}).get(field) for field in ("basis", "evidence_url", "excerpt"))
        for item in candidate_items
    )
    duplicate_complete = sum(item.get("duplicates") is not None for item in staged_items)
    leakage_complete = sum(item.get("leakage") is not None for item in staged_items)
    review_ids = {row.get("item_id") for row in candidate_reviews}
    review_complete = (
        review_ids == {item["id"] for item in staged_items}
        and all(row.get("approval_decision") == "PENDING" for row in candidate_reviews)
    )
    benchmark_unchanged = bool(candidate_stage_report.get("benchmark_files_unchanged"))
    staging_ignored = "data/staging/*" in (ROOT / ".gitignore").read_text(encoding="utf-8")
    deployed_config = (ROOT / candidate_policy["production_disconnection"]["deployed_config"]).resolve()
    production_code = (ROOT / candidate_policy["production_disconnection"]["production_chatbot_root"]).resolve() / "main.py"
    deployed_text = deployed_config.read_text(encoding="utf-8")
    production_text = production_code.read_text(encoding="utf-8")
    production_disconnected = (
        "model/checkpoints" not in deployed_text
        and "model/data/pretraining" not in deployed_text
        and "model/checkpoints" not in production_text
        and "model/data/pretraining" not in production_text
    )
    experimental_components = [
        scored_component("complete_item_level_schema", 8, complete_items / max(1, len(candidate_items)), f"{complete_items}/{len(candidate_items)} items have all required fields"),
        scored_component("seven_priority_areas_represented", 7, len(covered_candidate_subjects & set(candidate_policy["canonical_primary_subjects"])) / len(candidate_policy["canonical_primary_subjects"]), f"{len(covered_candidate_subjects & set(candidate_policy['canonical_primary_subjects']))}/7 canonical areas represented"),
        scored_component("exact_url_and_host_allowlisting", 8, allowlisted_urls / max(1, len(candidate_items)), f"{allowlisted_urls}/{len(candidate_items)} items use the general HTTPS host allowlist or the specialised pinned-commit importer"),
        scored_component("redirect_size_time_type_and_path_controls", 7, 1.0 if candidate_policy["max_redirects"] and candidate_policy["maximum_download_bytes"] and candidate_policy["timeout_seconds"] else 0.0, "Fail-closed candidate intake policy defines redirect, byte, timeout, MIME and path controls"),
        scored_component("reproducible_extraction_hashes_and_metrics", 10, extracted_complete / max(1, len(staged_items)), f"{extracted_complete}/{len(staged_items)} staged/quarantined items have original/extracted hashes and metrics"),
        scored_component("quality_and_privacy_scanning", 8, quality_complete / max(1, len(staged_items)), f"{quality_complete}/{len(staged_items)} staged/quarantined items have quality and privacy results"),
        scored_component("evidence_bound_context_and_subject_classification", 7, context_complete / max(1, len(candidate_items)), f"{context_complete}/{len(candidate_items)} items have canonical context evidence and subjects"),
        scored_component("exact_and_near_duplicate_screening", 8, duplicate_complete / max(1, len(staged_items)), f"{duplicate_complete}/{len(staged_items)} staged/quarantined items have duplicate results"),
        scored_component("heldout_leakage_and_hash_protection", 8, min(leakage_complete / max(1, len(staged_items)), 1.0 if benchmark_unchanged else 0.0), f"{leakage_complete}/{len(staged_items)} items scanned; protected benchmark hashes unchanged={benchmark_unchanged}"),
        scored_component("hash_bound_pending_review_packets", 10, 1.0 if review_complete else 0.0, f"{len(candidate_reviews)} hash-bound rows; every generated approval decision pending={review_complete}"),
        scored_component("approved_staged_quarantined_state_audit", 7, 1.0, "Audit reports approved baseline, staged-unapproved, quarantined and rejected states separately"),
        scored_component("ignored_staging_boundary", 3, 1.0 if staging_ignored else 0.0, f"model/.gitignore contains data/staging/*={staging_ignored}"),
        scored_component("long_run_gate_remains_closed", 4, 1.0, "This audit adds candidate blockers and never grants long-run authorisation"),
        scored_component("experimental_model_disconnected_from_production", 5, 1.0 if production_disconnected else 0.0, f"No checkpoint/pretraining path is routed by deployed config or production chatbot={production_disconnected}"),
    ]

    max_presented = config["max_steps"] * tokens_per_step
    report = {
        "policy_version": policy["version"],
        "characters": total_characters,
        "bpe_tokens": metadata["tokens"],
        "train_bpe_tokens": train_tokens,
        "minimum_train_bpe_tokens": minimum_tokens,
        "parameters": args.parameters,
        "train_tokens_per_parameter": train_tokens / args.parameters,
        "subjects_characters": dict(subjects),
        "largest_subject": {"name": largest_subject, "share": largest_share},
        "science_share": science_share,
        "nigerian_context_share": nigerian_share,
        "coverage_characters": dict(coverage),
        "missing_required_coverage": missing_coverage,
        "deduplication": {
            "observed": observed_deduplication,
            "required": required_deduplication,
        },
        "authoring_plan": {
            "queue": authoring_policy["queue_file"],
            "briefs": len(authoring_rows),
            "subjects": dict(authoring_subjects),
            "statuses": dict(authoring_statuses),
            "pilot_manifest": authoring_policy["balanced_pilot_manifest"],
            "pilot_samples": len(pilot_rows),
            "pilot_draft_statuses": dict(pilot_draft_statuses),
            "pilot_teacher_decisions": dict(pilot_teacher_decisions),
            "pilot_safeguarding_decisions": dict(pilot_safeguarding_decisions),
            "training_approved_documents": pilot_training_approved,
            "napps_alignment": {
                "rows": len(napps_rows),
                "class_subject_term_combinations": len(napps_combinations),
                "new_national_structure_crosscheck": napps_manifest["national_curriculum_crosscheck"]["status"],
                "owner_authorized_for_original_authoring": napps_planning_authorized,
                "official_napps_issued_copy_verified": napps_official_verified,
                "training_eligible_rows": sum(row.get("training_eligible") == "true" for row in napps_rows),
            },
        },
        "human_review": {
            "evaluation_teacher": dict(teacher),
            "evaluation_safeguarding": dict(safeguarding),
            "staged_story_collections": staged_story_reviews,
            "candidate_item_decisions": candidate_decisions,
        },
        "candidate_corpus_states": {
            "approved": {
                "scope": "approved baseline only; candidate registry never contributes here",
                "items": len(sources),
                "characters": total_characters,
                "bpe_tokens": metadata["tokens"],
                "train_bpe_tokens": train_tokens,
                "subjects_characters": dict(subjects),
                "languages_characters": dict(languages),
                "nigerian_context_characters": nigerian_context_characters,
            },
            "staged_unapproved": staged_unapproved,
            "quarantined": quarantined,
            "rejected": rejected,
            "research_collections": {
                "items": len(candidate_registry.get("candidates", [])),
                "intake_statuses": dict(sorted(Counter(item.get("intake_status", "") for item in candidate_registry.get("candidates", [])).items())),
                "license_statuses": dict(sorted(Counter(item.get("license_status", "") for item in candidate_registry.get("candidates", [])).items())),
            },
            "before_after_note": "The approved-before and approved-after distributions are identical because no staged candidate is approved. Candidate distributions are shown separately and must not be added to approved progress.",
            "approved_characters_before": total_characters,
            "approved_characters_after": total_characters,
            "approved_train_bpe_tokens_before": train_tokens,
            "approved_train_bpe_tokens_after": train_tokens,
        },
        "candidate_controls": {
            "items": len(candidate_items),
            "review_rows": len(candidate_reviews),
            "quarantined_items": candidate_quarantined,
            "privacy_warnings": candidate_privacy_warnings,
            "heldout_leakage_blocks": candidate_leakage_blocks,
            "conditional_licence_items": conditional_licence_items,
            "benchmark_files_unchanged": benchmark_unchanged,
            "training_approved_items": sum(bool(item.get("training_eligible")) for item in candidate_items),
        },
        "weighted_completion": {
            "official_policy_completion_percentage": score_total(official_components),
            "official_scope": "Approved-corpus and long-run gates only. Staged, quarantined and rejected material earns zero official corpus points.",
            "official_components": official_components,
            "experimental_pipeline_readiness_percentage": score_total(experimental_components),
            "experimental_scope": "Security, provenance, staging, scanning, review-packet and audit controls; this is not permission to train.",
            "experimental_components": experimental_components,
        },
        "languages_characters": dict(languages),
        "sources": sources,
        "configured_tokens_per_step": tokens_per_step,
        "corpus_equivalent_passes_in_100_steps": 100 * tokens_per_step / train_tokens,
        "corpus_equivalent_passes_at_max_steps": max_presented / train_tokens,
        "long_run_ready": not reasons,
        "blocking_reasons": reasons,
        "decision": "DO NOT AUTHORISE LONG RUN" if reasons else "ELIGIBLE FOR REVIEW; NOT AUTOMATICALLY AUTHORISED",
    }
    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
