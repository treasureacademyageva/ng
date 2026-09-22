/* (b42-retargeted)  (b41-retargeted)  Batch 40: 3-col staff grid, tap-for-profile (started date etc.), former teachers section, admin profile fields */
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
const corp = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
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

/* ---------- A. static ---------- */
ok('staff grid is 3-col (no swipe)', alumni.includes('class="staff-grid3" id="teamGrid"') && !alumni.includes('swipe-hint'));
ok('grid css + responsive', corp.includes('.staff-grid3{display:grid;grid-template-columns:repeat(3,1fr)') && corp.includes('@media(max-width:900px){.staff-grid3{grid-template-columns:repeat(2,1fr)}') && corp.includes('@media(max-width:600px){.staff-grid3{grid-template-columns:1fr}'));
ok('former section markup', alumni.includes('id="formerGrid"') && alumni.includes('Our Former Teachers') && alumni.includes('positions they held'));
ok('profile modal markup', alumni.includes('id="tpBg"') && alumni.includes('id="tpBox"') && alumni.includes('closeTP()'));
ok('store: former seed + migration', store.includes('if(!db.formerTeachers) db.formerTeachers = FORMER_SEED;'));
ok('store: public wall holds real filing names', store.includes('id:"W05", name:"Tahab Oyiza Zainab"') && store.includes('quals:"B.Agric Crop Science (2020)"'));
ok('cards clickable', alumni.includes('staff-click') && alumni.includes("onclick=\"openTP('${t.id}')\"") && alumni.includes("onclick=\"openTP('${f.id}')\""));
ok('public wall carries no voting buttons', !alumni.includes('data-vote') && !alumni.includes('event.stopPropagation();voteTeacher'));
ok('admin form: profile fields', ['id="tStart"', 'id="tPos"', 'id="tQual"', 'id="tAbout"'].every(a => adminHtml.includes(a)) && adminHtml.includes('started:document.getElementById("tStart").value'));

/* ---------- B. live: grid + profiles ---------- */
const al = loadPage('alumni.html');
const cards = [...al.window.document.querySelectorAll('#teamGrid .team-card')];
ok('10 real staff blocks on wall', cards.length === 10, 'got ' + cards.length);
ok('card shows position', cards[0] && cards[0].textContent.includes('Class Teacher'));
const fcards = [...al.window.document.querySelectorAll('#formerGrid .team-card')];
ok('no former cards with empty seed', fcards.length === 0, 'got ' + fcards.length);
ok('former section hidden when empty', al.window.document.getElementById('former').style.display === 'none');
ok('graduates wall populated', al.window.document.querySelectorAll('#gradWall .team-card').length === 39, 'got ' + al.window.document.querySelectorAll('#gradWall .team-card').length);
al.run("teacherProfile('W01');");
let box = al.window.document.getElementById('tpBox').textContent;
ok('profile opens for teacher', al.window.document.getElementById('tpBox').style.display === '' && box.includes('Idris Ibrahim'));
ok('started line hidden when no date stored', !box.includes('Started teaching here'));
ok('profile shows quals + about + subjects', box.includes('HND') && box.includes('maths desk') && box.includes('Computer Science'));
al.run("closeTP(); teacherProfile('FT1');");
box = al.window.document.getElementById('tpBox').textContent;
ok('unknown profile id stays hidden', al.window.document.getElementById('tpBox').style.display === 'none');
ok('alumni loads clean', al.errors.length === 0, al.errors.join(' || ').slice(0, 140));

/* ---------- C. live: admin edit persists profile ---------- */
const adm = loadPage('portal/admin.html', ADMIN);
adm.run('openTeacherModal("T002");');
adm.window.document.getElementById('tPos').value = 'Class Teacher & Maths Lead';
adm.window.document.getElementById('tStart').value = '2017-01-09';
adm.window.document.getElementById('tAbout').value = 'Leads our maths team.';
adm.run('saveTeacher("T002");');
ok('admin saves teacher profile', adm.run('var t=DB.load().teachers.find(x=>x.id==="T002"); t.position') === 'Class Teacher & Maths Lead' && adm.run('DB.load().teachers.find(x=>x.id==="T002").about') === 'Leads our maths team.');
ok('admin loads clean', adm.errors.length === 0, adm.errors.join(' || ').slice(0, 140));

/* ---------- D. versions ---------- */
let stale = 0;
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  if (fs.readFileSync(p, 'utf8').includes('20260919-39')) { console.log('  stale -39 in', p); stale++; }
}
ok('no stale -39 versions', stale === 0);
ok('sw + dev on v40', fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v47') && fs.readFileSync(SITE + '/developer.html', 'utf8').includes('var BUILD = "treasure-v47";'));

console.log(`\n==== BATCH40: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
