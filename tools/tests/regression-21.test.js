/* Suite 21: Supabase live sync (sync.js + admin UI + merge) */
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = (() => {
  const w = require('path').join(__dirname, 'mums-school-website');
  if (fs.existsSync(require('path').join(w, 'assets/js/store.js'))) return w;
  return require('path').resolve(__dirname, '..', '..');
})();
const store = fs.readFileSync(SITE + '/assets/js/store.js', 'utf8');
const site = fs.readFileSync(SITE + '/assets/js/site.js', 'utf8');
const sync = fs.readFileSync(SITE + '/assets/js/sync.js', 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('FAIL -', name, extra || ''); }
}
function loadPage(page, session, url, pre, withSync) {
  const html = fs.readFileSync(SITE + '/' + page, 'utf8');
  const dom = new JSDOM(html, { url: url || ('http://localhost/' + page), pretendToBeVisual: true });
  const window = dom.window;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!window.IntersectionObserver) { window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.print = () => {}; window.scrollTo = () => {}; window.open = () => {}; window.requestAnimationFrame = () => 0;
  const scripts = [...window.document.querySelectorAll('script:not([src]):not([type="application/ld+json"])')].map(s => s.textContent).join('\n;\n');
  const errors = [];
  window.addEventListener('error', e => errors.push(String((e.message || e.error || '').slice(0, 140))));
  vm.createContext(window);
  vm.runInContext(store + (withSync ? '\n;\n' + sync : ''), window);
  vm.runInContext('window.__DB=DB;', window);
  if (session) vm.runInContext('localStorage.setItem("treasure_session_v1", \'' + JSON.stringify(session) + '\');', window);
  if (pre) vm.runInContext(pre, window);
  vm.runInContext(site + '\n;\n' + scripts, window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, errors: errors.filter(x => !/navigation|Not implemented/i.test(x)), run: c => vm.runInContext(c, window) };
}
function mockFetch(window, responder) {
  window.__calls = [];
  window.__respond = responder || (() => []);
  window.fetch = (url, opts) => {
    window.__calls.push({ url: String(url), opts: opts || {} });
    const payload = window.__respond(String(url), opts || {});
    return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
  };
}
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'x' };
const CFG = 'localStorage.setItem("treasure_supabase_cfg", JSON.stringify({url:"https://xyz.supabase.co",key:"anonkey123",enabled:true}));';

