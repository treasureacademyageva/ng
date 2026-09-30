/* Batch 52 — Phase 3/4 closeout + focused security hardening */
const fs=require('fs'),path=require('path'),vm=require('vm');
const {JSDOM}=require('jsdom');
const SITE=path.resolve(__dirname,'..','..');let pass=0,fail=0;
const read=p=>fs.readFileSync(path.join(SITE,p),'utf8');
function ok(n,c,d=''){if(c){pass++;console.log('ok -',n)}else{fail++;console.log('FAIL -',n,d)}}
const pages=fs.readdirSync(SITE).filter(f=>f.endsWith('.html')).sort();
const headers=pages.filter(f=>read(f).includes('id="mainNav"'));

/* Phase 3: the hero serves prospective parents; portal remains in navbar. */
const home=read('index.html');
const hero=(home.match(/<header class="hero"[\s\S]*?<\/header>/)||[''])[0];
ok('hero secondary CTA is Book a Visit',hero.includes('href="contact.html#visit">Book a Visit</a>'));
ok('hero no longer spends secondary CTA on portal',!hero.includes('>Portal Login</a>'));

/* Phase 4/Batch 53: topbar owns the labelled portal pill while a compact
   navbar portal target keeps access available after the topbar collapses. */
ok('35 standard headers retained',headers.length===35,String(headers.length));
for(const f of headers){const s=read(f), top=(s.match(/<div class="topbar">([\s\S]*?)<\/div>\s*<nav/)||[,''])[1], actions=(s.match(/<div class="nav-actions[^>]*>([\s\S]*?)<\/div>/)||[,''])[1];
 ok(f+': topbar includes labelled portal login',top.includes('class="portal-link"')&&top.includes('portal/login.html'));
 ok(f+': sticky actions include compact portal login',(actions.match(/sticky-portal/g)||[]).length===1&&actions.includes('href="portal/login.html"'));
 ok(f+': search/portal/theme/apply order',/id="searchBtn"[\s\S]*sticky-portal[\s\S]*theme-btn[\s\S]*nav-apply/.test(actions));
}
const site=read('assets/js/site.js'), css=read('assets/css/corporate.css');
ok('topbar collapse has 80px threshold and direction handling',site.includes('function initTopbarCollapse()')&&site.includes('if(y<=80)setHidden(false)')&&site.includes('else if(y>lastY)setHidden(true)')&&site.includes('else if(y<lastY)setHidden(false)'));
ok('collapse transforms are <=200ms',css.includes('transition:transform 180ms ease')&&css.includes('body.topbar-collapsed:not(.portal-body) .topbar')&&css.includes('transform:translateY(-100%)')&&css.includes('body.topbar-collapsed:not(.portal-body) .navbar{transform:translateY(-44px)}'));
ok('hidden topbar leaves navbar accessible',site.includes('topbar.inert=hidden')&&headers.every(f=>read(f).includes('sticky-portal')&&read(f).includes('nav-apply')));
ok('optional tab-title reminder is now implemented',site.includes('function initTabTitleSwap()')&&site.includes('visibilitychange')&&site.includes('document.title'));
ok('no contact modal added',!site.includes('contactModal')&&!site.includes('slide-up contact'));

/* Sitemap policy: owner explicitly approved story and search as public. */
const sitemap=read('sitemap.xml'),story=read('story.html'),search=read('search.html');
ok('public story is indexable and in sitemap',story.includes('content="index,follow')&&sitemap.includes('/story.html</loc>'));
ok('public search page is indexable and in sitemap',search.includes('content="index,follow')&&sitemap.includes('/search.html</loc>'));
ok('SEO generator preserves story/search policy',!/NOINDEX[^\n]*(story|search)\.html/.test(read('tools/seo-build.py')));

/* Permanent verified-contact payment policy. */
const store=read('assets/js/store.js');
const pay=(store.match(/payAccountsHTML\(\)\{([\s\S]*?)\n  \},/)||[,''])[1];
ok('payment helper cannot read bank/live account fields',pay&&!/\.bank|moniepoint|\.account|bk\b/.test(pay));
ok('payment helper uses only approved verification lines',pay.includes('+234 814 194 3478')&&pay.includes('09063932487')&&pay.includes('Never transfer'));
ok('Fees never replaces its static notice',!read('fees.html').includes('bb.innerHTML=U.payAccountsHTML'));
const paymentPages=['index.html','admissions.html','admission-form.html','fees.html','shop.html','photo-day.html','support.html','portal/login.html','portal/pupil.html'];
ok('user-facing pages do not render db bank fields',paymentPages.every(f=>!/(?:bk|bank)\.number|school\.bank/.test(read(f))),paymentPages.filter(f=>/(?:bk|bank)\.number|school\.bank/.test(read(f))).join(','));
ok('shop is bank-transfer only',!read('shop.html').includes('POS at office')&&!read('shop.html').includes('POS machine')&&read('shop.html').includes('const method = "Bank transfer"'));
ok('admin invoice prints verification policy, not account values',!read('portal/admin.html').includes('U.esc(bk.number')&&read('portal/admin.html').includes('Never use account details sent from another number'));

/* Public PII and account-scope hardening. */
const gradSeed=(store.match(/const GRADS_SEED = \[([\s\S]*?)\n\];/)||[,''])[1];
ok('graduate public seed has no phone or full DOB',gradSeed&&!/\bphone:|\bdob:/.test(gradSeed));
ok('graduate public seed has no auth fields',gradSeed&&!/\bpin:|\bpassword:|\badm:/.test(gradSeed));
ok('old graduate browser data is scrubbed',store.includes('["adm","pin","password","phone","parent","dob","activatedAt"]'));
ok('Abedoh Rafatu is the Primary 4 Assistant Headmistress',store.includes('name:"Abedoh Rafatu"')&&store.includes('position:"Assistant Headmistress & Primary 4 Teacher"'));
ok('teacher fixture ships without login credentials',store.includes('id:"T001", loginEnabled:false, pin:null, password:null'));
ok('teacher login route is disabled',store.includes('if(role==="teacher") return null'));
ok('login auto-detection checks leadership accounts only',!/const isStaff=\(d0\.teachers/.test(read('portal/login.html')));

/* Execute the store to verify current and migrated shapes, not just strings. */
try{
 const dom=new JSDOM('<!doctype html><body></body>',{url:'http://localhost/'}),w=dom.window;
 w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});w.fetch=()=>Promise.reject(new Error('offline'));
 vm.createContext(w);vm.runInContext(store,w);
 const db=vm.runInContext('DB.load()',w);
 ok('exactly two approved staff accounts at runtime',db.admins.length===2&&db.admins.map(a=>a.id).sort().join(',')==='ASST001,HEAD001',db.admins.map(a=>a.id).join(','));
 ok('no teacher authenticates at runtime',vm.runInContext('Auth.staffLogin("teacher","T001","1234")',w)===null);
 ok('runtime graduates expose no contact/DOB fields',db.graduates.every(g=>!('phone'in g)&&!('dob'in g)&&!('password'in g)));
 vm.runInContext('var z=DB.load();z.graduates[0].phone="08000000000";z.graduates[0].dob="2010-01-01";z.teachers[0].pin="1234";DB.save(z);',w);
 const clean=vm.runInContext('DB.load()',w);
 ok('migration scrubs old saved PII and teacher PIN',!clean.graduates[0].phone&&!clean.graduates[0].dob&&clean.teachers[0].pin===null);
 dom.window.close();
}catch(e){ok('store security runtime smoke',false,e.stack)}

/* Retained Supabase layer is now truthfully read-only. */
const sync=read('assets/js/sync.js');
ok('legacy generic school_data sync retired',!sync.includes('/school_data')&&!sync.includes("method: 'POST'")&&!sync.includes('method:"POST"'));
ok('browser push is a deliberate no-op',sync.includes('Browser cloud writes are disabled.')&&sync.includes('pushSoon:function(){ return false; }'));
ok('refresh delegates to allowlisted DBLive reader',sync.includes('DBLive.hydrate()'));
ok('connection test reads public sessions only',sync.includes('/rest/v1/sessions?select=id&limit=1'));
const admin=read('portal/admin.html');
ok('admin labels connection read-only',admin.includes('Public Data Connection (Supabase)')&&admin.includes('never uploads portal passwords, pupil records or payment data')&&!admin.includes('onclick="pushSup()"'));
ok('no service-role credential appears in source',!fs.readdirSync(path.join(SITE,'assets/js')).some(f=>/service_role\s*[:=]\s*["']ey/i.test(read('assets/js/'+f))));

/* Chat and HTTP boundary checks. */
const chatui=read('assets/js/chat-ui.js'),vercel=JSON.parse(read('vercel.json'));
ok('chat escapes the user question before render/storage',chatui.includes('Core.push("user", esc(q))')&&chatui.includes('bubble("user", esc(q), m.t)'));
const globalHeaders=(vercel.headers.find(x=>x.source==='/(.*)')||{}).headers||[];const hm=Object.fromEntries(globalHeaders.map(x=>[x.key,x.value]));
ok('site-wide HSTS enabled',/max-age=63072000/.test(hm['Strict-Transport-Security']||''));
ok('site-wide framing/referrer/nosniff headers enabled',hm['X-Frame-Options']==='SAMEORIGIN'&&hm['X-Content-Type-Options']==='nosniff'&&hm['Referrer-Policy']==='strict-origin-when-cross-origin');
ok('permissions policy limits sensitive APIs',/camera=\(\)/.test(hm['Permissions-Policy']||'')&&/microphone=\(self\)/.test(hm['Permissions-Policy']||''));
ok('security review documents browser-auth boundary',read('docs/SECURITY-REVIEW-BATCH52.md').includes('not a server authorization boundary'));

/* Release identifiers and protected assets. */
ok('all standard headers use ui52',headers.every(f=>read(f).includes('20260930-ui54')));
ok('service worker cache is v75',read('sw.js').includes("'treasure-v75'"));
ok('shop JPEG assets remain',fs.readdirSync(path.join(SITE,'assets/img')).filter(x=>/^shop-.*\.jpg$/.test(x)).length===10);
console.log(`\n==== BATCH52: ${pass} passed, ${fail} failed ====`);process.exit(fail?1:0);
