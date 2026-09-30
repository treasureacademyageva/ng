# Original Nigerian primary content authoring

This directory plans school-owned or otherwise expressly licensed original content. It does not contain training-approved text.

`primary-math-english-briefs.csv` contains 96 briefs: eight mathematics and eight English briefs for each of Primary 1–6. The pilot target is three documents per brief; the full planning target is 40 documents per brief. These are planning numbers, not permission to generate repetitive filler.

## Authoring rules

- A named author must write or take responsibility for each draft.
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
- named author, creator type (`HUMAN` or `AI_ASSISTED`) and creation date;
- owner licence confirmation;
- teacher and safeguarding decisions with real reviewer names, roles and dates; and
- `approved_for_training`, which must remain false until every required decision passes.

A completed brief or draft still does not authorise training. The final corpus must pass licensing, private-data, exact/near-duplicate, balance, teacher and safeguarding gates.

Build and validate the queue:

```bash
python3 scripts/build_primary_authoring_queue.py
python3 scripts/validate_primary_authoring_queue.py
```
