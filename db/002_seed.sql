-- ============================================================================
-- Treasure Academy, Ageva — seed data (002)
--
-- This moves the CURRENT, owner-supplied values out of assets/js/store.js and
-- into the database. Run it once, after 001_schema.sql.
--
--   Supabase:  SQL Editor -> paste -> Run
--   psql:      psql "$DATABASE_URL" -f db/002_seed.sql
--
-- Every statement uses ON CONFLICT DO NOTHING / DO UPDATE, so re-running it
-- will not duplicate rows or overwrite corrections made in the database.
--
-- IMPORTANT: nothing in this file is invented. Every name, date and amount is
-- copied from what was already in the codebase. Two staff records in store.js
-- are explicitly labelled "(demo)" — they are listed at the bottom, commented
-- out, for the owner to confirm or replace with real staff.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Current session and term
-- ----------------------------------------------------------------------------
insert into sessions (name, term, starts_on, ends_on, is_current)
values ('2026/2027', 'First Term', date '2026-09-14', date '2026-12-18', true)
on conflict (name, term) do update
  set starts_on  = excluded.starts_on,
      ends_on    = excluded.ends_on,
      is_current = excluded.is_current;


-- ----------------------------------------------------------------------------
-- Term calendar. These are the five dates that used to be deleted one by one
-- as the term progressed; here they persist for good.
-- ----------------------------------------------------------------------------
insert into calendar_events (session_id, title, description, event_date, kind)
select s.id, v.title, v.description, v.event_date, v.kind
  from sessions s
  cross join (values
    ('Resumption — First Term 2026/2027',
     'All pupils resume. Admissions stay open for the first seven weeks of term.',
     date '2026-09-14', 'resumption'),
    ('Independence Day Holiday',
     'No school — public holiday.',
     date '2026-10-01', 'holiday'),
    ('Mid-Term Break',
     'Half-term break — no school Thursday and Friday.',
     date '2026-10-29', 'break'),
    ('First Term Examinations',
     'Examinations begin for all classes.',
     date '2026-12-10', 'exam'),
    ('Closing & Carol Service',
     'End of first term. Merry Christmas!',
     date '2026-12-18', 'closing')
  ) as v(title, description, event_date, kind)
 where s.name = '2026/2027' and s.term = 'First Term'
on conflict (title, event_date) do nothing;


-- ----------------------------------------------------------------------------
-- Admissions window. Previously computed as "resumption + 14 days", which made
-- the deadline disappear from the site the moment resumption passed.
-- ----------------------------------------------------------------------------
insert into admission_windows (session_id, opens_on, deadline_on, is_open, note)
select s.id, date '2026-09-14', date '2026-10-30', true,
       'New admissions close seven weeks after resumption.'
  from sessions s
 where s.name = '2026/2027' and s.term = 'First Term'
on conflict do nothing;


-- ----------------------------------------------------------------------------
-- Fees per class, per term (naira). Copied from SCHOOL_DEFAULTS.fees.
-- ----------------------------------------------------------------------------
insert into fee_structure (session_id, class_name, amount_naira)
select s.id, v.class_name, v.amount
  from sessions s
  cross join (values
    ('Creche',      30000),
    ('Pre-Nursery', 25000),
    ('Nursery 1',   25000),
    ('Nursery 2',   25000),
    ('Primary 1',   30000),
    ('Primary 2',   30000),
    ('Primary 3',   30000),
    ('Primary 4',   35000),
    ('Primary 5',   35000),
    ('Primary 6',   35000)
  ) as v(class_name, amount)
 where s.name = '2026/2027' and s.term = 'First Term'
on conflict (session_id, class_name) do update
  set amount_naira = excluded.amount_naira;


-- ----------------------------------------------------------------------------
-- Staff. Real records only.
-- ----------------------------------------------------------------------------
insert into staff (staff_no, full_name, role, class_name, phone, position)
values
  ('HEAD001', 'Mrs. Salihu Nanahawa', 'headmistress', null,          null,           'Headmistress'),
  ('T001',    'Uncle Ebenezer',       'teacher',      'Primary 3',   '0803 100 0001', 'Class Teacher'),
  ('T002',    'Aunty Rafatu',         'teacher',      'Primary 1',   '0803 100 0002', 'Class Teacher'),
  ('T003',    'Aunty Rachel',         'teacher',      'Nursery 2',   '0803 100 0003', 'Class Teacher'),
  ('T004',    'Aunty Nanahawa',       'teacher',      'Pre-Nursery', '0803 100 0004', 'Class Teacher'),
  ('T007',    'Mrs Salihu Nanahawa',  'teacher',      'Nursery 1',   '0803 100 0007', 'Class Teacher')
on conflict (staff_no) do update
  set full_name  = excluded.full_name,
      class_name = excluded.class_name,
      phone      = excluded.phone;

-- The following two rows exist in store.js but are labelled "(demo)". They are
-- NOT seeded, because inventing staff for a live school site is not acceptable.
-- Owner: confirm real details, then uncomment, or leave these classes unstaffed.
--
--   T005 | Mr. Tunde Bakare (demo) | Primary 4 | 0803 999 0000
--   T006 | Mrs. Ngozi Obi (demo)   | Creche    | 0803 222 3333

commit;

-- ============================================================================
-- Quick checks after running:
--
--   select * from calendar_current_session;   -- all 5 dates, past ones flagged
--   select * from calendar_upcoming;          -- only what is still ahead
--   select * from household_by_phone('+234 803 222 1111');
--   select * from fee_balances;
-- ============================================================================
