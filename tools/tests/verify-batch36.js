/* Batch 36: developer activity notes — private autosave notepad in the console */
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = (() => {
  const w = require('path').join(__dirname, 'mums-school-website');
  if (fs.existsSync(require('path').join(w, 'assets/js/store.js'))) return w;
  return require('path').resolve(__dirname, '..', '..');
})();
const dh = fs.readFileSync(SITE + '/developer.html', 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('FAIL -', name, extra || ''); }
}
function loadPage(page, pre) {
  const html = fs.readFileSync(SITE + '/' + page, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' + page, pretendToBeVisual: true });
  const window = dom.window;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!window.IntersectionObserver) { window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.print = () => {}; window.scrollTo = () => {}; window.open = () => {};
  window.requestAnimationFrame = () => 0;
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
  const scripts = [...window.document.querySelectorAll('script:not([src]):not([type="application/ld+json"])')].map(s => s.textContent).join('\n;\n');
  const errors = [];
  window.addEventListener('error', e => errors.push(String((e.message || e.error || '').slice(0, 140))));
  vm.createContext(window);
  const store = fs.readFileSync(SITE + '/assets/js/store.js', 'utf8');
  vm.runInContext(store, window);
  if (pre) vm.runInContext(pre, window);
  vm.runInContext(scripts, window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, errors: errors.filter(x => !/navigation|Not implemented/i.test(x)), run: c => vm.runInContext(c, window) };
}
const GATE = 'sessionStorage.setItem("treasure_dev_gate", String(Date.now()));';

ok('notes panel markup', dh.includes('id="dvNotes"') && dh.includes('Developer Notes') && dh.includes('Copy notes') && dh.includes('Clear notes'));
ok('notes styles', dh.includes('.dv-notes{width:100%;min-height:150px'));
ok('autosave wired', dh.includes('treasure_dev_notes') && dh.includes('Saved \\u2713'));
ok('loads on console open', dh.includes('renderBio(); renderNotes();'));

const dv = loadPage('developer.html', GATE);
ok('panel in console (not gate)', !!dv.window.document.querySelector('#dvConsole #dvNotes'));
const ta = dv.window.document.getElementById('dvNotes');
ta.value = 'Remember: move fee settings to dev console next term.';
ta.dispatchEvent(new dv.window.Event('input', { bubbles: true }));
setTimeout(() => {
  ok('autosave persists', dv.window.localStorage.getItem('treasure_dev_notes') === 'Remember: move fee settings to dev console next term.');
  ok('saved hint shows', dv.window.document.getElementById('dvNotesHint').textContent.includes('Saved'));

  const dv2 = loadPage('developer.html', GATE + ' localStorage.setItem("treasure_dev_notes", "hello from last time");');
  ok('notes reload across sessions', dv2.window.document.getElementById('dvNotes').value === 'hello from last time');

  dv2.window.confirm = () => true;
  dv2.window.document.getElementById('dvNotesClear').click();
  ok('clear wipes notes', dv2.window.localStorage.getItem('treasure_dev_notes') === null && dv2.window.document.getElementById('dvNotes').value === '');

  ok('dev page clean', dv.errors.length === 0, dv.errors.join(' || ').slice(0, 140));

  let stale = 0;
  function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(p)) walk(p, out); } else out.push(p); } return out; }
  for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
    if (fs.readFileSync(p, 'utf8').includes('20260919-35')) { console.log('  stale -35 in', p); stale++; }
  }
  ok('no stale -35 versions', stale === 0);
  ok('sw + dev on v36', fs.readFileSync(SITE + '/sw.js', 'utf8').includes('treasure-v48') && dh.includes('var BUILD = "treasure-v48";'));
  ok('auto-lock still present', dh.includes('IDLE_MS = 10 * 60 * 1000'));

  console.log(`\n==== BATCH36: ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
}, 600);
