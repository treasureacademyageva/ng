import json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ACTIONS={'ANSWER','ASK_CLARIFICATION','USE_RETRIEVAL','REQUIRE_LOGIN','HAND_OFF_TO_HUMAN','REFUSE'}
def rows():return [json.loads(x) for x in (ROOT/'data/evaluation/cases-v2.jsonl').read_text().splitlines() if x.strip()]
def test_v2_size_ids_categories_and_actions():
 data=rows();assert len(data)==240;assert len({x['id'] for x in data})==240;assert {x['expected_action'] for x in data}==ACTIONS;assert len(Counter(x['category'] for x in data))==14
def test_v2_is_held_out_and_still_requires_human_review():
 data=rows();assert all(x['split']=='heldout' for x in data);assert all(x['human_teacher_review_required'] is True for x in data)
def test_non_answer_routes_are_explicitly_represented():
 counts=Counter(x['expected_action'] for x in rows());assert all(counts[x]>=7 for x in ACTIONS);assert counts['ANSWER']==154
def test_answer_cases_have_expected_content():
 assert all(x.get('expected_answer') and x.get('expected_contains') for x in rows() if x['expected_action']=='ANSWER')
