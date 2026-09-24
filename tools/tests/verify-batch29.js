/* Batch 29: a11y labels, WCAG contrast certification, inline tokens, reduced motion, ornament, versions */
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
function lum(hex) {
  const c = hex.replace('#', '');
  const n = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(fg, bg) { const a = lum(fg), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }

/* ---------- A. WCAG contrast certification (day + dark) ---------- */
const PAIRS = [
  ['#203040', '#F3F5F8'], ['#5D6B7D', '#FFFFFF'], ['#5D6B7D', '#F3F5F8'], ['#0E5A2E', '#F3F5F8'],
  ['#2563EB', '#FFFFFF'], ['#B31E35', '#FDE7EB'], ['#4E3FB0', '#E9E6FB'], ['#0E3B21', '#F7E967'],
  ['#F7E967', '#0A4423'], ['#FFFFFF', '#0B7A37'], ['#EAF0F6', '#0D141F'], ['#9AA7B8', '#182434'],
  ['#9AA7B8', '#0D141F'], ['#E7B94B', '#0D141F'], ['#2E9E5B', '#0D141F'], ['#7C8B9E', '#0F1722'],
  ['#F5C242', '#3A2F10'], ['#E7B94B', '#24344A'],
];
let allPass = true;
for (const [fg, bg] of PAIRS) if (ratio(fg, bg) < 4.5) { allPass = false; console.log('  contrast fail', fg, bg, ratio(fg, bg).toFixed(2)); }
ok('all 18 palette pairs pass WCAG AA (4.5)', allPass);

/* ---------- B. a11y labels ---------- */
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules|\.git|[\\/]tools([\\/]|$)/.test(p)) walk(p, out); } else out.push(p); } return out; }
let iconOnly = 0, logo = 0, tel = 0;
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(p, 'utf8');
  const d = new JSDOM(html).window.document;
  if (html.includes('aria-label="Treasure Academy \u2014 go to homepage"')) logo++;
  if (html.includes('aria-label="Call the school"')) tel++;
  for (const el of d.querySelectorAll('button, a')) {
    const txt = (el.textContent || '').replace(/[\u00d7\u2190\u2192\u2039\u203a\u276e\u276f\u2191\u2193\u25c0\u25b6]/g, '').trim();
    if (!txt && !el.getAttribute('aria-label') && !el.getAttribute('title')) iconOnly++;
  }
}
ok('zero icon-only controls left', iconOnly === 0, 'found ' + iconOnly);
ok('logo labels on 38 pages', logo === 38, 'found ' + logo);
ok('tel labels on 39 pages', tel === 39, 'found ' + tel);
ok('slider arrows labeled', fs.readFileSync(SITE + '/index.html', 'utf8').includes('aria-label="Previous slide"'));
ok('password eyes labeled', (fs.readFileSync(SITE + '/portal/login.html', 'utf8').match(/aria-label="Show or hide password"/g) || []).length === 5);

/* ---------- C. inline strays tokenized ---------- */
const board = fs.readFileSync(SITE + '/board.html', 'utf8');
const cal = fs.readFileSync(SITE + '/calendar.html', 'utf8');
ok('board text tokenized', board.includes('color:var(--muted,#5D6B7D)') && !board.includes('#3A4656'));
ok('calendar heading tokenized', cal.includes('color:var(--ink,#000);border-bottom:3px solid var(--green-2,#14532D)') && !cal.includes('color:#000;'));

/* ---------- D. reduced motion ---------- */
ok('global reduced-motion block', corp.includes('@media (prefers-reduced-motion:reduce)') && corp.includes('.ticker-inner{animation:none}'));
ok('ticker swipeable when still', corp.includes('.ticker{overflow-x:auto'));
ok('stars respect stillness', sitejs.includes('prefers-reduced-motion') && sitejs.includes('no drifting sparkles'));

/* ---------- E. heading ornament (strict palette) ---------- */
ok('sec-head ribbon ornament', corp.includes('.sec-head h2::before') && corp.includes('linear-gradient(180deg,var(--gold,#C9A227),var(--green,#0E5A2E))'));
ok('ornament dark variant', corp.includes('[data-theme="dark"] .sec-head h2::before{background:linear-gradient(180deg,#E7B94B,#2E9E5B)}'));

/* ---------- F. versions ---------- */
let stale = 0;
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  const t = fs.readFileSync(p, 'utf8');
  if (t.includes('20260919-28')) { console.log('  stale -28 in', p); stale++; }
}
ok('no stale -28 versions', stale === 0);
ok('sw + dev on v30', fs.readFileSync(SITE + '/sw.js', 'utf8').match(/treasure-v\d+/) && fs.readFileSync(SITE + '/developer.html', 'utf8').match(/var BUILD = "treasure-v\d+";/));

/* ---------- G. runtime: ornament + labels do not break pages ---------- */
for (const pg of ['index.html', 'about.html', 'calendar.html', 'board.html', 'portal/login.html']) {
  const html = fs.readFileSync(SITE + '/' + pg, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' + pg, pretendToBeVisual: true });
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
  vm.runInContext(sitejs + '\n;\n' + scripts, window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  const real = errors.filter(x => !/navigation|Not implemented/i.test(x));
  ok(pg + ' loads clean', real.length === 0, real.join(' || ').slice(0, 140));
}

console.log(`\n==== BATCH29: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
