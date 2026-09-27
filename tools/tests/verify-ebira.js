// verify-ebira.js — real Ebira greetings in the chatbot.
// The school stands in Ageva, Okene — the heart of Ebiraland — yet the bot
// greeted in Hausa, Yoruba and Igbo but not Ebira. Every form below is
// verified against published Ebira phrase lists (Wikivoyage's curated Ebira
// phrasebook, PolyglotClub's Ebira vocabulary, native-speaker lists on
// Nairaland). This suite pins the behaviour: clean, damaged, and combined
// with a real question.
const fs = require('fs'), path = require('path'), vm = require('vm');
const SITE = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(SITE, f), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS: ' + name); }
  else { fail++; console.log('FAIL: ' + name + (extra ? ' | ' + extra : '')); }
};

function harness() {
  /* Load the REAL store, the way the site does - the fee and staff answers
     come from live data, so a minimal demo DB would answer the wrong thing. */
  const ctx = { console };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { addEventListener() {}, getElementById: () => null,
    querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} },
      appendChild() {} }), body: { appendChild() {} } };
  ctx.navigator = {}; ctx.location = { href: "", search: "" };
  vm.createContext(ctx);
  vm.runInContext(read("assets/js/store.js"), ctx);
  const SNAPSHOT = vm.runInContext("JSON.stringify(DB.load())", ctx);

  const mk = () => { const s = {}; return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; } }; };
  const g = {};
  g.window = g; g.localStorage = mk(); g.sessionStorage = mk();
  const db = JSON.parse(SNAPSHOT);
  const run = (f) => new Function("window", "localStorage", "sessionStorage", "DB",
    read(f) + "\nreturn window;")(g, g.localStorage, g.sessionStorage,
    { load: () => JSON.parse(JSON.stringify(db)), save: () => {} });
  run("assets/js/chat-entities.js");
  run("assets/js/chat-rag.js"); run("assets/js/chat-core.js");
  g.TAChat.init(JSON.parse(read("assets/data/kb.json")));
  return g;
}

const H = harness();
const ask = (q) => {
  H.TAChat.topic = null; H.TAChat.topicClass = null; H.TAChat.pending = null;
  return H.TAChat.respond(q) || {};
};
const text = (r) => String(r.html || '').replace(/<[^>]+>/g, ' ')
  .replace(/&bull;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/* --------------------------------------------- the greeting list itself */
const ent = fs.readFileSync(SITE + '/assets/js/chat-entities.js', 'utf8');
ok("ebira greetings present in the list", /"nyene", "ebira", "hello"/.test(ent));
ok("afternoon greeting both spellings",
   /"nya rodu", "ebira", "hello"/.test(ent) && /"nyarodu", "ebira", "hello"/.test(ent));
ok("evening greeting all spellings",
   /"nyar oruva", "ebira"/.test(ent) && /"nya oruva", "ebira"/.test(ent) &&
   /"nyaroruva", "ebira"/.test(ent));
ok("how-are-you both spellings",
   /"etemeya", "ebira", "wellness"/.test(ent) && /"ete me ya", "ebira", "wellness"/.test(ent));
ok("hope-you-are-fine both spellings",
   /"wadahi", "ebira", "wellness"/.test(ent) && /"avu dahi", "ebira", "wellness"/.test(ent));
ok("hello and long-time-no-see",
   /"ngwao", "ebira", "hello"/.test(ent) && /"anyari ekuhi eta", "ebira", "casual"/.test(ent));
ok("avo (thank you) in the thanks list",
   /"dalu", "avo", "merci"/.test(ent));

/* ------------------------------------------------------- clean forms */
let r = ask("nyene");
ok("nyene greets", r.type === "smalltalk" && /treasure bot/i.test(text(r)), text(r).slice(0, 60));
ok("nyene echoes the word", /^Nyene!/.test(text(r)), text(r).slice(0, 30));
ok("nya rodu greets", ask("nya rodu").type === "smalltalk");
ok("nyarodu (one word) greets", ask("nyarodu").type === "smalltalk");
ok("nyar oruva greets", ask("nyar oruva").type === "smalltalk");
ok("nya oruva greets", ask("nya oruva").type === "smalltalk");
ok("nyaroruva (one word) greets", ask("nyaroruva").type === "smalltalk");
ok("ngwao greets", ask("ngwao").type === "smalltalk");

r = ask("etemeya");
ok("etemeya is a wellness check",
   r.type === "smalltalk" && /how are you/i.test(text(r)), text(r).slice(0, 60));
ok("ete me ya is a wellness check",
   /how are you/i.test(text(ask("ete me ya"))));
ok("wadahi is a wellness check", /how are you/i.test(text(ask("wadahi"))));
ok("avu dahi is a wellness check", /how are you/i.test(text(ask("avu dahi"))));

r = ask("anyari ekuhi eta");
ok("long-time-no-see is casual",
   r.type === "smalltalk" && /not much|what do you want/i.test(text(r)), text(r).slice(0, 60));

r = ask("avo");
ok("avo is a thank-you",
   r.type === "smalltalk" && /very welcome/i.test(text(r)), text(r).slice(0, 60));

/* ------------------------------------------------ keyboard damage */
ok("nyeene (held key) still greets", ask("nyeene").type === "smalltalk");
ok("NYENE (caps) still greets", ask("NYENE").type === "smalltalk");
ok("ngwao!! still greets", ask("ngwao!!").type === "smalltalk");
ok("etemeyaa (held key) still wellness", /how are you/i.test(text(ask("etemeyaa"))));
ok("avo! with exclaim still thanks", /very welcome/i.test(text(ask("avo!"))));
ok("nyarodu with a slip (nyarod) still greets or abstains honestly",
   ["smalltalk"].includes(ask("nyarod").type));

/* ------------------------------------- greeting bolted on a real question */
r = ask("nyene, how much is creche fees");
ok("nyene + fee question answers the fee",
   r.type === "answer" && /30,000/.test(text(r)), text(r).slice(0, 60));
r = ask("etemeya, how much is transport to adavi");
ok("etemeya + transport question answers the fare",
   r.type === "answer" && /5,000/.test(text(r)), text(r).slice(0, 60));
r = ask("nyene please who teaches primary 4");
ok("nyene + staff question answers the teacher",
   r.type === "answer" && /Tahab Oyiza Zainab/i.test(text(r)), text(r).slice(0, 60));

/* -------------------------------------------------- boundary safety */
r = ask("how much is transport to adavi");
ok("adavi fare untouched by ebira words",
   r.type === "answer" && /5,000/.test(text(r)), text(r).slice(0, 60));
r = ask("what does the shop sell");
ok("ordinary questions unaffected",
   r.type === "answer" || r.type === "handoff-ask", text(r).slice(0, 60));

console.log("\n==== EBIRA: " + pass + " passed, " + fail + " failed ====");
process.exit(fail ? 1 : 0);
