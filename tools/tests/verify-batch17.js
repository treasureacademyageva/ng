/* Batch 17: reading log, fees dashboard, chatbot intents, story listen,
   timetable today, idea replies, bulk report print */
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
  window.print = () => {}; window.scrollTo = () => {}; window.open = () => {}; window.requestAnimationFrame = () => 0;
  const scripts = [...window.document.querySelectorAll('script:not([src])')].map(s => s.textContent).join('\n;\n');
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
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'x' };
const PUPIL = { role: 'pupil', refId: 'P001', name: 'x' };

/* ---------- #6 chatbot intents ---------- */
{
  const { run, errors } = loadPage('index.html');
  ok('chat: receipt intent', run('Chatbot.answer("how do I verify my receipt")').includes('Verify a Receipt'));
  ok('chat: receipt genuine-word', run('Chatbot.answer("is this receipt genuine")').includes('Admissions page'));
  ok('chat: best uncrowned', run('Chatbot.answer("who is the best student")').includes('not been crowned'));
  run('var d=DB.load(); d.bestStudent={name:"Adaeze Okafor",class:"Primary 1",score:88,parts:{},term:"T",session:"S",published:true,date:"x"}; d.readTop=[{id:"R1",name:"Adaeze Okafor",class:"P1",books:12}]; DB.save(d);');
  ok('chat: best crowned', run('Chatbot.answer("overall best")').includes('Adaeze Okafor'));
  ok('chat: top readers', run('Chatbot.answer("top readers")').includes('12 book'));
  ok('chat: no errors', errors.length === 0, errors.join('||').slice(0, 160));
}

/* ---------- #2 reading log ---------- */
{
  const { window: w, run, errors } = loadPage('reading.html');
  run('document.getElementById("lgName").value="Log Kid"; document.getElementById("lgClass").value="Primary 2"; document.getElementById("lgBook").value="Tortoise Tales"; logBook();');
  ok('log: stored', run('DB.load().readLog.length') === 1);
  ok('log: feeds leaderboard', w.document.getElementById('topCard').innerHTML.includes('Log Kid'));
  run('document.getElementById("lgName").value="log kid"; document.getElementById("lgBook").value="Second Book"; logBook();');
  ok('log: name-match increments', run('DB.load().readTop.find(r=>r.name==="Log Kid").books') === 2);
  const a = loadPage('portal/admin.html', ADMIN, null, 'var d=DB.load(); d.readLog=[{id:"RL1",name:"Kid",class:"P1",book:"Tales",date:"x"}]; DB.save(d);');
  ok('log: admin sees logs', a.window.document.getElementById('rlRows').innerHTML.includes('Tales'));
  ok('log: no errors', errors.length === 0, errors.join('||').slice(0, 160));
}

/* ---------- #4 fees dashboard ---------- */
{
  const { window: w, run, errors } = loadPage('portal/admin.html', ADMIN, null,
    'var d=DB.load(); d.registrations.push({id:"RG4",status:"Admitted",ward:{first:"A",surname:"B",classApply:"Primary 1"},guardian:{g1:{name:"G",phone:"1"}},payment:{status:"Unpaid",method:"x",parts:[{amount:15000}]}}); DB.save(d);');
  run('renderFeesDash();');
  const h = w.document.getElementById('feesDash').innerHTML;
  ok('dash: per-class bars', h.includes('Primary 1') && h.includes('15,000'));
  ok('dash: school totals', h.includes('Whole school'));
  ok('dash: no errors', errors.length === 0, errors.join('||').slice(0, 160));
}

/* ---------- #7 story listen ---------- */
{
  const { window: w, run } = loadPage('story.html', null, 'http://localhost/story.html?id=NE1');
  ok('story: Listen button', w.document.getElementById('storyBox').innerHTML.includes('listenStory()'));
  let t = true; try { run('listenStory();'); } catch (e) { t = false; }
  ok('story: listen runs', t);
}

/* ---------- #8 today highlight ---------- */
{
  const { window: w, run } = loadPage('portal/pupil.html', PUPIL, null,
    'var __RD=Date; Date=function(...a){ return a.length?new __RD(...a):new __RD("2026-09-18T12:00:00"); }; Date.now=__RD.now;');
  run('renderTT();');
  const h = w.document.getElementById('ttWrap').innerHTML;
  ok('tt: Friday stub is Friday', run('U.weekdayName()') === 'Friday');
  ok('tt: today row highlighted', h.includes('tt-today') && h.includes('>Today<'));
}

/* ---------- #9 idea replies ---------- */
{
  const { window: w, run } = loadPage('portal/admin.html', ADMIN, null,
    'var d=DB.load(); d.suggestions.unshift({id:"SG4",text:"More swings",date:"x",votes:1,published:true}); DB.save(d);');
  ok('reply: admin box', w.document.getElementById('sgRows').innerHTML.includes('rp-SG4'));
  run('document.getElementById("rp-SG4").value="Coming soon!"; replySG("SG4");');
  ok('reply: saved', run('DB.load().suggestions.find(g=>g.id==="SG4").reply') === 'Coming soon!');
  const c = loadPage('contact.html', null, null,
    'var sd=DB.load(); sd.suggestions.unshift({id:"SG4",text:"More swings",date:"x",votes:1,published:true,reply:"Coming soon!"}); DB.save(sd);');
  ok('reply: public shows', c.window.document.getElementById('ideaWall').innerHTML.includes('School reply'));
}

/* ---------- #10 bulk print ---------- */
{
  const { window: w, run, errors } = loadPage('portal/admin.html', ADMIN);
  run('document.getElementById("resClassFilter").value="Primary 1"; printClassReports();');
  const h = w.document.getElementById('printSlip').innerHTML;
  ok('bulk: cards print', h.includes('TERMINAL REPORT') && h.includes('Adaeze Okafor'));
  ok('bulk: averages + positions', h.includes('AVG:') && h.includes('POS:'));
  run('document.getElementById("resClassFilter").value=""; printClassReports();');
  ok('bulk: needs a class', w.document.getElementById('toast').textContent.includes('Pick a class'));
  ok('bulk: no errors', errors.length === 0, errors.join('||').slice(0, 160));
}

console.log(`\n==== BATCH17: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
