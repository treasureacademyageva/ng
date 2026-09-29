# Baseline results — 29 September 2026

These are smoke-test measurements, not production claims.

## Data

- 570,375 licensed/owned character tokens after cleaning and exact-paragraph deduplication.
- 541,856 training tokens and 28,519 validation tokens.
- Sources admitted to training: original foundation curriculum, four individually verified Project Gutenberg works, and one curated CC BY African Storybook adaptation.
- The downloaded Hausa booklet was **not** admitted because PDF booklet extraction lost reading order; a Hausa-speaking editor must review it.
- The school knowledge base remains retrieval-only so changing school facts are not memorised in weights.

## From-random-weights character model

- Decoder-only transformer: 2 layers, 4 heads, 128 embedding width, 423,936 parameters.
- Initial step-1 validation loss: 4.5287; perplexity: 92.64.
- Step-100 validation loss: 2.8905; perplexity: 18.00.
- Step-1,000 validation loss: 2.5087; perplexity: 12.29.
- Checkpoint: `checkpoints/micro-char-latest.pt` (local, gitignored).

This demonstrates learning from random weights. Samples are still weak and often not factual.

## Instruction smoke tune

- 877 original examples; 90/10 train/validation split.
- 300 steps initialised from the pretraining checkpoint.
- Instruction validation loss: 1.3903; perplexity: 4.02 in the independent evaluation run.
- Checkpoint: `checkpoints/micro-char-sft-latest.pt` (local, gitignored).
- Held-out educational/safety prompts: **0/8 passed**.

Lower next-character loss did not produce reliable reasoning or safety behaviour. The model must **not** replace Treasure Support. More diverse data, a larger subword model, stronger evaluation and teacher review are required before any shadow integration.

## Tiny-transformer readiness

- 8,192-token byte-level BPE tokenizer trained and round-trip checked.
- Tokenised tiny corpus produced successfully.
- The ~13,980,672-parameter tiny architecture completed a forward-pass smoke test.
- Sustained tiny pretraining has not been run; use GPU hardware and benchmark 100 steps before committing cost.
