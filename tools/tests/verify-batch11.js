// verify-batch11.js — nav/footer redesign, real ratings, directions, chatbot v2,
// birthday countdown, event reminders, sick-bay SMS
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

/* nav + footer */
{
  const i = loadPage('index.html');
  const nav = i.window.document.getElementById('mainNav');
  const labels = [...nav.querySelectorAll('a')].map(a => a.textContent.trim());
  ok('nav shows all incl current', ['Home', 'News/Event', 'About Us', 'Contact Us', 'Login/Register'].every(l => labels.includes(l)), labels.join(','));
  ok('nav highlights current', nav.querySelector('a.on') && nav.querySelector('a.on').textContent.trim() === 'Home');
  const foot = i.window.document.getElementById('siteFooter').textContent;
  ok('footer dropped quick links', !foot.includes('Quick Links') && !foot.includes('Portal Login') && foot.includes('Get Directions') && foot.includes('Follow Us'));
  ok('footer visit anchor', i.window.document.getElementById('siteFooter').innerHTML.includes('contact.html#visit'));
  const n2 = loadPage('news.html');
  ok('news page highlights news', n2.window.document.getElementById('mainNav').querySelector('a.on').textContent.trim() === 'News/Event');
  ok('nav/footer pages clean', i.errors.length === 0 && n2.errors.length === 0, i.errors.concat(n2.errors).join(' || ').slice(0, 200));
}

/* real ratings */
{
  const n = loadPage('news.html');
  const db = n.window.__DB.load();
  ok('seed views/likes zeroed', db.newsEvents.every(x => x.views === 0 && x.likes === 0), JSON.stringify(db.newsEvents.map(x => [x.views, x.likes])));
  n.run('db=DB.load(); db.newsEvents.push({id:"NX",type:"news",title:"X",date:"2026-09-16",text:"t",story:"s"}); DB.save(db); const d2=DB.load();');
  const nx = n.window.__DB.load().newsEvents.find(x => x.id === 'NX');
  ok('backfill honest zero', nx.likes === 0 && nx.views === 0);
}

/* chatbot v2 */
{
  const c = loadPage('index.html');
  const a = q => c.run('Chatbot.answer(' + JSON.stringify(q) + ')');
  ok('chat typo admission', a('How do I apply for addmision?').includes('Admissions 2026/2027'));
  ok('chat slang fees', a('skul fees how much??').toLowerCase().includes('fee'));
  ok('chat location sense', a('where is the school located').includes('Directions From My Location'));
  ok('chat pidgin lostfound', a('my pikin lost him cardigan').includes('Lost & Found'));
  ok('chat pidgin greeting', a('HOW FAR').includes("I'm great"));
  ok('chat transport real', a('is there a school bus?').includes('Transport page') && !a('bus').includes('no bus service'));
  ok('chat sick intent', a('my child is sick what do i do').includes('sick bay'));
  ok('chat gibberish fallback', a('xyzabc123').includes("didn't quite catch"));
  ok('chat thanks', a('thank you very much').includes('welcome'));
  ok('chat clean', c.errors.length === 0, c.errors.join(' || ').slice(0, 200));
}

/* countdown + directions */
{
  const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const i = loadPage('index.html', null, win => {
    const db = win.__DB.load();
    db.teachers.forEach(t => { t.dob = '1990-01-01'; });
    db.teachers[0].dob = plus(5); db.teachers[0].name = 'Countdown Star';
    db.school.headDob = '1980-06-01';
    win.__DB.save(db);
  });
  const bc = i.window.document.getElementById('bdayCount').textContent;
  ok('countdown shows next birthday', bc.includes('Countdown Star') && bc.includes('5 days'), bc.slice(0, 120));
  const ct = loadPage('contact.html');
  ok('directions button present', ct.window.document.body.textContent.includes('Directions From My Location') && typeof ct.window.dirFromHere === 'function');
  ok('visit anchor exists', !!ct.window.document.getElementById('visit'));
}

/* admin: reminder + sick sms */
{
  const { window: w, errors, run } = loadPage('portal/admin.html', ADMIN, win => {
    const db = win.__DB.load();
    db.newsEvents = [{ id: 'EV1', type: 'event', title: 'Test Party', date: '2026-09-20', image: 'assets/img/sports.png', text: 'Fun day', story: 's', views: 0, likes: 0 }];
    db.volunteers = [{ id: 'V1', name: 'Eager Mum', phone: '080111', event: 'Test Party (2026-09-20)', date: '2026-09-16' }, { id: 'V2', name: 'Any Dad', phone: '080222', event: 'Any event', date: '2026-09-16' }];
    db.pupils.push({ id: 'P9', adm: 'TA/9', name: 'Sick Kid', gender: 'M', class: 'Primary 2', dob: '2018-01-01', parent: 'Mama Sick', phone: '080999' });
    db.sickbay = [{ id: 'S1', pupil: 'Sick Kid', class: 'Primary 2', complaint: 'Stomach ache', treatment: 'Rest + ORS', date: '2026-09-16', parentCalled: false }];
    win.__DB.save(db);
  });
  run('openReminder("EV1");');
  const rm = w.document.getElementById('rmTxt').value;
  ok('reminder composes message', rm.includes('Test Party') && rm.includes('2026-09-20') && rm.includes('TREASURE ACADEMY'));
  ok('reminder matches volunteers', w.document.body.textContent.includes('Eager Mum') && w.document.body.textContent.includes('Any Dad'));
  run('closeModal(); openSickSMS("S1");');
  const sk = w.document.getElementById('skTxt').value;
  ok('sick sms composes', sk.includes('Sick Kid') && sk.includes('Stomach ache') && sk.includes('Rest + ORS'));
  ok('sick sms shows parent phone', w.document.body.textContent.includes('080999'));
  ok('admin clean', errors.length === 0, errors.join(' || ').slice(0, 300));
}

console.log(`\n==== BATCH11: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
