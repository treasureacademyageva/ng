// verify2.js — deep checks for batch 2026-09-16
const fs = require('fs'), vm = require('vm'), { JSDOM } = require('jsdom');
const SITE = require('path').resolve(__dirname, '..', '..');
function load(page, query = '') {
  const html = fs.readFileSync(SITE + '/' + page, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' + page + query, pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!window.IntersectionObserver) { window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
  window.requestAnimationFrame = window.requestAnimationFrame || (fn => setTimeout(fn, 16));
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
  const store = fs.readFileSync(SITE + '/assets/js/store.js', 'utf8');
  const site = fs.readFileSync(SITE + '/assets/js/site.js', 'utf8');
  const scripts = [...window.document.querySelectorAll('script:not([src])')].map(s => s.textContent).join('\n;\n');
  vm.createContext(window);
  vm.runInContext(store + '\n;\n' + site + '\n;\n' + scripts, window, { filename: 'b.js' });
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return window;
}
let w = load('news.html');
console.log('vidHead display:', JSON.stringify(w.document.getElementById('vidHead').style.display), '(want "none")');
console.log('m-tag count:', w.document.querySelectorAll('.m-tag').length, '(want 8 story covers)');
console.log('m-dl count:', w.document.querySelectorAll('.m-dl').length, '(want 18)');
w = load('story.html', '?id=NE7');
console.log('NE7 thumbs:', w.document.querySelectorAll('.story-thumbs img').length, '(want 4)');
console.log('NE7 Download btn:', w.document.querySelector('.story-body').textContent.includes('Download'), '(want true)');
w = load('index.html');
console.log('promo titles:', [...w.document.querySelectorAll('#promoTrack h3')].map(e => e.textContent).join(' | '));
console.log('theme-btn on index:', w.document.querySelectorAll('.theme-btn').length, '(want 1)');
w = load('news.html');
console.log('theme-btn on news:', w.document.querySelectorAll('.theme-btn').length, '(want 0)');
console.log('foot-map:', w.document.querySelectorAll('.foot-map').length, '(want 1)');
console.log('starCanvas:', w.document.querySelectorAll('#starCanvas').length, '(want 1)');
process.exit(0);
