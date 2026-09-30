# Human review instructions

These files are approval records, not annotation suggestions. An automated system may prepare a packet, but it must never fill a human decision, reviewer identity, role or date.

## Evaluation review tracks

Every one of the 240 held-out cases needs two independent decisions:

1. `evaluation-teacher-review.csv` — a qualified Nigerian primary-school teacher checks curriculum accuracy, age level, wording, Nigerian context, expected action and expected answer.
2. `evaluation-safeguarding-review.csv` — the designated safeguarding lead checks child safety, privacy, credentials, harmful requests, payment integrity, escalation and refusal behaviour.

Allowed `decision` values:

- `PENDING` — not reviewed; leave reviewer fields blank.
- `APPROVED` — acceptable as written.
- `CHANGES_REQUIRED` — not acceptable; explain the required correction in `notes`.

For `APPROVED` or `CHANGES_REQUIRED`, enter the reviewer's real name, the exact required role, and an ISO date such as `2026-10-03`. Never put contact details, credentials, pupil names or private records in a review file.

Required roles:

- teacher packet: `qualified_nigerian_primary_teacher`
- safeguarding packet: `designated_safeguarding_lead`

If a case changes later, its SHA-256 changes and the packet builder resets its prior decision to `PENDING`. Rebuild and validate with:

```bash
python3 scripts/build_human_review_packets.py
python3 scripts/validate_human_reviews.py
```

## Staged Storybooks Nigeria review

The pinned importer maintains four review packets:

- `storybooks-nigeria-english-review.csv` — 29 commercial-compatible stories;
- `storybooks-nigeria-pidgin-review.csv` — 7 commercial-compatible stories;
- `storybooks-nigeria-hausa-review.csv` — 4 commercial-compatible stories;
- `storybooks-nigeria-yoruba-review.csv` — 6 commercial-compatible stories.

A qualified Nigerian primary teacher and the safeguarding lead must each review every story through its `source_url`. Nigerian Pidgin, Hausa and Yoruba additionally require the matching qualified-speaker decision in `language-source-review.csv`. All applicable decisions must be `APPROVED` before a story can be proposed for `sources.json`. A changed story hash resets preserved decisions when staging is rebuilt.

## Nigerian-language source review

`language-source-review.csv` covers Hausa (`ha`), Yoruba (`yo`), Igbo (`ig`), Ebira (`igb`) and Nigerian Pidgin (`pcm-NG`). A source may not become training-approved until its row is `APPROVED` by a qualified speaker using the exact role below:

- `qualified_hausa_speaker`
- `qualified_yoruba_speaker`
- `qualified_igbo_speaker`
- `qualified_ebira_speaker`
- `qualified_nigerian_pidgin_speaker`

The reviewer checks extraction order, meaning, spelling/orthography, dialect suitability, age fit and unsafe or discriminatory content. A language decision does not replace teacher or safeguarding review.

## Independence and conflict handling

A reviewer may request changes instead of guessing. Any disagreement should remain `CHANGES_REQUIRED` until the responsible reviewers resolve it. Aggregate test scores cannot override a failed human safety or curriculum decision.
