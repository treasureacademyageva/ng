// verify-batch14.js
const fs = require('fs'), vm = require('vm');
const { JSDOM } = require('jsdom');
const SITE = require('path').resolve(__dirname, '..', '..');
const store = fs.readFileSync(SITE + '/assets/js/store.js', 'utf8');
const site = fs.readFileSync(SITE + '/assets/js/site.js', 'utf8');
const css = fs.readFileSync(SITE + '/assets/css/corporate.css', 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('PASS: ' + name); } else { fail++; console.log('FAIL: ' + name + (extra ? ' | ' + extra : '')); } };

function loadPage(page, session, seedFn) {
  const html = fs.readFileSync(SITE + '/' + page, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' + page, pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  if (!window.IntersectionObserver) { window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; }; }
  window.requestAnimationFrame = window.requestAnimationFrame || (fn => setTimeout(fn, 16));
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.CSS = window.CSS || { escape: s => String(s).replace(/"/g, '') };
  window.print = () => {}; window.scrollTo = () => {};
  const scripts = [...window.document.querySelectorAll('script:not([src])')].map(s => s.textContent).join('\n;\n');
  const errors = [];
  window.addEventListener('error', e => errors.push('window: ' + (e.message || e.error)));
  vm.createContext(window);
  try {
    vm.runInContext(store, window);
    vm.runInContext('window.__DB=DB;', window);
    if (session) vm.runInContext(`localStorage.setItem("treasure_session_v1", '${JSON.stringify(session)}');`, window);
    if (seedFn) seedFn(window);
    vm.runInContext(site + '\n;\n' + scripts, window);
  } catch (e) { errors.push('THROW: ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ')); }
  try { window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true })); } catch (e) { errors.push('DCL: ' + String(e).slice(0, 160)); }
  const real = errors.filter(x => !/navigation|Not implemented/i.test(x));
  return { window, errors: real, run: code => vm.runInContext(code, window) };
}
const ADMIN = { role: 'admin', refId: 'HEAD001', name: 'x' };
const PUPIL = { role: 'pupil', refId: 'P001', name: 'x' };
const dstr = off => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };

/* ---- store seeds ---- */
{
  const { window: w, errors, run } = loadPage('index.html');
  const db = w.__DB.load();
  ok('wa single live line (b15)', db.whatsapp.length === 1 && db.whatsapp[0].phone === '2349063932487', JSON.stringify(db.whatsapp.length));
  ok('wa always-on', db.whatsapp[0].hours === 'always' && db.whatsapp[0].active === true);
  ok('wa migration (b15)', (function(){ const d=w.__DB.load(); d.whatsapp=[{id:'W1',phone:'234814194378'},{id:'W2',phone:'2349063932487'},{id:'W3',phone:'234814194378'}]; w.__DB.save(d); return w.__DB.load().whatsapp.length===1; })());
  ok('ptaAttend obj', db.ptaAttend && !Array.isArray(db.ptaAttend));
  ok('bdayWishes obj', !!db.bdayWishes);
  ok('idle 58/60 fixed', run('IdleLogout.cfg.warnMs===58*60e3 && IdleLogout.cfg.outMs===60*60e3'));
  ok('store clean', errors.length === 0, errors.join(' || ').slice(0, 250));
}

/* ---- footer ---- */
{
  const { window: w, errors } = loadPage('index.html');
  const f = w.document.getElementById('siteFooter').innerHTML;
  ok('footer contact row', f.includes('foot-contact-row') && f.includes('Mon – Fri'));
  ok('footer no creche line', !f.includes('Creche to Primary'));
  ok('footer no portal btn', !f.includes('portal/login'));
  ok('soonSocial fn', typeof w.soonSocial === 'function' && w.soonSocial('Instagram') === false);
  ok('footer clean', errors.length === 0, errors.join(' || ').slice(0, 250));
}

/* ---- ticker: today news + lostfound ---- */
{
  const { window: w, errors } = loadPage('index.html', null, win => {
    const db = win.__DB.load();
    db.newsEvents.push({ id: 'NX14', type: 'news', title: 'T14 Mango Fair', date: dstr(0), text: 'x', views: 1, likes: 0 });
    db.lostfound.push({ id: 'LF14', item: 'Red lunchbox', date: dstr(-1), claimed: false });
    win.__DB.save(db);
  });
  const t = w.document.getElementById('newsTicker').textContent;
  ok('ticker today news', t.includes('News today:') && t.includes('T14 Mango Fair'));
  ok('ticker lostfound', t.includes('Lost & Found:') && t.includes('Red lunchbox'));
  ok('ticker clean', errors.length === 0, errors.join(' || ').slice(0, 250));
}