(async () => {
/* ---------- unconfigured = silent no-op ---------- */
{
  const { run, window: w } = loadPage('index.html', null, null, null, true);
  mockFetch(w);
  ok('not configured', run('Sync.configured()') === false);
  const r = await run('Sync.push()');
  ok('push skipped', r.skipped === true && w.__calls.length === 0);
  const r2 = await run('Sync.pull()');
  ok('pull skipped', r2.skipped === true && w.__calls.length === 0);
}
/* ---------- config + push ---------- */
{
  const { run, window: w } = loadPage('index.html', null, null, CFG, true);
  mockFetch(w);
  ok('configured', run('Sync.configured()') === true);
  const r = await run('Sync.push()');
  const posts = w.__calls.filter(c => (c.opts.method || '') === 'POST');
  ok('push posts collections', r.pushed > 30 && posts.length === r.pushed, 'pushed=' + r.pushed);
  ok('push upsert header', posts.length > 0 && posts[0].opts.headers.Prefer === 'resolution=merge-duplicates');
  ok('push auth header', posts.length > 0 && posts[0].opts.headers.apikey === 'anonkey123');
  ok('push body shape', posts.length > 0 && JSON.parse(posts[0].opts.body).key === 'school');
  ok('push sets mark', run('Sync.lastSync()').length > 10);
}
/* ---------- pull applies remote, skips _keys ---------- */
{
  const { run, window: w } = loadPage('index.html', null, null, CFG, true);
  mockFetch(w, () => [{ key: 'ticker', data: { on: true, text: 'REMOTE-TICKER' } }, { key: '_probe', data: {} }]);
  const r = await run('Sync.pull()');
  ok('pull count', r.pulled === 1 && r.changed === true);
  ok('pull applied', run('DB.load().ticker.text') === 'REMOTE-TICKER');
  ok('pull skips _probe', run('DB.load()._probe') === undefined);
}
{
  // null collections (e.g. timetable) survive the NOT NULL column via sentinel
  const { run, window: w } = loadPage('index.html', null, null, CFG, true);
  mockFetch(w);
  await run('Sync.push()');
  const tt = w.__calls.filter(c => c.opts.method === 'POST').map(c => JSON.parse(c.opts.body)).find(b => b.key === 'timetable');
  ok('null pushed as sentinel', !!tt && tt.data && tt.data.__treasure_null === true);
  mockFetch(w, () => [{ key: 'timetable', data: { __treasure_null: true } }]);
  await run('Sync.pull()');
  ok('sentinel pulled as null', run('DB.load().timetable') === null);
}
/* ---------- remoteNewer + save hook + debounce ---------- */
{
  const { run, window: w } = loadPage('index.html', null, null, CFG, true);
  mockFetch(w, () => [{ updated_at: '2099-01-01T00:00:00.000Z' }]);
  ok('remote newer true', (await run('Sync.remoteNewer()')) === true);
  w.__respond = () => [{ updated_at: '2000-01-01T00:00:00.000Z' }];
  run('localStorage.setItem("treasure_synced_at","2026-09-20T00:00:00.000Z");');
  ok('remote newer false', (await run('Sync.remoteNewer()')) === false);
}
{
  const { run, window: w } = loadPage('index.html', null, null, CFG, true);
  mockFetch(w);
  run('window.__pushSoonCalls=0; var _ps=Sync.pushSoon.bind(Sync); Sync.pushSoon=function(){window.__pushSoonCalls++;};');
  run('var d=DB.load(); DB.save(d);');
  ok('save triggers pushSoon', run('window.__pushSoonCalls') === 1);
}
{
  const { run, window: w } = loadPage('index.html', null, null, CFG, true);
  mockFetch(w);
  run('Sync.pushSoon();');
  ok('debounce waits', w.__calls.length === 0);
  await new Promise(r => setTimeout(r, 2900));
  ok('debounce fires', w.__calls.length > 30, 'calls=' + w.__calls.length);
}
/* ---------- offline ---------- */
{
  const { run, window: w } = loadPage('index.html', null, null, CFG, true);
  mockFetch(w);
  Object.defineProperty(w.navigator, 'onLine', { value: false, configurable: true });
  const r = await run('Sync.push()');
  ok('offline push skipped', r.skipped === true && w.__calls.length === 0);
}
/* ---------- boot pulls only when newer ---------- */
{
  const { run, window: w } = loadPage('index.html', null, null, CFG, true);
  mockFetch(w, url => url.includes('order=updated_at') ? [{ updated_at: '2000-01-01T00:00:00.000Z' }] : []);
  run('localStorage.setItem("treasure_synced_at","2026-09-20T00:00:00.000Z");');
  run('Sync.boot();');
  await new Promise(r => setTimeout(r, 300));
  ok('boot skips pull when fresh', w.__calls.length >= 1 && w.__calls.every(c => c.url.includes('order=updated_at')));
}
{
  const { window: w, run } = loadPage('index.html', null, null, CFG, true);
  mockFetch(w);
  run('sessionStorage.setItem("treasure_sync_reloaded","1");');
  run('Sync.boot();');
  await new Promise(r => setTimeout(r, 300));
  ok('boot respects reload guard', w.__calls.length === 0);
}
/* ---------- admin UI ---------- */
{
  const { window: w, run, errors } = loadPage('portal/admin.html', ADMIN, null, CFG, true);
  mockFetch(w, () => [{ key: 'school' }]);
  const d = w.document;
  ok('sup inputs', !!d.getElementById('supUrl') && !!d.getElementById('supKey') && !!d.getElementById('supOn') && !!d.getElementById('supStatus'));
  run('renderSup();');
  ok('renderSup fills', d.getElementById('supUrl').value === 'https://xyz.supabase.co' && d.getElementById('supStatus').textContent.includes('ON'));
  run('saveSup();');
  await new Promise(r => setTimeout(r, 300));
  ok('saveSup tests', d.getElementById('supStatus').textContent.includes('Connected'));
  ok('admin sync no errors', errors.length === 0, errors.join('||').slice(0, 160));
}
/* ---------- wiring + merge checks ---------- */
{
  const pages = fs.readdirSync(SITE).filter(f => f.endsWith('.html'))
    .concat(fs.readdirSync(SITE + '/portal').filter(f => f.endsWith('.html')).map(f => 'portal/' + f));
  const missing = pages.filter(f => !fs.readFileSync(SITE + '/' + f, 'utf8').includes('sync.js?v='));
  ok('sync.js on all pages', missing.length === 0, missing.join(','));
  const sw = fs.readFileSync(SITE + '/sw.js', 'utf8');
  ok('sw caches sync.js', sw.includes("'assets/js/sync.js'") && !sw.includes('data.js'));
  const all = pages.map(f => fs.readFileSync(SITE + '/' + f, 'utf8')).join('\n');
  ok('no data.js refs', !all.includes('data.js'));
  ok('testimonials fixed', !fs.readFileSync(SITE + '/testimonials.html', 'utf8').includes('data.js'));
}

console.log(`\n==== suite 21: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
})().catch(e => { console.log('SUITE CRASH:', e && e.stack || e); process.exit(1); });
