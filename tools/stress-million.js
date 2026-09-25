#!/usr/bin/env node
/* Treasure Bot - the million-question exam.
   Owner's brief, 24 September 2026: "test it with 1,000,000 questions across
   the whole website to know what to do to improve the knowledge... we are not
   inputting questions and answers, we are using rules" - like the big
   assistants, the bot must survive questions it has never seen.

   So this instrument builds its questions from the school's own live data
   (fees, calendar, staff, shop, news events, every kb.json doc) crossed with
   phrasings, politeness, pidgin, and four levels of keyboard damage:

     L0  the question exactly as typed
     L1  one perturbation  (typo, symbol, accent, caps, joined words...)
     L2  two perturbations
     L3  three perturbations (the repair floor - abstaining is honest here)

   It never stores a million questions: each one is generated on the fly from
   its index, deterministically, so the run is resumable and reproducible.

   Usage:  node tools/stress-million.js [limit]     (default 1,000,000)
           state + failures: /tmp/million-state.json, /tmp/million-fails.jsonl
           final report:     tools/tests/million-report.json
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const LIMIT = Math.max(1, parseInt(process.argv[2] || "1000000", 10));
/* MSTATE/MFAILS let several processes examine disjoint index ranges of the
   same deterministic exam side by side, each with its own checkpoint. */
const STATE_FILE = process.env.MSTATE || "/tmp/million-state.json";
const FAILS_FILE = process.env.MFAILS || "/tmp/million-fails.jsonl";

/* ---------------- deterministic randomness ---------------- */
function hash32(n, salt) {
  let h = (n ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}
function rngFor(i, salt) {
  let a = hash32(i, salt) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

/* ---------------- the bot, loaded exactly as the site loads it ---------------- */
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
ctx.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
ctx.sessionStorage = ctx.localStorage;
ctx.document = { addEventListener() {}, getElementById: () => null,
  querySelectorAll: () => [], querySelector: () => null,
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
  body: { appendChild() {} } };
ctx.navigator = {}; ctx.location = { href: "", search: "" };
vm.createContext(ctx);
vm.runInContext(read("assets/js/store.js"), ctx);
const SNAPSHOT = vm.runInContext("JSON.stringify(DB.load())", ctx);
const KB = JSON.parse(read("assets/data/kb.json"));

function makeBot() {
  const g = {}; g.window = g;
  const db = JSON.parse(SNAPSHOT);
  /* The live branches only READ the snapshot, so one clone serves every
   DB.load() call - a fresh JSON round-trip per call is 27% of the exam's
   wall clock. The 45k determinism diff (old harness vs this one) proved
   the answers byte-identical. */
  let dbCache = null;
  /* The stats histogram grows with every distinct question and is re-read
   and re-written on each one - quadratic at exam scale, and nothing in an
   answer ever reads it. The fake store simply declines to keep it. */
  const mkStore = () => { const s = {}; return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { if (k === "treasure_chat_stats_v1") return; s[k] = String(v); },
    removeItem: (k) => { delete s[k]; } }; };
  g.localStorage = mkStore(); g.sessionStorage = mkStore();
  const run = (f) => new Function("window", "localStorage", "sessionStorage", "DB",
    read(f) + "\nreturn window;")(g, g.localStorage, g.sessionStorage,
    { load: () => (dbCache || (dbCache = JSON.parse(JSON.stringify(db)))), save() {} });
  run("assets/js/chat-entities.js");
  run("assets/js/chat-rag.js");
  run("assets/js/chat-core.js");
  g.TAChat.init(JSON.parse(read("assets/data/kb.json")));
  return g.TAChat;
}
const GUEST = makeBot();
const LOGGEDIN = makeBot();

/* ---------------- live data ---------------- */
const db = JSON.parse(SNAPSHOT);
function prettyDate(iso) {
  const d = new Date(iso + "T12:00:00");
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July",
    "August","September","October","November","December"];
  return days[d.getDay()] + " " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
}
const rx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const money = (n) => Number(n || 0).toLocaleString("en-NG");

/* ---------------- question cores ---------------- */
const CORES = [];
const push = (q, cls, expects, family, persona, pre) =>
  CORES.push({ q, cls, expects: expects || [], family: family || cls,
               persona: persona || "parent", pre: pre || null });

