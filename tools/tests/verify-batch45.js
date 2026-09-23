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
   ['2026-09-22', '2026-10-01', '2026-10-29', '2026-12-10', '2026-12-18']
     .every(d => seed.includes(d)));
ok('seed does not invent demo staff',
   !/Tunde Bakare'/.test(seed) && !/Ngozi Obi'/.test(seed));
ok('no service_role key value present',
   !/service_role['\"]?\s*[:=]/i.test(schema + seed) &&
   !/eyJ[A-Za-z0-9_-]{20,}/.test(schema + seed));

/* ------------------------------------------------------------ db-live ---- */

ok('db-live.js exists', exists('assets/js/db-live.js'));
const live = read('assets/js/db-live.js');

ok('reader falls back when disabled',   /function enabled\(\)/.test(live));
ok('reader never rejects',              /\.catch\(function/.test(live));
ok('reader times out slow networks',    /AbortController/.test(live) && /setTimeout/.test(live));
ok('reader caches for offline use',     /treasure_dblive_cache/.test(live));
ok('reader is read-only for tables',    !/method:\s*"(PATCH|PUT|DELETE)"/.test(live));
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

/* ------------------------------------------------------------- site ----- */

const site = read('assets/js/site.js');
ok('admission deadline survives past resumption', /resAny/.test(site));

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
