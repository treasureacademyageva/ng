/* Treasure Bot - coverage.
   151 questions a real parent, job seeker or visitor might type about the
   school, its classes, staff and academics. Every one must be answered from
   the site's own content; none may dead-end. This is the suite that proves
   the rules generalise instead of fitting a handful of examples. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; } else { fail++; console.log("FAIL - " + label +
    (detail ? "\n        " + detail : "")); }
}

/* A DB snapshot straight from store.js, so the answers are tested against the
   school's real data rather than a convenient fixture. */
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

function bot() {
  const mk = () => { const s = {}; return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; } }; };
  const g = {};
  g.window = g; g.localStorage = mk(); g.sessionStorage = mk();
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

const C = bot();
const questions = JSON.parse(read("tools/tests/fixtures-about-questions.json"));

let answered = 0, deadEnds = 0, wrong = 0;
questions.forEach(function (item) {
  C.topic = null; C.pending = null;
  const r = C.respond(item.q) || {};
  const txt = String(r.html || "").replace(/<[^>]+>/g, " ")
                                  .replace(/\s+/g, " ").trim();

  /* Some questions SHOULD be refused: off-topic, or asking the bot to do a
     child's homework. A handoff is the right answer to those. */
  if (item.shouldRefuse) {
    ok('refuses: "' + item.q + '"',
       r.type === "handoff-ask" || /internal to the school|not something I can/i.test(txt),
       r.type);
    answered++;
    return;
  }
  if (r.type === "handoff-ask") {
    deadEnds++;
    ok('answers: "' + item.q + '"', false, "dead-ended instead of answering");
    return;
  }
  if (item.expect && !new RegExp(item.expect, "i").test(txt)) {
    wrong++;
    ok('correct content: "' + item.q + '"', false, txt.slice(0, 90));
    return;
  }
  answered++;
  pass++;
});

/* Nonsense must still be refused - answering everything would mean the
   confidence bar had stopped working. */
[["who won the world cup"], ["what is the capital of France"], ["sell me a car"]]
  .forEach(function (t) {
    C.topic = null; C.pending = null;
    const r = C.respond(t[0]) || {};
    ok('refuses off-topic: "' + t[0] + '"', r.type === "handoff-ask", r.type);
  });

/* Retired demo staff must never reach a parent. */
C.topic = null; C.pending = null;
const staffAnswers = ["who teaches creche", "who teaches primary 4",
                      "tell me about your staff"].map(function (q) {
  C.topic = null; C.pending = null;
  return String(C.respond(q).html);
}).join(" ");
ok("never names a (demo) teacher", !/\(demo\)/i.test(staffAnswers),
   staffAnswers.slice(0, 80));

console.log("\ncoverage: " + answered + "/" + questions.length +
            " answered, " + deadEnds + " dead ends, " + wrong + " wrong");
console.log("==== ASK-COVERAGE: " + pass + " passed, " + fail + " failed ====");
process.exit(fail ? 1 : 0);
