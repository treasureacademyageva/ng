/* Treasure Support AI — retrieval, conversation flow, history and analytics.
   Runs the real engine files, not a reimplementation. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; console.log("ok - " + label); }
  else { fail++; console.log("FAIL - " + label + (detail ? "  [" + detail + "]" : "")); }
}
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

/* ------------------------------------------------------------ files ---- */
["assets/js/chat-entities.js",
 "assets/js/chat-rag.js", "assets/js/chat-core.js", "assets/js/chat-ui.js",
 "assets/data/kb.json", "tools/build-kb.py", "ai/main.py",
 "ai/requirements.txt", "docs/CHATBOT-ARCHITECTURE.md"].forEach(function (f) {
  ok("exists: " + f, exists(f));
});

/* The old keyword bot must be gone, not merely bypassed. */
const site = read("assets/js/site.js");
ok("keyword Chatbot removed", !/const Chatbot\s*=\s*\{/.test(site));
ok("new widget booted", /TAChatUI/.test(site));

/* ------------------------------------------------------- environment --- */
function harness() {
  const mk = () => { const s = {}; return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; },
    _s: s }; };
  const g = {};
  g.window = g; g.localStorage = mk(); g.sessionStorage = mk();
  /* store.js declares DB with const, so in a browser it is a script-scope
     binding the chat modules see directly. Recreate that here. */
  g.__db = { school: {}, calendar: [], lostfound: [], uniform: [], exams: [],
             ptaMeetings: [], teachers: [] };
  const run = (f) => new Function("window", "localStorage", "sessionStorage", "DB",
    read(f) + "\nreturn window;")(g, g.localStorage, g.sessionStorage,
    { load: () => g.__db, save: (d) => { g.__db = d; } });
  run("assets/js/chat-entities.js");
  run("assets/js/chat-rag.js"); run("assets/js/chat-core.js");
  const kb = JSON.parse(read("assets/data/kb.json"));
  g.TAChat.init(kb);
  return g;
}

/* ------------------------------------------------- knowledge base ------ */
const kb = JSON.parse(read("assets/data/kb.json"));
ok("kb has documents", kb.docs && kb.docs.length >= 30, "count=" + (kb.docs || []).length);
ok("kb carries real fees", JSON.stringify(kb).includes("30000"));
ok("kb carries the exam timetable", /2026-11-30/.test(JSON.stringify(kb)));
ok("kb carries transport fares", /Adavi/.test(JSON.stringify(kb)));

/* Site chrome must not leak into answers — it poisons every passage. */
const kbText = kb.docs.map((d) => d.text).join(" ");
ok("no skip-link chrome in kb", !/skip to (main )?content/i.test(kbText));
const pageText = kb.docs.filter((d) => d.kind === "page").map((d) => d.text).join(" ");
ok("no repeated address line in scraped pages",
   (pageText.match(/Ageva, Okene, Kogi State/g) || []).length === 0,
   "the address belongs in the location fact, not on every page");

/* Personal answers must be marked so the bot asks for a login. */
ok("private topics flagged needs_login", kb.docs.some((d) => d.needs_login));

/* --------------------------------------------------------- retrieval --- */
const g = harness();
const R = g.TARag;
ok("index built", R.ready && R.docs.length === kb.docs.length);

[["how much is school fees for primary 4", "fee"],
 ["what time does school close", "hour"],
 ["when is the exam", "exam"],
 ["how much be bus to okene town", "transport"],
 ["I forgot my password", "password"],
 ["who is the headmistress", "leadership"]].forEach(function (pair) {
  const a = R.answer(pair[0]);
  ok('confident: "' + pair[0] + '"', a.band === "high",
     a.band + " " + a.confidence.toFixed(2) + " -> " + (a.title || "none"));
});

/* Nigerian English must reach the right page. */
const pidgin = R.answer("wetin be the fees for my pikin");
ok("understands Nigerian English", pidgin.band !== "low" && /fee/i.test(pidgin.title || ""),
   (pidgin.title || "none"));

/* Refusing to answer is a feature. */
["what is the capital of France", "sell me a car", "who won the world cup"]
  .forEach(function (q) {
    ok('declines off-topic: "' + q + '"', R.answer(q).band === "low");
  });

/* ------------------------------------------------------------- flow ---- */
const C = g.TAChat;

C.clearHistory(); C.resetStats();
const greet = C.respond("hello");
ok("greets and introduces itself",
   greet.type === "smalltalk" && /Treasure/.test(greet.html) && greet.chips.length > 0);

