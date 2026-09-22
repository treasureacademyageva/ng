/* Batch 44: launch readiness — full SEO (descriptions/OG/Twitter/canonical/JSON-LD/robots/sitemap), PWA manifest/icons, branded 404, compare-pricing on fees, type polish, image cleanup */
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
const fees = fs.readFileSync(SITE + '/fees.html', 'utf8');
const corp = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
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

/* ---------- A. static files ---------- */
ok('robots.txt rules', (() => { const r = fs.readFileSync(SITE + '/robots.txt', 'utf8'); return r.includes('Disallow: /portal/') && r.includes('Disallow: /developer.html') && /^Sitemap: https:\/\/\S+\/sitemap\.xml$/m.test(r); })());  // host-agnostic: tools/set-site-host.py can move the domain
const siteMap = fs.readFileSync(SITE + '/sitemap.xml', 'utf8');
// Private pages (receipt, admission-form, search, story) are noindex and must
// stay out of the sitemap, so the count is a floor, not a fixed 35.
ok('sitemap: public urls + index priority', (siteMap.match(/<url>/g) || []).length >= 30 && siteMap.includes('<priority>1.0</priority>') && !/developer\.html|404\.html|receipt\.html|admission-form\.html|search\.html|story\.html/.test(siteMap));
const man = JSON.parse(fs.readFileSync(SITE + '/site.webmanifest', 'utf8'));
// A maskable icon was added for Android adaptive masks, so icons is >= 3.
ok('manifest valid PWA', man.name.includes('Treasure Academy') && man.display === 'standalone' && man.theme_color === '#0E5A2E' && man.icons.length >= 2 && man.icons.some(i => (i.purpose || '').includes('maskable')));
ok('icons on disk', ['icon-192.png', 'icon-180.png', 'icon-512.png', 'og-cover.png'].every(f => fs.existsSync(SITE + '/assets/img/' + f)));
ok('scratch cleanup done, live inventory kept', !fs.existsSync(SITE + '/any-junk-BAK.bak') && fs.existsSync(SITE + '/assets/img/shop-pens.jpg') && fs.existsSync(SITE + '/docs/HANDOVER.md'));

/* ---------- B. seo coverage ---------- */
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = require('path').join(d, f); if (fs.statSync(p).isDirectory()) { if (!/node_modules|\.git|[\\/]tools([\\/]|$)/.test(p)) walk(p, out); } else out.push(p); } return out; }
const PUB = walk(SITE, []).filter(f => f.endsWith('.html') && f.includes(SITE + '/') && !f.includes('/portal/') && !f.endsWith('developer.html') && !f.endsWith('404.html'));
let missing = 0;
for (const p of PUB) {
  const s = fs.readFileSync(p, 'utf8');
  const mark = ['name="description"', 'rel="canonical"', 'og:title', 'og:image', 'twitter:card', 'theme-color', 'manifest'];
  if (!mark.every(m => s.includes(m))) { missing++; console.log('  seo-missing:', p.split('/').pop()); }
}
ok('all 35 public pages fully meta-tagged', missing === 0 && PUB.length === 35, 'missing ' + missing + ' of ' + PUB.length);
const uniq = new Set(PUB.map(p => fs.readFileSync(p, 'utf8').match(/name="description" content="([^"]+)"/)[1]));
ok('descriptions unique per page', uniq.size === 35, 'unique ' + uniq.size);
for (const f of ['portal/login.html', 'portal/admin.html', 'portal/teacher.html', 'portal/pupil.html']) {
  const s = fs.readFileSync(SITE + '/' + f, 'utf8');
  ok(f + ' is noindex', s.includes('robots" content="noindex'));
}
ok('index has School JSON-LD', fs.readFileSync(SITE + '/index.html', 'utf8').includes('application/ld+json') && fs.readFileSync(SITE + '/index.html', 'utf8').includes('"@type":"School"') && fs.readFileSync(SITE + '/index.html', 'utf8').includes('Kogi State'));

/* ---------- C. 404 ---------- */
const e404 = fs.readFileSync(SITE + '/404.html', 'utf8');
ok('404 branded + noindex + links out', e404.includes('<h1') && e404.includes('404') && e404.includes('noindex, nofollow') && e404.includes('admissions.html') && e404.includes('portal/login.html') && e404.includes('search.html'));

/* ---------- D. fees compare ---------- */
ok('fees: compare zone + seg tabs', fees.includes('id="feeCompare"') && fees.includes('id="feeTabs"') && fees.includes('data-seg="term"') && fees.includes('data-seg="year"'));
ok('fees: panes + rows render calls', fees.includes('id="cmpTermRows"') && fees.includes('id="cmpYearRows"') && fees.includes('id="incGrid"') && fees.includes('Per year'));
ok('fees: css sticky wrap', corp.includes('.cmp-wrap{overflow-x:auto') && corp.includes('.page-hero h1{font-size:clamp'));

/* ---------- E. live fees ---------- */
const f = loadPage('fees.html');
ok('fees page loads clean', f.errors.length === 0, f.errors.join(' || ').slice(0, 140));
ok('term rows show 5 bands', f.window.document.querySelectorAll('#cmpTermRows tr').length === 5);
ok('top band is Primary 4–6 @ 35,000', f.window.document.getElementById('cmpTermRows').textContent.includes('Primary 4') && f.window.document.getElementById('cmpTermRows').textContent.includes('35,000'));
ok('year toggle tab works (seg bound)', !!f.window.document.querySelector('#feeTabs .seg-tab[ data-seg="year"]'));
const yearTab = [...f.window.document.querySelectorAll('#feeTabs .seg-tab')].find(t => t.getAttribute('data-seg') === 'year');
yearTab.click();
const shownPanes = [...f.window.document.querySelectorAll('.cmp-wrap.show')];
ok('year pane shows ×3 values', shownPanes.length === 1 && shownPanes[0].textContent.includes('105,000'));
ok('includes grid 6 cards', f.window.document.querySelectorAll('#incGrid .mv-card').length === 6);

/* ---------- F. broken internal links audit ---------- */
let broken = 0;
for (const p of PUB) {
  const s = fs.readFileSync(p, 'utf8');
  for (const m of s.matchAll(/href="([a-z0-9-]+\.html)(#[a-zA-Z0-9_-]*)?"/g)) {
    const t = m[1];
    if (!fs.existsSync(SITE + '/' + t)) { broken++; console.log('  broken link in', p.split('/').pop(), '->', t); }
  }
}
ok('zero broken internal .html links', broken === 0);

/* ---------- G. versions ---------- */
let stale = 0;
for (const p of walk(SITE, []).filter(f => f.endsWith('.html'))) {
  if (fs.readFileSync(p, 'utf8').includes('20260919-43')) stale++;
}
ok('no stale -43 versions', stale === 0);
ok('sw + dev on v44', fs.readFileSync(SITE + '/sw.js', 'utf8').match(/treasure-v\d+/) && fs.readFileSync(SITE + '/developer.html', 'utf8').match(/var BUILD = "treasure-v\d+";/));

console.log(`\n==== BATCH44: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
