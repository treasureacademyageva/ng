# Database setup — Treasure Academy

## Why the site moved to a database

School data that changes over time used to live in two bad places: hard-coded
inside `assets/js/store.js`, and inside each visitor's own browser storage.
Two real problems came out of that:

1. **History was destroyed.** `store.js` deleted every calendar entry older
   than today *on each page load*. The term calendar shrank as the term went
   on, and last term's dates could never be recovered — so the code had to be
   edited again every few weeks just to keep the page looking right.
2. **Every browser had a different school.** What the office typed on the
   admin laptop never reached a parent's phone. There was no single truth.

The SQL in `db/` fixes both. Nothing is deleted on read: rows are closed off
with a status or a date, so the past stays queryable for reports.

---

## Running it (about 3 minutes)

### Supabase (what this project uses)

1. Open your project → **SQL Editor** → **New query**.
2. Paste all of `db/001_schema.sql` → **Run**. Creates the tables.
3. Paste all of `db/002_seed.sql` → **Run**. Loads the current session, the
   five term dates, the admissions window, the fee table and the real staff.
4. **Project Settings → API**, copy the **Project URL** and the **anon public**
   key.
5. On the site: **Portal → Admin → Settings → Cloud sync**, paste both, save.

Both files are safe to run twice — every statement uses `if not exists` or
`on conflict`, so re-running will not duplicate or overwrite your data.

### psql

```bash
psql "$DATABASE_URL" -f db/001_schema.sql
psql "$DATABASE_URL" -f db/002_seed.sql
```

---

## Checking it worked

```sql
select * from calendar_current_session;   -- all 5 dates, past ones flagged is_past
select * from calendar_upcoming;          -- only what is still ahead
select * from admission_windows;          -- the deadline, as data
select * from fee_balances;               -- outstanding fees per pupil
select * from household_by_phone('0803 222 1111');
```

The last one is the important one for admissions: it finds a household by
**either** phone number the parent gave, in **either** format. `+2348032221111`
and `08032221111` resolve to the same account, because the database stores the
last ten digits as `phone_key` and enforces that rule in one place.

---

## What the site does with it

`assets/js/db-live.js` reads the database and hands the data to the existing
pages. It is deliberately defensive:

- **If the database is not configured, nothing changes.** Every read returns
  `null` and the page uses the data `store.js` already gave it. The site works
  exactly as before until you paste the keys in.
- **If the network is slow or down**, reads abort after 6 seconds and fall back
  to a local cache, then to `store.js`. A bad connection in Ageva must never
  produce a blank page.
- **It never writes** to the relational tables and never rejects, so no caller
  needs error handling.

Turning it on is a single step: paste the URL and anon key in Admin → Settings.

---

## Security notes

- **Only the anon public key** ever belongs in site JavaScript. The
  `service_role` key must stay on a server — it bypasses every policy.
- **Row Level Security is enabled by `db/003_policies.sql` — run it.** Until it
  runs, anyone holding the anon key can read pupil names, dates of birth,
  parent phone numbers and fee balances. This was verified, not assumed.
  After it runs: calendar, fees, sessions, news, PTA and staff names stay
  public; pupils, parents, phones, attendance, results, payments and the audit
  log return nothing to the public role.
- Passwords use a `password_hash` column. Never store a plain PIN or password
  in it.

---

## Table map

| Table | Holds | Replaces |
|---|---|---|
| `sessions` | session + term, one current | `SCHOOL_DEFAULTS.session/term` |
| `calendar_events` | every term date, past included | `db.calendar` (which self-deleted) |
| `admission_windows` | opens/deadline dates | "resumption + 14 days" arithmetic |
| `parent_accounts` | one household | `treasure_parent_accounts_v1` |
| `parent_phones` | both numbers, unique per household | phone array on the account |
| `pupils` | children, linked to a household | `db.pupils` |
| `applications` | admission applications | `db.applications` |
| `staff` / `staff_subjects` | staff, including former staff | `db.teachers`, `db.formerTeachers` |
| `attendance`, `results` | per session, never overwritten | `db.attendance`, `db.results` |
| `fee_structure`, `fee_payments` | fees and payments | `SCHOOL_DEFAULTS.fees` |
| `news_posts`, `news_images` | news and events | `db.newsEvents` |
| `pta_meetings`, `pta_attendance` | PTA meetings and RSVPs | `db.pta*` |
| `exam_timetable` | exam papers, past ones kept | `db.exams` |
| `transport_routes` | routes, pickups, fares | `db.transportRoutes` |
| `uniform_items` | uniform price list | `db.uniform` |
| `staff_meetings` | internal staff meetings (private) | `db.meetings` |
| `holiday_assignments` | holiday work per class (private) | `db.holiday` |
| `shop_items` | shop catalogue, prices and stock | `db.shopItems` |
| `audit_log` | who changed what, when | nothing — new |