const ans = C.respond("how much are the school fees");
/* Without a DB this harness has no live fee table, so the school's own FAQ
   answer wins - which is the right outcome. Assert it answered about fees,
   not one specific figure. */
ok("answers from the knowledge base",
   ans.type === "answer" && /fee|30,?000/i.test(ans.html),
   ans.html.replace(/<[^>]+>/g, " ").slice(0, 70));
ok("answer cites its source", !!ans.source);
ok("answer invites feedback", ans.feedback === true);

const good = C.recordFeedback(true);
ok("resolved ends the loop", good.type === "resolved");

C.respond("what time does school close");
const bad = C.recordFeedback(false);
ok("not-resolved asks urgency first",
   bad.type === "handoff-ask" && /right now|wait/i.test(bad.html));
ok("urgency offers both channels", bad.chips.length === 2);

const wa = C.respond("I need it now");
ok("urgent -> WhatsApp agent",
   wa.type === "handoff-whatsapp" && /09063932487/.test(wa.html));
ok("WhatsApp deep-link carries the question",
   wa.action && /wa\.me\/234/.test(wa.action.href));

C.respond("do you run saturday swimming lessons");
const ticket = C.respond("it can wait");
ok("can wait -> contact form ticket",
   ticket.type === "handoff-ticket" && /contact/i.test(ticket.action.href));

const unknown = C.respond("what colour is the school cat");
/* Either honest route is correct: the human handoff, or the WH-aware
   salvage that says plainly it is not written down and offers the
   questions it CAN answer of that shape. What is pinned is that it
   never pretends to know. */
ok("admits when it does not know",
   unknown.type === "handoff-ask" && /not find a confident answer/i.test(unknown.html) ||
   (unknown.salvaged && /do not have that written down|will not guess/i.test(unknown.html)));

const priv = C.respond("show me my results");
ok("personal data requires login", priv.type === "needs-login");
ok("offers to open the login popup", priv.action && priv.action.kind === "login");

/* A stray chip click must not be recorded as a knowledge gap. */
C.resetStats();
C.respond("it can wait"); C.respond("yes");
ok("stray replies are not logged as gaps", C.stats().gaps.length === 0,
   JSON.stringify(C.stats().gaps));

/* ---------------------------------------------------------- history ---- */
const h = harness();
h.TAChat.push("user", "how much are fees");
ok("guest history in sessionStorage",
   !!h.sessionStorage.getItem("treasure_chat_guest_v1"));
ok("guest history NOT in localStorage",
   Object.keys(h.localStorage._s).filter((k) => k.indexOf("chat_user") >= 0).length === 0);

h.localStorage.setItem("treasure_session_v1",
  JSON.stringify({ role: "pupil", refId: "TA/2023/001", name: "Adaeze" }));
ok("guest thread merges on login", h.TAChat.syncGuestToAccount() === true);
ok("thread now saved to the account",
   Object.keys(h.localStorage._s).some((k) => k.indexOf("chat_user") >= 0));
ok("guest slot cleared after sync",
   h.sessionStorage.getItem("treasure_chat_guest_v1") === null);

/* -------------------------------------------------------- analytics ---- */
const a = harness();
a.TAChat.resetStats();
a.TAChat.respond("how much are fees"); a.TAChat.recordFeedback(true);
a.TAChat.respond("who won the world cup"); a.TAChat.respond("it can wait");
a.TAChat.respond("what colour is the moon"); a.TAChat.respond("I need it now");
const s = a.TAChat.stats();
ok("counts questions", s.totalQuestions === 3, String(s.totalQuestions));
ok("computes resolution rate", s.resolutionRate === 33, String(s.resolutionRate));
ok("counts answered separately", s.answered === 1, String(s.answered));
ok("computes satisfaction", s.satisfaction === 100, String(s.satisfaction));
ok("splits the two handoff channels",
   s.handoffWhatsapp === 1 && s.handoffTicket === 1);
ok("records what it could not answer", s.gaps.length === 2, String(s.gaps.length));
ok("tracks most asked questions", s.topQuestions.length >= 3);
ok("tracks daily volume", Object.keys(s.daily).length >= 1);


/* ------------------------------------------------ entities + never-dead-end */

const E = g.TAEntities;
ok("entity module present", !!E);

/* Synonyms are the whole point: a parent will not type the word we stored. */
[["my child's cardigan is missing", "cardigan"],
 ["my son lost his sweater", "cardigan"],
 ["i cant find my daughter jumper", "cardigan"],
 ["anyone found a water bottle", "bottle"],
 ["his lunch box is missing", "lunchbox"]].forEach(function (pair) {
  ok('reads the item in: "' + pair[0] + '"', E.read(pair[0]).thing === pair[1],
     String(E.read(pair[0]).thing));
});

