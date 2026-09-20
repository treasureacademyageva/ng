// verify-batch9.js — birthday dedup, static loader, banners, exams/holiday/welcome,
// teacher-of-term, voice notes, LF photos, invoice, SMS preview
const fs = require('fs'), vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = '/home/user/mums-school-website';
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

/* birthday dedup + loader + banners (static) */
{
  const idx = fs.readFileSync(SITE + '/index.html', 'utf8');
  ok('admissions birthday removed, top kept', !idx.includes('bdayBanner') && idx.includes('bdayBell'));
  const pages = fs.readdirSync(SITE).filter(f => f.endsWith('.html')).map(f => SITE + '/' + f)
    .concat(['portal/login.html', 'portal/admin.html', 'portal/teacher.html', 'portal/pupil.html'].map(f => SITE + '/' + f));
  const noLoader = pages.filter(p => !fs.readFileSync(p, 'utf8').includes('id="siteLoader"'));
  const noNs = pages.filter(p => !fs.readFileSync(p, 'utf8').includes('<noscript>'));
  ok('static loader on all pages', noLoader.length === 0 && pages.length === 34, `pages=${pages.length} missing=${noLoader.join(',')}`);
  ok('noscript fallback everywhere', noNs.length === 0, noNs.join(','));
  const imgs = ['openday-banner.png', 'reading-banner.png', 'uniform-banner.png', 'photoday-banner.png', 'homework-banner.png', 'lostfound-banner.png'];
  ok('6 banners exist', imgs.every(i => fs.existsSync(SITE + '/assets/img/' + i)));
  ok('banners wired', ['openday.html', 'reading.html', 'uniform.html', 'photo-day.html', 'homework.html', 'lost-found.html'].every((p, i) => fs.readFileSync(SITE + '/' + p, 'utf8').includes(imgs[i])));
  ok('loader reuses static markup', site.includes('document.getElementById("siteLoader")') && site.includes('if(!l){'));
}
/* new pages */
{
  const e = loadPage('exams.html');
  ok('exams list 6', e.window.document.querySelectorAll('tbody tr').length === 6);
  ok('exams clean', e.errors.length === 0, e.errors.join(' || ').slice(0, 200));
  const h = loadPage('holiday.html');
  ok('holiday lists + filters', h.window.document.getElementById('hdList').children.length === 2);
  h.run('document.getElementById("hdClass").value="Primary 6"; document.getElementById("hdClass").onchange();');
  ok('holiday filter works', h.window.document.getElementById('hdList').children.length === 1);
  ok('holiday clean', h.errors.length === 0, h.errors.join(' || ').slice(0, 200));
  const wl = loadPage('welcome.html');
  ok('welcome 6 steps', wl.window.document.querySelectorAll('.step').length === 6);
  ok('footer slim, contact intact', !e.window.document.getElementById('siteFooter').textContent.includes('Quick Links') && !e.window.document.getElementById('siteFooter').textContent.includes('Portal Login') && e.window.document.getElementById('siteFooter').textContent.includes('Get Directions') && e.window.document.getElementById('siteFooter').textContent.includes('Follow Us'));
}
/* teacher of term */
{
  const d = loadPage('index.html');
  ok('totZone empty by default', d.window.document.getElementById('totZone').textContent.trim() === '');
  const s = loadPage('index.html', null, win => { const db = win.__DB.load(); db.teacherOfTerm = { teacherId: 'T002', name: 'Aunty Rafatu', term: 'First Term', session: '2026/2027 Session', votes: 42, date: '2026-09-16' }; win.__DB.save(db); });
  ok('homepage crowns winner', s.window.document.getElementById('totZone').textContent.includes('Aunty Rafatu'));
  const a = loadPage('about.html', null, win => { const db = win.__DB.load(); db.teacherOfTerm = { teacherId: 'T002', name: 'Aunty Rafatu', term: 'First Term', session: '2026/2027 Session', votes: 42, date: '2026-09-16' }; win.__DB.save(db); });
  ok('about shows winner', a.window.document.getElementById('totWin').textContent.includes('Aunty Rafatu'));
}
/* admin: exams/holiday/votes/invoice/sms/voice/lfphoto */
{
  const { window: w, errors, run } = loadPage('portal/admin.html', ADMIN);
  run('document.getElementById("exSubj").value="EX TEST"; saveExam();');
  ok('exam added', w.__DB.load().exams.some(e => e.subject === 'EX TEST'));
  run('delExam("EX1");');
  ok('exam deleted', !w.__DB.load().exams.some(e => e.id === 'EX1'));
  run('document.getElementById("hdCls").value="Primary 1"; document.getElementById("hdNote").value="HD TEST"; saveHoliday();');
  ok('holiday posted', w.__DB.load().holiday[0].note === 'HD TEST');
  run('db=DB.load(); db.teacherVotes={T001:5,T002:12,T003:3}; DB.save(db); renderVotes();');
  ok('tally renders', w.document.getElementById('voteRows').textContent.includes('Aunty Rafatu') && w.document.getElementById('voteRows').textContent.includes('12'));
  run('crownWinner();');
  const tot = w.__DB.load().teacherOfTerm;
  ok('highest vote crowned + reset', tot.name === 'Aunty Rafatu' && tot.votes === 12 && Object.keys(w.__DB.load().teacherVotes).length === 0);
  run('crownWinner();');
  ok('no-vote crown blocked', w.__DB.load().teacherOfTerm.name === 'Aunty Rafatu');
  run('document.getElementById("ntTitle").value="NT"; document.getElementById("ntText").value="NTX"; document.getElementById("ntAudio").value="data:audio/webm;base64,AAA"; sendNotice();');
  ok('voice attached to notice', w.__DB.load().notices[0].audio === 'data:audio/webm;base64,AAA');
  run('document.getElementById("lfItem").value="LF TEST"; document.getElementById("lfPhoto").value="data:image/jpeg;base64,BBB"; saveLF();');
  ok('LF photo stored', w.__DB.load().lostfound[0].photo === 'data:image/jpeg;base64,BBB');
  run('db=DB.load(); db.school.bank={name:"Test Bank",number:"1234567890",holder:"TA"}; db.registrations.push({id:"RI",status:"Pending",ward:{first:"Inv",surname:"Kid",gender:"M",dob:"2020-01-01",classApply:"Primary 1"},guardian:{g1:{name:"G",phone:"080"},g2:{},rel:"Father",email:"",address:"x"},payment:{status:"Unpaid",method:"x"},date:"2026-09-16",expiry:"2026-09-30"}); DB.save(db); renderRegs(); printInvoice("RI");');
  const slip = w.document.getElementById('printSlip').textContent;
  ok('invoice built', slip.includes('SCHOOL FEES INVOICE') && slip.includes('Test Bank') && slip.includes('1234567890') && slip.includes('Balance Due'));
  run(`db=DB.load(); db.results.push({id:"RS1",pupilId:"P001",class:"Primary 1",term:"First Term",session:db.school.session,status:"Published",updatedAt:"2026-09-16",scores:{"English Language":{ca1:10,ca2:10,exam:40},"Mathematics":{ca1:9,ca2:9,exam:38}}}); DB.save(db); previewSMS("RS1");`);
  const sms = w.document.getElementById('modalBox').textContent;
  ok('SMS preview shows avg+position', sms.includes('Average:') && sms.includes('Position:') && sms.includes('Adaeze Okafor'), sms.slice(0, 160));
  ok('admin clean', errors.length === 0, errors.join(' || ').slice(0, 300));
}
/* voice playback in portals + LF photo public */
{
  const mk = to => win => { const db = win.__DB.load(); db.notices.unshift({ id: 'NV', to, title: 'Voice', text: 'Listen', date: '2026-09-16', readBy: [], audio: 'data:audio/webm;base64,AAA' }); win.__DB.save(db); };
  const t = loadPage('portal/teacher.html', { role: 'teacher', refId: 'T001', name: 'T' }, mk('teachers'));
  ok('teacher hears voice', t.window.document.getElementById('noticeList').innerHTML.includes('<audio'));
  const p = loadPage('portal/pupil.html', { role: 'pupil', refId: 'P001', name: 'P' }, mk('parents'));
  ok('pupil hears voice', p.window.document.getElementById('noticeList').innerHTML.includes('<audio'));
  const lf = loadPage('lost-found.html', null, win => { const db = win.__DB.load(); db.lostfound.unshift({ id: 'LFP', item: 'Photo Cap', desc: '', date: '2026-09-16', claimed: false, photo: 'data:image/jpeg;base64,BBB' }); win.__DB.save(db); });
  ok('LF photo public', lf.window.document.getElementById('lfList').innerHTML.includes('data:image/jpeg;base64,BBB'));
  const bd = loadPage('board.html', null, win => { const db = win.__DB.load(); db.lostfound.unshift({ id: 'LFP', item: 'Photo Cap', desc: '', date: '2026-09-16', claimed: false, photo: 'data:image/jpeg;base64,BBB' }); win.__DB.save(db); });
  ok('board photo shows', bd.window.document.getElementById('lfList').innerHTML.includes('data:image/jpeg;base64,BBB'));
}
console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
