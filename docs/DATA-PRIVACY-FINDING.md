# Data privacy finding — needs the owner's decision

**Status:** open. Found during the batch 45 audit. **Not fixed automatically,
because the fix deletes real data about real children and that is the owner's
call, not mine.**

---

## What is exposed

`assets/js/store.js` is a public file. Anyone can open

```
https://<the-site>/assets/js/store.js
```

in a browser, with no login, and read it. It currently contains the 2025
graduating class as hard-coded records:

| Field in the file | Count | Rendered on the site? |
|---|---|---|
| Full names of pupils | 39 | **Yes** — alumni.html (this is intended) |
| Common Entrance scores + exam numbers | 39 | **Yes** — alumni.html (intended) |
| **Guardian phone numbers** | **39** | **No — never displayed anywhere** |
| **Dates of birth** | 39 | Only partially (alumni.html uses `g.dob`) |

Verified by:

```bash
curl -s https://<the-site>/assets/js/store.js | grep -oE 'phone:"0[0-9]{10}"' | wc -l   # -> 39
```

## Why it matters

The phone numbers and full dates of birth of **39 named children** are
published to anyone who looks, and the numbers are **not used by a single page**
— no template reads `g.phone`. They are pure exposure with zero functional
benefit: a list of names, ages and reachable guardian numbers, downloadable by
strangers, scrapers and bots.

For a school site this is the kind of thing a parent could reasonably complain
about, and it is the sort of detail that damages trust in the school rather
than in the website.

## Recommended fix (one line each, ~2 minutes)

Strip the two unused fields from the graduate records in `assets/js/store.js`:

- delete `phone:"…"` from all 39 graduate entries — nothing references it
- reduce `dob:"2016-01-05"` to the birth **year** only, if alumni.html needs an
  age band; otherwise delete it too

Names, exam numbers and scores can stay: those are the alumni roll the school
intends to celebrate publicly.

Anything the office genuinely needs to keep (guardian contacts for past pupils)
belongs in the database behind a login — `db/001_schema.sql` already has a
`pupils` table with `status = 'graduated'` for exactly this.

## Also worth knowing

Every seeded staff and pupil account in the same public file uses the PIN
`1234` (26 occurrences). Those are demo credentials, but if any real member of
staff has kept the default, their portal is effectively open. Recommend forcing
a PIN change on first login before the site is promoted to parents.

## Why I did not just do it

The standing rule on this project is *real data comes from the owner, and be
very careful when deleting*. Removing 39 children's records — even just two
fields — is a data decision, not a code cleanup. Say the word and it is a
two-minute change.