[["how much is p3 fees", "primary 3"],
 ["fees for primary six", "primary 6"],
 ["what does basic 1 cost", "primary 1"]].forEach(function (pair) {
  ok('reads the class in: "' + pair[0] + '"', E.read(pair[0]).klass === pair[1],
     String(E.read(pair[0]).klass));
});

/* Intent must separate a job hunt from a curriculum question. */
["i want to work as a teacher here", "are you hiring", "do you need teachers",
 "send my cv", "can i work there"].forEach(function (q) {
  ok('employment intent: "' + q + '"', E.read(q).intent === "employment",
     String(E.read(q).intent));
});
["do you teach french", "what subjects do you teach", "who teaches primary 3"]
  .forEach(function (q) {
    ok('NOT employment: "' + q + '"', E.read(q).intent !== "employment",
       String(E.read(q).intent));
  });

/* Lost property answers about the named item, and never dead-ends. */
const L = harness();
L.__db = {
  school: {}, uniform: [{ name: "School Cardigan", price: 6000 }],
  lostfound: [{ item: "Blue cardigan (age 5-6)", desc: "Found on the ground.",
                date: "2026-09-12", claimed: false },
              { item: "Green lunch box", date: "2026-09-10", claimed: false }] };
const lostHit = L.TAChat.respond("my son lost his sweater").html;
ok("synonym finds the stored cardigan", /Blue cardigan/.test(lostHit));

const lostMiss = L.TAChat.respond("i cannot find my daughter water bottle").html;
ok("says the named item is NOT there", /No <b>bottle<\/b> has been handed in/.test(lostMiss));
ok("still lists what IS there", /Blue cardigan/.test(lostMiss) && /Green lunch box/.test(lostMiss));
ok("gives a next step, not a dead end", /class teacher|office/i.test(lostMiss));

/* A price question about the same word must NOT hit lost property. */
ok("cardigan price still reaches the price list",
   /6,000/.test(L.TAChat.respond("how much is the school cardigan").html));

/* The new audiences the site exists for. */
const A = harness();
[["i want to work as a teacher here", /Careers|character first/i],
 ["who are your partners", /headmistress|office/i],
 ["i want to bring my son to your school", /Admissions are open|Creche/i],
 ["can i come and see the school", /welcome to visit|Ageva/i],
 ["why should i choose treasure", /Small classes|2015/i],
 ["is my child safe there", /supervised|named guardian/i]].forEach(function (pair) {
  const html = A.TAChat.respond(pair[0]).html;
  ok('answers the visitor: "' + pair[0] + '"', pair[1].test(html),
     html.replace(/<[^>]+>/g, " ").slice(0, 70));
});

/* Partners are not invented - we hold no such list. */
const partners = A.TAChat.respond("who are your partners").html;
ok("does not invent partner names",
   /do not have a published list|handled personally/i.test(partners));

/* The universal fallback: unknown questions still leave with something. */
const F = harness();
const noIdea = F.TAChat.respond("what is your policy on mobile phones");
ok("unknown question is not a bare shrug",
   noIdea.type === "answer" ? !!noIdea.salvaged : noIdea.type === "handoff-ask");
ok("fallback admits it is not certain",
   /do not have that written down|not find a confident/i.test(noIdea.html));
ok("fallback still offers a route",
   /ask me another way|talk to someone|right now|wait/i.test(noIdea.html));

/* The name. */
ok("bot is called Treasure Bot", /Treasure Bot/.test(read("assets/js/chat-ui.js")));


/* ------------------------------------------------ conversation memory ---- */

/* "How much is Primary 3?" then "and Primary 4?" is one conversation.
   Without memory the follow-up returns a generic page, which is the single
   most obvious way a bot gives itself away. */
const M = harness();
M.__db = { school: { fees: { "Creche": 30000, "Nursery 2": 25000,
                             "Primary 3": 30000, "Primary 4": 35000 } },
           lostfound: [], calendar: [], uniform: [], exams: [], ptaMeetings: [],
           teachers: [] };
ok("answers the first fee question",
   /30,000/.test(M.TAChat.respond("how much is primary 3").html));
ok('follow-up "and primary 4?" keeps the topic',
   /35,000/.test(M.TAChat.respond("and primary 4?").html));
ok('follow-up "what about nursery 2" keeps the topic',
   /25,000/.test(M.TAChat.respond("what about nursery 2").html));
ok('bare entity "creche?" keeps the topic',
   /30,000/.test(M.TAChat.respond("creche?").html));

