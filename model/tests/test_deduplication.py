import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("deduplication", ROOT / "scripts/deduplication.py")
DEDUP = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = DEDUP
SPEC.loader.exec_module(DEDUP)
sys.path.insert(0, str(ROOT / "scripts"))
from prepare_data import strip_gutenberg


def test_gutenberg_stripping_recomputes_end_after_removing_header():
    raw = "header\n*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\nLesson text.\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***\nlicence footer"
    assert strip_gutenberg(raw).strip() == "Lesson text."


def test_exact_duplicate_ignores_case_spacing_and_punctuation():
    index = DEDUP.NearDuplicateIndex()
    assert index.add_or_match("first", "The pupil counts ten red counters.") is None
    match = index.add_or_match("second", "  THE pupil counts ten red counters! ")
    assert match and match.kind == "exact" and match.kept_id == "first"


def test_near_duplicate_detects_small_edits_in_long_units():
    base = " ".join(
        "Amina counts mangoes at the market and writes each number carefully in her exercise book".split() * 6
    )
    edited = base.replace("mangoes", "oranges", 2).replace("carefully", "neatly", 1)
    index = DEDUP.NearDuplicateIndex(threshold=0.80, min_words=30)
    assert index.add_or_match("base", base) is None
    match = index.add_or_match("edited", edited)
    assert match and match.kind == "near" and match.similarity >= 0.80


def test_distinct_lessons_are_kept():
    maths = " ".join("Pupils divide twenty counters into four equal groups and explain the quotient".split() * 5)
    reading = " ".join("Children read a passage about rainfall then identify the main idea and supporting details".split() * 5)
    index = DEDUP.NearDuplicateIndex(threshold=0.88, min_words=30)
    assert index.add_or_match("maths", maths) is None
    assert index.add_or_match("reading", reading) is None
    assert len(index.documents) == 2


def test_short_units_require_exact_match():
    index = DEDUP.NearDuplicateIndex(threshold=0.5, min_words=30)
    assert index.add_or_match("one", "Count five blue books on the table.") is None
    assert index.add_or_match("two", "Count six blue books on the table.") is None
