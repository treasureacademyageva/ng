# Maintenance notes

Read this before changing anything. It records the owner's rules, the parts of
the build that are easy to break by accident, and the things that have already
been broken more than once.

## Owner rules (do not override)

- **Real data only.** Never invent a pupil, staff member, date or result. If the
  information is missing, it waits for the owner.
- WhatsApp number is **09063932487**. Nothing else.
- No online assignment submission.
- Birthdays: staff and headmistress only.
- CBT exists only as Primary 6 Common Entrance practice.
- Professional look: **no pill navigation, no hamburger**. Desktop sidebars are
  fine.
- Day and dark token colours both supported.
- Payments are bank transfer to the school account. No card flow on the site.
- Keep the site simple. Remove files that are genuinely not needed — but check
  first, see "Before deleting anything".
- Offer suggestions each round; the owner approves or rejects each one.
- School identity (name, term, session, dates) is **code-managed** in
  `assets/js/store.js` (`SCHOOL_DEFAULTS`). It is deliberately not editable from
  the admin UI.

## Branches

All work lands on `preview`. `main` moves only when the owner says "go live".
As of this writing `main` is live and contains everything through the batch-48
merge.

## Setup

```bash
npm install                 # jsdom, needed by every test suite
python3 -m http.server 8080 # serve from the repo root
bash tools/run-all-tests.sh # 1417 checks across 43 suites
```

`node_modules/` is gitignored **and** stripped by workspace snapshots. If every
suite reports `CRASH`, that is the cause — run `npm install` and try again.

## Things that keep breaking

These have each regressed more than once. Check them after any pull or merge.

**1. Version pins in tests.** Assertions used to hardcode `treasure-v47`, so
every bump broke 19 suites at once. They are regex-based now
(`/treasure-v\d+/`). The only exceptions are the `no stale -NN versions`
guards, which must keep looking for their own specific old version — that is
the whole point of the check.

**2. Test walkers recursing into `tools/`.** The walkers scan the repo for old
version strings. If `tools` is not in the exclusion list they match the version
strings inside the test files themselves and fail. Exclusion list must be
`node_modules`, `.git`, `tools`.

**3. JSON-LD executed as JavaScript.** The harnesses collect `script:not([src])`
and eval the contents. A `<script type="application/ld+json">` block is data,
not code; if it is evaluated, every suite dies with
`renderEmergency is not a function`. Fix the harness selector — never delete
the structured data to make the error go away.

**4. `motion.css` getting unlinked.** It carries the skip link, focus-visible
rings and the `prefers-reduced-motion` collapse. Two separate rewrites have
dropped the `<link>` from every page. It must load **last**, after
`corporate.css`. Check with `grep -l motion.css *.html | wc -l` (expect 36;
`developer.html` is exempt).

**5. Image compression being undone.** `assets/img` belongs at roughly 8MB.
A rewrite restored 28 uncompressed originals and pushed it back to 37MB.
`seo.test.js` fails if the folder exceeds 12MB or any single file exceeds
1.2MB, so the suite will tell you.

**6. The public sidebar grid.** At `min-width:1100px` the body becomes a
`266px + 1fr` grid. Placement is written as a **default** — everything goes to
column 2 and `.navbar` is pulled back to column 1. Do not rewrite it as a list
of element types; that is what put the hero `<header>` and `.stats-band`
underneath the sidebar. The rail also needs `min-width:0; max-width:100%` and a
wrapping brand name, or the nowrap heading makes it 441px wide in a 266px track.

**7. `verify-batch4.js` hardcoding `/home/user/mums-school-website/`.** It has
come back twice. Paths derive from `SITE`.

**8. `sw.js` precaching fonts that no longer exist.** `addAll` rejects if any
entry 404s, so a font rename silently disables offline support. After changing
the type system, update the `CORE` list.

## Adding or renaming a page

```bash
python3 tools/seo-build.py
```

Idempotent. Writes description, canonical, Open Graph, Twitter and JSON-LD into
each page as static HTML (not injected by JS, so crawlers that skip scripts
still see it) and regenerates `sitemap.xml`. Private pages — `developer`,
`receipt`, `admission-form`, `search`, `story` — are `noindex` and excluded from
the sitemap. Add new private pages to `NOINDEX` in that script.

## Version bump ritual

Bump all four together or the service worker serves stale files:

1. `sw.js` — the `CACHE` constant
2. asset query strings — `?v=YYYYMMDD-NN` across all HTML
3. `developer.html` — the `BUILD` string
4. `README.md` — two places

Current: **v48**.

## Data model

Keep these separate. They are not the same people and must never be merged.

- `db.teachers` — 7 demo login accounts, PIN 1234, portal only.
- `db.staffWall` — 10 real staff (W01–W10), display only, no accounts.
- `db.pupils` — demo accounts.
- `db.graduates` — 39 real Common Entrance graduates (2025: 21, exam numbers
  BS/OKN/141001–021; 2023: 18).
- `formerTeachers` — intentionally empty.

## Accreditation strip

Kogi State Government, Kogi MoEST, NAPPS, NYSC, Common Entrance. Centre code
**BS/OKN/141**. The badges link to the official sites.

## Before deleting anything

Check the file is referenced nowhere first:

```bash
grep -rlF "filename.ext" --include=*.html --include=*.css --include=*.js \
  --include=*.json . --exclude-dir=node_modules --exclude-dir=.git
```

For fonts, also confirm in a real browser which faces are actually downloaded —
a `@font-face` can exist for a family that no stack references. Every image in
`assets/img` is currently in use; there is nothing to remove there.

## Known gaps

- **Shaibu Memunat** — 11th staff member, role not supplied. Waiting on the
  owner. Do not guess.
- Common Entrance 2025 rows for **Itofa**, **Muhammed Kausara** and **Onimisi**
  came from a blurry photograph and need confirming.
- `class-feature.jpg` is a placeholder sourced from kogireports.com.
- Backlog: Supabase credentials, Moniepoint backend, map latitude/longitude,
  tour video, custom domain, the "TREASURE COLLEGE" naming question, absent-alert
  automation.
- Chatbot: the owner is supplying hints; nothing final has been built.
