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
5. **Human review** — require Nigerian primary-teacher and safeguarding decisions. The owner deferred the separate qualified-language-review track for this current experimental corpus only; this does not waive any other review.
6. **Approve deliberately** — only then add a source to `sources.json` with explicit coverage tags and review evidence.
7. **Rebuild** — regenerate document-level train/validation splits and retrain the tokenizer after the full corpus is frozen.

## First intake tranche

The reproducible `scripts/stage_storybooks_nigeria.py` importer pins both upstream repositories to immutable commits, verifies the published item licence, excludes every NC item, and stages four language collections:

- English: 40 checked; 29 CC BY staged; 11 CC BY-NC rejected; 47,302 characters;
- Nigerian Pidgin: 7 checked; all 7 CC BY staged; 5,316 characters;
- Hausa: 6 checked; 4 CC BY staged; 2 CC BY-NC rejected; 2,862 characters;
- Yoruba: 8 checked; 6 CC BY staged; 2 CC BY-NC rejected; 3,497 characters.

The total is **46 staged stories and 58,977 characters**, all with `approved_for_training: false`. Every item still needs teacher and safeguarding review. Separate qualified-speaker review is owner-deferred for the current experimental corpus, with existing optional review rows retained. These collections do **not** by themselves satisfy the Nigerian-authored stories or Nigerian English composition requirements.

## Exact-item expansion tranche

The registry now preserves the original 10 collection-level research candidates and adds 54 exact item records: the 46 pinned Storybooks items plus eight new exact sources for geography/social studies/civics, computer studies, primary mathematics, English composition/reading and African children’s stories. Every record carries complete identity, provenance, evidence-bound context, language/level, canonical primary and secondary subjects, licence evidence, attribution, statuses, hashes, metrics, privacy/quality findings and duplicate results.

The safe general stager acquired all eight new items, and the cross-source story scan covered 46 exact stories. A deterministic follow-up then resolved five hash-bound automated holds for staging only: one OCR arithmetic privacy false positive, three intentional repeated refrains/dialogue cases, and one complete short beginning reader. Four conditional-rights works were fail-closed as licence-excluded. Combined current state:

- 50 staged-unapproved items: 529,105 characters, 101,223 words and 133,007 estimated BPE tokens;
- 4 licence-excluded items: 375,197 characters, 70,930 words and 93,803 estimated BPE tokens;
- 0 quarantined items;
- 54/54 hash-bound automated pre-reviews, with 50 ready for named human review and 4 held by licence disposition;
- 54 hash-bound human review rows, with every generated human decision pending;
- 0 candidate items approved for training; and
- 0 held-out leakage findings, with protected benchmark hashes unchanged.

The approved before/after distribution is unchanged at 1,903,726 characters and 461,013 training BPE tokens. Staged or licence-excluded material earns no approved progress. See `CORPUS-EXPANSION-REPORT.md` and `reports/corpus-expansion-audit.json`.

The weighted approved-policy completion is **15.31%**. Experimental intake-pipeline readiness is **100.00%**, meaning only that the requested staging controls are implemented and evidenced; it is not corpus readiness, model quality or training authorisation.

## Duplicate and cleaning audit

`scripts/audit_duplicates.py` now performs deterministic exact matching plus high-overlap five-word-shingle screening. The first audit scanned **13,471 document units and 374,632 words** across the current approved corpus and all 46 staged stories. It found **727 exact and 1 near duplicate**, all inside the already-approved baseline corpus. No staged story overlapped the current corpus or another staged story.

The audit also exposed a Project Gutenberg cleaner defect: footer removal used the pre-header-removal character offset and left licence boilerplate in the old benchmark corpus. The cleaner now recomputes the end marker after removing the header. Future `prepare_data.py` builds use exact and near-duplicate removal and record counts in metadata. The old benchmark token files were deliberately not rebuilt, so their recorded hashes remain verifiable; cleaning takes effect only in a future versioned corpus rebuild.

## NAPPS English and mathematics alignment

The owner confirmed that Treasure Academy Ageva follows the NAPPS syllabus. The newest publicly viewable Primary 1–6 series found was published in November 2025 and modified on 19 December 2025. It claims compliance with the new NERDC curriculum and NAPPS but is hosted by a third party, not NAPPS.

The limited alignment index has 328 week/topic rows covering all 36 class/subject/term combinations; 239 are instructional topics. No explanations, objectives, activities or lesson text were copied. Nine combinations—especially Primary 4—have unusually short public schedules and require comparison with the school's current NAPPS-issued copy.

