// verify-batch3.js — suggestions 1-10 + tracker bugfix + beautification wiring
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
  const scripts = [...window.document.querySelectorAll('script:not([src])')].map(s => s.textContent).join('\n;\n');
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
const exp = new Date(); exp.setDate(exp.getDate() + 9);
const EXP = exp.toISOString().slice(0, 10);
function seedReal(w) {
  const db = w.__DB.load();
  db.newsEvents.unshift({ id: 'NE9', type: 'news', date: new Date().toISOString().slice(0, 10), title: 'Fresh Story', text: 'word '.repeat(450), image: 'assets/img/hero-kids.png', views: 5, likes: 3 });
  // REAL wizard-shaped registration (nested guardian, classApply, expiry)
  db.registrations.unshift({ id: 'REG9', ward: { first: 'Ada', surname: 'Test', classApply: 'Primary 1' }, guardian: { g1: { name: 'Mama Test', phone: '0805 123 4567' }, g2: {}, rel: 'Mother', email: '', address: 'Ageva' }, payment: { status: 'Claimed', method: 'Bank transfer', history: [] }, status: 'Pending', date: '2026-09-10', expiry: EXP });
  db.registrations.unshift({ id: 'REG8', ward: { first: 'No', surname: 'Pay' }, guardian: { g1: { phone: '0800' } }, status: 'Pending', date: '2026-09-01' }); // NO payment obj
  db.orders.unshift({ id: 'ORD0001', buyer: 'B', phone: '0801', pupil: 'Ada Test', pclass: 'Primary 1', method: 'Bank transfer', items: [{ id: 'S1', name: 'Pen', price: 200, qty: 2 }], total: 400, status: 'Pending', date: '2026-09-16' });
  w.__DB.save(db);
}

/* #1 print timetable */
{
  const { window: w, errors, run } = loadPage('class.html', '?class=Primary%201');
  ok('class has Print button', w.document.getElementById('classBody').innerHTML.includes('printTT()'));
  run('printTT()');
  const ps = w.document.getElementById('printSlip').textContent;
  ok('printTT fills slip with timetable', ps.includes('TIMETABLE') && ps.includes('Monday') && w.document.body.classList.contains('printing'));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* #8 read time */
{
  const a = loadPage('story.html', '?id=NE9', seedReal);
  ok('story shows min read', a.window.document.getElementById('storyBox').textContent.includes('min read'));
  const b = loadPage('index.html', '', seedReal);
  ok('index cards show min read', b.window.document.getElementById('newsTrack').textContent.includes('min read'));
  const c = loadPage('news.html', '', seedReal);
  ok('news rows show min read', c.window.document.getElementById('neList').textContent.includes('min read'));
  ok('no errors', (a.errors.length + b.errors.length + c.errors.length) === 0);
}
/* #7 + tracker bugfix (real reg shape) */
{
  const { window: w, errors, run } = loadPage('admissions.html', '', seedReal);
  run('document.getElementById("trkPhone").value="08051234567"; trackApp();');
  const out = w.document.getElementById('trkOut').textContent;
  ok('tracker finds nested-g1 phone (bugfix)', out.includes('Ada Test'));
  ok('tracker shows classApply (bugfix)', out.includes('Primary 1'));
  ok('tracker shows days-left countdown', /day(s)? left/.test(out));
  const db = w.__DB.load();
  ok('ensure backfills missing payment (bugfix)', db.registrations.find(r => r.id === 'REG8').payment.status === 'Unpaid' && Array.isArray(db.registrations.find(r => r.id === 'REG8').payment.history));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* #3 copy pickup */
{
  const { window: w, errors, run } = loadPage('shop.html', '', seedReal);
  run('openReceipt("ORD0001")');
  ok('receipt has Copy Message button', w.document.getElementById('modalBox').innerHTML.includes('copyPickup'));
  run('copyPickup("ORD0001")'); // jsdom: clipboard missing -> fallback -> execCommand missing -> toast, no crash
  ok('copyPickup no-crash without clipboard', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* #5 albums */
{
  const { window: w, errors, run } = loadPage('news.html', '', seedReal);
  const chips = w.document.getElementById('albumChips');
  ok('album chips: All + School Life (b14)', chips.children.length === 2 && chips.textContent.includes('School Life') && chips.textContent.includes('All Photos'));
  const allN = w.document.getElementById('masonry').children.length;
  run('setAlbum("life")');
  ok('School Life album filters', w.document.getElementById('masonry').children.length === 10 && w.document.getElementById('masonry').textContent.includes('Excursion'));
  const m = new Date().toISOString().slice(0, 7);
  run(`setAlbum("${m}")`);
  ok('month album shows fresh story only', w.document.getElementById('masonry').textContent.includes('Fresh Story'));
  run('setAlbum("")');
  ok('All restores', w.document.getElementById('masonry').children.length === allN);
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* #9 board */
{
  const { window: w, errors } = loadPage('board.html');
  ok('board renders notices', w.document.getElementById('boardList').children.length > 0);
  ok('board has print button', w.document.body.innerHTML.includes('Print for Gate Board'));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* #4 photos in bday helpers */
{
  const { window: w } = loadPage('index.html');
  const bl = w.__U.bdayList({ school: { headName: 'HM', headDob: new Date().toISOString().slice(0, 10), headPhoto: 'hm.jpg' }, teachers: [] });
  ok('bdayList carries head photo', bl[0].photo === 'hm.jpg');
}
/* beautification wiring */
{
  const idx = fs.readFileSync(SITE + '/index.html', 'utf8');
  ok('3 program arts wired', (idx.match(/prog-art/g) || []).length === 3);
  ok('5 why icons wired', (idx.match(/why-ic/g) || []).length === 5);
  const shop = fs.readFileSync(SITE + '/shop.html', 'utf8');
  ok('shop banner wired', shop.includes('shop-banner.png'));
  const login = fs.readFileSync(SITE + '/portal/login.html', 'utf8');
  ok('login art wired', login.includes('login-art.png'));
  ['stage-creche.png', 'stage-nursery.png', 'stage-primary.png', 'why-safety.png', 'why-classes.png', 'why-portal.png', 'why-meals.png', 'why-sports.png', 'shop-banner.png', 'login-art.png'].forEach(f => {
    ok('img exists: ' + f, fs.existsSync(SITE + '/assets/img/' + f));
  });
}
console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
