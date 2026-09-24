/* Registration -> headmistress approval -> one-time code -> password.
   The gate between "someone filled a form" and "someone can read a child's
   records". Every step is asserted, including the ways in that must stay shut. */
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
  vm.runInContext(read("assets/js/verify.js"), ctx);
  return (code) => vm.runInContext(code, ctx);
}

const run = env();

/* A fresh registration arrives unapproved. */
run(`const d=DB.load();
 d.pupils.push({id:'PT1',adm:'TA/2026/901',name:'Test Child',class:'Primary 1',
   parent:'Mrs. Test', phone:'0803 111 2222', phone2:'0805 333 4444',
   verified:false, registeredAt:new Date().toISOString()});
 DB.save(d);`);

ok("new registration lands in the approval queue", run("TAVerify.pending().length") === 1);
ok("status reads pending", run("TAVerify.statusOf(DB.load().pupils.find(p=>p.id==='PT1'))") === "pending");

/* The gate: nothing works before the headmistress acts. */
ok("cannot log in while pending",
   run("Auth.pupilLogin('0803 111 2222','anything').reason") === "pending");
ok("cannot get a code while pending",
   run("TAVerify.issue('0803 111 2222').reason") === "pending");
ok("cannot set a password while pending",
   run("Auth.setPassword('0803 111 2222','sneaky')") === false);

/* Approval opens the next step, but not the account itself. */
ok("headmistress can approve", run("TAVerify.approve('PT1','Mrs. Salihu Nanahawa')") === true);
ok("status reads approved", run("TAVerify.statusOf(DB.load().pupils.find(p=>p.id==='PT1'))") === "approved");
ok("approval alone does not let anyone in",
   run("Auth.pupilLogin('0803 111 2222','anything').reason") === "nopassword");

/* The code proves the parent holds the phone. */
run("var ISS = TAVerify.issue('0803 111 2222');");
ok("code is issued after approval", run("ISS.ok") === true);
run("var Q = TAVerify.queue();");
ok("code is 4 digits", /^\d{4}$/.test(run("Q[0].code")), run("Q[0].code"));
ok("developer sees who asked for it",
   run("Q[0].phone") === "0803 111 2222" && run("Q[0].parent") === "Mrs. Test");
ok("developer sees which pupils it unlocks",
   run("Q[0].pupils.join(',')").indexOf("Test Child") >= 0);

ok("a wrong code is refused", run("TAVerify.check('0803 111 2222','0000').reason") === "wrong");
ok("wrong attempts are counted", run("TAVerify.check('0803 111 2222','1111').left") < 4);
ok("the right code passes", run("TAVerify.check('0803 111 2222', Q[0].code).ok") === true);
ok("a used code cannot be replayed",
   run("TAVerify.check('0803 111 2222', Q[0].code).reason") === "nocode");

/* Activation, then both numbers work. */
ok("password can now be set", run("Auth.setPassword('0803 111 2222','realpass')") === true);
ok("status reads active", run("TAVerify.statusOf(DB.load().pupils.find(p=>p.id==='PT1'))") === "active");
ok("first number logs in", run("Auth.pupilLogin('0803 111 2222','realpass').ok") === true);
ok("SECOND registration number logs in too",
   run("Auth.pupilLogin('0805 333 4444','realpass').ok") === true,
   "a household shares the account across both phones");
ok("wrong password still refused",
   run("Auth.pupilLogin('0803 111 2222','guess').reason") === "wrongpass");

/* Rejection keeps the account shut. */
run(`const d2=DB.load();
 d2.pupils.push({id:'PT2',adm:'TA/2026/902',name:'Rejected Child',class:'Primary 2',
   parent:'Mr. X', phone:'0807 999 8888', verified:false});
 DB.save(d2);`);
ok("headmistress can reject", run("TAVerify.reject('PT2','Not a real pupil','Head')") === true);
ok("a rejected pupil cannot log in",
   run("Auth.pupilLogin('0807 999 8888','x').reason") === "rejected");
ok("a rejected pupil gets no code",
   run("TAVerify.issue('0807 999 8888').ok") === false);
ok("a rejected pupil leaves the waiting queue",
   run("TAVerify.pending().filter(p=>p.id==='PT2').length") === 0);

/* Decisions are recorded - the developer watches for odd behaviour. */
ok("approvals and rejections are logged",
   run("(DB.load().activity||[]).length") >= 2);
ok("the log names who decided",
   run("JSON.stringify(DB.load().activity||[])").indexOf("Nanahawa") >= 0);

/* Wiring. */
["portal/admin.html", "portal/login.html", "portal/pupil.html",
 "portal/teacher.html", "developer.html"].forEach(function (f) {
  ok("verify.js loaded by " + f, read(f).indexOf("verify.js") >= 0);
});
const admin = read("portal/admin.html");
ok("admin has the approval queue", /id="v-verify"/.test(admin) && /vfRows/.test(admin));
ok("approval queue is in the nav", /data-view="verify"/.test(admin));
ok("waiting count shows without opening the view", /vfCount/.test(admin));
ok("admin still has every other view",
   (admin.match(/class="view-section"/g) || []).length >= 22,
   String((admin.match(/class="view-section"/g) || []).length));
const dev = read("developer.html");
ok("developer has the code inbox", /dvOtp/.test(dev));
ok("developer inbox explains manual delivery", /pass it to the parent/i.test(dev));

console.log("\n==== VERIFY-FLOW: " + pass + " passed, " + fail + " failed ====");
process.exit(fail ? 1 : 0);
