# Treasure Academy — Site Handover (baruwa to the next agent)

## What this is
Static school website + staff/headmistress/pupil portals for **Treasure Academy, Ageva, Okene, Kogi State, Nigeria**.
Hosted on Vercel (preset "Other", no build command, output `./`, no env vars). Repo: github.com/treasureacademyageva/ng — work goes to the `preview` branch first; merge to `main` only when the owner says "go live". Never push straight to main.

## Current state (batch 42, `?v=20260919-42`, sw `treasure-v42`)
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
