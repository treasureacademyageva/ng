/* Batch 24: night-mode ticker fix, demo logout buttons, admission stats, receipt page, auto-archive */
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
const PUPIL = { role: 'pupil', refId: 'P001', name: 'x' };
const mk = (id, code, status, extra) => Object.assign(
  { id, code, status, submitted: '2026-09-20', parent: 'Mrs T', phone: '0801 111 2222', pupil: 'Kid T', amount: '5000', sender: 'S', date: '2026-09-20', ref: 'R1', form: null }, extra || {});
const filled = { surname: 'KID', first: 'K', reqclass: 'Primary 1', sex: 'Male', dob: '2018-01-01' };

/* ---------- T ticker night-mode fix ---------- */
{
  const pre = 'var d=DB.load(); d.ticker={on:true,text:"Batch24 ticker test"}; DB.save(d);';
  const { window: w } = loadPage('index.html', null, null, pre);
  ok('ticker renders', !!w.document.getElementById('newsTicker'));
  const halves = w.document.querySelectorAll('#newsTicker .tick-half');
  ok('seamless halves', halves.length === 2 && halves[0].innerHTML === halves[1].innerHTML, `n=${halves.length}`);
  ok('30fps frame skip', site.includes('++frame%2'));
  ok('no shadowBlur', !site.includes('shadowBlur'));
  ok('ticker compositor css', css.includes('will-change:transform') && css.includes('.ticker-inner>.tick-half'));
}

/* ---------- L demo logout ---------- */
{
  const s = { role: 'pupil', refId: 'P001', name: 'Adaeze Demo' };
  const { window: w } = loadPage('portal/login.html', s);
  const h = w.document.getElementById('sessCard').innerHTML;
  ok('login session card', h.includes('Adaeze Demo') && h.includes('Continue') && h.includes('Auth.logout()') && h.includes('href="pupil.html"'), h.slice(0, 120));
}
{
  const { window: w } = loadPage('portal/login.html');
  ok('no card when logged out', w.document.getElementById('sessCard').innerHTML === '');
}
{
  const a = loadPage('portal/admin.html', ADMIN);
  ok('nav logout admin', !!a.window.document.querySelector('.nav-cta-row .nav-logout') && !a.window.document.querySelector('#sideNav .nav-logout'));
  const t = loadPage('portal/teacher.html', TEACHER);
  ok('nav logout teacher', !!t.window.document.querySelector('.nav-cta-row .nav-logout') && !t.window.document.querySelector('#sideNav .nav-logout'));
  const pPre = 'var d=DB.load(); d.pupils.push({id:"P001",adm:"TAA/P/0001",name:"Test Pupil",phone:"0801 111 2222",password:"1234",class:"Primary 1"}); DB.save(d);';
  const p = loadPage('portal/pupil.html', { role: 'pupil', refId: 'P001', name: 'Test Pupil' }, null, pPre);
  ok('nav logout pupil', !!p.window.document.querySelector('.nav-cta-row .nav-logout') && !p.window.document.querySelector('#sideNav .nav-logout'));
}

/* ---------- S admission stats ---------- */
{
  const pre = 'var d=DB.load(); d.formClaims=[' + JSON.stringify(mk('S1', 'TF-S1', 'Pending'))
    + ',' + JSON.stringify(mk('S2', 'TF-S2', 'Confirmed', { receipt: 'TA/RCPT/2026/0001', form: filled }))
    + ',' + JSON.stringify(mk('S3', 'TF-S3', 'Confirmed', { receipt: 'TA/RCPT/2026/0002' }))
    + ',' + JSON.stringify(mk('S4', 'TF-S4', 'Admitted', { receipt: 'TA/RCPT/2026/0003', form: filled })) + ']; DB.save(d);';
  const { window: w, run, errors } = loadPage('portal/admin.html', ADMIN, null, pre);
  run('renderOverview();');
  const h = w.document.getElementById('formStats').innerHTML;
  ok('stats counts', h.includes('<b>4</b>') && h.includes('<b>2</b>') && h.includes('<b>1</b>') && h.includes('Forms Sold') && h.includes('Confirmed') && h.includes('Filled') && h.includes('Admitted'), h.slice(0, 200));
  ok('stats collected', h.includes('₦15,000'));
  ok('stats no errors', errors.length === 0, errors.join('||').slice(0, 160));
}

/* ---------- R receipt page ---------- */
{
  const pre = 'var d=DB.load(); d.formClaims=[' + JSON.stringify(mk('R1', 'TF-RC1', 'Confirmed', { receipt: 'TA/RCPT/2026/0001', pupil: 'Kid Receipt', confirmedAt: '2026-09-20' })) + ']; DB.save(d);';
  const { window: w } = loadPage('receipt.html', null, 'http://localhost/receipt.html?r=TA%2FRCPT%2F2026%2F0001', pre);
  const h = w.document.getElementById('rcptBox').innerHTML;
  ok('receipt renders', h.includes('TA/RCPT/2026/0001') && h.includes('PAID') && h.includes('Kid Receipt') && h.includes('window.print()'), h.slice(0, 160));
}
{
  const { window: w } = loadPage('receipt.html', null, 'http://localhost/receipt.html?r=NOPE');
  ok('receipt not found', w.document.getElementById('rcptBox').innerHTML.includes('not found'));
}
{
  const pre = 'var d=DB.load(); d.formClaims=[' + JSON.stringify(mk('R9', 'TF-R9', 'Confirmed', { receipt: 'TA/RCPT/2026/0009' })) + ']; DB.save(d);';
  const { window: w, run } = loadPage('admission-form.html', null, null, pre);
  run('document.getElementById("trkFormPhone").value="0801 111 2222"; trackForm();');
  ok('track links receipt', w.document.getElementById('myClaims').innerHTML.includes('receipt.html?r='));
}

/* ---------- A auto-archive ---------- */
{
  const old = new Date(Date.now() - 200 * 864e5).toISOString().slice(0, 10);
  const pre = 'var d=DB.load(); d.formClaims=[' + JSON.stringify(mk('AO1', 'TF-OLD', 'Confirmed', { submitted: old, confirmedAt: old })) + ',' + JSON.stringify(mk('AO2', 'TF-NEW', 'Confirmed')) + ']; DB.save(d);';
  const { window: w, run } = loadPage('portal/admin.html', ADMIN, null, pre);
  run('renderFormClaims();');
  const h1 = w.document.getElementById('formClaimRows').innerHTML;
  ok('old hidden', !h1.includes('TF-OLD') && h1.includes('TF-NEW') && h1.includes('Show archived (1)'), h1.slice(0, 200));
  run('toggleArchive();');
  const h2 = w.document.getElementById('formClaimRows').innerHTML;
  ok('archive toggle', h2.includes('TF-OLD') && h2.includes('Archived') && h2.includes('Hide archived (1)'));
  ok('archive threshold', run('FORM_ARCHIVE_DAYS') === 120);
}

console.log(`\n==== BATCH24: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