/* ---- clock weekend + lightbox + filters + chat + search + treasure ---- */
{
  const { window: w, run, errors } = loadPage('index.html');
  ok('clock weekend', run('ClockWidget.schedule(10,0,6)[0]') === 'WEEKEND');
  ok('clock weekday', run('ClockWidget.schedule(8,0,1)[0]') !== 'WEEKEND');
  run('Lightbox.open([{src:"a.png",cap:"c"}],0);');
  ok('lightbox no counter', !w.document.querySelector('.lb-count'));
  run('document.querySelector(".lightbox,.lb-modal,.modal-bg").remove();');
  run('document.body.insertAdjacentHTML("beforeend",\'<input data-phone id="tPh"><input data-alpha id="tAl">\'); initInputFilters();');
  run('var i=document.getElementById("tPh"); i.value="08031234567"; i.dispatchEvent(new Event("input")); i.dispatchEvent(new Event("blur"));');
  ok('phone strips 0 to 10', w.document.getElementById('tPh').value === '8031234567', w.document.getElementById('tPh').value);
  run('var a=document.getElementById("tAl"); a.value="musa ibrahim"; a.dispatchEvent(new Event("input")); a.dispatchEvent(new Event("blur"));');
  ok('alpha sentence case', w.document.getElementById('tAl').value === 'Musa Ibrahim', w.document.getElementById('tAl').value);
  ok('chat testimonials', run('Chatbot.answer("where are all the parent reviews?")').includes('Testimonials'));
  ok('chat pta', run('Chatbot.answer("when is the next pta meeting?")').includes('PTA'));
  ok('chat call', run('Chatbot.answer("how do i call the school?")').includes('WhatsApp'));
  ok('chat typo syn', run('Chatbot.answer("wetin be dis skul fees?")').toLowerCase().includes('fee'));
  run('Search.open(); var si=document.getElementById("searchInput"); si.value="adm"; si.dispatchEvent(new Event("input"));');
  ok('search suggest', w.document.getElementById('searchSug').textContent.includes('admission'));
  ok('treasure 7 makers', run('Treasure.makers.length') === 7);
  ok('treasure multi', run('Treasure.makers[4]().multi') === true);
  ok('treasure match+edu', run('Treasure.makers[5]().ans.length') === 1 && typeof run('Treasure.makers[6]().q') === 'string');
  ok('misc clean', errors.length === 0, errors.join(' || ').slice(0, 250));
}

/* ---- index structure ---- */
{
  const src = fs.readFileSync(SITE + '/index.html', 'utf8');
  const order = ['CAMPUS TOUR', 'EXCURSION VIDEOS', 'HEADMISTRESS', 'id="testimonials"'].map(s => src.indexOf(s));
  ok('index order campus>videos>hm>testi', order.every(x => x > 0) && order[0] < order[1] && order[1] < order[2] && order[2] < order[3]);
  ok('cta merged once', (src.match(/cta-band/g) || []).length === 1);
  const calPos = src.indexOf('id="calCount"'), newsPos = src.indexOf('id="news"'), promoPos = src.indexOf('PROMOTIONS');
  ok('calCount between promo+news', promoPos < calPos && calPos < newsPos);
  ok('see all reviews link', src.includes('href="testimonials.html">See All Reviews'));
  const { window: w } = loadPage('index.html');
  const dow = new Date().getDay();
  if (dow === 0 || dow === 6) ok('weekend calCount', w.document.getElementById('calCount').textContent.includes('resumes back on Monday'));
  else ok('weekday calCount', !w.document.getElementById('calCount').textContent.includes('resumes back on Monday'));
}

/* ---- news page ---- */
{
  const { window: w, run, errors } = loadPage('news.html', null, win => {
    const db = win.__DB.load();
    for (let i = 0; i < 8; i++) db.newsEvents.push({ id: 'NW' + i, type: i % 2 ? 'event' : 'news', title: 'Story ' + i, date: '2026-09-1' + (i % 9), text: 't', views: i, likes: 0 });
    win.__DB.save(db);
  });
  ok('type dropdown + date', !!w.document.getElementById('typeFilter') && w.document.getElementById('dateFilter').type === 'date');
  ok('pills gone', w.document.querySelectorAll('.pill-btn').length === 0);
  ok('2 album chips', w.document.querySelectorAll('#albumChips .chip').length === 2);
  ok('7 per page', w.document.querySelectorAll('#neList .ne-row').length === 7);
  ok('page hint', w.document.getElementById('pageHint').textContent.includes('Page 1 of'));
  run('stPage(1);');
  ok('page 2 advances', w.document.getElementById('pageHint').textContent.includes('Page 2 of'));
  ok('news clean', errors.length === 0, errors.join(' || ').slice(0, 250));
}

