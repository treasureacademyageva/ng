# Treasure Academy — Site Handover (baruwa to the next agent)

## What this is
Static school website + staff/headmistress/pupil portals for **Treasure Academy, Ageva, Okene, Kogi State, Nigeria**.
Hosted on Vercel (preset "Other", no build command, output `./`, no env vars). Repo: github.com/treasureacademyageva/ng — work goes to the `preview` branch first; merge to `main` only when the owner says "go live". Never push straight to main.

## Current state (batch 48, `?v=20260919-48`, sw `treasure-v48`)
Batch 43 additions (owner-directed): "Treasure Sans" (Sora-based) + "Treasure Serif" (Fraunces-based) self-hosted in `assets/fonts/` — Google Fonts CDN removed from all 40 pages; a real studio-commissioned font can replace those files later with zero code change. Treasure FX layer at end of `site.js`: button ripple, segmented `.seg` tabs with sliding ink (graduates now toggle All/2025/2023), `[data-countup]` animated stat numbers, `.tilt` 3D-hover cards, `.stag-grid` staggered reveals, `.spy-bar` scroll-spy jump nav (alumni has one). Brand motif = `--motif` inline SVG diamond-seed in corporate.css (applied to section tags). Owner is bringing a brand designer's artwork later — drop files in and reference them; no AI/stock imagery permitted per owner.
- **40 pages**: 36 root + 4 portal (admin/teacher/pupil + login). Page-count pins in verify-batch9/10 = 40.
- **Accounts vs public display (IMPORTANT, owner demanded b42):**
  - `db.teachers` = the 7 DEMO login accounts (PIN 1234) — portal logins only.
  - `db.staffWall` = the REAL 10 staff from the school's filing (W01–W10: Idris Ibrahim … Bose Momoh, School Administrator). Display only — NO pins, NO logins. The alumni staff wall, collage, search, search engine, and staff popups read this.
  - `db.pupils` = demo pupils (kept).
  - `db.graduates` = the REAL 39 Common Entrance graduates seeded from Kogi Ministry papers: Class of 2025 (21, with exam numbers BS/OKN/141001–021 + ENG/MAT/GEP/total) and Class of 2023 (18). Display only.
  - Migrations in store.js move any legacy `class:"Graduated"` pupil rows into `graduates`.
  - `formerTeachers` seed empty — real former staff names come from the owner (chat), never invented.
- **Footer accreditation strip**: real marks fetched from official sources — Kogi Govt (kogistate.gov.ng), Kogi MoEST (moest.kogistate.gov.ng), NAPPS (nappsng.org), NYSC (nysc.gov.ng), CE crest (same ministry). They LINK to those official sites (owner decision) with target=_blank rel=noopener. CE note under strip: centre BS/OKN/141.
- **Staff Code of Conduct**: sidebar page in teacher (10th) + admin (above Settings, 22 sections total) portals; first-login must-accept modal (no decline), acceptance stored (`teacher.cocA/cocAt`, `school.cocA/cocAt`).
- **Code-managed identity**: school name/term/session/dates are NOT editable in admin UI (purged b39); owner dictates changes in chat → code.
- **Voting**: no vote buttons on the public wall (b42). Legacy `window.voteTeacher(id)` still records toward the headmistress' Teacher-of-Term tally (admin can crown).
- JS docs/best practice: all new public records → display arrays (staffWall/graduates), accounts stay minimal.

## Quality system
- 40 suites: `verify-batch2.js … verify-batch41.js` in workspace root (not in repo). FRESH total after every batch: run all, sum "passed". Latest: **1307 checks, 0 failures** (b42).
- Run from /home/user: `npm install jsdom --no-audit --no-fund` first each session.
- Version pins inside ~17 suites (b15, b26–b41): sed `treasure-vNN` + `20260919-NN` on every bump; sw.js `treasure-vNN`; developer.html `var BUILD`. README ×2 with fresh sum.
- Data-truth asserts retire whenever owner changes data (b8 T007 Nursery 1, b9 Aunty Rafatu votes, b14 sort order = Creche first/Bose last, b40/b41 wall semantics).

## Owner standing rules (short list)
Real data from owner only (never invent names/dates); WhatsApp 09063932487 only; no online assignment submission; birthdays staff+headmistress only; CBT only as Primary 6 CE practice; professional look, no pills nav, no hamburger (sidebars OK desktop); day+dark token colors; payments = bank transfer to school account; keep site simple — delete unneeded files; suggestions each round (owner approves/rejects each).

