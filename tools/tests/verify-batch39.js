/* Batch 39: admissions CTA below staff on alumni; School Settings purged from admin portal */
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
const alumni = fs.readFileSync(SITE + '/alumni.html', 'utf8');
const adminHtml = fs.readFileSync(SITE + '/portal/admin.html', 'utf8');
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'x' };
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

/* ---------- A. alumni admissions block ---------- */
ok('admissions section below staff', alumni.includes('id="admissions"') && alumni.includes('New Applicants Are Welcome') && alumni.indexOf('id="staff"') < alumni.indexOf('id="admissions"') && alumni.indexOf('id="admissions"') < alumni.indexOf('Meet Our Graduates'));
ok('CTA links to admissions + contact', alumni.includes('href="admissions.html">Start Admission') && alumni.includes('href="contact.html"'));
const al = loadPage('alumni.html');
const slots = [...al.window.document.querySelectorAll('#slotGrid .mv-card')];
ok('10 class cards rendered', slots.length === 10, 'got ' + slots.length);
ok('Creche first, Primary 6 last', slots.length === 10 && slots[0].textContent.includes('Creche') && slots[9].textContent.includes('Primary 6'));
ok('form fee shown', al.window.document.getElementById('slotFee').textContent.replace(/,/g, '') === '₦5000');
ok('session shown', al.window.document.getElementById('slotSess').textContent.length > 3);
ok('graduates wall untouched', !!al.window.document.getElementById('gradWall') && !!al.window.document.getElementById('alumWall'));
ok('alumni loads clean', al.errors.length === 0, al.errors.join(' || ').slice(0, 140));

/* ---------- B. admin purge ---------- */
for (const id of ['setName', 'setMotto', 'setPhone', 'setEmail', 'setAddress', 'setTerm', 'setSession', 'setHead', 'setGrad', 'setResume', 'setPromote']) {
  ok('purged: ' + id, !adminHtml.includes('id="' + id + '"'));
}
ok('School Settings heading gone', !adminHtml.includes('School Settings</h2>'));
ok('bank panel kept', adminHtml.includes('id="setBank"') && adminHtml.includes('id="setAcct"') && adminHtml.includes('id="setHolder"'));
ok('fees panel kept', adminHtml.includes('id="setFormFee"') && adminHtml.includes('id="feesGrid"'));
ok('supabase panel kept', adminHtml.includes('id="supUrl"') && adminHtml.includes('id="supKey"'));
ok('emergency banner kept', adminHtml.includes('id="setEmgOn"') && adminHtml.includes('emgPreset('));
ok('promoteAll still on pupils view', adminHtml.includes('window.promoteAll=function') && adminHtml.includes('onclick="promoteAll()"'));
const adm = loadPage('portal/admin.html', ADMIN);
adm.run('document.getElementById("setFormFee").value="6500"; document.getElementById("setBank").value="First Bank"; saveSettings();');
ok('saveSettings saves form fee + bank', adm.run('window.__DB.load().school.formFee') === 6500 && adm.run('window.__DB.load().school.bank.name') === 'First Bank');
ok('identity data untouched by save', adm.run('window.__DB.load().school.name') === 'Treasure Academy, Ageva' && adm.run('window.__DB.load().school.term') === 'First Term');
ok('settings view renders clean', adm.errors.length === 0, adm.errors.join(' || ').slice(0, 140));
ok('sideNav now 22 sections (CoC added)', adm.window.document.querySelectorAll('#sideNav button[data-view]').length === 22);

/* ---------- C. versions ---------- */
let stale = 0;
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules|\.git|[\\/]tools([\\/]|$)/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  if (fs.readFileSync(p, 'utf8').includes('20260919-38')) { console.log('  stale -38 in', p); stale++; }
}
ok('no stale -38 versions', stale === 0);
ok('sw + dev on v39', fs.readFileSync(SITE + '/sw.js', 'utf8').match(/treasure-v\d+/) && fs.readFileSync(SITE + '/developer.html', 'utf8').match(/var BUILD = "treasure-v\d+";/));

console.log(`\n==== BATCH39: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