const DECOS = ["", "please ", "abeg ", "hi "];
const DECOS2 = ["", "please "];

/* fees, from the live fee table */
Object.entries(db.school.fees || {}).forEach(function (kv) {
  const cls = kv[0], amt = money(kv[1]);
  ["how much is " + cls + " fees", "how much is " + cls, cls + " fees",
   "how much do i pay for " + cls, "what is the fee for " + cls,
   "fees for " + cls, "how much is " + cls + " per term",
   "school fees for " + cls, "how much for " + cls,
   cls + " school fees", "i want to pay for " + cls,
   "what are the fees for " + cls].forEach(function (p) {
    DECOS.forEach(function (d) { push(d + p, "fact", [amt], "fees"); });
  });
});

/* transport, the three live routes */
[["adavi", "5,000"], ["okene", "6,000"], ["ageva", "3,000"]].forEach(function (t) {
  ["how much is transport to " + t[0], "bus fare to " + t[0],
   "transport fees to " + t[0], "how much is the bus to " + t[0],
   "is there transport to " + t[0], "bus to " + t[0],
   "how much does the bus to " + t[0] + " cost", "transport to " + t[0],
   "does the bus go to " + t[0],
   "how much is transport to " + t[0] + " per term"].forEach(function (p) {
    DECOS.forEach(function (d) { push(d + p, "fact", [t[1] + "|" + t[0]], "transport"); });
  });
});

/* calendar + published news events */
(db.calendar || []).forEach(function (c) { evCore(c.title, c.date); });
(db.newsEvents || []).filter(function (n) { return n.type === "event" && n.date; })
  .forEach(function (n) { evCore(n.title, n.date); });
function evCore(title, date) {
  const words = title.split(/[—–]/)[0].trim().toLowerCase();
  const dayMonth = prettyDate(date).replace(/^\w+ /, "");
  /* the exam-timetable branch answers "first term examinations" with the
     next paper (30 November), which is just as true as the calendar line */
  const exp = /examination/i.test(title)
    ? [dayMonth + "|30 november|next paper"] : [dayMonth];
  ["when is " + words, "when is the " + words, "what date is " + words,
   words + " is when", "when does " + words + " hold",
   "when will " + words + " start", "which day is " + words,
   "please when is " + words].forEach(function (p) {
    DECOS.forEach(function (d) { push(d + p, "fact", exp, "calendar"); });
  });
}

/* staff, from the live staff wall the site publishes (the 10k exam pins
   these names; db.teachers is the older demo roster) */
(db.staffWall || []).filter(function (t) { return t.class; }).forEach(function (t) {
  const first = String(t.name || "").replace(/^(mr|mrs|ms|aunty|uncle|dr)\.?\s+/i, "");
  ["who teaches " + t.class, "who is the teacher for " + t.class,
   "who is the class teacher of " + t.class,
   "which teacher takes " + t.class, "who handles " + t.class].forEach(function (p) {
    DECOS.forEach(function (d) { push(d + p, "fact", [rx(t.name)], "staff"); });
  });
  ["what does " + first + " teach", "which class does " + first + " teach"].forEach(function (p) {
    DECOS.forEach(function (d) { push(d + p, "fact", [rx(t.class)], "staff"); });
  });
});

/* the school shop */
(db.shopItems || db.shop || []).filter(function (it) {
  return !/uniform|shirt|skirt|cardigan|sandal|beret|sock|sportswear|jersey|kit/i.test(it.name);
}).forEach(function (it) {
  const m = money(it.price);
  ["how much is the " + it.name, "price of " + it.name, "how much is " + it.name,
   "what does " + it.name + " cost", it.name + " price"].forEach(function (p) {
    DECOS.forEach(function (d) { push(d + p, "fact", [m], "shop"); });
  });
});

