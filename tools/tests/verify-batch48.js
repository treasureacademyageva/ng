/* ============================================================================
   BATCH 48 (26 Sept 2026) — the first graduands, by name.
   Owner review of the graduation records:
     - the 2017 set (the first the school ever celebrated) is published by
       name, with the Head Girl and Head Boy roles the owner gave;
     - the 5th ceremony date is corrected to 12/08/2021 (the banner in the
       graduation photo reads 12/08/2021, not 17/08);
     - the alumni gallery photos of the five ceremonies open a "meet the set"
       pop-up that carries the graduands and the story from the news;
     - grad-10 is identified as the handwritten 2017 register;
     - the header card touches BOTH edges at phone widths (owner: "make sure
       that it right side reach the other side so that both side touches the
       edge") — the flex container was shrinking the card;
     - the chatbot answers who-questions from the published story only.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const SITE = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(SITE, p), 'utf8');
let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('ok - ' + label); }
  else { fail++; console.log('FAIL - ' + label + (detail ? '  [' + detail + ']' : '')); }
}

const store = read('assets/js/store.js');
const alumni = read('alumni.html');
const corporate = read('assets/css/corporate.css');
const chatCore = read('assets/js/chat-core.js');

/* ------------------------------------------------- A. the 2017 graduands */
const NAMES = ['Jimoh Faridat', 'Aliyu AbdulHakeem', 'Olowolabi Favour',
               'Abdulrazak Kamirudeen', 'Rashidat Muhammed', 'MomohJimoh Mutolib'];
NAMES.forEach(n => ok('NEG1 story names ' + n,
  store.includes('id:"NEG1"') &&
  store.slice(store.indexOf('id:"NEG1"'), store.indexOf('id:"NEG2"')).includes(n)));
ok('NEG1 story: Head Girl role',
  /1\. Jimoh Faridat \\u2014 Head Girl|1\. Jimoh Faridat — Head Girl/.test(store));
ok('NEG1 story: Head Boy role',
  /6\. MomohJimoh Mutolib \\u2014 Head Boy|6\. MomohJimoh Mutolib — Head Boy/.test(store));
ok('NEG1 story: the 2016 single first graduate is remembered, unnamed',
  /first graduate|first-ever graduate/.test(store) && store.includes('alone in 2016'),
  'the school had one graduate in 2016, before the first celebrated ceremony');
ok('NEG1 story keeps its history section',
  store.slice(store.indexOf('id:"NEG1"'), store.indexOf('id:"NEG2"')).includes('A brief history of our school'));
ok('NEG1 summary mentions the set leaders',
  store.slice(store.indexOf('id:"NEG1"'), store.indexOf('id:"NEG2"')).includes('Head Girl and Head Boy'));

/* ------------------------------------------------- B. 5th date correction */
ok('NEG5 date is 2021-08-12', /date:"2021-08-12"/.test(store));
ok('NEG5 story says Thursday, 12th August, 2021',
  store.includes('Thursday, 12th August, 2021'));
ok('no trace of the old 17th August date', !/17th August|2021-08-17/.test(store));
ok('chat-core no longer carries the old date either', !/17th August|2021-08-17/.test(chatCore));

/* ------------------------------------------------- C. alumni pop-up */
ok('GRAD_SETS data present', /window\.GRAD_SETS=\{/.test(alumni));
NAMES.forEach(n => ok('GRAD_SETS lists ' + n, alumni.includes('name:"' + n + '"')));
ok('Head Girl badge data', /name:"Jimoh Faridat",role:"Head Girl"/.test(alumni));
ok('Head Boy badge data', /name:"MomohJimoh Mutolib",role:"Head Boy"/.test(alumni));
ok('the 2016 note rides with the 2017 set', /one pupil/.test(alumni) && /alone in 2016/.test(alumni));
ok('openGradStory handler defined', /window\.openGradStory=function/.test(alumni));
ok('pop-up links to the full news story',
  /story\.html\?id='\+st\.newsId/.test(alumni));
ok('pop-up pulls the story live from the news feed',
  /db\.newsEvents/.test(alumni) && /st\.newsId/.test(alumni));
ok('sex labels render when the office provides them (none invented today)',
  /gp\.sex/.test(alumni) && !/sex:"[FM]"/.test(alumni));
ok('grad-10 caption: 2017 register (verified against the photo)',
  alumni.includes('2017 Graduation register — handwritten'));
ok('section blurb invites families to meet the set',
  /meet the set/.test(alumni));

/* ---------------------------------------------------- jsdom render test */
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
    vm.runInContext(read('assets/js/site.js'), window);
    vm.runInContext(scripts, window);
  } catch (e) { errors.push('run: ' + e.message); }
  return { window, errors };
}

