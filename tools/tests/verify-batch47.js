// verify-batch47.js — real graduation news, 25 September 2026:
// the owner supplied the school's actual graduation records (2017-2021) so
// the news feed, the calendar and the chatbot speak real dates, not demo
// ones. Also: founding year corrected to 2016 per the school's own history,
// the four graduation photos identified, past events stop offering seats,
// and the founding-year + honest-no-date chat answers verified end to end.
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = require('path').resolve(__dirname, '..', '..');
const store = fs.readFileSync(SITE + '/assets/js/store.js', 'utf8');
const sitejs = fs.readFileSync(SITE + '/assets/js/site.js', 'utf8');
const indexHtml = fs.readFileSync(SITE + '/index.html', 'utf8');
const aboutHtml = fs.readFileSync(SITE + '/about.html', 'utf8');
const alumniHtml = fs.readFileSync(SITE + '/alumni.html', 'utf8');
const calendarHtml = fs.readFileSync(SITE + '/calendar.html', 'utf8');
const newsHtml = fs.readFileSync(SITE + '/news.html', 'utf8');
const storyHtml = fs.readFileSync(SITE + '/story.html', 'utf8');
const volunteerHtml = fs.readFileSync(SITE + '/volunteer.html', 'utf8');
const chatCore = fs.readFileSync(SITE + '/assets/js/chat-core.js', 'utf8');
const extraCss = fs.readFileSync(SITE + '/assets/css/extra.css', 'utf8');
const swjs = fs.readFileSync(SITE + '/sw.js', 'utf8');
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

/* ---------- A. the five real records, exactly as the owner gave them ---------- */
{
  const ix = loadPage('index.html');
  const data = JSON.parse(ix.run(`(function(){
    const db=DB.load();
    return JSON.stringify({
      founded: db.school.founded,
      ne: db.newsEvents.map(n=>({id:n.id,t:n.title,d:n.date,img:n.image,h:!!n.historic,ty:n.type})),
      demoLeft: db.newsEvents.filter(n=>/^NE[1-8]$/.test(n.id)).length,
      commentKeys: Object.keys(db.comments||{})
    });
  })()`));
  ok('founding year is 2016 (school history)', data.founded === 2016);
  ok('exactly five news records', data.ne.length === 5, JSON.stringify(data.ne.length));
  const want = [
    ['NEG1', '1st Graduation Ceremony', '2017-07-26', 'grad-01.jpg'],
    ['NEG2', '2nd Graduation Ceremony', '2018-07-24', 'grad-02.jpg'],
    ['NEG3', '3rd Graduation Ceremony', '2019-08-06', 'grad-03.jpg'],
    ['NEG4', '4th Graduation Ceremony', '2020-08-07', 'grad-04.jpg'],
    ['NEG5', '5th Graduation Ceremony', '2021-08-17', 'grad-05.jpg']
  ];
  want.forEach((w, i) => {
    const n = data.ne[i] || {};
    ok(`${w[0]} = "${w[1]}" on ${w[2]}`,
       n.id === w[0] && n.t === w[1] && n.d === w[2] && String(n.img).indexOf(w[3]) >= 0,
       JSON.stringify(n));
    ok(`${w[0]} flagged historic + event`, n.h === true && n.ty === 'event');
  });
  ok('no demo news items left in the seed', data.demoLeft === 0);
  ok('no seeded demo comments left', data.commentKeys.length === 0, JSON.stringify(data.commentKeys));
  want.forEach(w => ok(`photo exists: ${w[3]}`, fs.existsSync(SITE + '/assets/img/graduates/' + w[3])));
  ok('homepage shows all five cards',
     [...ix.window.document.querySelectorAll('#newsGrid .ne-card h3')].map(e => e.textContent).join('|') ===
     '5th Graduation Ceremony|4th Graduation Ceremony|3rd Graduation Ceremony|2nd Graduation Ceremony|1st Graduation Ceremony');
  ok('homepage cards show 0 views / 0 likes (honest)',
     ix.window.document.querySelector('#newsGrid .ne-card .ne-meta').textContent.includes('0 views'));
  ok('homepage section renamed for real stories', indexHtml.includes('School <span class="hl">News</span>'));
  ok('index has no errors', ix.errors.length === 0, ix.errors.join('||').slice(0, 120));
}

