/* (Batch 52 retarget) Batch 21 Supabase bridge is now intentionally read-only. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const {JSDOM}=require('jsdom');const SITE=path.resolve(__dirname,'..','..');
const sync=fs.readFileSync(path.join(SITE,'assets/js/sync.js'),'utf8');let pass=0,fail=0;
function ok(n,c,d=''){if(c){pass++;console.log('ok -',n)}else{fail++;console.log('FAIL -',n,d)}}
function env(configured=true){
 const dom=new JSDOM('<!doctype html><body></body>',{url:'http://localhost/'}),w=dom.window;w.__calls=[];
 w.fetch=(url,opts={})=>{w.__calls.push({url:String(url),opts});return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve([])})};
 if(configured)w.localStorage.setItem('treasure_supabase_cfg',JSON.stringify({url:'https://xyz.supabase.co',key:'anonkey123',enabled:true}));
 vm.createContext(w);vm.runInContext(sync,w);return {w,run:x=>vm.runInContext(x,w)};
}
(async()=>{
 ok('generic school_data endpoint retired',!sync.includes('/school_data'));
 ok('no browser POST path remains',!sync.includes("method:'POST'")&&!sync.includes('method: "POST"')&&!sync.includes('method:"POST"'));
 ok('source documents read-only public bridge',sync.includes('read-only public Supabase')&&sync.includes('must never'));
 {
  const {w,run}=env(false);ok('unconfigured bridge reports false',run('Sync.configured()')===false);
  const p=await run('Sync.push()');ok('unconfigured push is a no-op',p.skipped&&p.readOnly&&p.pushed===0&&w.__calls.length===0);
  const r=await run('Sync.pull()');ok('unconfigured pull is skipped',r.skipped&&r.readOnly&&w.__calls.length===0);
 }
 {
  const {w,run}=env();ok('approved public config is recognised',run('Sync.configured()')===true);
  const p=await run('Sync.push()');ok('configured push still writes nothing',p.skipped&&p.readOnly&&p.pushed===0&&w.__calls.length===0);
  ok('pushSoon deliberately returns false',run('Sync.pushSoon()')===false);
  ok('remoteNewer is retired',await run('Sync.remoteNewer()')===false);
  run('Sync.boot()');ok('boot does not touch generic data',w.__calls.length===0);
  const r=await run('Sync.pull()');ok('pull refuses when DBLive is unavailable',r.pulled===0&&/unavailable/i.test(r.error));
 }
 {
  const {w,run}=env();w.DBLive={hydrate:()=>Promise.resolve(true)};
  const r=await run('Sync.pull()');ok('pull delegates to allowlisted DBLive',r.changed===true&&r.pulled===1&&r.readOnly===true);
  ok('successful public refresh records timestamp',run('Sync.lastSync()').length>10);
 }
 {
  const {w,run}=env();const r=await run('Sync.test()');
  ok('connection test succeeds read-only',r.ok&&/read-only/.test(r.detail));
  ok('connection test queries sessions only',w.__calls.length===1&&w.__calls[0].url.endsWith('/rest/v1/sessions?select=id&limit=1'));
  ok('connection test sends anon authorization',w.__calls[0].opts.headers.apikey==='anonkey123'&&w.__calls[0].opts.headers.Authorization==='Bearer anonkey123');
 }
 const admin=fs.readFileSync(path.join(SITE,'portal/admin.html'),'utf8');
 ok('admin UI labels connection read-only',admin.includes('Public Data Connection (Supabase)')&&admin.includes('never uploads portal passwords'));
 ok('admin UI has no Push Now control',!admin.includes('onclick="pushSup()"'));
 console.log(`\n==== BATCH21: ${pass} passed, ${fail} failed ====`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
