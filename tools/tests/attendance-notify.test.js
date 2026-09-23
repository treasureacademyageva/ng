/* Register -> pupil notified -> headmistress can drill into one pupil.
   The chain your spec describes: the teacher records, the pupil finds out,
   the headmistress can audit any child without asking the teacher. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; console.log("ok - " + label); }
  else { fail++; console.log("FAIL - " + label + (detail ? "  [" + detail + "]" : "")); }
}

function env() {
  const mk = () => { const s = {}; return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; } }; };
  const ctx = { console: { info() {}, warn() {}, error() {} } };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = mk(); ctx.sessionStorage = mk();
  ctx.document = { addEventListener() {}, getElementById: () => null,
    querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
    body: { appendChild() {} } };
  ctx.navigator = {}; ctx.location = { href: "", search: "" };
  vm.createContext(ctx);
  vm.runInContext(read("assets/js/store.js"), ctx);
  vm.runInContext(read("assets/js/notify.js"), ctx);
  return (code) => vm.runInContext(code, ctx);
}
const run = env();

/* ---------------------------------------------------------- notifications */
run(`var d = DB.load();
 TANotify.push(d, {to:'P1', kind:'attendance', title:'Marked absent',
   body:'Monday', tone:'bad'});
 TANotify.push(d, {to:'P1', kind:'fee', title:'Fee confirmed', body:'First term'});
 TANotify.push(d, {to:'P2', kind:'attendance', title:'Marked present', body:'Monday'});
 DB.save(d);`);

ok("a notice reaches the right person",
   run("TANotify.forUser(DB.load(),'P1').length") === 2);
ok("one pupil cannot see another's notices",
   run("TANotify.forUser(DB.load(),'P2').length") === 1);
ok("unread is counted", run("TANotify.unreadCount(DB.load(),'P1')") === 2);
ok("newest notice comes first",
   run("TANotify.forUser(DB.load(),'P1')[0].title") === "Fee confirmed");
ok("marking read clears the count",
   run(`var d2=DB.load(); TANotify.markRead(d2,'P1'); DB.save(d2);
        TANotify.unreadCount(DB.load(),'P1')`) === 0);
ok("marking read does not touch anyone else",
   run("TANotify.unreadCount(DB.load(),'P2')") === 1);

/* An inbox, not an archive - it must not grow without limit. */
run(`var d3=DB.load();
 for (var i=0;i<80;i++) TANotify.push(d3,{to:'P9',title:'n'+i,body:'x'});
 DB.save(d3);`);
ok("an inbox is capped", run("TANotify.forUser(DB.load(),'P9').length") <= 60,
   run("String(TANotify.forUser(DB.load(),'P9').length)"));
ok("capping keeps the newest",
   run("TANotify.forUser(DB.load(),'P9')[0].title") === "n79");

/* --------------------------------------------------------------- register */
const teacher = read("portal/teacher.html");
ok("register is sorted alphabetically",
   /localeCompare\(String\(b\.name/.test(teacher));
ok("register excludes unapproved pupils",
   /p\.verified!==false&&p\.status!=="rejected"/.test(teacher));
ok("saving the register notifies every pupil",
   /TANotify\.push/.test(teacher) && /kind:"attendance"/.test(teacher));
ok("the notice says who recorded it", /recorded by/.test(teacher));
ok("present, late and absent each get their own wording",
   /Marked present/.test(teacher) && /Marked late/.test(teacher) &&
   /Marked absent/.test(teacher));

/* ------------------------------------------------------------ drill-down */
const admin = read("portal/admin.html");
ok("headmistress can open one pupil's record", /function attPupil/.test(admin));
ok("pupil names in the register are clickable", /onclick="attPupil/.test(admin));
ok("the drill-down shows a percentage", /% present/.test(admin));
ok("the drill-down lists every recorded day",
   /rows\.map\(a=>/.test(admin) && /prettyDate\(a\.date\)/.test(admin));

/* ---------------------------------------------------------------- wiring */
["portal/admin.html", "portal/teacher.html", "portal/pupil.html",
 "developer.html"].forEach(function (f) {
  ok("notify.js loaded by " + f, read(f).indexOf("notify.js") >= 0);
});
const pupil = read("portal/pupil.html");
ok("pupil dashboard has a notifications panel", /notifyZone/.test(pupil));
ok("pupil notifications render on first load",
   /__safe\(\(\)=>\{ renderNotify\(\); \}\)/.test(pupil),
   "must be in the boot sequence, not only the view router");
ok("pupil can mark them read", /function clearNotify/.test(pupil));

console.log("\n==== ATTENDANCE-NOTIFY: " + pass + " passed, " + fail + " failed ====");
process.exit(fail ? 1 : 0);
