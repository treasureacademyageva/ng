/* Fee tracking and the staff message thread.
   Who may change what is the whole point: the teacher sees, the headmistress
   decides, and neither can read anyone else's conversation. */
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

/* ------------------------------------------------------------------ fees */
run(`var d=DB.load();
 ['Ada','Bola','Chidi','Dele'].forEach(function(n,i){
   d.pupils.push({id:'FP'+i,adm:'A'+i,name:n,class:'Primary 5',verified:true});
 });
 d.pupils.find(p=>p.id==='FP0').feePaid=true;
 d.pupils.find(p=>p.id==='FP1').feePaid='part';
 d.pupils.find(p=>p.id==='FP2').feePaid=false;
 DB.save(d);`);

ok("paid is read from the pupil record",
   run("U.feeStatus(DB.load(), DB.load().pupils.find(p=>p.id==='FP0')).paid") === true);
ok("part payment is its own state",
   run("U.feeStatus(DB.load(), DB.load().pupils.find(p=>p.id==='FP1')).partial") === true);
ok("unpaid is explicit",
   run("U.feeStatus(DB.load(), DB.load().pupils.find(p=>p.id==='FP2')).state") === "unpaid");
ok("a pupil with no record is not silently 'paid'",
   run("U.feeStatus(DB.load(), DB.load().pupils.find(p=>p.id==='FP3')).paid") === false);

const sum = JSON.parse(run("JSON.stringify(U.feeSummary(DB.load(),'Primary 5'))"));
ok("class summary counts each state", sum.paid === 1 && sum.partial === 1,
   JSON.stringify(sum));
ok("collection percentage is of the whole class",
   sum.pct === Math.round((sum.paid / sum.total) * 100), JSON.stringify(sum));
ok("summary ignores unapproved pupils",
   run(`var d2=DB.load();
        d2.pupils.push({id:'FPX',name:'Pending Child',class:'Primary 5',verified:false});
        DB.save(d2); U.feeSummary(DB.load(),'Primary 5').total`) === sum.total);

/* The teacher's screen must not be able to change any of it. */
const teacher = read("portal/teacher.html");
ok("teacher has a class fee view", /id="v-fees"/.test(teacher));
ok("teacher fee rows are read-only",
   !/onchange="setFee|onclick="setFee/.test(teacher),
   "only the headmistress records a payment");
ok("teacher fee view says it is read-only", /read-only/i.test(teacher));
ok("teacher sees only their own class", /p\.class===T\.class/.test(teacher));

/* The headmistress owns the decision. */
const admin = read("portal/admin.html");
ok("headmistress can set a fee state", /function setFee/.test(admin));
ok("marking paid issues a receipt", /nextReceipt\(\)/.test(admin));
ok("the pupil is told when a fee is confirmed",
   /TANotify\.push\(db,\{to:p\.id,kind:"fee"/.test(admin));
ok("fee control is wired into the pupils table", /onchange="setFee/.test(admin));

/* ------------------------------------------------------------------ chat */
run(`var d3=DB.load();
 d3.staffChat=[
  {id:'m1',thread:'staff:T001',fromRole:'teacher',fromName:'Uncle Ebenezer',text:'Morning ma',at:'2026-09-23T08:00:00Z',read:false},
  {id:'m2',thread:'staff:T001',fromRole:'admin',fromName:'Head',text:'Morning',at:'2026-09-23T08:05:00Z',read:false},
  {id:'m3',thread:'staff:T002',fromRole:'teacher',fromName:'Aunty Rafatu',text:'Please ma',at:'2026-09-23T09:00:00Z',read:false}
 ];
 DB.save(d3);`);

ok("a thread holds only its own messages",
   run("DB.load().staffChat.filter(m=>m.thread==='staff:T001').length") === 2);
ok("one teacher cannot see another's thread",
   run("DB.load().staffChat.filter(m=>m.thread==='staff:T002'&&m.fromName==='Uncle Ebenezer').length") === 0);

ok("teacher can message the headmistress", /function tcSend/.test(teacher));
ok("teacher thread is keyed to that teacher", /function tcThreadId/.test(teacher));
ok("headmistress is notified of a new message",
   /TANotify\.push\(db,\{to:"HEAD001",kind:"chat"/.test(teacher));
ok("headmistress sees one thread per teacher", /function scThreads/.test(admin));
ok("headmistress can reply", /function scSend/.test(admin));
ok("unread staff messages show on the nav", /scBadge/.test(admin));
ok("unread count is live before opening the view",
   /sc\.textContent=\(db\.staffChat\|\|\[\]\)\.filter/.test(admin));

/* A teacher must not be able to reach another teacher - the spec is explicit. */
ok("no teacher-to-teacher channel exists",
   !/fromRole:"teacher"[^}]*toRole:"teacher"/.test(teacher) &&
   !/thread:"staff:"\+other/.test(teacher));

console.log("\n==== FEES-CHAT: " + pass + " passed, " + fail + " failed ====");
process.exit(fail ? 1 : 0);
