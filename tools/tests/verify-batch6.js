// verify-batch6.js — reorder, testi rail, now/prune, topbtn, fabs removed, steps, gal3, anchors, discount-zero
const fs = require('fs'), vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = require('path').resolve(__dirname, '..', '..');
const store = fs.readFileSync(SITE + '/assets/js/store.js', 'utf8');
const site = fs.readFileSync(SITE + '/assets/js/site.js', 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('PASS: ' + name); } else { fail++; console.log('FAIL: ' + name + (extra ? ' | ' + extra : '')); } };

function loadPage(page, query, seedFn) {
  const html = fs.readFileSync(SITE + '/' + page, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' + page + (query || ''), pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!window.IntersectionObserver) { window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
  window.requestAnimationFrame = window.requestAnimationFrame || (fn => setTimeout(fn, 16));
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.print = () => {};
  const scripts = [...window.document.querySelectorAll('script:not([src])')].map(s => s.textContent).join('\n;\n');
  const errors = [];
  window.addEventListener('error', e => errors.push('window: ' + (e.message || e.error)));
  vm.createContext(window);
  try {
    vm.runInContext(store, window);
    vm.runInContext('window.__U=U;window.__DB=DB;', window);
    if (seedFn) seedFn(window);
    vm.runInContext(site + '\n;\n' + scripts, window);
  } catch (e) { errors.push('THROW: ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ')); }
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, errors, run: code => vm.runInContext(code, window) };
}

{
  const { window: w, errors, run } = loadPage('index.html');
  const html = w.document.body.innerHTML;
  const seq = ['aboutPrev', 'stats-band', 'programs', 'admissions', 'promotions', 'newsSlider', 'gallery', 'spotlight', 'testimonials'];
  const pos = seq.map(s => html.indexOf(s));
  ok('homepage order correct', pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), pos.join(','));
  ok('duplicate Campus Gallery removed', !html.includes('Campus Gallery'));
  ok('see-all link removed', !html.includes('See all News'));
  ok('discountBanner removed', !html.includes('discountBanner'));
  ok('stats 200+ pupils', html.includes('data-count="200"'));
  const rail = w.document.getElementById('testiRail');
  ok('testi rail shows real seeds w/ stars', rail.children.length === 3 && rail.textContent.includes('Mrs. Okafor') && rail.textContent.includes('★★★★★') && rail.textContent.includes('Primary 1'));
  const tb = w.document.getElementById('topBtn');
  ok('topBtn exists + shows at bottom', !!tb && tb.classList.contains('show') && w.document.body.classList.contains('at-bottom'));
  ok('contact fabs gone', !w.document.getElementById('contactFabs'));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
{
  const t = new Date().toISOString().slice(0, 10);
  const { window: w, errors } = loadPage('index.html', '', win => {
    const db = win.__DB.load();
    db.calendar.unshift({ id: 'CX', date: t, title: 'Happening Today Event', desc: '' });
    db.testimonials.unshift({ id: 'TMX', name: 'Real Parent', role: 'Parent, Primary 2', text: 'Live testimonial text', stars: 4, status: 'Approved', date: t });
    win.__DB.save(db);
  });
  ok('countdown shows HAPPENING NOW', [0,6].includes(new Date().getDay()) ? w.document.getElementById('calCount').textContent.includes('resumes back on Monday') : w.document.getElementById('calCount').textContent.includes('Happening now'));
  const rail = w.document.getElementById('testiRail');
  ok('real-time approved testimonial appears', rail.textContent.includes('Live testimonial text') && rail.textContent.includes('Parent, Primary 2'));
  ok('4-star rendering', rail.textContent.includes('★★★★☆'));
  ok('no errors', errors.length === 0, errors.join(' || ').slice(0, 200));
}
{
  const { window: w, run } = loadPage('index.html', '', win => {
    const db = win.__DB.load();
    db.calendar.push({ id: 'COLD', date: '2020-01-01', title: 'Old Event', desc: '' });
    win.__DB.save(db);
  });
  run('DB.load()');
  ok('past events auto-deleted', !JSON.stringify(w.__DB.load().calendar).includes('Old Event'));
  run('Testimonials.open("Jane","Parent (Primary 1)")');
  ok('testimonial modal has rating', !!w.document.getElementById('tmStars'));
  run('document.getElementById("tmName").value="Jane"; document.getElementById("tmText").value="Great school"; document.getElementById("tmStars").value="3"; Testimonials.submit();');
  const tm = w.__DB.load().testimonials[0];
  ok('submitted rating saved', tm.stars === 3 && tm.status === 'Pending');
}
{
  const sj = fs.readFileSync(SITE + '/assets/js/site.js', 'utf8');
  ok('renderContactFabs removed', !sj.includes('renderContactFabs'));
  ok('initTopBtn present', sj.includes('initTopBtn') && sj.includes('at-bottom'));
  ok('fireflies drift+twinkle', sj.includes('length:18') && sj.includes('tw'));
  ok('Discount object removed', !sj.includes('Discount'));
  const css = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
  ok('loader logo styled', css.includes('#siteLoader img') && css.includes('border-radius:24px'));
  ok('steps row + arrows', css.includes('.step:not(:last-child)::after') && css.includes('scroll-snap-type:x mandatory'));
  ok('gallery 3-col', css.includes('.gal-grid{display:grid;grid-template-columns:repeat(3,1fr)'));
  ok('testi rail css', css.includes('.testi-rail'));
  ok('anchor scroll-margin', css.includes('scroll-margin-top:130px'));
  const st = fs.readFileSync(SITE + '/assets/js/store.js', 'utf8');
  ok('store: tmStars + prune', st.includes('tmStars') && st.includes('filter(c=>c.date>=U.todayStr())'));
  ['index.html', 'admissions.html', 'portal/login.html', 'portal/admin.html'].forEach(f => {
    const c = fs.readFileSync(SITE + '/' + f, 'utf8');
    ok('no discount UI: ' + f, !/discountBanner|regDiscount|setDisc|Early-Bird|Percent Off|Fees Discount|Discount\.render|10% off|discount:disc/.test(c));
  });
}
console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
