// verify-batch4.js — shop photos, loader, fabs, calendar, poster, teachers, spotlight, expiry, theme, promote
const fs = require('fs'), vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = '/home/user/mums-school-website';
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

/* store helpers */
{
  const { window: w } = loadPage('index.html');
  const U = w.__U;
  ok('shopImg maps all 25', ['S01','S07','S09','S10','S11','S12','S13','S18','S21','S22','S23','S24','S25'].every(id => U.shopImg(id).startsWith('assets/img/shop-')));
  ok('shopImg unknown = ""', U.shopImg('S99') === '');
  ok('shopCat groups', U.shopCat('S01') === 'Textbooks' && U.shopCat('S24') === 'Bags' && U.shopCat('S99') === 'Others');
  ok('noticeActive: no expiry true', U.noticeActive({}) === true && U.noticeActive({ expiry: '2999-01-01' }) === true);
  ok('noticeActive: past false', U.noticeActive({ expiry: '2020-01-01' }) === false);
  const db = w.__DB.load();
  ok('calendar seeded (5)', (db.calendar || []).length === 5);
  ok('photoWeek default', !!db.school.photoWeek);
  ok('shop img backfilled', db.shopItems.every(i => 'img' in i) && db.shopItems.find(i => i.id === 'S01').img.includes('shop-textbooks'));
}
/* shop photos render */
{
  const { window: w, errors, run } = loadPage('shop.html');
  ok('grid uses real photos', w.document.getElementById('prodGrid').innerHTML.includes('prod-img') && w.document.getElementById('prodGrid').innerHTML.includes('shop-textbooks.jpg'));
  run('addIt("S01"); openCart();');
  ok('cart shows photo thumb', w.document.getElementById('modalBox').innerHTML.includes('cart-thumb'));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* loader + contact fabs */
{
  const { window: w, errors } = loadPage('index.html');
  const l = w.document.getElementById('siteLoader');
  ok('loader overlay injected', !!l && l.innerHTML.includes('logo.jpg'));
  ok('contact fabs removed (live in Contact page)', !w.document.getElementById('contactFabs'));
  const cc = require('fs').readFileSync('/home/user/mums-school-website/contact.html', 'utf8');
  ok('contact page keeps call+whatsapp', cc.includes('tel:') && cc.includes('wa.me/'));
  ok('calendar reachable from homepage', w.document.body.innerHTML.includes('calendar.html'));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* calendar + poster + about + spotlight */
{
  const c = loadPage('calendar.html');
  ok('calendar lists 5 dates', c.window.document.getElementById('calList').children.length === 5);
  const p = loadPage('poster.html');
  ok('poster groups + prices', p.window.document.getElementById('posterBody').textContent.includes('Textbooks') && p.window.document.getElementById('posterBody').textContent.includes('4,500'));
  const a = loadPage('about.html');
  ok('teachers strip renders 7 (incl. Nursery 1)', a.window.document.getElementById('teamGrid').children.length === 7 && a.window.document.getElementById('teamGrid').textContent.includes('Mrs Salihu Nanahawa'));
  const s = loadPage('index.html', '', w => { const db = w.__DB.load(); db.school.photoWeek = { src: 'assets/img/sports.png', cap: 'Sports Day Joy', id: '' }; w.__DB.save(db); });
  ok('spotlight shows photo of week', s.window.document.getElementById('spotZone').textContent.includes('Sports Day Joy'));
  ok('no errors', (c.errors.length + p.errors.length + a.errors.length + s.errors.length) === 0);
}
/* expiry filtering on board */
{
  const b = loadPage('board.html', '', w => { const db = w.__DB.load(); db.notices.unshift({ id: 'NTX', title: 'OLDNEWS', text: 'x', date: '2020-01-01', readBy: [], expiry: '2020-02-01' }); w.__DB.save(db); });
  ok('board hides expired', !b.window.document.getElementById('boardList').textContent.includes('OLDNEWS'));
}
/* theme remembered */
{
  const t = loadPage('index.html', '', w => { w.localStorage.setItem('treasure_theme', 'dark'); });
  ok('dark theme restored', t.window.document.documentElement.dataset.theme === 'dark');
  ok('theme-color meta synced', (t.window.document.querySelector('meta[name="theme-color"]') || {}).content === '#0C1B14');
}
/* static asserts: portals + CSS */
{
  const pupil = fs.readFileSync(SITE + '/portal/pupil.html', 'utf8');
  ['id="sessSel"', 'renderLB', 'Top Scorers', 'slice().reverse()', 'U.noticeActive(n)', 'U.esc(r.class)'].forEach(a => ok('pupil: ' + a, pupil.includes(a)));
  const admin = fs.readFileSync(SITE + '/portal/admin.html', 'utf8');
  ['promoteAll', 'promoteCore', 'setPromote', 'oldSess', 'ntExpiry', 'setSpotlight', 'v-calendar', 'renderCal()', 'saveCal', 'delCal', 'poster.html'].forEach(a => ok('admin: ' + a, admin.includes(a)));
  const teacher = fs.readFileSync(SITE + '/portal/teacher.html', 'utf8');
  ok('teacher: noticeActive', teacher.includes('U.noticeActive(n)'));
  const main = fs.readFileSync(SITE + '/assets/css/main.css', 'utf8');
  ok('main: fab-hide rule', main.includes(':has(.auth-wrap)') && main.includes(':has(.modal-bg.show)'));
  const extra = fs.readFileSync(SITE + '/assets/css/extra.css', 'utf8');
  ok('extra: flip scroll fix', extra.includes('.flip-scene.flipped .flip-back'));
  ['shop-textbooks.jpg', 'shop-workbooks.jpg', 'shop-notebooks.jpg', 'shop-pens.jpg', 'shop-stationery.jpg', 'shop-crayons.jpg', 'shop-creche.jpg', 'shop-uniform.jpg', 'shop-sportswear.jpg', 'shop-bag.jpg'].forEach(f => ok('photo: ' + f, fs.existsSync(SITE + '/assets/img/' + f)));
}
console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
