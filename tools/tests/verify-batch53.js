/* Batch 53 — Header & Identity rebuild + sitemap + model-lab guards */
const fs=require('fs'),path=require('path');
const SITE=path.resolve(__dirname,'..','..');let pass=0,fail=0;
const read=p=>fs.readFileSync(path.join(SITE,p),'utf8');
function ok(n,c,d=''){if(c){pass++;console.log('ok -',n)}else{fail++;console.log('FAIL -',n,d)}}
const pages=fs.readdirSync(SITE).filter(f=>f.endsWith('.html')).sort();
const headers=pages.filter(f=>read(f).includes('id="mainNav"'));
const expected=['index.html','about.html','admissions.html','academics.html','fees.html','news.html','contact.html'];
ok('exactly 35 standard headers',headers.length===35,String(headers.length));
for(const f of headers){
 const s=read(f),nav=(s.match(/<div id="mainNav">([\s\S]*?)<\/div>/)||[,''])[1],links=[...nav.matchAll(/href="([^"]+)"/g)].map(x=>x[1]);
 ok(f+': seven ordered links',JSON.stringify(links)===JSON.stringify(expected),links.join(','));
 ok(f+': flat two-row header',s.indexOf('class="topbar"')<s.indexOf('class="navbar"')&&!/nav-layer|contactModal/.test(s));
 ok(f+': admissions contacts + motto',s.includes('tel:+2348141943478')&&s.includes('treasuregroupofschool@gmail.com')&&s.includes('Our God is able'));
 ok(f+': location + portal pill',s.includes('Ageva, Okene, Kogi State')&&s.includes('class="portal-link" href="portal/login.html"'));
 ok(f+': two-line brand',s.includes('TREASURE ACADEMY')&&s.includes('Creche <i>·</i> Nursery <i>·</i> Primary')&&s.includes('brand-logo-shell'));
 ok(f+': search theme apply actions',s.includes('id="searchBtn"')&&s.includes('class="icon-action theme-btn"')&&s.includes('nav-apply desktop-apply'));
 ok(f+': accessible mobile controls',s.includes('id="menuToggle"')&&s.includes('aria-controls="navDrawer"')&&s.includes('id="navVeil" hidden'));
 ok(f+': drawer essentials',s.includes('drawer-apply')&&s.includes('drawer-portal')&&s.includes('drawer-phone'));
 ok(f+': skip link retained',s.includes('class="skip-link"'));
}
const css=read('assets/css/corporate.css'),js=read('assets/js/site.js');
ok('topbar exact height and gold rule',/\.topbar\{[\s\S]*?height:44px[\s\S]*?border-bottom:2px solid var\(--gold\)/.test(css));
ok('desktop logo ring is 48px',/\.brand-logo-shell\{[\s\S]*?width:48px;height:48px[\s\S]*?border:2px solid var\(--gold\)/.test(css));
ok('Apply is the scoped gold-filled action',css.includes('.nav-actions .nav-apply,.drawer-apply')&&css.includes('linear-gradient(135deg,#D9B44A,var(--gold))')&&!/\.portal-link:hover\{background:var\(--gold\)/.test(css));
ok('mobile breakpoint and 44px toggle',css.includes('@media(max-width:959px)')&&css.includes('width:44px;height:44px')&&css.includes('html.js .menu-toggle{display:grid}'));
ok('drawer is deep green and active has side bar',css.includes('background:var(--green-deep)')&&css.includes('.site-nav .nav-link.on::after'));
ok('dark header treatment retained',css.includes('[data-theme="dark"] body:not(.portal-body) .navbar'));
ok('focus-visible ring retained',css.includes('.navbar button:focus-visible')&&css.includes('outline:2px solid var(--gold)'));
ok('reduced motion disables header transitions',/@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.site-nav\{transition:none!important\}/.test(css));
ok('passive requestAnimationFrame scroll controller',js.includes('requestAnimationFrame(update)')&&js.includes('{passive:true}')&&js.includes('if(y<=80)setHidden(false)'));
ok('drawer focus trap + Escape close',js.includes('function initMobileNav()')&&js.includes('e.key==="Escape"')&&js.includes('document.activeElement===first')&&js.includes('document.activeElement===last'));
ok('drawer veil + body lock state',js.includes('veil.addEventListener("click"')&&js.includes('document.body.classList.add("nav-open")'));
ok('no optional title swap',!js.includes('visibilitychange')&&!js.includes('document.title'));
const broadEmoji=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
ok('new header markup has no broad emoji glyphs',headers.every(f=>{const s=read(f),a=s.indexOf('<div class="topbar"'),v=s.indexOf('<div class="nav-veil"',a),z=s.indexOf('</div>',v)+6,h=s.slice(a,z);return !broadEmoji.test(h)}));
const sm=read('sitemap.xml');ok('story and search are both in sitemap',sm.includes('/story.html</loc>')&&sm.includes('/search.html</loc>'));
// Model lab must stay independent, provenance-gated and resumable.
for(const f of ['model/README.md','model/data/sources.json','model/data/source-lock.json','model/scripts/fetch_open_data.py','model/scripts/prepare_data.py','model/src/model.py','model/src/train.py','model/src/evaluate.py','model/SAFETY.md'])ok('model asset exists: '+f,fs.existsSync(path.join(SITE,f)));
const sources=JSON.parse(read('model/data/sources.json'));
ok('all fetched model sources declare licences',sources.sources.every(x=>x.license&&x.creator));
ok('Hausa extraction is held for human review',sources.sources.some(x=>x.language==='ha'&&x.approved_for_training===false&&x.reviewed===false));
ok('school KB remains retrieval-only',sources.sources.some(x=>x.id==='treasure-public-kb'&&x.approved_for_training===false));
ok('model policy prohibits private pupil training data',/No pupil records|pupil records/i.test(read('model/README.md'))&&/private (chats|messages)/i.test(read('model/DATA-LICENSES.md')));
ok('production chat scripts do not import model lab',!read('assets/js/chat-core.js').includes('/model/')&&!read('assets/js/chat-ui.js').includes('/model/'));
console.log(`\n==== BATCH53: ${pass} passed, ${fail} failed ====`);process.exit(fail?1:0);
