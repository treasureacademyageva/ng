# Human review handoff

Date: 1 October 2026

Branch scope: `preview` only

Decision: **LONG RUN AUTHORISED: NO**

## What automation has finished

The machine-review and handoff preparation is complete for the current candidate and original pilot sets:

- 54/54 exact candidate items have hash-bound automated pre-review evidence.
- 50 staged candidates have no remaining automated blocker and are packaged for teacher and safeguarding review.
- 4 conditional-rights candidates remain licence-excluded and are packaged for legal review.
- 96/96 AI-assisted original mathematics/English drafts passed deterministic hash, structure, length, privacy-pattern, URL, prohibited-source-claim and exact/near-duplicate checks.
- Private read-only workbooks were generated for each human-review track.
- No human name, role, date, decision, legal opinion or training approval was generated.

Automated pre-review is not curriculum approval, safeguarding approval or legal advice.

## Human workload now ready

| Track | Ready rows | Decision record |
|---|---:|---|
| Candidate licence evidence | 54 | `data/reviews/candidate-intake-review.csv` |
| Candidate teacher review | 50 | `data/reviews/candidate-intake-review.csv` |
| Candidate safeguarding review | 50 | `data/reviews/candidate-intake-review.csv` |
| Conditional-rights legal review | 4 | Licence decision/notes in the candidate packet after advice |
| Original pilot teacher review | 96 | `data/authoring/pilot-balanced-v1-review.csv` |
| Original pilot safeguarding review | 96 | `data/authoring/pilot-balanced-v1-review.csv` |

The separate qualified-language-review track remains owner-deferred for this current experimental corpus only. It is not a substitute for any row above.

## Private reviewer workbooks

Generated workbooks are under ignored `data/staging/review-workbooks/`:

- `candidate-licence-review.html`
- `candidate-teacher-review.html`
- `candidate-safeguarding-review.html`
- `conditional-rights-legal-brief.html`
- `primary-pilot-teacher-review.html`
- `primary-pilot-safeguarding-review.html`

They are read-only briefing material. Their SHA-256 values and section counts are committed in `reports/human-review-handoff.json`; the licensed/internal text itself is not committed to the public repository.

For an easier item-by-item workflow, open `data/staging/review-workbooks/START-REVIEWING.html`. It provides search, progress tracking, role confirmation and JSON export/import for all six tracks. When served by `scripts/serve_review_portal.py`, each saved review is validated and written directly to private ignored workspace storage, avoiding blocked clipboard/download controls. Static exports still require chat validation before repository import. See `REVIEW-START-HERE.md`.

## Required recording rules

For every non-pending teacher or safeguarding decision, record:

1. the real reviewer’s name;
2. the exact required role;
3. a real review date;
4. `APPROVED`, `CHANGES_REQUIRED` or `REJECTED`; and
5. notes whenever changes are required.

Do not type decisions into the generated HTML. Record them in the relevant CSV against the exact content hash. If text changes, its hash changes and prior decisions must be reset until the revised text is reviewed.

Candidate licence approval must apply to the exact item and revision. Public access is not permission to train. The two CC BY-SA and two US-public-domain items stay excluded unless appropriate legal review clears their Nigerian/model-use implications.

## Correct review order

1. Complete candidate licence review; retain exclusion wherever rights remain uncertain.
2. Conduct teacher and safeguarding reviews independently.
3. Revise `CHANGES_REQUIRED` content and regenerate its hash-bound packet.
4. Re-review changed text; never carry a decision across a changed hash.
5. Grant final training approval only when all required gates for that exact item pass.
6. Rebuild the corpus and tokenizer only after the complete approved set is frozen.
7. Repeat the protected 100-step benchmark only after all data gates pass.
8. Seek a separate written owner decision for any long run.

## What is needed from the owner later

No additional data or decision is needed merely to preserve the current safe state. Progress beyond the present gate eventually requires the owner to appoint or provide access to:

- a qualified Nigerian primary teacher;
- the designated safeguarding lead; and
- an appropriate legal reviewer for the four conditional-rights items.

Until those real reviews are recorded, every candidate and original draft remains outside training.

**LONG RUN AUTHORISED: NO.**
