/* Batch 19: footer titles+spacing, de-AI copy, news redesign + video space,
   S1 admission letter, S2 defaulters+WA (verify), S3 calendar print, cleanup */
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
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, errors: errors.filter(x => !/navigation|Not implemented/i.test(x)), run: c => vm.runInContext(c, window) };
}
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'x' };

/* ---------- footer ---------- */
{
  const css = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
  ok('footer titles centered', css.includes('.foot-col h4{text-align:center') && css.includes('.foot-brand .logo{display:block;text-align:center'));
  ok('footer even spacing', css.includes('.foot-main{gap:32px;margin-bottom:20px'));
  const { window: w } = loadPage('index.html');
  const f = w.document.getElementById('siteFooter').innerHTML;
  ok('footer contact left-aligned', f.includes('foot-contact-row') && !f.includes('foot-contact foot-center'));
  ok('footer human copy', f.includes('Ageva, Okene. Discipline, character'));
}

/* ---------- de-AI copy ---------- */
{
  const idx = fs.readFileSync(SITE + '/index.html', 'utf8');
  ok('hero human', idx.includes('education: disciplined classrooms, proven Common Entrance results, plus online access'));
  ok('no anytime-anywhere', !idx.includes('anytime, anywhere'));
  ok('quote human', idx.includes('foundation. That is the Treasure Academy promise.'));
  const ab = fs.readFileSync(SITE + '/about.html', 'utf8');
  ok('founder commas', ab.includes('trained teacher, to give children'));
  const ad = fs.readFileSync(SITE + '/admissions.html', 'utf8');
  ok('admissions periods', ad.includes('This application has expired. Please') && ad.includes('Payment received. The'));
  ok('store seeds human', store.includes('Almost there: excellence in sight.'));
}

/* ---------- news redesign ---------- */
{
  const { window: w, run, errors } = loadPage('news.html');
  const feat = w.document.getElementById('newsFeatured').innerHTML;
  ok('featured renders', feat.includes('news-featured') && feat.includes('LATEST') && feat.includes('Read Full Story'));
  ok('featured is latest', feat.includes('5th Graduation Ceremony')); // latest by date desc
  ok('video space always shown', w.document.getElementById('vidWrap').style.display !== 'none');
  ok('tour video placeholder', w.document.getElementById('videoRail').innerHTML.includes('Coming Soon'));
  const css = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
  ok('butter play button', css.includes('.yt-thumb .play span{background:var(--sun);color:var(--green)'));
  ok('green video border', css.includes('.yt-card.is-video{outline:none;border:2px solid var(--green)'));
  ok('news no errors', errors.length === 0, errors.join('||').slice(0, 160));
}
{
  // real video card when a videoUrl exists
  const { window: w } = loadPage('news.html', null, null,
    'var d=DB.load(); d.newsEvents.find(n=>n.id==="NEG5").videoUrl="https://www.youtube.com/watch?v=abc123"; DB.save(d);');
  const rail = w.document.getElementById('videoRail').innerHTML;
  ok('real video card', rail.includes("playVideo('NEG5')") && rail.includes('VIDEO'));
  ok('video count badge', w.document.getElementById('vidCount').textContent.includes('1 video'));
}

/* ---------- S1 admission letter ---------- */
{
  const { window: w, run } = loadPage('portal/admin.html', ADMIN, null,
    'var d=DB.load(); d.applications.push({id:"AP1", pupilName:"Olivia Eze", dob:"2020-02-14", gender:"Female", classApply:"Nursery 1", parent:"Mrs. Eze", phone:"0807 111 0000", date:"2026-09-10", status:"Pending"}); DB.save(d);');
  run('approveApp("AP1");');
  run('closeModal(); renderApps();');
  ok('letter button on admitted', w.document.getElementById('appRows').innerHTML.includes("printAdmLetter('AP1')"));
  run('printAdmLetter("AP1");');
  const slip = w.document.getElementById('printSlip').innerHTML;
  ok('letter content', slip.includes('OFFER OF ADMISSION') && slip.includes('Olivia Eze') && slip.includes('Nursery 1') && slip.includes('within <b>two weeks</b>'));
  ok('letter has login + ref', slip.includes('TA/ADM/') && slip.includes('0807 111 0000'));
}

/* ---------- S2 defaulters + WA (verify-only, shipped earlier) ---------- */
{
  const { window: w, run } = loadPage('portal/admin.html', ADMIN);
  run('var d=DB.load(); d.registrations.push({id:"RG7",status:"Admitted",ward:{first:"Emeka",surname:"Nwosu",classApply:"Primary 1"},guardian:{g1:{name:"Mr N",phone:"0805 333 4444"}},payment:{status:"Unpaid",method:"Bank transfer",parts:[{amount:10000}]}}); DB.save(d); renderDefaulters();');
  const z = w.document.getElementById('defZone').innerHTML;
  ok('defaulter listed', z.includes('Emeka Nwosu'));
  ok('one-tap WhatsApp', z.includes('https://wa.me/2348053334444?text='));
}

/* ---------- S3 calendar print ---------- */
{
  const src = fs.readFileSync(SITE + '/calendar.html', 'utf8');
  ok('print css', src.includes('@media print') && src.includes('.no-print'));
  const { window: w } = loadPage('calendar.html');
  ok('print letterhead', w.document.getElementById('printHead').innerHTML.includes('Term Calendar'));
  ok('still 5 dates', w.document.getElementById('calList').children.length === 5);
}

/* ---------- cleanup ---------- */
{
  ok('roadmap md removed', !fs.existsSync(SITE + '/moniepoint-payments-plan.md'));
  const rm = fs.readFileSync(SITE + '/README.md', 'utf8');
  ok('roadmap preserved in README', rm.includes('Payments roadmap') && rm.includes('Monnify'));
  ok('README phone demos', rm.includes('0805 111 2222') && rm.includes('0803 100 0001') && !rm.includes('TA/2023/001'));
  ok('logo backup removed', !fs.existsSync('/home/user/logo-backup.jpg'));
}

console.log(`\n==== BATCH19: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
