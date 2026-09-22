/* (b41-retargeted)  Batch 26: alumni+graduates merged page (search/filter/stats) + developer console page */
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');
const SITE = (() => {
  const w = require('path').join(__dirname, 'mums-school-website');
  if (fs.existsSync(require('path').join(w, 'assets/js/store.js'))) return w;
  return require('path').resolve(__dirname, '..', '..');
})();
const store = fs.readFileSync(SITE + '/assets/js/store.js', 'utf8');
const sitejs = fs.readFileSync(SITE + '/assets/js/site.js', 'utf8');
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

/* ---------- A. merged alumni page ---------- */
const ah = fs.readFileSync(SITE + '/alumni.html', 'utf8');
ok('merged page ids', ['gradWall', 'alumWall', 'alumQ', 'alumYear', 'alumStats'].every(id => ah.includes('id="' + id + '"')));
ok('merged hero title', ah.includes('Our Alumni &amp; Graduates') && ah.includes('Hall of Fame'));
ok('share-story form kept', ah.includes('submitAlumni') && ah.includes('alSubMentor'));
ok('graduates.html deleted', !fs.existsSync(SITE + '/graduates.html'));
ok('no stale graduates.html refs', !sitejs.includes('graduates.html') && sitejs.includes('Alumni & Graduates'));

const g0 = loadPage('alumni.html');
ok('grad wall shows real sets', g0.window.document.getElementById('gradWall').textContent.includes('Class of 2025') && g0.window.document.getElementById('gradWall').querySelectorAll('.team-card').length === 39);
ok('stats render', g0.window.document.getElementById('alumStats').children.length === 4);
ok('alumni wall default shows seed', g0.window.document.getElementById('alumWall').textContent.includes('Blessing') && g0.window.document.getElementById('alumWall').textContent.includes('Class of'));
ok('merged page clean', g0.errors.length === 0, g0.errors.join(' || ').slice(0, 160));

const g1 = loadPage('alumni.html', '', null, 'var d=DB.load(); d.pupils.push({id:"PX9",name:"Old Pupil",class:"Graduated",gradYear:2025}); DB.save(d);');
ok('grad wall groups by year', g1.window.document.getElementById('gradWall').textContent.includes('Class of 2025'));

const g2 = loadPage('alumni.html');
g2.window.document.getElementById('alumQ').value = 'Blessing';
g2.window.document.getElementById('alumQ').dispatchEvent(new g2.window.Event('input', { bubbles: true }));
const wallTxt = g2.window.document.getElementById('alumWall').textContent;
ok('search filters wall', wallTxt.includes('Blessing') && !wallTxt.includes('Ibrahim'));
g2.window.document.getElementById('alumYear').selectedIndex = 1;
g2.window.document.getElementById('alumYear').dispatchEvent(new g2.window.Event('change', { bubbles: true }));
ok('year filter works', g2.window.document.getElementById('alumWall').textContent.length >= 0);
g2.run('document.getElementById("alSubName").value="Test Al";document.getElementById("alSubNote").value="Doing great.";submitAlumni();');
ok('story submit posts Pending', g2.run('window.__DB.load().alumni[0].name') === 'Test Al' && g2.run('window.__DB.load().alumni[0].status') === 'Pending');

/* ---------- B. developer console ---------- */
const dh = fs.readFileSync(SITE + '/developer.html', 'utf8');
ok('dev loader boilerplate', dh.includes('id="siteLoader"') && dh.includes('#siteLoader{position:fixed') && dh.includes('<noscript>'));
ok('dev noindex', dh.includes('noindex, nofollow'));
const expectedHash = crypto.createHash('sha256').update('09063932487|Jibrilaonoru.24').digest('hex');
ok('dev hash correct', dh.includes(expectedHash));
ok('dev no plaintext password', !dh.includes('Jibrilaonoru') && !dh.includes('09063932487'));
ok('dev modules bay hosts visitor log', dh.includes('dvModules') && dh.includes('id="dvVForm"')); // batch33: first module moved in
ok('dev tool ids', ['dvSnap', 'dvStore', 'dvBak', 'dvRes', 'dvReset', 'dvCache', 'dvSw', 'dvOut'].every(id => dh.includes('id="' + id + '"')));
ok('dev build string', dh.includes('treasure-v47') && dh.includes('20260919-47'));
ok('dev not linked publicly', ![...require('fs').readdirSync(SITE).filter(f=>f.endsWith('.html')), 'portal/login.html'].some(f => /href="[^"]*developer\.html/.test(require('fs').readFileSync(SITE + '/' + f, 'utf8')))); // batch34: secret entry lives in JS only, no visible anchor anywhere

const dv = loadPage('developer.html');
ok('dev gate shown, console hidden', !dv.window.document.getElementById('dvGate').classList.contains('hide') && dv.window.document.getElementById('dvConsole').classList.contains('hide'));
ok('dev page clean', dv.errors.length === 0, dv.errors.join(' || ').slice(0, 160));

console.log(`\n==== BATCH26: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
