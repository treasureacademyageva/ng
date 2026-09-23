-- =============================================================================
--  Treasure Academy, Ageva  -  005_shop.sql
--  The school shop: books, stationery, uniform and creche items.
--
--  Run AFTER 004_school_content.sql. Safe to run more than once.
--
--  This is the last of the changeable school content to leave JavaScript.
--  Prices and stock counts used to live in assets/js/store.js, which meant a
--  price change needed a code edit and a redeploy, and every visitor's browser
--  kept its own stale copy. Now the office edits one table.
--
--  Category is stored, not guessed. It used to be a hard-coded list of item
--  ids in store.js (U.shopCat), so a new item silently fell into "Others"
--  until a developer edited that list. Item photos stay in the site code:
--  they are design assets, not school data.
-- =============================================================================

create table if not exists shop_items (
  id            text primary key,
  name          text not null,
  category      text not null default 'Others',
  price_naira   integer not null check (price_naira >= 0),
  qty_in_stock  integer not null default 0 check (qty_in_stock >= 0),
  icon          text not null default 'bag',
  classes       text[] not null default '{}',
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_shop_items_updated on shop_items;
create trigger trg_shop_items_updated before update on shop_items
  for each row execute function set_updated_at();

-- Real prices and stock counts from the school. Re-running refreshes the
-- price, stock and category but never duplicates a row.
insert into shop_items (id, name, category, price_naira, qty_in_stock, icon, classes, sort_order) values
  ('S01', 'Mathematics Textbook', 'Textbooks', 4500, 40, 'book', array['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 10),
  ('S02', 'English Language Textbook', 'Textbooks', 4500, 40, 'book', array['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 20),
  ('S03', 'Verbal Reasoning', 'Textbooks', 3500, 35, 'book', array['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 30),
  ('S04', 'Quantitative Reasoning', 'Textbooks', 3500, 35, 'book', array['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 40),
  ('S05', 'Basic Science Textbook', 'Textbooks', 4000, 30, 'book', array['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 50),
  ('S06', 'Sound Foundation (Phonics)', 'Textbooks', 3000, 25, 'book', array['Primary 1','Primary 2','Primary 3'], 60),
  ('S07', 'Queen Primer', 'Workbooks', 3200, 25, 'star', array['Nursery 2','Primary 1'], 70),
  ('S08', 'Story Novel', 'Textbooks', 2500, 30, 'news', array['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 80),
  ('S09', 'Notebook — 60 Leaves', 'Notebooks', 900, 60, 'filetext', array['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 90),
  ('S10', 'Pen (Pack of 5)', 'Pens', 1200, 50, 'edit', array['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 100),
  ('S11', 'Eraser', 'Stationery', 200, 70, 'x', array['Pre-Nursery','Nursery 1','Nursery 2','Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 110),
  ('S12', 'Ruler Set', 'Stationery', 800, 45, 'chart', array['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 120),
  ('S13', 'Crayons (Pack of 12)', 'Crayons & Art', 1500, 30, 'star', array['Pre-Nursery','Nursery 1','Nursery 2','Primary 1','Primary 2'], 130),
  ('S14', 'Writing Book', 'Notebooks', 700, 50, 'filetext', array['Pre-Nursery','Nursery 1','Nursery 2'], 140),
  ('S15', 'Drawing Book', 'Notebooks', 700, 50, 'edit', array['Pre-Nursery','Nursery 1','Nursery 2'], 150),
  ('S16', 'Colouring Textbook', 'Workbooks', 2200, 20, 'book', array['Pre-Nursery','Nursery 1','Nursery 2'], 160),
  ('S17', 'Nursery Mathematics', 'Workbooks', 2800, 25, 'book', array['Nursery 1','Nursery 2'], 170),
  ('S18', 'Creche Care Pack', 'Creche', 5000, 0, 'bag', array['Creche'], 180),
  ('S19', 'Feeding Bib Set', 'Creche', 1800, 15, 'shirt', array['Creche'], 190),
  ('S20', 'Soft Towel', 'Creche', 1500, 15, 'shirt', array['Creche'], 200),
  ('S21', 'Full Uniform Set', 'Uniform', 8500, 25, 'shirt', array['Creche','Pre-Nursery','Nursery 1','Nursery 2','Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 210),
  ('S22', 'Sportswear', 'Sportswear', 6500, 0, 'shirt', array['Creche','Pre-Nursery','Nursery 1','Nursery 2','Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 220),
  ('S23', 'School Cardigan', 'Sportswear', 6000, 20, 'shirt', array['Creche','Pre-Nursery','Nursery 1','Nursery 2','Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 230),
  ('S24', 'School Bag', 'Bags', 7500, 18, 'bag', array['Pre-Nursery','Nursery 1','Nursery 2','Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 240),
  ('S25', 'Socks & Beret', 'Uniform', 2500, 30, 'star', array['Pre-Nursery','Nursery 1','Nursery 2','Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'], 250)
on conflict (id) do update set
  name         = excluded.name,
  category     = excluded.category,
  price_naira  = excluded.price_naira,
  qty_in_stock = excluded.qty_in_stock,
  icon         = excluded.icon,
  classes      = excluded.classes,
  sort_order   = excluded.sort_order;

-- What the shop page and the poster read. Out-of-stock items are kept and
-- flagged rather than hidden, so parents can still see the price and ask to
-- be told when it is back.
create or replace view shop_catalogue as
  select id, name, category, price_naira, qty_in_stock,
         (qty_in_stock = 0) as out_of_stock,
         icon, classes, sort_order
    from shop_items
   where is_active
   order by sort_order;

alter view shop_catalogue set (security_invoker = on);

-- -----------------------------------------------------------------------------
-- Access. The catalogue is public; only the office may change it.
--
-- Both gates must be open: GRANT decides whether the role may touch the table
-- at all, RLS decides which rows it sees. Supabase's blanket grant ran when the
-- project was created, before this table existed, so it must be granted here.
-- -----------------------------------------------------------------------------
alter table shop_items enable row level security;

drop policy if exists shop_items_public_read on shop_items;
create policy shop_items_public_read on shop_items
  for select using (is_active);

grant usage on schema public to anon, authenticated;
grant select on shop_items, shop_catalogue to anon, authenticated;
revoke insert, update, delete on shop_items from anon, authenticated;