/* every kb.json doc: the whole website, asked many ways */
(KB.docs || []).forEach(function (doc) {
  const STOP = /^(about|story|school|treasure|academy|thing|things|everything|detail|details|information|info|guide|list|page|term|first|second|third|welcome|home|contact|help|faq|questions?|answers?|general|overview|learn|learning|know|understand|needed?|where|what|when|which|who|how|does|work|works|coming|children|child|pupil|pupils|parent|parents|class|classes)$/;
  let kws = String(doc.keywords || "").toLowerCase().split(/\s+/)
    .filter(function (w) { return w.length > 4 && !STOP.test(w); });
  const title = String(doc.title || "").toLowerCase();
  if (!kws.length) kws = title.split(/[^a-z0-9]+/)
    .filter(function (w) { return w.length > 3 && !STOP.test(w); });
  if (!kws.length) return;
  const k0 = kws[0], k1 = kws[1] || k0, k2 = kws[2] || k0, k3 = kws[3] || k0;
  /* the mark is drawn from the answer the doc actually gives: its own
     text and its title. A keyword several docs share ("history" is in
     six docs) makes the question ambiguous, so tokens from the other
     docs on that topic count too - any on-topic doc is a right answer. */
  const txtToks = String(doc.text || "").toLowerCase().split(/[^a-z0-9]+/)
    .filter(function (w) { return (w.length > 4 || /^\d{4}$/.test(w)) && !STOP.test(w); });
  const titleToks = title.split(/[^a-z0-9]+/)
    .filter(function (w) { return w.length > 3 && !STOP.test(w); });
  const mark = txtToks.slice(0, 4).concat(titleToks.slice(0, 2), kws.slice(0, 3));
  kws.slice(0, 3).forEach(function (kw) {
    (KB.docs || []).forEach(function (od) {
      if (od === doc) return;
      if ((" " + String(od.keywords || "").toLowerCase() + " ").indexOf(" " + kw + " ") < 0) return;
      mark.push.apply(mark, String(od.text || "").toLowerCase().split(/[^a-z0-9]+/)
        .filter(function (w) { return (w.length > 4 || /^\d{4}$/.test(w)) && !STOP.test(w); })
        .slice(0, 3));
    });
  });
  const expects = [mark.slice(0, 14).join("|")];
  ["tell me about " + k0, "what is " + k0, title,
   "i want to know about " + k1, "information on " + k1,
   "how does " + k0 + " work", "explain " + k2, k0 + " please",
   "where can i find " + k2, "what about the " + k3,
   "what of " + k1, "i need " + k0].forEach(function (p) {
    ["", "please ", "abeg "].forEach(function (d) {
      push(d + p, "docs", expects, "docs", "newuser");
    });
  });
});

/* greetings in every language the bot knows */
["hello","hi","hey","hiya","yo","howdy","greetings","good morning","good afternoon",
 "good evening","good day","whats up","wassup","whazzup","sup","whats popping",
 "whats good","whats capping","whats happening","how are you","how are you doing",
 "hows it going","how you doing","how are you today","hope all is well",
 "how body","how now","wetin dey happen","wetin dey sup","how far",
 "sannu","barka da zuwa","ina wuni","kedu","ndewo","e kaaro","bawo ni","pele o",
 "e kaasan","e kaale","salam","salam alaikum","assalamu alaikum","bonjour","salut",
 "hola","buenas tardes","hallo","guten morgen","ciao","buonasera","bom dia","ola",
 "jambo","habari","namaste","shalom","ni hao","konnichiwa","merhaba","sawubona",
 "dumela","eku ishe","eku aro","how was your day"].forEach(function (g) {
  ["", "hey ", "good day, "].forEach(function (d) {
    push(d + g, "greet", [], "greet", pick(rngFor(CORES.length, 7), ["parent","guest","newuser"]));
  });
});

/* identity - who/what the bot is */
["who are you","what are you","who is treasure bot","what is your name",
 "are you a bot","are you a robot","are you human","are you real","are you chatgpt",
 "who made you","who created you","who built you","what can you do",
 "what can you do for me","whats your purpose","what is your purpose",
 "why are you here","how can you help me","what do you know",
 "who do you work for","are you the headmistress","are you a teacher",
 "do you work for the school","can you help me","what should i ask you",
 "are you an ai","what are you called","introduce yourself","tell me about yourself",
 "what is treasure bot"].forEach(function (q) {
  ["", "please "].forEach(function (d) { push(d + q, "identity", ["treasure bot"], "identity"); });
});

/* thanks / bye / smalltalk */
["thank you","thanks","thank you very much","thanks a lot","well done","good job",
 "i appreciate","much appreciated","imela","thank you so much"].forEach(function (q) {
  push(q, "thanks", [], "thanks");
});
["bye","goodbye","bye bye","good bye","see you","see you later","good night",
 "take care","catch you later","i am leaving","i have to go","got to go"].forEach(function (q) {
  push(q, "bye", [], "bye");
});
["how was your day","how is your day going","you are doing well","keep it up",
 "nice one","well done bot","good work","you try","can you dance","can you swim",
 "do you like music","what is your favourite food"].forEach(function (q) {
  push(q, "smalltalk", [], "smalltalk");
});

