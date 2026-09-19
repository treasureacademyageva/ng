// verify-batch15.js — chatbot brain, treasure nav/buttons, dark audit, week strip,
// single WA line, voice minutes, fee progress, thanks, offline SW, bug fixes
const fs = require('fs'), vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = '/home/user/mums-school-website';
const store = fs.readFileSync(SITE + '/assets/js/store.js', 'utf8');
const site = fs.readFileSync(SITE + '/assets/js/site.js', 'utf8');
const css = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
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
  window.print = () => {}; window.scrollTo = () => {};
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
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'x' };
const PUPIL = { role: 'pupil', refId: 'P001', name: 'x' };
const dstr = off => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };

/* ---- chatbot live brain ---- */
{
  const { run, errors } = loadPage('index.html', null, win => {
    const db = win.__DB.load();
    db.newsEvents.push({ id: 'NX15', type: 'news', title: 'T15 Harvest Fair', date: dstr(0), text: 'x', views: 0, likes: 0 });
    db.lostfound.push({ id: 'LF15', item: 'Yellow raincoat', date: dstr(-1), claimed: false });
    db.exams = [{ id: 'EX15', subject: 'English', date: dstr(6), time: '9:00 AM', classes: 'Primary 1-6', day: 'Xday' }];
    db.ptaMeetings = [{ id: 'PM15', date: dstr(4), title: 'General Meeting', venue: 'Hall' }];
    win.__DB.save(db);
  });
  const a = q => run('Chatbot.answer(' + JSON.stringify(q) + ')');
  const wk = [0, 6].includes(new Date().getDay());
  ok('chat status live', wk ? a('is there school today?').includes('resumes back on') : a('is there school today?').includes('there is school today'));
  ok('chat class fee', a('how much is Primary 3 fees?').includes('₦30,000') && a('how much is Primary 3 fees?').includes('Primary 3'));
  ok('chat fee table', a('what are the school fees?').includes('per term') && a('what are the school fees?').includes('₦'));
  ok('chat bank warning', a('school fees?').includes('bank transfer'));
  ok('chat lost live', a('did anyone lose anything?').includes('Yellow raincoat'));
  ok('chat news live', a('any news today?').includes('T15 Harvest Fair'));
  ok('chat exams live', a('when are exams?').includes('English'));
  ok('chat pta live', a('when is pta meeting?').includes('General Meeting') && a('when is pta meeting?').includes('I Will Attend'));
  ok('chat dates live', a('when is resumption?').includes('Resumption') && a('when is resumption?').includes('deadline'));
  ok('chat staff live', a('who teaches Nursery 1?').includes('Nursery 1'));
  ok('chat contact live', a('call the school').includes('09063932487'));
  ok('chat uniform price', a('how much is the school uniform?').includes('₦4,500'));
  ok('chat greeting warm', a('how far').includes("I'm great") && a('hello').includes('Treasure'));
  ok('chat thanks/bye', a('thank you').includes('welcome') && a('goodbye').includes('Goodbye'));
  ok('chat kb intact', a('where are all the parent reviews?').includes('Testimonials') && a('is there a school bus?').includes('Transport page'));
  ok('chat clean', errors.length === 0, errors.join(' || ').slice(0, 250));
  ok('chat emergency live', loadPageEmergency());
  function loadPageEmergency() {
    const t = loadPage('index.html', null, win => {
      const db = win.__DB.load(); db.school.emergency = { on: true, text: 'Closed for testing' }; win.__DB.save(db);
    });
    return t.run('Chatbot.answer("is school closed today?")').includes('Closed for testing');
  }
}

/* ---- week strip + admin control ---- */
{
  const { window: w, errors } = loadPage('index.html', null, win => {
    const db = win.__DB.load();
    db.calendar.push({ id: 'C15', date: dstr(2), title: 'Cultural Day', desc: '' });
    db.weekStrip = { on: true, note: 'Wear native attire!' };
    win.__DB.save(db);
  });
  const ws = w.document.getElementById('weekStrip').textContent;
  ok('week strip renders', ws.includes('Cultural Day') && ws.includes('Wear native attire!'));
  ok('week clean', errors.length === 0, errors.join(' || ').slice(0, 200));
  const off = loadPage('index.html', null, win => {
    const db = win.__DB.load(); db.weekStrip = { on: false, note: '' }; win.__DB.save(db);
  });
  ok('week strip off', off.window.document.getElementById('weekStrip').textContent.trim() === '');
  const { window: wa, run } = loadPage('portal/admin.html', ADMIN);
  ok('week admin ui', !!wa.document.getElementById('weekOn') && !!wa.document.getElementById('weekNote'));
  run('document.getElementById("weekOn").value="1"; document.getElementById("weekNote").value="Hi week"; saveWeekStrip();');
  ok('week admin saves', wa.__DB.load().weekStrip.note === 'Hi week');
}

/* ---- voice minutes ---- */
{
  const { window: w, run, errors } = loadPage('portal/admin.html', ADMIN);
  ok('voice ui', !!w.document.getElementById('pmAudio') && typeof run('typeof recPM') === 'string');
  run('document.getElementById("pmDate").value="2026-01-05"; document.getElementById("pmTitle").value="Voice Mtg"; document.getElementById("pmMinutes").value="Notes here"; document.getElementById("pmAudio").value="data:audio/webm;base64,AAA"; savePtaMt();');
  const m = w.__DB.load().ptaMeetings.find(x => x.title === 'Voice Mtg');
  ok('voice saved', !!(m && m.audio === 'data:audio/webm;base64,AAA' && m.minutes === 'Notes here'));
  ok('voice badge', w.document.getElementById('pmRows').textContent.includes('VOICE'));
  ok('admin voice clean', errors.length === 0, errors.join(' || ').slice(0, 200));
  const p = loadPage('pta.html', null, win => {
    const db = win.__DB.load(); db.ptaMeetings = [{ id: 'PMV', date: dstr(-9), title: 'Old', minutes: '', audio: 'data:audio/webm;base64,AAA' }]; win.__DB.save(db);
  });
  ok('pta audio plays', !!p.window.document.querySelector('#ptaPast audio'));
}

