/* (b41-retargeted)  Batch 34: hidden developer entry, WebAuthn fingerprint unlock, portal sidebar navigation */
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

/* ---------- A. hidden developer entry ---------- */
ok('secret tap counter', sitejs.includes('taps>=7') && sitejs.includes('.foot-bottom'));
ok('secret logo long-press', sitejs.includes('pointerdown') && sitejs.includes('2500'));
ok('secret keyboard combo', sitejs.includes('e.ctrlKey&&e.shiftKey&&(e.key==="D"||e.key==="d")'));
ok('relative base handled', sitejs.includes('indexOf("assets")===0)?"":"../"') && sitejs.includes('base+"developer.html"'));
ok('still no visible link', !fs.readFileSync(SITE + '/index.html', 'utf8').includes('developer.html') && !sitejs.includes('t:"Developer"'));

/* ---------- B. WebAuthn fingerprint unlock ---------- */
const dh = fs.readFileSync(SITE + '/developer.html', 'utf8');
ok('bio gate button', dh.includes('id="dvBio"') && dh.includes('Unlock with fingerprint'));
ok('bio console panel', dh.includes('dvBioStat') && dh.includes('Register fingerprint') && dh.includes('dvBioDel'));
ok('webauthn create platform+uv', dh.includes('authenticatorAttachment:"platform"') && dh.includes('userVerification:"required"'));
ok('webauthn get with allowCredentials', dh.includes('allowCredentials:[{id:b64uToBuf(c.id),type:"public-key"}]'));
ok('credential stored locally', dh.includes('treasure_dev_webauthn'));
ok('unsupported fallback', dh.includes('not available on this device or browser'));
const dvNoBio = loadPage('developer.html');
ok('no fingerprint stored -> gate button hidden', dvNoBio.window.document.getElementById('dvBio').classList.contains('hide'));
const dvBio = loadPage('developer.html', null, null, 'localStorage.setItem("treasure_dev_webauthn", JSON.stringify({id:"AAA",date:"2026-09-20"})); window.PublicKeyCredential=function(){}; navigator.credentials={create:function(){},get:function(){}};');
ok('registered+supported -> gate button shown', !dvBio.window.document.getElementById('dvBio').classList.contains('hide'));
ok('bio status wired into console boot', dh.includes('renderVisitors(); renderBio();'));
ok('dev page clean', dvNoBio.errors.length === 0, dvNoBio.errors.join(' || ').slice(0, 140));

/* ---------- C. portal sidebar (CSS grid areas; all items kept; no hamburger) ---------- */
ok('sidebar grid areas', corp.includes('grid-template-areas:"side top" "side main"') && corp.includes('.portal-layout>.navbar{grid-area:side'));
ok('sidebar rail styling', corp.includes('linear-gradient(180deg,#0E3B21,#0B4A26') && corp.includes('border-right:2px solid var(--gold'));
ok('sidebar buttons stacked', corp.includes('#sideNav{flex:1 1 auto;display:flex;flex-direction:column'));
ok('active = butter edge', corp.includes('#sideNav button[data-view].on{background:linear-gradient(90deg,rgba(247,233,103,.18)') && corp.includes('inset 3px 0 0 var(--butter-deep'));
ok('mobile: direct 2-col links, no hamburger', corp.includes('@media(max-width:1099px)') && corp.includes('#sideNav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))'));
ok('logout still by theme switch', dh !== null && (fs.readFileSync(SITE + '/portal/admin.html', 'utf8').includes('</button><button class="nav-logout"')));
const adm = loadPage('portal/admin.html', ADMIN);
ok('all 22 admin views kept', adm.window.document.querySelectorAll('#sideNav button[data-view]').length === 22);
ok('buttons all clickable sections', (() => { let dead = 0; adm.window.document.querySelectorAll('#sideNav button[data-view]').forEach(b => { b.click(); const s = adm.window.document.getElementById('v-' + b.dataset.view); if (!s) dead++; }); return dead === 0; })());
ok('no hamburger toggle anywhere', !adm.window.document.querySelector('.side-toggle') && !adm.window.document.querySelector('#menuBtn'));
ok('admin clean', adm.errors.length === 0, adm.errors.join(' || ').slice(0, 140));
const tch = loadPage('portal/teacher.html', { role: 'teacher', refId: 'T001', name: 'x' });
ok('teacher 10 views kept', tch.window.document.querySelectorAll('#sideNav button[data-view]').length === 10);
const pup = loadPage('portal/pupil.html', { role: 'pupil', refId: 'P001', name: 'x' }, null, 'var d=DB.load(); d.pupils.push({id:"P001",adm:"TAA/P/0001",name:"Test Pupil",phone:"0801 111 2222",password:"1234",class:"Primary 1"}); DB.save(d);');
ok('pupil 7 views kept', pup.window.document.querySelectorAll('#sideNav button[data-view]').length === 7);

/* ---------- D. versions ---------- */
let stale = 0;
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  if (fs.readFileSync(p, 'utf8').includes('20260919-33')) { console.log('  stale -33 in', p); stale++; }
}
ok('no stale -33 versions', stale === 0);
ok('sw + dev on v34', fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v48') && fs.readFileSync(SITE + '/developer.html', 'utf8').includes('var BUILD = "treasure-v48";'));

/* ---------- E. dark loads ---------- */
for (const pg of ['index.html', 'portal/admin.html', 'portal/teacher.html']) {
  const s = pg === 'portal/admin.html' ? ADMIN : (pg === 'portal/teacher.html' ? { role: 'teacher', refId: 'T001', name: 'x' } : null);
  const w = loadPage(pg, s, null, 'document.documentElement.dataset.theme="dark";');
  ok(pg + ' dark clean', w.errors.length === 0, w.errors.join(' || ').slice(0, 140));
}

console.log(`\n==== BATCH34: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