/* genuinely off-topic: must be refused, however politely asked */
["who won the world cup","what is the capital of france","sell me a car",
 "tell me a joke","i love you","you are stupid","you are a fool",
 "who is beyonce","who is ronaldo","premier league table","bitcoin price today",
 "when will it rain","what is the weather like","best phone to buy",
 "how to make cake","recipe for egusi soup","who is the president of america",
 "what is the capital of japan","translate hello to french","write me a poem",
 "who is the governor of kogi state","latest nollywood movies",
 "how do i make money online","betting tips for today","who is messi",
 "what is the price of gold","how far is the moon","what is gravity",
 "who wrote things fall apart","what is the biggest city in nigeria",
 "how many states are in nigeria","when did nigeria gain independence",
 "who is wole soyinka","what is the currency of ghana","how do i bake bread",
 "what is my future","can you predict lottery numbers","tell me my fortune",
 "who is davido","best footballer in the world","what is covid",
 "how do i lose weight","what is the time in london","who invented the phone",
 "what is the name of the nigerian anthem","which club is the best in england",
 "how do i tie a gele","what is aso ebi","who is the oba of benin",
 "what is jollof rice made of","how do i fry plantain","what is ewa agoyin",
 "who is dangote","what does ceo mean",
 "define photosynthesis","what is an adjective","solve x plus one equals two",
 "which planet is the largest","what is the speed of light","who discovered america",
 "what language do they speak in china","how do i learn french","meaning of life",
 "can you tell me news about nigeria","gold price in nigeria today",
 "dollar to naira exchange rate","how do i open a bank account",
 "which bank is the best in nigeria","what is ethereum","who is mark zuckerberg",
 "what is facebook","how do i create a whatsapp group","best data plan in nigeria",
 "how do i charge my phone faster","my phone screen is broken what do i do",
 "which car is the fastest in the world","who owns amazon","what is netflix",
 "recommend a movie for me","what is the best song ever","who is burna boy",
 "what is afrobeat","how do i become a musician","can you pray for me",
 "what is the quran about","who is jesus","when is christmas celebrated worldwide",
 "what is easter","meaning of my name","how popular is my name",
 "what is the population of nigeria","how big is lagos","is abuja the capital of nigeria",
 "what is the full meaning of una","who is tiwa savage","what is nollywood",
 "how do i download movies","which app is best for editing photos","teach me how to drive",
 "how long does it take to fly to dubai","what is visa on arrival",
 "do i need a passport to travel","how do i get to lagos from okene",
 "where can i buy cheap shoes online","what is jumia black friday",
 "how do i track my package on jumia"].forEach(function (q) {
  ["", "please "].forEach(function (d) { push(d + q, "refuse", [], "refuse"); });
});

/* portal tasks */
["how do i enter results","where do i enter results","how do i mark the register",
 "mark the register","how do i submit scores","where do i approve registrations",
 "approve a parent","verify a guardian","verification queue","set new fees",
 "update the fees","send a notification","broadcast a message","post an event",
 "post a notice","duty roster","see the notices","view the notices",
 "class register","see my class fees","how do i check my results","check my result",
 "my attendance","pay my fees","where do i pay fees","submit my payment claim",
 "my timetable","where is my homework"].forEach(function (q) {
  ["", "please "].forEach(function (d) { push(d + q, "portal", ["portal|console|transfer|bank|log in|login|tied to your own account"], "portal"); });
});

