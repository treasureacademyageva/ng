#!/usr/bin/env python3
"""Quantify corpus balance and fail closed on every long-run readiness gate."""
from __future__ import annotations

import argparse
import csv
import json
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
            "training_approved_documents": 0,
        },
        "human_review": {
            "evaluation_teacher": dict(teacher),
            "evaluation_safeguarding": dict(safeguarding),
            "staged_story_collections": staged_story_reviews,
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
