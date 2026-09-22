/* Batch 32: word of the week on homepage + one-tap WhatsApp to parents of absent/late pupils */
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
const TEACHER = { role: 'teacher', refId: 'T001', name: 'x' };
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

/* ---------- A. word of the week ---------- */
const idx = loadPage('index.html');
const wow = idx.window.document.getElementById('wowCard');
ok('wow card rendered', !!wow && wow.textContent.includes('Word of the Week') && wow.textContent.includes('Meaning:') && wow.textContent.includes('Use it:'));
const WEEK = Math.floor(Date.now() / 6048e5);
const m = sitejs.match(/WOW_WORDS=\[([\s\S]*?)\];\nfunction renderWOW/);
const words = [...m[1].matchAll(/\["([A-Za-z]+)"/g)].map(x => x[1]);
ok('word matches week rotation', wow.textContent.includes(words[WEEK % words.length]), 'expected ' + words[WEEK % words.length]);
ok('word list healthy (24+ words)', words.length >= 24, 'n=' + words.length);
ok('wow css tokens + dark', corp.includes('.wow-card{') && corp.includes('[data-theme="dark"] .wow-word{color:#F5C242}'));
ok('wow boots site-wide', sitejs.includes('bootSafe(()=>renderWOW())'));
ok('page clean', idx.errors.length === 0, idx.errors.join(' || ').slice(0, 140));

/* ---------- B. absent/late WhatsApp notify ---------- */
const tch = loadPage('portal/teacher.html', TEACHER);
ok('register zone exists', !!tch.window.document.getElementById('regAbsent'));
tch.run('setMark("P017","A")');
const zone = tch.window.document.getElementById('regAbsent').innerHTML;
ok('absent row appears', zone.includes('ABSENT') && zone.includes('Majebi Benita') && zone.includes('Notify parents'));
ok('wa.me link with parent digits', zone.includes('wa.me/2348051000017?text=') && zone.includes('WhatsApp parent'));
ok('message carries name+class+date', zone.includes('was%20marked%20ABSENT') || decodeURIComponent(zone.split('text=')[1] || '').includes('was marked ABSENT'));
ok('late badge differs', (() => { tch.run('setMark("P017","L")'); return tch.window.document.getElementById('regAbsent').innerHTML.includes('LATE'); })());
tch.run('markAll("P")');
ok('all present clears zone', tch.window.document.getElementById('regAbsent').innerHTML.trim() === '');
const tch2 = loadPage('portal/teacher.html', TEACHER, null, 'var d=DB.load(); d.pupils.find(x=>x.id==="P017").phone=""; DB.save(d);');
tch2.run('setMark("P017","A")');
const z2 = tch2.window.document.getElementById('regAbsent').innerHTML;
ok('no phone -> no link, shows hint', !z2.includes('wa.me') && z2.includes('no phone on record'));
ok('teacher page clean', tch.errors.length === 0, tch.errors.join(' || ').slice(0, 140));

/* ---------- C. versions ---------- */
let stale = 0;
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  if (fs.readFileSync(p, 'utf8').includes('20260919-31')) { console.log('  stale -31 in', p); stale++; }
}
ok('no stale -31 versions', stale === 0);
ok('sw + dev on v32', fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v48') && fs.readFileSync(SITE + '/developer.html', 'utf8').includes('var BUILD = "treasure-v48";'));

/* ---------- D. dark loads ---------- */
for (const pg of ['index.html', 'portal/teacher.html']) {
  const s = pg === 'portal/teacher.html' ? TEACHER : null;
  const w = loadPage(pg, s, null, 'document.documentElement.dataset.theme="dark";');
  ok(pg + ' dark clean', w.errors.length === 0, w.errors.join(' || ').slice(0, 140));
}

console.log(`\n==== BATCH32: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