/* context: two-turn threads */
[["how much is transport to adavi", "what of okene town?", ["6,000"]],
 ["who is the headmistress", "and the founder?", ["Shaibu Sidikat Ruth"]],
 ["how much is primary 3", "also primary 4?", ["35,000"]],
 ["who teaches nursery 1", "and primary 6?", ["Primary 6"]],
 ["when is mid-term break", "and the pta meeting?", ["October"]],
 ["how much is creche", "also primary 2?", ["30,000"]],
 ["when is resumption", "and closing?", ["December"]],
 ["how much is sportswear", "and the uniform?", ["uniform|Uniform"]],
 ["where is the school", "and the phone number?", ["09063932487"]],
 ["what classes do you offer", "how about primary 6?", ["Primary 6"]],
 ["who is the bursar", "and the headmistress?", ["Salihu Nanahawa"]],
 ["when is independence day", "and mid-term?", ["October"]],
 ["how much is the bus to okene", "and to adavi?", ["5,000"]],
 ["what are your school hours", "and resumption date?", ["September|October|resumption"]],
 ["who made you", "and who is the headmistress?", ["Salihu Nanahawa"]],
 ["how do i register my child", "what of the fees?", ["30,000|25,000|35,000"]],
 ["when is graduation", "and interhouse sports?", ["Inter-House Sports|not been dated"]],
 ["how much is nursery 1", "and nursery 2?", ["25,000"]],
 ["who teaches primary 3", "what does he teach?", ["Primary 3"]],
 ["when is the excursion", "and the sports trials?", ["Inter-House Sports|not been dated"]]
].forEach(function (pair) {
  ["", "please "].forEach(function (d) {
    push(d + pair[1], "context", pair[2], "context", "parent", pair[0]);
  });
});

/* salvage: in-domain questions with an honest fallback */
[["is mathematics compulsory", ["mathematics"]],
 ["can my child bring a phone to school", ["09063932487|phone"]],
 ["is there a scholarship", ["scholarship|bursary|fee|office"]],
 ["does primary 5 do excursions", ["Primary 5|excursion"]],
 ["when is open day", ["visit|open|do not have"]],
 ["where do i buy the uniform", ["office|uniform"]],
 ["do you have a swimming pool", ["swimming|pool"]],
 ["do you have a library", ["Reading Corner|reading"]],
 ["is there a science lab", ["lab|science|guess|do not have"]],
 ["do you do french", ["french|guess|do not have|subjects"]],
 ["when is sports day", ["Inter-House Sports|sports"]],
 ["who is the bursar", ["bursary|fee"]],
 ["when is visiting day", ["visit|open|do not have"]],
 ["can i pay school fees in installments", ["installment|transfer|office"]],
 ["is there a school canteen", ["canteen|lunch|kitchen|meals"]],
 ["tell me a story", ["story|journey|2016|founded"]],
 ["best secondary school in nigeria", ["common entrance|passed|secondary"]]
].forEach(function (row) {
  ["", "please "].forEach(function (d) { push(d + row[0], "salvage", row[1], "salvage"); });
});

/* ---------------- perturbations ---------------- */
const SYMBOLS = ["£", "#", "*", "@", "&"];
const ACCENTS = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };
function words(s) { return s.split(" ").filter(Boolean); }

