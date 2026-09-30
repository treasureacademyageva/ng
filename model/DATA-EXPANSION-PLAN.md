# Data expansion and human-review plan

Date started: 30 September 2026

## Status

**Data work is active. GPU training remains paused. No long run is authorised.**

The measured Tesla T4 benchmark proved that the 14M-parameter model and optimisation path run on real GPU hardware. It did not make the corpus suitable for sustained training. The current baseline remains 461,013 training BPE tokens, 57.1% science by characters, failed generation quality, and incomplete Nigerian teacher/safeguarding review.

`data/readiness-policy.json` is the machine-readable working gate. Passing it makes the project eligible for a new 100-step review; it never grants automatic long-run authorisation.

## Required corpus gates

- At least **10,000,000 training BPE tokens after cleaning and deduplication**. This is token count over the deduplicated corpus, not ten million vocabulary entries.
- Exact and near-duplicate document-unit filtering, with no train/validation document crossover.
- No single subject family above the working 35% ceiling.
- At least 30% explicitly Nigerian-context material across subjects.
- Reviewed coverage for all of:
  - Nigerian primary mathematics;
  - Nigerian English reading and composition;
  - licensed Nigerian stories;
  - Nigerian social studies;
  - civic education;
  - local geography; and
  - age-appropriate computer studies.
- A final tokenizer trained only after the corpus and reviews are frozen.

These are minimum readiness controls, not a claim that every source or category has equal pedagogical value. A qualified Nigerian primary teacher must approve curriculum fit and may revise the working balance policy.

## Source intake workflow

1. **Discover** — add the candidate to `data/source-candidates.json`; do not add it to `sources.json`.
2. **Verify rights** — record the exact item licence and attribution. Public access alone is insufficient.
3. **Stage** — extract text to ignored `data/staging/`; staging never means training approval.
4. **Automated screening** — scan provenance, hashes, extraction quality, private data, exact duplicates and near duplicates.
5. **Human review** — require Nigerian primary-teacher and safeguarding decisions. Hausa, Yoruba, Igbo and Ebira also require a qualified speaker.
6. **Approve deliberately** — only then add a source to `sources.json` with explicit coverage tags and review evidence.
7. **Rebuild** — regenerate document-level train/validation splits and retrain the tokenizer after the full corpus is frozen.

## First intake tranche

The reproducible `scripts/stage_storybooks_nigeria.py` importer pins both upstream repositories to immutable commits, verifies the published item licence, excludes every NC item, and stages four language collections:

- English: 40 checked; 29 CC BY staged; 11 CC BY-NC rejected; 47,302 characters;
- Nigerian Pidgin: 7 checked; all 7 CC BY staged; 5,316 characters;
- Hausa: 6 checked; 4 CC BY staged; 2 CC BY-NC rejected; 2,862 characters;
- Yoruba: 8 checked; 6 CC BY staged; 2 CC BY-NC rejected; 3,497 characters.

The total is **46 staged stories and 58,977 characters**, all with `approved_for_training: false`. English items still need teacher and safeguarding review. Nigerian Pidgin, Hausa and Yoruba also require their qualified-speaker review. These collections do **not** by themselves satisfy the Nigerian-authored stories or Nigerian English composition requirements.

## Duplicate and cleaning audit

`scripts/audit_duplicates.py` now performs deterministic exact matching plus high-overlap five-word-shingle screening. The first audit scanned **13,471 document units and 374,632 words** across the current approved corpus and all 46 staged stories. It found **727 exact and 1 near duplicate**, all inside the already-approved baseline corpus. No staged story overlapped the current corpus or another staged story.

The audit also exposed a Project Gutenberg cleaner defect: footer removal used the pre-header-removal character offset and left licence boilerplate in the old benchmark corpus. The cleaner now recomputes the end marker after removing the header. Future `prepare_data.py` builds use exact and near-duplicate removal and record counts in metadata. The old benchmark token files were deliberately not rebuilt, so their recorded hashes remain verifiable; cleaning takes effect only in a future versioned corpus rebuild.

## Original mathematics and English authoring queue

`data/authoring/primary-math-english-briefs.csv` now defines **96 original-content briefs**: eight mathematics and eight English briefs for each of Primary 1–6. Every brief starts `NOT_STARTED` with no assigned author and no training approval.

- Pilot plan: 288 documents for workflow and quality review.
- Full planning target: 3,840 documents and about 1,152,000 words.
- Coverage tags: `nigerian_primary_mathematics` and `nigerian_english_reading_composition`.
- Required formats include lessons, worked/model examples, guided practice and independent pupil work.
- Every future draft must record a named author, creator type, owner licence confirmation, text hash, and separate teacher and safeguarding decisions.

This queue is a controlled authoring plan, not corpus data. It must not be filled with repetitive synthetic variations, copied curriculum pages or unreviewed assistant output. The queue builder preserves assignments only while the underlying brief hash is unchanged.

## Human-review packets

Run:

```bash
python3 scripts/build_human_review_packets.py
python3 scripts/validate_human_reviews.py
```

The builder creates separate CSV packets for all 240 held-out cases:

- `data/reviews/evaluation-teacher-review.csv`
- `data/reviews/evaluation-safeguarding-review.csv`

The Storybooks staging importer also maintains four collection review packets covering all 46 staged stories. It preserves completed decisions only while a text hash is unchanged. `data/reviews/language-source-review.csv` separately records qualified-speaker decisions.

No script auto-approves a row. Valid approval requires a named human, the required role and a review date. Current state is **0/240 evaluation teacher-approved, 0/240 evaluation safeguarding-approved, and 0/46 staged stories approved on either content-review track**. All six language-source decisions are also pending. That is expected at programme start and remains a hard blocker.

## Candidate findings

The candidate registry records both promising and prohibited uses:

- Storybooks Nigeria and StoryWeaver: potentially useful story collections, but licences and attribution must be checked per item; Nigerian-language text remains blocked on qualified-speaker review.
- Global Digital Library primary maths: promising open-resource catalogue, but every selected resource needs its own licence record and Nigerian contextual review.
- NERDC curriculum and Nigeria Learning Passport: useful alignment references; currently not training sources because no affirmative open training/reuse licence has been verified.
- Siyavula Nigeria mathematics: openly licensed unbranded versions exist, but the current catalogue is JSS 1–3 and therefore does not satisfy the primary requirement.
- Original Treasure EDU material: likely the safest route to substantial Nigerian alignment, but ownership, teacher review and safeguarding review must be real and recorded; assistant-authored text must never be labelled human-reviewed.

## Order of work

1. Complete rights and item selection for the staged English stories, then obtain the two required human reviews.
2. Build Nigerian primary mathematics and Nigerian English/composition packs with recorded authorship and teacher review.
3. Add reviewed social studies, civic education, local geography and computer studies.
4. Process Hausa, Yoruba, Igbo and Ebira only through the qualified-speaker queue.
5. Reach the size and balance gates; run exact and near-duplicate checks.
6. Freeze source versions and hashes, recreate document-level splits, and retrain the tokenizer.
7. Repeat the exact 100-step GPU benchmark and inspect fresh generations.
8. Write a new decision. Do not infer long-run authorisation from benchmark completion.
