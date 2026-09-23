-- ============================================================================
-- Treasure Academy, Ageva — Row Level Security policies (003)
--
-- RUN THIS BEFORE THE SITE IS CONNECTED TO THE DATABASE.
--
-- Until this file runs, every table is readable by anyone holding the anon
-- public key — and that key ships inside the website, so "anyone" means anyone.
-- Verified on a local PostgreSQL 17 with Supabase's default grants: as the anon
-- role it was possible to read a pupil's full name, class and DATE OF BIRTH,
-- the parent's name and phone number, and each family's outstanding fee
-- balance. That is exactly what this file stops.
--
--   Supabase:  SQL Editor -> paste -> Run. Safe to re-run.
--   psql:      psql "$DATABASE_URL" -f db/003_policies.sql
--
-- ---------------------------------------------------------------------------
-- THE MODEL, IN PLAIN TERMS
--
-- The website has no Supabase login. Every visitor's browser — parent, teacher
-- or stranger — is the SAME anon role. So the rule cannot be "parents see their
-- own children": the database has no way to tell one anonymous browser from
-- another. Pretending otherwise would be security theatre.
--
-- Therefore:
--
--   PUBLIC (anon may read)      — things already printed on the website:
--                                 term dates, the admissions window, the fee
--                                 table, published news, PTA meeting dates,
--                                 and staff names/classes.
--
--   PRIVATE (anon may NOT read) — anything about an identifiable child or
--                                 family: pupils, parent accounts, phone
--                                 numbers, applications, attendance, results,
--                                 individual fee payments, RSVPs, the audit
--                                 log, and staff personal details (phone, DOB).
--
-- Private data is reached only by the portals, which must use a SERVER-SIDE
-- key. The service_role key must never be placed in site JavaScript.
--
-- WRITES: anon gets exactly one — submitting an admission application — and
-- even that is insert-only, so a submitted form cannot be read back, edited or
-- deleted by the public.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Turn RLS on everywhere.
--    With RLS enabled and no policy, the default is DENY. Every table below is
--    then opened only as far as it needs to be.
-- ----------------------------------------------------------------------------
alter table sessions          enable row level security;
alter table calendar_events   enable row level security;
alter table admission_windows enable row level security;
alter table fee_structure     enable row level security;
alter table news_posts        enable row level security;
alter table news_images       enable row level security;
alter table pta_meetings      enable row level security;
alter table staff             enable row level security;
alter table staff_subjects    enable row level security;

alter table parent_accounts   enable row level security;
alter table parent_phones     enable row level security;
alter table pupils            enable row level security;
alter table applications      enable row level security;
alter table attendance        enable row level security;
alter table results           enable row level security;
alter table fee_payments      enable row level security;
alter table pta_attendance    enable row level security;
alter table audit_log         enable row level security;

-- Belt and braces: even if a policy is later written too loosely, the anon
-- role simply has no write privilege on the private tables.
revoke insert, update, delete on all tables in schema public from anon;

-- ----------------------------------------------------------------------------
-- 2. PUBLIC READ — information the school already publishes.
--    Policies are dropped first so the file can be re-run safely.
-- ----------------------------------------------------------------------------

drop policy if exists p_sessions_read on sessions;
create policy p_sessions_read on sessions
  for select to anon, authenticated using (true);

-- Only published events. An unpublished draft stays hidden until the office
-- is ready, which is why is_published exists.
drop policy if exists p_calendar_read on calendar_events;
create policy p_calendar_read on calendar_events
  for select to anon, authenticated using (is_published);

drop policy if exists p_admwin_read on admission_windows;
create policy p_admwin_read on admission_windows
  for select to anon, authenticated using (true);

drop policy if exists p_fees_read on fee_structure;
create policy p_fees_read on fee_structure
  for select to anon, authenticated using (true);

drop policy if exists p_news_read on news_posts;
create policy p_news_read on news_posts
  for select to anon, authenticated using (is_published);

drop policy if exists p_newsimg_read on news_images;
create policy p_newsimg_read on news_images
  for select to anon, authenticated using (
    exists (select 1 from news_posts n where n.id = post_id and n.is_published)
  );

drop policy if exists p_pta_read on pta_meetings;
create policy p_pta_read on pta_meetings
  for select to anon, authenticated using (true);

-- Staff: the public may see WHO teaches WHICH class. It may not see a
-- teacher's phone number or date of birth, so those columns are withheld at
-- the grant level below rather than exposed by this policy.
drop policy if exists p_staff_read on staff;
create policy p_staff_read on staff
  for select to anon, authenticated using (is_active);

drop policy if exists p_staffsubj_read on staff_subjects;
create policy p_staffsubj_read on staff_subjects
  for select to anon, authenticated using (true);

