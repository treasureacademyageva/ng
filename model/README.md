# Treasure EDU — from-scratch educational language-model lab

This project is intentionally separate from the production Treasure Support assistant. The production bot remains the reliable rules + retrieval + live-data shell. This directory develops a small decoder-only transformer from random weights, measures it, and only later connects a proven checkpoint behind the existing safety layer.

## Honest scope

A one-week CPU experiment can prove the complete learning pipeline; it cannot produce a broad model comparable with commercial assistants. The included milestones are:

1. **Stage 0 / micro:** character tokenizer and 423,936-parameter transformer for short CPU runs.
2. **Stage 1 / tiny:** 8K subword tokenizer and ~14M parameters; GPU recommended for sustained training.
3. **Stage 2 / small:** 16K tokenizer and ~35M parameters; multi-day GPU run.
4. Instruction tuning, safety evaluation, reviewed preference optimisation, retrieval integration and gated production trials.

No pupil records, private chats, credentials, paid textbooks or unlicensed scraped material may enter the corpus.

## Environment

Python 3.11+ is recommended. On a CPU machine, install the CPU PyTorch wheel rather than CUDA packages:

```bash
python3 -m pip install --index-url https://download.pytorch.org/whl/cpu 'torch>=2.9,<3'
python3 -m pip install -r requirements.txt
```

## Character baseline

```bash
cd model
python3 scripts/build_curriculum.py
python3 scripts/fetch_open_data.py --manifest data/sources.json --strict
python3 scripts/validate_sources.py
python3 scripts/prepare_data.py --config config/micro.json
python3 src/train.py --config config/micro.json --max-steps 1000
python3 src/evaluate.py --config config/micro.json --checkpoint checkpoints/micro-char-latest.pt
python3 src/generate.py --config config/micro.json --checkpoint checkpoints/micro-char-latest.pt --prompt "One means"
```

## Subword/tiny path

The character preparation creates the cleaned licensed corpus. Then:

```bash
python3 tokenizer/train_tokenizer.py --config config/tiny.json
python3 tokenizer/inspect_tokenizer.py --config config/tiny.json "Treasure Academy teaches mathematics in Okene."
python3 scripts/prepare_data.py --config config/tiny.json
python3 scripts/audit_corpus.py
```

The corpus audit says **DO NOT AUTHORISE LONG RUN**. The exact 100-step CUDA benchmark has now been measured; hardware passed, while sample quality and corpus readiness failed. See `BENCHMARK-100-STEP-RESULTS.md` and `DATA-EXPANSION-PLAN.md`. Do not call `src/train.py --config config/tiny.json` until the data gates are corrected, the benchmark is repeated on the final corpus, and a separate written authorisation is recorded.

Data expansion now uses a fail-closed candidate and human-review workflow:

```bash
python3 scripts/stage_storybooks_nigeria.py       # pinned ignored staging; never approval
python3 scripts/stage_open_candidates.py           # exact-URL general staging; never approval
python3 scripts/audit_staged_storybooks.py         # quality/privacy/dedup/leakage scans
python3 scripts/resolve_candidate_holds.py          # exact hash-bound dispositions; never approval
python3 scripts/pre_review_candidates.py            # machine evidence; human decisions stay pending
python3 scripts/validate_candidate_registry.py
python3 scripts/build_human_review_packets.py
python3 scripts/validate_human_reviews.py
python3 scripts/fetch_napps_alignment.py
python3 scripts/validate_napps_alignment.py
python3 scripts/build_primary_authoring_queue.py
python3 scripts/validate_primary_authoring_queue.py
python3 scripts/build_primary_pilot_manifest.py
python3 scripts/generate_primary_pilot_drafts.py     # private AI-assisted drafts; never approval
python3 scripts/validate_primary_pilot_manifest.py
python3 scripts/audit_duplicates.py
python3 scripts/audit_corpus.py
```

Candidate material stays outside `sources.json` and training until item-level rights, provenance, content quality and every required human review pass. The current item-level audit has 50 staged-unapproved, 4 licence-excluded and 0 quarantined items. Automated pre-review covers all 54 exact items, but every generated human decision remains pending and there are zero training approvals. A separate qualified-language-review track is owner-deferred for this current experimental corpus only; teacher, safeguarding, licence, legal and final training gates remain unchanged. Approved-corpus completion is 15.31%; experimental intake-control readiness is 100.00%, which is not permission to train. See `CORPUS-EXPANSION-REPORT.md` and `reports/corpus-expansion-audit.json`.

The school uses NAPPS, so the authoring workflow includes a 328-row Primary 1–6 English/Mathematics topic index from the newest public series previously found. It matches the September 2025 federal subject structure and NERDC competency strategy and is owner-authorized for original authoring. It remains a third-party alignment—not an official NAPPS edition or licensed training source. The balanced pilot now has 96 hash-bound AI-assisted private drafts, but zero teacher approvals, zero safeguarding approvals and zero training-approved documents. See `NAPPS-ALIGNMENT.md` and `data/authoring/README.md`.

## Held-out evaluation v2

Build and validate the 240-case routing/answer suite before comparing any checkpoint:

```bash
python3 scripts/build_evaluation_v2.py
python3 scripts/validate_evaluation_v2.py
python3 src/evaluate_suite_v2.py --predictions runs/PREDICTIONS.jsonl
```

See `EVALUATION-V2.md`. Every case still requires Nigerian teacher and safeguarding review. The two review packets are in `data/reviews/`; the builder preserves signed decisions only while each case hash remains unchanged.

## Instruction and preference stages

```bash
python3 scripts/build_instruction_data.py
python3 src/train.py --config config/sft-micro.json --init-from checkpoints/micro-char-latest.pt
python3 src/evaluate_prompts.py --config config/sft-micro.json --checkpoint checkpoints/micro-char-sft-latest.pt --instruction
```

Only after held-out education, privacy and safety gates pass:

```bash
python3 src/preference_optimize.py --config config/sft-micro.json --checkpoint checkpoints/micro-char-sft-latest.pt
```

The first smoke model did **not** pass those gates, so preference optimisation and production integration were not run. See `BASELINE-RESULTS.md`.

## Provenance and exports

The fetcher accepts only manifest entries with an explicit approved licence and records checksums in `data/source-lock.json`. Raw downloads and checkpoints are gitignored; provenance is not.

```bash
python3 src/export.py --checkpoint checkpoints/micro-char-latest.pt --name treasure-edu-micro
```

The export is inference-only. Weight distribution still requires a licence review.

## Production boundary

```text
question → existing privacy/access rules → intent → retrieval/live tools
         → trained model → output validation → existing chat UI/human handoff
```

Authentication, permissions, fees, payments, pupil records, OTP, emergency routing and verified school facts remain deterministic. The model never becomes their source of truth.

## Resume protocol

Each run writes `runs/<run-id>/state.json`, metrics JSONL and a checkpoint containing model, optimizer, step, tokenizer hash and data hash. To continue the same run:

```bash
python3 src/train.py --config config/micro.json --resume checkpoints/micro-char-latest.pt
```

Stop only at a completed checkpoint. Never assume a background process survives an Arena session.
