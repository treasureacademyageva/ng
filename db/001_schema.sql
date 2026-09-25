-- ============================================================================
-- Treasure Academy, Ageva — database schema (001)
--
-- WHY THIS EXISTS
-- School data that changes over time (term dates, news, exams, PTA meetings,
-- admissions) used to live inside assets/js/store.js and inside each visitor's
-- browser localStorage. Two problems followed from that:
--
--   1. History was destroyed. store.js pruned every calendar entry older than
--      today on each page load, so the term calendar shrank as the term went
--      on and last term's dates could never be recovered or reported on.
--   2. Every browser held its own copy. Two parents could see two different
--      "schools", and nothing the office typed on one device reached another.
--
-- This schema is the single source of truth instead. Nothing is deleted on
-- read: rows are closed off with archived_at / status so the past stays
-- queryable, which is what a school needs for reports and audits.
--
-- HOW TO RUN IT
--   Supabase:  SQL Editor -> paste this file -> Run. Safe to re-run.
--   psql:      psql "$DATABASE_URL" -f db/001_schema.sql
--
-- Written for PostgreSQL (Supabase). Every statement is idempotent, so running
-- it twice will not damage existing data.
-- ============================================================================

begin;

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Helper: keep updated_at honest without relying on the application layer.
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;


-- ============================================================================
-- 1. SCHOOL IDENTITY AND SESSIONS
-- Identity is code-managed per the owner's rule, but the ACTIVE SESSION and
-- TERM must be data: they change three times a year and drive every date
-- calculation on the site.
-- ============================================================================

create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,               -- '2026/2027'
  term          text        not null,               -- 'First Term'
  starts_on     date        not null,
  ends_on       date        not null,
  is_current    boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint sessions_unique     unique (name, term),
  constraint sessions_date_order check (ends_on >= starts_on)
);

-- Exactly one current term, enforced by the database rather than by hoping the
-- admin UI behaves.
create unique index if not exists sessions_one_current
  on sessions (is_current) where is_current;

drop trigger if exists trg_sessions_updated on sessions;
create trigger trg_sessions_updated before update on sessions
  for each row execute function set_updated_at();


-- ============================================================================
-- 2. TERM CALENDAR  — the table that fixes the shrinking-calendar bug
-- Past events are KEPT. Queries choose what to show; storage never forgets.
-- ============================================================================

create table if not exists calendar_events (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references sessions(id) on delete set null,
  title         text        not null,
  description   text        not null default '',
  event_date    date        not null,
  ends_on       date,                                -- multi-day breaks
  kind          text        not null default 'event'
                check (kind in ('resumption','holiday','break','exam',
                                'closing','pta','event')),
  is_published  boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint calendar_unique_per_day unique (title, event_date)
);

create index if not exists calendar_by_date on calendar_events (event_date);
create index if not exists calendar_by_session on calendar_events (session_id);

drop trigger if exists trg_calendar_updated on calendar_events;
create trigger trg_calendar_updated before update on calendar_events
  for each row execute function set_updated_at();

-- Upcoming events, for the homepage countdown and the chatbot.
create or replace view calendar_upcoming as
  select * from calendar_events
   where is_published and event_date >= current_date
   order by event_date;

-- The whole current session, past dates included, for the calendar page and
-- the printed term calendar.
create or replace view calendar_current_session as
  select c.*, (c.event_date < current_date) as is_past
    from calendar_events c
    left join sessions s on s.id = c.session_id
   where c.is_published and (s.is_current or s.id is null)
   order by c.event_date;


-- ============================================================================
-- 3. PARENT ACCOUNTS AND PUPILS  — one account, many children
-- A parent registers once. Every additional child attaches to the SAME
-- household, matched on either phone number they gave.
-- ============================================================================

