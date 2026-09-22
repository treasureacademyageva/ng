/* (b41-retargeted)  Batch 37: admin quick actions, reading mode, photo watermark, teacher first-login tour */
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
const corp = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'x' };
const TEACHER = { role: 'teacher', refId: 'T001', name: 'x' };
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('FAIL -', name, extra || ''); }
}
function loadPage(page, session, url, pre, noStore) {
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
  if (!noStore) { vm.runInContext(store + '\n;window.__U=U;', window); vm.runInContext('window.__DB=DB;', window); }
  if (session) vm.runInContext('localStorage.setItem("treasure_session_v1", \'' + JSON.stringify(session) + '\');', window);
  if (pre) vm.runInContext(pre, window);
  vm.runInContext(sitejs + '\n;\n' + scripts, window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, errors: errors.filter(x => !/navigation|Not implemented/i.test(x)), run: c => vm.runInContext(c, window) };
}

/* ---------- A. quick actions ---------- */
const admHtml = fs.readFileSync(SITE + '/portal/admin.html', 'utf8');
ok('qa strip markup', admHtml.includes('class="qa-strip"') && admHtml.includes("+ Pupil") && admHtml.includes("Mark Paid"));
ok('qa wiring', admHtml.includes("window.qaGo=function(v,after)"));
ok('qa css', corp.includes('.qa-strip{display:grid;grid-template-columns:repeat(3,1fr)') && corp.includes('body.side-slim .qa-btn{font-size:0'));
const adm = loadPage('portal/admin.html', ADMIN);
adm.run('qaGo("notices")');
ok('qa navigates to notices', adm.window.document.getElementById('v-notices').classList.contains('on'));
adm.run('qaGo("pupils",openPupilModal)');
ok('qa opens add-pupil modal', adm.window.document.getElementById('v-pupils').classList.contains('on') && (adm.window.document.getElementById('modalBox').innerHTML.includes('Pupil') || adm.window.document.getElementById('modalBg').classList.contains('show')));
ok('sideNav count still 22', adm.window.document.querySelectorAll('#sideNav button[data-view]').length === 22);
ok('admin clean', adm.errors.length === 0, adm.errors.join(' || ').slice(0, 140));

/* ---------- B. photo watermark ---------- */
ok('watermark in photoFile', admHtml.includes('Treasure Academy",cv.width-fs,cv.height-fs*0.8') && admHtml.includes('toDataURL("image/jpeg",0.85)'));
ok('watermark guards', admHtml.includes('if(!cx){ use(r.result); return; }') && admHtml.includes('img.onerror=()=>use(r.result);') && admHtml.includes('cx.fillStyle="#FFFFFF"'));

/* ---------- C. reading mode ---------- */
const story = fs.readFileSync(SITE + '/story.html', 'utf8');
ok('read button on story page', story.includes('id="readBtn"') && story.includes("classList.toggle('reading')"));
ok('reading css', corp.includes('body.reading{display:block}') && corp.includes('body.reading .story-body p{font-size:1.08rem;line-height:2}') && corp.includes('body.reading .topbar,body.reading .navbar'));
const st = loadPage('story.html', '?id=NE9', null, 'var d=DB.load(); d.newsEvents.unshift({id:"NE9",type:"news",date:U.todayStr(),title:"T",text:"x",image:"assets/img/hero-kids.png",views:0,likes:0}); DB.save(d);');
ok('story loads clean', st.errors.length === 0, st.errors.join(' || ').slice(0, 160));
ok('story read button wired + toggles', !!st.window.document.getElementById('readBtn') && st.window.document.getElementById('readBtn').getAttribute('onclick').includes("toggle('reading')") && (() => { st.run("document.body.classList.toggle('reading')"); return st.window.document.body.classList.contains('reading'); })());

/* ---------- D. teacher tour ---------- */
ok('tour code present', fs.readFileSync(SITE + '/portal/teacher.html', 'utf8').includes('treasure_tour_done') && fs.readFileSync(SITE + '/portal/teacher.html', 'utf8').includes('Step \'+(i+1)+\' of \'+steps.length'));
ok('tour css', corp.includes('#tourOv{position:fixed') && corp.includes('.tour-hl{outline:3px solid #F7E967'));
const t1 = loadPage('portal/teacher.html', TEACHER);
ok('tour shows on first login', !!t1.window.document.getElementById('tourOv') && t1.window.document.getElementById('tourCard').textContent.includes('Step 1 of 3') && t1.window.document.getElementById('tourCard').textContent.includes('Mark Register'));
t1.window.document.getElementById('tourNext').click();
ok('tour advances to step 2', t1.window.document.getElementById('tourCard').textContent.includes('Step 2 of 3') && t1.window.document.getElementById('tourCard').textContent.includes('Input Results'));
t1.window.document.getElementById('tourSkip').click();
ok('skip sets flag + removes', t1.window.localStorage.getItem('treasure_tour_done') === '1' && !t1.window.document.getElementById('tourOv'));
const t2 = loadPage('portal/teacher.html', TEACHER, null, 'localStorage.setItem("treasure_tour_done","1");');
ok('tour never again after flag', !t2.window.document.getElementById('tourOv'));
const t3 = loadPage('portal/teacher.html', TEACHER);
t3.window.document.getElementById('tourNext').click();
t3.window.document.getElementById('tourNext').click();
ok('step 3 shows finish', t3.window.document.getElementById('tourCard').textContent.includes('Step 3 of 3') && !!t3.window.document.getElementById('tourDone'));
t3.window.document.getElementById('tourDone').click();
ok('finish sets flag + removes', t3.window.localStorage.getItem('treasure_tour_done') === '1' && !t3.window.document.getElementById('tourOv'));
ok('teacher clean', t1.errors.length === 0, t1.errors.join(' || ').slice(0, 140));

/* ---------- E. versions ---------- */
let stale = 0;
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  if (fs.readFileSync(p, 'utf8').includes('20260919-36')) { console.log('  stale -36 in', p); stale++; }
}
ok('no stale -36 versions', stale === 0);
ok('sw + dev on v37', fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v46') && fs.readFileSync(SITE + '/developer.html', 'utf8').includes('var BUILD = "treasure-v46";'));

/* ---------- F. dark loads ---------- */
for (const pg of ['portal/admin.html', 'story.html']) {
  const s = pg === 'portal/admin.html' ? ADMIN : null;
  const w = loadPage(pg, s, null, 'document.documentElement.dataset.theme="dark";');
  ok(pg + ' dark clean', w.errors.length === 0, w.errors.join(' || ').slice(0, 140));
}

console.log(`\n==== BATCH37: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
