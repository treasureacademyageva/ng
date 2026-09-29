/* Batch 51 — resilient static navigation, information architecture and inner-page cleanup */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('FAIL -', name, extra); }
}
const read = p => fs.readFileSync(path.join(SITE, p), 'utf8');
const rootPages = fs.readdirSync(SITE).filter(f => f.endsWith('.html')).sort();
const headerPages = rootPages.filter(f => read(f).includes('id="mainNav"'));
const footerPages = rootPages.filter(f => read(f).includes('id="siteFooter"'));
const navLabels = ['Home','About','Admissions','Academics','Fees','News &amp; Events','Contact'];
const footerTargets = ['calendar.html','fees.html','uniform.html','transport.html','pta.html','birthdays.html','exams.html','homework.html','elearning.html','portal/login.html','support.html','careers.html','alumni.html','shop.html','privacy.html','safeguarding.html'];

/* A. Seven-link header and a real no-JS search destination. */
ok('35 public headers retained', headerPages.length === 35, String(headerPages.length));
for (const f of headerPages) {
  const s = read(f);
  const nav = (s.match(/<div id="mainNav">([\s\S]*?)<\/div>/) || [,''])[1];
  const labels = [...nav.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)].map(m => m[1].trim());
  ok(f + ': seven ordered nav links', JSON.stringify(labels) === JSON.stringify(navLabels), labels.join(' | '));
  ok(f + ': static Fees destination', /href="fees\.html"[^>]*>Fees<\/a>/.test(nav));
  ok(f + ': static search before theme', /id="searchBtn"[\s\S]*class="icon-action theme-btn"/.test(s));
  ok(f + ': search works without JS', /id="searchBtn"[^>]*href="search\.html"/.test(s));
}
const sitejs = read('assets/js/site.js');
ok('runtime nav has Fees', /id:"fees",label:"Fees",href:"fees\.html"/.test(sitejs));
ok('search enhances existing static control', sitejs.includes('let b=document.getElementById("searchBtn")') && sitejs.includes('e.preventDefault();this.open()'));

/* B. Static footer links and trust line exist before JavaScript. */
ok('37 public content pages have footers', footerPages.length === 37, String(footerPages.length));
for (const f of footerPages) {
  const s = read(f);
  ok(f + ': static footer exists', s.includes('static-site-footer'));
  ok(f + ': all required static links', footerTargets.every(h => s.includes('href="' + h + '"')));
  ok(f + ': static RC trust line', s.includes('Treasure Academy Ageva Limited · RC 9634403'));
}
ok('JS footer keeps Quick Links', sitejs.includes('class="foot-quick-grid"') && footerTargets.slice(0,14).every(h => sitejs.includes('href="' + h + '"')));
ok('JS footer keeps RC trust line', sitejs.includes('Treasure Academy Ageva Limited &middot; RC 9634403'));

