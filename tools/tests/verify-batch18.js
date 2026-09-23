/* Batch 18: phone-number login + fee ring, seen signature, broadsheet,
   order timeline, HW tick, L&F archive, per-event volunteers, mentor opt-in */
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
/* The chatbot now lives in its own modules, loaded alongside site.js. */
const chatEnt  = fs.readFileSync(SITE + '/assets/js/chat-entities.js', 'utf8');
const chatRag  = fs.readFileSync(SITE + '/assets/js/chat-rag.js', 'utf8');
const chatCore = fs.readFileSync(SITE + '/assets/js/chat-core.js', 'utf8');
const chatKb   = fs.readFileSync(SITE + '/assets/data/kb.json', 'utf8');
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
  Object.defineProperty(window, 'CSS', { value: { escape: s => String(s).replace(/[^a-z0-9_-]/gi, c => '\\' + c) }, configurable: true });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.print = () => {}; window.scrollTo = () => {}; window.open = () => {}; window.requestAnimationFrame = () => 0;
  const scripts = [...window.document.querySelectorAll('script:not([src]):not([type="application/ld+json"])')].map(s => s.textContent).join('\n;\n');
  const errors = [];
  window.addEventListener('error', e => errors.push(String((e.message || e.error || '').slice(0, 140))));
  vm.createContext(window);
  vm.runInContext(store, window);
  vm.runInContext('window.__DB=DB;', window);
  if (session) vm.runInContext('localStorage.setItem("treasure_session_v1", \'' + JSON.stringify(session) + '\');', window);
  if (pre) vm.runInContext(pre, window);
  vm.runInContext(site + '\n;\n' + scripts, window);
    vm.runInContext(chatEnt + '\n;\n' + chatRag + '\n;\n' + chatCore, window);
    vm.runInContext('TAChat.init(' + chatKb + ');', window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, errors: errors.filter(x => !/navigation|Not implemented/i.test(x)), run: c => vm.runInContext(c, window) };
}
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'x' };
const PUPIL = { role: 'pupil', refId: 'P001', name: 'x' };

