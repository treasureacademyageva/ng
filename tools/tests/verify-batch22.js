/* Batch 22: vercel.json+analytics, L&F in teacher/pupil portals, paid admission form */
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
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
  window.print = () => {}; window.scrollTo = () => {}; window.open = () => {}; window.requestAnimationFrame = () => 0;
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

/* ---------- vercel + analytics ---------- */
{
  const v = JSON.parse(fs.readFileSync(SITE + '/vercel.json', 'utf8'));
  const srcs = v.headers.map(h => h.source);
  ok('vercel.json headers', srcs.includes('/sw.js') && srcs.includes('/assets/(.*)') && srcs.includes('/(.*).html'));
  ok('html no-cache', JSON.stringify(v).includes('no-cache'));
  ok('assets immutable', JSON.stringify(v).includes('immutable'));
  const pages = fs.readdirSync(SITE).filter(f => f.endsWith('.html'))
    .concat(fs.readdirSync(SITE + '/portal').filter(f => f.endsWith('.html')).map(f => 'portal/' + f));
  const missing = pages.filter(f => !fs.readFileSync(SITE + '/' + f, 'utf8').includes('/_vercel/insights/script.js'));
  ok('analytics on all pages', missing.length === 0, missing.join(','));
}

/* ---------- teacher lostfound ---------- */
{
  const { window: w, run, errors } = loadPage('portal/teacher.html', TEACHER);
  w.document.querySelector('#sideNav button[data-view="lostfound"]').click();
  ok('teacher LF navigates', w.document.getElementById('v-lostfound').classList.contains('on') && w.document.getElementById('pageTitle').textContent === 'Found Items');
  run('document.getElementById("tlfItem").value="Blue Cardigan"; document.getElementById("tlfDesc").value="Left in Primary 3"; saveTLF();');
  ok('teacher LF saves', run('DB.load().lostfound[0].item') === 'Blue Cardigan' && run('DB.load().lostfound[0].by').includes('Teacher'));
  ok('teacher LF lists', w.document.getElementById('tlfRows').innerHTML.includes('Blue Cardigan'));
  ok('teacher photo helper wired', w.document.querySelector('#v-lostfound input[type="file"]').getAttribute('onchange').includes('U.photoFile'));
  ok('teacher no errors', errors.length === 0, errors.join('||').slice(0, 160));
}

/* ---------- pupil lostfound ---------- */
{
  const { window: w, run, errors } = loadPage('portal/pupil.html', PUPIL);
  w.document.querySelector('#sideNav button[data-view="lostfound"]').click();
  ok('pupil LF navigates', w.document.getElementById('v-lostfound').classList.contains('on'));
  run('document.getElementById("plfItem").value="Red Bottle"; savePLF();');
  ok('pupil LF saves', run('DB.load().lostfound[0].by').includes('Pupil'));
  ok('pupil no errors', errors.length === 0, errors.join('||').slice(0, 160));
}

/* ---------- admin + public see portal-added items ---------- */
{
  const pre = 'var d=DB.load(); d.lostfound.unshift({id:"LFT",item:"Found Cap",desc:"",date:"2026-09-20",claimed:false,by:"Teacher X"}); DB.save(d);';
  const a = loadPage('portal/admin.html', ADMIN, null, pre);
  a.run('renderLF();');
  ok('admin LF lists it', a.window.document.getElementById('lfRows').innerHTML.includes('Found Cap'));
  const p = loadPage('lost-found.html', null, null, pre);
  ok('public LF shows it', p.window.document.body.innerHTML.includes('Found Cap'));
  ok('U.photoFile shared', p.run('typeof window.__U.photoFile') === 'function');
}

/* ---------- form fee default + settings ---------- */
{
  const { run } = loadPage('portal/admin.html', ADMIN);
  ok('formFee default', run('DB.load().school.formFee') === 5000);
  run('document.getElementById("setFormFee").value="7500"; saveSettings();');
  ok('formFee saves', run('DB.load().school.formFee') === 7500);
}

