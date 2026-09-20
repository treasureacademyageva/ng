# Project state — Treasure Academy (repo `treasureacademyageva/ng`)

Updated 2026-09-20. Repo restructured to a single canonical site tree; all tests green.

## How to run it

```bash
npm install                    # jsdom — needed only for the tests
python3 -m http.server 8080    # static site, no build step
bash tools/run-all-tests.sh    # full regression suite
```

Plain static HTML/CSS/JS — **no framework, no bundler, no build step.**
Serve over HTTP, not `file://`, or localStorage/fetch misbehave.

## Test suite

**832 checks passed, 0 failed** (batches 2–22).

Tests now live in `tools/tests/` and locate the site themselves via
`SITE = path.resolve(__dirname, '..', '..')`, so they work from any checkout
path with no symlink and no hardcoded `/home/user`.

Two summary formats exist in the batch files (`==== N passed ====` and
`BATCHn: N passed`); `tools/run-all-tests.sh` handles both, so a naive grep
reporting "crashes" is a false alarm.

## Structure — ONE copy of the site

```
/  (repo root = the website)
├── index.html  about.html  news.html  story.html  contact.html  … (30 pages)
├── portal/      login.html  admin.html (168 KB)  teacher.html  pupil.html
├── assets/css/  main.css  extra.css  corporate.css
├── assets/js/   store.js (66 KB, localStorage "database")
│                site.js  (80 KB, theme/chatbot/clock/sliders/captcha)
├── assets/img/  38 images
├── docs/        SUPABASE-SETUP.md  moniepoint-payments-plan.md
├── tools/       run-all-tests.sh  tests/verify-batch2..22.js  render-test.js  verify2.js
├── sw.js  supabase-schema.sql
└── README.md  PROJECT-STATE.md  package.json
```

Data lives in the browser via `localStorage` (`DB` in `store.js`). Nothing is
shared across devices yet.

## Demo logins

| Role | ID | Password |
|---|---|---|
| Pupil (has password) | `0805 111 2222` | `1234` |
| Pupil (no password — OTP flow) | `0805 555 6666` | — |
| Teacher | `0803 100 0001` | PIN `1234` |
| Headmistress | `HEAD001` | PIN `1234` |

## What changed in this cleanup

1. **Deleted the duplicate site tree.** `mums-school-website/` was a byte-for-byte
   copy of the root (verified: 79/79 files identical, 0 missing, 0 differing — so
   nothing was lost). Every edit previously had to be applied twice or the copies
   drifted. GitHub Pages was **not** enabled and there were no deploy configs, so
   nothing was serving from that folder.
2. **Resolved the stale-test conflict.** `verify-batch14/15/16.js` existed in two
   versions. Proven which was current by running them: the `tools/tests/` copies
   **failed** against today's site (expecting retired `TA/2023/001` logins and
   cache `v17`), while the root copies passed (phone logins, `v20`). Kept the root
   versions, moved all test files into `tools/tests/`.
3. **Removed hardcoded paths.** Every test pointed at `/home/user/mums-school-website`.
   Now self-locating, so a fresh clone runs the suite anywhere.
4. **Fixed self-referential test scans.** Batch 14/15 walkers flagged the *test
   files* as stale because those files contain old version strings as literals.
   Walkers now skip `tools/`, `node_modules/`, `.git/`.
5. **Hardened three more walkers.** Batches 10/12/13 recursed into `node_modules`
   collecting `.html` files — harmless only because that folder didn't exist when
   the tests were written. Now excluded.
6. **Fixed a real 404** (earlier session): `testimonials.html` loaded
   `assets/js/data.js`, which never existed in any commit. Removed the dead tag.
7. **Moved planning docs to `docs/`.** Batch 19 asserts the Monnify roadmap is out
   of the site root. Rather than delete 196 lines of research, it moved to
   `docs/` alongside the Supabase setup guide.
8. **Added `.gitignore`** — repo had none, so `node_modules/` (~100 MB) was one
   `git add .` from being committed.
9. **Removed a leftover temp file** (`check-testi.tmp.js`) whose cleanup was
   skipped when a previous command timed out.

## Verified after restructure

- 769/769 checks pass.
- All 17 sampled routes return HTTP 200 (pages, portals, CSS, JS, images, `sw.js`).
- Zero broken internal links; zero missing asset references.

## Known open items

- **Supabase not wired.** `supabase-schema.sql` + `docs/SUPABASE-SETUP.md` exist,
  but there's no `supabase.js` client. Needs your project URL + anon key.
- **Payments not built.** `docs/moniepoint-payments-plan.md` has the full Monnify
  plan; needs a backend. Secret keys must never live in site JS.
- **Placeholder content.** "Treasure Academy" is a placeholder name, and several
  sections read "coming soon" (school tour video, exam timetable, open day date,
  alumni spotlight, staff birthdays).
- **`package.json`** still has `"name": "user"` and `"main": "render-test.js"`.