## Open items for next rounds
- Shaibu Memunat (11th name on staff filing) — no role/quals given; owner must send details → add to staffWall (suggested Nursery 2).
- CE 2025 score rows for Itofa, Muhammed Kausara, Onimisi were blurry — correct on owner's clearer photo.
- Purge round 2 still unanswered (admin tabs to remove, owner replies numbers).
- BACKLOG: private Supabase, Moniepoint backend, map lat/long (ask owner), tour video, custom domain, TREASURE COLLEGE naming phase, absent-alert automation (backend phase).
- OWNER_IMAGES: upload real staff/group photos → drop into teacher profiles + staff group slot (class-feature.jpg currently a Kogi public-school news photo from kogireports.com).


## Batch 44 additions (launch readiness, owner-directed)
- SEO: every one of the 35 public pages carries unique meta description + canonical + Open Graph + Twitter card + theme-color + manifest/apple-touch links (marker `<!-- treasure-seo -->`); School JSON-LD on index; `robots.txt` (portal + developer disallowed) + `sitemap.xml` (35 URLs, generated per release date); portal pages all `noindex,nofollow`.
- PWA/app-readiness: `site.webmanifest` + icon-192/180/512 (for the future Kotlin/Gradle WebView app — start_url `/index.html`, standalone display).
- `404.html` (branded, noindex, links home/admissions/contact/portal).
- fees.html comparative pricing zone ("Compare fees at a glance", Per term/Per year seg tabs + 5 class bands + "Every fee covers" grid) — spaceship.com-inspired DNA per owner.
- Type scale polish (page-hero clamp headlines, tracking).
- CLEANUP NOTE: the 10 shop-*.jpg demo images LOOK unreferenced but are runtime shop-inventory photos pinned by verify-batch4 — NEVER delete assets/img/shop-*.jpg (restored after accidental deletion).
- Suite loaders now exclude ld+json scripts: `script:not([src]):not([type="application/ld+json"])` globally — preserve when writing new suites.
- 404.html page -> site total = 41 pages; b9/b10 walk pins = 41.


## Batch 46 additions (owner corrections + repo reconciliation)
- Staff Code of Conduct rewritten FAITHFULLY — the paper's 20 numbered rules, plain numbered list, no cards, no categories, "Sign — Management" (owner rejected the earlier categorized-card version).
- tools/tests in the repo now carries the LIVE suites: verify-batch2.js … verify-batch44.js (removed stale regression-02..23). tools/run-all-tests.sh runs them from the repo root: `npm install jsdom --no-audit --no-fund && bash tools/run-all-tests.sh`.
- Preview→main PR opened as release bundle; merge to main still owner-commanded ("go live").
- Version now `20260919-46` / sw `treasure-v46`.


## Batch 47 additions (owner's typography brief + go-live)
- Type system swap (owner's trio): **Gidole** (real files, body/UI/nav) · **Sabon stack** (headings — loaded libre EB-Garamond-family files named "Garamond Libre", Sabon remains first fallback for licensed owners) · **Northwell stack** (signatures only — loaded libre Kristi files; class .sig). Old Treasure Sans/Serif font files REMOVED (retired deliberately; keep assets/fonts minimal).
- Application map: body/nav/buttons/forms = Gidole · h1/h2/sec-heads/hero/anthem = Garamond stack · .sig only for signatures (CoC "Sign — Management" uses it) · script/script font must NEVER be used for UI.
- PR #1 (preview→main) merged on owner's explicit command = GO LIVE. Main = production from here.


## Batch 48 additions (owner font decision: end of Google-catalog fonts)
- Owner rejected Google-catalog fonts entirely ("all those treasure fonts were replicas of Google fonts"). Type system now **100% Indian Type Foundry (fontshare.com, real designer foundry, free for commercial use, NOT on Google Fonts)**: **Clash Display 500/600** (headings), **General Sans 400/500** (body/UI), **Spline Sans Mono 400** (kickers, `.sec-tag` everywhere, and `.sig` sign-offs). The previous Gidole/Garamond/Kristi files were retired deliberately.
- Human-studio finish: mono kicker labels, `text-wrap:balance` headlines, 70ch measure on section intros, body line-height 1.55, weight discipline (body 400/500, headings 500/600 only).
- `.sig` now renders in mono-italic (studio document style) — not a playful script.
- Files live in assets/fonts/ (5 woff2). Rule holds: any new font must NOT be from Google Fonts or its mirrors; check with the owner before adding type families.