/* ---------- paid admission form: claim -> confirm -> fill -> print ---------- */
{
  const { window: w, run, errors } = loadPage('admission-form.html');
  ok('price shown', w.document.getElementById('formFeeAmt').textContent.includes('5,000'));
  run('document.getElementById("cParent").value="Mrs Test"; document.getElementById("cPhone").value="0801 111 2222"; document.getElementById("cPupil").value="Test Child"; document.getElementById("cAmount").value="5000"; document.getElementById("cSender").value="MRS TEST"; document.getElementById("cDate").value="2026-09-20"; document.getElementById("cRef").value="REF123"; submitClaim();');
  const code = run('DB.load().formClaims[0].code');
  ok('claim code issued', /^TF-/.test(code), code);
  run('document.getElementById("trkFormPhone").value="0801 111 2222"; trackForm();');
  ok('track finds pending', w.document.getElementById('myClaims').innerHTML.includes('Pending'));
  ok('form no errors', errors.length === 0, errors.join('||').slice(0, 160));
}
{
  const pre = 'var d=DB.load(); d.formClaims=[{id:"FC1",code:"TF-ABC123",status:"Pending",submitted:"2026-09-20",parent:"Mrs T",phone:"0801",pupil:"Kid T",amount:"5000",sender:"S",date:"2026-09-20",ref:"R1",form:null}]; DB.save(d);';
  const { window: w, run } = loadPage('portal/admin.html', ADMIN, null, pre);
  run('renderFormClaims();');
  ok('admin lists claim', w.document.getElementById('formClaimRows').innerHTML.includes('TF-ABC123'));
  run('confirmFormClaim("FC1");');
  ok('admin confirms', run('DB.load().formClaims[0].status') === 'Confirmed');
}
{
  const form = { surname: 'OKONKWO', first: 'Adaeze', reqclass: 'Primary 1', middle: 'N', dob: '2019-01-01', sex: 'Female', health: 'No' };
  const pre = 'var d=DB.load(); d.formClaims=[{id:"FC2",code:"TF-FILLED",status:"Confirmed",submitted:"2026-09-20",parent:"Mrs O",phone:"0802",pupil:"Adaeze",amount:"5000",sender:"S",date:"2026-09-20",ref:"R2",form:' + JSON.stringify(form) + '}]; DB.save(d);';
  const { window: w, run } = loadPage('admission-form.html', null, null, pre);
  run('openFill("TF-FILLED");');
  ok('openFill prefills', w.document.getElementById('fSurname').value === 'OKONKWO');
  run('document.getElementById("fSurname").value="OKONKWO"; document.getElementById("fFirst").value="Adaeze"; document.getElementById("fReqClass").value="Primary 1"; saveAdmForm();');
  const pv = w.document.getElementById('formPreview').innerHTML;
  ok('preview replica', pv.includes('ENTRANCE APPLICATION FORM') && pv.includes('OKONKWO') && pv.includes('UNDERTAKING') && pv.includes('FOR OFFICE USE'));
  ok('preview PAID stamp', pv.includes('>PAID<'));
  const un = run('window.__U.admFormHTML({code:"X",status:"Pending",form:{surname:"S"}},DB.load().school)');
  ok('unconfirmed stamp', un.includes('PAYMENT UNCONFIRMED'));
  const src = fs.readFileSync(SITE + '/admission-form.html', 'utf8');
  ok('print css', src.includes('@media print') && src.includes('#previewWrap'));
}
{
  const pre = 'var d=DB.load(); d.formClaims=[{id:"FC3",code:"TF-VIEW",status:"Confirmed",submitted:"2026-09-20",parent:"P",phone:"1",pupil:"Kid",amount:"5000",sender:"S",date:"2026-09-20",ref:"R",form:{surname:"KID",first:"K",reqclass:"P1"}}]; DB.save(d);';
  const { window: w, run } = loadPage('portal/admin.html', ADMIN, null, pre);
  run('renderFormClaims(); viewFormClaim("FC3");');
  ok('admin views form', w.document.getElementById('modalBox').innerHTML.includes('ENTRANCE APPLICATION FORM'));
  run('printClaimForm("FC3");');
  ok('admin prints form', w.document.getElementById('printSlip').innerHTML.includes('TF-VIEW'));
}

/* ---------- links + search ---------- */
{
  ok('admissions links form', fs.readFileSync(SITE + '/admissions.html', 'utf8').includes('href="admission-form.html">Buy Admission Form'));
  ok('search finds form', site.includes('u:"admission-form.html"'));
  ok('adm css shared', fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8').includes('.adm-replica{'));
}

console.log(`\n==== BATCH22: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
