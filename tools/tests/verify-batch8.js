// verify-batch8.js — contrast pass, backgrounds, T007, uniform/openday/reading/alumni, emergency,
// reminders, parts, meetings, grad countdown, print css
const fs = require('fs'), vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = require('path').resolve(__dirname, '..', '..');
const store = fs.readFileSync(SITE + '/assets/js/store.js', 'utf8');
const site = fs.readFileSync(SITE + '/assets/js/site.js', 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('PASS: ' + name); } else { fail++; console.log('FAIL: ' + name + (extra ? ' | ' + extra : '')); } };

function loadPage(page, session, seedFn) {
  const html = fs.readFileSync(SITE + '/' + page, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' + page, pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!window.IntersectionObserver) { window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
  window.requestAnimationFrame = window.requestAnimationFrame || (fn => setTimeout(fn, 16));
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.CSS = window.CSS || { escape: s => String(s).replace(/"/g, '') };
  window.print = () => {};
  const scripts = [...window.document.querySelectorAll('script:not([src])')].map(s => s.textContent).join('\n;\n');
  const errors = [];
  window.addEventListener('error', e => errors.push('window: ' + (e.message || e.error)));
  vm.createContext(window);
  try {
    vm.runInContext(store, window);
    vm.runInContext('window.__DB=DB;', window);
    if (session) vm.runInContext(`localStorage.setItem("treasure_session_v1", '${JSON.stringify(session)}');`, window);
    if (seedFn) seedFn(window);
    vm.runInContext(site + '\n;\n' + scripts, window);
  } catch (e) { errors.push('THROW: ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ')); }
  try { window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true })); } catch (e) { errors.push('DCL: ' + String(e).slice(0, 160)); }
  const real = errors.filter(x => !/navigation|Not implemented/i.test(x));
  return { window, errors: real, run: code => vm.runInContext(code, window) };
}
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'Mrs. Salihu Nanahawa' };