const PERTURB = [
  function swap(r, q) { /* two neighbouring letters crossed */
    const w = words(q); if (w.length < 1) return q;
    const i = Math.floor(r() * w.length);
    if (w[i].length < 4) return q;
    const j = 1 + Math.floor(r() * (w[i].length - 2));
    w[i] = w[i].slice(0, j - 1) + w[i].charAt(j) + w[i].charAt(j - 1) + w[i].slice(j + 1);
    return w.join(" ");
  },
  function drop(r, q) { /* a letter falls off */
    const w = words(q); if (!w.length) return q;
    const i = Math.floor(r() * w.length);
    if (w[i].length < 5) return q;
    const j = Math.floor(r() * w[i].length);
    w[i] = w[i].slice(0, j) + w[i].slice(j + 1);
    return w.join(" ");
  },
  function dbl(r, q) { /* a letter doubled */
    const w = words(q); if (!w.length) return q;
    const i = Math.floor(r() * w.length);
    if (!w[i].length) return q;
    const j = Math.floor(r() * w[i].length);
    w[i] = w[i].slice(0, j) + w[i].charAt(j) + w[i].slice(j);
    return w.join(" ");
  },
  function accent(r, q) { /* a vowel grows an accent */
    const w = words(q); if (!w.length) return q;
    const i = Math.floor(r() * w.length);
    w[i] = w[i].split("").map(function (c) {
      return (ACCENTS[c] && r() < .5) ? ACCENTS[c] : c;
    }).join("");
    return w.join(" ");
  },
  function symbol(r, q) { /* a long-press symbol lands inside a word */
    const w = words(q); if (!w.length) return q;
    const i = Math.floor(r() * w.length);
    if (w[i].length < 4) return q;
    const j = 1 + Math.floor(r() * (w[i].length - 1));
    w[i] = w[i].slice(0, j) + pick(r, SYMBOLS) + w[i].slice(j);
    return w.join(" ");
  },
  function repeat(r, q) { /* a key held down */
    const w = words(q); if (!w.length) return q;
    const i = Math.floor(r() * w.length);
    if (w[i].length < 3) return q;
    const j = Math.floor(r() * w[i].length);
    w[i] = w[i].slice(0, j) + w[i].charAt(j) + w[i].charAt(j) + w[i].charAt(j) + w[i].slice(j + 1);
    return w.join(" ");
  },
  function join(r, q) { /* a missed space */
    const w = words(q); if (w.length < 2) return q;
    const i = Math.floor(r() * (w.length - 1));
    w[i] = w[i] + w[i + 1]; w.splice(i + 1, 1);
    return w.join(" ");
  },
  function caps(r, q) { return q.toUpperCase(); },
  function exclaim(r, q) { return q + pick(r, ["!!", "?!", "...!!"]); },
  function leet(r, q) {
    return q.split("").map(function (c) {
      if (c === "o" && r() < .6) return "0";
      if (c === "e" && r() < .6) return "3";
      if (c === "a" && r() < .6) return "4";
      if (c === "i" && r() < .6) return "1";
      if (c === "s" && r() < .4) return "5";
      return c;
    }).join("");
  },
  function polite(r, q) { return pick(r, ["please ", "kindly ", "pardon me, "]) + q; },
  function greetPre(r, q) { return pick(r, ["hello ", "good morning ", "hey ", "sannu "]) + q; }
];

/* variant table: L0 clean, L1 single, L2 double, L3 triple */
const VARIANTS = [{ chain: [], level: 0 }];
PERTURB.forEach(function (p, k) { VARIANTS.push({ chain: [k], level: 1 }); });
for (let a = 0; a < PERTURB.length; a++)
  for (let b = a + 1; b < PERTURB.length; b++)
    VARIANTS.push({ chain: [a, b], level: 2 });
for (let a = 0; a < PERTURB.length; a++)
  for (let b = a + 1; b < PERTURB.length; b++)
    for (let c = b + 1; c < PERTURB.length; c++)
      VARIANTS.push({ chain: [a, b, c], level: 3 });

function applyVariant(core, i, v) {
  let q = core.q;
  if (!v.chain.length) return q;
  const r = rngFor(i, 99);
  v.chain.forEach(function (k) { q = PERTURB[k](r, q); });
  return q;
}

/* ---------------- grading ---------------- */
const SMALL = ["greet", "identity", "thanks", "bye", "smalltalk"];
function grade(cls, r, expects, txt) {
  if (cls === "refuse") {
    return (r.type === "handoff-ask" || r.type === "handoff-whatsapp" ||
            /will not guess|do not have that (written down|confident)|urgent reply|chat with (a person|the school)|talk to a person|put you through/i.test(txt))
      ? "pass" : "wrong";
  }
  if (SMALL.indexOf(cls) >= 0) {
    if (r.type === "smalltalk") {
      if (!expects.length || expects.every(function (e) { return new RegExp(e, "i").test(txt); })) return "pass";
      return "wrong";
    }
    return r.type === "handoff-ask" ? "abstain" : "wrong";
  }
  if (r.type === "answer" || r.type === "needs-login") {
    return expects.every(function (e) { return new RegExp(e, "i").test(txt); }) ? "pass" : "wrong";
  }
  if (r.type === "handoff-ask") return "abstain";
  return "dead";
}

