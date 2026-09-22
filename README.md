# Treasure Academy, Ageva — website and school portal

Static site plus three portals for **Treasure Academy, Ageva, Okene, Kogi State**.
No framework, no build step: plain HTML, CSS and JavaScript, deployed on Vercel.

Start with **`docs/MAINTENANCE.md`** — it holds the owner's content rules and the
list of things that have regressed more than once.

## Run it locally

```bash
npm install                      # jsdom, for the test suites
python3 -m http.server 8080      # static site, no build step
```

Then open <http://localhost:8080>.

If every test reports `CRASH`, `node_modules` is missing — run `npm install`.

## Layout

```
*.html              37 public pages, including 404.html
portal/             admin, teacher, pupil and login screens
assets/css/         main, extra, corporate, motion  (motion.css loads last)
assets/js/          store.js (data), site.js (behaviour), sync.js (Supabase stub)
assets/fonts/       5 self-hosted woff2 faces
assets/img/         photography and icons, about 8MB in total
tools/              seo-build.py, run-all-tests.sh, tests/
docs/               MAINTENANCE.md, HANDOVER.md, ANDROID-APP.md and planning notes
```

## Public pages

Home, About, Academics, Admissions, Admission form, Alumni and graduates,
Anthem, Birthdays, Board, Calendar, Careers, Class, Contact, E-learning, Exams,
Fees, Holiday, Homework, Lost and found, News, Open day, Photo day, Poster, PTA,
Reading, Receipt, Search, Shop, Story, Support, Testimonials, Transport,
Uniform, Volunteer, Welcome, and a branded 404.

## Portals

Login lives at `portal/login.html` and routes to one of three screens.

| Role | Screen | Demo credentials |
|---|---|---|
| Pupil / parent | `portal/pupil.html` | `0805 111 2222` / `1234` |
| Pupil, no password set | `portal/pupil.html` | `0805 555 6666` |
| Teacher | `portal/teacher.html` | `0803 100 0001`, PIN `1234` |
| Headmistress | `portal/admin.html` | `HEAD001`, PIN `1234` |

These are demo accounts for testing. Real staff records are a separate list —
see the data model section in `docs/MAINTENANCE.md`; the two must never be
merged.

## Data

Everything lives in the browser's `localStorage`, seeded from
`assets/js/store.js`. `SCHOOL_DEFAULTS` at the top of that file holds the real
school identity (name, term, session, dates) and is code-managed on purpose —
it is deliberately not editable from the admin UI.

`assets/js/sync.js` is a Supabase sync layer with no credentials wired in. It is
a separate piece of work and only proceeds when the owner approves it.

## Tests

```bash
bash tools/run-all-tests.sh
```

1417 checks across 43 suites: 42 behaviour suites covering batches 2–44, plus
`seo.test.js`, which guards metadata, structured data, the sitemap, the
manifest, the image budget, layout stability and accessibility. Suites are
discovered from disk, so a new `tools/tests/verify-batchNN.js` or `*.test.js` is
picked up automatically.

## SEO

```bash
python3 tools/seo-build.py
```

Run this after adding or renaming a page. It writes description, canonical, Open
Graph, Twitter and JSON-LD tags into each page as static HTML and regenerates
`sitemap.xml`. Writing it statically rather than injecting it with JavaScript
means crawlers that skip scripts still see it. The script is idempotent.

Private pages — developer console, receipt, admission form, search and story —
are `noindex` and excluded from the sitemap.

## Deploying

Vercel, preset "Other", no build command, output directory `./`, no environment
variables. `vercel.json` handles clean URLs, caching tiers, security headers and
the 404 fallback.

Work lands on the `preview` branch. `main` moves only when the owner says
"go live".

## Version bumps

Four places move together, or the service worker serves stale files:
`sw.js` cache name, the `?v=` query strings across the HTML, the `BUILD` string
in `developer.html`, and this file. Current build: **v48**.

## Payments roadmap

Bank transfer to the school account is the only method on the site today.
Card and transfer automation through Moniepoint/Monnify was researched in
September 2026 and is deliberately not built yet: it needs a backend, because
secret keys must never sit in site JavaScript. Notes and the integration plan
are in `docs/moniepoint-payments-plan.md`.

## Still to do

- Chatbot — the owner is supplying the content hints.
- Custom illustration and icon set; the site currently leans on photography.
- Android app — groundwork and the Trusted Web Activity route are written up in
  `docs/ANDROID-APP.md`.
- Supabase credentials, a Moniepoint backend, map coordinates, a tour video and
  a custom domain.
