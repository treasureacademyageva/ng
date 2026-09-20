-- ============================================================
-- Treasure Academy website — Supabase schema (Batch 19)
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query
-- ============================================================
-- Design: one row per data collection, mirroring the website's
-- current browser database (collections like pupils, newsEvents,
-- calendar, results...). The site will later read/write these rows
-- instead of localStorage, so every phone sees the same data.

create table if not exists school_data (
  key text primary key,              -- collection name, e.g. 'pupils'
  data jsonb not null default '{}'::jsonb,  -- the collection's rows
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh on every write
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_school_data on school_data;
create trigger trg_touch_school_data
  before update on school_data
  for each row execute function touch_updated_at();

-- ---- Access rules (Row Level Security) ----
alter table school_data enable row level security;

-- Everyone (website visitors) can READ
drop policy if exists "public read" on school_data;
create policy "public read"
  on school_data for select
  using (true);

-- DEMO write rule: the static website (no login server yet) can write.
-- TODO before real pupil data goes live: restrict writes to signed-in
-- staff (Supabase Auth) instead of leaving this open.
drop policy if exists "demo write" on school_data;
create policy "demo write"
  on school_data for insert
  with check (true);
drop policy if exists "demo update" on school_data;
create policy "demo update"
  on school_data for update
  using (true) with check (true);
drop policy if exists "demo delete" on school_data;
create policy "demo delete"
  on school_data for delete
  using (true);

-- ---- Probe row: proves the table works end to end ----
insert into school_data (key, data)
values ('_probe', '{"hello": "treasure-academy"}')
on conflict (key) do update set data = excluded.data;

-- Verify: should return exactly 1 row
select key, data, updated_at from school_data where key = '_probe';
