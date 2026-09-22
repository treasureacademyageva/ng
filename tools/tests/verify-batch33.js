/* Batch 33: visitor log in developer console, resumption countdown chip, weekly testimonial spotlight */
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

/* ---------- A. visitor log module in developer console ---------- */
const dvh = fs.readFileSync(SITE + '/developer.html', 'utf8');
ok('visitor module markup', dvh.includes('id="dvVForm"') && dvh.includes('Sign in visitor') && dvh.includes('dvInside'));
ok('empty-bay text replaced', !dvh.includes('No modules moved here yet'));
const dv = loadPage('developer.html', null, null, 'sessionStorage.setItem("treasure_dev_gate", String(Date.now()));');
ok('module renders on unlock', !!dv.window.document.querySelector('.dv-mod') && dv.window.document.getElementById('dvVList') !== null);
ok('empty state shows', dv.window.document.getElementById('dvVList').textContent.includes('No visitors yet today'));
dv.window.document.getElementById('dvVName').value = 'Mama Ojo';
dv.window.document.getElementById('dvVWhom').value = 'Headmistress';
dv.window.document.getElementById('dvVPurp').value = 'Fee enquiry';
dv.window.document.getElementById('dvVForm').dispatchEvent(new dv.window.Event('submit', { bubbles: true, cancelable: true }));
const vrec = dv.run('window.__DB.load().visitors[0]');
ok('visitor saved with timeIn+date', vrec && vrec.name === 'Mama Ojo' && vrec.whom === 'Headmistress' && !!vrec.timeIn && !!vrec.date);
ok('inside count = 1', dv.window.document.getElementById('dvInside').textContent.includes('1 inside now'));
ok('checkout button offered', !!dv.window.document.querySelector('#dvVList button[data-out]'));
dv.window.document.querySelector('#dvVList button[data-out]').click();
ok('checkout writes timeOut', !!dv.run('window.__DB.load().visitors[0].timeOut') && dv.window.document.getElementById('dvVList').innerHTML.includes('out '));
ok('inside count back to 0', dv.window.document.getElementById('dvInside').textContent.includes('0 inside now'));
ok('dev page clean', dv.errors.length === 0, dv.errors.join(' || ').slice(0, 140));

/* ---------- B. resumption countdown chip ---------- */
const noDate = loadPage('index.html');
ok('chip hidden when unset', noDate.window.document.getElementById('resumeChip').innerHTML.trim() === '');
const fut = loadPage('index.html', null, null, 'var d=DB.load(); d.school.resumeDate="' + new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10) + '"; DB.save(d);');
ok('future date shows countdown', fut.window.document.getElementById('resumeChip').textContent.includes('days to go'));
const today = loadPage('index.html', null, null, 'var d=DB.load(); d.school.resumeDate=U.todayStr(); DB.save(d);');
ok('today shows assembly message', today.window.document.getElementById('resumeChip').textContent.includes('resumes today'));
const past = loadPage('index.html', null, null, 'var d=DB.load(); d.school.resumeDate="' + new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10) + '"; DB.save(d);');
ok('recent past shows welcome back', past.window.document.getElementById('resumeChip').textContent.includes('back in session'));
const stale = loadPage('index.html', null, null, 'var d=DB.load(); d.school.resumeDate="' + new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10) + '"; DB.save(d);');
ok('stale date hides chip', stale.window.document.getElementById('resumeChip').innerHTML.trim() === '');
const adm = loadPage('portal/admin.html', ADMIN);
ok('resume setting purged from admin (code-managed)', !adm.window.document.getElementById('setResume'));
ok('no resume setter anywhere in admin source', !fs.readFileSync(SITE + '/portal/admin.html', 'utf8').includes('setResume'));

/* ---------- C. testimonial spotlight ---------- */
const spot = loadPage('index.html');
const spotP = spot.window.document.querySelector('.tm-spot p');
ok('spotlight shows an approved story', !!spotP && spotP.textContent.length > 20);
ok('spotlight has stars + link', spot.window.document.querySelector('.tms-stars') !== null && !!spot.window.document.querySelector('.tms-link'));
const WEEK = Math.floor(Date.now() / 6048e5);
const approved = spot.run('window.__DB.load().testimonials.filter(t=>t.status==="Approved")');
ok('rotation matches week', spot.window.document.querySelector('.tm-spot p').textContent.includes(approved[WEEK % approved.length].text.slice(0, 30)));
const none = loadPage('index.html', null, null, 'var d=DB.load(); d.testimonials=[]; DB.save(d);');
ok('no approved -> hidden', none.window.document.getElementById('tmSpot').innerHTML.trim() === '');
const pend = loadPage('index.html', null, null, 'var d=DB.load(); d.testimonials=d.testimonials.map(t=>Object.assign(t,{status:"Pending"})); DB.save(d);');
ok('pending-only -> hidden', pend.window.document.getElementById('tmSpot').innerHTML.trim() === '');

/* ---------- D. css + versions ---------- */
ok('chip css tokens + dark', corp.includes('.resume-chip{') && corp.includes('[data-theme="dark"] .resume-chip{'));
ok('spotlight css + dark stars', corp.includes('.tm-spot{') && corp.includes('[data-theme="dark"] .tms-stars'));
let staleV = 0;
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  if (fs.readFileSync(p, 'utf8').includes('20260919-32')) { console.log('  stale -32 in', p); staleV++; }
}
ok('no stale -32 versions', staleV === 0);
ok('sw + dev on v33', fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v48') && fs.readFileSync(SITE + '/developer.html', 'utf8').includes('var BUILD = "treasure-v48";'));

/* ---------- E. dark loads ---------- */
for (const pg of ['index.html', 'developer.html']) {
  const w = loadPage(pg, null, null, 'document.documentElement.dataset.theme="dark";');
  ok(pg + ' dark clean', w.errors.length === 0, w.errors.join(' || ').slice(0, 140));
}

console.log(`\n==== BATCH33: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
