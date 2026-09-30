# Corpus expansion evidence report

Date: 30 September 2026

Branch scope: `preview` only

Decision: **LONG RUN AUTHORISED: NO**

## What changed

The candidate workflow has moved from collection-level planning to exact-item staging and audit. The preserved research list still contains its original 10 collection candidates. A new item-level registry now contains 54 exact items with creator, publisher, source and acquisition URLs, revision identity, context evidence, language, level, canonical primary and secondary subjects, exact licence evidence, attribution, acquisition/review/staging/approval states, rejection reason, hashes, quality/privacy results, duplicate results and measured size.

No item was added to `data/sources.json`. No staged item is training-eligible. No human decision was filled automatically.

## Measured state separation

| State | Items | Characters | Words | Estimated BPE tokens | Counts as approved progress? |
|---|---:|---:|---:|---:|---|
| Existing approved baseline | 9 included sources | 1,903,726 | — | 461,013 training | Yes, historical baseline only |
| Staged, unapproved | 49 | 720,359 | 137,395 | 180,624 | **No** |
| Quarantined | 5 | 183,943 | 34,758 | 46,186 | **No** |
| Rejected exact items | 0 | 0 | 0 | 0 | No |

The approved-before and approved-after figures are identical: 1,903,726 characters and 461,013 training BPE tokens. Staging did not inflate approved progress.

The 49 staged-unapproved items currently include:

- 290,837 characters of Grade 4–5 African primary mathematics;
- 365,827 characters of global English reading/composition material;
- 7,491 characters from a child-oriented computer explainer;
- 1,879 characters from a pinned child-oriented Nigeria page classified primarily as local geography and secondarily as Nigerian social studies and civic education; and
- 54,325 characters classified as children’s stories, including Nigerian-language editions that remain blocked on qualified-speaker review and English/African material that is not assumed to be Nigerian.

These are distribution measurements, not curriculum approvals.

## Exact sources added to item-level research

The new general tranche is:

1. pinned Wikijunior Nigeria revision 4416499 — CC BY-SA 4.0, share-alike review required;
2. pinned Wikijunior computer revision 4055667 — CC BY-SA 4.0, share-alike review required;
3. Siyavula/Connexions Mathematics Grade 4 — CC BY 3.0;
4. Siyavula/Connexions Mathematics Grade 5 — CC BY 3.0;
5. Siyavula/OpenStax CNX Mathematics Grade 6 — CC BY 3.0, quarantined for a phone-like OCR sequence pending human privacy inspection;
6. *Beginners’ Book in Language: A Book for the Third Grade* — represented by Project Gutenberg as US public domain, Nigerian-jurisdiction review required;
7. *McGuffey’s Third Eclectic Reader* — represented by Project Gutenberg as US public domain, Nigerian-jurisdiction review required; and
8. *Take me home, son of thunder, mu* — CC BY 4.0, staged as African/uncertain rather than guessed to be Nigerian.

The existing pinned Storybooks Nigeria tranche is now represented as 46 exact item records instead of only collection summaries. Original repository archives are preserved in ignored staging. Each item retains the source original hash and extracted-text hash.

## Quarantine findings

Five items are quarantined rather than silently accepted:

- one Grade 6 mathematics OCR extraction contains a phone-like numeric sequence that requires human privacy inspection;
- three story editions contain exact repeated paragraph units; and
- one Yoruba story extraction is below the minimum quality length.

The detailed findings are machine-readable in `reports/candidate-staging-report.json` and `reports/storybook-candidate-scan.json`.

## Security and review controls

`scripts/stage_open_candidates.py` now provides a fail-closed general stager with:

- exact registry URL and HTTPS host allowlisting;
- checked redirects, bounded redirect count, timeout and byte limit;
- MIME allowlisting and declared-length checks;
- URL, item-ID and EPUB path-traversal controls;
- pinned MediaWiki revision verification;
- plain-text, PDF and EPUB extraction paths;
- deterministic Unicode/text cleaning;
- original and extracted SHA-256 hashes;
- characters, words and estimated BPE token measurements;
- corruption and extraction-quality checks;
- masked personal-data warnings;
- evidence-bound Nigerian/African/global/uncertain context classification;
- canonical primary/secondary subject labels;
- exact and near-duplicate removal against the approved corpus and earlier staged units;
- held-out 12-word-shingle leakage screening; and
- machine-readable reports plus hash-bound review packets.

`data/reviews/candidate-intake-review.csv` has 54 rows. Licence, teacher, safeguarding, language and final approval decisions are all `PENDING`. Prior decisions are preserved only when both the original and extracted hashes still match.

The protected held-out evaluation and benchmark hashes were checked before and after staging and did not change. Ignored `data/staging/` remains outside `prepare_data.py`. The deployed configuration and production chatbot do not route to experimental checkpoints or pretraining files.

## Weighted completion

### Official policy completion: **15.31%**

This percentage uses approved-corpus and long-run evidence only. Staged and quarantined material earns no official points.

| Component | Weight | Awarded | Evidence |
|---|---:|---:|---|
| Approved training-token volume | 30 | 1.38 | 461,013 / 10,000,000 approved training BPE tokens |
| Approved subject balance | 10 | 0.00 | largest subject and science are both 57.1%, above 35% |
| Approved Nigerian context | 10 | 5.93 | 17.8% against a 30% target |
| Seven approved coverage tags | 14 | 0.00 | 0 / 7 have approved characters |
| Required approved-corpus dedup metadata | 8 | 0.00 | historical metadata still says exact-only; benchmark corpus was not rebuilt |
| Included-source provenance/licensing | 8 | 8.00 | 9 / 9 included baseline sources retain IDs and licences |
| Held-out teacher/safeguarding reviews | 10 | 0.00 | 0 / 240 and 0 / 240 |
| Candidate/original-content human approval | 5 | 0.00 | 0 / 54 candidates; 0 / 96 original pilot rows |
| Separate written long-run authorisation | 5 | 0.00 | none; never inferred |

### Experimental pipeline readiness: **100.00%**

This measures whether the experimental intake controls requested for this tranche are implemented and evidenced. It does **not** measure model quality, corpus sufficiency, human approval or permission to train.

All 14 scored control groups passed: complete item schema; seven-area representation; URL/pinned-source allowlisting; redirect/size/time/MIME/path controls; reproducible extraction/hashes/metrics; quality/privacy scanning; evidence-bound context/subjects; exact/near deduplication; leakage/hash protection; hash-bound pending reviews; state-separated audit; ignored staging; closed long-run gate; and production disconnection.

The detailed component-by-component points and evidence are in `reports/corpus-expansion-audit.json`.

## Remaining hard gates

- 9,538,987 more approved training BPE tokens are needed before the 10M minimum, subject to deduplication.
- Approved science concentration remains 57.1%, above the 35% ceiling.
- All seven required approved coverage tags remain missing.
- The historical benchmark corpus has not been rebuilt, so its old exact-only metadata remains intact by design.
- Candidate review is 0/54 approved; evaluation review is 0/240 on both tracks.
- Qualified-speaker review remains mandatory for Hausa, Yoruba, Igbo, Ebira and Nigerian Pidgin.
- Four items have conditional licence obligations: two CC BY-SA items and two US-public-domain-only determinations.
- Five items remain quarantined.
- A final tokenizer/corpus freeze, repeated 100-step benchmark, fresh generation review and separate owner authorisation have not occurred.

**LONG RUN AUTHORISED: NO.**