/* C. Every public page is reachable from static source links in <=3 clicks. */
const publicFiles = rootPages.filter(f => !['404.html','developer.html'].includes(f));
const graph = Object.fromEntries(publicFiles.map(f => [f, new Set()]));
for (const f of publicFiles) {
  for (const m of read(f).matchAll(/href=["']([^"']+)/g)) {
    const dest = m[1].split('#')[0].split('?')[0];
    if (graph[dest]) graph[f].add(dest);
  }
}
const dist = {'index.html':0}, queue = ['index.html'];
while (queue.length) {
  const a = queue.shift();
  for (const b of graph[a]) if (dist[b] == null) { dist[b] = dist[a] + 1; queue.push(b); }
}
const unreachable = publicFiles.filter(f => dist[f] == null);
const tooDeep = publicFiles.filter(f => dist[f] > 3);
ok('no public orphan pages', unreachable.length === 0, unreachable.join(', '));
ok('all public pages reachable within three clicks', tooDeep.length === 0, tooDeep.map(f => f + ':' + dist[f]).join(', '));
ok('poster has a static inbound link', read('news.html').includes('href="poster.html"'));
ok('admission form is in sitemap', read('sitemap.xml').includes('/admission-form.html'));

/* D. IA cross-links. */
const admissions = read('admissions.html');
ok('Admissions links full Fees page', admissions.includes('href="fees.html"') && admissions.includes('See the full fees breakdown'));
ok('Admissions links uniform and transport', admissions.includes('href="uniform.html"') && admissions.includes('href="transport.html"'));
const academics = read('academics.html');
ok('Academics links exams, homework and e-learning', ['exams.html','homework.html','elearning.html'].every(h => academics.includes('href="' + h + '"')));
ok('Academics has proper level headings', academics.includes('<h2 id="earlyYearsTitle">') && academics.includes('<h2 id="primaryTitle">'));
const news = read('news.html');
ok('News links full calendar', news.includes('href="calendar.html">View Full Calendar'));
ok('News is the event hub', ['pta.html','openday.html','photo-day.html','holiday.html','lost-found.html','reading.html','birthdays.html','poster.html'].every(h => news.includes('href="' + h + '"')));
const about = read('about.html');
ok('About links school/community pages', ['careers.html','volunteer.html','board.html','anthem.html','support.html'].every(h => about.includes('href="' + h + '"')));

/* E. Fees fallback is static but never invents owner data. */
const fees = read('fees.html');
ok('Fees has static verified-contact fallback', fees.includes('id="bankBox"><div class="fee-static-contact"') && fees.includes('+234 814 194 3478') && fees.includes('09063932487'));
ok('Fees warns against unverified accounts', fees.includes('Never transfer to an account sent from any other number'));
ok('Fees keeps its verified-contact notice permanently', !fees.includes('bb.innerHTML=U.payAccountsHTML(db)') && fees.includes('Confirm the current account before transferring'));

/* F. Priority page semantics, emoji and inline-style migration. */
const login = read('portal/login.html');
ok('portal login has exactly one H1', (login.match(/<h1\b/g) || []).length === 1);
ok('portal login H1 is explicit', login.includes('<h1>School Portal — Login</h1>'));
ok('registration title is H2', login.includes('<h2>New Registration</h2>'));
ok('login uses password-manager autocomplete', login.includes('autocomplete="username"') && login.includes('autocomplete="current-password"') && !login.includes('autocomplete="off"'));
ok('portal check marks use SVG', !login.includes('✓') && login.includes('class="svg-check"'));
const inlineTargets = ['alumni.html','portal/login.html','shop.html','admissions.html','academics.html','contact.html','fees.html'];
for (const f of inlineTargets) {
  const n = (read(f).match(/\bstyle\s*=\s*["']/g) || []).length;
  ok(f + ': at most one dynamic inline style', n <= 1, String(n));
}
const emojiTargets = ['index.html','academics.html','alumni.html','shop.html','contact.html','about.html','news.html','portal/login.html'];
const isEmoji = cp => (cp >= 0x1f000 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf);
for (const f of emojiTargets) {
  const chars = [...read(f)].filter(ch => isEmoji(ch.codePointAt(0)));
  ok(f + ': no broad-range content emoji', chars.length === 0, chars.join(''));
}
ok('e-learning has H2 before content H3s', /<section id="main">[\s\S]*?<h2>[\s\S]*?<h3>/.test(read('elearning.html')));
ok('welcome pack has H2 before step H3s', /<section id="main">[\s\S]*?<h2>[\s\S]*?<h3>/.test(read('welcome.html')));
const anthemMain = (read('anthem.html').match(/<section id="main">([\s\S]*?)<\/section>/) || [,''])[1];
ok('anthem uses H2 section headings', (anthemMain.match(/<h3\b/g) || []).length === 0 && (anthemMain.match(/<h2\b/g) || []).length >= 3);

/* G. Build/cache and protected facts. */
ok('Phase 51 assets on all header pages', headerPages.every(f => read(f).includes('20260929-ui53')));
ok('service worker v73 caches theme init', read('sw.js').includes("'treasure-v74'") && read('sw.js').includes("'assets/js/theme-init.js'"));
ok('reveal motion progressively enhances visible no-JS content', read('assets/js/theme-init.js').includes('classList.add("js")') && read('assets/css/motion.css').includes('.js .clip,.js .clip-up{opacity:0') && /\.clip,\.clip-up\{[\s\S]*?opacity:1/.test(read('assets/css/motion.css')));
ok('verified Call/WhatsApp/RC remain', read('assets/js/store.js').includes('+234 814 194 3478') && read('assets/js/chat-core.js').includes('09063932487') && sitejs.includes('RC 9634403'));
ok('shop JPEG assets remain', fs.readdirSync(path.join(SITE,'assets/img')).filter(x => /^shop-.*\.jpg$/.test(x)).length === 10);
const spriteIds = new Set([...read('assets/img/icons.svg').matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
const spriteRefs = [...rootPages.map(read), sitejs].flatMap(s => [...s.matchAll(/icons\.svg#([\w-]+)/g)].map(m => m[1]));
ok('all static/runtime sprite references resolve', spriteRefs.length > 0 && spriteRefs.every(id => spriteIds.has(id)), [...new Set(spriteRefs.filter(id => !spriteIds.has(id)))].join(', '));

/* H. Browser-script smoke: static controls become richer, not duplicated. */
function loadIndex() {
  const html = read('index.html');
  const dom = new JSDOM(html, {url:'http://localhost/index.html', pretendToBeVisual:true});
  const w = dom.window, errors=[];
  w.matchMedia = () => ({matches:false,addEventListener(){},addListener(){},removeListener(){}});
  w.IntersectionObserver = function(){return {observe(){},unobserve(){},disconnect(){}}};
  w.HTMLCanvasElement.prototype.getContext = () => ({clearRect(){},save(){},restore(){},beginPath(){},arc(){},stroke(){},fill(){},moveTo(){},lineTo(){},translate(){},rotate(){},fillText(){},measureText(){return {width:10}},setTransform(){}});
  w.scrollTo=()=>{};w.open=()=>{};w.print=()=>{};
  w.addEventListener('error',e=>errors.push(String(e.message||e.error||'')));
  vm.createContext(w);
  vm.runInContext(read('assets/js/store.js'),w);
  const inline=[...w.document.querySelectorAll('script:not([src]):not([type="application/ld+json"])')].map(x=>x.textContent).join('\n;\n');
  vm.runInContext(sitejs+'\n;\n'+inline,w);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded',{bubbles:true}));
  return {w,errors};
}
try {
  const {w,errors}=loadIndex();
  ok('runtime keeps exactly one search control', w.document.querySelectorAll('#searchBtn').length === 1);
  w.document.getElementById('searchBtn').click();
  ok('runtime search opens from static link', w.document.getElementById('searchVeil').classList.contains('open'));
  ok('runtime nav keeps seven links', w.document.querySelectorAll('#mainNav .nav-link').length === 7);
  ok('runtime enhanced footer keeps quick links + RC', w.document.querySelector('.foot-quick-grid') && w.document.getElementById('siteFooter').textContent.includes('RC 9634403'));
  ok('homepage script smoke clean', errors.length === 0, errors.join(' | '));
  w.close();
} catch (e) { ok('homepage script smoke clean', false, e.stack); }

console.log(`\n==== BATCH51: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
