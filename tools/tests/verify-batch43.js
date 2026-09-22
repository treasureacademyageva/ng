/* Batch 43: Treasure typography (self-hosted Treasure Sans/Serif, no Google CDN), Treasure FX (seg tabs, count-up, tilt, stagger, ripple, scrollspy), brand motif, alumni UX architecture */
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
const alumni = fs.readFileSync(SITE + '/alumni.html', 'utf8');
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

/* ---------- A. typography (studio-grade, self-hosted) ---------- */
ok('six Treasure font files on disk', ['treasure-sans-400','treasure-sans-500','treasure-sans-600','treasure-sans-700','treasure-serif-600','treasure-serif-700'].every(f => fs.existsSync(SITE + '/assets/fonts/' + f + '.woff2')));
ok('@font-face declares Treasure Sans + Serif', (corp.match(/@font-face/g) || []).length === 6 && corp.includes('font-family:"Treasure Sans"') && corp.includes('font-family:"Treasure Serif"'));
ok('tokens rebound to Treasure fonts', corp.includes('--font-head:"Treasure Serif",Georgia') && corp.includes('--font-body:"Treasure Sans","Segoe UI"'));
let g = 0; const pages = [];
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  const s = fs.readFileSync(p, 'utf8');
  if (/googleapis|gstatic/.test(s)) { g++; pages.push(p); }
}
ok('Google Fonts CDN removed everywhere', g === 0, pages.join(' ').slice(0, 120));

/* ---------- B. fx layer ---------- */
ok('fx block in site.js', sitejs.includes('BATCH 43 (2026-09-21)') && sitejs.includes('pointerdown') && sitejs.includes('__fxTabsRescan'));
ok('fx css present', corp.includes('.seg-ink{') && corp.includes('.fx-ripple{') && corp.includes('.spy-bar{') && corp.includes('.tilt{') && corp.includes('.stag-in{'));
ok('brand motif defined + applied', corp.includes('--motif:url(') && corp.includes('background-image:var(--motif)'));
ok('reduced-motion respect', corp.includes('prefers-reduced-motion: reduce'));

/* ---------- C. alumni architecture ---------- */
ok('spy nav bar', alumni.includes('id="alumNav"') && alumni.includes('class="spy-bar"') && alumni.includes('href="#graduates"'));
ok('graduates section id', alumni.includes('class="sec-head clip-up" id="graduates"'));
ok('seg tabs markup', alumni.includes('id="gradTabs"') && alumni.includes('data-seg="all"') && alumni.includes('data-seg="2025"') && alumni.includes('data-seg="2023"'));
ok('grad panes in render', alumni.includes('data-seg-pane="${U.esc(String(y))}"') && alumni.includes('window.__fxTabsRescan'));
ok('score teaser on grad cards', alumni.includes('Total ${p.exam.total}/240'));
ok('count-up on stats', alumni.includes('data-countup>${U.esc(String(s[1]))}</span>'));
ok('tilt on people cards', (alumni.match(/staff-click tilt/g) || []).length >= 2);

/* ---------- D. live ---------- */
const al = loadPage('alumni.html', null, 'http://localhost/alumni.html');
ok('alumni loads clean', al.errors.length === 0, al.errors.join(' || ').slice(0, 140));
const panes = al.window.document.querySelectorAll('#gradWall .grad-pane');
ok('2 set panes rendered', panes.length === 2, 'got ' + panes.length);
const shown = () => [...al.window.document.querySelectorAll('#gradWall .grad-pane.show')];
ok('all sets shown by default', shown().length === 2);
ok('39 cards present + 38 stats intact', al.window.document.querySelectorAll('#gradWall .team-card').length === 39 && al.window.document.getElementById('alumStats').children.length === 4);
const tab23 = [...al.window.document.querySelectorAll('#gradTabs .seg-tab')].find(t => t.getAttribute('data-seg') === '2023');
tab23.click();
ok('clicking 2023 hides 2025 pane', shown().length === 1 && shown()[0].getAttribute('data-seg-pane') === '2023');
const shownCards23 = shown()[0].querySelectorAll('.team-card').length;
ok('18 cards visible in 2023 pane', shownCards23 === 18, 'got ' + shownCards23);
const tabAll = [...al.window.document.querySelectorAll('#gradTabs .seg-tab')].find(t => t.getAttribute('data-seg') === 'all');
tabAll.click();
const tab25 = [...al.window.document.querySelectorAll('#gradTabs .seg-tab')].find(t => t.getAttribute('data-seg') === '2025');
tab25.click();
ok('clicking 2025 shows only 2025 pane', shown().length === 1 && shown()[0].getAttribute('data-seg-pane') === '2025' && shown()[0].querySelectorAll('.team-card').length === 21);
ok('ink underline moves', al.window.document.querySelector('#gradTabs .seg-ink').style.width !== '');
const statsText = al.window.document.getElementById('alumStats').textContent;
ok('stats final values intact (no ticking under stub)', statsText.includes('39') && statsText.includes('2'));
ok('tilt class on staff cards', al.window.document.querySelectorAll('#teamGrid .team-card.tilt').length === 10);
ok('spy bar links present', al.window.document.querySelectorAll('#alumNav a').length === 5 && al.window.document.querySelector('#alumNav a.on'));

/* ---------- E. versions ---------- */
let stale = 0;
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  if (fs.readFileSync(p, 'utf8').includes('20260919-42')) { stale++; }
}
ok('no stale -42 versions', stale === 0);
ok('sw + dev on v43', fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v46') && fs.readFileSync(SITE + '/developer.html', 'utf8').includes('var BUILD = "treasure-v46";'));

console.log(`\n==== BATCH43: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