/* ---------- B. the stories carry the owner's facts + brief history ---------- */
{
  const s1 = loadPage('story.html', null, null);
  const run1 = s1.run('(function(){ location.search="?id=NEG1"; return ""; })()');
  // story.html reads the id at load; reload with the query in the URL instead
  const dom1 = new JSDOM(fs.readFileSync(SITE + '/story.html', 'utf8'),
    { url: 'http://localhost/story.html?id=NEG1', pretendToBeVisual: true });
  const w1 = dom1.window;
  w1.matchMedia = w1.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!w1.IntersectionObserver) { w1.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
  w1.HTMLCanvasElement.prototype.getContext = () => null;
  w1.print = () => {}; w1.scrollTo = () => {}; w1.open = () => {}; w1.requestAnimationFrame = () => 0;
  w1.Element.prototype.scrollIntoView = w1.Element.prototype.scrollIntoView || function () {};
  const scripts1 = [...w1.document.querySelectorAll('script:not([src]):not([type="application/ld+json"])')].map(s => s.textContent).join('\n;\n');
  const errs1 = [];
  w1.addEventListener('error', e => errs1.push(String((e.message || '').slice(0, 120))));
  vm.createContext(w1);
  vm.runInContext(store + '\n;window.__DB=DB;', w1);
  vm.runInContext(sitejs + '\n;\n' + scripts1, w1);
  w1.document.dispatchEvent(new w1.Event('DOMContentLoaded', { bubbles: true }));
  const body1 = w1.document.getElementById('storyBox').textContent;
  ok('NEG1 story: 26th July 2017, six graduands', /26th July, 2017/.test(body1) && /6 pupils in number/.test(body1));
  ok('NEG1 story: brief history — established 2016 by the Proprietress',
     /established in 2016/.test(body1) && /Shaibu Sidikat Ruth/.test(body1) && /Proprietress/.test(body1));
  ok('NEG1 story: aims as written ("effective and efficient future leader")',
     /effective and efficient future leader/.test(body1));
  ok('NEG1 story: location + catchment (Ageva, Okene, Kogi State)',
     /Ageva, Okene Local Government Area of Kogi State/.test(body1) && /catchment area/.test(body1));
  ok('NEG1 story: school contact line 0906 393 2487', /0906 393 2487/.test(body1));
  ok('NEG1 story: no invented pioneer-teacher names', !/Mrs\. (Zeenat|Aunty) /.test(body1));
  ok('story paragraphs keep line breaks', /\.story-body p\{white-space:pre-line\}/.test(extraCss));
  ok('story page has no errors', errs1.filter(x => !/navigation|Not implemented/i.test(x)).length === 0,
     errs1.join('||').slice(0, 120));

  const mkStory = id => {
    const d = new JSDOM(fs.readFileSync(SITE + '/story.html', 'utf8'),
      { url: 'http://localhost/story.html?id=' + id, pretendToBeVisual: true });
    const w = d.window;
    w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
    if (!w.IntersectionObserver) { w.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
    w.HTMLCanvasElement.prototype.getContext = () => null;
    w.print = () => {}; w.scrollTo = () => {}; w.open = () => {}; w.requestAnimationFrame = () => 0;
    w.Element.prototype.scrollIntoView = w.Element.prototype.scrollIntoView || function () {};
    const sc = [...w.document.querySelectorAll('script:not([src]):not([type="application/ld+json"])')].map(s => s.textContent).join('\n;\n');
    vm.createContext(w);
    vm.runInContext(store + '\n;window.__DB=DB;', w);
    vm.runInContext(sitejs + '\n;\n' + sc, w);
    w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
    return w;
  };
  const b2 = mkStory('NEG2').document.getElementById('storyBox').textContent;
  ok('NEG2 story: school premises, 24th July 2018, Common Entrance',
     /24th July, 2018/.test(b2) && /school premises/.test(b2) && /Common Entrance/.test(b2));
  const b3 = mkStory('NEG3').document.getElementById('storyBox').textContent;
  ok('NEG3 story: exams at St. Paul Primary School, victorious',
     /St\. Paul Primary School/.test(b3) && /victorious/i.test(b3) && /6th August, 2019/.test(b3));
  const b4 = mkStory('NEG4').document.getElementById('storyBox').textContent;
  ok('NEG4 story: Covid-19, 11 graduands asked back',
     /Covid-19/.test(b4) && /11 pupils/.test(b4) && /prize-giving/.test(b4));
  const w5 = mkStory('NEG5');
  const b5 = w5.document.getElementById('storyBox').textContent;
  ok('NEG5 story: exams in the school\'s own name, government-registered centre',
     /17th August, 2021/.test(b5) && /in the name of the school/.test(b5) && /registered by the concerned government authority/.test(b5));
  ok('past event shows no seat-reservation form', !w5.document.getElementById('storyBox').innerHTML.includes('Reserve Your Seat'));
}

/* ---------- C. news page: history stays out of the archive, no seats badges ---------- */
{
  const n = loadPage('news.html');
  const list = n.window.document.getElementById('neList').innerHTML;
  ['1st', '2nd', '3rd', '4th', '5th'].forEach(o =>
    ok(`news list shows the ${o} ceremony`, list.includes(`${o} Graduation Ceremony`)));
  ok('no seats-left badge on past events', !list.includes('seats left'));
  ok('historic stories are not archived away', !n.window.document.getElementById('neList').innerHTML.includes('Nothing here yet'));
  const feat = n.window.document.getElementById('newsFeatured').textContent;
  ok('featured story is the 5th ceremony (latest by date)', feat.includes('5th Graduation Ceremony'));
  ok('archive code exempts historic items', newsHtml.includes('n.date>=cut||n.historic'));
  ok('seats badge gated to upcoming events', /n\.type==="event"&&n\.date>=U\.todayStr\(\)/.test(newsHtml));
  ok('news page has no errors', n.errors.length === 0, n.errors.join('||').slice(0, 120));
}

/* ---------- D. calendar: real dates on the school-history strip ---------- */
{
  const c = loadPage('calendar.html');
  const term = c.window.document.getElementById('calList').textContent;
  const hist = c.window.document.getElementById('histList');
  ok('term calendar still lists the term dates', /Resumption/.test(term) && /Independence Day/.test(term));
  ok('history strip renders five highlights', hist && hist.querySelectorAll('.track-card').length === 5,
     String(hist && hist.querySelectorAll('.track-card').length));
  ok('history strip starts at the 1st ceremony (2017)',
     hist.textContent.includes('26 July 2017') && hist.textContent.includes('1st Graduation Ceremony'));
  ok('history strip ends at the 5th ceremony (2021)',
     hist.textContent.includes('17 August 2021') && hist.textContent.includes('5th Graduation Ceremony'));
  ok('history cards link to the stories', hist.innerHTML.includes("story.html?id=NEG1") && hist.innerHTML.includes("story.html?id=NEG5"));
  ok('calendar page has no errors', c.errors.length === 0, c.errors.join('||').slice(0, 120));
}

/* ---------- E. founding year corrected across the site ---------- */
{
  ok('about: Since 2016 sticker', aboutHtml.includes('Since 2016!'));
  ok('about: began in 2016', aboutHtml.includes('began in <b>2016</b>'));
  ok('about: timeline 2016', aboutHtml.includes('<b class="yr">2016</b>'));
  ok('about: founder card 2016', aboutHtml.includes('Treasure Academy, 2016'));
  ok('about: no 2015 left', !aboutHtml.includes('2015'));
  ok('index: Since 2016', indexHtml.includes('Since 2016'));
  ok('index: Founded in 2016', indexHtml.includes('Founded in 2016'));
  ok('index: no 2015 left', !/2015/.test(indexHtml));
  ok('chat: no 2015 left in chat-core', !/2015/.test(chatCore));
  const kb = fs.readFileSync(SITE + '/assets/data/kb.json', 'utf8');
  ok('kb.json founding year is 2016', kb.includes('Founded in 2016') && !kb.includes('Founded in 2015'));
}

/* ---------- F. the chat answers from the real records ---------- */
{
  const mkBot = () => {
    const ctx = { console };
    ctx.window = ctx; ctx.globalThis = ctx;
    ctx.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    ctx.sessionStorage = ctx.localStorage;
    ctx.document = { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }), body: { appendChild() {} } };
    ctx.navigator = {}; ctx.location = { href: '', search: '' };
    vm.createContext(ctx);
    vm.runInContext(store, ctx);
    const snap = vm.runInContext('JSON.stringify(DB.load())', ctx);
    const g = {}; g.window = g;
    const db = JSON.parse(snap);
    const mk = () => { const s = {}; return { getItem: k => (k in s ? s[k] : null), setItem(k, v) { s[k] = String(v); }, removeItem(k) { delete s[k]; } }; };
    g.localStorage = mk(); g.sessionStorage = mk();
    const run = f => new Function('window', 'localStorage', 'sessionStorage', 'DB',
      fs.readFileSync(SITE + '/' + f, 'utf8') + '\nreturn window;')(g, g.localStorage, g.sessionStorage,
      { load: () => JSON.parse(JSON.stringify(db)), save() {} });
    run('assets/js/chat-entities.js'); run('assets/js/chat-rag.js'); run('assets/js/chat-core.js');
    g.TAChat.init(JSON.parse(fs.readFileSync(SITE + '/assets/data/kb.json', 'utf8')));
    return g.TAChat;
  };
  const bot = mkBot();
  const ask = q => { const a = bot.respond(q); bot.pending = null;
    return String((a && a.html) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); };
  const g1 = ask('when is graduation');
  ok('chat: graduation answers the real 5th ceremony',
     g1.includes('5th Graduation Ceremony') && g1.includes('17 August 2021') && g1.includes('not been dated'));
  ok('chat: the 1st ceremony answers itself, not the latest',
     ask('when is the 1st graduation ceremony').includes('26 July 2017'));
  ok('chat: latest news lists the real records',
     ask('what is the latest news').includes('5th Graduation Ceremony') && ask('what is the latest news').includes('17 August 2021'));
  ok('chat: founded in 2016', /2016/.test(ask('who founded the school')));
  ok('chat: sports day answered honestly (no invented date)',
     ask('when is sports day').includes('Inter-House Sports') && ask('when is sports day').includes('not been dated'));
  ok('chat: excursion answered honestly', ask('when is the excursion').includes('not been dated'));
  ok('chat: prize giving day keeps its calendar answer',
     ask('when is prize giving day').includes('18 December 2026'));
}

