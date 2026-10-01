# Original Nigerian primary content authoring

This directory plans school-owned or otherwise expressly licensed original content. It does not contain training-approved text.

`primary-math-english-briefs.csv` contains 96 briefs: eight mathematics and eight English briefs for each of Primary 1–6. The owner selected a balanced first sample covering every brief once. The broader pilot target remains three documents per brief; the full planning target is 40 documents per brief. These are planning numbers, not permission to generate repetitive filler.

`rights-confirmation.json` records the owner's instruction that Treasure Academy Ageva is the rights holder and may use newly created material internally for model work. It does **not** grant an open licence or permit public corpus distribution. `pilot-balanced-v1-review.csv` is the 96-row hash-bound manifest. All 96 rows reference deterministic private `AI_ASSISTED` drafts and have passed automated structure/hash/length/privacy-pattern/URL/source-claim/deduplication checks. Teacher, safeguarding and training decisions remain pending/unapproved.

## NAPPS alignment

The owner confirmed that the school uses the NAPPS syllabus. `napps-alignment-sources.json` records the online evidence and unresolved provenance questions. `napps-primary-english-mathematics-alignment.csv` indexes the newest publicly viewable Primary 1–6 series found: 328 English/Mathematics schedule rows across all classes and terms, last modified 19 December 2025.

The publisher is not NAPPS, and the public NAPPS website does not expose an edition-checkable Primary scheme. The index was cross-checked against the September 2025 Federal Ministry of Education subject structure and NERDC's competency-based implementation strategy. The owner authorised it for original authoring, so rows are `READY_FOR_ORIGINAL_AUTHORING`, but they are not claimed to be NAPPS-issued. The index has no source lesson text and is never training data. See `../../NAPPS-ALIGNMENT.md`.

## Authoring rules

- Treasure Academy Ageva is recorded as the responsible creator and rights holder, as directed by the owner. Any individual later claiming human authorship must still be named accurately.
- AI-assisted drafts must be labelled `AI_ASSISTED` and receive full human editing; they must never be labelled human-authored or human-reviewed automatically.
- Do not copy NERDC pages, Nigeria Learning Passport lessons, textbooks, exam banks or web pages without an affirmative compatible licence or written permission.
- Topic names may guide alignment; wording, explanations, examples and exercises must be original.
- Use varied ordinary Nigerian contexts without stereotypes, political persuasion, live school facts or fabricated official claims.
- Never use pupil records, private conversations, parent details, phone numbers, credentials, bank details or real assignment submissions.
- Keep deterministic school facts, payments, authentication, private records and emergency routing outside model training.

## Draft record requirements

Draft documents belong in ignored `data/staging/authoring/pilot-v1-drafts.jsonl`. Every row records:

- unique document ID and linked `brief_id`;
- title, subject, Primary class and coverage tag;
- language (`en-NG`) and Nigerian-context flag;
- text and text SHA-256;
- responsible creator, creator type (`HUMAN` or `AI_ASSISTED`) and creation date;
- owner rights confirmation;
- teacher and safeguarding decisions with real individual reviewer names, roles and dates; and
- `approved_for_training`, which must remain false until every required decision passes.

A completed brief or draft still does not authorise training. The final corpus must pass licensing, private-data, exact/near-duplicate, balance, teacher and safeguarding gates.

Build and validate the queue and the selected balanced pilot:

```bash
python3 scripts/fetch_napps_alignment.py
python3 scripts/validate_napps_alignment.py
python3 scripts/build_primary_authoring_queue.py
python3 scripts/validate_primary_authoring_queue.py
python3 scripts/build_primary_pilot_manifest.py
python3 scripts/generate_primary_pilot_drafts.py
python3 scripts/pre_review_primary_pilot.py
python3 scripts/validate_primary_pilot_manifest.py
python3 scripts/prepare_human_review_handoff.py
```

Because the confirmed right is internal use rather than an open licence, draft text stays in ignored `data/staging/authoring/pilot-v1-drafts.jsonl` and is not pushed to the public repository. The generator makes the private text reproducible from the briefs; only hashes and review metadata belong in the committed pilot manifest. Read-only reviewer workbooks stay under ignored `data/staging/review-workbooks/`; see `../../HUMAN-REVIEW-HANDOFF.md`.
