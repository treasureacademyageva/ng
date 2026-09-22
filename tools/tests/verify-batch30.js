/* Batch 30: button system + login edge, topBtn everywhere + progress ring, text-size preset,
   high-contrast night, OG/favicon, news auto-archive */
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = (() => {
  const w = require('path').join(__dirname, 'mums-school-website');
  if (fs.existsSync(require('path').join(w, 'assets/js/store.js'))) return w;
  return require('path').resolve(__dirname, '..', '..');
})();
const store = fs.readFileSync(SITE + '/assets/js/store.js', 'utf8');
const sitejs = fs.readFileSync(SITE + '/assets/js/site.js', 'utf8');
const corp = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('FAIL -', name, extra || ''); }
}
function loadPage(page, session, url, pre) {
  const html = fs.readFileSync(SITE + '/' + page, 'utf8');
  const dom = new JSDOM(html, { url: url || ('http://localhost/' + page), pretendToBeVisual: true });
  const window = dom.window;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!window.IntersectionObserver) { window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.print = () => {}; window.scrollTo = () => {}; window.open = () => {};
  window.requestAnimationFrame = () => 0;
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
  window.Element.prototype.scrollTo = window.Element.prototype.scrollTo || function () {};
  const scripts = [...window.document.querySelectorAll('script:not([src]):not([type="application/ld+json"])')].map(s => s.textContent).join('\n;\n');
  const errors = [];
  window.addEventListener('error', e => errors.push(String((e.message || e.error || '').slice(0, 140))));
  vm.createContext(window);
  vm.runInContext(store + '\n;window.__U=U;', window);
  vm.runInContext('window.__DB=DB;', window);
  if (session) vm.runInContext('localStorage.setItem("treasure_session_v1", \'' + JSON.stringify(session) + '\');', window);
  if (pre) vm.runInContext(pre, window);
  vm.runInContext(sitejs + '\n;\n' + scripts, window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, errors: errors.filter(x => !/navigation|Not implemented/i.test(x)), run: c => vm.runInContext(c, window) };
}

/* ---------- A. CSS: button system + login edge + ring + hc + fontsize ---------- */
ok('button system block', corp.includes('BATCH 30 (2026-09-20)') && corp.includes('.btn{border-radius:12px}') && corp.includes('.btn:focus-visible'));
ok('login edge alignment', corp.includes('.nav-links .btn{margin-left:14px;margin-right:2px}') && corp.includes('.nav-cta-row{margin-left:10px}'));
ok('mobile login full row', corp.includes('.nav-links .btn{width:100%;margin:0;border-radius:12px}'));
ok('progress ring css', corp.includes('conic-gradient(var(--gold,#C9A227) calc(var(--prog,0)*1%)'));
ok('hc night tokens', corp.includes('[data-theme="dark-hc"]{--cream:#080D14') && corp.includes('[data-theme="dark-hc"] .navbar'));
ok('fontsize rules', corp.includes('html[data-fontsize="s"]') && corp.includes('html[data-fontsize="l"]'));

/* ---------- B. site.js: topBtn everywhere + ring + theme cycle + og + footer preset ---------- */
ok('topBtn auto-boot', sitejs.includes('__topBtnBooted') && sitejs.includes('bootSafe(()=>initTopBtn())'));
ok('portals excluded from topBtn boot', sitejs.includes('portal\\/(admin|teacher|pupil)'));
ok('ring progress wiring', sitejs.includes('setProperty("--prog"'));
ok('theme 3-state cycle', sitejs.includes('"dark-hc"') && sitejs.includes('Switch to high-contrast night'));
ok('og/favicon injection', sitejs.includes('og:image') && sitejs.includes('icon-512.png') && sitejs.includes('apple-touch-icon') && sitejs.includes('theme-color'));
ok('footer text-size preset', sitejs.includes('id="textSizeBtns"') && sitejs.includes('treasure_fontsize'));

