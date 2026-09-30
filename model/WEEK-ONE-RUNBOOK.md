# Week-one learning runbook

## Day 1 — provenance and baseline

Run the licence-gated fetcher, inspect every downloaded title, build original curriculum, prepare character tokens, and record the untrained validation loss.

## Day 2 — micro pretraining

Train `micro.json` in checkpoint-sized sessions. Compare train/validation loss and sample text after every checkpoint. Resume; never restart from an unrecorded state.

## Day 3 — data quality

Inspect deduplication, source balance, PDF extraction noise, Nigerian English coverage, and train/validation leakage. Add only item-level verified sources.

## Day 4 — tokenizer and tiny model

Train the BPE tokenizer and inspect English and Nigerian names; approved Hausa training text is not yet available. Launch no sustained `tiny.json` run. On suitable CUDA hardware, run exactly the 100-step benchmark in `GPU-BENCHMARK.md`, record all required metrics and sample text, then review the separate corpus-readiness decision.

## Day 5 — instruction and safety tune

Build reviewed instruction data, keep the held-out file untouched, fine-tune from the best pretraining checkpoint, and compare against the untuned baseline.

## Day 6 — evaluation

Run perplexity and the 240-case evaluation v2 suite covering educational answers and all six routing outcomes. Include privacy, danger, prompt-injection and fabricated-payment checks plus Nigerian teacher/safeguarding review. Fail the release if private data or fabricated payment information appears.

## Day 7 — integration decision

Export inference-only weights only if gates pass. Otherwise continue research. Any integration is behind the existing retrieval, privacy, validator and human-handoff shell; no direct replacement.