const R = loadPage('alumni.html');
ok('alumni.html renders without script errors', R.errors.length === 0, R.errors.join(' ; ').slice(0, 200));
try {
  const w = R.window;
  ok('12 gallery tiles render', w.document.querySelectorAll('#gradGallery .gal').length === 12);
  const tile0 = w.document.querySelectorAll('#gradGallery .gal')[0];
  ok('ceremony tile opens the meet-the-set pop-up',
    /openGradStory\(0\)/.test(tile0.getAttribute('onclick') || ''));
  const tile9 = w.document.querySelectorAll('#gradGallery .gal')[9];
  ok('register photo keeps the plain lightbox',
    /openGradLB\(9\)/.test(tile9.getAttribute('onclick') || ''));
  ok('meet-the-set hint on ceremony captions', /meet the set/.test(tile0.textContent));

  w.openGradStory(0);
  const box = w.document.getElementById('tpBox');
  const txt = box.textContent;
  ok('pop-up: all six graduands',
    NAMES.every(n => txt.includes(n)), txt.slice(0, 120));
  ok('pop-up: Head Girl / Head Boy badges', txt.includes('Head Girl') && txt.includes('Head Boy'));
  ok('pop-up: the ceremony date', /Wednesday, 26 July 2017/.test(txt));
  ok('pop-up: the 2016 first-graduate note', /2016/.test(txt));
  ok('pop-up: link to the full story',
    !!box.querySelector('a[href="story.html?id=NEG1"]'));
  ok('pop-up: view-photo button still available',
    [...box.querySelectorAll('button')].some(b => /full size/i.test(b.textContent)));

  w.openGradStory(4); // 5th ceremony: no names published for that set
  const txt5 = w.document.getElementById('tpBox').textContent;
  ok('pop-up (5th): story excerpt from the news, NEG5 link',
    !!w.document.getElementById('tpBox').querySelector('a[href="story.html?id=NEG5"]') &&
    /Common Entrance|exam/.test(txt5));
  ok('pop-up (5th): no invented graduand list', !/The Graduands:/.test(txt5));

  ok('lightbox items carry the story link for ceremonies',
    w._gradLB[0].storyId === 'NEG1' && w._gradLB[4].storyId === 'NEG5' &&
    w._gradLB[9].storyId === null);
} catch (e) { ok('jsdom pop-up exercise', false, e.message); }