/* ---------- C. assets ---------- */
ok('app icon exists', fs.existsSync(SITE + '/assets/img/icon-512.png') && fs.statSync(SITE + '/assets/img/icon-512.png').size > 20000);
ok('og cover exists', fs.existsSync(SITE + '/assets/img/og-cover.png') && fs.statSync(SITE + '/assets/img/og-cover.png').size > 20000);

/* ---------- D. news auto-archive ---------- */
const news = fs.readFileSync(SITE + '/news.html', 'utf8');
ok('archive window 730d', news.includes('ARCHIVE_DAYS=730') && news.includes('archBtnZone'));
ok('archive toggle wired', news.includes('window.toggleArchive'));
const old = JSON.stringify(new Date(Date.now() - 800 * 864e5).toISOString().slice(0, 10));
const nw = loadPage('news.html', null, null, 'var d=DB.load(); d.newsEvents.unshift({id:"OLDX",type:"news",date:' + old + ',title:"Very Old Story",text:"ancient",image:"assets/img/classroom.png",views:0,likes:0}); DB.save(d);');
const listNow = nw.window.document.getElementById('neList').textContent;
ok('old story hidden by default', !listNow.includes('Very Old Story'));
const zone = nw.window.document.getElementById('archBtnZone');
ok('archive chip shows count', zone && zone.textContent.includes('Archive:') && /\d/.test(zone.textContent));
nw.run('toggleArchive()');
ok('archive shows old story', nw.window.document.getElementById('neList').textContent.includes('Very Old Story'));
ok('back chip appears', nw.window.document.getElementById('archBtnZone').textContent.includes('Back to current news'));

/* ---------- E. runtime behaviors ---------- */
const idx = loadPage('index.html', null, null, 'localStorage.setItem("treasure_theme","light");');
ok('og meta injected', !!idx.window.document.querySelector('meta[property="og:image"]') && idx.window.document.querySelector('meta[property="og:image"]').getAttribute('content').endsWith('/assets/img/og-cover.png'));
ok('icon link injected', !!idx.window.document.querySelector('link[href="assets/img/icon-512.png"]'));
ok('theme-color injected', idx.window.document.querySelector('meta[name="theme-color"]').getAttribute('content') === '#0B7A37');
ok('topBtn rendered on homepage', !!idx.window.document.getElementById('topBtn'));
ok('footer size buttons render', idx.window.document.querySelectorAll('#textSizeBtns button').length === 3);
idx.window.document.querySelector('#textSizeBtns button[data-fs="l"]').click();
ok('large text applies + persists', idx.window.document.documentElement.dataset.fontsize === 'l' && idx.window.localStorage.getItem('treasure_fontsize') === 'l');

const lg = loadPage('portal/login.html', null, null, 'localStorage.setItem("treasure_theme","light");');
const tb = lg.window.document.querySelector('.theme-btn');
tb.click(); tb.click(); tb.click();
ok('theme cycles day-night-hc-day', lg.window.document.documentElement.dataset.theme === 'light');
tb.click();
tb.click();
ok('hc state reached', lg.window.document.documentElement.dataset.theme === 'dark-hc');
ok('login page clean', lg.errors.length === 0, lg.errors.join(' || ').slice(0, 140));

const hc = loadPage('index.html', null, null, 'document.documentElement.dataset.theme="dark-hc"; localStorage.setItem("treasure_theme","dark-hc");');
ok('high-contrast homepage clean', hc.errors.length === 0, hc.errors.join(' || ').slice(0, 140));

/* ---------- F. versions ---------- */
let stale = 0;
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  if (fs.readFileSync(p, 'utf8').includes('20260919-29')) { console.log('  stale -29 in', p); stale++; }
}
ok('no stale -29 versions', stale === 0);
ok('sw + dev on v30', fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v48') && fs.readFileSync(SITE + '/developer.html', 'utf8').includes('var BUILD = "treasure-v48";'));

console.log(`\n==== BATCH30: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
