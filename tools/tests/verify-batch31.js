/* Batch 31: careers, fees, anthem, support, search pages + greeting strip + admin panels */
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
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'x' };

/* ---------- A. careers ---------- */
const cr = loadPage('careers.html');
ok('careers 3 jobs render', cr.window.document.querySelectorAll('#jobList .star-card').length === 3);
cr.run('document.getElementById("jaName").value="Test Teacher";document.getElementById("jaPhone").value="0805 000 1111";document.getElementById("jaQuals").value="B.Ed";document.getElementById("jaExp").value="3 years";applyJob();');
const ja = cr.run('window.__DB.load().jobApps[0]');
ok('career application saved', ja && ja.name === 'Test Teacher' && ja.status === 'Pending' && /Primary 4|Early Years|Computer/.test(ja.role));
ok('careers clean', cr.errors.length === 0, cr.errors.join(' || ').slice(0, 140));

/* ---------- B. fees ---------- */
const fe = loadPage('fees.html');
const feeRows = fe.window.document.querySelectorAll('#feeRows tr').length;
ok('fees table per class', feeRows >= 8, 'rows=' + feeRows);
ok('fees shows term', fe.window.document.getElementById('feeTermHead').textContent.includes('Term'));
ok('fees bank box', fe.window.document.getElementById('bankBox').innerHTML.length > 40);
ok('fees print button', fs.readFileSync(SITE + '/fees.html', 'utf8').includes('window.print()') && fs.readFileSync(SITE + '/fees.html', 'utf8').includes('@media print'));

/* ---------- C. anthem ---------- */
const an = loadPage('anthem.html');
ok('anthem lyrics', an.window.document.body.textContent.includes('Our God is able! Our God is able!') && an.window.document.body.textContent.includes('School Creed') && an.window.document.body.textContent.includes('School Pledge'));
const anW = loadPage('anthem.html', null, null, 'var d=DB.load(); d.school.anthemUrl="https://example.org/anthem.mp3"; DB.save(d);');
ok('anthem audio player when url set', !!anW.window.document.querySelector('#anthemAudio audio'));
ok('anthem no player when unset', !loadPage('anthem.html').window.document.querySelector('#anthemAudio audio'));

/* ---------- D. support ---------- */
const su = loadPage('support.html');
ok('thank-you wall seeds', su.window.document.querySelectorAll('#thanksWall .star-card').length === 2);
su.run('document.getElementById("spName").value="Test Giver";document.getElementById("spAmount").value="15000";pledgeNow();');
ok('pledge saved pending', su.run('window.__DB.load().supportPledges[0].name') === 'Test Giver' && su.run('window.__DB.load().supportPledges[0].status') === 'Pending');
ok('pledge shows bank after', su.window.document.getElementById('spDone').innerHTML.includes('bank transfer'));
ok('wall unchanged by pending', su.window.document.querySelectorAll('#thanksWall .star-card').length === 2);

/* ---------- E. search page ---------- */
const sh = loadPage('search.html', null, 'http://localhost/search.html?q=fees');
ok('search q prefilled', sh.window.document.getElementById('bigQ').value === 'fees');
ok('search page results', sh.window.document.getElementById('results').textContent.includes('result') && sh.window.document.getElementById('results').innerHTML.includes('fees.html'));
ok('search news group works', (function(){ sh.window.document.getElementById('bigQ').value='resumption'; sh.window.runSearch(); return sh.window.document.getElementById('results').innerHTML.includes('story.html'); })());
ok('search chips render', sh.window.document.querySelectorAll('#chips .chip').length === 10);
ok('index has new pages', ['careers.html', 'fees.html', 'anthem.html', 'support.html', 'search.html'].every(u => sitejs.includes('"' + u + '"')));
ok('veil links to full search', sitejs.includes('href="search.html"'));

/* ---------- F. greeting strip ---------- */
const idx = loadPage('index.html');
ok('greeting strip renders', !!idx.window.document.querySelector('.greet-strip') && idx.window.document.querySelector('.greet-strip').textContent.includes('Nyaase') && idx.window.document.querySelector('.greet-strip').textContent.includes('Sannu da zuwa'));
ok('greeting css tokens', fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8').includes('.greet-strip .greet{') && fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8').includes('[data-theme="dark"] .greet-strip .greet'));

/* ---------- G. admin panels ---------- */
const adm = loadPage('portal/admin.html', ADMIN);
ok('admin job apps panel', adm.window.document.getElementById('jobAppList') !== null && adm.window.document.getElementById('pledgeList') !== null);
ok('admin renders both lists', adm.window.document.getElementById('pledgeList').textContent.includes('Blessing'));
adm.run('setPledge("SPTEST","Approved")');
ok('admin pledge approve fn safe', true);

/* ---------- H. versions ---------- */
let stale = 0;
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  if (fs.readFileSync(p, 'utf8').includes('20260919-30')) { console.log('  stale -30 in', p); stale++; }
}
ok('no stale -30 versions', stale === 0);
ok('sw + dev on v31', fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v46') && fs.readFileSync(SITE + '/developer.html', 'utf8').includes('var BUILD = "treasure-v46";'));

/* ---------- I. dark-mode loads on all new pages ---------- */
for (const pg of ['careers.html', 'fees.html', 'anthem.html', 'support.html', 'search.html']) {
  const w = loadPage(pg, null, null, 'document.documentElement.dataset.theme="dark";');
  ok(pg + ' dark clean', w.errors.length === 0, w.errors.join(' || ').slice(0, 140));
}

console.log(`\n==== BATCH31: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
