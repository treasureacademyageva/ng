# Original Nigerian primary content authoring

This directory plans school-owned or otherwise expressly licensed original content. It does not contain training-approved text.

`primary-math-english-briefs.csv` contains 96 briefs: eight mathematics and eight English briefs for each of Primary 1–6. The owner selected a balanced first sample covering every brief once. The broader pilot target remains three documents per brief; the full planning target is 40 documents per brief. These are planning numbers, not permission to generate repetitive filler.

`rights-confirmation.json` records the owner's instruction that Treasure Academy Ageva is the rights holder and may use newly created material internally for model work. It does **not** grant an open licence or permit public corpus distribution. `pilot-balanced-v1-review.csv` is the 96-row hash-bound manifest; its text remains unstarted, private and unapproved.

## Authoring rules

- Treasure Academy Ageva is recorded as the responsible creator and rights holder, as directed by the owner. Any individual later claiming human authorship must still be named accurately.
- AI-assisted drafts must be labelled `AI_ASSISTED` and receive full human editing; they must never be labelled human-authored or human-reviewed automatically.
- Do not copy NERDC pages, Nigeria Learning Passport lessons, textbooks, exam banks or web pages without an affirmative compatible licence or written permission.
- Topic names may guide alignment; wording, explanations, examples and exercises must be original.
- Use varied ordinary Nigerian contexts without stereotypes, political persuasion, live school facts or fabricated official claims.
- Never use pupil records, private conversations, parent details, phone numbers, credentials, bank details or real assignment submissions.
- Keep deterministic school facts, payments, authentication, private records and emergency routing outside model training.

## Draft record requirements

Draft documents belong in ignored `data/staging/original-primary-drafts.jsonl`. Every row must eventually record:

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
python3 scripts/build_primary_authoring_queue.py
python3 scripts/validate_primary_authoring_queue.py
python3 scripts/build_primary_pilot_manifest.py
python3 scripts/validate_primary_pilot_manifest.py
```

Because the confirmed right is internal use rather than an open licence, draft text must stay in ignored `data/staging/original-primary-drafts.jsonl` and must not be pushed to the public repository. Only hashes and review metadata belong in the committed pilot manifest.
