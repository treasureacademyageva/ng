/* (b41-retargeted)  Batch 20: portal top navigation (landing-style) replaces sidebars */
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
  const scripts = [...window.document.querySelectorAll('script:not([src]):not([type="application/ld+json"])')].map(s => s.textContent).join('\n;\n');
  const errors = [];
  window.addEventListener('error', e => errors.push(String((e.message || e.error || '').slice(0, 140))));
  vm.createContext(window);
  vm.runInContext(store, window);
  vm.runInContext('window.__DB=DB;', window);
  if (session) vm.runInContext('localStorage.setItem("treasure_session_v1", \'' + JSON.stringify(session) + '\');', window);
  if (pre) vm.runInContext(pre, window);
  vm.runInContext(site + '\n;\n' + scripts, window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, errors: errors.filter(x => !/navigation|Not implemented/i.test(x)), run: c => vm.runInContext(c, window) };
}
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'Mrs Head' };
const TEACHER = { role: 'teacher', refId: 'T001', name: 'Uncle E' };
const PUPIL = { role: 'pupil', refId: 'P001', name: 'Adaeze' };

/* ---------- structure: no sidebar, landing-style top nav ---------- */
[
  ['portal/admin.html', ADMIN, 'Headmistress Portal', 24],
  ['portal/teacher.html', TEACHER, 'Teacher Portal', 12],
  ['portal/pupil.html', PUPIL, 'Pupil Portal', 7],
].forEach(([page, sess, role, nBtns]) => {
  const { window: w, errors } = loadPage(page, sess);
  const d = w.document;
  ok(page + ' has topbar', !!d.querySelector('.topbar .tb-contact') && !!d.querySelector('.topbar .tb-right'));
  ok(page + ' has navbar', !!d.querySelector('nav.navbar .brand-name small') && d.querySelector('nav.navbar .brand-name small').textContent === role);
  ok(page + ' no sidebar', !d.querySelector('.sidebar') && !d.querySelector('.side-toggle'));
  const nav = d.querySelector('#sideNav');
  ok(page + ' nav keeps id+buttons', !!nav && nav.classList.contains('nav-links') && nav.querySelectorAll('button[data-view]').length === nBtns);
  ok(page + ' keeps user ids', !!d.getElementById('userName') && !!d.getElementById('userAvatar') && !!d.getElementById('userClass'));
  ok(page + ' keeps title ids', !!d.getElementById('pageTitle') && !!d.getElementById('pageSub') && !!d.getElementById('todayLbl'));
  ok(page + ' website link + logout by theme', !!d.querySelector('.topbar a[href="../index.html"]') && !!d.querySelector('.nav-cta-row .nav-logout'));
  ok(page + ' theme toggle', !!d.querySelector('nav.navbar .theme-btn'));
  ok(page + ' user filled', d.getElementById('userName').textContent.trim().length > 1);
  ok(page + ' no errors', errors.length === 0, errors.join('||').slice(0, 160));
});

/* ---------- router still works from top nav ---------- */
{
  const { window: w } = loadPage('portal/admin.html', ADMIN);
  w.document.querySelector('#sideNav button[data-view="results"]').click();
  ok('admin topnav click', w.document.getElementById('v-results').classList.contains('on') && w.document.getElementById('pageTitle').textContent === 'Results');
  w.document.body.classList.add('side-open');
  w.document.querySelector('#sideNav button[data-view="pupils"]').click();
  ok('side-open cleared', !w.document.body.classList.contains('side-open') && w.document.getElementById('v-pupils').classList.contains('on'));
}
{
  const { window: w } = loadPage('portal/teacher.html', TEACHER);
  w.document.querySelector('#sideNav button[data-view="register"]').click();
  ok('teacher topnav click', w.document.getElementById('v-register').classList.contains('on'));
}
{
  const { window: w } = loadPage('portal/pupil.html', PUPIL, 'http://localhost/portal/pupil.html#/fees');
  ok('pupil hash restore', w.document.getElementById('v-fees').classList.contains('on'));
  ok('pupil extras kept', !!w.document.getElementById('callSchBtn') && !!w.document.getElementById('bellBtn'));
}

/* ---------- CSS ---------- */
{
  const css = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
  ok('topnav button style', css.includes('.nav-links button[data-view]{background:none'));
  ok('topnav active state', css.includes('.nav-links button[data-view].on{background:var(--sun)'));
  ok('layout block', css.includes('.portal-layout{display:block'));
  ok('old sidebar css kept', css.includes('.sidebar::after') || fs.readFileSync(SITE + '/assets/css/main.css', 'utf8').includes('.sidebar{'));
  const admin = fs.readFileSync(SITE + '/portal/admin.html', 'utf8');
  ok('admin loads site.js', admin.includes('<script src="../assets/js/site.js?v='));
}

console.log(`\n==== BATCH20: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