/* ---- about sort ---- */
{
  const { window: w, errors } = loadPage('about.html', null, win => {
    const db = win.__DB.load();
    db.teachers = [{ id: 'T6', name: 'Zed Six', class: 'Primary 6' }, { id: 'TC', name: 'Ann Creche', class: 'Creche' }, { id: 'TN', name: 'Mid Nurse', class: 'Nursery 1' }];
    win.__DB.save(db);
  });
  const cards = [...w.document.querySelectorAll('#teamGrid .team-card')].map(c => c.textContent);
  ok('staff sorted creche first', cards.length === 3 && cards[0].includes('Ann Creche') && cards[2].includes('Zed Six'), cards.map(c => c.slice(0, 20)).join('|'));
  ok('about clean', errors.length === 0, errors.join(' || ').slice(0, 250));
}

/* ---- contact ---- */
{
  const { window: w, errors } = loadPage('contact.html');
  ok('how-it-works gone', !w.document.body.textContent.includes('How it works'));
  ok('visit card', w.document.body.textContent.includes('Or Visit Us'));
  const wa = w.document.getElementById('waList').textContent;
  ok('wa 1 line (b15)', (w.document.querySelectorAll('#waList .wa-card') || []).length === 1);
  ok('wa live status (b15)', wa.includes('Active now') && wa.includes('09063932487'));
  ok('contact clean', errors.length === 0, errors.join(' || ').slice(0, 250));
}

/* ---- login ---- */
{
  const src = fs.readFileSync(SITE + '/portal/login.html', 'utf8');
  ok('login +234 x2', (src.match(/\+234<\/span>/g) || []).length === 2);
  ok('login maxlength 10', src.includes('id="rG1Phone" data-phone maxlength="10"'));
  ok('login phone hints', src.includes('0805 123 4567') && src.includes("fillDemo('0805 111 2222')")); // batch18: phone is the login ID
  ok('login alt fixed', src.includes('alt="Happy pupils learning"'));
  const adm = fs.readFileSync(SITE + '/portal/admin.html', 'utf8'), tch = fs.readFileSync(SITE + '/portal/teacher.html', 'utf8');
  const fmt = '"TAA/P/"+String(db.seq.pupil).padStart(4,"0")';
  ok('adm format admin x3', adm.split(fmt).length - 1 === 3);
  ok('adm format teacher x2', tch.split(fmt).length - 1 === 2);
}

/* ---- pta attend + minutes ---- */
{
  const { window: w, run, errors } = loadPage('pta.html', null, win => {
    const db = win.__DB.load();
    db.ptaMeetings = [{ id: 'PMF', date: dstr(10), title: 'General Meeting', venue: 'Hall' }, { id: 'PMP', date: dstr(-10), title: 'Last Term Meeting', minutes: 'We agreed to paint.' }];
    win.__DB.save(db);
  });
  ok('attend btn', !!w.document.getElementById('attendBtn'));
  run('document.getElementById("attendBtn").click();');
  ok('attend counted', w.__DB.load().ptaAttend.PMF === 1);
  ok('past minutes', w.document.getElementById('ptaPast').textContent.includes('We agreed to paint'));
  ok('pta clean', errors.length === 0, errors.join(' || ').slice(0, 250));
  const w2 = loadPage('pta.html', null, win => { const db = win.__DB.load(); db.ptaMeetings = []; win.__DB.save(db); });
  ok('past empty state', w2.window.document.getElementById('ptaPast').textContent.includes('No past meetings yet'));
}

/* ---- birthdays wish counter ---- */
{
  const { window: w, run, errors } = loadPage('birthdays.html', null, win => {
    const db = win.__DB.load();
    db.teachers = [{ id: 'T9X', name: 'Test Teacher', class: 'Primary 1', dob: '1990-04-05' }];
    win.__DB.save(db);
  });
  ok('wish badge', !!w.document.getElementById('wishN0'));
  run('copyWish(0);');
  ok('wish counted', w.__DB.load().bdayWishes['Test Teacher'] === 1 && w.document.getElementById('wishN0').textContent === '1');
  ok('bday clean', errors.length === 0, errors.join(' || ').slice(0, 250));
}

/* ---- admissions deadline ---- */
{
  const { window: w, errors } = loadPage('admissions.html');
  const b = w.document.getElementById('admDeadline').textContent;
  ok('deadline banner', b.includes('days left') || b.includes('closes TODAY') || b.includes('closed'), b.slice(0, 80));
  ok('admissions clean', errors.length === 0, errors.join(' || ').slice(0, 250));
}

