/* Batch 25: glass login, portal nav tiles + logout beside theme switch, forgot-password via WhatsApp,
   fee-reminder broadcast, meeting minutes with read receipts, birthday thanks auto-news, banner schedule, photo orders */
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
const css = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
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
  vm.runInContext(site + '\n;\n' + scripts, window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, errors: errors.filter(x => !/navigation|Not implemented/i.test(x)), run: c => vm.runInContext(c, window) };
}
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'x' };
const TEACHER = { role: 'teacher', refId: 'T001', name: 'x' };
const PORTALS = ['portal/pupil.html', 'portal/teacher.html', 'portal/admin.html'];
const admHtml = fs.readFileSync(SITE + '/portal/admin.html', 'utf8');

/* ---------- A. glassmorphism ---------- */
ok('glass css day', css.includes('.auth-card,.side-card{background:rgba(255,255,255,.58)') && css.includes('backdrop-filter:blur(18px)'));
ok('glass css dark', css.includes('[data-theme="dark"] .auth-card,[data-theme="dark"] .side-card'));

/* ---------- B. portal nav tiles (4 across) ---------- */
ok('nav 4-across grid', css.includes('#sideNav{flex:1 1 100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))'));
ok('nav tile active style', css.includes('#sideNav button[data-view].on{background:linear-gradient(180deg,#177A3F,#0D5527)'));

/* ---------- C. logout beside theme switch ---------- */
for (const f of PORTALS) {
  const h = fs.readFileSync(SITE + '/' + f, 'utf8');
  ok(f + ' logout beside theme', h.includes('nav-cta-row"><button class="theme-btn"') && h.includes('</svg></button><button class="nav-logout"'));
  const seg = h.slice(h.indexOf('id="sideNav"'), h.indexOf('nav-cta-row'));
  ok(f + ' logout not in nav grid', seg.length > 0 && !seg.includes('nav-logout'));
  ok(f + ' exactly one logout', (h.match(/nav-logout/g) || []).length === 1);
  ok(f + ' no topbar text logout', !h.includes('class="portal-link" onclick="Auth.logout()"'));
}

/* ---------- D. forgot password via WhatsApp ---------- */
ok('forgot wa line', fs.readFileSync(SITE + '/portal/login.html', 'utf8').includes('wa.me/2349063932487'));
const lg = loadPage('portal/login.html');
lg.run('window.toggleFP()');
ok('forgot card opens', lg.window.document.getElementById('fpCard') && lg.window.document.getElementById('fpCard').style.display === 'flex');
lg.run('window.sendFP()');
ok('forgot guard clean', lg.errors.length === 0);

/* ---------- E. fee reminder broadcast ---------- */
ok('copy-all reminders wired', admHtml.includes('window.copyAllReminders') && admHtml.includes('Copy all ${list.length} reminders'));

/* ---------- F. meeting minutes + read receipts ---------- */
const adm = loadPage('portal/admin.html', ADMIN);
adm.run('document.getElementById("minTitle").value="Test Minutes";document.getElementById("minNotes").value="Discussed test.";window.postMinutes()');
const m0 = adm.run('window.__DB.load().meetings[0]');
ok('minutes post', m0 && m0.title === 'Test Minutes' && adm.run('window.__DB.load().meetings.length') >= 2);
ok('minutes render + receipts', adm.window.document.getElementById('minList').innerHTML.includes('Read by'));
ok('minutes hooks', admHtml.includes('renderNotices();renderMinutesA();') && admHtml.includes('__safe(()=>{ renderMinutesA(); });'));

/* ---------- G. birthday thanks -> news feed ---------- */
const neBefore = adm.run('window.__DB.load().newsEvents.length');
adm.run('window.postThanks()');
ok('thanks auto-news (admin)', adm.run('window.__DB.load().newsEvents.length') === neBefore + 1 && /says thank you/.test(adm.run('window.__DB.load().newsEvents[0].title')));
const tch = loadPage('portal/teacher.html', TEACHER);
const tnBefore = tch.run('window.__DB.load().newsEvents.length');
tch.run('window.postThanks()');
ok('thanks auto-news (teacher)', tch.run('window.__DB.load().newsEvents.length') === tnBefore + 1);

/* ---------- H. emergency banner schedule ---------- */
ok('emg window store', store.includes('emergency.start===undefined'));
ok('emg window render', site.includes('if(e.start&&today<e.start)return;'));
ok('emg settings dates + preset keep', admHtml.includes('setEmgStart') && admHtml.includes('start:(db.school.emergency||{}).start'));
const emgOff = loadPage('index.html', null, null, 'var d=DB.load(); d.school.emergency={on:true,text:"WIN TEST",start:"2026-01-01",end:"2026-01-02"}; DB.save(d);');
ok('banner auto-hidden after window', !emgOff.window.document.getElementById('emgBanner'));

/* ---------- I. photo-day package orders ---------- */
const pdh = fs.readFileSync(SITE + '/photo-day.html', 'utf8');
ok('photo order form', pdh.includes('placePhotoOrder') && pdh.includes('pkgGrid') && pdh.includes('Bank transfer to school account'));
const pd = loadPage('photo-day.html');
pd.window.document.getElementById('poBuyer').value = 'Test Parent';
pd.window.document.getElementById('poName').value = 'Test Child';
pd.window.document.getElementById('poClass').value = 'Primary 2';
pd.window.document.getElementById('poPhone').value = '0805 111 2222';
pd.run('window.pickPkg("P2")');
pd.run('window.placePhotoOrder()');
const o = pd.run('window.__DB.load().orders[0]');
ok('photo order lands in admin orders', o && String(o.items[0].name).indexOf('Photo Day') === 0 && o.total === 5000 && o.status === 'Pending');
ok('photo order shows bank box', pd.window.document.getElementById('poDone').innerHTML.includes('bank transfer'));

console.log(`\n==== BATCH25: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
