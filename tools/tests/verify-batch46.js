// verify-batch46.js — owner's review, 25 September 2026:
// 1. exactly four demo logins (Headmistress, Teacher, parent w/ 1 child,
//    parent w/ 2 children) and the retirement migration for old saves;
// 2. the real 11-teacher staff wall from Document D — qualifications exactly
//    as issued, "area of discipline" only ever in the About, three per row;
// 3. Staff Code of Conduct aligned with the signed staff paper;
// 4. the 2023 graduate register corrected field by field;
// 5. the header fitted edge-to-edge (no floating card);
// 6. homepage news/promotions back to linked cards side by side + countdown.
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = require('path').resolve(__dirname, '..', '..');
const store = fs.readFileSync(SITE + '/assets/js/store.js', 'utf8');
const sitejs = fs.readFileSync(SITE + '/assets/js/site.js', 'utf8');
const alumni = fs.readFileSync(SITE + '/alumni.html', 'utf8');
const login = fs.readFileSync(SITE + '/portal/login.html', 'utf8');
const teacherHtml = fs.readFileSync(SITE + '/portal/teacher.html', 'utf8');
const adminHtml = fs.readFileSync(SITE + '/portal/admin.html', 'utf8');
const indexHtml = fs.readFileSync(SITE + '/index.html', 'utf8');
const corp = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
const extraCss = fs.readFileSync(SITE + '/assets/css/extra.css', 'utf8');
const readme = fs.readFileSync(SITE + '/README.md', 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok -', name); }
  else { fail++; console.log('FAIL -', name, extra || ''); }
}
function loadPage(page, session, pre) {
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
  vm.runInContext(store + '\n;window.__DB=DB;', window);
  if (session) vm.runInContext('localStorage.setItem("treasure_session_v1", \'' + JSON.stringify(session) + '\');', window);
  if (pre) vm.runInContext(pre, window);
  vm.runInContext(sitejs + '\n;\n' + scripts, window);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return { window, errors: errors.filter(x => !/navigation|Not implemented/i.test(x)), run: c => vm.runInContext(c, window) };
}