/* Memory must not bleed across a topic change. */
const M2 = harness();
M2.__db = { school: { fees: { "Primary 3": 30000 } },
            lostfound: [{ item: "Blue cardigan", date: "2026-09-12", claimed: false }],
            calendar: [], uniform: [], exams: [], ptaMeetings: [], teachers: [] };
M2.TAChat.respond("how much is primary 3");
const switched = M2.TAChat.respond("my son lost his cardigan").html;
ok("a new topic is not contaminated by the last one",
   /Blue cardigan/.test(switched) && !/30,000/.test(switched));

/* Courtesy and greetings must survive the context layer untouched. */
ok("greeting still works after a topic",
   /Treasure Bot/.test(M2.TAChat.respond("hello").html));
ok("thanks still works after a topic",
   /welcome/i.test(M2.TAChat.respond("thank you").html));

/* Suggested questions follow the conversation. */
const S = harness();
S.__db = { school: { fees: { "Primary 3": 30000 } }, lostfound: [], calendar: [],
           uniform: [], exams: [], ptaMeetings: [], teachers: [] };
const startChips = S.TAChat.suggestions().join(" ");
S.TAChat.respond("how much is primary 3");
const feeChips = S.TAChat.suggestions().join(" ");
ok("suggestions change with the topic", startChips !== feeChips, feeChips);
ok("fee suggestions are about paying", /pay|discount|deadline/i.test(feeChips));

/* Anything the bot offers must be answerable - a chip that leads nowhere is
   worse than no chip. */
const chipQs = S.TAChat.suggestions();
chipQs.forEach(function (c) {
  const r = S.TAChat.respond(c);
  ok('its own suggestion is answerable: "' + c + '"',
     r && (r.type === "answer" || r.type === "needs-login" || r.type === "smalltalk"),
     r && r.type);
});

/* The sibling discount is hedged exactly as the site hedges it - "may apply,
   ask the office" - never stated as a fixed promise. */
const sib = S.TAChat.respond("is there a sibling discount").html;
ok("sibling discount is honest, not a promise",
   /may apply/i.test(sib) && /ask the (school )?office/i.test(sib));


/* -------------------------------------------- about domain + separation --- */

/* Rule 1: intent is resolved before retrieval, and each domain owns its own
   words without stealing from the others. */
const AB = harness();
AB.__db = {
  school: { fees: { "Primary 3": 30000, "Primary 4": 35000 } },
  lostfound: [{ item: "Blue cardigan", date: "2026-09-12", claimed: false }],
  uniform: [{ name: "School Cardigan", price: 6000 }],
  calendar: [], exams: [{ date: "2026-11-30", time: "8:00 AM",
                          subject: "Mathematics", classes: "P1-6" }],
  ptaMeetings: [], teachers: [{ name: "A", subjects: ["Mathematics"] }],
  pupils: [{}, {}], staffWall: [{ subjects: ["Computer Science", "Phonics"] }],
  classPages: [], results: [], timetable: []
};

/* Every one of these must land in a DIFFERENT place. This is the separation
   the whole design depends on. */
[["how much is primary 3", /30,000/, "fee"],
 ["my son lost his cardigan", /Blue cardigan/, "lost property"],
 ["how much is the school cardigan", /6,000/, "uniform price"],
 ["who founded the school", /Shaibu Sidikat Ruth/, "founder"],
 ["what is your mission", /future leader/i, "mission"],
 ["tell me about your history", /2018|2021|2024/, "history"],
 ["do you have a library", /library/i, "facilities"],
 ["what is your pass rate", /100%|Common Entrance/i, "performance"],
 ["how many teachers do you have", /teaching staff|small/i, "staff count"],
 ["what subjects do you teach", /Mathematics/, "curriculum"],
 ["when is the next exam", /Mathematics/, "exam"]].forEach(function (t) {
  const html = AB.TAChat.respond(t[0]).html;
  ok('routes to ' + t[2] + ': "' + t[0] + '"', t[1].test(html),
     html.replace(/<[^>]+>/g, " ").slice(0, 60));
});

/* Rule 3: a named subject gets a yes about THAT subject. */
ok("confirms a subject that is taught",
   /Yes/.test(AB.TAChat.respond("do you teach computer").html) &&
   /Computer Science/.test(AB.TAChat.respond("do you teach computer").html));

/* Rule 4: a clean no, then what IS true. */
const fr = AB.TAChat.respond("do you teach french").html;
ok("refuses a subject that is not taught", /not one of the subjects/i.test(fr));
ok("still lists the real subjects after saying no", /Mathematics/.test(fr));

