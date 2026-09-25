// verify-gallery.js — the graduation photo gallery on alumni.html.
// The school office supplied 12 graduation photographs (Sept 2026). They are
// re-encoded small with camera metadata stripped, shown in a square-crop
// grid and openable in the site lightbox. Captions stay neutral (no invented
// set/year) until the office labels them.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(SITE, f), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS: ' + name); }
  else { fail++; console.log('FAIL: ' + name + (extra ? ' | ' + extra : '')); }
};

/* ------------------------------------------------------- the files */
let n = 0, totalKB = 0, allOk = true;
for (let i = 1; i <= 12; i++) {
  const p = path.join(SITE, 'assets/img/graduates', 'grad-' + String(i).padStart(2, '0') + '.jpg');
  if (!fs.existsSync(p)) { ok('grad-' + String(i).padStart(2, '0') + '.jpg exists', false); allOk = false; continue; }
  n++; totalKB += fs.statSync(p).size / 1024;
}
ok('12 graduation photos present', n === 12, 'count=' + n);
ok('photos are web-sized (total under 2.5 MB)', allOk && n === 12 && totalKB < 2500,
   Math.round(totalKB) + ' KB');
/* JPEG re-encode without the exif chunk: no APP1/Exif marker after SOI */
let exifFree = true;
for (let i = 1; i <= 12; i++) {
  const p = path.join(SITE, 'assets/img/graduates', 'grad-' + String(i).padStart(2, '0') + '.jpg');
  if (!fs.existsSync(p)) continue;
  const b = fs.readFileSync(p);
  if (b.length > 4 && b[2] === 0xFF && b[3] === 0xE1 && b.toString('ascii', 6, 10) === 'Exif') exifFree = false;
}
ok('camera metadata (EXIF/GPS) stripped', exifFree);

/* ---------------------------------------------------- the markup */
const html = read('alumni.html');
ok('gallery section present', /id="grad-gallery"/.test(html) && /Graduation Gallery/.test(html));
ok('gallery grid container present', /id="gradGallery"/.test(html));
ok('12 photos referenced', (html.match(/graduates\/grad-\d\d\.jpg/g) || []).length >= 12);
ok('captions name the five ceremonies with their years',
   /1st Graduation Ceremony \u2014 2017"/.test(html) && /5th Graduation Ceremony \u2014 2021"/.test(html));
ok('lightbox wiring present', /window\.openGradLB=function\(i\)\{ Lightbox\.open\(window\._gradLB,i\); \}/.test(html));
ok('keyboard can open a photo (role/aria + Enter)', /role="button" tabindex="0"/.test(html));
ok('square-crop CSS present', /\.grad-gal \.gal img\{height:auto;aspect-ratio:1\/1/.test(read('assets/css/extra.css')));

/* ---------------------------------------------------- jsdom render */
function loadPage(page) {
  const dom = new JSDOM(read(page), { url: 'http://localhost/' + page, pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!window.IntersectionObserver) window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; };
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
    vm.runInContext(read('assets/js/store.js'), window);
    for (const f of ['assets/js/site.js']) vm.runInContext(read(f), window);
    vm.runInContext(scripts, window);
  } catch (e) { errors.push('run: ' + e.message); }
  return { window, errors };
}

const R = loadPage('alumni.html');
ok('alumni.html renders without script errors', R.errors.length === 0, R.errors.join(' ; ').slice(0, 160));
const tiles = R.window.document.querySelectorAll('#gradGallery .gal');
ok('gallery renders 12 tiles', tiles.length === 12, 'count=' + tiles.length);
const imgs = R.window.document.querySelectorAll('#gradGallery .gal img');
ok('every tile has an image', imgs.length === 12 &&
  [...imgs].every(im => /graduates\/grad-\d\d\.jpg$/.test(im.getAttribute('src'))));
ok('images lazy-load', [...imgs].every(im => im.getAttribute('loading') === 'lazy'));
ok('captions render', [...R.window.document.querySelectorAll('#gradGallery .cap')].length === 12);
ok('lightbox wrapper exposed (site.js keeps Lightbox script-scoped)',
   typeof R.window.openGradLB === 'function');
ok('gallery list exposed for the lightbox', Array.isArray(R.window._gradLB) && R.window._gradLB.length === 12);
/* functional: opening photo 4 puts its src in the lightbox */
try {
  R.window.openGradLB(3);
  const lb = R.window.document.getElementById('lightbox');
  const src4 = lb && lb.querySelector('.lb-img') && lb.querySelector('.lb-img').getAttribute('src');
  ok('lightbox opens with the tapped photo', !!lb && /grad-04\.jpg$/.test(src4 || ''), String(src4));
  const cap4 = lb && lb.querySelector('.lb-cap') && lb.querySelector('.lb-cap').textContent;
  ok('lightbox shows the caption', cap4 === '4th Graduation Ceremony \u2014 2020', String(cap4));
} catch (e) { ok('lightbox opens with the tapped photo', false, e.message); }

console.log('\n==== GALLERY: ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