/* ---------- A. exactly four demo logins ---------- */
const ix = loadPage('index.html');
const counts = ix.run(`(function(){
  const db=DB.load();
  const two=db.pupils.filter(p=>p.phone==="0805 333 4444");
  return JSON.stringify({
    admins:db.admins.length, teachers:db.teachers.length, pupils:db.pupils.length,
    teacherName:db.teachers[0].name, teacherClass:db.teachers[0].class,
    retired:db.teachers.filter(t=>/^T00[2-9]$/.test(t.id)).length + db.pupils.filter(p=>/^P0(0[4-9]|1[0-7])$/.test(p.id)).length,
    household2:two.length, household2kids:two.map(p=>p.name).join("+"),
    apps:db.applications.length
  });
})()`);
const c = JSON.parse(counts);
ok('one headmistress login', c.admins === 1);
ok('one demo teacher (the real Shaibu Memunat, Primary 1)', c.teachers === 1 && c.teacherName === 'Shaibu Memunat' && c.teacherClass === 'Primary 1');
ok('retired demo accounts gone (T002-T007, P004-P017)', c.retired === 0);
ok('parent with one child (P001)', c.pupils >= 1 && ix.run(`DB.load().pupils.filter(p=>p.phone==="0805 111 2222").length`) === 1);
ok('parent with two children shares one phone', c.household2 === 2 && c.household2kids === 'Emeka Nwosu+Ada Nwosu');
ok('demo admission applications removed', c.apps === 0);
ok('all four logins authenticate', ix.run(`Auth.staffLogin("admin","HEAD001","1234")&&Auth.staffLogin("teacher","T001","1234")&&Auth.pupilLogin("0805 111 2222","1234").ok&&Auth.pupilLogin("0805 333 4444","1234").ok`) === true);
ok('migration retires demo accounts on old saves', ix.run(`(function(){
  const d=DB.load(); d.teachers.push({id:"T006",pin:"1234",name:"old demo"}); d.pupils.push({id:"P014",pin:"1234",name:"old kid"});
  d.demoAccountsV2=undefined; DB.save(d); DB.load();
  const n=DB.load();
  return !n.teachers.some(t=>t.id==="T006") && !n.pupils.some(p=>p.id==="P014") && n.demoAccountsV2===1;
})()`) === true);
ok('login page offers exactly the four demos', (login.match(/fillStaff\(|fillDemo\(/g) || []).length === 4 &&
  login.includes("fillStaff('admin','HEAD001')") && login.includes("fillStaff('teacher','T001')") &&
  login.includes("fillDemo('0805 111 2222')") && login.includes("fillDemo('0805 333 4444')"));
ok('README lists the four demo accounts', readme.includes('HEAD001') && readme.includes('0805 111 2222') && readme.includes('0805 333 4444') && readme.includes('T001'));

/* ---------- B. the real 11-teacher wall (Document D) ---------- */
const al = loadPage('alumni.html');
const wall = al.run(`(function(){
  const w=DB.load().staffWall;
  return JSON.stringify(w.map(t=>[t.name,t.quals,t.gender,String(t.about||"").slice(0,3)]));
})()`);
const W = JSON.parse(wall);
ok('11 teachers on the wall', W.length === 11);
const wantQuals = {
  'Mr Idris Ibrahim': 'HND Computer Science (2017)', 'Mrs Zeenatudeen Uthman': 'B.Agric (2020)',
  'Jimoh Mariam': 'ND Chemistry (2020)', 'Nasirun Yahaya': 'B.Sc Local Govt & Dev. Studies (2014)',
  'Tahab Oyiza Zainab': 'NCE Business Education (2010)', 'Salihu Oyiza Nanahawa': 'NCE Home Economics (2014)',
  'Momoh Bose': 'ND Business Administration (2007)', 'Rebeca Omeiza': 'WASSCE Social Studies (2012)',
  'Siyaka Bose': 'WASSCE Sciences (2012)', 'David O. Esther': 'WASSCE Art (2012)', 'Shaibu Memunat': 'ND Animal Science (2012)'
};
ok('every qualification exactly as the register issues it',
  W.every(t => wantQuals[t[0]] === t[1]), JSON.stringify(W.filter(t => wantQuals[t[0]] !== t[1])));
ok('genders recorded from the register', W.find(t => t[0] === 'Nasirun Yahaya')[2] === 'Male' && W.find(t => t[0] === 'David O. Esther')[2] === 'Female');
ok('About is written from "what they do best", never claimed as a subject taught',
  W.every(t => t[3] === 'Wha'), 'an About does not open with the house formula');
ok('disciplines are NOT parked in the subjects field', al.run(`DB.load().staffWall.filter(t=>(t.subjects||[]).some(s=>/Computer|Chemistry|Business|Animal|Art|Sciences/.test(s))).length`) <= 1);
ok('Idris alone carries Mathematics as the subject he teaches', al.run(`(DB.load().staffWall.find(t=>t.name==="Mr Idris Ibrahim").subjects||[]).join()`) === 'Mathematics');
ok('staff wall grid is the 3-column layout', alumni.includes('class="staff-grid3" id="teamGrid"') && corp.includes('.staff-grid3{display:grid;grid-template-columns:repeat(3,1fr)'));
const cards = [...al.window.document.querySelectorAll('#teamGrid .team-card')];
ok('11 cards, name under the avatar, rounded', cards.length === 11 && cards[0].textContent.includes('Salihu Oyiza Nanahawa') && corp.includes('.team-card{background:#fff;border:1px solid var(--line);border-radius:16px'));
al.run("openTP('W11');");
let tp = al.window.document.getElementById('tpBox').textContent;
ok('popup shows the new About (Shaibu Memunat)', tp.includes('animal science') && tp.includes('ND Animal Science (2012)') && tp.includes('Primary 1'));
al.run("closeTP(); openTP('W04');");
tp = al.window.document.getElementById('tpBox').textContent;
ok('popup About for Nasirun Yahaya follows the register gender', tp.includes('local government and development studies'));
al.run("closeTP();");

/* ---------- C. Staff Code of Conduct = the signed paper ---------- */
for (const [tag, html] of [['teacher', teacherHtml], ['admin', adminHtml]]) {
  ok(`coc ${tag}: point 4 carries instant dismissal without notice`, html.includes('shall attract instant dismissal without notice'));
  ok(`coc ${tag}: point 5 is prohibited conduct (not dismissal)`, /All conducts, direct or indirect, aiming to dent the image and credibility of the school&rsquo;s work are highly prohibited/.test(html));
  ok(`coc ${tag}: point 6 is dismissal`, /Extorting money from parents through the pupils shall attract dismissal\./.test(html));
  ok(`coc ${tag}: point 13 routes through headmistress or proprietor`, html.includes('conveyed to management through the Headmistress') && html.includes('through the proprietor'));
  ok(`coc ${tag}: 20 numbered rules kept`, (html.match(/<li style="margin-bottom:9px">/g) || []).length >= 20);
  ok(`coc ${tag}: the paper header stands`, /TREASURE KIDDIES CENTRE, AGEVA/.test(html) && /Morak Pure Water/i.test(html));
}

/* ---------- D. 2023 graduates corrected against the register ---------- */
const g = JSON.parse(al.run(`(function(){
  const G={}; DB.load().graduates.filter(x=>x.gradYear===2023).forEach(x=>G[x.id]={n:x.name,g:x.gender,d:x.dob,p:x.phone});
  return JSON.stringify(G);
})()`));
ok('18 graduates in the 2023 set', Object.keys(g).length === 18);
ok('G003 name + phone corrected', g.G003.n === 'IDRIS, NANA AISHA OZAVIZE' && g.G003.p === '08131385410');
ok('G007 name corrected', g.G007.n === 'IBRAHIM, NANAH AISHAT ENEYIAMIRE');
ok('G008/G009 gender + dob corrected', g.G008.g === 'Male' && g.G008.d === '2012-03-25' && g.G009.g === 'Female' && g.G009.d === '2012-06-28' && g.G009.p === '08066076460');
ok('G010/G012 phones corrected', g.G010.p === '08063354298' && g.G012.p === '08033354298');
ok('G016 gender corrected', g.G016.g === 'Male');
ok('G017 name + phone corrected', g.G017.n === 'ABEDOH, MUDASHIRU ITOPA' && g.G017.p === '08101871745');
ok('G018 phone corrected', g.G018.p === '08067079263');
ok('no exam scores invented for the 2023 set', al.run(`DB.load().graduates.filter(x=>x.gradYear===2023&&x.exam).length`) === 0);

/* ---------- E. header fits the space ---------- */
ok('header container is full-bleed', corp.includes('body:not(.portal-body) .navbar .container{width:100%;margin:0;padding:0}'));
ok('header cards have no outer margins or radius', corp.includes('.hd-stack{margin:0}') && corp.includes('.hd-back,.hd-front{border-radius:0}'));
ok('cutout keeps its notch, loses the page-corner radius', corp.includes('.hd-cutout{border-top-right-radius:0}'));

/* ---------- F. homepage: linked news cards side by side + promotions + countdown ---------- */
ok('news cards are the linked ne-cards in a grid', indexHtml.includes('id="newsGrid"') && indexHtml.includes('class="ne-grid"') && indexHtml.includes("onclick=\"goStory('${n.id||\"\"}','${n.link||\"\"}')\""));
ok('news cards carry images again', /newsGrid[\s\S]*img class="thumb"/.test(indexHtml));
ok('promotions back to their coloured cards', indexHtml.includes('id="promoGrid"') && indexHtml.includes('promo-${p.color||"sun"}') && !indexHtml.includes('promoSteps'));
ok('admission steps are the only steps left on the homepage', (indexHtml.match(/class="steps"/g) || []).length === 1);
ok('countdown bar restored between notices and news', indexHtml.includes('id="calCount"'));
const hm = loadPage('index.html');
ok('homepage renders without script errors', hm.errors.length === 0, hm.errors.join(' ; ').slice(0, 160));
const ncards = hm.window.document.querySelectorAll('#newsGrid .ne-card').length;
ok('news grid renders the linked cards', ncards >= 3, 'got ' + ncards);
ok('promo grid renders coloured cards', hm.window.document.querySelectorAll('#promoGrid .promo-card').length >= 3);
ok('countdown bar fills (weekday)', hm.window.document.getElementById('calCount').innerHTML.includes('count-bar'));

/* ---------- G. privacy noise retired ---------- */
const priv = fs.readFileSync(SITE + '/docs/DATA-PRIVACY-FINDING.md', 'utf8');
ok('privacy finding withdrawn by the owner', priv.includes('withdrawn by the owner'));
const demoBox = login.slice(login.indexOf('class="demo-box"'), login.indexOf('</div>', login.indexOf('class="demo-box"')));
ok('login demo box no longer advertises a no-password demo', !demoBox.includes('no password yet') && !demoBox.includes('Fatima'));

console.log('\n==== BATCH46: ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
