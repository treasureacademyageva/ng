-- ============================================================================
-- Treasure Academy, Ageva — remaining school content (004)
--
-- WHY THIS EXISTS
-- 001/002 moved the term calendar, fees, sessions and staff into the database.
-- This file finishes the job for the rest of the content that goes stale:
--
--   exam timetable        — dated, and the exams page filters to future rows
--   PTA meetings          — dated, drives the chatbot and the pupil portal
--   staff meetings        — dated; the seeded one is already in the past
--   holiday assignments   — dated; both seeded rows are already in the past
--   transport routes      — priced, changes with fuel
--   uniform price list    — priced, changes every session
--
-- The holiday and meeting rows in store.js expired on 2026-09-16 and
-- 2026-09-12. Nothing crashed, but they are stale content that has to be
-- hand-edited in JavaScript every term. That is the pattern this migration
-- removes: dated rows belong in a table with a session attached, not in code.
--
--   Supabase:  SQL Editor -> paste -> Run
--   psql:      psql "$DATABASE_URL" -f db/004_school_content.sql
--
-- Run AFTER 001 and 002. Run 003_policies.sql again afterwards, or run the
-- policy block at the end of this file, so the new tables are not left open.
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. EXAM TIMETABLE
--    One row per paper. Kept after the date passes so last term's timetable
--    can still be printed and checked.
-- ----------------------------------------------------------------------------
create table if not exists exam_timetable (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade,
  subject     text not null,
  sits_on     date not null,
  starts_at   text,                         -- '8:00 AM' as printed
  classes     text,                         -- 'Primary 1-6'
  venue       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint exam_unique_slot unique (session_id, subject, sits_on, starts_at)
);

create index if not exists exam_by_date on exam_timetable (sits_on);

