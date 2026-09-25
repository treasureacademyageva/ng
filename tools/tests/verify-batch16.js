/* (b41-retargeted)  Batch 16: nav fix, search, receipts, timetable, slips, WA, voice, leaderboard,
   best-student, sick push, RSVP, votes, alumni, HW photos, night auto, share card, midterm */
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
  Object.defineProperty(window, 'CSS', { value: { escape: s => String(s).replace(/[^a-z0-9_-]/gi, c => '\\' + c) }, configurable: true });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.print = () => {}; window.scrollTo = () => {}; window.open = () => {};
  const scripts = [...window.document.querySelectorAll('script:not([src]):not([type="application/ld+json"])')].map(s => s.textContent).join('\n;\n');
  const errors = [];
  window.addEventListener('error', e => errors.push(String((e.message || e.error || '').slice(0, 140))));
  vm.createContext(window);
  vm.runInContext(store, window);
  vm.runInContext('window.__DB=DB;', window);
  if (session) vm.runInContext('localStorage.setItem("treasure_session_v1", \'' + JSON.stringify(session) + '\');', window);
  if (pre) vm.runInContext(pre, window);
  vm.runInContext(site + '\n;\n' + scripts, window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, errors: errors.filter(x => !/navigation|Not implemented/i.test(x)), run: c => vm.runInContext(c, window) };
}
const PUPIL = { role: 'pupil', refId: 'P001', name: 'x' };
const TEACHER = { role: 'teacher', refId: 'T001', name: 'x' };
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'x' };

/* ---------- P1: sidebar navigation ---------- */
for (const [page, sess, n] of [['portal/pupil.html', PUPIL, 7], ['portal/teacher.html', TEACHER, 12], ['portal/admin.html', ADMIN, 24]]) {
  const { window: w, errors, run } = loadPage(page, sess);
  const btns = [...w.document.querySelectorAll('#sideNav button[data-view]')];
  let dead = [];
  btns.forEach(b => {
    w.document.body.classList.add('side-open');
    b.click();
    const sec = w.document.getElementById('v-' + b.dataset.view);
    if (!sec || !sec.classList.contains('on')) dead.push(b.dataset.view + ':section');
    if (!b.classList.contains('on')) dead.push(b.dataset.view + ':active');
    if (!w.document.getElementById('pageTitle').textContent) dead.push(b.dataset.view + ':title');
    if (w.document.body.classList.contains('side-open')) dead.push(b.dataset.view + ':drawer');
  });
  ok(`${page}: ${n} buttons navigate+title+drawer`, btns.length === n && dead.length === 0, `n=${btns.length} dead=${dead.join(',')}`);
  ok(`${page}: single binding (no inline onclick)`, btns.every(b => !b.hasAttribute('onclick')));
  ok(`${page}: no boot errors`, errors.length === 0, errors.join(' || ').slice(0, 200));
}
{
  // hash restore + render-on-navigate + no double binding
  const { window: w } = loadPage('portal/pupil.html', PUPIL, 'http://localhost/portal/pupil.html#/fees');
  ok('hash deep-link restores view', w.document.getElementById('v-fees').classList.contains('on'));
  const { window: w2, run } = loadPage('portal/pupil.html', PUPIL);
  run('document.getElementById("ttWrap").innerHTML="";');
  w2.document.querySelector('#sideNav button[data-view="timetable"]').click();
  ok('render-on-navigate fills view', w2.document.getElementById('ttWrap').innerHTML.includes('<table'));
  ok('demo buttons wired one-tap', fs.readFileSync(SITE + '/portal/login.html', 'utf8').includes('setTimeout(demoSubmit,350)'));
}