The official public NAPPS site did not expose an edition-checkable Primary scheme. Two advertised free downloads were app-gated, and one third-party collection was paid; no access controls were bypassed and no paid copyrighted files were ingested. The public series was cross-checked against the Federal Ministry of Education's September 2025 subject structure and NERDC's competency-based implementation strategy. The owner authorised it for original authoring. Rows remain non-training and are not described as NAPPS-issued. See `NAPPS-ALIGNMENT.md`.

## Original mathematics and English authoring queue

`data/authoring/primary-math-english-briefs.csv` defines **96 original-content briefs**: eight mathematics and eight English briefs for each of Primary 1–6. The owner assigned all briefs to **Treasure Academy Ageva** as the responsible organisation and selected a balanced first sample. The briefs are `ASSIGNED` and must use the cross-checked public NAPPS-aligned sequence while producing entirely original school-owned text.

- Selected first sample: 96 planned private documents, 48 mathematics and 48 English, 16 per class.
- Broader pilot plan: 288 documents for workflow and quality review.
- Full planning target: 3,840 documents and about 1,152,000 words.
- Coverage tags: `nigerian_primary_mathematics` and `nigerian_english_reading_composition`.
- Required formats include lessons, worked/model examples, guided practice and independent pupil work.
- `rights-confirmation.json` records school-owned internal model use only, with no open licence or public corpus distribution.
- Every future draft must record its creator type, rights status, text hash, and separate named teacher and safeguarding decisions.

`pilot-balanced-v1-review.csv` is the fail-closed, hash-bound 96-row pilot manifest. Every row is now `DRAFTED` and `AI_ASSISTED`, both reviews remain `PENDING`, and `approved_for_training` is false. The private deterministic pilot contains 39,730 words; each brief has one substantive 378–462-word draft, and the internal 0.88-threshold exact/near-duplicate screen reports zero matches. Because the owner selected internal rather than open rights, draft text remains in ignored private staging and is not pushed to the public repository. The committed generator can reproduce every manifest hash from the briefs.

This queue and its unreviewed drafts are not approved corpus data. They must not be expanded with repetitive synthetic variations or copied curriculum pages, and AI-assisted text must not be presented as human-authored or reviewed. Builders preserve assignments and decisions only while the underlying brief/content hashes remain unchanged.

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

No script auto-approves a row. Valid teacher or safeguarding approval requires a named human, the required role and a review date. Current state is **0/240 evaluation teacher-approved, 0/240 evaluation safeguarding-approved, 0/46 staged stories approved on either content-review track, and 0/96 original drafts approved on either track**. All six optional language-source decisions are also pending; under the current scoped owner policy, that separate language track is deferred rather than a present hard gate.

All 96 original drafts have now passed deterministic machine pre-review, and private read-only reviewer workbooks package the 54 candidate licence rows, 50 staged candidate content rows, four conditional-rights legal holds and 96 original drafts. This improves review readiness but does not reduce any human approval requirement. See `HUMAN-REVIEW-HANDOFF.md` and `reports/human-review-handoff.json`.

## Candidate findings

The candidate registry records both promising and prohibited uses:

- Storybooks Nigeria and StoryWeaver: potentially useful story collections, but licences and attribution must be checked per item; separate qualified-speaker review is deferred for the current corpus while teacher, safeguarding and final approval remain required.
- Global Digital Library primary maths: promising open-resource catalogue, but every selected resource needs its own licence record and Nigerian contextual review.
- NERDC curriculum and Nigeria Learning Passport: useful alignment references; currently not training sources because no affirmative open training/reuse licence has been verified.
- Siyavula Nigeria mathematics: openly licensed unbranded versions exist, but the current catalogue is JSS 1–3 and therefore does not satisfy the primary requirement.
- Original Treasure EDU material: likely the safest route to substantial Nigerian alignment, but ownership, teacher review and safeguarding review must be real and recorded; assistant-authored text must never be labelled human-reviewed.

## Order of work

1. Complete rights and item selection for the staged English stories, then obtain the two required human reviews.
2. Build Nigerian primary mathematics and Nigerian English/composition packs with recorded authorship and teacher review.
3. Add reviewed social studies, civic education, local geography and computer studies.
4. Retain the optional Hausa, Yoruba, Igbo and Ebira speaker-review queue for future use; the owner has deferred it for the current experimental corpus.
5. Reach the size and balance gates; run exact and near-duplicate checks.
6. Freeze source versions and hashes, recreate document-level splits, and retrain the tokenizer.
7. Repeat the exact 100-step GPU benchmark and inspect fresh generations.
8. Write a new decision. Do not infer long-run authorisation from benchmark completion.
