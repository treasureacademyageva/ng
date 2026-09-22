/* Batch 27: strict color system, night-mode completion, inline hex → tokens, story id fix, receipt print, polish */
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
const css = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
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
  window.print = () => {}; window.scrollTo = () => {}; window.open = () => {}; window.requestAnimationFrame = () => 0;
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
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

/* ---------- A. strict color system present ---------- */
ok('strict rule documented', css.includes('BATCH 27 (2026-09-20)') && css.includes('THE RULE') && css.includes('never new colors') === false && css.includes('No component may hardcode'));
ok('day polish tokens', css.includes('::placeholder{color:var(--muted);opacity:1}') && css.includes(':focus-visible{outline:3px solid rgba(201,162,39,.5)'));
ok('night polish tokens', css.includes('[data-theme="dark"] ::placeholder{color:#7C8B9E}') && css.includes('[data-theme="dark"] ::selection{background:#E7B94B'));
ok('card hover elevation', css.includes('.mv-card:hover,.team-card:hover,.star-card:hover{transform:translateY(-3px)'));
ok('empty state themed both', css.includes('.empty{border:1.5px dashed var(--line);border-radius:12px;background:var(--white)}') && css.includes('[data-theme="dark"] .empty{background:#101B28}'));
ok('receipt print block', css.includes('@media print{') && css.includes('body[data-page="receipt"] .page-hero'));

/* ---------- B. inline hexes converted to tokens ---------- */
const login = fs.readFileSync(SITE + '/portal/login.html', 'utf8');
const pupil = fs.readFileSync(SITE + '/portal/pupil.html', 'utf8');
const teacher = fs.readFileSync(SITE + '/portal/teacher.html', 'utf8');
const admin = fs.readFileSync(SITE + '/portal/admin.html', 'utf8');
const pta = fs.readFileSync(SITE + '/pta.html', 'utf8');
ok('login chips tokenized', !login.includes('#F1F4F8') && (login.match(/background:var\(--white\);font-weight:800/g) || []).length === 2);
ok('pupil chip + ID card tokenized', !pupil.includes('#F1F4F8') && pupil.includes('background:var(--white);color:var(--ink)') && pupil.includes('border:2px dashed var(--green)'));
ok('teacher duty highlight tokenized', !teacher.includes('#FFF3D1') && teacher.includes("background:var(--sun-soft)"));
ok('admin duty highlight tokenized', !admin.includes('#FFF3D1') && admin.includes("background:var(--sun-soft)"));
ok('pta note tokenized', !pta.includes('#F7F9FB') && pta.includes('background:var(--white);border-radius:10px;font-size:.9rem'));

/* ---------- C. story.html duplicate id fixed ---------- */
const story = fs.readFileSync(SITE + '/story.html', 'utf8');
ok('story single storyHero', (story.match(/id="storyHero"/g) || []).length === 1 && story.includes('id="storyHeroAlt"'));
ok('swapHero fallback', story.includes('getElementById("storyHero")||document.getElementById("storyHeroAlt")'));
const st = loadPage('story.html', '?id=NE9', null, 'var d=DB.load(); d.newsEvents.unshift({id:"NE9",type:"news",date:U.todayStr(),title:"T",text:"x",image:"assets/img/hero-kids.png",views:0,likes:0}); DB.save(d);');
ok('story image-only hero intact', !!st.window.document.getElementById('storyHero') && !st.window.document.getElementById('storyHeroAlt'));

/* ---------- D. versions bumped ---------- */
let stale = 0;
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  const t = fs.readFileSync(p, 'utf8');
  if (t.includes('20260919-29')) { console.log('  stale -26 in', p); stale++; }
}
ok('no stale -26 asset versions', stale === 0);
ok('sw + dev build v27', fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v47') && fs.readFileSync(SITE + '/developer.html', 'utf8').includes('var BUILD = "treasure-v47";'));

/* ---------- E. runtime: pages load clean in night mode ---------- */
for (const pg of ['index.html', 'alumni.html', 'receipt.html', 'admission-form.html']) {
  const w = loadPage(pg, null, null, 'document.documentElement.dataset.theme="dark";');
  ok(pg + ' dark clean', w.errors.length === 0, w.errors.join(' || ').slice(0, 140));
}

console.log(`\n==== BATCH27: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
