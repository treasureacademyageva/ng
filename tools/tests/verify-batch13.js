// verify-batch13.js — search+, recents, levy, PTA notice, FAQ, countdowns,
// print, call button, idle logout
const fs = require('fs'), vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = (() => {
  const w = require('path').join(__dirname, 'mums-school-website');
  if (fs.existsSync(require('path').join(w, 'assets/js/store.js'))) return w;
  return require('path').resolve(__dirname, '..', '..');
})();
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
  const scripts = [...window.document.querySelectorAll('script:not([src]):not([type="application/ld+json"])')].map(s => s.textContent).join('\n;\n');
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

/* search: news + staff + recents */
{
  const { window: w, errors, run } = loadPage('index.html', null, win => {
    const db = win.__DB.load();
    db.newsEvents.push({ id: 'NX13', type: 'news', title: 'Mango Day Results', date: '2026-09-10', text: 'mango harvest', story: 's', views: 0, likes: 0 });
    win.__DB.save(db);
  });
  run('Search.open(); Search.go("mango");');
  ok('search finds news story', w.document.getElementById('searchRes').innerHTML.includes('story.html?id=NX13'));
  run('Search.go("zeenatudeen");');
  ok('search finds staff', w.document.getElementById('searchRes').innerHTML.includes('alumni.html#staff'));
  run('Search.go("uniform");');
  w.document.querySelector('#searchRes a').click();
  run('Search.go("");');
  ok('recent search remembered', w.document.getElementById('searchRes').textContent.includes('uniform'));
  ok('search clean', errors.length === 0, errors.join(' || ').slice(0, 200));
}

/* levy: admin sets, pta shows */
{
  const { window: w, errors, run } = loadPage('portal/admin.html', { role: 'admin', refId: 'HEAD001', name: 'x' });
  run('document.getElementById("levyAmt").value="2500"; document.getElementById("levyNote").value="Per family"; savePtaLevy();');
  const lv = w.__DB.load().ptaLevy;
  ok('levy saved', lv.amount === 2500 && w.document.getElementById('levyShow').textContent.includes('2,500'), JSON.stringify(lv));
  const p = loadPage('pta.html', null, win => { const db = win.__DB.load(); db.ptaLevy = { amount: 2500, note: '' }; win.__DB.save(db); });
  ok('pta shows levy + transfer note', p.window.document.getElementById('ptaLevy').textContent.includes('2,500') && p.window.document.getElementById('ptaLevy').textContent.includes('bank transfer'));
  ok('pta print button', p.window.document.body.innerHTML.includes('Print Meeting List'));
  ok('levy clean', errors.length === 0 && p.errors.length === 0, errors.concat(p.errors).join(' || ').slice(0, 200));
}

/* pupil: pta notice + call button + idle */
{
  const { window: w, errors, run } = loadPage('portal/pupil.html', { role: 'pupil', refId: 'P001', name: 'x' }, win => {
    const db = win.__DB.load();
    db.ptaMeetings = [{ id: 'PM9', date: '2026-12-01', title: 'Big Meeting', venue: 'Hall' }];
    win.__DB.save(db);
  });
  run('document.querySelector(\'#sideNav button[data-view="notices"]\').click();');
  ok('pta meeting auto-notice', w.document.getElementById('noticeList').textContent.includes('Big Meeting'));
  run('markRead("PTA-AUTO");');
  ok('pta notice dismissable', !w.document.getElementById('noticeList').textContent.includes('tap to mark read') || w.document.getElementById('noticeList').textContent.includes('✓ read'));
  ok('call button wired', w.document.getElementById('callSchBtn').href.startsWith('tel:+234'));
  run('clearInterval(IdleLogout.t); IdleLogout.t=null; IdleLogout.shown=false; IdleLogout.init({warnMs:50,outMs:100});');
  const st1 = run('IdleLogout.check(Date.now()+60);');
  ok('idle warns', st1 === 'warn' && !!w.document.getElementById('idleVeil'), st1);
  run('document.getElementById("idleStay").click();');
  ok('idle stay dismisses', !w.document.getElementById('idleVeil'));
  const st2 = run('IdleLogout.check(Date.now()+60000);');
  ok('idle logs out', st2 === 'out', st2);
  ok('pupil clean', errors.length === 0, errors.join(' || ').slice(0, 300));
}

/* admissions faq + index multi-countdown + tomorrow + both-visible */
{
  const a = loadPage('admissions.html');
  ok('admissions faq 6', a.window.document.querySelectorAll('#admFaq .faq-item').length === 6);
  a.run('document.querySelector("#admFaq .faq-q").click();');
  ok('faq opens', a.window.document.querySelector('#admFaq .faq-item').classList.contains('open'));
  ok('landing countdown bar removed', !fs.readFileSync(SITE + '/index.html', 'utf8').includes('id="calCount"'));
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
  const t = loadPage('index.html', null, win => {
    const db = win.__DB.load();
    db.teachers.forEach(x => { x.dob = '1990-01-01'; });
    db.teachers[0].dob = tmr.toISOString().slice(0, 10); db.teachers[0].name = 'Morrow Star';
    db.school.headDob = '1980-06-01';
    win.__DB.save(db);
  });
  ok('countdown says tomorrow', t.window.document.getElementById('bdayCount').textContent.includes('Tomorrow!'), t.window.document.getElementById('bdayCount').textContent.slice(0, 100));
  const today = new Date().toISOString().slice(0, 10);
  const fut = new Date(); fut.setDate(fut.getDate() + 9);
  const b = loadPage('index.html', null, win => {
    const db = win.__DB.load();
    db.teachers.forEach(x => { x.dob = '1990-01-01'; });
    db.teachers[0].dob = today; db.teachers[0].name = 'Today Star';
    db.teachers[1].dob = fut.toISOString().slice(0, 10); db.teachers[1].name = 'Future Star';
    db.school.headDob = '1980-06-01';
    win.__DB.save(db);
  });
  ok('bell + countdown coexist', b.window.document.getElementById('bdayBell').textContent.includes('Today Star') && b.window.document.getElementById('bdayCount').textContent.includes('Future Star'));
  const path = require('path');
  const pages = [];
  (function walk(dd) { for (const f of fs.readdirSync(dd)) { const p = path.join(dd, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) pages.push(p); } })(SITE);
  const stale = pages.filter(p => { const s = fs.readFileSync(p, 'utf8'); return [...s.matchAll(/(?:href|src)="((?:\.\.\/)?assets\/[^"]+\.(?:css|js))"/g)].some(m => !m[1].includes('?v=20260916-13')); });
  ok('cache-bust v13 everywhere', stale.length === 0, stale.slice(0, 3).join(','));
  ok('misc clean', a.errors.length === 0 && t.errors.length === 0 && b.errors.length === 0,
    a.errors.concat(t.errors, b.errors).join(' || ').slice(0, 300));
}

console.log(`\n==== BATCH13: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
