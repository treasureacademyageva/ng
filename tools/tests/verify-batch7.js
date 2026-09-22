// verify-batch7.js — stars, ticker, bday, homework, lostfound, photoday, suggestions, receipts, bugfixes
const fs = require('fs'), vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = (() => {
  const w = require('path').join(__dirname, 'mums-school-website');
  if (fs.existsSync(require('path').join(w, 'assets/js/store.js'))) return w;
  return require('path').resolve(__dirname, '..', '..');
})();
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
  const scripts = [...window.document.querySelectorAll('script:not([src]):not([type="application/ld+json"])')].map(s => s.textContent).join('\n;\n');
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

/* homepage: ticker + bday + stars */
{
  const { window: w, errors } = loadPage('index.html', null, win => { const db = win.__DB.load(); db.teachers[2].dob = new Date().toISOString().slice(0, 10); db.teachers[2].name = 'Mr. Tunde Bakare'; win.__DB.save(db); });
  const tick = w.document.getElementById('newsTicker');
  ok('ticker renders with text', !!tick && tick.textContent.includes('ADMISSION IN PROGRESS'));
  ok('ticker sits after motto', !!tick && tick.previousElementSibling.id === 'mottoRibbon');
  ok('birthday bell shows celebrant', w.document.getElementById('bdayBell').textContent.includes('Mr. Tunde Bakare'));
  const sz = w.document.getElementById('starsZone');
  ok('stars: staff + pupil cards', sz.children.length === 2 && sz.textContent.includes('Idris Ibrahim') && sz.textContent.includes('Adaeze Okonkwo'));
  ok('quick links to new pages', ['homework.html', 'lost-found.html', 'photo-day.html'].every(h => w.document.body.innerHTML.includes(h)));
  ok('quick-strip links new pages', w.document.querySelector('.quick-strip').innerHTML.includes('photo-day.html'));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
{
  const { window: w } = loadPage('index.html', null, win => {
    const db = win.__DB.load(); db.ticker.on = false;
    db.teachers.forEach(t => t.dob = '1990-01-01'); db.school.headDob = '1990-01-02';
    win.__DB.save(db);
  });
  ok('ticker off hides bar', !w.document.getElementById('newsTicker'));
  ok('no-birthday hides bell', w.document.getElementById('bdayBell').textContent.trim() === '');
}
/* homework */
{
  const { window: w, errors, run } = loadPage('homework.html');
  ok('homework lists seeds', w.document.getElementById('hwList').children.length === 3);
  run('document.getElementById("hwClass").value="Primary 4"; document.getElementById("hwClass").onchange();');
  ok('class filter works', w.document.getElementById('hwList').children.length === 1);
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* lost & found + claim */
{
  const { window: w, errors, run } = loadPage('lost-found.html');
  ok('LF lists unclaimed', w.document.getElementById('lfList').textContent.includes('Blue cardigan'));
  run('claimForm("LF1"); document.getElementById("cn-LF1").value="Test Mum"; document.getElementById("cp-LF1").value="08011112222"; sendClaim("LF1");');
  const cl = w.__DB.load().claims;
  ok('claim stored', cl.length === 1 && cl[0].name === 'Test Mum' && cl[0].itemId === 'LF1');
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* photo day booking */
{
  const { window: w, errors, run } = loadPage('photo-day.html');
  ok('8 slots + 3 packages render', w.document.querySelectorAll('#slotGrid .slot').length === 8 && w.document.querySelectorAll('#pkgGrid .slot').length === 3); // batch25: package tiles added
  run('pickSlot("PS1"); document.getElementById("pdName").value="Kid One"; document.getElementById("pdClass").value="Primary 2"; document.getElementById("pdPhone").value="08011113333"; bookSlot();');
  let s = w.__DB.load().photoSlots.find(x => x.id === 'PS1');
  ok('booking saved + ref shown', s.taken && s.taken.name === 'Kid One' && w.document.getElementById('pdDone').textContent.includes('PH-'));
  run('document.getElementById("pdSlot").dataset.id="PS1"; document.getElementById("pdName").value="Kid Two"; document.getElementById("pdClass").value="Primary 3"; document.getElementById("pdPhone").value="08014445555"; bookSlot();');
  s = w.__DB.load().photoSlots.find(x => x.id === 'PS1');
  ok('double-book blocked', s.taken.name === 'Kid One');
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* suggestion box */
{
  const { window: w, errors, run } = loadPage('contact.html');
  run('document.getElementById("sgText").value="More swings please"; sendSuggestion();');
  const sg = w.__DB.load().suggestions;
  ok('suggestion stored anonymously', sg.length === 1 && sg[0].text === 'More swings please' && !sg[0].name);
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
/* receipts sequence */
{
  const { window: w, run } = loadPage('index.html');
  const a = run('DB.nextReceipt()'), b = run('DB.nextReceipt()');
  const yr = new Date().getFullYear();
  ok('receipt sequence TA/YYYY/NNNN', a === `TA/${yr}/0001` && b === `TA/${yr}/0002`, a + ',' + b);
  run(`db=DB.load(); db.registrations.push({id:"RX",status:"Pending",payment:{status:"Paid",method:"x"}}); DB.save(db); DB.load();`);
  ok('Paid backfill gets receipt', run('DB.load().registrations.find(r=>r.id==="RX").payment.receipt') === `TA/${yr}/0003`);
}
/* admin extras */
{
  const { window: w, errors, run } = loadPage('portal/admin.html', ADMIN);
  ok('extras view + panels', !!w.document.getElementById('v-extras') && !!w.document.getElementById('sgRows') && !!w.document.getElementById('psRows'));
  run('document.getElementById("tickText").value="TICKER TEST"; saveTicker();');
  ok('ticker saved', w.__DB.load().ticker.text === 'TICKER TEST');
  run('document.getElementById("swSName").value="Star Teacher"; saveStars();');
  ok('stars saved', w.__DB.load().starsOfWeek.staff.name === 'Star Teacher');
  run('document.getElementById("hwClass").value="Primary 1"; document.getElementById("hwNote").value="Read page 5"; saveHW();');
  ok('homework posted', w.__DB.load().homework[0].note === 'Read page 5');
  run('document.getElementById("psDay").value="Sunday"; document.getElementById("psTime").value="1pm"; saveSlot();');
  ok('slot added', w.__DB.load().photoSlots.length === 9);
  run('db=DB.load(); db.suggestions.unshift({id:"SGX",text:"t",date:"2026-09-16"}); db.claims.unshift({id:"CLX",itemId:"LF1",name:"Mum",phone:"080",date:"2026-09-16"}); DB.save(db); renderClaims(); renderSG();');
  run('collectClaim("CLX");');
  const adb = w.__DB.load();
  ok('claim collect marks item + clears', adb.claims.length === 0 && adb.lostfound.find(l => l.id === 'LF1').claimed === true);
  run('delSG("SGX");');
  ok('suggestion deleted', w.__DB.load().suggestions.length === 0);
  run('db=DB.load(); db.registrations.push({id:"RP",status:"Pending",ward:{first:"A",surname:"B",gender:"M",dob:"2020-01-01",classApply:"Primary 1"},guardian:{g1:{name:"G",phone:"080"},g2:{},rel:"Father",email:"",address:"x"},payment:{status:"Unpaid",method:"Bank transfer (not yet paid)"},date:"2026-09-16",expiry:"2026-09-30"}); DB.save(db); completePay("RP");');
  const rcpt = w.__DB.load().registrations.find(r => r.id === 'RP').payment.receipt;
  ok('completePay issues receipt', /^TA\/\d{4}\/0+\d+$/.test(rcpt || ''), rcpt);
  ok('admin boots clean', errors.length === 0, errors.join(' || ').slice(0, 300));
}
/* portal bugfix boots */
{
  const t = loadPage('portal/teacher.html', { role: 'teacher', refId: 'T001', name: 'T' });
  ok('teacher boots clean', t.errors.length === 0, t.errors.join(' || ').slice(0, 300));
  ok('teacher notices render', t.window.document.getElementById('latestNt').children.length > 0);
  const p = loadPage('portal/pupil.html', { role: 'pupil', refId: 'P001', name: 'P' }, win => {
    const db = win.__DB.load();
    db.registrations.push({ id: 'RP1', status: 'Admitted', date: '2026-09-10', expiry: '2026-09-24', ward: { first: 'Adaeze', surname: 'Okafor' }, payment: { status: 'Paid', method: 'Bank transfer (confirmed)', receipt: 'TA/2026/0007', claim: { sender: 'Mrs. Okafor', amount: '30000', date: '2026-09-10', ref: 'TRF1' } } });
    win.__DB.save(db);
  });
  ok('pupil boots clean', p.errors.length === 0, p.errors.join(' || ').slice(0, 300));
  ok('pupil receipt no shows', p.window.document.getElementById('feeReceipt').textContent.includes('TA/2026/0007'));
}
/* static: parens fixes + discount purge */
{
  const tch = fs.readFileSync(SITE + '/portal/teacher.html', 'utf8');
  const pup = fs.readFileSync(SITE + '/portal/pupil.html', 'utf8');
  const adm = fs.readFileSync(SITE + '/portal/admin.html', 'utf8');
  ok('myNotices()/currentResult() called', tch.includes('myNotices().filter') && tch.includes('currentResult()') && pup.includes('myNotices().filter') && pup.includes('publishedTerms()'));
  ok('slice().reverse() fixed', adm.includes('.slice().reverse()') && !adm.includes('.slice.reverse()'));
  const all = ['assets/js/store.js', 'assets/js/site.js', 'index.html', 'admissions.html', 'portal/login.html', 'portal/admin.html'].map(f => fs.readFileSync(SITE + '/' + f, 'utf8')).join('\n');
  ok('discount fully purged', !/discountBanner|regDiscount|setDisc|Early-Bird|Percent Off|Fees Discount|Discount\.render|school\.discount|SCHOOL_DEFAULTS\.discount/.test(all));
}
console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