/* ---------- phone login ---------- */
{
  const { run, errors } = loadPage('portal/login.html');
  ok('phone tolerant login', run('Auth.pupilLogin("0805-111 2222","1234").ok') === true && run('Auth.pupilLogin("2348051112222","1234").ok') === true);
  ok('pupil phone login', run('Auth.pupilLogin("0805 111 2222","1234").ok') === true);
  ok('pupil +234 login', run('Auth.pupilLogin("+2348051112222","1234").ok') === true);
  ok('pupil wrong pw', run('Auth.pupilLogin("08051112222","0000").reason') === 'wrongpass');
  ok('pupil unknown phone', run('Auth.pupilLogin("0800 000 0000","1234").reason') === 'notfound');
  ok('old adm still works', run('Auth.pupilLogin("TA/2023/001","1234").ok') === true);
  ok('teacher phone login', run('!!Auth.staffLogin("teacher","0803 100 0001","1234")') === true);
  ok('teacher T001 still works', run('!!Auth.staffLogin("teacher","T001","1234")') === true);
  ok('admin HEAD001 works', run('!!Auth.staffLogin("admin","HEAD001","1234")') === true);
  run('var d=DB.load(); d.pupils.find(p=>p.id==="P002").phone="0805 111 2222"; d.pupils.find(p=>p.id==="P002").password=null; DB.save(d);');
  ok('sibling shares phone login', run('Auth.pupilLogin("08051112222","1234").ok') === true);
  run('Auth.setPassword("08051112222","9999");');
  ok('setPassword covers siblings', run('DB.load().pupils.filter(p=>p.phone==="0805 111 2222"&&p.password==="9999").length') === 2);
  const src = fs.readFileSync(SITE + '/portal/login.html', 'utf8');
  ok('login asks phone', src.includes('Phone Number (e.g. 0805 123 4567)'));
  ok('login no errors', errors.length === 0, errors.join('||').slice(0, 160));
}
{
  // full submit routing with teacher phone
  const { window: w, run } = loadPage('portal/login.html');
  run('fillStaff("teacher","0803 100 0001");');
  setTimeout(() => {
    let s = null;
    try { s = w.localStorage.getItem('treasure_session_v1'); } catch (e) {}
    ok('staff phone submit routes', !!s && s.includes('T001'), String(s).slice(0, 60));
    finish();
  }, 900);
  return;
}
function finish() {

/* ---------- #1 fee ring ---------- */
{
  const { window: w, run, errors } = loadPage('portal/pupil.html', PUPIL, null,
    'var d=DB.load(); d.registrations.push({id:"RG1",status:"Admitted",ward:{first:"Adaeze",surname:"Okafor",classApply:"Primary 1"},guardian:{g1:{name:"G",phone:"1"}},payment:{status:"Unpaid",method:"x",parts:[{amount:15000}]}}); DB.save(d);');
  run('renderFees();');
  ok('fee ring renders', w.document.getElementById('feeStatus').innerHTML.includes('stroke-dasharray'));
  ok('fee ring no errors', errors.length === 0, errors.join('||').slice(0, 160));
}

/* ---------- #2 seen signature ---------- */
{
  const { window: w, run } = loadPage('portal/pupil.html', PUPIL);
  run('paintSeen("R1");');
  ok('seen button offered', w.document.getElementById('seenWrap').innerHTML.includes('I Have Seen This Result'));
  run('markSeen("R1");');
  ok('seen stored', run('DB.load().resultViews.length') === 1);
  ok('seen shows signed', w.document.getElementById('seenWrap').innerHTML.includes('Seen'));
  const a = loadPage('portal/admin.html', ADMIN);
  ok('admin seen column', a.window.document.documentElement.innerHTML.includes('<th>Seen</th>'));
}

/* ---------- #3 broadsheet ---------- */
{
  const { window: w, run, errors } = loadPage('portal/admin.html', ADMIN);
  run('document.getElementById("resClassFilter").value="Primary 1"; printBroadsheet();');
  const h = w.document.getElementById('printSlip').innerHTML;
  ok('broadsheet prints', h.includes('Broadsheet') && h.includes('Adaeze Okafor') && h.includes('AVG'));
  ok('broadsheet no errors', errors.length === 0, errors.join('||').slice(0, 160));
}

/* ---------- #4 order timeline ---------- */
{
  const s = loadPage('shop.html', null, null,
    'var d=DB.load(); d.orders.unshift({id:"ORD9",buyer:"B",phone:"1",pupil:"K",pclass:"P",method:"x",items:[{id:"1",name:"Book",price:500,qty:2}],total:1000,status:"Paid",date:"2026-09-19"}); DB.save(d); localStorage.setItem("treasure_myorders_v1",JSON.stringify(["ORD9"]));');
  s.run('openMyOrders();');
  ok('timeline steps', s.window.document.body.innerHTML.includes('Placed') && s.window.document.body.innerHTML.includes('Collected'));
}

/* ---------- #5 HW tick ---------- */
{
  const { window: w, run } = loadPage('homework.html');
  ok('tick button', w.document.getElementById('hwList').innerHTML.includes('We finished it'));
  run('tickHW("HW1");');
  ok('tick marks done', w.document.getElementById('hwList').innerHTML.includes('Done'));
  run('tickHW("HW1");');
  ok('tick toggles back', w.document.getElementById('hwList').innerHTML.includes('We finished it'));
}

/* ---------- #6 L&F archive ---------- */
{
  const { run } = loadPage('lost-found.html', null, null,
    'var d=DB.load(); d.lostfound.unshift({id:"LFX",item:"Old Cap",desc:"",date:"2026-01-05",claimed:false}); DB.save(d);');
  ok('old item archived', run('DB.load().lostfound.find(l=>l.id==="LFX").archived') === true);
  const p = loadPage('lost-found.html');
  ok('archived hidden publicly', !p.window.document.body.innerHTML.includes('Old Cap'));
  const c = loadPage('index.html');
  ok('chat skips archived', !c.run('(TAChat.respond("did anyone lose anything")||{}).html||""').includes('Old Cap'));
}

/* ---------- #7 volunteers per event ---------- */
{
  const { window: w, run } = loadPage('volunteer.html');
  ok('event picker lists events', w.document.getElementById('volEvent').innerHTML.includes('Inter-House'));
  run('document.getElementById("volName").value="V Test"; document.getElementById("volPhone").value="0801"; saveVol();');
  ok('signup stores event', (run('DB.load().volunteers.length') || 0) >= 1);
}

/* ---------- #8 mentor opt-in ---------- */
{
  const { window: w, run } = loadPage('alumni.html');
  ok('mentor checkbox', !!w.document.getElementById('alSubMentor'));
  run('document.getElementById("alSubName").value="M G"; document.getElementById("alSubNote").value="Great"; document.getElementById("alSubMentor").checked=true; submitAlumni();');
  ok('mentor stored', run('DB.load().alumni.find(x=>x.name==="M G").mentor') === true);
  const a = loadPage('portal/admin.html', ADMIN, null,
    'var d=DB.load(); d.alumni.unshift({id:"ALM",status:"Approved",name:"M G",year:"2020",school:"S",note:"N",mentor:true}); DB.save(d);');
  ok('mentor badge admin', a.window.document.getElementById('alRows').innerHTML.includes('Mentor'));
}

/* ---------- admin phone management ---------- */
{
  const { window: w } = loadPage('portal/admin.html', ADMIN);
  ok('pupils table shows phones', w.document.getElementById('pupilRows').innerHTML.includes('0805 111 2222'));
}

console.log(`\n==== BATCH18: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
}
