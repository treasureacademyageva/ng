/* Treasure Bot - the 10,000-question stress exam.
   tools/gen-stress.py builds the fixture; this suite runs every question
   through the real engine and scores it by class. The questions are
   deliberately NOT the training set: they are phrasings, typos, pidgin and
   personas the bot has never seen, which is what makes this a test of the
   rules rather than of example matching. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0, hardFail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; } else { fail++; if (fail <= 40)
    console.log("FAIL - " + label + (detail ? "\n        " + detail : "")); }
}
/* The contract is the accuracy budget, not any single question: a handful
   of one-edit-away-of-two-words typos ("thre" -> three or threw?) must
   abstain, and that abstention is correct behaviour, not a failure. */
function gate(label, cond, detail) {
  if (cond) { pass++; } else { hardFail++; fail++;
    console.log("GATE FAIL - " + label + (detail ? "\n        " + detail : "")); }
}

const vm = require("vm");
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

function bot(session) {
  const mk = () => { const s = {}; return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; } }; };
  const g = {};
  g.window = g; g.localStorage = mk(); g.sessionStorage = mk();
  if (session) g.localStorage.setItem("treasure_session_v1", JSON.stringify(session));
  const db = JSON.parse(SNAPSHOT);
  const run = (f) => new Function("window", "localStorage", "sessionStorage", "DB",
    read(f) + "\nreturn window;")(g, g.localStorage, g.sessionStorage,
    { load: () => JSON.parse(JSON.stringify(db)), save() {} });
  run("assets/js/chat-entities.js");
  run("assets/js/chat-rag.js");
  run("assets/js/chat-core.js");
  g.TAChat.init(JSON.parse(read("assets/data/kb.json")));
  return g.TAChat;
}

const GUEST = bot();
const LOGGEDIN = bot({ name: "Test Parent", phone: "+2348030000001" });
/* The questions are GENERATED, not committed: the exam is built by
   tools/gen-stress.py at test time so the fixture can never quietly
   become a training set. Deterministic seed - same exam every run. */
let questions;
try {
  questions = JSON.parse(read("tools/tests/fixtures-stress-questions.json"));
} catch (e) {
  try {
    require("child_process").execSync(
      "python3 tools/gen-stress.py", { cwd: ROOT, stdio: "pipe" });
    questions = JSON.parse(read("tools/tests/fixtures-stress-questions.json"));
  } catch (e2) {
    questions = [];
    console.log("FAIL - could not build the stress fixture (python3 needed)");
    process.exit(1);
  }
}
if (!questions.length || questions.length !== 10000) {
  console.log("FAIL - stress fixture must hold exactly 10000 questions, got " +
              questions.length);
  process.exit(1);
}

const byClass = {}, byDomain = {}, byPersona = {};
function bucket(map, key, good) {
  if (!map[key]) map[key] = { n: 0, good: 0 };
  map[key].n++; if (good) map[key].good++;
}

const GREET_OK = /treasure bot|not much|very well|hello/i;
const THANKS_OK = /welcome|anything else/i;
const BYE_OK = /goodbye|welcome back|thank you for visiting/i;
const SMALL_OK = /no problem|what would you like|goodbye/i;

questions.forEach(function (item) {
  const C = item.persona === "parentlogin" ? LOGGEDIN : GUEST;
  C.topic = null; C.pending = null;
  if (item.pre) { C.respond(item.pre); C.pending = null; }
  const r = C.respond(item.q) || {};
  const txt = String(r.html || "").replace(/<[^>]+>/g, " ")
                                 .replace(/&bull;/g, " ")
                                 .replace(/&amp;/g, "&")
                                 .replace(/\s+/g, " ").trim();
  let good = false;
  const cls = item.cls;

  if (cls === "refuse") {
    good = r.type === "handoff-ask";
  } else if (cls === "greet") {
    good = r.type === "smalltalk" && GREET_OK.test(txt) && txt.length > 20;
  } else if (cls === "thanks") {
    good = r.type === "smalltalk" && THANKS_OK.test(txt);
  } else if (cls === "bye") {
    good = r.type === "smalltalk" && BYE_OK.test(txt);
  } else if (cls === "smalltalk") {
    good = r.type === "smalltalk" && SMALL_OK.test(txt);
  } else if (cls === "identity") {
    good = r.type === "smalltalk" && /treasure bot/i.test(txt);
  } else if (cls === "salvage") {
    good = r.type === "answer" &&
      (item.expect || []).every((e) => new RegExp(e, "i").test(txt));
  } else { /* fact, portal, context */
    good = (r.type === "answer" || r.type === "needs-login") &&
      (item.expect || []).every((e) => new RegExp(e, "i").test(txt));
  }

  ok('"' + item.q.slice(0, 70) + '"', good,
     "[" + r.type + "] " + txt.slice(0, 90));
  bucket(byClass, cls, good);
  bucket(byDomain, item.domain || "-", good);
  bucket(byPersona, item.persona || "-", good);
});

function rate(m) { return Object.keys(m).sort().map(function (k) {
  return k + " " + m[k].good + "/" + m[k].n +
    " (" + (100 * m[k].good / m[k].n).toFixed(1) + "%)";
}).join("  |  "); }

console.log("\nby class:   " + rate(byClass));
console.log("by domain:  " + rate(byDomain));
console.log("by persona: " + rate(byPersona));
const totalGood = Object.keys(byClass).reduce((a, k) => a + byClass[k].good, 0);
const total = questions.length;
console.log("\nstress: " + totalGood + "/" + total + " (" +
  (100 * totalGood / total).toFixed(2) + "%)");

const factRate = byClass.fact.good / byClass.fact.n;
const greetRate = byClass.greet.good / byClass.greet.n;
const refuseRate = byClass.refuse.good / byClass.refuse.n;
gate("overall accuracy >= 98%", totalGood / total >= 0.98,
   (100 * totalGood / total).toFixed(2) + "%");
gate("fact accuracy >= 97%", factRate >= 0.97, (100 * factRate).toFixed(1) + "%");
gate("greeting accuracy >= 97%", greetRate >= 0.97, (100 * greetRate).toFixed(1) + "%");
gate("refusal accuracy >= 95%", refuseRate >= 0.95, (100 * refuseRate).toFixed(1) + "%");

console.log("==== STRESS: " + pass + " passed, " + fail + " wrong (" +
  hardFail + " gate failures) ====");
process.exit(hardFail ? 1 : 0);
