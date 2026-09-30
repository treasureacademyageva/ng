#!/usr/bin/env python3
"""Build the owner/teacher authoring queue for original Nigerian primary content."""
from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data/authoring/primary-math-english-briefs.csv"
FIELDS = [
    "brief_id", "brief_sha256", "subject", "coverage_tag", "primary_class", "topic",
    "required_formats", "pilot_documents", "full_target_documents", "target_words_per_document",
    "nigerian_context_requirement", "brief_status", "assigned_author", "notes",
]
PRESERVED = {"brief_status", "assigned_author", "notes"}

MATHS = {
    1: [
        "Counting, reading and writing whole numbers to 100",
        "Ordering numbers and understanding tens and ones",
        "Addition and subtraction within 20",
        "Halves and quarters using familiar objects",
        "Recognising Nigerian coins and naira notes",
        "Comparing length, mass and capacity",
        "Days, months and telling time to the hour",
        "Flat shapes, solid shapes, patterns and simple data",
    ],
    2: [
        "Whole numbers to 1,000 and place value",
        "Skip counting and number patterns",
        "Addition and subtraction of two- and three-digit numbers",
        "Multiplication as equal groups and division as sharing",
        "Halves, thirds and quarters",
        "Naira amounts, totals and simple change",
        "Length, mass, capacity, time and calendars",
        "Shapes, symmetry, tables and picture graphs",
    ],
    3: [
        "Whole numbers to 10,000 and expanded form",
        "Addition, subtraction and estimation",
        "Multiplication tables and related division facts",
        "Fractions and introductory decimal notation",
        "Naira word problems and responsible spending",
        "Metric measurement, perimeter and time",
        "Lines, angles and properties of common shapes",
        "Tables, bar charts and multi-step word problems",
    ],
    4: [
        "Large whole numbers and place value",
        "Multi-digit addition, subtraction and multiplication",
        "Factors, multiples and introductory long division",
        "Equivalent fractions and fraction operations",
        "Decimals, naira and estimation in daily transactions",
        "Angles, symmetry and properties of polygons",
        "Area, perimeter, metric units and elapsed time",
        "Data collection, tables, charts and interpretation",
    ],
    5: [
        "Whole-number operations, estimation and checking answers",
        "Addition, subtraction and multiplication of fractions",
        "Decimals and introductory percentages",
        "Ratios and simple rates in familiar situations",
        "Budgeting, savings and calculations with naira",
        "Area, volume, mass, capacity and unit conversion",
        "Triangles, quadrilaterals, angles and coordinates",
        "Mean, tables, graphs and data-based reasoning",
    ],
    6: [
        "Large numbers, operations and order of operations",
        "Fractions, decimals and percentages",
        "Ratio, proportion and scale in practical problems",
        "Profit, loss, discount, savings and simple financial arithmetic",
        "Number patterns, open sentences and introductory algebra",
        "Geometry, coordinates, angles and constructions",
        "Area, volume, distance, speed and unit conversion",
        "Statistics, averages, probability and interpreting graphs",
    ],
}

