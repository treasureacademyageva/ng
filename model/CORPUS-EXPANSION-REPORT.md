# Corpus expansion and follow-up evidence report

Date: 30 September 2026

Branch scope: `preview` only

Decision: **LONG RUN AUTHORISED: NO**

## Executive result

The exact-item candidate intake, automated pre-review, deterministic hold dispositions, fail-closed licence treatment and balanced original pilot drafting are complete for this pass.

- 54/54 candidate items have hash-bound automated pre-review evidence.
- 50 items are staged but unapproved and ready for named human review.
- 4 items are licence-excluded from training: two CC BY-SA works and two works represented as US public domain by Project Gutenberg.
- 0 items remain quarantined; five exact hash-bound automated holds were resolved for staging only.
- 96/96 balanced mathematics/English briefs now have substantive deterministic AI-assisted drafts, each 378–462 words and hash-bound in the pilot manifest.
- 0 candidate items and 0 original drafts are training-approved.
- Teacher, safeguarding, licence and final approval decisions remain pending. No human reviewer identity, decision or legal advice was fabricated.
- The owner deferred a separate qualified-language-review track for this current experimental corpus only. This is not teacher, safeguarding, licence, legal or training approval.

No candidate was added to `data/sources.json`. No tokenizer or approved corpus was rebuilt, no benchmark was rerun or altered, no model was trained, no production connection was made and no long GPU run was started.

## Measured state separation

| State | Items | Characters | Words | Estimated BPE tokens | Counts as approved progress? |
|---|---:|---:|---:|---:|---|
| Existing approved baseline | 9 included sources | 1,903,726 | — | 461,013 training | Yes, historical baseline only |
| Staged, unapproved | 50 | 529,105 | 101,223 | 133,007 | **No** |
| Licence-excluded | 4 | 375,197 | 70,930 | 93,803 | **No** |
| Quarantined | 0 | 0 | 0 | 0 | **No** |
| Rejected exact items | 0 | 0 | 0 | 0 | No |

The candidate total remains 904,302 characters, 172,153 words and 226,810 estimated BPE tokens. Moving an item between controlled candidate states did not add content or inflate approved progress.

The approved-before and approved-after figures remain identical: 1,903,726 characters and 461,013 training BPE tokens.

## Candidate pre-review and human gates

`scripts/pre_review_candidates.py` records machine evidence for all 54 candidates without impersonating a human reviewer. The report at `reports/candidate-pre-review.json` records:

- 50 candidates with no remaining automated blocker and ready for named human review;
- 4 candidates held by their fail-closed licence disposition;
- 54 teacher decisions still `PENDING`;
- 54 safeguarding decisions still `PENDING`;
- 54 licence decisions still `PENDING` in the human review packet;
- 54 final approval decisions still `PENDING`; and
- 0 training approvals.

`data/reviews/candidate-intake-review.csv` remains the 54-row hash-bound human review packet. The policy-level language deferral is recorded separately rather than presented as a qualified reviewer decision. Existing optional language-review rows are retained for future use.

Automated pre-review is evidence triage, not teacher, safeguarding or legal review. A candidate cannot become training-eligible through this report.

## Resolved automated holds

`scripts/resolve_candidate_holds.py` validates exact original and extracted SHA-256 values before applying each disposition. It resolved these five holds for staging only:

1. one Grade 6 mathematics privacy warning was confirmed to be a masked OCR arithmetic sequence, not a personal phone number;
2. one English story’s repeated dialogue was retained as intentional narrative repetition;
3. one Hausa early reader’s repeated question was retained as an intentional refrain;
4. the corresponding Yoruba early reader’s repeated question was retained as an intentional refrain; and
5. one complete 108-character Yoruba beginning reader was retained as deliberately short source content.

The raw scanner findings remain visible. Each registry item now adds a hash-bound `automated_hold_resolution` with the prior reason and an explicit “staging only; no human or training approval” scope. No scanner threshold was weakened globally.

## Fail-closed licence treatment

Four exact items are now `LICENSE_EXCLUDED` and cannot enter training:

- pinned Wikijunior Nigeria revision 4416499 — CC BY-SA 4.0;
- pinned Wikijunior computer revision 4055667 — CC BY-SA 4.0;
- *Beginners’ Book in Language: A Book for the Third Grade* — represented by Project Gutenberg as US public domain; and
- *McGuffey’s Third Eclectic Reader* — represented by Project Gutenberg as US public domain.

The CC BY-SA items remain excluded until downstream share-alike treatment for model artefacts is legally approved. The Project Gutenberg items remain excluded until Nigerian-jurisdiction clearance is recorded. These are project risk dispositions, not legal opinions.