drop trigger if exists trg_exam_updated on exam_timetable;
create trigger trg_exam_updated before update on exam_timetable
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. STAFF MEETINGS  (internal — never public)
-- ----------------------------------------------------------------------------
create table if not exists staff_meetings (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete set null,
  title       text not null,
  meets_on    date not null,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. HOLIDAY ASSIGNMENTS
-- ----------------------------------------------------------------------------
create table if not exists holiday_assignments (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete set null,
  class_name  text not null,
  subject     text not null default 'General',
  instruction text not null,
  set_on      date not null default current_date,
  due_on      date,
  created_at  timestamptz not null default now()
);

create index if not exists holiday_by_class on holiday_assignments (class_name);

-- ----------------------------------------------------------------------------
-- 4. TRANSPORT ROUTES
-- ----------------------------------------------------------------------------
create table if not exists transport_routes (
  id          uuid primary key default gen_random_uuid(),
  route_name  text not null unique,
  pickup      text,
  fee_naira   numeric(12,2) not null default 0 check (fee_naira >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_transport_updated on transport_routes;
create trigger trg_transport_updated before update on transport_routes
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. UNIFORM PRICE LIST
-- ----------------------------------------------------------------------------
create table if not exists uniform_items (
  id          uuid primary key default gen_random_uuid(),
  item_name   text not null unique,
  note        text,
  price_naira numeric(12,2) not null check (price_naira >= 0),
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_uniform_updated on uniform_items;
create trigger trg_uniform_updated before update on uniform_items
  for each row execute function set_updated_at();


-- ============================================================================
-- SEED — real values copied from assets/js/store.js. Nothing invented.
-- ============================================================================

-- Exam timetable ------------------------------------------------------------
insert into exam_timetable (session_id, subject, sits_on, starts_at, classes)
select s.id, v.subject, v.sits_on, v.starts_at, v.classes
  from sessions s
  cross join (values
    ('Mathematics',      date '2026-11-30', '8:00 AM',  'Primary 1-6'),
    ('English Language', date '2026-11-30', '10:30 AM', 'Primary 1-6'),
    ('Basic Science',    date '2026-12-01', '8:00 AM',  'Primary 1-6'),
    ('Social Studies',   date '2026-12-01', '10:30 AM', 'Primary 1-6'),
    ('C.R.S',            date '2026-12-02', '8:00 AM',  'Primary 1-6'),
    ('Creative Arts',    date '2026-12-02', '10:30 AM', 'Primary 1-6')
  ) as v(subject, sits_on, starts_at, classes)
 where s.name = '2026/2027' and s.term = 'First Term'
on conflict (session_id, subject, sits_on, starts_at) do nothing;

-- PTA meeting (pta_meetings was created in 001) -------------------------------
insert into pta_meetings (session_id, title, meets_on, venue)
select s.id, 'First Term General Meeting', date '2026-10-04', 'School Hall, 10:00 AM'
  from sessions s
 where s.name = '2026/2027' and s.term = 'First Term'
   and not exists (
     select 1 from pta_meetings m
      where m.title = 'First Term General Meeting' and m.meets_on = date '2026-10-04');

-- Staff meeting ---------------------------------------------------------------
insert into staff_meetings (session_id, title, meets_on, notes)
select s.id, 'Welcome Back Staff Meeting', date '2026-09-12',
       'Resumption review, duty roster, and first-term targets. All class teachers should submit weekly plans every Monday.'
  from sessions s
 where s.name = '2026/2027' and s.term = 'First Term'
   and not exists (
     select 1 from staff_meetings m
      where m.title = 'Welcome Back Staff Meeting' and m.meets_on = date '2026-09-12');

-- Holiday assignments ---------------------------------------------------------
insert into holiday_assignments (session_id, class_name, subject, instruction, set_on)
select s.id, v.class_name, v.subject, v.instruction, v.set_on
  from sessions s
  cross join (values
    ('Primary 6', 'Mathematics',
     'Revise multiplication tables up to 12x12. First 20 questions of the Common Entrance practice booklet.',
     date '2026-09-16'),
    ('Primary 4', 'English Language',
     'Read one storybook and write 8 new words with their meanings.',
     date '2026-09-16')
  ) as v(class_name, subject, instruction, set_on)
 where s.name = '2026/2027' and s.term = 'First Term'
   and not exists (
     select 1 from holiday_assignments h
      where h.class_name = v.class_name and h.set_on = v.set_on and h.subject = v.subject);

-- Transport routes ------------------------------------------------------------
insert into transport_routes (route_name, pickup, fee_naira)
values
  ('Route A - Adavi',      'Adavi Junction bus stop', 5000),
  ('Route B - Okene Town', 'Okene Central Mosque',    6000),
  ('Route C - Ageva',      'School gate, Ageva',      3000)
on conflict (route_name) do update
  set pickup = excluded.pickup, fee_naira = excluded.fee_naira;

-- Uniform price list ----------------------------------------------------------
insert into uniform_items (item_name, note, price_naira, sort_order)
values
  ('School Shirt (white)',   'Ages 2-12, all classes',       4500, 1),
  ('Shorts / Skirt (green)', 'Boys shorts, girls skirt',     4000, 2),
  ('School Cardigan',        'Green with crest',             6000, 3),
  ('Sportswear Set',         'For Fridays and sports days',  7500, 4),
  ('School Sandals',         'Black, all sizes',             5000, 5),
  ('Socks (pair)',           'White with green stripes',     1200, 6),
  ('School Beret',           'Girls, all classes',           2500, 7),
  ('School Bag',             'With Treasure Academy crest',  8000, 8)
on conflict (item_name) do update
  set note = excluded.note, price_naira = excluded.price_naira;


-- ============================================================================
-- VIEWS
-- ============================================================================

-- Exams still ahead, for the countdown and the chatbot.
create or replace view exams_upcoming as
  select e.* from exam_timetable e
    left join sessions s on s.id = e.session_id
   where e.sits_on >= current_date and (s.is_current or s.id is null)
   order by e.sits_on, e.starts_at;

-- The whole timetable for the current session, past papers flagged rather
-- than hidden, so the printed timetable stays complete.
create or replace view exams_current_session as
  select e.*, (e.sits_on < current_date) as is_past
    from exam_timetable e
    left join sessions s on s.id = e.session_id
   where s.is_current or s.id is null
   order by e.sits_on, e.starts_at;


-- ============================================================================
-- POLICIES for the new tables — keeps the 003 model intact.
--   public : exams, PTA, transport, uniform  (already printed on the website)
--   private: staff meetings, holiday assignments (internal/classroom)
-- ============================================================================

alter table exam_timetable      enable row level security;
alter table transport_routes    enable row level security;
alter table uniform_items       enable row level security;
alter table staff_meetings      enable row level security;
alter table holiday_assignments enable row level security;

drop policy if exists p_exams_read on exam_timetable;
create policy p_exams_read on exam_timetable
  for select to anon, authenticated using (true);

drop policy if exists p_transport_read on transport_routes;
create policy p_transport_read on transport_routes
  for select to anon, authenticated using (is_active);

drop policy if exists p_uniform_read on uniform_items;
create policy p_uniform_read on uniform_items
  for select to anon, authenticated using (is_active);

-- staff_meetings and holiday_assignments deliberately get NO anon policy:
-- RLS on with no policy = deny. Staff reach them with a server-side key.

-- RLS decides WHICH ROWS a role may see; the GRANT decides whether the role
-- may touch the table at all. Supabase's default grant only covered the tables
-- that existed when it ran, so tables created by this migration need the grant
-- explicitly - without it even the public ones return "permission denied".
grant select on exam_timetable, transport_routes, uniform_items
  to anon, authenticated;
grant select on exams_upcoming, exams_current_session
  to anon, authenticated;

-- The private pair is NOT granted, so it is denied twice over: no grant and
-- no policy.
revoke select on staff_meetings, holiday_assignments from anon;

-- Views must obey the caller, not their owner, or they read past RLS.
alter view exams_upcoming        set (security_invoker = on);
alter view exams_current_session set (security_invoker = on);

revoke insert, update, delete on
  exam_timetable, transport_routes, uniform_items,
  staff_meetings, holiday_assignments
  from anon;

commit;

-- ============================================================================
-- VERIFY
--
--   set role anon;
--   select count(*) from exam_timetable;       -- 6   public
--   select count(*) from transport_routes;     -- 3   public
--   select count(*) from uniform_items;        -- 8   public
--   select count(*) from staff_meetings;       -- 0   private
--   select count(*) from holiday_assignments;  -- 0   private
--   reset role;
--
--   select * from exams_upcoming;              -- papers still ahead
--   select * from exams_current_session;       -- all papers, past flagged
-- ============================================================================
