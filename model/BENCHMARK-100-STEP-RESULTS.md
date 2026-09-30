# Tiny 14M GPU benchmark — measured results

Date: 30 September 2026

Report SHA-256: `d5109934d8cb57758216d5fab93beb2c825b0973aff608be0649ee285417d883`

Raw report: `results/tiny-gpu-benchmark-t4-20260930.json`

## Decision

**The 100-step GPU benchmark gate is complete, but a longer run is NOT authorised.**

The hardware is suitable and optimisation is functioning. The corpus and generated sample are not ready. The current 461,013-token training split is far too small and too science-heavy for a sustained 13,980,672-parameter from-scratch run.

## Measured benchmark

| Metric | Result |
|---|---:|
| GPU | NVIDIA Tesla T4 |
| Total VRAM | 14.56 GiB |
| Peak allocated VRAM | 2.999 GiB |
| Peak reserved VRAM | 3.166 GiB |
| Precision | bfloat16 |
| Optimiser steps | exactly 100 |
| Effective tokens/step | 65,536 |
| Seconds/step | 3.0539 |
| Throughput | 21,459.8 tokens/s |
| Initial training loss | 9.0535 |
| Final training loss | 4.8813 |
| Mean first-10 training loss | 7.8390 |
| Mean final-10 training loss | 4.6828 |
| Initial validation loss | 9.0454 |
| Final validation loss | 4.7899 |
| Final validation perplexity | 120.29 |
| Projected 50,000-step time | 42.42 hours |
| Nominal Colab Free cost | $0.00 |

The schema, parameter/vocabulary counts, throughput calculation, duration projection and local train/validation file hashes were independently checked and passed.

## Sample inspection

The sample contains a few learned topic words and fragments such as “soil”, “Earth”, “plants”, “two parts”, and “table”. It is nevertheless incoherent, repetitive, grammatically broken, and padded with excessive blank lines. It does not reliably answer or explain an educational question.

**Sample-quality gate: failed.** This is expected after only 100 steps, but it does not support authorising a long run on the current data.

## Corpus exposure

The benchmark presented 6,553,600 tokens. That is about **14.22 equivalents of the entire 461,013-token training split in only 100 steps**. A 50,000-step run at the same effective batch would present about **7,108 corpus equivalents**, creating extreme memorisation and overfitting risk. The nominal 42.42-hour/$0 projection is arithmetic, not a recommendation or a guarantee that a free instance will remain available.

## Gate review

| Gate | Outcome |
|---|---|
| Real CUDA GPU and exactly 100 steps | PASS |
| GPU, VRAM, speed, losses, duration and cost recorded | PASS |
| Finite losses with strong initial improvement | PASS |
| Generated sample coherent and educational | FAIL |
| Corpus sufficiently large | FAIL |
| Corpus sufficiently balanced/local | FAIL |
| 240-case suite human teacher/safeguarding approved | PENDING |
| Longer run authorised | **NO** |

## Required before reconsideration

1. Expand to substantially more unique, reviewed primary-school text. The current engineering floor is 10 million unique BPE training tokens, not a guarantee of sufficiency.
2. Reduce the 57.1% science concentration by adding Nigerian primary maths, reading, stories, language and dedicated social-studies material with provenance.
3. Add reviewed Nigerian English and approved local-language material; keep the page-scrambled Hausa booklet excluded.
4. Complete Nigerian teacher and safeguarding review of all 240 evaluation cases.
5. Retrain the tokenizer, rebuild document-level train/validation splits and repeat corpus leakage/balance checks.
6. Recalculate the step budget from corpus size and desired token exposure rather than retaining 50,000 steps automatically.
7. Repeat the exact 100-step benchmark on the final corpus/config, inspect fresh samples, then make a new written authorisation decision.
