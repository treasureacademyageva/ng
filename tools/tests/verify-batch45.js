/* verify-batch45.js — glass auth popup, household accounts, drawer, and the
   move of time-sensitive school data out of code and into SQL.

   The bugs this batch fixed were all "quiet" ones: a calendar that deleted its
   own history, a deadline that vanished mid-term, and a save that threw away
   the user's work without saying so. These assertions exist to stop them
   coming back. */

const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;

function ok(label, cond, detail) {
  if (cond) { pass++; console.log('ok - ' + label); }
  else { fail++; console.log('FAIL: ' + label + (detail ? ' | ' + detail : '')); }
}

const read = f => fs.readFileSync(path.join(SITE, f), 'utf8');
const exists = f => fs.existsSync(path.join(SITE, f));

/* ---------------------------------------------------------------- SQL ---- */

ok('schema file exists', exists('db/001_schema.sql'));
ok('seed file exists',   exists('db/002_seed.sql'));

const schema = read('db/001_schema.sql');
const seed   = read('db/002_seed.sql');

/* The whole point of the schema: data that outlives the term. */
ok('schema keeps a sessions table',        /create table if not exists sessions/i.test(schema));
ok('schema keeps calendar_events',         /create table if not exists calendar_events/i.test(schema));
ok('calendar view exposes past events',    /calendar_current_session/.test(schema) && /is_past/.test(schema));
ok('separate view for upcoming only',      /calendar_upcoming/.test(schema));

/* One parent, many pupils - matched on either phone number. */
ok('parent_accounts table',                /create table if not exists parent_accounts/i.test(schema));
ok('phones are their own table',           /create table if not exists parent_phones/i.test(schema));
ok('phone_key is unique',                  /parent_phone_key_unique/.test(schema));
ok('phone key normalised in the database', /normalise_phone_key/.test(schema) && /right\(digits, 10\)/.test(schema));
ok('household lookup function',            /function household_by_phone/i.test(schema));
ok('pupils link back to an account',       /account_id\s+uuid references parent_accounts/i.test(schema));

/* The deadline that used to be derived from resumption. */
ok('admission window is stored, not derived', /create table if not exists admission_windows/i.test(schema));

/* Guard rails the database enforces itself. */
ok('only one current term allowed',        /sessions_one_current/.test(schema));
ok('attendance cannot double-book a day',  /attendance_once_per_day/.test(schema));
ok('results unique per subject',           /results_one_per_subject/.test(schema));
ok('audit trail present',                  /create table if not exists audit_log/i.test(schema));

/* Re-runnable: the owner should never be punished for running it twice. */
ok('schema is idempotent',
   /create table if not exists/i.test(schema) &&
   !/^\s*create table (?!if not exists)/im.test(schema));
ok('seed is idempotent',    /on conflict/i.test(seed));

/* Real data only. */
ok('seed uses the real session',  /2026\/2027/.test(seed) && /First Term/.test(seed));
ok('seed keeps all five term dates',
   ['2026-09-14', '2026-10-01', '2026-10-29', '2026-12-10', '2026-12-18']
     .every(d => seed.includes(d)));
ok('seed does not invent demo staff',
   !/Tunde Bakare'/.test(seed) && !/Ngozi Obi'/.test(seed));