/* ---------- P1: one-tap demo login ---------- */
{
  // NOTE: jsdom+vm never fires inline onclick attributes (harness limit, real browsers fine),
  // so demo entry is invoked exactly as the button would invoke it.
  const { window: w, run } = loadPage('portal/login.html');
  run('fillDemo("0805 111 2222");');
  setTimeout(() => {
    let sess = null;
    try { sess = w.localStorage.getItem('treasure_session_v1'); } catch (e) {}
    ok('demo tap logs in (session set)', !!sess && sess.includes('P001'), String(sess).slice(0, 80));
    const { window: w2, run: run2 } = loadPage('portal/login.html', null, null,
      'var d=DB.load(); d.pupils.forEach(function(p){ if(p.phone==="0805 333 4444") p.password=null; }); DB.save(d);');
    run2('fillDemo("0805 333 4444");');
    ok('password-less login routes to create-password', w2.document.getElementById('toast').textContent.includes('no password yet'));
    finish();
  }, 900);
  return; // finish() continues async below
}
function finish() {

/* ---------- P2: search ---------- */
{
  const { window: w, run } = loadPage('index.html');
  run('Search.open(); Search.go("fee");');
  ok('search highlights matches', w.document.getElementById('searchRes').innerHTML.includes('<mark>'));
  run('Search.go("uniforms");');
  ok('search stems plurals', w.document.getElementById('searchRes').innerHTML.includes('Uniform List'));
  run('Search.go("mid term");');
  ok('search multi-word', w.document.getElementById('searchRes').innerHTML.includes('result'));
  run('Search.go("mathematics");');
  ok('search finds exams', w.document.getElementById('searchRes').innerHTML.includes('Exams'));
  run('Search.go("cardigan");');
  ok('search finds shop items', w.document.getElementById('searchRes').innerHTML.includes('Shop &amp; uniform') || w.document.getElementById('searchRes').innerHTML.includes('Shop & uniform'));
  run('Search.go("fee");');
  const inp = w.document.getElementById('searchInput');
  inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  ok('arrow-key selects result', !!w.document.querySelector('#searchRes a.sel'));
  run('Search.save("zzqtest"); Search.go("");');
  ok('recents shown', w.document.getElementById('searchRes').innerHTML.includes('zzqtest'));
  w.document.getElementById('clearRec').click();
  ok('clear recents works', !w.document.getElementById('searchRes').innerHTML.includes('zzqtest'));
}

/* ---------- #2 receipt checker ---------- */
{
  const { window: w, run } = loadPage('admissions.html');
  run('var d=DB.load(); d.registrations.push({id:"RG9",status:"Admitted",ward:{first:"Ada",surname:"T",classApply:"Primary 1"},guardian:{g1:{name:"P",phone:"1"}},payment:{status:"Paid",receipt:"TA/2026/0007",parts:[{amount:30000}]}}); d.pta.push({id:"P1",family:"Okafor",amount:5000,date:"2026-09-01",receipt:"TA/2026/0008"}); DB.save(d);');
  run('document.getElementById("rcNo").value="TA/2026/0007"; verifyReceipt();');
  ok('checker finds fee receipt', w.document.getElementById('rcOut').innerHTML.includes('GENUINE') && w.document.getElementById('rcOut').innerHTML.includes('School Fee'));
  run('document.getElementById("rcNo").value="ta/2026/0008"; verifyReceipt();');
  ok('checker finds PTA receipt (case-blind)', w.document.getElementById('rcOut').innerHTML.includes('PTA Levy'));
  run('document.getElementById("rcNo").value="BOGUS/1"; verifyReceipt();');
  ok('checker rejects unknown', w.document.getElementById('rcOut').innerHTML.includes('NOT FOUND'));
}

/* ---------- #3 single timetable ---------- */
{
  const { window: w, run } = loadPage('portal/admin.html', ADMIN);
  run('document.querySelector("#ttEdit input").value="Yoga"; saveTT();');
  const t = run('DB.load().timetable');
  ok('single grid saves', !!(t && JSON.stringify(t).includes('Yoga')));
  run('resetTT();');
  ok('reset clears grid', run('DB.load().timetable') === null);
  run('autoFillTT();');
  ok('auto-fill builds grid', !!(run('DB.load().timetable') && run('Object.keys(DB.load().timetable).length') === 5));
  ok('pupil uses single grid', (() => {
    const { run: r2 } = loadPage('portal/pupil.html', PUPIL);
    return r2('JSON.stringify(U.getTimetable(DB.load(),"Primary 1"))===JSON.stringify(U.getTimetable(DB.load(),"Primary 6"))');
  })());
}

/* ---------- #4 seat slips ---------- */
{
  const { window: w, run } = loadPage('portal/admin.html', ADMIN);
  ok('exam class matcher', run('examFits("Primary 1-6","Primary 4")') === true && run('examFits("Primary 1-6","Primary 6")') === true && run('examFits("Nursery 1-2","Primary 1")') === false && run('examFits("All","Creche")') === true);
  run('document.getElementById("slipClass").value="Primary 1"; printSeatSlips();');
  const h = w.document.getElementById('printSlip').innerHTML;
  ok('seat slips print per class', h.includes('SEAT 1') && h.includes('Adaeze Okafor') && h.includes('EXAMINATION SEAT SLIP'));
}

/* ---------- #7 defaulter WhatsApp ---------- */
{
  const { window: w, run } = loadPage('portal/admin.html', ADMIN);
  run('var d=DB.load(); d.registrations.push({id:"RG7",status:"Admitted",ward:{first:"Emeka",surname:"Nwosu",classApply:"Primary 1"},guardian:{g1:{name:"Mr N",phone:"0805 333 4444"}},payment:{status:"Unpaid",method:"Bank transfer",parts:[{amount:10000}]}}); DB.save(d); renderDefaulters();');
  const h = w.document.getElementById('defZone').innerHTML;
  ok('WA link uses guardian phone', h.includes('wa.me/2348053334444'));
  ok('WA template carries balance', h.includes(encodeURIComponent('NGN 20,000').slice(0, 10)));
}

/* ---------- #9 voice ---------- */
{
  const a = loadPage('portal/pupil.html', PUPIL);
  ok('pupil Listen buttons', a.window.document.getElementById('noticeList').innerHTML.includes('Listen'));
  let t1 = true; try { a.run('speakNotice("NT2");'); } catch (e) { t1 = false; }
  ok('pupil speak no-throw', t1);
  const b = loadPage('portal/teacher.html', TEACHER);
  ok('teacher Listen buttons', b.window.document.getElementById('noticeList').innerHTML.includes('Listen'));
  let t2 = true; try { b.run('speakNotice("NT1");'); } catch (e) { t2 = false; }
  ok('teacher speak no-throw', t2);
}

/* ---------- #10 reading leaderboard ---------- */
{
  const { window: w, run } = loadPage('portal/admin.html', ADMIN);
  run('document.getElementById("rtName").value="Top Kid"; document.getElementById("rtClass").value="Primary 4"; document.getElementById("rtBooks").value="9"; saveReadTop();');
  ok('admin adds reader', run('DB.load().readTop.length') === 1);
  ok('reader row renders', w.document.getElementById('rtRows').innerHTML.includes('Top Kid'));
  const id = run('DB.load().readTop[0].id');
  run('delReadTop("' + id + '");');
  ok('admin deletes reader', run('DB.load().readTop.length') === 0);
  const seed = 'var sd=DB.load(); sd.readTop=[{id:"R1",name:"Adaeze Okafor",class:"Primary 1",books:12},{id:"R2",name:"Emeka Nwosu",class:"Primary 1",books:4}]; DB.save(sd);';
  const r = loadPage('reading.html', null, null, seed);
  ok('public top-10 renders', r.window.document.getElementById('topCard').innerHTML.includes('Adaeze Okafor'));
}

/* ---------- #11 streaks + best student ---------- */
{
  const { window: w, run } = loadPage('portal/pupil.html', PUPIL);
  run('var d=DB.load(); d.attendance=[]; for(let i=0;i<6;i++)d.attendance.push({date:"2026-09-0"+(i+1),class:"Primary 1",records:{P001:"P"}}); DB.save(d); renderAttendance();');
  ok('streak stars shown', w.document.getElementById('attList').innerHTML.includes('Attendance Stars'));
  ok('streak math', run('JSON.stringify(U.streak(DB.load(),"P001"))') === JSON.stringify({ days: 6, stars: 1 }));
  run('var d2=DB.load(); d2.attendance.push({date:"2026-09-20",class:"Primary 1",records:{P001:"A"}}); DB.save(d2);');
  ok('absence breaks streak', run('U.streak(DB.load(),"P001").days') === 0);
  const { run: ra, window: wa } = loadPage('portal/admin.html', ADMIN);
  ra('var d=DB.load(); d.results.push({id:"R9",pupilId:"P001",class:"Primary 1",term:d.school.term,session:d.school.session,scores:{"English Language":{ca1:18,ca2:17,exam:55}},tremark:"G",status:"Published",updatedAt:new Date().toISOString()}); d.attendance=[{date:"2026-09-18",class:"Primary 1",records:{P001:"P"}},{date:"2026-09-17",class:"Primary 1",records:{P001:"P"}}]; d.registrations.push({id:"RG1",status:"Admitted",ward:{first:"Adaeze",surname:"Okafor",classApply:"Primary 1"},guardian:{g1:{name:"Mrs. Okafor",phone:"1"}},payment:{status:"Paid",method:"x"}}); DB.save(d); computeBest();');
  ok('best table ranks', wa.document.getElementById('bestZone').innerHTML.includes('Adaeze Okafor'));
  ok('best score math', ra('var x=U.bestRank(DB.load(),DB.load().school.term,DB.load().school.session).find(r=>r.p.id==="P001"); x.parts.att===20&&x.parts.fees===20&&x.parts.review===10&&x.parts.books===0&&x.parts.res===Math.round(x.avg/100*40)&&x.score===x.parts.att+x.parts.fees+x.parts.review+x.parts.books+x.parts.res') === true);
  ra('crownBest("P001");');
  ok('crown publishes', ra('DB.load().bestStudent.published') === true && ra('DB.load().bestStudent.name') === 'Adaeze Okafor');
  const ix = loadPage('index.html', null, null, 'var sd=DB.load(); sd.bestStudent={name:"Adaeze Okafor",class:"Primary 1",score:77,parts:{},term:"First Term",session:"s",published:true,date:"x"}; DB.save(sd);');
  ok('winner on homepage', ix.window.document.getElementById('totZone').innerHTML.includes('Best Student of the Session'));
}

/* ---------- #12 sick-bay push ---------- */
{
  const t = loadPage('portal/teacher.html', TEACHER);
  t.run('openSickModal("P002"); document.getElementById("skComp").value="Headache"; saveSick("P002");');
  const pushed = t.run('DB.load().notices.find(n=>n.toId==="P002")');
  ok('sick visit pushes parent notice', !!(pushed && pushed.title.includes('Sick-bay')));
}

/* ---------- #13 event RSVP ---------- */
{
  const { window: w, run } = loadPage('story.html', null, 'http://localhost/story.html?id=NE2');
  ok('event shows RSVP form', w.document.getElementById('storyBox').innerHTML.includes('Reserve Your Seat'));
  ok('seats-left shown', w.document.getElementById('storyBox').innerHTML.includes('seats left'));
  run('document.getElementById("rsvName").value="T Parent"; document.getElementById("rsvSeats").value="2"; rsvpEvent("NE2");');
  ok('RSVP saves with seats', run('DB.load().rsvps.filter(r=>r.eventId==="NE2").length') === 1);
  run('var d=DB.load(); var ev=d.newsEvents.find(e=>e.id==="NE2"); ev.seats=2; DB.save(d); document.getElementById("rsvName").value="Late"; rsvpEvent("NE2");');
  ok('overbooking blocked', run('DB.load().rsvps.filter(r=>r.eventId==="NE2").length') === 1);
  const n = loadPage('news.html', null, null, 'var sd=DB.load(); var ev=sd.newsEvents.find(e=>e.id==="NE2"); ev.seats=50; DB.save(sd);');
  ok('news shows seats badge', n.window.document.getElementById('neList').innerHTML.includes('seats left'));
}

/* ---------- #14 idea votes ---------- */
{
  const { window: w, run } = loadPage('portal/admin.html', ADMIN);
  run('var d=DB.load(); d.suggestions.unshift({id:"SG9",text:"More balls",date:"2026-09-19",votes:0}); DB.save(d); renderSG();');
  ok('publish toggle offered', w.document.getElementById('sgRows').innerHTML.includes('Publish'));
  run('toggleSG("SG9");');
  ok('idea publishes', run('DB.load().suggestions.find(g=>g.id==="SG9").published') === true);
  const c = loadPage('contact.html', null, null, 'var sd=DB.load(); sd.suggestions.unshift({id:"SG9",text:"More balls",date:"2026-09-19",votes:2,published:true}); DB.save(sd);');
  ok('ideas render publicly', c.window.document.getElementById('ideaWall').innerHTML.includes('More balls'));
  c.run('voteIdea("SG9");');
  ok('vote counts', c.run('DB.load().suggestions.find(g=>g.id==="SG9").votes') === 3);
  c.run('voteIdea("SG9");');
  ok('double vote blocked', c.run('DB.load().suggestions.find(g=>g.id==="SG9").votes') === 3);
}

/* ---------- #15 alumni wall ---------- */
{
  const { window: w, run } = loadPage('alumni.html');
  run('document.getElementById("alSubName").value="New Grad"; document.getElementById("alSubNote").value="Great"; submitAlumni();');
  ok('submission held for approval', run('DB.load().alumni.find(a=>a.name==="New Grad").status') === 'Pending');
  ok('pending hidden from wall', !w.document.getElementById('alumWall').innerHTML.includes('New Grad'));
  const a = loadPage('portal/admin.html', ADMIN);
  a.run('var d=DB.load(); d.alumni.unshift({id:"ALX",status:"Pending",name:"Zed",year:"2020",school:"S",note:"N"}); DB.save(d); renderAlumni(); approveAlumni("ALX");');
  ok('admin approves', a.run('DB.load().alumni.find(a=>a.id==="ALX").status') === 'Approved');
}

/* ---------- #16 homework photos ---------- */
{
  const h = loadPage('homework.html', null, null, 'var sd=DB.load(); sd.homework.unshift({id:"HW9",class:"Primary 1",subject:"Art",note:"Draw",date:"2026-09-19",photos:["data:image/png;base64,AAA"]}); DB.save(sd);');
  ok('photos render on board', h.window.document.getElementById('hwList').innerHTML.includes('data:image/png'));
  const t = loadPage('portal/teacher.html', TEACHER);
  t.run('document.getElementById("tHwNote").value="Read p1-5"; saveTHW();');
  ok('teacher posts homework', t.run('DB.load().homework.filter(x=>x.class==="Primary 1").length') > 0);
  ok('compress helper exists', t.run('typeof U.compressPhotos') === 'function');
}

/* ---------- #17 staff vote (live) + #18 night auto ---------- */
{
  const a = loadPage('alumni.html');
  const before = a.run('(DB.load().teacherVotes||{}).T001||0');
  a.run('voteTeacher("T001");');
  ok('public staff vote counts', a.run('(DB.load().teacherVotes||{}).T001') === before + 1);
  const ix = loadPage('index.html', null, null, 'var sd=DB.load(); sd.teacherVotes={T001:5}; DB.save(sd);');
  ok('monthly leader on homepage', ix.window.document.getElementById('totZone').innerHTML.includes('Leading Star'));
  const n1 = loadPage('index.html', null, null, 'localStorage.setItem("treasure_theme","dark");');
  ok('stored dark override respected', n1.window.document.documentElement.dataset.theme === 'dark');
  const n2 = loadPage('index.html', null, null, 'localStorage.setItem("treasure_theme","light");');
  ok('stored light override respected', n2.window.document.documentElement.dataset.theme === 'light');
  const n3 = loadPage('index.html', null, null, 'var __RD=Date; Date=function(){ const d=new __RD(); d.getHours=()=>22; return d; }; Date.now=__RD.now;');
  ok('auto night at 10pm', n3.window.document.documentElement.dataset.theme === 'dark');
  const n4 = loadPage('index.html', null, null, 'var __RD=Date; Date=function(){ const d=new __RD(); d.getHours=()=>10; return d; }; Date.now=__RD.now;');
  ok('auto day at 10am', n4.window.document.documentElement.dataset.theme === 'light');
}

/* ---------- #19 share card + #20 midterm ---------- */
{
  const { window: w, run } = loadPage('portal/pupil.html', PUPIL);
  run('var d=DB.load(); d.results.push({id:"R9",pupilId:"P001",class:"Primary 1",term:d.school.term,session:d.school.session,scores:{"English Language":{ca1:18,ca2:17,exam:55},"Mathematics":{ca1:15,ca2:16,exam:50}},tremark:"G",status:"Published",updatedAt:new Date().toISOString()}); DB.save(d); renderReport();');
  ok('midterm snapshot renders', w.document.getElementById('reportCard').innerHTML.includes('Mid-Term Snapshot'));
  ok('midterm math', run('U.midterm(DB.load().results.find(r=>r.id==="R9")).avg') === 33);
  let s = true; try { run('shareCard();'); } catch (e) { s = false; }
  ok('share card no-throw', s);
  ok('share button present', w.document.documentElement.innerHTML.includes('onclick="shareCard()"'));
}

console.log(`\n==== BATCH16: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
}