The other exact general sources remain staged-unapproved: Siyavula/Connexions Grade 4–6 mathematics under CC BY 3.0 and *Take me home, son of thunder, mu* under CC BY 4.0. The latter remains classified as African/uncertain rather than being guessed to be Nigerian.

The preserved research list still has its original ten collection candidates. It was not expanded. Third-party schedule research is not described as NAPPS-issued.

## Original mathematics and English pilot

`scripts/generate_primary_pilot_drafts.py` generated one deterministic private draft for every approved authoring brief:

| Measure | Result |
|---|---:|
| Drafts | 96 |
| Mathematics | 48 |
| English | 48 |
| Primary 1–6 | 16 per class |
| Total characters | 247,356 |
| Total words | 39,730 |
| Shortest draft | 378 words |
| Longest draft | 462 words |
| Exact/near-duplicate drafts at 0.88 threshold | 0 |
| Teacher-approved | 0 |
| Safeguarding-approved | 0 |
| Training-approved | 0 |

The ignored private output is `data/staging/authoring/pilot-v1-drafts.jsonl`. `data/authoring/pilot-balanced-v1-review.csv` records `DRAFTED`, `AI_ASSISTED` and the exact content SHA-256 for all 96 rows. The text is reproducible from the committed generator and briefs. The validator recomputes every deterministic draft hash and checks its target length.

The drafts use fictional, low-risk classroom examples and explicitly avoid live school records and private details. That automated precaution does not replace named Nigerian primary teacher or safeguarding review. All such decisions remain `PENDING`.

## Security and audit controls

The candidate workflow retains:

- exact URL and HTTPS host allowlisting or pinned source commits;
- checked redirects, byte/time/MIME limits and path-traversal controls;
- deterministic extraction and original/extracted SHA-256 values;
- corruption, extraction-quality and masked privacy scanning;
- evidence-bound Nigerian/African/global/uncertain context labels;
- canonical primary and secondary subject labels;
- exact and near-duplicate screening;
- held-out 12-word-shingle leakage screening;
- state-separated reports and hash-bound review packets; and
- fail-closed training eligibility.

The protected held-out evaluation and benchmark hashes remain unchanged. The protected GPU benchmark SHA-256 is `d5109934d8cb57758216d5fab93beb2c825b0973aff608be0649ee285417d883`.

Ignored `data/staging/` remains outside `prepare_data.py`. The deployed configuration and production chatbot do not route to experimental checkpoints or pretraining files.

## Weighted completion

### Official policy completion: **15.31%**

This percentage uses approved-corpus and long-run evidence only. Candidate staging, licence-excluded material and unreviewed original drafts earn no official corpus points.

| Component | Weight | Awarded | Evidence |
|---|---:|---:|---|
| Approved training-token volume | 30 | 1.38 | 461,013 / 10,000,000 approved training BPE tokens |
| Approved subject balance | 10 | 0.00 | largest subject and science are both 57.1%, above 35% |
| Approved Nigerian context | 10 | 5.93 | 17.8% against a 30% target |
| Seven approved coverage tags | 14 | 0.00 | 0 / 7 have approved characters |
| Required approved-corpus dedup metadata | 8 | 0.00 | historical metadata remains exact-only; approved corpus was not rebuilt |
| Included-source provenance/licensing | 8 | 8.00 | 9 / 9 included baseline sources retain IDs and licences |
| Held-out teacher/safeguarding reviews | 10 | 0.00 | 0 / 240 and 0 / 240 |
| Candidate/original-content human approval | 5 | 0.00 | 0 / 54 candidates; 0 / 96 original pilot rows |
| Separate written long-run authorisation | 5 | 0.00 | none; never inferred |

### Experimental pipeline readiness: **100.00%**

This measures implemented experimental controls, not model quality, corpus sufficiency, human approval or permission to train. All scored control groups remain satisfied after adding the new states.

The component evidence is in `reports/corpus-expansion-audit.json`.

## Remaining hard gates

The audit has 24 explicit blockers. Most importantly:

- 9,538,987 more approved training BPE tokens are needed to reach 10M, subject to exact and near deduplication;
- approved science concentration remains 57.1%, above the 35% ceiling;
- approved Nigerian-context material remains 17.8%, below the 30% floor;
- all seven required approved coverage tags remain missing;
- the historical approved corpus still reports exact-only deduplication because it was deliberately not rebuilt;
- held-out evaluation review remains 0/240 for both teacher and safeguarding tracks;
- candidate approval remains 0/54;
- original pilot teacher and safeguarding approval remains 0/96 on each track;
- four conditional-rights items remain training-excluded pending legal approval;
- no candidate or draft may count toward training volume yet; and
- final corpus/tokenizer freeze, benchmark rerun, generation review and separate written owner long-run authorisation have not occurred.

**LONG RUN AUTHORISED: NO.**