const pool = AB.TAChat.respond("do you have a swimming pool").html;
ok("says plainly there is no pool", /no <b>swimming pool<\/b>|does not offer swimming/i.test(pool));
ok("follows the no with what the school does have", /computer room|library/i.test(pool));

const boarding = AB.TAChat.respond("is it a boarding school").html;
ok("answers boarding honestly", /day school/i.test(boarding) && /no boarding/i.test(boarding));

/* Rule 5: counts come from live data, not a hardcoded number. */
const counts = AB.TAChat.respond("how many teachers do you have").html;
ok("staff count reads live data", /1<\/b> teaching staff|2<\/b> pupils/.test(counts),
   counts.replace(/<[^>]+>/g, " ").slice(0, 60));

/* Rule 8: nothing invented. The About answers must not claim facilities or
   figures that are not on the site. */
const facilities = AB.TAChat.respond("what facilities do you have").html;
ok("does not invent a swimming pool", !/has a <b>swimming/i.test(facilities));
ok("does not invent boarding", !/boarding (is )?available/i.test(facilities));

/* Chunking: passages must start at a sentence, never mid-word. A broken
   fragment like "est pride - an online portal" reads like a machine. */
const chunks = kb.docs.filter((d) => /#\d+$/.test(d.id));
const broken = chunks.filter((d) => /^[a-z]{1,4}\s/.test(d.text));
ok("page chunks start cleanly, not mid-word", broken.length === 0,
   broken.slice(0, 2).map((d) => d.id + ": " + d.text.slice(0, 30)).join(" | "));


/* Rule 5 again: pages painted by JavaScript have no prose to scrape, so the
   answer must come from the database instead of falling through. */
const TS = harness();
TS.__db = { school: {}, lostfound: [], calendar: [], uniform: [], exams: [],
            ptaMeetings: [], teachers: [], pupils: [], classPages: [],
            results: [], timetable: [], staffWall: [],
            testimonials: [{ name: "Mrs. Okafor", role: "Parent",
                             text: "Her reading improved so much in one term.",
                             approved: true }] };
const tHtml = TS.TAChat.respond("what do parents say about the school").html;
ok("reads testimonials from live data", /Mrs\. Okafor|reading improved/.test(tHtml));
ok("quote marks render, not HTML entities", !/&ldquo;|&rdquo;|&mdash;/.test(tHtml));

/* Empty state must still be useful rather than silent. */
const TS2 = harness();
const emptyT = TS2.TAChat.respond("are there any parent reviews").html;
ok("empty testimonials still explains the route",
   /Testimonials/.test(emptyT) && /submit|approve/i.test(emptyT));

/* "facilities" must match as a stem - \bfacilit\b never fires. */
ok("the word facilities is recognised",
   E.read("what facilities do you have").intent === "facilities");

/* ------------------------------------------------------------- wiring -- */
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
const wired = pages.filter((f) => read(f).indexOf("chat-rag.js") >= 0);
const wiredEnt = pages.filter((f) => read(f).indexOf("chat-entities.js") >= 0);
ok("entities wired into every page with the bot", wiredEnt.length === wired.length,
   wiredEnt.length + "/" + wired.length);
ok("chatbot wired into every public page", wired.length >= pages.length - 1,
   wired.length + "/" + pages.length);

const sw = read("sw.js");
["chat-entities.js", "chat-rag.js", "chat-core.js", "chat-ui.js", "assets/data/kb.json"]
  .forEach(function (f) { ok("service worker caches " + f, sw.indexOf(f) >= 0); });

const dev = read("developer.html");
["dvChatStats", "dvChatDaily", "dvChatTop", "dvChatGaps", "dvChatExport"]
  .forEach(function (id) { ok("developer dashboard has #" + id, dev.indexOf(id) >= 0); });

/* --------------------------------------------------------- backend ----- */
const api = read("ai/main.py");
["/ask", "/feedback", "/handoff", "/history", "/analytics", "/reindex", "/health"]
  .forEach(function (r) { ok("backend exposes " + r, api.indexOf('"' + r) >= 0); });
ok("backend degrades without a model", /except Exception:\s*\n\s*self\._build_tfidf\(\)/.test(api));
ok("backend degrades without postgres", /sqlite3/.test(api));
ok("backend degrades without an LLM", /if not LLM_KEY:\s*\n\s*return None/.test(api));
ok("backend never hardcodes a secret", !/sk-[A-Za-z0-9]{20}/.test(api));
ok("history takes account as a query param", /def history\(account: str = ""\)/.test(api));

console.log("\n==== CHATBOT: " + pass + " passed, " + fail + " failed ====");
process.exit(fail ? 1 : 0);
