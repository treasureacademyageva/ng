// render-test.js — headless page check (replaces /tmp/domtest.js, persists in workspace)
// usage: node render-test.js <page.html> [?query]
const fs = require('fs'), path = require('path'), vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = '/home/user/mums-school-website';
const page = process.argv[2] || 'news.html';
const query = process.argv[3] || '';
const html = fs.readFileSync(path.join(SITE, page), 'utf8');
const store = fs.readFileSync(path.join(SITE, 'assets/js/store.js'), 'utf8');
let site = '';
try { site = fs.readFileSync(path.join(SITE, 'assets/js/site.js'), 'utf8'); } catch (e) {}
const dom = new JSDOM(html, { url: 'http://localhost/' + page + query, pretendToBeVisual: true });
const { window } = dom;
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
if (!window.IntersectionObserver) { window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
window.requestAnimationFrame = window.requestAnimationFrame || (fn => setTimeout(fn, 16));
window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
window.HTMLCanvasElement.prototype.getContext = () => null;
const scripts = [...window.document.querySelectorAll('script:not([src])')].map(s => s.textContent).join('\n;\n');
const errors = [];
window.addEventListener('error', e => errors.push('window: ' + (e.message || e.error)));
vm.createContext(window);
try {
  vm.runInContext(store + '\n;\n' + site + '\n;\n' + scripts, window, { filename: 'bundle.js' });
} catch (e) { errors.push('THROW: ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ')); }
window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
setTimeout(() => {
  const q = id => window.document.getElementById(id);
  ['masonry', 'neList', 'videoRail', 'vidHead', 'vidWrap', 'monthFilter', 'promoTrack', 'newsTrack',
   'storyBox', 'relatedGrid', 'cmtList', 'likeCount', 'likeBtn', 'cmtCount', 'storyHero',
   'chatFab', 'chatPanel', 'clockWidget', 'mainNav', 'siteFooter', 'genCard'].forEach(id => {
    const el = q(id);
    console.log(id + ': ' + (el ? ('children: ' + el.children.length + ' | text: ' +
      el.textContent.trim().slice(0, 48).replace(/\s+/g, ' ')) : 'MISSING'));
  });
  console.log('ERRORS:', errors.length ? errors.join(' || ') : 'none');
  process.exit(0);
}, 1200);
