// verify-batch2.js — checks for approved features 2-10 + Latest News completion
const fs = require('fs'), path = require('path'), vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = '/home/user/mums-school-website';
const store = fs.readFileSync(path.join(SITE, 'assets/js/store.js'), 'utf8');
const site = fs.readFileSync(path.join(SITE, 'assets/js/site.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('PASS: ' + name); } else { fail++; console.log('FAIL: ' + name + (extra ? ' | ' + extra : '')); } };

function loadPage(page, query, seedFn) {
  const html = fs.readFileSync(path.join(SITE, page), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' + page + (query || ''), pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!window.IntersectionObserver) { window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
  window.requestAnimationFrame = window.requestAnimationFrame || (fn => setTimeout(fn, 16));
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
  const scripts = [...window.document.querySelectorAll('script:not([src])')].map(s => s.textContent).join('\n;\n');
  const errors = [];
  window.addEventListener('error', e => errors.push('window: ' + (e.message || e.error)));
  vm.createContext(window);
  try {
    vm.runInContext(store, window, { filename: 'store.js' });
    vm.runInContext('window.__U=U;window.__DB=DB;', window);
    if (seedFn) seedFn(window);
    vm.runInContext(site + '\n;\n' + scripts, window, { filename: 'bundle.js' });
  }
  catch (e) { errors.push('THROW: ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ')); }
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, errors, run: code => vm.runInContext(code, window) };
}

function seedCommon(w) {
  // fresh DB with known data
  const db = w.__DB.load();
  db.newsEvents.unshift({ id: 'NE9', type: 'news', date: new Date().toISOString().slice(0, 10), title: 'Fresh Story Today', text: 'Just happened', image: 'assets/img/hero-kids.png', views: 5, likes: 3 });
  db.registrations.unshift({ id: 'REG9', ward: { first: 'Ada', surname: 'Test', class: 'Primary 1' }, guardian: { name: 'Mama Test', phone: '0805 123 4567' }, payment: { status: 'Claimed', method: 'Bank transfer' }, status: 'Pending', date: '2026-09-10' });
  db.orders.unshift({ id: 'ORD0001', buyer: 'Test Buyer', phone: '0801', pupil: 'Ada Test', pclass: 'Primary 1', method: 'Bank transfer', items: [{ id: 'S1', name: 'Pen', price: 200, qty: 2 }], total: 400, status: 'Pending', date: '2026-09-16' });
  w.__DB.save(db);
}

/* ---------- store.js helpers ---------- */
{
  const { window: w, errors } = loadPage('index.html');
  ok('index loads without errors', errors.length === 0, errors.join(' || ').slice(0, 300));
  const t = w.__U;
  ok('U.isNew(today)=true', t.isNew(new Date().toISOString().slice(0, 10)) === true);
  ok('U.isNew(30d ago)=false', t.isNew('2026-08-01') === false);
  ok('U.isNew(5d future)=true', t.isNew('2026-09-20') === true);
  const bn = t.bdayNext('1990-09-16');
  ok('U.bdayNext(today)', bn instanceof w.Date && bn.getDate() === 16 && bn.getMonth() === 8);
  ok('U.bdayNext(bad)=null', t.bdayNext('') === null && t.bdayNext('2020-13-40') === null);
  const bl = t.bdayList({ school: { headName: 'HM', headDob: new Date().toISOString().slice(0, 10) }, teachers: [{ name: 'T1', class: 'Primary 1', dob: '1990-01-01' }] });
  ok('U.bdayList finds headmistress today', bl.length === 2 && bl[0].name === 'HM');
  const tt = t.timetable('Primary 1');
  ok('U.timetable 5 days x 9 slots', Object.keys(tt).length === 5 && tt.Monday.length === 9 && tt.Monday[0] === 'Assembly' && tt.Monday[4] === 'Break');
  ok('U.timetable uses class subjects', tt.Monday.includes('Mathematics') || tt.Tuesday.includes('Mathematics'));
  ok('U.ttSlots length 9', t.ttSlots().length === 9);
  const db = w.__DB.load();
  ok('emergency default exists', !!(db.school.emergency && db.school.emergency.on === false));
  ok('timetables default exists', !!db.timetables && typeof db.timetables === 'object');
  db.timetables['Primary 1'] = { Monday: ['X'] }; w.__DB.save(db);
  ok('U.getTimetable prefers custom', w.__U.getTimetable(w.__DB.load(), 'Primary 1').Monday[0] === 'X');
  ok('U.getTimetable default otherwise', Object.keys(w.__U.getTimetable(w.__DB.load(), 'Primary 2')).length === 5);
}

/* ---------- emergency banner + lightbox (site.js) ---------- */
{
  const { window: w, errors, run } = loadPage('index.html');
  const db = w.__DB.load(); db.school.emergency = { on: true, text: 'TEST ALERT 123' }; w.__DB.save(db);
  run('renderEmergency()');
  const b = w.document.getElementById('emgBanner');
  ok('emergency banner renders with text', !!b && b.textContent.includes('TEST ALERT 123'));
  run(`Lightbox.open([{src:'a.png',cap:'A'},{src:'b.png',cap:'B',storyId:'NE1'}],0)`);
  let lb = w.document.getElementById('lightbox');
  ok('lightbox opens', !!lb && lb.querySelector('.lb-img').getAttribute('src') === 'a.png');
  ok('lightbox counter removed (b14)', !lb.querySelector('.lb-count'));
  run('Lightbox.go(1)');
  lb = w.document.getElementById('lightbox');
  ok('lightbox next + story link', lb.querySelector('.lb-img').getAttribute('src') === 'b.png' && !!lb.querySelector('a[href="story.html?id=NE1"]'));
  run('Lightbox.close()');
  ok('lightbox closes', !w.document.getElementById('lightbox'));
  ok('no errors on index interactions', errors.length === 0, errors.join(' || ').slice(0, 200));
}

/* ---------- index: likes/comments/NEW + bday banner ---------- */
{
  const { window: w, errors, run } = loadPage('index.html', '', seedCommon);
  const nt = w.document.getElementById('newsTrack').textContent;
  ok('index cards show likes', /likes/.test(nt));
  ok('index cards show comments', /comments/.test(nt));
  ok('single birthday bell at top', !!w.document.getElementById('bdayBell') && !w.document.getElementById('bdayBanner'));
}
{
  // birthday logic end-to-end: headmistress birthday today shows in the top bell
  const t = new Date().toISOString().slice(0, 10);
  const bw = loadPage('index.html', '', win => { const db = win.__DB.load(); db.school.headDob = t; db.teachers.forEach(x => x.dob = '1990-01-01'); win.__DB.save(db); });
  ok('birthday bell shows headmistress today', bw.window.document.getElementById('bdayBell').textContent.includes('Happy Birthday') && bw.window.document.getElementById('bdayBell').textContent.includes('Headmistress'));
  ok('no errors', bw.errors.length === 0, bw.errors.join(' || ').slice(0, 200));
}

/* ---------- news: NEW tags + lightbox wiring ---------- */
{
  const { window: w, errors, run } = loadPage('news.html', '', seedCommon);
  ok('masonry has items', w.document.getElementById('masonry').children.length > 5);
  ok('_lbAll built (stories+10 gallery)', (w._lbAll || []).length >= 10);
  ok('NEW tag appears for fresh story', (w.document.getElementById('neList').innerHTML.includes('tag-new')));
  ok('masonry uses openLB', w.document.getElementById('masonry').innerHTML.includes('openLB('));
  run('openLB(0)');
  ok('openLB opens lightbox', !!w.document.getElementById('lightbox') && !w.document.querySelector('#lightbox .lb-count'));
  run('Lightbox.close()');
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}

/* ---------- story: NEW tag + hero lightbox ---------- */
{
  const { window: w, errors } = loadPage('story.html', '?id=NE9', seedCommon);
  const sb = w.document.getElementById('storyBox');
  ok('story renders', sb.children.length > 0);
  ok('_storyImgs set', (w._storyImgs || []).length > 0);
  const hero = w.document.getElementById('storyHero');
  ok('hero has lightbox onclick', !!hero && (hero.getAttribute('onclick') || '').includes('Lightbox.open'));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}

/* ---------- shop: order finder ---------- */
{
  const { window: w, errors, run } = loadPage('shop.html');
  seedCommon(w);
  run('openMyOrders()');
  ok('my orders has finder input', !!w.document.getElementById('ordFind'));
  run(`document.getElementById("ordFind").value="1"; findOrder();`);
  ok('findOrder("1") -> ORD0001 receipt', w.document.getElementById('modalBox').textContent.includes('ORD0001'));
  run('openMyOrders();');
  run(`document.getElementById("ordFind").value="ORD0001"; findOrder();`);
  ok('findOrder("ORD0001") works', w.document.getElementById('modalBox').textContent.includes('ORDER RECEIPT'));
  run('openMyOrders();');
  run(`document.getElementById("ordFind").value="ORD9999"; findOrder();`);
  ok('unknown ref toasts, no crash', errors.length === 0, errors.join(' || ').slice(0, 200));
}

/* ---------- admissions: status tracker ---------- */
{
  const { window: w, errors, run } = loadPage('admissions.html');
  seedCommon(w);
  run(`document.getElementById("trkPhone").value="08051234567"; trackApp();`);
  const out = w.document.getElementById('trkOut').textContent;
  ok('tracker finds REG9', out.includes('Ada Test') && out.includes('Pending'));
  run(`document.getElementById("trkPhone").value="+234 805 123 4567"; trackApp();`);
  ok('tracker normalizes +234 format', w.document.getElementById('trkOut').textContent.includes('Ada Test'));
  run(`document.getElementById("trkPhone").value="08000000000"; trackApp();`);
  ok('tracker misses unknown number', w.document.getElementById('trkOut').textContent.includes('No application found'));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}

/* ---------- class page: timetable ---------- */
{
  const { window: w, errors } = loadPage('class.html', '?class=Primary%201');
  const cb = w.document.getElementById('classBody').textContent;
  ok('class page shows timetable', cb.includes('Weekly Timetable') && cb.includes('Monday') && cb.includes('Assembly'));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
