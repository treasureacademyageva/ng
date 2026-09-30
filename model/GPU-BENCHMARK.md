# Tiny-model 100-step GPU benchmark

## Gate

A long run is forbidden until an actual CUDA GPU completes exactly 100 optimiser steps and the resulting report is reviewed. A CPU smoke run is useful only to test the script; it is not evidence about GPU type, VRAM, throughput, duration or cost.

Use an NVIDIA CUDA instance with at least 8 GB VRAM; 16 GB or more is preferred. The operator must choose and fund the provider, record its advertised hourly price, and keep provider credentials outside this repository.

## Reproduce the data

```bash
cd model
python3 -m pip install -r requirements.txt
python3 scripts/fetch_open_data.py --strict
python3 scripts/validate_sources.py
python3 scripts/build_curriculum.py
python3 scripts/prepare_data.py --config config/micro.json
python3 tokenizer/train_tokenizer.py --config config/tiny.json
python3 scripts/prepare_data.py --config config/tiny.json
python3 scripts/audit_corpus.py
```

Confirm that the corpus audit still says `DO NOT AUTHORISE LONG RUN`. The benchmark may proceed for measurement, but this decision blocks sustained training.

## Run exactly 100 steps

Replace the provider, instance and rate with values from the actual rented machine:

```bash
python3 scripts/benchmark_tiny.py \
  --steps 100 \
  --provider "PROVIDER" \
  --instance "INSTANCE OR GPU SKU" \
  --hourly-cost-usd PRICE \
  --target-steps 50000 \
  --output runs/tiny-gpu-benchmark.json
```

The GPU path rejects any step count other than 100 and rejects a missing hourly rate. The report records GPU model, total VRAM, CUDA/cuDNN versions, precision, peak allocated and reserved VRAM, tokens/second, seconds/step, first/final and averaged training loss, validation loss before/after, projected duration, projected provider cost, data checksums, and a generated sample.

## Review

1. Confirm `kind` is `GPU`, `benchmark.steps` is `100`, and the GPU fields are real.
2. Check that losses are finite and generally improve; investigate instability rather than hiding outliers.
3. Read the generated sample. A random model after only 100 steps may still be poor; record that honestly.
4. Re-run `scripts/audit_corpus.py` and review the 240-case evaluation rubric.
5. Obtain Nigerian teacher/safeguarding review of the corpus and evaluation cases.
6. Authorise a longer run only in a separate written decision. Never infer authorisation from benchmark completion.

## CPU smoke test only

```bash
python3 scripts/benchmark_tiny.py --allow-cpu --steps 1 --warmup-steps 0 \
  --eval-batches 1 --batch-size 1 --block-size 32 \
  --gradient-accumulation 1 --target-steps 100 \
  --output runs/tiny-cpu-smoke.json
```

The output is labelled `CPU_SMOKE_ONLY` and cannot satisfy the GPU gate.
