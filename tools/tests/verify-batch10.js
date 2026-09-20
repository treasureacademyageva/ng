// verify-batch10.js — portal repair (loader/critical-CSS/cache-bust/includes) + 10 suggestions
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
const TEACHER = { role: 'teacher', refId: 'T001', name: 'x' };
const PUPIL = { role: 'pupil', refId: 'P001', name: 'x' };

/* ---- static: loader, cache-bust, includes, new pages ---- */
{
  const path = require('path');
  const pages = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { if (['node_modules','.git','tools'].includes(f)) continue; const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) pages.push(p); } })(SITE);
  const noCrit = pages.filter(p => !fs.readFileSync(p, 'utf8').includes('#siteLoader{position:fixed'));
  ok('critical loader CSS on all pages', noCrit.length === 0 && pages.length === 34, `pages=${pages.length} missing=${noCrit.join(',')}`);
  const unv = [];
  for (const p of pages) { const s = fs.readFileSync(p, 'utf8'); const refs = [...s.matchAll(/(?:href|src)="((?:\.\.\/)?assets\/[^"]+\.(?:css|js))"/g)].map(m => m[1]); for (const r of refs) if (!r.includes('?v=')) unv.push(path.relative(SITE, p) + ':' + r); }
  ok('all css/js cache-busted', unv.length === 0, unv.slice(0, 3).join(','));
  const pup = fs.readFileSync(SITE + '/portal/pupil.html', 'utf8'), tch = fs.readFileSync(SITE + '/portal/teacher.html', 'utf8');
  ok('pupil full includes', pup.includes('extra.css') && pup.includes('corporate.css') && pup.includes('site.js'));
  ok('teacher full includes', tch.includes('extra.css') && tch.includes('corporate.css') && tch.includes('site.js'));
  ok('clock hidden on portals', fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8').includes('.portal-body #clockWidget'));
  ok('transport+volunteer pages exist', fs.existsSync(SITE + '/transport.html') && fs.existsSync(SITE + '/volunteer.html'));
  ok('quick-strip links new pages', fs.readFileSync(SITE + '/index.html', 'utf8').includes('transport.html') && fs.readFileSync(SITE + '/index.html', 'utf8').includes('volunteer.html'));
  const born = fs.readFileSync(SITE + '/birthdays.html', 'utf8');
  ok('birthday song wired', born.includes('playBday') && born.includes('Play Birthday Song'));
}

/* ---- admin: autofill, nudge, pta, scheduler, transport, comments, vols, sick, history ---- */
{
  const { window: w, errors, run } = loadPage('portal/admin.html', ADMIN);
  const t4 = run('autoFillTT(); JSON.stringify(DB.load().timetable)===JSON.stringify(U.timetable(CLASSES[0]))');
  ok('timetable auto-fill saves default', t4 === true);
  ok('autofill shows custom label', w.document.getElementById('ttEdit').textContent.includes('custom (saved)'));
  run(`db=DB.load(); const T=U.todayStr();
    const plus=n=>{const d=new Date(T+"T12:00:00");d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
    const mk=(ward,status,exp)=>({id:"RG"+ward,ward:{first:ward,surname:"KID",gender:"F",dob:"2020-01-01",classApply:"Primary 1"},guardian:{g1:{name:"G",phone:"1"}},payment:{status:"Unpaid",method:"Bank transfer"},status,expiry:exp});
    db.registrations=[mk("URGENT","Pending",plus(1)),mk("LATER","Pending",plus(20)),mk("DONE","Approved",plus(-1))];
    DB.save(db); renderRegs();`);
  const firstReg = w.document.getElementById('regRows').querySelector('tr').textContent;
  ok('expiry nudge floats urgent first', firstReg.includes('URGENT KID'), firstReg.slice(0, 80));
  run('document.getElementById("ptaFam").value="Bello Family"; document.getElementById("ptaAmt").value="2000"; savePTA();');
  const pta = w.__DB.load().pta;
  ok('pta levy + receipt', pta.length === 1 && /^TA\/\d{4}\/\d{4}$/.test(pta[0].receipt), JSON.stringify(pta[0] || {}));
  ok('pta total renders', w.document.getElementById('ptaRows').textContent.includes('Bello Family'));
  run(`db=DB.load(); db.newsEvents=[{id:"N1",type:"news",title:"SPOT ONE",date:"2026-09-01",image:"assets/img/sports.png",text:"t",story:"s",views:0},{id:"N2",type:"news",title:"SPOT TWO",date:"2026-09-02",image:"assets/img/culture.png",text:"t",story:"s",views:0}]; DB.save(db);
    setSpotlight("N1"); setSpotlight("N2");`);
  const ph = w.__DB.load().photoHistory;
  ok('spotlight archives history', ph.length === 1 && ph[0].cap === 'SPOT ONE', JSON.stringify(ph));
  ok('history strip renders', w.document.getElementById('phRows').innerHTML.includes('<img'));
  run('openNEModal(); document.getElementById("neTitle").value="FUTURE NEWS"; document.getElementById("neText").value="later"; document.getElementById("nePub").value="2027-01-15"; saveNE("");');
  const fut = w.__DB.load().newsEvents.find(n => n.title === 'FUTURE NEWS');
  ok('news scheduler saves publishAt', fut && fut.publishAt === '2027-01-15');
  ok('scheduled badge renders', w.document.getElementById('neRows').textContent.includes('Scheduled'));
  run('document.getElementById("trRoute").value="Route Z - Test"; document.getElementById("trPick").value="Test stop"; document.getElementById("trFee").value="4000"; saveRoute();');
  const routes = w.__DB.load().transportRoutes;
  ok('transport route added', routes.some(r => r.route === 'Route Z - Test'));
  run('document.getElementById("trPupil").value="Rider Kid"; document.getElementById("trClass").value="Primary 2"; saveTransport();');
  ok('transport assignment saved', w.__DB.load().transport.some(t => t.pupil === 'Rider Kid') && w.document.getElementById('trRows').textContent.includes('Rider Kid'));
  run('document.getElementById("cbNew").value="BANK TEST REMARK"; saveComment();');
  ok('comment bank add', w.__DB.load().commentBank.includes('BANK TEST REMARK'));
  run('delComment(db.commentBank.length-1);');
  ok('comment bank del', !w.__DB.load().commentBank.includes('BANK TEST REMARK'));
  run('db=DB.load(); db.volunteers=[{id:"V1",name:"Helper Mum",phone:"0801",event:"Any event",date:"2026-09-16"}]; db.sickbay=[{id:"S1",pupil:"Sick Kid",class:"Primary 1",complaint:"Fever",treatment:"Rest",date:"2026-09-16",parentCalled:true}]; DB.save(db); renderVols(); renderSick();');
  ok('volunteers render', w.document.getElementById('volRows').textContent.includes('Helper Mum'));
  ok('sick-bay renders', w.document.getElementById('sickRows').textContent.includes('Fever'));
  ok('admin clean', errors.length === 0, errors.join(' || ').slice(0, 300));
}

/* ---- teacher: remark select, sick modal, saveScores remark ---- */
{
  const { window: w, errors, run } = loadPage('portal/teacher.html', TEACHER, win => {
    const db = win.__DB.load();
    db.pupils.push({ id: 'P9', adm: 'TA/2026/009', name: 'Sick Test', gender: 'Female', class: 'Primary 3', dob: '2018-01-01', parent: 'P', phone: '1' });
    win.__DB.save(db);
  });
  ok('remark select filled from bank', [...w.document.getElementById('resRemark').options].some(o => o.text.includes('excellent result')));
  run('openSickModal("P9"); document.getElementById("skComp").value="Headache"; document.getElementById("skCall").value="yes"; saveSick("P9");');
  const sb = w.__DB.load().sickbay;
  ok('teacher sick-bay log', sb.length === 1 && sb[0].pupil === 'Sick Test' && sb[0].parentCalled === true, JSON.stringify(sb[0] || {}));
  run(`document.getElementById("resPupil").value="P9";
    document.querySelector('.score-input[data-part="ca1"]').value="15";
    document.getElementById("resRemark").selectedIndex=1; saveScores("Draft");`);
  const r = w.__DB.load().results.find(x => x.pupilId === 'P9');
  ok('scores save teacher remark', !!(r && r.tremark), JSON.stringify((r || {}).tremark));
  ok('teacher clean', errors.length === 0, errors.join(' || ').slice(0, 300));
}

/* ---- pupil: teacher remark on report + sidebar regression ---- */
{
  const { window: w, errors, run } = loadPage('portal/pupil.html', PUPIL, win => {
    const db = win.__DB.load();
    db.results.push({ id: 'R-T10', pupilId: 'P001', class: 'Primary 1', term: db.school.term, session: db.school.session, tremark: 'A shining star!', scores: { 'English Language': { ca1: 18, ca2: 17, exam: 55 } }, status: 'Published', updatedAt: new Date().toISOString() });
    db.results.forEach(x => { if (x.pupilId === 'P001' && x.status === 'Published') x.tremark = 'A shining star!'; });
    win.__DB.save(db);
  });
  ok('report shows teacher remark', w.document.getElementById('reportCard').textContent.includes('A shining star!'));
  run('document.querySelector(\'#sideNav button[data-view="fees"]\').click();');
  ok('pupil sidebar fees click', w.document.getElementById('v-fees').classList.contains('on') && w.document.getElementById('pageTitle').textContent === 'School Fees');
  ok('pupil clean', errors.length === 0, errors.join(' || ').slice(0, 300));
}

/* ---- public: scheduler filter, history, transport, volunteer, song ---- */
{
  const seed = win => {
    const db = win.__DB.load();
    db.newsEvents = [
      { id: 'N-PUB', type: 'news', title: 'VISIBLE STORY', date: '2026-09-10', publishAt: '2026-09-10', image: 'assets/img/sports.png', text: 't', story: 's', views: 0 },
      { id: 'N-FUT', type: 'news', title: 'HIDDEN FUTURE', date: '2026-09-20', publishAt: '2027-05-01', image: 'assets/img/culture.png', text: 't', story: 's', views: 0 }
    ];
    db.photoHistory = [{ src: 'assets/img/sports.png', cap: 'Old week', week: '2026-09-01' }];
    win.__DB.save(db);
  };
  const n = loadPage('news.html', null, seed);
  ok('news page hides scheduled', !n.window.document.body.textContent.includes('HIDDEN FUTURE') && n.window.document.body.textContent.includes('VISIBLE STORY'));
  const i = loadPage('index.html', null, seed);
  ok('index slider hides scheduled', !i.window.document.body.textContent.includes('HIDDEN FUTURE'));
  ok('index shows photo history', i.window.document.getElementById('spotZone').textContent.includes('Previous weeks'));
  const t = loadPage('transport.html');
  ok('transport lists routes', t.window.document.getElementById('routeList').textContent.includes('Route A'));
  const v = loadPage('volunteer.html');
  v.run('document.getElementById("volName").value="Eager Dad"; document.getElementById("volPhone").value="0802"; saveVol();');
  ok('volunteer signup', v.window.__DB.load().volunteers.length === 1 && v.window.document.getElementById('volCount').textContent === '1');
  const b = loadPage('birthdays.html');
  b.run('playBday();');
  ok('birthday song no-throw', typeof b.window.playBday === 'function');
  const cleanPages = [n, i, t, v, b].every(p => p.errors.length === 0);
  ok('public pages clean', cleanPages, [n, i, t, v, b].map(p => p.errors.join(';')).join(' || ').slice(0, 300));
}

console.log(`\n==== BATCH10: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
