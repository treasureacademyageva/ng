# Start reviewing here

The private interactive portal is:

`model/data/staging/review-workbooks/START-REVIEWING.html`

Ask in chat: **“Open the review portal.”** The portal can be surfaced directly in the workspace viewer.

## How to review

1. Open the portal.
2. Select a review track from the left-hand menu.
3. Use the search box or item list to choose a document.
4. Read its metadata, review prompts and—where relevant—the full text.
5. Enter your real name, confirm the required role, select the real review date and choose a decision.
6. Add clear notes, especially for anything needing correction.
7. Tick the confirmation only if you genuinely hold the stated role and reviewed the exact SHA-256 item.
8. Press **Save this review** before moving on.
9. Export progress regularly. Download the JSON where possible, or copy the visible export text.
10. Attach the exported JSON in chat and say: **“Validate and import these reviews.”**

The portal cannot edit repository CSV files by itself. This separation prevents accidental or fabricated approvals. Exported decisions are checked against the track, reviewer role and exact content hash before import.

## What each decision means

- `PENDING` — not yet reviewed, or you do not personally hold the required reviewer role.
- `APPROVED` — the exact item can pass this one review track without changes.
- `CHANGES_REQUIRED` — potentially usable, but the notes must list the required corrections.
- `REJECTED` — unsuitable for this use; explain why.
- Legal-track decisions use `CLEARED`, `NOT_CLEARED` and `MORE_INFORMATION_REQUIRED`. Legal clearance is not teacher, safeguarding or training approval.

## If you are the owner but not the named specialist

You may read items and add preliminary notes while leaving the decision `PENDING`. Do not tick the role confirmation or select `APPROVED` unless you genuinely hold that required role:

- `qualified_nigerian_primary_teacher`
- `designated_safeguarding_lead`
- `authorised_licence_reviewer`
- `qualified_legal_counsel`

Owner comments are useful, but they do not count as the specialist approval.

## Suggested order

1. Start with **Original pilot teacher review** in small batches, such as one Primary class at a time.
2. Complete **Original pilot safeguarding review** independently.
3. Review the 50 staged candidate texts on the teacher and safeguarding tracks.
4. Complete candidate licence evidence review.
5. Leave the four conditional-rights items excluded until qualified legal counsel reviews them.
6. Export after every batch and attach the JSON in chat for validation and import.

## Review focus

### Teacher

Check topic fit, facts, calculations, answer keys, Primary-class difficulty, clarity, progression and usefulness in a Nigerian classroom. Record every correction precisely.

### Safeguarding

Check age fit, dignity, inclusion, stereotypes, distress, unsafe activities and requests for pupil, family, location, contact or financial information.

### Licence

Confirm that the licence applies to the exact item/revision, permits the intended use, and has correct attribution. Public availability alone is not permission.

### Legal

Assess CC BY-SA downstream obligations and Nigerian-jurisdiction treatment of US-public-domain claims. Do not extend advice beyond its recorded assumptions and scope.

## Saving progress

The portal tries to save progress in the browser. The workspace preview may restrict browser storage or downloads, so keep the page open and export frequently. If a button is blocked, select the displayed JSON manually and paste it into chat.

No review in the portal grants final training approval automatically. Changed text receives a new hash and must be reviewed again.

**LONG RUN AUTHORISED: NO.**
