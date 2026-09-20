/* Treasure Academy — Supabase live sync (batch 21). No dependencies (fetch only).
   Table school_data(key text PK, data jsonb, updated_at timestamptz): one row
   per collection. Admin pastes URL + anon key in Settings; portal saves push
   automatically, every page pulls fresh data on load. */
var Sync = (function(){
  "use strict";
  var CFG = 'treasure_supabase_cfg', MARK = 'treasure_synced_at', RELOADED = 'treasure_sync_reloaded';
  var _timer = null, _pushing = false;
  function ls(k, v){
    try{ if(v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }
    catch(e){} return null;
  }
  function cfg(){ try{ return JSON.parse(ls(CFG) || '{}'); }catch(e){ return {}; } }
  function on(){ var c = cfg(); return !!(c && c.url && c.key && c.enabled !== false); }
  function online(){ try{ return navigator.onLine !== false; }catch(e){ return true; } }
  function H(c){ return {apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json'}; }
  function base(c){ return String(c.url || '').replace(/\/+$/, ''); }
  function cols(db){ return Object.keys(db || {}).filter(function(k){ return k.charAt(0) !== '_'; }); }
  var NULL_TAG = '__treasure_null';
  function enc(v){ return (v === null || v === undefined) ? {__treasure_null: true} : v; }
  function dec(v){ return (v && typeof v === 'object' && v[NULL_TAG] === true) ? null : v; }
  var api = {
    _applying: false,
    configured: on,
    online: online,
    getConfig: cfg,
    lastSync: function(){ return ls(MARK) || ''; },
    saveConfig: function(url, key, enabled){
      try{
        localStorage.setItem(CFG, JSON.stringify({url: String(url || '').trim(), key: String(key || '').trim(), enabled: enabled !== false}));
        return true;
      }catch(e){ return false; }
    },
    status: function(){ return {configured: on(), online: online(), lastSync: ls(MARK) || 'never'}; },
    push: function(){
      if(!on() || !online() || _pushing) return Promise.resolve({pushed: 0, skipped: true});
      _pushing = true;
      var c = cfg(), db;
      try{ db = DB.load(); }catch(e){ _pushing = false; return Promise.resolve({pushed: 0, error: 'nodb'}); }
      var keys = cols(db);
      var headers = H(c); headers.Prefer = 'resolution=merge-duplicates';
      return Promise.all(keys.map(function(k){
        return fetch(base(c) + '/rest/v1/school_data', {
          method: 'POST', headers: headers,
          body: JSON.stringify({key: k, data: enc(db[k])})
        }).then(function(r){ if(!r.ok) throw new Error('push ' + k + ' HTTP ' + r.status); return 1; });
      })).then(function(rs){
        _pushing = false;
        try{ ls(MARK, new Date().toISOString()); }catch(e){}
        return {pushed: rs.length};
      }).catch(function(e){ _pushing = false; return {pushed: 0, error: String((e && e.message) || e)}; });
    },
    pushSoon: function(){
      if(!on() || !online() || api._applying || _timer) return;
      _timer = setTimeout(function(){ _timer = null; api.push(); }, 2500);
    },
    pull: function(){
      if(!on() || !online()) return Promise.resolve({pulled: 0, skipped: true});
      var c = cfg();
      return fetch(base(c) + '/rest/v1/school_data?select=key,data', {headers: H(c)})
        .then(function(r){ if(!r.ok) throw new Error('pull HTTP ' + r.status); return r.json(); })
        .then(function(rows){
          var db;
          try{ db = DB.load(); }catch(e){ return {pulled: 0, error: 'nodb'}; }
          var n = 0;
          (rows || []).forEach(function(row){
            if(!row || !row.key || row.key.charAt(0) === '_') return;
            db[row.key] = dec(row.data); n++;
          });
          if(n){
            api._applying = true;
            try{ DB.save(db); }finally{ api._applying = false; }
            try{ ls(MARK, new Date().toISOString()); }catch(e){}
          }
          return {pulled: n, changed: n > 0};
        })
        .catch(function(e){ return {pulled: 0, error: String((e && e.message) || e)}; });
    },
    remoteNewer: function(){
      if(!on() || !online()) return Promise.resolve(false);
      var c = cfg(), m = ls(MARK) || '';
      return fetch(base(c) + '/rest/v1/school_data?select=updated_at&order=updated_at.desc&limit=1', {headers: H(c)})
        .then(function(r){ if(!r.ok) return false; return r.json(); })
        .then(function(rows){
          var t = rows && rows[0] && rows[0].updated_at || '';
          return !!(t && (!m || t > m));
        })
        .catch(function(){ return false; });
    },
    boot: function(){
      if(!on() || !online()) return;
      try{ if(sessionStorage.getItem(RELOADED)) return; }catch(e){}
      api.remoteNewer().then(function(newer){
        if(!newer) return;
        api.pull().then(function(r){
          if(r && r.changed){
            try{ sessionStorage.setItem(RELOADED, '1'); }catch(e){}
            location.reload();
          }
        });
      });
    },
    test: function(){
      var c = cfg();
      if(!(c.url && c.key)) return Promise.resolve({ok: false, detail: 'Enter URL and key first.'});
      if(!online()) return Promise.resolve({ok: false, detail: 'You appear offline.'});
      return fetch(base(c) + '/rest/v1/school_data?select=key&limit=1', {headers: H(c)})
        .then(function(r){
          return r.ok ? {ok: true, detail: 'Connected. Table school_data is readable.'}
                      : {ok: false, detail: 'Server said HTTP ' + r.status};
        })
        .catch(function(e){ return {ok: false, detail: String((e && e.message) || e)}; });
    }
  };
  if(typeof document !== 'undefined'){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ try{ api.boot(); }catch(e){} });
    else { try{ api.boot(); }catch(e){} }
  }
  return api;
})();