ok('no service_role key value present',
   !/service_role['\"]?\s*[:=]/i.test(schema + seed) &&
   !/eyJ[A-Za-z0-9_-]{20,}/.test(schema + seed));

/* ------------------------------------------------------------ policies -- */

ok('policies file exists', exists('db/003_policies.sql'));
const pol = read('db/003_policies.sql');

/* Every table holding data about a child or family must have RLS on. */
['pupils', 'parent_accounts', 'parent_phones', 'applications',
 'attendance', 'results', 'fee_payments', 'audit_log'].forEach(t => {
  ok('RLS enabled on ' + t,
     new RegExp('alter table ' + t + '\\s+enable row level security', 'i').test(pol));
});

/* ...and must NOT hand the public a select policy. */
['pupils', 'parent_accounts', 'parent_phones', 'attendance', 'results',
 'fee_payments', 'audit_log'].forEach(t => {
  ok('no public read policy on ' + t,
     !new RegExp('create policy[^;]*on ' + t + '[^;]*for select[^;]*to[^;]*anon', 'i').test(pol));
});

/* Public pages must keep working. */
['calendar_events', 'fee_structure', 'sessions', 'admission_windows'].forEach(t => {
  ok('public may still read ' + t,
     new RegExp('create policy[^;]*on ' + t + '[^;]*for select[^;]*anon', 'i').test(pol));
});

/* The two quiet traps. */
ok('views use security_invoker so they cannot bypass RLS',
   /alter view calendar_upcoming\s+set \(security_invoker = on\)/i.test(pol) &&
   /alter view fee_balances\s+set \(security_invoker = on\)/i.test(pol));
ok('fee_balances is not public',        /revoke all on fee_balances from anon/i.test(pol));
ok('household lookup revoked from anon',
   /revoke execute on function household_by_phone\(text\) from anon/i.test(pol));

/* Staff: class lists public, personal details not. */
ok('staff phone and DOB withheld from anon',
   /revoke select on staff from anon/i.test(pol) &&
   /grant\s+select \(id, staff_no, full_name/i.test(pol) &&
   !/grant\s+select[^;]*\bphone\b[^;]*on staff to anon/i.test(pol));

/* The single public write is insert-only and validated. */
ok('applications are insert-only for the public',
   /create policy[^;]*on applications[^;]*for insert[^;]*anon/i.test(pol) &&
   !/create policy[^;]*on applications[^;]*for select[^;]*anon/i.test(pol));
ok('application submissions are validated', /with check/i.test(pol));
ok('anon cannot write to the other tables',
   /revoke insert, update, delete on all tables in schema public from anon/i.test(pol));
ok('future tables default to closed',
   /alter default privileges in schema public\s+revoke insert, update, delete/i.test(pol));
ok('policies are re-runnable', /drop policy if exists/i.test(pol));

/* ------------------------------------------------- 004 school content ---- */

ok('school-content migration exists', exists('db/004_school_content.sql'));
const m4 = read('db/004_school_content.sql');

['exam_timetable', 'staff_meetings', 'holiday_assignments',
 'transport_routes', 'uniform_items'].forEach(t => {
  ok('004 creates ' + t,
     new RegExp('create table if not exists ' + t, 'i').test(m4));
  ok('004 enables RLS on ' + t,
     new RegExp('alter table ' + t + '\\s+enable row level security', 'i').test(m4));
});

/* The bug this file was written to remove: dated content going stale in JS. */
ok('exam view keeps past papers',  /exams_current_session/.test(m4) && /is_past/.test(m4));
ok('exam view for upcoming only',  /exams_upcoming/.test(m4));
ok('004 views are security_invoker',
   /alter view exams_upcoming\s+set \(security_invoker = on\)/i.test(m4));

/* Internal content must not be public. */
ok('staff meetings stay private',
   !/create policy[^;]*on staff_meetings[^;]*anon/i.test(m4) &&
   /revoke select on staff_meetings, holiday_assignments from anon/i.test(m4));

/* GRANT and RLS are separate gates - the public tables need both. */
ok('004 grants select on its public tables',
   /grant select on exam_timetable, transport_routes, uniform_items/i.test(m4));

ok('004 seeds real values only',
   /Route A - Adavi/.test(m4) && /School Shirt \(white\)/.test(m4) &&
   /Welcome Back Staff Meeting/.test(m4));
ok('004 is re-runnable', /on conflict/i.test(m4) && /create table if not exists/i.test(m4));

/* 003 must grant explicitly: Supabase's blanket grant runs before these
   tables exist, so a policy alone leaves the public pages denied. */
ok('003 grants select on the public tables',
   /grant select on\s+sessions, calendar_events, admission_windows, fee_structure/i.test(pol));
ok('003 grants the public views',
   /grant select on calendar_upcoming, calendar_current_session/i.test(pol));
ok('003 revokes select on the private tables',
   /revoke select on\s+pupils, parent_accounts, parent_phones/i.test(pol));

/* ------------------------------------------------------- 005 the shop ---- */

ok('shop migration exists', exists('db/005_shop.sql'));
const m5 = read('db/005_shop.sql');

ok('005 creates shop_items', /create table if not exists shop_items/i.test(m5));
ok('005 enables RLS',        /alter table shop_items\s+enable row level security/i.test(m5));
ok('005 view is security_invoker',
   /alter view shop_catalogue set \(security_invoker = on\)/i.test(m5));

/* GRANT and RLS are separate gates; Supabase's blanket grant predates this
   table, so the migration must grant for itself or the shop page breaks. */
ok('005 grants select explicitly',
   /grant select on shop_items, shop_catalogue to anon, authenticated/i.test(m5));
ok('005 refuses anon writes',
   /revoke insert, update, delete on shop_items from anon/i.test(m5));

/* Out of stock must stay visible with its price, not vanish. */
ok('005 flags rather than hides out-of-stock',
   /out_of_stock/.test(m5) && !/where[^;]*qty_in_stock\s*>\s*0/i.test(m5));

/* Category used to be a hard-coded id list in store.js, so a new item fell
   into "Others" until someone edited the code. It is real data now. */
ok('005 stores the category', /category\s+text not null/i.test(m5));

ok('005 seeds real prices', /Mathematics Textbook/.test(m5) && /4500/.test(m5) &&
                            /Creche Care Pack/.test(m5));
ok('005 is re-runnable', /on conflict \(id\) do update/i.test(m5));

/* ------------------------------------------------------------ db-live ---- */

ok('db-live.js exists', exists('assets/js/db-live.js'));
const live = read('assets/js/db-live.js');

ok('reader falls back when disabled',   /function enabled\(\)/.test(live));
ok('reader never rejects',              /\.catch\(function/.test(live));
ok('reader times out slow networks',    /AbortController/.test(live) && /setTimeout/.test(live));
ok('reader caches for offline use',     /treasure_dblive_cache/.test(live));
ok('reader is read-only for tables',    !/method:\s*"(PATCH|PUT|DELETE)"/.test(live));
/* db-live must read the new tables. */
ok('db-live reads exams',     /exams_current_session/.test(live));
ok('db-live reads pta',       /pta_meetings/.test(live));
ok('db-live reads transport', /transport_routes/.test(live));
ok('db-live reads uniform',   /uniform_items/.test(live));

/* The shop must come from the database, and item photos must survive it. */
ok('db-live reads the shop', /shop_catalogue/.test(live));
ok('db-live keeps item photos on merge',
   /old\.img/.test(live) && /n\.img = old\.img/.test(live));

ok('no service_role key in client js',
   !/service_role['\"]?\s*[:=]/i.test(live) && !/eyJ[A-Za-z0-9_-]{20,}/.test(live));

/* ------------------------------------------------------------- store ---- */

const store = read('assets/js/store.js');

/* The original bug: every past date deleted on load. */
ok('calendar prune is session-aware, not "before today"',
   /U\.staleBefore\(\)/.test(store) && !/filter\(c=>c\.date>=U\.todayStr\(\)\)/.test(store));
ok('staleBefore keeps a full session', /staleBefore\(\)\s*\{[^}]*365/.test(store));

/* Saving must never lose work silently. */
ok('DB.save handles a full quota',
   /QuotaExceededError/.test(store) && /save\(db\)\s*\{[\s\S]{0,400}try\s*\{/.test(store));
ok('DB.save reports failure to the caller', /return false;/.test(store));

/* A failed save must never be followed by a success message. 278 call sites
   do `DB.save(db); U.toast("Saved!")` without checking the result, so the
   guard lives in U.toast rather than in every caller. */
ok('failed save flags itself',      /_saveFailedAt/.test(store));
ok('toast vetoes a false success',
   /_saveFailedAt/.test(store) &&
   /saved\|success\|updated\|added\|posted\|sent\|recorded\|published/.test(store));

/* ------------------------------------------------------------- site ----- */

const site = read('assets/js/site.js');
ok('admission deadline survives past resumption',
   /resAny/.test(read('assets/js/chat-core.js')) &&
   /Deadline/.test(read('assets/js/chat-core.js')));

/* -------------------------------------------------------------- auth ---- */

const auth  = read('assets/js/auth-ui.js');
const glass = read('assets/css/glass.css');

ok('household store keyed per parent', /treasure_parent_accounts_v1/.test(auth));
ok('phone match uses last 10 digits',  /slice\(-10\)/.test(auth));
ok('asks about another child',         /another child/i.test(auth));
ok('drawer offers logout',             /Logout/.test(auth));
ok('focus is trapped in dialogs',      /trapFocus/.test(auth));
ok('popup shows the school crest',     /ta-crest/.test(auth) && /\.ta-crest/.test(glass));
ok('scrim blurs the page behind',      /backdrop-filter:\s*blur/.test(glass));
ok('fallback for no backdrop-filter',  /@supports not/.test(glass));
ok('reduced motion respected',         /prefers-reduced-motion/.test(glass));

/* The Menu button had to match Contact Us. It matches because it copies the
   links' own metrics; if someone hard-codes a width again, this trips. */
ok('menu button inherits link metrics',
   /\.nav-burger/.test(glass) && /margin:\s*0 9px/.test(glass));

/* Every public page must load the new assets. */
const pages = fs.readdirSync(SITE).filter(f => f.endsWith('.html'));
const missingLive = pages.filter(f => f !== 'developer.html' && !/db-live\.js/.test(read(f)));
ok('every public page loads db-live.js', missingLive.length === 0, missingLive.join(','));

const sw = read('sw.js');
ok('service worker caches the new assets',
   /glass\.css/.test(sw) && /auth-ui\.js/.test(sw) && /db-live\.js/.test(sw));

console.log('\n==== BATCH45: ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
