/* (b42-retargeted)  Batch 41: real accreditation strip (internet-sourced marks), real staff list, CE 2023+2025 graduate walls with clickable profiles, staff collage + search + milestones, Staff Code of Conduct (sidebar + first-login accept, teacher + admin) */
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
const teacherHtml = fs.readFileSync(SITE + '/portal/teacher.html', 'utf8');
const corp = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'x' };
const TCH = refId => ({ role: 'teacher', refId, name: 'x' });
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

/* ---------- A. data + markup ---------- */
ok('accounts keep demo set; public wall is the real filing', store.includes('Uncle Ebenezer') && store.includes('id:"W10", name:"Bose Momoh"') && store.includes('staffWall: STAFF_WALL_SEED'));
ok('former seed retired to empty', store.includes('const FORMER_SEED = [];'));
ok('10 public wall entries seeded', store.includes('Mr Idris Ibrahim') && store.includes('id:"W10", name:"Bose Momoh"') && store.includes('id:"W01", name:"Mr Idris Ibrahim"'));
ok('CE 2025 top scorer data', store.includes('ABDULLAHI, FARIDA AHUDOIZA') && store.includes('total:216') && store.includes('BS/OKN/141001'));
ok('CE 2023 set data', store.includes('MAJEBI, TREASURE ONONO') && store.includes('gradYear:2023') && store.includes('2012-09-14'));
const gradCount = (store.match(/class:"Graduated"/g) || []).length;
ok('39 graduates seeded', gradCount === 39, 'got ' + gradCount);
ok('partner strip markup', sitejs.includes('class="foot-partners"') && sitejs.includes('Approved &amp; Registered With') && sitejs.includes('BS/OKN/141'));
ok('five badge files referenced', ['badge-kogi.png', 'badge-kogimoe.png', 'badge-napps.webp', 'badge-nysc.png', 'badge-cee.png'].every(b => sitejs.includes('assets/img/partners/' + b)));
ok('badge files on disk', ['badge-kogi.png', 'badge-kogimoe.png', 'badge-napps.webp', 'badge-nysc.png', 'badge-cee.png', 'class-feature.jpg'].every(b => fs.existsSync(SITE + '/assets/img/partners/' + b) || fs.existsSync(SITE + '/assets/img/' + b)));
ok('acc css', corp.includes('.foot-partners{') && corp.includes('.acc-logos img{') && corp.includes('.staff-collage{'));
ok('alumni: collage + search + feature', alumni.includes('id="staffCollage"') && alumni.includes('id="staffQ"') && alumni.includes('A Day in Our Class') && alumni.includes('class-feature.jpg'));
ok('alumni: grad cards clickable', alumni.includes("onclick=\"gradProfile('${p.id}')\"") && alumni.includes('window.gradProfile=function(id)'));
ok('alumni: teacher alias kept', alumni.includes('window.teacherProfile=function(id){ openTP(id); };'));
ok('coc teacher: button + view + modal', teacherHtml.includes('data-view="code">Code of Conduct') && teacherHtml.includes('id="v-code"') && teacherHtml.includes('id="cocBg"') && teacherHtml.includes('acceptCoC'));
ok('coc admin: button + view + modal', adminHtml.includes('data-view="code">Code of Conduct') && adminHtml.includes('id="v-code"') && adminHtml.includes('school.cocA'));
ok('coc rules faithful to staff paper, numbered 1-20', teacherHtml.includes('resumes 7:30am') && teacherHtml.includes('movement book') && teacherHtml.includes('association/union') && adminHtml.includes('day-care class') && (teacherHtml.match(/<li style="margin-bottom:9px">/g)||[]).length >= 20 && sitejs.includes('href="https://www.nappsng.org/"') && sitejs.includes('href="https://www.nysc.gov.ng/"') && sitejs.includes('href="https://kogistate.gov.ng/"'));

/* ---------- B. live: alumni ---------- */
const al = loadPage('alumni.html');
const cards = [...al.window.document.querySelectorAll('#teamGrid .team-card')];
ok('10 staff cards rendered', cards.length === 10, 'got ' + cards.length);
ok('collage shows 10 dots', al.window.document.querySelectorAll('#staffCollage .sc-dot').length === 10);
ok('former hidden (no data)', al.window.document.getElementById('former').style.display === 'none');
ok('39 graduate cards', al.window.document.querySelectorAll('#gradWall .team-card').length === 39);
ok('both set headings', al.window.document.getElementById('gradWall').textContent.includes('Class of 2025') && al.window.document.getElementById('gradWall').textContent.includes('Class of 2023'));
al.run("gradProfile('GS1');");
let box = al.window.document.getElementById('tpBox').textContent;
ok('grad popup: 2025 topper', box.includes('ABDULLAHI') && box.includes('Class of 2025') && box.includes('Total 216/240') && box.includes('BS/OKN/141'));
ok('grad popup: exam no + dob', box.includes('141001') && box.includes('January 2016'));
al.run("closeTP(); gradProfile('G005');");
box = al.window.document.getElementById('tpBox').textContent;
ok('grad popup: 2023 pupil no scores invented', box.includes('MAJEBI, TREASURE ONONO') && box.includes('2023') && !box.includes('/240'));
al.run("closeTP(); openTP('W02');");
box = al.window.document.getElementById('tpBox').textContent;
ok('teacher popup: real data', box.includes('Zeenatudeen Uthman') && box.includes('Class Teacher - Primary 6') && box.includes('B.Agric Crop Science'));
al.run("closeTP();");
al.window.document.getElementById('staffQ').value = 'rebe';
al.window.document.getElementById('staffQ').dispatchEvent(new al.window.KeyboardEvent('keyup', { bubbles: true }));
ok('staff search filters wall', [...al.window.document.querySelectorAll('#teamGrid .team-card')].filter(c => c.style.display !== 'none').length === 1);
al.run("document.getElementById('staffQ').value='';");
ok('alumni loads clean', al.errors.length === 0, al.errors.join(' || ').slice(0, 140));

/* ---------- C. live: teacher coc ---------- */
const tch = loadPage('portal/teacher.html', TCH('T006'));
ok('teacher coc gate shows first login', tch.window.document.getElementById('cocBox').style.display === '');
tch.run('acceptCoC();');
ok('teacher accept hides + persists', tch.window.document.getElementById('cocBox').style.display === 'none' && tch.run('DB.load().teachers.find(x=>x.id==="T006").cocA') === 1);
ok('teacher coc status line', tch.window.document.querySelector('.cocStatus') && tch.window.document.querySelector('.cocStatus').textContent.includes('Accepted'));
ok('teacher coc button in sidebar', !!tch.window.document.querySelector('#sideNav button[data-view="code"]'));

/* ---------- D. live: admin coc ---------- */
const adm = loadPage('portal/admin.html', ADMIN);
ok('admin coc gate shows first login', adm.window.document.getElementById('cocBox').style.display === '');
adm.run('acceptCoC();');
ok('admin accept hides + persists on school', adm.window.document.getElementById('cocBox').style.display === 'none' && adm.run('DB.load().school.cocA') === 1);
ok('admin sidebar 22 buttons', adm.window.document.querySelectorAll('#sideNav button[data-view]').length === 22);

/* ---------- E. versions ---------- */
let stale = 0;
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  if (fs.readFileSync(p, 'utf8').includes('20260919-40')) { console.log('  stale -40 in', p); stale++; }
}
ok('no stale -40 versions', stale === 0);
ok('sw + dev on v41', fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v46') && fs.readFileSync(SITE + '/developer.html', 'utf8').includes('var BUILD = "treasure-v46";'));

console.log(`\n==== BATCH41: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
