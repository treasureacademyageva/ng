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
["assets/js/chat-rag.js", "assets/js/chat-core.js", "assets/js/chat-ui.js",
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
  const run = (f) => new Function("window", "localStorage", "sessionStorage",
    read(f) + "\nreturn window;")(g, g.localStorage, g.sessionStorage);
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
ok("answers from the knowledge base", ans.type === "answer" && /30000/.test(ans.html));
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
ok("admits when it does not know",
   unknown.type === "handoff-ask" && /not find a confident answer/i.test(unknown.html));

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
a.TAChat.respond("do you have a swimming pool"); a.TAChat.respond("it can wait");
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

/* ------------------------------------------------------------- wiring -- */
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
const wired = pages.filter((f) => read(f).indexOf("chat-rag.js") >= 0);
ok("chatbot wired into every public page", wired.length >= pages.length - 1,
   wired.length + "/" + pages.length);

const sw = read("sw.js");
["chat-rag.js", "chat-core.js", "chat-ui.js", "assets/data/kb.json"]
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
