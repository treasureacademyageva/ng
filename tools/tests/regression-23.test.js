/* Suite 23: form receipts, bulk admit, unfilled-form nudges */
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
const YR = new Date().getFullYear();
const mk = (id, code, status, extra) => Object.assign(
  { id, code, status, submitted: '2026-09-20', parent: 'Mrs T', phone: '0801 111 2222', pupil: 'Kid T', amount: '5000', sender: 'S', date: '2026-09-20', ref: 'R1', form: null }, extra || {});
const filled = { surname: 'KID', first: 'K', reqclass: 'Primary 1', sex: 'Male', dob: '2018-01-01' };

/* ---------- S1 receipts ---------- */
{
  const pre = 'var d=DB.load(); d.formClaims=[' + JSON.stringify(mk('FC1', 'TF-R1', 'Pending')) + ',' + JSON.stringify(mk('FC2', 'TF-R2', 'Pending')) + ']; DB.save(d);';
  const { window: w, run } = loadPage('portal/admin.html', ADMIN, null, pre);
  run('confirmFormClaim("FC1");');
  ok('receipt issued', run('DB.load().formClaims.find(c=>c.id==="FC1").receipt') === `TA/RCPT/${YR}/0001`);
  ok('confirmedAt set', run('DB.load().formClaims.find(c=>c.id==="FC1").confirmedAt').length === 10);
  run('confirmFormClaim("FC2");');
  ok('receipt increments', run('DB.load().formClaims.find(c=>c.id==="FC2").receipt') === `TA/RCPT/${YR}/0002`);
  run('renderFormClaims();');
  ok('receipt in list', w.document.getElementById('formClaimRows').innerHTML.includes(`TA/RCPT/${YR}/0001`));
  const rep = run('window.__U.admFormHTML(DB.load().formClaims.find(c=>c.id==="FC1"),DB.load().school)');
  ok('receipt in replica', rep.includes(`TA/RCPT/${YR}/0001`));
}
{
  const pre = 'var d=DB.load(); d.formClaims=[' + JSON.stringify(mk('FC9', 'TF-R9', 'Confirmed', { receipt: `TA/RCPT/${YR}/0009` })) + ']; DB.save(d);';
  const { window: w, run } = loadPage('admission-form.html', null, null, pre);
  run('document.getElementById("trkFormPhone").value="0801 111 2222"; trackForm();');
  const h = w.document.getElementById('myClaims').innerHTML;
  ok('parent sees receipt', h.includes(`TA/RCPT/${YR}/0009`) && h.includes("copyReceipt('TF-R9')"));
}

/* ---------- S2 admit ---------- */
{
  const pre = 'var d=DB.load(); d.formClaims=[' + JSON.stringify(mk('FCA', 'TF-ADM', 'Confirmed', { form: filled })) + ']; DB.save(d);';
  const { window: w, run, errors } = loadPage('portal/admin.html', ADMIN, null, pre);
  run('renderFormClaims();');
  ok('admit button shown', w.document.getElementById('formClaimRows').innerHTML.includes("admitFormClaim('FCA')"));
  run('admitFormClaim("FCA");');
  ok('pupil created', run('DB.load().pupils.find(p=>p.name==="K KID").adm') === 'TAA/P/0018');
  ok('claim admitted', run('DB.load().formClaims[0].status') === 'Admitted');
  ok('admit modal creds', w.document.getElementById('modalBox').innerHTML.includes('Login phone'));
  const pw = run('DB.load().pupils.find(p=>p.name==="K KID").password');
  ok('new pupil can log in', run(`Auth.pupilLogin("0801 111 2222","${pw}").ok`) === true);
  ok('admit no errors', errors.length === 0, errors.join('||').slice(0, 160));
}
{
  const pre = 'var d=DB.load(); d.formClaims=[' + JSON.stringify(mk('FB1', 'TF-B1', 'Confirmed', { form: filled, pupil: 'Kid One' })) + ',' + JSON.stringify(mk('FB2', 'TF-B2', 'Confirmed', { form: filled, pupil: 'Kid Two' })) + ']; DB.save(d);';
  const { window: w, run } = loadPage('portal/admin.html', ADMIN, null, pre);
  run('window.confirm=function(){return true;}; admitAllForms();');
  ok('admit-all works', run('DB.load().formClaims.filter(c=>c.status==="Admitted").length') === 2);
  ok('admit-all pupils', run('DB.load().pupils.filter(p=>p.name==="K KID").length') === 2);
}

/* ---------- S3 nudge ---------- */
{
  const old = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
  const pre = 'var d=DB.load(); d.formClaims=[' + JSON.stringify(mk('FN1', 'TF-OLD', 'Confirmed', { submitted: old, confirmedAt: old })) + ',' + JSON.stringify(mk('FN2', 'TF-NEW', 'Confirmed')) + ']; DB.save(d);';
  const { window: w, run } = loadPage('portal/admin.html', ADMIN, null, pre);
  run('renderFormClaims();');
  const h = w.document.getElementById('formClaimRows').innerHTML;
  ok('stale flagged', h.includes('Unfilled 10 days'));
  ok('nudge wa link', h.includes('https://wa.me/2348011112222?text='));
  ok('fresh not flagged', !h.includes('Unfilled 0 days'));
}

console.log(`\n==== suite 23: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
