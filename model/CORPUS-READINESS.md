# Corpus readiness decision — 30 September 2026

**Decision: DO NOT AUTHORISE A LONG 14M-PARAMETER RUN.**

The licensed corpus expanded from **570,375** to **1,903,726 characters** (3.34× the previous size). It now includes Siyavula Natural Sciences and Technology Grades 4–6 under CC BY 4.0, plus broader original primary maths, language, comprehension, science and Nigerian social-studies foundations.

After retraining the 8,192-token BPE tokenizer, the deterministic split contains:

- **484,586 total BPE tokens**
- **461,013 training tokens**
- **23,573 validation tokens**
- **13,980,672 model parameters**
- **0.033 unique training tokens per parameter**

At the configured effective batch of 65,536 tokens per optimiser step, a 100-step benchmark presents the equivalent of about **14.2 corpus passes**. A configured 50,000-step run would present about **7,108 passes**, creating an extreme memorisation/overfitting risk.

## Balance findings

- Natural sciences and technology: **1,086,536 characters (57.1%)**
- Original foundations: **337,999 (17.8%)**
- Literature, reading, and stories/morals: **478,462 (25.1%)**
- Explicitly Nigerian English sources: **338,488 (17.8%)**
- Dedicated reviewed Nigerian social-studies source: **none**
- Approved Hausa source: **none**; the page-scrambled booklet remains excluded

The expansion is useful, and validation now samples document units from every source without exact unit crossover, but the corpus is neither large enough nor balanced enough for a sustained from-scratch run. Before reconsideration, add substantially more reviewed Nigerian primary language, maths, social studies and stories; keep provenance; retrain the tokenizer; and repeat the audit.

The reproducible machine-readable audit is produced by `python3 scripts/audit_corpus.py` and is intentionally kept under ignored `runs/`.
