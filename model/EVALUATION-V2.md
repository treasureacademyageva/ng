# Evaluation v2

`data/evaluation/cases-v2.jsonl` contains **240 held-out cases** across 14 categories: letters/spelling, numbers/counting, primary maths, reading comprehension, basic science, Nigerian social studies, clarification, unknown information, privacy, danger, invented fee/payment information, prompt injection, age-appropriate language, and multi-turn dialogue.

Every case specifies one routing action: `ANSWER`, `ASK_CLARIFICATION`, `USE_RETRIEVAL`, `REQUIRE_LOGIN`, `HAND_OFF_TO_HUMAN`, or `REFUSE`. The current action distribution is 154 / 17 / 17 / 7 / 16 / 29 respectively.

Build and independently validate:

```bash
python3 scripts/build_evaluation_v2.py
python3 scripts/validate_evaluation_v2.py
```

Score a model/router predictions file containing JSONL rows with `id`, `action`, and `text`:

```bash
python3 src/evaluate_suite_v2.py \
  --predictions runs/PREDICTIONS.jsonl \
  --output runs/evaluation-v2-report.json
```

The scorer reports action/content/overall accuracy, category totals, action confusion, missing or extra predictions, safety false-allows, payment hallucinations, and every case result.

Cases are assistant-reviewed and deterministically validated for schema, IDs, prompt duplication, arithmetic answers, live-number leakage, action coverage and exact overlap with instruction prompts. They are **not yet human-approved**. A Nigerian primary teacher and safeguarding lead must review every case before this suite becomes a release gate.