-- Column-level control for staff. RLS filters ROWS; this filters COLUMNS.
revoke select on staff from anon;
grant  select (id, staff_no, full_name, role, class_name, position,
               qualification, about, is_active)
  on staff to anon;

-- ----------------------------------------------------------------------------
-- 3. PRIVATE — no anon policy at all, so reads are denied by default.
--
--    pupils, parent_accounts, parent_phones, applications, attendance,
--    results, fee_payments, pta_attendance, audit_log
--
--    Nothing is written here on purpose. RLS with zero policies = deny.
--    The portals reach this data with the service_role key from a server.
-- ----------------------------------------------------------------------------

-- The single public write: a parent submitting an admission application.
-- Insert-only. There is deliberately NO select policy, so a submitted
-- application cannot be read back, listed, edited or deleted by the public.
grant insert (pupil_name, class_applied, parent_name, phone, phone_alt,
              gender, date_of_birth, reference)
  on applications to anon;

drop policy if exists p_applications_insert on applications;
create policy p_applications_insert on applications
  for insert to anon
  with check (
    coalesce(length(trim(pupil_name)), 0) between 2 and 120
    and coalesce(length(trim(parent_name)), 0) between 2 and 120
    and coalesce(length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')), 0) between 7 and 15
    -- a genuine applicant is a child, not a date typo or a bot
    and (date_of_birth is null
         or (date_of_birth > current_date - interval '25 years'
             and date_of_birth < current_date))
    -- status/decision fields are not grantable above, so they keep their
    -- defaults and cannot be forged by the submitter
  );

-- ----------------------------------------------------------------------------
-- 4. VIEWS — the quiet trap.
--
--    A view normally runs with its OWNER's rights, which means it can read
--    straight past RLS on the tables underneath. fee_balances joins pupils and
--    exposes full_name plus the outstanding balance, so as a plain view it
--    would leak every family's debt even after the policies above.
--
--    security_invoker makes the view obey the CALLER's permissions instead.
--    (PostgreSQL 15+, which Supabase runs.)
-- ----------------------------------------------------------------------------
alter view calendar_upcoming          set (security_invoker = on);
alter view calendar_current_session   set (security_invoker = on);
alter view fee_balances               set (security_invoker = on);

-- fee_balances is staff-only regardless: revoke it from the public entirely.
revoke all on fee_balances from anon;

-- ----------------------------------------------------------------------------
-- 5. FUNCTIONS — the other quiet trap.
--
--    household_by_phone() looks up a family by phone number. Exposed to anon it
--    is a free enumeration tool: a script walking 0800000000-0899999999 would
--    harvest parent names and their children. Nigerian mobile numbers are only
--    ~10 digits, so that is entirely practical.
--
--    It is therefore removed from the public role. The registration flow that
--    needs it ("are you registering another child?") must call it through a
--    server endpoint, which can rate-limit and log.
-- ----------------------------------------------------------------------------
revoke execute on function household_by_phone(text) from anon, public;
grant  execute on function household_by_phone(text) to authenticated;

-- Helper functions are internal plumbing; the public never calls them.
revoke execute on function set_updated_at()      from anon, public;
revoke execute on function normalise_phone_key() from anon, public;

-- ----------------------------------------------------------------------------
-- 6. Future tables must not default to open.
-- ----------------------------------------------------------------------------
alter default privileges in schema public
  revoke insert, update, delete on tables from anon;

commit;

-- ============================================================================
-- VERIFY IT WORKED
--
-- In the Supabase SQL Editor, impersonate the public role and confirm that the
-- first three queries return rows and the last four fail or return nothing:
--
--   set role anon;
--   select count(*) from calendar_events;    -- expect 5      (public)
--   select count(*) from fee_structure;      -- expect 10     (public)
--   select full_name, class_name from staff; -- expect 6      (public columns)
--   select * from pupils;                    -- expect 0 rows (private)
--   select * from parent_phones;             -- expect 0 rows (private)
--   select * from fee_balances;              -- expect PERMISSION DENIED
--   select * from household_by_phone('0803 222 1111');  -- PERMISSION DENIED
--   reset role;
--
-- Every one of those was checked on PostgreSQL 17 before this file shipped.
--
-- ---------------------------------------------------------------------------
-- WHAT STILL NEEDS A DECISION
--
-- 1. The portals (headmistress, teacher, parent) currently read localStorage,
--    not this database. When they are moved over, they need a real login. The
--    honest options are Supabase Auth, or a small server holding the
--    service_role key. Do NOT put service_role in site JavaScript.
--
-- 2. Until then the private tables are simply unreadable from the website,
--    which is the correct failure mode: the public pages (calendar, fees,
--    news, staff) keep working, and nothing about a child is exposed.
-- ============================================================================