ENGLISH = {
    1: [
        "Letter names and common letter sounds",
        "Blending and segmenting simple words",
        "High-frequency words and classroom vocabulary",
        "Capital letters, full stops and complete sentences",
        "Listening, speaking and following short instructions",
        "Reading very short age-appropriate passages",
        "Handwriting, spelling and word families",
        "Oral and picture-guided composition",
    ],
    2: [
        "Consonant blends, digraphs and vowel patterns",
        "Vocabulary for home, school and community",
        "Subjects, predicates and sentence building",
        "Capitalisation, commas, question marks and full stops",
        "Reading comprehension and sequencing events",
        "Using context to understand unfamiliar words",
        "Writing a connected group of sentences",
        "Greetings, invitations and short functional messages",
    ],
    3: [
        "Syllables, spelling patterns and dictionary order",
        "Nouns, pronouns, verbs, adjectives and adverbs",
        "Present, past and future tense in clear sentences",
        "Topic sentences and coherent paragraphs",
        "Reading for main idea, detail and simple inference",
        "Vocabulary meaning, synonyms and antonyms",
        "Narrative and descriptive composition",
        "Personal letters and short informational writing",
    ],
    4: [
        "Spelling, prefixes, suffixes and word formation",
        "Nouns, pronouns, adjectives and agreement",
        "Verb forms, tense consistency and subject-verb concord",
        "Sentence types, conjunctions and punctuation",
        "Reading for main idea, evidence and inference",
        "Note making and introductory summary writing",
        "Narrative, descriptive and explanatory composition",
        "Personal and formal letter formats",
    ],
    5: [
        "Vocabulary development and words in context",
        "Phrases, clauses and parts of speech",
        "Tense, concord and clear sentence construction",
        "Direct speech, reported speech and punctuation",
        "Comprehension using evidence from a passage",
        "Summary writing and selecting key information",
        "Narrative, descriptive and argumentative composition",
        "Letters, notices, instructions and short reports",
    ],
    6: [
        "Vocabulary, figurative language and standard Nigerian English",
        "Phrases, clauses and sentence structure",
        "Tense, concord, active voice and passive voice",
        "Direct and reported speech with accurate punctuation",
        "Critical comprehension, inference and author purpose",
        "Note making, précis and concise summary",
        "Narrative, descriptive, explanatory and persuasive composition",
        "Formal letters, reports, speeches and practical communication",
    ],
}


def digest(row: dict) -> str:
    payload = json.dumps(row, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def existing_rows() -> dict[str, dict[str, str]]:
    if not OUTPUT.exists():
        return {}
    with OUTPUT.open(newline="", encoding="utf-8") as handle:
        return {row["brief_id"]: row for row in csv.DictReader(handle)}


def build_rows() -> list[dict[str, str | int]]:
    rows = []
    subjects = [
        ("mathematics", "nigerian_primary_mathematics", MATHS, "lesson | worked example | guided practice | independent problem", 250),
        ("english", "nigerian_english_reading_composition", ENGLISH, "lesson | model text | guided practice | independent writing", 350),
    ]
    for subject, coverage, matrix, formats, words in subjects:
        for primary_class, topics in matrix.items():
            for number, topic in enumerate(topics, 1):
                basis = {
                    "subject": subject,
                    "coverage_tag": coverage,
                    "primary_class": primary_class,
                    "topic": topic,
                    "required_formats": formats,
                    "pilot_documents": 3,
                    "full_target_documents": 40,
                    "target_words_per_document": words,
                    "nigerian_context_requirement": "Use varied, ordinary Nigerian home, school and community settings; no pupil records, live school facts, stereotypes or invented official claims.",
                }
                row = {
                    "brief_id": f"{subject}-p{primary_class}-{number:02d}",
                    "brief_sha256": digest(basis),
                    **basis,
                    "brief_status": "ASSIGNED",
                    "assigned_author": "Treasure Academy Ageva",
                    "notes": "Use the owner-authorized public NAPPS-aligned index, cross-checked to the 2025 national structure. Write original text only; the source pages are not training data and human review remains required.",
                }
                rows.append(row)
    return rows


def main() -> None:
    previous = existing_rows()
    rows = build_rows()
    for row in rows:
        old = previous.get(str(row["brief_id"]), {})
        if old.get("brief_sha256") == row["brief_sha256"]:
            for field in PRESERVED:
                row[field] = old.get(field, row[field])
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    pilot = sum(int(row["pilot_documents"]) for row in rows)
    full = sum(int(row["full_target_documents"]) for row in rows)
    target_words = sum(int(row["full_target_documents"]) * int(row["target_words_per_document"]) for row in rows)
    print(json.dumps({"briefs": len(rows), "pilot_documents": pilot, "full_target_documents": full, "approximate_full_target_words": target_words}, indent=2))


if __name__ == "__main__":
    main()
