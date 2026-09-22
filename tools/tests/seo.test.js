/* SEO, performance and accessibility guards.
   Run: node tools/tests/verify-seo.js
   These lock in the things that silently regress when pages are added. */
const fs = require('fs');
const path = require('path');
const SITE = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => cond
  ? (pass++, console.log('ok -', name))
  : (fail++, console.log('FAIL -', name, extra || ''));

const read = f => fs.readFileSync(path.join(SITE, f), 'utf8');
const pages = fs.readdirSync(SITE).filter(f => f.endsWith('.html'));
// developer.html is a private console; 404.html is intentionally noindex.
// Derive this from the page itself rather than a hardcoded list, so a page
// that gains or loses noindex is judged by the right rules automatically.
const indexable = pages.filter(f => !/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(read(f)));
const noindexed = pages.filter(f => !indexable.includes(f));

/* ---------- required files ---------- */
['robots.txt', 'sitemap.xml', 'site.webmanifest', '404.html', 'favicon.ico',
 'assets/css/motion.css'].forEach(f =>
  ok('exists: ' + f, fs.existsSync(path.join(SITE, f))));

/* ---------- no third-party font CDN (self-hosted) ---------- */
{
  const offenders = pages.filter(f => /fonts\.(googleapis|gstatic)\.com/.test(read(f)));
  ok('no google-fonts CDN on any page', offenders.length === 0, offenders.join(','));
  const css = fs.readdirSync(path.join(SITE, 'assets/css')).filter(f => f.endsWith('.css'));
  const cssOff = css.filter(f => /fonts\.(googleapis|gstatic)/.test(read('assets/css/' + f)));
  ok('no google-fonts CDN in css', cssOff.length === 0, cssOff.join(','));
  const fonts = fs.readdirSync(path.join(SITE, 'assets/fonts'));
  ok('woff2 files shipped', fonts.filter(f => f.endsWith('.woff2')).length >= 4, String(fonts.length));
  // Faces live in corporate.css since the batch-43 typography change.
  const ff = read('assets/css/corporate.css');
  const faces = (ff.match(/@font-face/g) || []).length;
  ok('every @font-face uses font-display swap',
     faces >= 4 && (ff.match(/font-display:swap/g) || []).length >= faces, `${faces} faces`);
  // Every declared face must point at a file that exists.
  const missing = [...ff.matchAll(/url\("\.\.\/fonts\/([^"]+)"\)/g)]
    .map(m => m[1]).filter(f => !fs.existsSync(path.join(SITE, 'assets/fonts', f)));
  ok('no @font-face points at a missing file', missing.length === 0, missing.join(','));
}

/* ---------- per-page meta ---------- */
{
  const noDesc = [], longDesc = [], noCanon = [], noOg = [], noTw = [], badLang = [];
  indexable.forEach(f => {
    const s = read(f);
    const m = s.match(/<meta name="description" content="([^"]*)"/);
    if (!m) noDesc.push(f); else if (m[1].length > 170) longDesc.push(`${f}:${m[1].length}`);
    if (!/rel="canonical"/.test(s)) noCanon.push(f);
    if (!/property="og:title"/.test(s)) noOg.push(f);
    if (!/name="twitter:card"/.test(s)) noTw.push(f);
    if (!/<html lang="en"/.test(s)) badLang.push(f);
  });
  ok('every page has a description', noDesc.length === 0, noDesc.join(','));
  ok('descriptions under 170 chars', longDesc.length === 0, longDesc.join(','));
  ok('every page has a canonical', noCanon.length === 0, noCanon.join(','));
  ok('every page has og:title', noOg.length === 0, noOg.join(','));
  ok('every page has a twitter card', noTw.length === 0, noTw.join(','));

  /* Two SEO passes once shipped side by side (seo:start + treasure-seo), giving
     every page two canonicals that disagreed on the homepage. Exactly one of
     each, or crawlers pick for us. */
  const dupCanon = [], dupOg = [], dupDesc = [];
  pages.forEach(f => {
    const s = read(f);
    const c = (s.match(/rel="canonical"/g) || []).length;
    const o = (s.match(/property="og:title"/g) || []).length;
    const d = (s.match(/name="description"/g) || []).length;
    if (c > 1) dupCanon.push(`${f}:${c}`);
    if (o > 1) dupOg.push(`${f}:${o}`);
    if (d > 1) dupDesc.push(`${f}:${d}`);
  });
  ok('no duplicate canonical tags', dupCanon.length === 0, dupCanon.join(','));
  ok('no duplicate og:title tags', dupOg.length === 0, dupOg.join(','));
  ok('no duplicate description tags', dupDesc.length === 0, dupDesc.join(','));

  /* Two different things get conflated here, so keep them apart:
     - noindex utility pages (receipt, search, story, admission-form) are real
       pages that simply should not rank. They keep canonical + social tags.
     - PRIVATE pages must not publish their own URL at all. developer.html is
       the internal console and batch26 asserts nothing links to it; 404 is an
       error page. Neither gets a canonical, og:url or breadcrumb. */
  const PRIVATE = ['developer.html', '404.html'];
  const leaky = [];
  PRIVATE.forEach(f => {
    if (!pages.includes(f)) return;
    const s = read(f);
    if (/rel="canonical"/.test(s) || /property="og:url"/.test(s) || /BreadcrumbList/.test(s)) leaky.push(f);
  });
  ok('private pages publish no canonical, og:url or breadcrumb', leaky.length === 0, leaky.join(','));
  ok('private pages are noindex', PRIVATE.every(f => !pages.includes(f) || /content="noindex/.test(read(f))));
  ok('every page declares lang', badLang.length === 0, badLang.join(','));

  // descriptions must be distinct - duplicates get filtered out of results
  const seen = {}, dupes = [];
  indexable.forEach(f => {
    const m = read(f).match(/<meta name="description" content="([^"]*)"/);
    if (!m) return;
    if (seen[m[1]]) dupes.push(`${f}==${seen[m[1]]}`); else seen[m[1]] = f;
  });
  ok('no duplicate descriptions', dupes.length === 0, dupes.join(','));

  // titles must be distinct too
  const ts = {}, tdupes = [];
  indexable.forEach(f => {
    const m = read(f).match(/<title>([^<]*)<\/title>/);
    if (!m) return;
    if (ts[m[1]]) tdupes.push(`${f}==${ts[m[1]]}`); else ts[m[1]] = f;
  });
  ok('no duplicate titles', tdupes.length === 0, tdupes.join(','));
}

/* ---------- exactly one h1 per page ---------- */
{
  const bad = [];
  indexable.forEach(f => {
    // Count markup only. Several pages build a print letterhead by assigning an
    // <h1> inside a JavaScript string; that is not a heading in the document, so
    // strip <script> blocks before counting or it reads as a phantom duplicate.
    const src = read(f).replace(/<script\b[\s\S]*?<\/script>/gi, '');
    const n = (src.match(/<h1[\s>]/g) || []).length;
    if (n !== 1) bad.push(`${f}:${n}`);
  });
  ok('exactly one h1 per page', bad.length === 0, bad.join(','));
}

/* ---------- private pages must be noindex ---------- */
{
  const mustHide = ['developer.html', 'receipt.html', 'admission-form.html', 'search.html', 'story.html', '404.html'];
  const leaky = mustHide.filter(f => fs.existsSync(path.join(SITE, f)) && !/name="robots" content="noindex/.test(read(f)));
  ok('private pages are noindex', leaky.length === 0, leaky.join(','));
}

/* ---------- structured data ---------- */
{
  const home = read('index.html');
  const blocks = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  ok('homepage has JSON-LD', blocks.length >= 1);
  let ld = null;
  try { ld = JSON.parse(blocks[0][1]); } catch (e) {}
  ok('JSON-LD parses', !!ld);
  ok('JSON-LD is a School', ld && ld['@type'] === 'School');
  ok('JSON-LD has address', !!(ld && ld.address && ld.address.addressLocality === 'Okene'));
  ok('JSON-LD has phone', !!(ld && ld.telephone));
  // every page's JSON-LD must parse
  const broken = [];
  pages.forEach(f => {
    for (const m of read(f).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1]); } catch (e) { broken.push(f); }
    }
  });
  ok('all JSON-LD parses', broken.length === 0, broken.join(','));
}

