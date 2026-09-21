# Treasure Academy, Ageva

Website and school portal for Treasure Academy — a Creche to Primary 6 school in
Ageva, Okene, Kogi State, Nigeria.

*Our God is able.*

## Running it

Static HTML, CSS and JavaScript. There is no build step and no framework.

```bash
npm install                    # jsdom, for the test suite only
python3 -m http.server 8080    # then open http://localhost:8080
```

Serve it over HTTP. Opening `index.html` straight off disk breaks `localStorage`
and the service worker.

## Layout

```
/                     36 public pages + 404.html
portal/               login, pupil, teacher, admin (headmistress)
assets/css/           main, extra, corporate, fonts, motion
assets/js/            store.js (data layer)  site.js (UI)  sync.js (Supabase)
assets/fonts/         self-hosted woff2 — no third-party font CDN
assets/img/           photography and artwork
docs/                 setup notes and the payments plan
tools/                seo-build.py, run-all-tests.sh, tests/
```

### Data

`store.js` holds everything in `localStorage` under a single `DB` object, with
migrations that run on load. `sync.js` pushes to Supabase when it is configured.

Two rules the data model depends on:

- **Accounts** (`db.teachers`, `db.pupils`) exist to log in. They are demo
  accounts with PIN `1234`.
- **Public records** (`db.staffWall`, `db.graduates`) are display-only — real
  names from the school's filing, with no login attached. Anything shown on a
  public page belongs here.

Never mix the two. Adding a real staff member to `db.teachers` would create a
working login for someone who never asked for one.

## Tests

```bash
bash tools/run-all-tests.sh
```

904 checks across 23 behaviour suites plus `verify-seo.js`, which guards the
metadata, payload budget and accessibility rules that quietly rot when pages get
added. Run it before every commit.

## SEO

Page metadata is generated, not hand-maintained:

```bash
python3 tools/seo-build.py
```

It writes descriptions, canonicals, Open Graph and Twitter tags and JSON-LD into
each page, then regenerates `sitemap.xml`. The script is idempotent, so running
it twice is safe. **Add a new page → add its description to `DESC` in that
script → run it.** Pages listed in `NOINDEX` stay out of search and the sitemap.

Metadata is written into the HTML rather than injected by JavaScript, because
crawlers that skip scripts still need to read it.

## Deployment

Vercel, preset "Other", no build command, output directory `./`. `vercel.json`
sets cache and security headers and serves `404.html` for unknown paths.

## Conventions

- Fonts are self-hosted. Do not add a Google Fonts `<link>` — the SEO suite fails
  the build if one appears.
- Every `<img>` needs `width`/`height` or an `aspect-ratio`, plus `alt`.
- Images below the fold get `loading="lazy"`; the hero image gets
  `fetchpriority="high"`.
- Keep `assets/img` under 12 MB. Re-encode before committing anything large.
- Motion goes in `motion.css` and must survive `prefers-reduced-motion`.
- School identity (name, term, session, dates) lives in code, not in an admin
  form.

## Demo logins

| Role | ID | Password |
|---|---|---|
| Pupil | `0805 111 2222` | `1234` |
| Pupil, no password set | `0805 555 6666` | — |
| Teacher | `0803 100 0001` | `1234` |
| Headmistress | `HEAD001` | `1234` |

## Still to do

- Supabase project credentials, so portal data syncs across devices.
- Payments roadmap — school fees by transfer today; Monnify (Moniepoint Group)
  for online collection later. Full plan in `docs/moniepoint-payments-plan.md`.
  Needs a backend first: Monnify secret keys must never sit in site JavaScript.
- Real photographs of staff and pupils to replace the current stand-ins.
- Custom domain.