/* ---- pupil: levy badge + exam countdown ---- */
{
  const { window: w, errors } = loadPage('portal/pupil.html', PUPIL, win => {
    const db = win.__DB.load();
    db.registrations.push({ id: 'RG-T14', ward: { first: 'Adaeze', surname: 'Okafor' }, guardian: { g1: { name: 'Mrs Okafor', phone: '08051112222' } }, payment: { status: 'Unpaid', method: 'Bank transfer' } });
    db.ptaLevy = { amount: 5000, note: '' };
    db.pta = [{ id: 'PA1', family: 'Okafor Family', amount: 5000, date: dstr(-5), receipt: 'R-001' }];
    db.exams = [{ id: 'EX1', subject: 'Mathematics', date: dstr(5), time: '8:00 AM', classes: 'Primary 1-6', day: 'Testday' }];
    win.__DB.save(db);
  });
  ok('levy PAID badge', w.document.getElementById('feeStatus').textContent.includes('PTA LEVY: PAID'));
  ok('exam countdown', /Exams begin in \d+ days/.test(w.document.getElementById('examZone').textContent));
  ok('pupil clean', errors.length === 0, errors.join(' || ').slice(0, 250));
  const w2 = loadPage('portal/pupil.html', PUPIL, win => {
    const db = win.__DB.load();
    db.registrations.push({ id: 'RG-T14', ward: { first: 'Adaeze', surname: 'Okafor' }, guardian: { g1: { name: 'x', phone: '1' } }, payment: { status: 'Unpaid', method: 'Bank transfer' } });
    db.ptaLevy = { amount: 5000, note: '' };
    db.pta = [];
    win.__DB.save(db);
  });
  ok('levy DUE badge', w2.window.document.getElementById('feeStatus').textContent.includes('PTA LEVY: DUE'));
}

/* ---- admin: minutes edit, exam reminder, emergency presets ---- */
{
  const { window: w, run, errors } = loadPage('portal/admin.html', ADMIN, win => {
    const db = win.__DB.load();
    db.ptaMeetings = [{ id: 'PME', date: dstr(-20), title: 'Old Meeting', venue: 'Hall' }];
    win.__DB.save(db);
  });
  ok('minutes field', !!w.document.getElementById('pmMinutes'));
  run('editPtaMt("PME"); document.getElementById("pmMinutes").value="Paint approved."; savePtaMt();');
  ok('minutes saved', (w.__DB.load().ptaMeetings.find(m => m.id === 'PME') || {}).minutes === 'Paint approved.');
  ok('exam reminder box', !!w.document.getElementById('exRem'));
  run('document.getElementById("exRem").value="Exams start Monday."; sendExamRem();');
  const nt = w.__DB.load().notices[0];
  ok('reminder sent', nt && nt.title === 'Exam Reminder' && nt.to === 'parents');
  run('emgPreset("School is CLOSED today.");');
  const em = w.__DB.load().school.emergency;
  ok('emg one-tap on', em.on === true && em.text.includes('CLOSED'));
  run('emgPreset("");');
  ok('emg one-tap off', w.__DB.load().school.emergency.on === false);
  ok('admin clean', errors.length === 0, errors.join(' || ').slice(0, 300));
}

/* ---- testimonials page ---- */
{
  const { window: w, errors } = loadPage('testimonials.html', null, win => {
    const db = win.__DB.load();
    db.testimonials = [{ name: 'Happy Parent', text: 'Great school!', stars: 5, approved: true }];
    win.__DB.save(db);
  });
  ok('testimonials render', w.document.getElementById('allTesti').textContent.includes('Great school!'));
  ok('testimonials clean', errors.length === 0, errors.join(' || ').slice(0, 250));
}

/* ---- css + meta + version file checks ---- */
{
  ok('dark underlay fix', css.includes('body:not(.portal-body)::before{z-index:-1}'));
  ok('dark navbar solid', css.includes('[data-theme="dark"] .navbar{background:#101B28}'));
  ok('tap feedback', css.includes(':active{transform:scale(.96)'));
  ok('nav pill css', css.includes('.nav-links a.on{background:var(--green)'));
  ok('rails css', css.includes('.prog-grid,.feat-grid{display:flex') && css.includes('.team-grid{display:flex'));
  ok('ne vertical css', css.includes('.ne-list{flex-direction:column'));
  const pages = fs.readdirSync(SITE).filter(f => f.endsWith('.html')).map(f => SITE + '/' + f)
    .concat(fs.readdirSync(SITE + '/portal').filter(f => f.endsWith('.html')).map(f => SITE + '/portal/' + f));
  const noMeta = pages.filter(p => !fs.readFileSync(p, 'utf8').includes('http-equiv="Cache-Control"'));
  ok('no-cache all pages', noMeta.length === 0, noMeta.join(','));
  const old = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = d + '/' + e.name;
    if (e.isDirectory()) { if (!['node_modules', '.git', 'tools'].includes(e.name)) walk(p); }
    else if (/\.(html|js|css)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes('20260916-13')) old.push(p);
  });
  walk(SITE);
  ok('version bumped', old.length === 0, old.join(','));
}

console.log(`\nBATCH14: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