/* ---------- sitemap + robots ---------- */
{
  const sm = read('sitemap.xml');
  ok('sitemap is xml', sm.startsWith('<?xml'));
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  ok('sitemap has urls', locs.length >= 25, String(locs.length));
  ok('sitemap urls absolute https', locs.every(l => l.startsWith('https://')));
  // nothing noindexed should be listed
  const bad = locs.filter(l => /(developer|receipt|admission-form|search|story|404)\.html/.test(l));
  ok('sitemap excludes private pages', bad.length === 0, bad.join(','));
  // every indexable page should be listed
  const missing = indexable.filter(f => !locs.some(l => l.endsWith('/' + f) || (f === 'index.html' && l.endsWith('/'))))
                           .filter(f => !/(receipt|admission-form|search|story)\.html/.test(f));
  ok('sitemap lists every public page', missing.length === 0, missing.join(','));

  const rb = read('robots.txt');
  ok('robots allows crawling', /User-agent: \*/.test(rb) && /Allow: \//.test(rb));
  ok('robots blocks portal', /Disallow: \/portal\//.test(rb));
  ok('robots points at sitemap', /Sitemap: https:\/\/.*sitemap\.xml/.test(rb));
}

/* ---------- PWA manifest (needed for the Android wrapper too) ---------- */
{
  const mf = JSON.parse(read('site.webmanifest'));
  ok('manifest name', !!mf.name && !!mf.short_name);
  ok('manifest start_url', !!mf.start_url);
  ok('manifest display', mf.display === 'standalone');
  ok('manifest theme colors', !!mf.theme_color && !!mf.background_color);
  ok('manifest has 192 + 512 icons',
    mf.icons.some(i => i.sizes === '192x192') && mf.icons.some(i => i.sizes === '512x512'));
  ok('manifest has maskable icon', mf.icons.some(i => (i.purpose || '').includes('maskable')));
  mf.icons.forEach(i =>
    ok('icon exists ' + i.sizes + ' ' + (i.purpose || 'any'),
       fs.existsSync(path.join(SITE, i.src.replace(/^\//, '')))));
  const linked = pages.filter(f => /rel="manifest"/.test(read(f)));
  ok('pages link the manifest', linked.length >= pages.length - 1, `${linked.length}/${pages.length}`);
}

/* ---------- performance: layout stability + payload ---------- */
{
  let imgs = 0, noDim = 0, noAlt = 0, lazy = 0;
  pages.forEach(f => {
    for (const m of read(f).matchAll(/<img\b[^>]*>/g)) {
      const t = m[0]; imgs++;
      // Layout is stable if the box is reserved any of three ways: HTML
      // width+height attributes, an aspect-ratio box (JS-templated images whose
      // src is only known at runtime), or a style that pins both dimensions.
      const style = (t.match(/\bstyle="([^"]*)"/) || [, ''])[1];
      const cssPinned = /(^|;)\s*width\s*:/.test(style) && /(^|;)\s*height\s*:/.test(style);
      const sized = (/\bwidth=/.test(t) && /\bheight=/.test(t)) || /aspect-ratio:/.test(t) || cssPinned;
      if (!sized) noDim++;
      if (!/\balt=/.test(t)) noAlt++;
      if (/loading="lazy"/.test(t)) lazy++;
    }
  });
  ok('images declare width+height (CLS)', noDim === 0, `${noDim}/${imgs} missing`);
  ok('images have alt text', noAlt === 0, `${noAlt}/${imgs} missing`);
  ok('below-fold images lazy-load', lazy >= 40, String(lazy));

  // keep the image payload sane - this is the biggest mobile SEO lever
  const dir = path.join(SITE, 'assets/img');
  const total = fs.readdirSync(dir).reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0);
  ok('image payload under 12MB', total < 12e6, (total / 1e6).toFixed(1) + 'MB');
  const heavy = fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).size > 1.2e6);
  ok('no single image over 1.2MB', heavy.length === 0, heavy.join(','));
}

/* ---------- accessibility ---------- */
{
  const noSkip = indexable.filter(f => !/class="skip-link"/.test(read(f)));
  ok('skip link on public pages', noSkip.length === 0, noSkip.join(','));
  const noMain = indexable.filter(f => !/id="main"/.test(read(f)));
  ok('main landmark on public pages', noMain.length === 0, noMain.join(','));
  const m = read('assets/css/motion.css');
  ok('reduced-motion honoured', /prefers-reduced-motion:reduce/.test(m));
  ok('focus-visible styling', /:focus-visible/.test(m));
}

/* ---------- vercel config ---------- */
{
  const v = JSON.parse(read('vercel.json'));
  const srcs = v.headers.map(h => h.source);
  ok('vercel caches fonts immutably', srcs.includes('/assets/fonts/(.*)'));
  ok('vercel serves sitemap+robots', srcs.includes('/sitemap.xml') && srcs.includes('/robots.txt'));
  const html = v.headers.find(h => h.source === '/(.*).html');
  ok('security headers on html', html.headers.some(h => h.key === 'X-Content-Type-Options'));
}

console.log(`\n==== SEO: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