create table if not exists parent_accounts (
  id            uuid primary key default gen_random_uuid(),
  account_no    text        not null unique,         -- 'PA-000123', shown to the parent
  parent_name   text        not null,
  email         text,
  address       text,
  password_hash text,                                -- never store plaintext
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_parent_updated on parent_accounts;
create trigger trg_parent_updated before update on parent_accounts
  for each row execute function set_updated_at();

-- Phones live in their own table because a household may give two numbers and
-- EITHER must find the account. phone_key is the last 10 digits, so
-- +2348032221111 and 08032221111 collapse to one key and cannot be
-- double-registered.
create table if not exists parent_phones (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references parent_accounts(id) on delete cascade,
  phone         text not null,
  phone_key     text not null,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint parent_phone_key_unique unique (phone_key)
);

create index if not exists parent_phones_account on parent_phones (account_id);

-- Normalise the key in the database so every client agrees on the rule.
create or replace function normalise_phone_key() returns trigger
language plpgsql as $$
declare digits text;
begin
  digits := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
  if length(digits) < 7 then
    raise exception 'phone % is too short to identify an account', new.phone;
  end if;
  new.phone_key := right(digits, 10);
  return new;
end $$;

drop trigger if exists trg_phone_key on parent_phones;
create trigger trg_phone_key before insert or update of phone on parent_phones
  for each row execute function normalise_phone_key();

create table if not exists pupils (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid references parent_accounts(id) on delete set null,
  admission_no  text unique,                         -- null until admitted
  full_name     text        not null,
  class_name    text,
  gender        text check (gender in ('Male','Female')),
  date_of_birth date,
  status        text        not null default 'applicant'
                check (status in ('applicant','admitted','active',
                                  'graduated','withdrawn')),
  admitted_on   date,
  graduated_on  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists pupils_account on pupils (account_id);
create index if not exists pupils_class   on pupils (class_name)
  where status in ('admitted','active');

drop trigger if exists trg_pupils_updated on pupils;
create trigger trg_pupils_updated before update on pupils
  for each row execute function set_updated_at();

-- Resolve either phone number to the household and its children. This is the
-- query behind the "are you registering another child?" prompt.
create or replace function household_by_phone(p_phone text)
returns table (
  account_id uuid, account_no text, parent_name text,
  pupil_id uuid, pupil_name text, class_name text, status text
)
language sql stable as $$
  select a.id, a.account_no, a.parent_name,
         p.id, p.full_name, p.class_name, p.status
    from parent_accounts a
    join parent_phones  ph on ph.account_id = a.id
    left join pupils    p  on p.account_id  = a.id
   where ph.phone_key = right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10)
   order by p.created_at;
$$;


-- ============================================================================
-- 4. ADMISSIONS
-- ============================================================================

create table if not exists applications (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,                -- 'AP-000123'
  account_id    uuid references parent_accounts(id) on delete set null,
  pupil_id      uuid references pupils(id) on delete set null,
  pupil_name    text not null,
  class_applied text,
  parent_name   text,
  phone         text,
  phone_alt     text,
  gender        text check (gender in ('Male','Female')),
  date_of_birth date,
  status        text not null default 'pending'
                check (status in ('pending','reviewing','accepted',
                                  'declined','withdrawn')),
  submitted_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    text,
  notes         text,
  updated_at    timestamptz not null default now()
);

create index if not exists applications_status on applications (status, submitted_at desc);

drop trigger if exists trg_applications_updated on applications;
create trigger trg_applications_updated before update on applications
  for each row execute function set_updated_at();

-- The admissions deadline is its own row. It used to be derived as
-- "resumption + 14 days" (now seven weeks), so it silently vanished the moment resumption
-- passed and parents asking mid-term got no answer at all.
create table if not exists admission_windows (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references sessions(id) on delete cascade,
  opens_on     date not null,
  deadline_on  date not null,
  is_open      boolean not null default true,
  note         text,
  created_at   timestamptz not null default now(),
  constraint admission_window_order check (deadline_on >= opens_on)
);


-- ============================================================================
-- 5. STAFF
-- ============================================================================

create table if not exists staff (
  id            uuid primary key default gen_random_uuid(),
  staff_no      text unique,                         -- 'T001', 'HEAD001'
  full_name     text not null,
  role          text not null default 'teacher'
                check (role in ('headmistress','teacher','admin','support')),
  class_name    text,
  phone         text,
  position      text,
  qualification text,
  about         text,
  date_of_birth date,
  started_on    date,
  is_active     boolean not null default true,
  left_on       date,                                -- former staff are kept
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_staff_updated on staff;
create trigger trg_staff_updated before update on staff
  for each row execute function set_updated_at();

create table if not exists staff_subjects (
  staff_id uuid not null references staff(id) on delete cascade,
  subject  text not null,
  primary key (staff_id, subject)
);


-- ============================================================================
-- 6. ATTENDANCE, RESULTS, FEES
-- Each row carries its session so history never has to be inferred.
-- ============================================================================

create table if not exists attendance (
  id          uuid primary key default gen_random_uuid(),
  pupil_id    uuid not null references pupils(id) on delete cascade,
  session_id  uuid references sessions(id) on delete set null,
  taken_on    date not null,
  status      text not null default 'present'
              check (status in ('present','absent','late','excused')),
  recorded_by uuid references staff(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint attendance_once_per_day unique (pupil_id, taken_on)
);

create index if not exists attendance_by_date on attendance (taken_on);

create table if not exists results (
  id           uuid primary key default gen_random_uuid(),
  pupil_id     uuid not null references pupils(id) on delete cascade,
  session_id   uuid references sessions(id) on delete set null,
  subject      text not null,
  ca_score     numeric(5,2) check (ca_score  >= 0),
  exam_score   numeric(5,2) check (exam_score >= 0),
  total_score  numeric(5,2) generated always as
                 (coalesce(ca_score,0) + coalesce(exam_score,0)) stored,
  grade        text,
  remark       text,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint results_one_per_subject unique (pupil_id, session_id, subject)
);

drop trigger if exists trg_results_updated on results;
create trigger trg_results_updated before update on results
  for each row execute function set_updated_at();

create table if not exists fee_structure (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade,
  class_name  text not null,
  amount_naira numeric(12,2) not null check (amount_naira >= 0),
  created_at  timestamptz not null default now(),
  constraint fee_once_per_class unique (session_id, class_name)
);

create table if not exists fee_payments (
  id           uuid primary key default gen_random_uuid(),
  pupil_id     uuid not null references pupils(id) on delete cascade,
  session_id   uuid references sessions(id) on delete set null,
  amount_naira numeric(12,2) not null check (amount_naira > 0),
  method       text not null default 'bank_transfer'
               check (method in ('bank_transfer','cash','pos')),
  reference    text,
  paid_on      date not null default current_date,
  recorded_by  uuid references staff(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists fee_payments_pupil on fee_payments (pupil_id);

-- Outstanding balance per pupil for the current term.
create or replace view fee_balances as
  select p.id as pupil_id, p.full_name, p.class_name,
         coalesce(f.amount_naira, 0)              as expected_naira,
         coalesce(sum(fp.amount_naira), 0)        as paid_naira,
         coalesce(f.amount_naira, 0) - coalesce(sum(fp.amount_naira), 0)
                                                  as balance_naira
    from pupils p
    left join sessions s     on s.is_current
    left join fee_structure f on f.class_name = p.class_name and f.session_id = s.id
    left join fee_payments fp on fp.pupil_id = p.id and fp.session_id = s.id
   where p.status in ('admitted','active')
   group by p.id, p.full_name, p.class_name, f.amount_naira;


-- ============================================================================
-- 7. NEWS, NOTICES, PTA
-- ============================================================================

create table if not exists news_posts (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null default '',
  kind         text not null default 'news' check (kind in ('news','event')),
  published_on date not null default current_date,
  is_published boolean not null default true,
  likes        integer not null default 0 check (likes >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists news_by_date on news_posts (published_on desc);

drop trigger if exists trg_news_updated on news_posts;
create trigger trg_news_updated before update on news_posts
  for each row execute function set_updated_at();

create table if not exists news_images (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references news_posts(id) on delete cascade,
  url      text not null,
  caption  text,
  sort_order integer not null default 0
);

create table if not exists pta_meetings (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete set null,
  title       text not null,
  meets_on    date not null,
  venue       text,
  agenda      text,
  created_at  timestamptz not null default now()
);

create table if not exists pta_attendance (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references pta_meetings(id) on delete cascade,
  account_id uuid references parent_accounts(id) on delete set null,
  parent_name text,
  will_attend boolean not null default true,
  created_at timestamptz not null default now(),
  constraint pta_one_rsvp unique (meeting_id, account_id)
);


-- ============================================================================
-- 8. AUDIT TRAIL
-- A client site needs to answer "who changed this, and when".
-- ============================================================================

create table if not exists audit_log (
  id         bigserial primary key,
  table_name text not null,
  row_id     text,
  action     text not null check (action in ('insert','update','delete')),
  actor      text,
  changed_at timestamptz not null default now(),
  before     jsonb,
  after      jsonb
);

create index if not exists audit_by_table on audit_log (table_name, changed_at desc);

commit;

-- ============================================================================
-- NOTES FOR WHOEVER RUNS THIS NEXT
--
-- * Nothing here deletes history. If an event, pupil or staff member stops
--   being current, close it with a status/left_on/archived flag instead of
--   removing the row, so reports for past terms still work.
-- * Phone matching is enforced in one place (normalise_phone_key). Do not
--   reimplement the last-10-digits rule anywhere else.
-- * Row Level Security is deliberately NOT enabled in this file. Turn it on
--   in 003_policies.sql once the owner decides who may read what, otherwise
--   the anon key would expose pupil records publicly.
-- * Only the anon public key belongs in site JavaScript. The service_role key
--   must stay on a server.
-- ============================================================================
