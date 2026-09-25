/* Batch 38: staff.html merged into alumni (staff above graduates); about leads to alumni#staff */
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
const about = fs.readFileSync(SITE + '/about.html', 'utf8');
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

/* ---------- A. static structure ---------- */
ok('staff.html deleted', !fs.existsSync(SITE + '/staff.html'));
ok('alumni has staff anchor + showcase', alumni.includes('id="staff"') && alumni.includes('Meet Our Staff') && alumni.includes('id="hmName"') && alumni.includes('id="teamGrid"') && alumni.includes('id="totWin"'));
ok('graduates BELOW staff on alumni', alumni.indexOf('id="staff"') >= 0 && alumni.indexOf('id="staff"') < alumni.indexOf('Meet Our Graduates') && alumni.indexOf('id="staff"') < alumni.indexOf('id="gradWall"'));
ok('alumni keeps graduates + spotlight + story form', alumni.includes('id="gradWall"') && alumni.includes('id="alumWall"') && alumni.includes('submitAlumni()'));
ok('alumni has vote logic', alumni.includes('window.voteTeacher=function(id)') && alumni.includes('treasure_vote_'));
ok('about leads to alumni staff', about.includes('href="alumni.html#staff"') && about.includes('Meet Our Staff'));
ok('about team section removed', !about.includes('id="teamGrid"') && !about.includes('voteTeacher') && !about.includes('id="totWin"'));
let refs = 0;
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules|\.git|[\\/]tools([\\/]|$)/.test(p)) walk(p, out); } else out.push(p); } return out; }
for (const p of walk(SITE, []).filter(f => /\.(html|js|xml|txt|md)$/.test(f) && !/README/.test(f))) {
  if (fs.readFileSync(p, 'utf8').includes('staff.html')) { console.log('  staff.html ref in', p); refs++; }
}
ok('zero staff.html references left', refs === 0);
ok('search entry + results target alumni#staff', sitejs.includes('u:"alumni.html#staff"') && sitejs.includes('<a href="alumni.html#staff">'));

/* ---------- B. live behaviour ---------- */
const al = loadPage('alumni.html');
const cards = [...al.window.document.querySelectorAll('#teamGrid .team-card')];
ok('alumni renders teacher cards', cards.length >= 6, 'got ' + cards.length);
ok('creche sorted first', cards.length && cards[0].textContent.includes('Creche'), cards[0] && cards[0].textContent.slice(0, 30));
ok('headmistress card named', al.window.document.getElementById('hmName').textContent.length > 3);
const before = al.run('(DB.load().teacherVotes||{}).T001||0');
al.run('voteTeacher("T001");');
ok('vote works on alumni', al.run('(DB.load().teacherVotes||{}).T001') === before + 1);
ok('alumni loads clean', al.errors.length === 0, al.errors.join(' || ').slice(0, 140));

const ab = loadPage('about.html');
ok('about loads clean', ab.errors.length === 0, ab.errors.join(' || ').slice(0, 140));
ok('about CTA is alumni#staff link', !!ab.window.document.querySelector('a[href="alumni.html#staff"]'));
ok('about still has history + founder', ab.window.document.body.textContent.includes('2016') && ab.window.document.body.textContent.includes('Shaibu Sidikat Ruth'));

/* ---------- C. versions ---------- */
let stale = 0;
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  if (fs.readFileSync(p, 'utf8').includes('20260919-37')) { console.log('  stale -37 in', p); stale++; }
}
ok('no stale -37 versions', stale === 0);
ok('sw + dev on v38', fs.readFileSync(SITE + '/sw.js', 'utf8').match(/treasure-v\d+/) && fs.readFileSync(SITE + '/developer.html', 'utf8').match(/var BUILD = "treasure-v\d+";/));

console.log(`\n==== BATCH38: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
