// verify-batch5.js — official style, ribbon, hero, graduates, defaulters, wishes, restock, countdown, brochure, votes, LF, siblings, fees
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

function loadPage(page, query, seedFn) {
  const html = fs.readFileSync(SITE + '/' + page, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' + page + (query || ''), pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!window.IntersectionObserver) { window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
  window.requestAnimationFrame = window.requestAnimationFrame || (fn => setTimeout(fn, 16));
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.print = () => {};
  const scripts = [...window.document.querySelectorAll('script:not([src]):not([type="application/ld+json"])')].map(s => s.textContent).join('\n;\n');
  const errors = [];
  window.addEventListener('error', e => errors.push('window: ' + (e.message || e.error)));
  vm.createContext(window);
  try {
    vm.runInContext(store, window);
    vm.runInContext('window.__U=U;window.__DB=DB;', window);
    if (seedFn) seedFn(window);
    vm.runInContext(site + '\n;\n' + scripts, window);
  } catch (e) { errors.push('THROW: ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ')); }
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, errors, run: code => vm.runInContext(code, window) };
}

/* Q1/Q3 + countdown (index) */
{
  const { window: w, errors } = loadPage('index.html');
  ok('hero uses real school photo', w.document.querySelector('.hero-figure img').getAttribute('src').includes('hero-school.jpg'));
  const mr = w.document.getElementById('mottoRibbon');
  ok('motto ribbon under navbar', !!mr && mr.textContent.toUpperCase().includes('OUR GOD IS ABLE') && mr.previousElementSibling.classList.contains('navbar'));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* store new keys */
{
  const { window: w } = loadPage('index.html');
  const db = w.__DB.load();
  ok('fees seeded per class', db.school.fees && db.school.fees['Primary 1'] === 30000 && db.school.fees['Creche'] === 30000);
  ok('restock/votes/lostfound defaults', Array.isArray(db.restock) && typeof db.teacherVotes === 'object' && Array.isArray(db.lostfound));
}
/* shop restock flow */
{
  const { window: w, errors, run } = loadPage('shop.html');
  ok('Notify Me on out-of-stock cards', w.document.getElementById('prodGrid').innerHTML.includes('restockAsk'));
  run('restockAsk("S18")');
  ok('restock modal opens', !!w.document.getElementById('rsName'));
  run('document.getElementById("rsName").value="Mama Ada"; document.getElementById("rsPhone").value="08051112222"; restockSave("S18");');
  const rs = w.__DB.load().restock;
  ok('restock alert saved', rs.length === 1 && rs[0].name === 'Mama Ada' && rs[0].item === 'S18');
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* admissions fees table */
{
  const { window: w, errors } = loadPage('admissions.html');
  const ft = w.document.getElementById('feesTable').textContent;
  ok('fees table renders', ft.includes('Primary 6') && ft.includes('35,000'));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* birthdays SMS */
{
  const { window: w, errors, run } = loadPage('birthdays.html');
  ok('wish bubbles render', w.document.getElementById('bdayGrid').innerHTML.includes('wish-bubble') && w.document.getElementById('bdayGrid').innerHTML.includes('Copy Wish'));
  run('copyWish(0)');
  ok('copyWish runs', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* graduates */
{
  const g0 = loadPage('alumni.html'); // batch26: graduates merged into alumni
  ok('graduates wall shows real sets', g0.window.document.getElementById('gradWall').textContent.includes('Class of 2025') && g0.window.document.getElementById('gradWall').querySelectorAll('.team-card').length === 39);
  const g1 = loadPage('alumni.html', '', w => { const db = w.__DB.load(); db.pupils.push({ id: 'P9', name: 'Old Pupil', class: 'Graduated', gradYear: 2025 }); w.__DB.save(db); });
  ok('graduates grouped by year', g1.window.document.getElementById('gradWall').textContent.includes('Class of 2025'));
  ok('no errors', (g0.errors.length + g1.errors.length) === 0);
}
/* class brochure */
{
  const { window: w, errors, run } = loadPage('class.html', '?class=Primary%201');
  run('printBrochure()');
  const ps = w.document.getElementById('printSlip').textContent;
  ok('brochure fills slip', ps.includes('CLASS BROCHURE') && ps.includes('Class Teacher') && ps.includes('Monday'));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* teacher votes */
{
  const { window: w, errors, run } = loadPage('alumni.html');
  ok('public wall is display-only (no vote buttons)', (w.document.querySelectorAll('[data-vote]').length) === 0);
  run('voteTeacher("T001")');
  ok('vote counted', w.__DB.load().teacherVotes['T001'] === 1);
  run('voteTeacher("T001")');
  ok('second vote blocked (monthly)', w.__DB.load().teacherVotes['T001'] === 1);
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* board lost & found */
{
  const b = loadPage('board.html', '', w => { const db = w.__DB.load(); db.lostfound = [{ id: 'L1', item: 'Blue Cardigan', desc: 'left in Primary 2', date: '2026-09-10', claimed: false }, { id: 'L2', item: 'Old Cap', desc: '', date: '2026-09-01', claimed: true }]; w.__DB.save(db); });
  const lf = b.window.document.getElementById('lfList').textContent;
  ok('board shows unclaimed only', lf.includes('Blue Cardigan') && !lf.includes('Old Cap'));
  ok('no errors', b.errors.length === 0, b.errors.join(' || ').slice(0, 200));
}
/* static: admin, pupil, CSS, site */
{
  const admin = fs.readFileSync(SITE + '/portal/admin.html', 'utf8');
  ['defZone', 'renderDefaulters', 'rsRows', 'renderRestock', 'delRestock', 'lfItem', 'saveLF', 'renderLF', 'claimLF', 'delLF', 'feesGrid', 'buildFeesGrid', 'gradYear', '<th>Votes</th>', 'renderLF();'].forEach(a => ok('admin: ' + a, admin.includes(a)));
  const pupil = fs.readFileSync(SITE + '/portal/pupil.html', 'utf8');
  ['childSel', 'const SP=', 'sibs', 'SPid'].forEach(a => ok('pupil: ' + a, pupil.includes(a)));
  const css = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
  ok('css: flat official mint', css.includes('.btn-mint{background:#0B7A37;'));
  ok('css: motto ribbon', css.includes('.motto-ribbon'));
  ok('css: count bar', css.includes('.count-bar'));
  ok('css: wish bubble', css.includes('.wish-bubble'));
  const sj = fs.readFileSync(SITE + '/assets/js/site.js', 'utf8');
  ok('site: renderMotto', sj.includes('renderMotto') && fs.readFileSync(SITE + '/alumni.html', 'utf8').includes('Our Alumni &amp; Graduates')); // batch26: merged page
  ok('hero photo exists', fs.existsSync(SITE + '/assets/img/hero-school.jpg'));
}
console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