/* ---------------- run, with checkpoint + resume ---------------- */
let state = { done: 0, counts: {}, fails: 0 };
try { state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch (e) {}
function bucket(fam, lvl, res) {
  const k = fam + "@" + lvl;
  const c = (state.counts[k] = state.counts[k] || { pass: 0, abstain: 0, wrong: 0, dead: 0, n: 0 });
  c[res] = (c[res] || 0) + 1; c.n++;
}
const TOTAL = Math.min(LIMIT, CORES.length * VARIANTS.length);
const PERSONAS = ["parent", "guest", "newuser", "parentlogin", "teacher", "headmistress", "pupil"];
const T0 = Date.now();
const START = state.done;
let failSamples = 0;
const famSamples = {};

console.log("cores: " + CORES.length + " x variants: " + VARIANTS.length +
            " => exam size: " + TOTAL + " (resuming from " + state.done + ")");

for (let i = state.done; i < TOTAL; i++) {
  const core = CORES[i % CORES.length];
  const v = VARIANTS[Math.floor(i / CORES.length) % VARIANTS.length];
  const persona = PERSONAS[i % PERSONAS.length];
  const bot = persona === "parentlogin" ? LOGGEDIN : GUEST;
  const q = applyVariant(core, i, v);

  /* topicClass is conversational memory too ("what does he teach?" needs
     it) - without this reset one question's class bleeds into the next. */
  bot.topic = null; bot.topicClass = null; bot.pending = null;
  if (core.pre) { bot.respond(core.pre); bot.pending = null; }
  /* every question starts fresh: a leftover feedback prompt from the
     previous core must not swallow the next one */
  bot.pending = null;
  const r = bot.respond(q) || {};
  const txt = String(r.html || "").replace(/<[^>]+>/g, " ")
    .replace(/&bull;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  const res = grade(core.cls, r, core.expects, txt);
  bucket(core.family, v.level, res);

  const isGap = (res !== "pass") && (v.level <= 1 || res === "wrong");
  const famQuota = famSamples[core.family] || 0;
  if (isGap && failSamples < 2000 && famQuota < 120) {
    failSamples++; famSamples[core.family] = famQuota + 1;
    fs.appendFileSync(FAILS_FILE, JSON.stringify({
      i: i, level: v.level, family: core.family, cls: core.cls, persona: persona,
      q: q, expects: core.expects, type: r.type,
      got: txt.slice(0, 140), res: res }) + "\n");
  } else if (isGap) { state.fails++; }

  if ((i + 1) % 25000 === 0) {
    state.done = i + 1;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    const secs = Math.round((Date.now() - T0) / 1000);
    const qps = Math.round((i + 1 - START) / Math.max(1, secs));
    console.log("  " + (i + 1) + "/" + TOTAL + " (" + secs + "s, " + qps + " q/s, eta " +
                Math.round((TOTAL - i - 1) / Math.max(1, qps) / 60) + " min)");
  }
}
state.done = TOTAL;
fs.writeFileSync(STATE_FILE, JSON.stringify(state));

/* ---------------- report ---------------- */
const fams = {}; const lvls = { 0: {}, 1: {}, 2: {}, 3: {} };
Object.keys(state.counts).forEach(function (k) {
  const p = k.split("@"); const c = state.counts[k];
  const f = fams[p[0]] = fams[p[0]] || { pass: 0, abstain: 0, wrong: 0, dead: 0, n: 0 };
  ["pass", "abstain", "wrong", "dead", "n"].forEach(function (m) { f[m] += c[m] || 0; });
  const L = lvls[Number(p[1])] = lvls[Number(p[1])] || { pass: 0, abstain: 0, wrong: 0, dead: 0, n: 0 };
  ["pass", "abstain", "wrong", "dead", "n"].forEach(function (m) { L[m] += c[m] || 0; });
});
const pct = (c) => c.n ? (100 * c.pass / c.n).toFixed(2) + "%" : "-";

console.log("\n===== MILLION-QUESTION EXAM =====");
console.log("asked: " + TOTAL);
[0, 1, 2, 3].forEach(function (l) {
  const L = lvls[l];
  if (L.n) console.log("L" + l + " damage: " + L.pass + "/" + L.n + " = " + pct(L) +
    "  (abstain " + (L.abstain || 0) + ", wrong " + (L.wrong || 0) + ", dead " + (L.dead || 0) + ")");
});
Object.keys(fams).sort().forEach(function (f) {
  console.log("  " + f.padEnd(10) + " " + fams[f].pass + "/" + fams[f].n + " = " + pct(fams[f]) +
    "  (wrong " + fams[f].wrong + ")");
});
fs.writeFileSync(path.join(__dirname, "million-report.json"), JSON.stringify({
  asked: TOTAL, cores: CORES.length, variants: VARIANTS.length,
  byFamily: fams, byLevel: lvls, generatedAt: new Date().toISOString() }, null, 2));
console.log("report: tools/million-report.json | failures: " + FAILS_FILE);
