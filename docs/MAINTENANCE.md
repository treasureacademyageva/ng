# Maintenance notes

Working notes for whoever picks this up next. Read `README.md` first.

## What this is

Static website and portals for Treasure Academy, Ageva, Okene, Kogi State.
Deployed on Vercel (preset "Other", no build command, output `./`).

Work lands on `preview`. Merge to `main` only when the school signs off.

## Data model — the one thing to get right

There are two separate concepts and they must not be merged:

| Purpose | Where | Notes |
|---|---|---|
| Login accounts | `db.teachers`, `db.pupils` | Demo accounts, PIN `1234`. Portal access only. |
| Public records | `db.staffWall`, `db.graduates` | Real names from the school's filing. Display only, no credentials. |

The staff wall, staff search, profile popups and the graduates wall all read the
display arrays. `store.js` migrates legacy pupils with `class: "Graduated"` into
`db.graduates` on load.

`db.formerTeachers` is intentionally empty. Real former staff names come from the
school; do not invent entries.

## Content rules the school set

- Real data only. Never invent a name, date or result.
- WhatsApp contact is 09063932487 and nothing else.
- No online assignment submission.
- Birthdays cover staff and the headmistress, not pupils.
- CBT exists only as Common Entrance practice for Primary 6.
- Fees are paid by bank transfer to the school account.
- Keep the file count low. Delete what is no longer used.
- School identity — name, term, session, key dates — lives in code, not in an
  admin form. It was deliberately removed from the admin UI.

## Accreditation strip

The marks above the footer link to the issuing bodies: Kogi State Government,
Kogi MoEST, NAPPS, NYSC, and the Common Entrance body. Centre code BS/OKN/141.
These are real references — keep the links pointing at the official sites.

## Versioning

Asset URLs carry `?v=YYYYMMDD-NN`, the service worker uses a matching
`treasure-vNN`, and `developer.html` exposes the same string as `BUILD`. When you
bump one, bump all three or the service worker will serve stale files.

## Tests

`bash tools/run-all-tests.sh` — 904 checks.

`tools/tests/regression-NN.test.js` are behaviour suites, numbered by the round
that introduced them. They are deliberately strict about the current data, so
when the school changes real data an assertion may go red: check whether the site
or the test is wrong before editing either.

`tools/tests/seo.test.js` guards metadata, the image payload budget, layout
stability and accessibility. It fails if someone adds a Google Fonts link, ships
an image over 1.2 MB, or adds a page without a description.

Some suites walk the repo looking for stale version strings. They skip `tools/`,
because the test files themselves contain old version strings as literals.

## Known gaps

- Shaibu Memunat appears on the staff filing with no role or qualifications.
  Needs details from the school before being added to `db.staffWall`.
- Three Common Entrance 2025 score rows (Itofa, Muhammed Kausara, Onimisi) were
  transcribed from a blurry photograph and need checking against a clearer copy.
- `class-feature.jpg` is a stock news photograph of a Kogi public school, used as
  a stand-in until the school supplies real classroom photography.
- Supabase is wired in `sync.js` but has no project credentials yet.
- Payments are manual. See `moniepoint-payments-plan.md`.
