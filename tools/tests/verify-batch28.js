/* Batch 28: strict-color consolidation (all strays -> tokens), palette-red family, dead code removed, versions */
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
const main = fs.readFileSync(SITE + '/assets/css/main.css', 'utf8');
const extra = fs.readFileSync(SITE + '/assets/css/extra.css', 'utf8');
const corp = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
const allCss = main + extra + corp;
let pass = 0, fail = 0;
function ok(name, cond, extraMsg) {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('FAIL -', name, extraMsg || ''); }
}
function loadPage(page, session, url, pre) {
  const html = fs.readFileSync(SITE + '/' + page, 'utf8');
  const dom = new JSDOM(html, { url: url || ('http://localhost/' + page), pretendToBeVisual: true });
  const window = dom.window;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!window.IntersectionObserver) { window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.print = () => {}; window.scrollTo = () => {}; window.open = () => {}; window.requestAnimationFrame = () => 0;
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

/* ---------- A. strict consolidation: no off-palette strays anywhere ---------- */
for (const h of ['#F1F4F8', '#EDF0F4', '#FAFBFC', '#F7F9FB', '#F2F5F0', '#EDF3EE', '#C0392B', '#B9C3D0']) {
  const n = (allCss.match(new RegExp(h, 'gi')) || []).length;
  const allowed = (h === '#F1F4F8' || h === '#F7F9FB') ? 1 : 0; // print block keeps light constants
  ok('stray ' + h + ' <= ' + allowed, n <= allowed, 'found ' + n);
}
ok('tokens now carry surfaces', corp.includes('.portal-body{background:var(--cream)}') === false && main.includes('.portal-body{background:var(--cream)}') && extra.includes('.chat-msgs') && extra.includes('background:var(--cream)'));
ok('nav hover on mint token', corp.includes('background:var(--mint-soft);color:#0E5A2E') || (corp.match(/var\(--mint-soft\)/g) || []).length >= 5);
ok('badge grey tokenized', main.includes('.b-grey{background:var(--cream);color:var(--muted)}'));
ok('placeholder tokenized', corp.includes('::placeholder{color:var(--muted);opacity:1}'));
ok('demo-box dashed token', main.includes('.demo-box{background:var(--cream);border:1px dashed var(--line)'));

/* ---------- B. emergency banner + coral on palette ---------- */
ok('emg banner palette red', corp.includes('.emg-banner{position:sticky;top:0;z-index:600;background:#B4232A'));
ok('btn-coral on palette', corp.includes('#E5485D') && corp.includes('#B4232A') && !corp.includes('#E85D4D'));
const emg = loadPage('index.html', null, null, 'var d=DB.load(); d.school.emergency={on:true,text:"MAINT TEST"}; DB.save(d);');
ok('emg banner still renders', !!emg.window.document.getElementById('emgBanner') && emg.window.document.getElementById('emgBanner').textContent.includes('MAINT TEST'));

/* ---------- C. dead code removed ---------- */
ok('no yrsCare phantom', !fs.readFileSync(SITE + '/index.html', 'utf8').includes('yrsCare'));

/* ---------- D. dark .notice covered ---------- */
ok('dark notice rule', corp.includes('[data-theme="dark"] .notice{') && extra.includes('[data-theme="dark"] .notice{'));

/* ---------- E. versions ---------- */
let stale = 0;
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  const t = fs.readFileSync(p, 'utf8');
  if (t.includes('20260919-29')) { console.log('  stale -27 in', p); stale++; }
}
ok('no stale -27 versions', stale === 0);
ok('sw + dev on v28', fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v46') && fs.readFileSync(SITE + '/developer.html', 'utf8').includes('var BUILD = "treasure-v46";'));

/* ---------- F. dark-mode load on key complex pages ---------- */
for (const pg of ['index.html', 'admissions.html', 'news.html', 'portal/login.html', 'shop.html', 'uniform.html', 'alumni.html', 'receipt.html']) {
  if (!fs.existsSync(SITE + '/' + pg)) { ok(pg + ' exists', false); continue; }
  const w = loadPage(pg, null, null, 'document.documentElement.dataset.theme="dark";');
  ok(pg + ' dark clean', w.errors.length === 0, w.errors.join(' || ').slice(0, 140));
}

console.log(`\n==== BATCH28: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