/* ---------- G. gallery captions + volunteer picker + cache bump ---------- */
{
  ok('gallery captions name the five ceremonies',
     alumniHtml.includes('1st Graduation Ceremony \u2014 2017') && alumniHtml.includes('5th Graduation Ceremony \u2014 2021'));
  ok('gallery captions identify the 2024 register photos',
     alumniHtml.includes('Basic 6 Common Entrance register \u2014 2024'));
  ok('volunteer picker only offers upcoming events',
     /n\.date>=U\.todayStr\(\)&&\(!n\.publishAt/.test(volunteerHtml));
  ok('service worker cache bumped', swjs.includes("'treasure-v68'"));
  ok('asset version bumped everywhere', !indexHtml.includes('v=20260925-5-61') && indexHtml.includes('v=20260925-6-62'));
}

/* ---------- H. migration retires the demo feed on old devices ---------- */
{
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  const w = dom.window;
  vm.createContext(w);
  const mk = () => { const s = {}; return { getItem: k => (k in s ? s[k] : null), setItem(k, v) { s[k] = String(v); }, removeItem(k) { delete s[k]; } }; };
  w.localStorage = mk(); w.sessionStorage = mk();
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!w.IntersectionObserver) { w.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
  vm.runInContext(store + '\n;window.__DB=DB;', w);
  // an old save: the eight demo items, a seeded demo comment, plus one item
  // the school itself published (NE9) which must survive the retirement
  vm.runInContext(`(function(){
    var d = JSON.parse(JSON.stringify(DB.load()));
    d.newsEvents = [
      {id:"NE1", type:"news", title:"Resumption and Welcome Party", date:"2026-09-08", image:"x", text:"x"},
      {id:"NE2", type:"event", title:"Inter-House Sports Trials", date:"2026-09-20", image:"x", text:"x"},
      {id:"NE9", type:"news", title:"Published by the school", date:"2026-09-24", image:"x", text:"x"}
    ];
    d.comments = { NE1: [{name:"Mrs. Okafor", text:"x"}] };
    delete d.realNewsV1;   /* a save from before this release has no flag */
    localStorage.setItem("treasure_db_v5", JSON.stringify(d));
  })()`, w);
  const after = JSON.parse(vm.runInContext('JSON.stringify(DB.load())', w));
  ok('migration: demo news retired on old saves',
     after.newsEvents.filter(n => /^NE[1-8]$/.test(n.id)).length === 0);
  ok('migration: school-published news survives (NE9)',
     after.newsEvents.some(n => n.id === 'NE9'));
  ok('migration: five real records added',
     ['NEG1', 'NEG2', 'NEG3', 'NEG4', 'NEG5'].every(id => after.newsEvents.some(n => n.id === id)));
  ok('migration: demo comments cleaned', Object.keys(after.comments).indexOf('NE1') === -1);
  ok('migration: runs once (flag set)', after.realNewsV1 === 1);
}

console.log('\n==== BATCH47: ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