### Views

| View | Use |
|---|---|
| `calendar_current_session` | calendar page and printed calendar — includes past dates, flagged |
| `calendar_upcoming` | homepage countdown and the chatbot |
| `fee_balances` | expected vs paid vs outstanding, per pupil, current term |
| `exams_current_session` | full exam timetable, past papers flagged |
| `exams_upcoming` | papers still ahead, for countdowns and the chatbot |
| `shop_catalogue` | active shop items, out-of-stock flagged not hidden |

---

## Running the policies (step 3, do not skip)

```
db/001_schema.sql         ->  core tables
db/002_seed.sql           ->  current data
db/003_policies.sql       ->  locks it down   <-- run before connecting the site
db/004_school_content.sql ->  exams, PTA, transport, uniform (+ their policies)
db/005_shop.sql           ->  the school shop: books, stationery, uniform
```

Run them in that order. All four are safe to re-run.

**A trap worth knowing about.** A table is guarded by two separate gates:
`GRANT` decides whether a role may touch it at all, and RLS decides which rows
it then sees. Supabase issues its blanket `grant select on all tables` when the
project is created — *before* these tables exist — so a policy on its own is
not enough and the public pages fail with `permission denied for table
sessions`. `003` and `004` therefore grant explicitly, table by table. This was
found by replaying the real migration order on PostgreSQL 17, not assumed.

Check it worked, in the SQL Editor:

```sql
set role anon;
select count(*) from calendar_events;   -- 5      public, fine
select count(*) from fee_structure;     -- 10     public, fine
select count(*) from pupils;            -- 0      private, blocked
select * from fee_balances;             -- permission denied
reset role;
```

Two things the policies deliberately close, which look like bugs but are not:

- **`fee_balances` and `household_by_phone` are denied to the public.** The
  view joins pupil names to unpaid balances; the function turns a phone number
  into a family. Both are staff tools. `db-live.js` already handles the 403 by
  falling back to local data.
- **Views are set to `security_invoker`.** Without it a view runs with its
  owner's rights and reads straight past RLS — the most common way a locked
  database still leaks.

## Still to do

- Move the portals off `localStorage` onto the database. That needs a real
  login (Supabase Auth, or a small server holding the `service_role` key —
  never in site JavaScript). Until then the private tables are simply
  unreadable from the browser, which is the correct failure mode.
- Migrating the remaining collections (shop, reading log, lost & found) once
  the core is proven in production.
- See `docs/DATA-PRIVACY-FINDING.md` for an open issue about pupil phone
  numbers currently shipped in the public JavaScript.


## The school shop

Prices and stock counts used to live in `assets/js/store.js`. Changing a price
meant editing code and redeploying, and every visitor's browser kept its own
stale copy. The office now edits `shop_items` and the change reaches everyone.

```sql
-- put an item back in stock
update shop_items set qty_in_stock = 20 where id = 'S18';

-- change a price
update shop_items set price_naira = 5000 where id = 'S01';

-- hide an item without deleting its history
update shop_items set is_active = false where id = 'S22';
```

Out-of-stock items are **flagged, not hidden** (`out_of_stock` in
`shop_catalogue`), so a parent still sees the price and can ask to be told when
it returns.

Two things deliberately stay in the site code. **Item photos** are design
assets, not school data, so `db-live.js` keeps the existing picture when it
merges a row. **Category** moved the other way: it used to be a hard-coded list
of item ids in `U.shopCat`, which meant every new item silently became
"Others" until a developer edited that list, so it is a real column now.