/* ---- thanks flow ---- */
{
  const t = loadPage('portal/teacher.html', { role: 'teacher', refId: 'T001', name: 'T' }, win => {
    const db = win.__DB.load(); const tc = db.teachers.find(x => x.id === 'T001'); if (tc) tc.dob = '1990-' + dstr(0).slice(5); win.__DB.save(db);
  });
  ok('teacher bday zone', t.window.document.getElementById('myBdayZone').textContent.includes('Happy Birthday'));
  t.run('postThanks();');
  ok('teacher thanks saved', t.window.__DB.load().bdayThanks.length === 1);
  const b = loadPage('birthdays.html', null, win => {
    const db = win.__DB.load(); db.bdayThanks = [{ name: 'Aunty Test', msg: 'Thank you all!', date: dstr(0) }]; win.__DB.save(db);
  });
  ok('thanks on bday page', b.window.document.getElementById('thanksZone').textContent.includes('Aunty Test'));
  const adm = loadPage('portal/admin.html', ADMIN, win => {
    const db = win.__DB.load(); db.school.headDob = '1980-' + dstr(0).slice(5); win.__DB.save(db);
  });
  ok('hm bday zone', adm.window.document.getElementById('hmBdayZone').textContent.includes('Happy Birthday'));
}

/* ---- fee progress ---- */
{
  const { window: w, errors } = loadPage('portal/pupil.html', PUPIL, win => {
    const db = win.__DB.load();
    db.registrations.push({ id: 'RG-T15', ward: { first: 'Adaeze', surname: 'Okafor' }, guardian: { g1: { name: 'x', phone: '1' } }, payment: { status: 'Claimed', method: 'Bank transfer', parts: [{ amount: 10000, date: dstr(-3) }], claim: { amount: '5000' } } });
    win.__DB.save(db);
  });
  const fs = w.document.getElementById('feeStatus').textContent;
  ok('fee progress numbers', fs.includes('₦15,000') && fs.includes('₦30,000') && fs.includes('50%'));
  ok('fee progress bar', !!w.document.querySelector('#feeStatus .fee-progress i'));
  ok('fee clean', errors.length === 0, errors.join(' || ').slice(0, 200));
}

/* ---- lostfound pending ---- */
{
  const l = loadPage('lost-found.html', null, win => {
    win.localStorage.setItem('lf_sent', JSON.stringify(['LF2']));
  });
  ok('claim pending state', l.window.document.body.textContent.includes('waiting for office'));
}

/* ---- testimonials approval fix ---- */
{
  const t = loadPage('testimonials.html', null, win => {
    const db = win.__DB.load();
    db.testimonials = [{ name: 'Pending Parent', text: 'Not yet approved', stars: 5, status: 'Pending' }, { name: 'Good Parent', text: 'Approved text', stars: 5, status: 'Approved' }];
    win.__DB.save(db);
  });
  const tx = t.window.document.getElementById('allTesti').textContent;
  ok('pending hidden', !tx.includes('Pending Parent') && tx.includes('Good Parent'));
}

/* ---- cleanup + search + SW + css + version ---- */
{
  ok('single renderEmergency', (site.match(/function renderEmergency\(\)/g) || []).length === 1);
  ok('single emg boot', (site.match(/renderEmergency\(\)\);/g) || []).length === 1);
  const { run } = loadPage('index.html');
  ok('search has new pages', run('SEARCH_INDEX.some(p=>p.u==="testimonials.html")') && run('SEARCH_INDEX.some(p=>p.u==="class.html")'));
  ok('sw file', fs.existsSync(SITE + '/sw.js') && fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v17'));
  ok('sw registered', site.includes('navigator.serviceWorker.register'));
  ok('treasure nav css', css.includes('.nav-links a:not(.btn){border:1px solid #D8CFAF') && css.includes('.nav-links a.on::before'));
  ok('treasure btn css', css.includes('.btn-treasure{'));
  ok('chat css', css.includes('.chat-msg.bot{') && css.includes('.chat-chips button{'));
  ok('strip+progress css', css.includes('.week-strip{') && css.includes('.fee-progress i{'));
  ok('dark vars', css.includes('[data-theme="dark"]{--cream:#0D141F'));
  ok('dark surfaces', css.includes('[data-theme="dark"] .chat-panel') && css.includes('[data-theme="dark"] .tbl td'));
  const idx = fs.readFileSync(SITE + '/index.html', 'utf8');
  ok('week mount + treasure cta', idx.includes('id="weekStrip"') && idx.includes('btn btn-treasure'));
  const old = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = d + '/' + e.name;
    if (e.isDirectory()) { if (!['node_modules', '.git'].includes(e.name)) walk(p); }
    else if (/\.(html|js|css)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes('20260919-16')) old.push(p);
  });
  walk(SITE);
  ok('version -17', old.length === 0, old.join(','));
}

console.log(`\nBATCH15: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
