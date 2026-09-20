// verify-batch12.js — standalone sidebar, guard hardening, search, countdown,
// admissions banner, PTA meetings
const fs = require('fs'), vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = (() => {
  const w = require('path').join(__dirname, 'mums-school-website');
  if (fs.existsSync(require('path').join(w, 'assets/js/store.js'))) return w;
  return require('path').resolve(__dirname, '..', '..');
})();
const store = fs.readFileSync(SITE + '/assets/js/store.js', 'utf8');
const site = fs.readFileSync(SITE + '/assets/js/site.js', 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('PASS: ' + name); } else { fail++; console.log('FAIL: ' + name + (extra ? ' | ' + extra : '')); } };

function loadPage(page, session, seedFn, opts = {}) {
  const html = fs.readFileSync(SITE + '/' + page, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' + page, pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!window.IntersectionObserver) { window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
  window.requestAnimationFrame = window.requestAnimationFrame || (fn => setTimeout(fn, 16));
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.CSS = window.CSS || { escape: s => String(s).replace(/"/g, '') };
  window.print = () => {}; window.scrollTo = () => {};
  const allScripts = [...window.document.querySelectorAll('script:not([src])')].map(s => s.textContent);
  const scripts = (opts.firstOnly ? allScripts.slice(0, 1) : allScripts).join('\n;\n');
  const errors = [];
  window.addEventListener('error', e => errors.push('window: ' + (e.message || e.error)));
  vm.createContext(window);
  try {
    if (!opts.noStore) vm.runInContext(store, window);
    vm.runInContext(opts.noStore ? 'window.__DB=null;' : 'window.__DB=DB;', window);
    if (!opts.noStore) {
      if (session) vm.runInContext(`localStorage.setItem("treasure_session_v1", '${JSON.stringify(session)}');`, window);
      if (seedFn) seedFn(window);
    }
    if (!opts.noSite) vm.runInContext(site, window);
    vm.runInContext(scripts, window);
  } catch (e) { errors.push('THROW: ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ')); }
  try { window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true })); } catch (e) { errors.push('DCL: ' + String(e).slice(0, 160)); }
  const real = errors.filter(x => !/navigation|Not implemented/i.test(x));
  return { window, errors: real, run: code => vm.runInContext(code, window) };
}

/* standalone sidebar: no store, no site, no session */
{
  for (const [page, n] of [['portal/pupil.html', 7], ['portal/teacher.html', 9], ['portal/admin.html', 21]]) {
    const { window: w } = loadPage(page, null, null, { noStore: true, noSite: true, firstOnly: true });
    const btns = [...w.document.querySelectorAll('#sideNav button')];
    let dead = [];
    btns.forEach(b => { b.click(); const on = w.document.querySelector('.view-section.on'); if (!on || on.id !== 'v-' + b.dataset.view) dead.push(b.dataset.view); });
    ok(`${page} standalone: all switch`, btns.length === n && dead.length === 0, `n=${btns.length} dead=${dead.join(',')}`);
  }
}

/* guard hardening: no session -> clean redirect, sidebar still alive */
{
  const { window: w, errors } = loadPage('portal/pupil.html');
  ok('no-session throws cleanly', errors.some(e => e.includes('no-session')), errors.join(' || ').slice(0, 160));
  w.document.querySelector('#sideNav button[data-view="fees"]').click();
  ok('sidebar alive without session', w.document.getElementById('v-fees').classList.contains('on'));
  const css = fs.readFileSync(SITE + '/assets/css/main.css', 'utf8');
  ok('mobile sidebar above veil', css.includes('z-index:450') && css.includes('.menu-veil{position:fixed;inset:0;background:rgba(20,30,45,.45);z-index:90'));
  const path = require('path');
  const pages = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) pages.push(p); } })(SITE);
  const stale = pages.filter(p => { const s = fs.readFileSync(p, 'utf8'); return [...s.matchAll(/(?:href|src)="((?:\.\.\/)?assets\/[^"]+\.(?:css|js))"/g)].some(m => !m[1].includes('?v=20260916-12')); });
  ok('cache-bust v12 everywhere', stale.length === 0, stale.slice(0, 3).join(','));
}

/* search */
{
  const { window: w, errors, run } = loadPage('index.html');
  ok('search button in nav', !!w.document.getElementById('searchBtn'));
  run('Search.open(); Search.go("uniform");');
  ok('search finds uniform', w.document.getElementById('searchRes').innerHTML.includes('uniform.html'));
  run('Search.go("xyzqq");');
  ok('search empty state', w.document.getElementById('searchRes').textContent.includes('Nothing found'));
  run('Search.go("bus");');
  ok('search finds transport', w.document.getElementById('searchRes').innerHTML.includes('transport.html'));
  ok('search clean', errors.length === 0, errors.join(' || ').slice(0, 200));
}

/* countdown on birthdays + admissions banner + pta meetings */
{
  const b = loadPage('birthdays.html', null, win => {
    const db = win.__DB.load();
    db.teachers.forEach(t => { t.dob = '1990-01-01'; });
    const pd = new Date(); pd.setDate(pd.getDate() + 5);
    db.teachers[1].dob = pd.toISOString().slice(0, 10); db.teachers[1].name = 'Bday Star';
    db.school.headDob = '1980-06-01';
    win.__DB.save(db);
  });
  ok('birthdays countdown renders', b.window.document.getElementById('bdayCount').textContent.includes('Bday Star'), b.window.document.getElementById('bdayCount').textContent.slice(0, 100));
  const a = loadPage('admissions.html');
  ok('new-here banner', a.window.document.body.textContent.includes('New here? Start in 3 easy steps') && a.window.document.body.innerHTML.includes('portal/login.html?mode=register'));
  const { window: w, errors, run } = loadPage('portal/admin.html', { role: 'admin', refId: 'HEAD001', name: 'x' });
  run('document.getElementById("pmDate").value="2026-11-01"; document.getElementById("pmTitle").value="Test Meeting"; savePtaMt();');
  ok('pta meeting saved', w.__DB.load().ptaMeetings.some(m => m.title === 'Test Meeting') && w.document.getElementById('pmRows').textContent.includes('Test Meeting'));
  const p = loadPage('pta.html');
  ok('pta countdown live', p.window.document.getElementById('ptaNext').textContent.includes('First Term General Meeting'));
  ok('batch12 pages clean', b.errors.length === 0 && a.errors.length === 0 && errors.length === 0 && p.errors.length === 0,
    b.errors.concat(a.errors, errors, p.errors).join(' || ').slice(0, 300));
}

/* full pupil boot still personalizes */
{
  const { window: w } = loadPage('portal/pupil.html', { role: 'pupil', refId: 'P001', name: 'x' });
  w.document.querySelector('#sideNav button[data-view="overview"]').click();
  ok('pupil boot personalizes', w.document.getElementById('pageTitle').textContent.includes('Adaeze'));
}

console.log(`\n==== BATCH12: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
