# Where the site stands

Written at commit `91a8e88` on `preview`.

## Measured before / after

| | Before | After |
|---|---|---|
| `assets/img` total | 37 MB | **7.6 MB** |
| Largest single image | 4.1 MB | **< 1 MB** |
| Font payload | 1.06 MB from Google | **100 KB self-hosted** (batch 48 type system) |
| Third-party requests before paint | 2 | **0** |
| Pages with a meta description | 1 of 36 | **35 of 35** |
| Pages with canonical / OG / Twitter / JSON-LD | ~0 | **35 of 35** |
| `sitemap.xml` / `robots.txt` | missing | **31 URLs / present** |
| Images with intrinsic dimensions | 0 | **111** |
| Test suite | 585 pass / 16 fail | **1422 pass / 0 fail** (43 suites) |

## What changed

**Weight.** Every image was re-encoded, not deleted — you said none were unused
and that was correct, all 42 are still referenced. Seventeen were over 1 MB;
none are now.

**Fonts.** Self-hosted woff2 in `assets/fonts/`. Batch 48 replaced the original
Inter / Source Serif 4 pair with Clash Display, General Sans and Spline Sans
Mono, and moved the `@font-face` rules into `corporate.css` (`fonts.css` is gone). The Google Fonts `<link>` is gone from all 39 pages, so nothing
third-party blocks the first paint and no visitor data leaves for a font CDN.

**SEO.** `tools/seo-build.py` writes description, canonical, Open Graph, Twitter
and JSON-LD into each page as static HTML — not injected by JavaScript, so
crawlers that skip scripts still see it. Re-run it after adding or renaming a
page. Portal, developer, receipt, admission-form, search and story pages are
`noindex` and excluded from the sitemap.

**Missing pages.** `404.html` now matches the site shell and offers a search box
seeded from the failed path plus the eight most-wanted pages.

**Installable.** Manifest, favicon, 192/512 icons, a full-bleed maskable icon and
an apple-touch-icon. The service worker precaches the fonts and the 404 page.

**Android.** `docs/ANDROID-APP.md` sets out the Trusted Web Activity route with
the Gradle and manifest config. `.well-known/assetlinks.json` is committed and
served as `application/json`; the signing fingerprint is the one blank to fill
once there is a release key.

## Two layout bugs fixed

The desktop sidebar was overlapping the page content. Two separate causes:

1. The grid assigned `grid-column:2` by listing element types, so the hero
   `<header>` and `.stats-band` were never placed and landed in column 1 under
   the sidebar. Inverted it — everything defaults to column 2, the navbar is
   explicitly column 1.
2. The brand name carried `white-space:nowrap` from the horizontal navbar, making
   the rail 441px wide inside a 266px track. Measured in a real browser, then
   contained.

Also scaled the floating clock on phones, where it sat on top of the hero text
and the *Apply for Admission* button.

Verified in Chromium at 1280px and 390px: no horizontal overflow, no JavaScript
errors, one `h1` per page.

## Tests

The 16 failures that were already there were stale assertions, not bugs — they
pinned counts and data from before the staff/graduates merge and the settings
purge. Each was checked against the current site before being retired, and
counts became floors so new pages stop breaking the suite.

One real harness bug: it executed `<script type="application/ld+json">` as
JavaScript, so adding structured data crashed every suite. JSON-LD is data. If
suites ever crash with `renderEmergency is not a function`, that is this bug
returning — fix the harness, never the site.

`tools/tests/seo.test.js` (57 checks) now guards the metadata, structured data,
sitemap, manifest, image budget, layout stability and accessibility. It fails if
anyone reintroduces a Google Fonts link or commits an image over 1.2 MB.

## Not done yet

- **Chatbot** — waiting on your hints, as agreed.
- **Pricing/feature toggle and comparison table** — the Spaceship pattern worth
  adapting to fees per class. Not started.
- **Custom illustration and icon set** — the site still leans on photography.
- **Shaibu Memunat** — 11th staff member, no role supplied. Still waiting on you;
  not invented.
- **Blurry Common Entrance 2025 rows** — Itofa, Muhammed Kausara, Onimisi.
- `class-feature.jpg` is a placeholder from kogireports.com.

## Please do this

Three GitHub tokens were pasted into our chat. Revoke them at
<https://github.com/settings/tokens> — anyone with them has write access to the
repo.

## Branch

Everything is on `preview` (`91a8e88`). `main` is untouched at `35f1144`, per the
rule that it only moves when you say go live. `preview` contains `main` entirely,
so that merge will fast-forward with no conflicts whenever you want it.
