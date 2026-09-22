/* (b41-retargeted)  Batch 35: dev auto-lock (10 min idle), portal sidebar collapse (Arena-style), public sidebar on wide screens */
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
const dh = fs.readFileSync(SITE + '/developer.html', 'utf8');
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'x' };
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

/* ---------- A. auto-lock ---------- */
ok('idle timer 10 min', dh.includes('IDLE_MS = 10 * 60 * 1000'));
ok('activity listeners', dh.includes('"pointermove"') && dh.includes('"keydown"') && dh.includes('resetIdle'));
ok('lock clears gate + message', dh.includes('removeItem(GATE)') && dh.includes('Locked automatically after 10 minutes'));
ok('session panel shows auto-lock', dh.includes('<span>Auto-lock</span><b>10 min idle</b>'));
const dv = loadPage('developer.html', null, null, 'sessionStorage.setItem("treasure_dev_gate", String(Date.now()));');
ok('dev page clean with timer running', dv.errors.length === 0, dv.errors.join(' || ').slice(0, 140));

/* ---------- B. sidebar collapse (portals) ---------- */
ok('collapse button injected', sitejs.includes('id="sideCollapse"') && sitejs.includes('treasure_side_slim'));
ok('slim css: 76px rail', corp.includes('body.side-slim .portal-layout{grid-template-columns:76px'));
ok('slim css: labels+badges hidden', corp.includes('body.side-slim #sideNav button[data-view]{justify-content:center;font-size:0') && corp.includes('body.side-slim #sideNav button[data-view] .badge{display:none}'));
ok('collapse arrow flip', corp.includes('#sideCollapse.flip{transform:rotate(180deg)}'));
const adm = loadPage('portal/admin.html', ADMIN);
const scb = adm.window.document.getElementById('sideCollapse');
ok('collapse button present in portal', !!scb);
ok('toggle adds body class', (() => { scb.click(); return adm.window.document.body.classList.contains('side-slim'); })());
ok('preference persisted', adm.window.localStorage.getItem('treasure_side_slim') === '1');
scb.click();
ok('toggle removes class', !adm.window.document.body.classList.contains('side-slim'));
ok('sideNav counts (22 with CoC)', adm.window.document.querySelectorAll('#sideNav button[data-view]').length === 22);
ok('admin clean', adm.errors.length === 0, adm.errors.join(' || ').slice(0, 140));

/* ---------- C. public sidebar (landing page included; login excluded; mobile unchanged) ---------- */
ok('public grid on body', corp.includes('body:not(.portal-body):not([data-page="login"]){') && corp.includes('grid-template-columns:266px minmax(0,1fr)'));
ok('navbar becomes sticky rail', corp.includes('grid-row:1/span 80') && corp.includes('height:100vh;overflow-y:auto'));
ok('rail gradient + gold edge', corp.includes('linear-gradient(180deg,#0E3B21,#0B4A26 70%,#09381E)'));
ok('stacked public links', corp.includes('.nav-links{display:flex;flex-direction:column;align-items:stretch;margin:6px 0 0') === false ? corp.includes(')>.navbar .nav-links{display:flex;flex-direction:column') : true);
ok('content pushed to column 2', corp.includes(')>.topbar{grid-column:2;grid-row:1}') && corp.includes(')>footer{grid-column:2}'));
ok('login page excluded', corp.includes(':not([data-page="login"])'));
ok('portals excluded from public grid', corp.includes('body:not(.portal-body)'));
ok('mobile keeps direct links (no hamburger)', corp.includes('@media(max-width:760px)') && !corp.includes('display:none}#navLinks') );
const idx = loadPage('index.html');
ok('index loads clean', idx.errors.length === 0, idx.errors.join(' || ').slice(0, 140));
ok('index navbar present', !!idx.window.document.querySelector('nav.navbar'));
const ab = loadPage('about.html');
ok('about loads clean', ab.errors.length === 0, ab.errors.join(' || ').slice(0, 140));

/* ---------- D. versions ---------- */
let stale = 0;
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  if (fs.readFileSync(p, 'utf8').includes('20260919-34')) { console.log('  stale -34 in', p); stale++; }
}
ok('no stale -34 versions', stale === 0);
ok('sw + dev on v35', fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v48') && dh.includes('var BUILD = "treasure-v48";'));

console.log(`\n==== BATCH35: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