/* ------------------------------------------------- D. header both edges */
ok('header patch: container becomes a block below the sidebar breakpoint',
  /@media\(max-width:1099px\)\{[\s\S]*?body:not\(\.portal-body\) \.navbar \.container\{display:block\}/.test(corporate));
ok('header patch: the card is stretched to full width',
  /@media\(max-width:1099px\)\{[\s\S]*?\.hd-stack\{width:100%\}/.test(corporate));
ok('header patch: nav items spread across the widened card',
  /@media\(max-width:1099px\)\{[\s\S]*?\.hd-nav\{justify-content:space-between\}/.test(corporate));
ok('the 25 Sept edge-to-edge rules are still in place',
  /body:not\(\.portal-body\) \.navbar \.container\{width:100%;margin:0;padding:0\}/.test(corporate) &&
  /\.hd-back,\.hd-front\{border-radius:0\}/.test(corporate));
ok('desktop sidebar layout untouched (>=1100px keeps its own container rules)',
  /body:not\(\.portal-body\):not\(\[data-page="login"\]\)>\.navbar \.container\{display:flex;flex-direction:column/.test(corporate));

/* ------------------------------------------------- E. chat answers */
function chatHarness() {
  const mk = () => { const s = {}; return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; }, _s: s }; };
  const g = {};
  g.window = g; g.localStorage = mk(); g.sessionStorage = mk();
  const DB = new Function('window', 'localStorage', 'sessionStorage',
    read('assets/js/store.js') + '\nreturn (typeof DB!=="undefined")?DB:null;')(
      g, g.localStorage, g.sessionStorage);
  const run = (f) => new Function('window', 'localStorage', 'sessionStorage', 'DB',
    read(f))(g, g.localStorage, g.sessionStorage, DB);
  run('assets/js/chat-entities.js');
  run('assets/js/chat-rag.js');
  run('assets/js/chat-core.js');
  g.TAChat.init(JSON.parse(read('assets/data/kb.json')));
  return g;
}
const C = chatHarness();
const ask = (q) => {
  const r = C.TAChat.respond(q);
  return String((r && r.html) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};
try {
  const a1 = ask('who was the head girl in 2017?');
  ok('chat: head girl of 2017 answers with the published names',
    a1.includes('Jimoh Faridat') && a1.includes('Head Girl') && a1.includes('MomohJimoh Mutolib'),
    a1.slice(0, 120));
  const a2 = ask('who were the graduates in 2017?');
  ok('chat: "graduates in 2017" reaches the named set, not the 2024 results',
    a2.includes('Jimoh Faridat'), a2.slice(0, 120));
  const a3 = ask('who graduated in 2019?');
  ok('chat: a set without published names gets the honest office answer',
    a3.includes('not published') && a3.includes('2019'), a3.slice(0, 120));
  const a4 = ask('who are the graduates');
  ok('chat: bare "who are the graduates" keeps the 2024 results answer',
    a4.includes('2024') && !a4.includes('Jimoh'), a4.slice(0, 120));
  const a5 = ask('did my child graduate');
  ok('chat: "did my child graduate" unchanged', a5.includes('2024'), a5.slice(0, 120));
  const a6 = ask('who is the head boy of the school?');
  ok('chat: head boy of the school (no ceremony) is not a graduands question',
    a6.includes('headmistress') && !a6.includes('graduands'), a6.slice(0, 120));
  const a7 = ask('when was the 5th graduation ceremony');
  ok('chat: 5th ceremony answers with the corrected date',
    a7.includes('12 August 2021') && !a7.includes('17 August'), a7.slice(0, 120));
  /* follow-up flow */
  ask('tell me about the 1st graduation ceremony');
  const a8 = ask('and the head girl?');
  ok('chat: follow-up "and the head girl?" meets the named set',
    a8.includes('Jimoh Faridat'), a8.slice(0, 120));
  const a9 = ask('and 2018?');
  ok('chat: follow-up "and 2018?" answers the 2nd ceremony',
    a9.includes('24 July 2018'), a9.slice(0, 120));
} catch (e) { ok('chat harness', false, e.message); }

/* ------------------------------------------------- F. kb + sw hygiene */
const kb = JSON.parse(read('assets/data/kb.json'));
ok('kb.json rebuilt with 97 docs', (kb.docs || kb).length === 97);
ok('kb still teaches the 2016 founding year',
  read('assets/data/kb.json').includes('2016'));
const sw = read('sw.js');
ok('service worker cache bumped past v68', /treasure-v(6[9-9]|[7-9][0-9])/.test(sw), sw.match(/treasure-v\d+/) && sw.match(/treasure-v\d+/)[0]);
ok('pages reference the new asset version',
  /v=2026092[6-9]-/.test(read('index.html')), 'asset ?v= string');

console.log('\n==== BATCH 48: ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