/* data: Nursery 1 teacher + seeds */
{
  const { window: w, run } = loadPage('index.html');
  const t = run('DB.load().teachers.find(t=>t.class==="Nursery 1")');
  ok('T007 teaches Nursery 1', t && t.name === 'Mrs Salihu Nanahawa' && t.id === 'T007');
  run('db=DB.load(); db.teachers=db.teachers.filter(t=>t.id!=="T007"); DB.save(db); DB.load();');
  ok('old saves gain T007', run('DB.load().teachers.some(t=>t.class==="Nursery 1")') === true);
  const db = w.__DB.load();
  ok('new seeds present', db.uniform.length === 8 && db.openday.date === '2026-10-03' && db.reading.book.title.includes('Tortoise') && db.meetings.length === 1 && db.alumni.length === 2 && db.school.gradDate === '2027-07-23');
  ok('avatar palette deepened', !store.includes('"#F5C242","#E5485D"') && store.includes('#B78A12'));
}
/* css static */
{
  const css = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
  const need = ['[data-theme="dark"] .b-green{background:#123B26;color:#7BD89F}', '[data-theme="dark"] .b-sun',
    '[data-theme="dark"] .p-stat', '[data-theme="dark"] .hw-row', '[data-theme="dark"] .slot,',
    '[data-theme="dark"] .star-card', '[data-theme="dark"] .bday-bell', '[data-theme="dark"] .login-card',
    '[data-theme="dark"] .form-card', '[data-theme="dark"] .mv-card', '[data-theme="dark"] .quote-card',
    '[data-theme="dark"] .tl-item', '[data-theme="dark"] .pill-date', '[data-theme="dark"] .promo-sun',
    '[data-theme="dark"] .chat-chips button', '[data-theme="dark"] .icon-btn.ok', '[data-theme="dark"] .stock{',
    '[data-theme="dark"] .like-btn.on', '.avatar{color:#fff!important',
    '.hero::before', '.page-hero::after', '.stats-band::before', '.cta-band::before', '.sidebar::after',
    '@media print', 'color:#203040!important', '.foot-bottom{color:#A7B5AD}'];
  const missing = need.filter(n => !css.includes(n));
  ok('contrast+background+print css present', missing.length === 0, missing.join(' | ').slice(0, 300));
}
/* new pages */
{
  const u = loadPage('uniform.html');
  ok('uniform lists 8 priced items', u.window.document.getElementById('uniList').textContent.includes('School Cardigan') && u.window.document.getElementById('uniList').textContent.includes('NGN'));
  ok('uniform clean', u.errors.length === 0, u.errors.join(' || ').slice(0, 200));
  const o = loadPage('openday.html');
  ok('openday shows event', o.window.document.getElementById('odCard').textContent.includes('Future School'));
  o.run('document.getElementById("rsvName").value="RSVP Mum"; document.getElementById("rsvPhone").value="08099990000"; sendRSVP();');
  ok('rsvp stored', o.window.__DB.load().rsvps.length === 1);
  ok('openday clean', o.errors.length === 0, o.errors.join(' || ').slice(0, 200));
  const r = loadPage('reading.html');
  ok('reading shows book+story', r.window.document.getElementById('bookCard').textContent.includes('Tortoise') && r.window.document.getElementById('storyCard').textContent.includes('Adaeze'));
  ok('reading clean', r.errors.length === 0, r.errors.join(' || ').slice(0, 200));
  const a = loadPage('alumni.html');
  ok('alumni wall shows grads', a.window.document.getElementById('alumWall').textContent.includes('Blessing') && a.window.document.getElementById('alumWall').textContent.includes('Class of'));
  ok('alumni clean', a.errors.length === 0, a.errors.join(' || ').slice(0, 200));
}
/* emergency banner */
{
  const on = loadPage('index.html', null, win => { const db = win.__DB.load(); db.school.emergency = { on: true, text: 'TEST ALERT' }; win.__DB.save(db); });
  ok('emergency shows when on', !!on.window.document.getElementById('emgBanner') && on.window.document.getElementById('emgBanner').textContent.includes('TEST ALERT'));
  const off = loadPage('index.html');
  ok('emergency hidden when off', !off.window.document.getElementById('emgBanner'));
  ok('quick-strip links uniform', off.window.document.querySelector('.quick-strip').innerHTML.includes('uniform.html'));
}
/* admin: settings + extras + reminders + parts */
{
  const { window: w, errors, run } = loadPage('portal/admin.html', ADMIN);
  ok('grad field exists', !!w.document.getElementById('setGrad'));
  run('document.getElementById("setGrad").value="2027-07-30"; saveSettings();');
  ok('gradDate saved', w.__DB.load().school.gradDate === '2027-07-30');
  run('document.getElementById("unName").value="Test Cap"; document.getElementById("unPrice").value="3000"; saveUniform();');
  ok('uniform added', w.__DB.load().uniform.length === 9);
  run('delUniform("UN1");');
  ok('uniform deleted', w.__DB.load().uniform.length === 8);
  run('document.getElementById("odTheme").value="OD TEST"; saveOpenday();');
  ok('openday saved', w.__DB.load().openday.theme === 'OD TEST');
  run('document.getElementById("rsvRows"); db=DB.load(); db.rsvps.unshift({id:"RSX",name:"X",phone:"1",kids:"1",cls:"",date:"2026-09-16"}); DB.save(db); renderOpenday(); delRSVP("RSX");');
  ok('rsvp deleted', w.__DB.load().rsvps.length === 0);
  run('document.getElementById("rdBookT").value="BOOK TEST"; saveReading();');
  ok('reading saved', w.__DB.load().reading.book.title === 'BOOK TEST');
  run('document.getElementById("mtTitle").value="MT TEST"; saveMeeting();');
  ok('meeting posted', w.__DB.load().meetings[0].title === 'MT TEST');
  run('document.getElementById("alName").value="AL TEST"; saveAlumni();');
  ok('alumni added', w.__DB.load().alumni[0].name === 'AL TEST');
  run('delAlumni("AL1");');
  ok('alumni deleted', !w.__DB.load().alumni.some(a => a.id === 'AL1'));
  run('db=DB.load(); db.registrations.push({id:"RZ",status:"Pending",ward:{first:"Fee",surname:"Kid",gender:"M",dob:"2020-01-01",classApply:"Primary 1"},guardian:{g1:{name:"Fee Parent",phone:"080"},g2:{},rel:"Father",email:"",address:"x"},payment:{status:"Unpaid",method:"x"},date:"2026-09-16",expiry:"2026-09-30"}); DB.save(db);');
  const txt = run('r=DB.load().registrations.find(x=>x.id==="RZ"); reminderText(r);');
  ok('reminder text built', txt.includes('Fee Parent') && txt.includes('30,000') && txt.includes('bank transfer'), txt.slice(0, 120));
  run('viewReg("RZ"); document.getElementById("paAmt").value="10000"; document.getElementById("paDate").value="2026-09-16"; document.getElementById("paRef").value="REF1"; addPart("RZ");');
  const rz = w.__DB.load().registrations.find(x => x.id === 'RZ');
  ok('instalment recorded', rz.payment.parts.length === 1 && run('feeBalance(DB.load().registrations.find(x=>x.id==="RZ"))') === 20000);
  run('delPart("RZ",0);');
  ok('instalment removed', w.__DB.load().registrations.find(x => x.id === 'RZ').payment.parts.length === 0);
  ok('admin clean', errors.length === 0, errors.join(' || ').slice(0, 300));
}
/* teacher meetings ack */
{
  const { window: w, errors, run } = loadPage('portal/teacher.html', { role: 'teacher', refId: 'T002', name: 'T' });
  ok('meetings listed', w.document.getElementById('meetList').textContent.includes('Welcome Back'));
  run('ackMeeting("MT1");');
  ok('ack recorded', w.__DB.load().meetings.find(m => m.id === 'MT1').ack.includes('T002'));
  ok('teacher clean', errors.length === 0, errors.join(' || ').slice(0, 300));
}
/* pupil grad countdown + slip parts */
{
  const { window: w, errors } = loadPage('portal/pupil.html', { role: 'pupil', refId: 'P1X', name: 'P' }, win => {
    const db = win.__DB.load();
    db.pupils.push({ id: 'P1X', adm: 'TA/2021/100', password: '1234', name: 'Grad Kid', class: 'Primary 6' });
    win.__DB.save(db);
  });
  const gz = w.document.getElementById('gradZone').textContent;
  ok('P6 sees grad countdown', gz.includes('Graduation') && /\d+/.test(gz), gz.slice(0, 80));
  ok('pupil clean', errors.length === 0, errors.join(' || ').slice(0, 300));
  const p1 = loadPage('portal/pupil.html', { role: 'pupil', refId: 'P001', name: 'P' });
  ok('non-P6 sees no countdown', p1.window.document.getElementById('gradZone').textContent.trim() === '');
  const ps = loadPage('portal/pupil.html', { role: 'pupil', refId: 'P001', name: 'P' }, win => {
    const db = win.__DB.load();
    db.registrations.push({ id: 'RP1', status: 'Admitted', date: '2026-09-10', expiry: '2026-09-24', ward: { first: 'Adaeze', surname: 'Okafor' }, payment: { status: 'Claimed', method: 'x', claim: { sender: 'M', amount: '10000', date: '2026-09-10', ref: 'R' }, parts: [{ amount: 5000, date: '2026-09-12', ref: 'P1' }] } });
    win.__DB.save(db);
  });
  const slip = ps.window.document.getElementById('feeReceipt').textContent;
  ok('slip shows instalment+balance', slip.includes('Instalment #1') && slip.includes('Balance'), slip.slice(0, 150));
}
console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
