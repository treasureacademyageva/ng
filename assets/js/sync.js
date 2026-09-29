/* Treasure Academy — read-only public Supabase configuration bridge.
   ------------------------------------------------------------------
   The browser may read published school content through DBLive. It must never
   upload the local portal database, passwords, pupil records or payment data.
   Office writes belong in Supabase's authenticated dashboard or a future
   server endpoint — never behind an anon key in client JavaScript. */
var Sync = (function () {
  "use strict";
  var CFG = "treasure_supabase_cfg";
  var MARK = "treasure_synced_at";

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }
  function cfg() { try { return JSON.parse(ls(CFG) || "{}"); } catch (e) { return {}; } }
  function on() { var c=cfg(); return !!(c&&c.url&&c.key&&c.enabled!==false); }
  function online() { try { return navigator.onLine!==false; } catch (e) { return true; } }
  function headers(c) { return {apikey:c.key,Authorization:"Bearer "+c.key}; }
  function base(c) { return String(c.url||"").replace(/\/+$/,""); }

  return {
    configured:on,
    online:online,
    getConfig:cfg,
    lastSync:function(){return ls(MARK)||"";},
    saveConfig:function(url,key,enabled){
      try {
        localStorage.setItem(CFG,JSON.stringify({
          url:String(url||"").trim(),key:String(key||"").trim(),enabled:enabled!==false
        }));
        return true;
      } catch(e) { return false; }
    },
    status:function(){return {configured:on(),online:online(),lastSync:ls(MARK)||"never",readOnly:true};},

    /* Kept as a compatibility method for older callers. Deliberately no-op. */
    push:function(){
      return Promise.resolve({pushed:0,skipped:true,readOnly:true,error:"Browser cloud writes are disabled."});
    },
    pushSoon:function(){ return false; },

    /* Refresh only DBLive's allowlisted public tables. */
    pull:function(){
      if(!on()||!online())return Promise.resolve({pulled:0,skipped:true,readOnly:true});
      if(typeof DBLive==="undefined"||!DBLive.hydrate)return Promise.resolve({pulled:0,error:"Public data reader unavailable."});
      return DBLive.hydrate().then(function(changed){
        if(changed)ls(MARK,new Date().toISOString());
        return {pulled:changed?1:0,changed:!!changed,readOnly:true};
      }).catch(function(e){return {pulled:0,error:String((e&&e.message)||e),readOnly:true};});
    },
    remoteNewer:function(){ return Promise.resolve(false); },
    boot:function(){ /* DBLive owns the safe, non-blocking page-load refresh. */ },

    /* Test a deliberately public table, never the retired school_data blob. */
    test:function(){
      var c=cfg();
      if(!(c.url&&c.key))return Promise.resolve({ok:false,detail:"Enter URL and anon key first."});
      if(!online())return Promise.resolve({ok:false,detail:"You appear offline."});
      return fetch(base(c)+"/rest/v1/sessions?select=id&limit=1",{headers:headers(c)})
        .then(function(r){
          return r.ok
            ? {ok:true,detail:"Connected in read-only mode. Public school data is available."}
            : {ok:false,detail:"Server said HTTP "+r.status};
        })
        .catch(function(e){return {ok:false,detail:String((e&&e.message)||e)};});
    }
  };
})();
