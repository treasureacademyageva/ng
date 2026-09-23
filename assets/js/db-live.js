/* ============================================================================
   Treasure Academy — live database reader (batch 45)

   WHY THIS FILE EXISTS
   School information that changes over time (term dates, the admissions
   deadline, fees, staff) used to live only inside store.js and inside each
   visitor's own browser storage. That had two consequences the owner hit in
   practice:

     * history was destroyed — store.js deleted every past calendar date on
       load, so the term calendar shrank as the term went on;
     * every browser held a different copy, so what the office typed on one
       device never reached a parent on another.

   db/001_schema.sql puts that data in PostgreSQL (Supabase) instead. This file
   reads it back over the REST API and hands it to the existing pages.

   DESIGN RULES
   1. NEVER break the site if the database is unreachable. Every read falls
      back to whatever store.js already has, so the site works offline, on a
      bad Ageva connection, and before the owner has run the SQL at all.
   2. Read-only, anon key only. Writes stay with the portal/sync layer, and the
      service_role key must never appear in site JavaScript.
   3. No dependencies. Plain fetch, same as sync.js.
   ========================================================================== */
var DBLive = (function () {
  "use strict";

  var CFG = "treasure_supabase_cfg";      /* shared with sync.js */
  var CACHE = "treasure_dblive_cache_v1";
  var FRESH_MS = 5 * 60 * 1000;           /* serve cache for 5 minutes */

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }

  function cfg() {
    try { return JSON.parse(ls(CFG) || "{}"); } catch (e) { return {}; }
  }

  /* The database is optional. If it is not configured, every call below
     resolves to null and the caller keeps its existing local data. */
  function enabled() {
    var c = cfg();
    return !!(c && c.url && c.key && c.enabled !== false);
  }

  function headers(c) {
    return { apikey: c.key, Authorization: "Bearer " + c.key };
  }

  function rest(path) {
    var c = cfg();
    if (!c.url) return null;
    return String(c.url).replace(/\/+$/, "") + "/rest/v1/" + path;
  }

  function readCache() {
    try { return JSON.parse(ls(CACHE) || "{}"); } catch (e) { return {}; }
  }

  function writeCache(key, rows) {
    var all = readCache();
    all[key] = { at: Date.now(), rows: rows };
    ls(CACHE, JSON.stringify(all));
  }

  function cached(key) {
    var hit = readCache()[key];
    if (!hit) return null;
    return { rows: hit.rows, stale: (Date.now() - hit.at) > FRESH_MS };
  }

  /* Fetch one view/table. Resolves to an array, or null when the database is
     off or unreachable - never rejects, so no caller needs a try/catch. */
  function get(resource, query) {
    var key = resource + (query || "");
    if (!enabled()) return Promise.resolve(null);

    var hit = cached(key);
    if (hit && !hit.stale) return Promise.resolve(hit.rows);

    var url = rest(resource + (query || ""));
    if (!url) return Promise.resolve(null);

    var ctrl, timer;
    try {
      ctrl = new AbortController();
      /* A slow link must not hold the page hostage. */
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 6000);
    } catch (e) { ctrl = null; }

    return fetch(url, {
      headers: headers(cfg()),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) {
        if (timer) clearTimeout(timer);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (rows) {
        if (!Array.isArray(rows)) return null;
        writeCache(key, rows);
        return rows;
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        /* Offline or erroring: stale cache beats nothing, null beats a crash */
        return hit ? hit.rows : null;
      });
  }

  /* ------------------------------------------------------------------
     Shape converters: database rows -> the shapes the pages already use,
     so nothing downstream has to be rewritten.
     ------------------------------------------------------------------ */

  function toCalendar(rows) {
    return (rows || []).map(function (r) {
      return {
        id: r.id,
        date: String(r.event_date || "").slice(0, 10),
        title: r.title || "",
        desc: r.description || ""
      };
    }).filter(function (c) { return c.date && c.title; });
  }

  var API = {
    enabled: enabled,

    /* Whole current session INCLUDING past dates - this is the query that
       fixes the shrinking calendar. */
    calendar: function () {
      return get("calendar_current_session", "?select=*&order=event_date")
        .then(function (rows) { return rows ? toCalendar(rows) : null; });
    },

    upcoming: function () {
      return get("calendar_upcoming", "?select=*&order=event_date")
        .then(function (rows) { return rows ? toCalendar(rows) : null; });
    },

    /* The admissions deadline as stored data rather than "resumption + 14
       days", which silently vanished once resumption passed. */
    admissionWindow: function () {
      return get("admission_windows", "?select=*&order=deadline_on.desc&limit=1")
        .then(function (rows) {
          if (!rows || !rows.length) return null;
          var w = rows[0];
          return {
            opens: String(w.opens_on || "").slice(0, 10),
            deadline: String(w.deadline_on || "").slice(0, 10),
            open: w.is_open !== false,
            note: w.note || ""
          };
        });
    },

    session: function () {
      return get("sessions", "?select=*&is_current=eq.true&limit=1")
        .then(function (rows) {
          if (!rows || !rows.length) return null;
          var s = rows[0];
          return {
            session: s.name || "",
            term: s.term || "",
            starts: String(s.starts_on || "").slice(0, 10),
            ends: String(s.ends_on || "").slice(0, 10)
          };
        });
    },

    fees: function () {
      return get("fee_structure", "?select=class_name,amount_naira")
        .then(function (rows) {
          if (!rows) return null;
          var out = {};
          rows.forEach(function (r) { out[r.class_name] = Number(r.amount_naira) || 0; });
          return Object.keys(out).length ? out : null;
        });
    },

    /* Does this phone already belong to a household? Powers the
       "registering another child?" prompt against real shared data rather
       than one browser's localStorage. */
    /* Looks a household up by phone number.
       IMPORTANT: after db/003_policies.sql runs, this RPC is revoked from the
       anon role on purpose - exposed publicly it is a family-enumeration tool
       (Nigerian mobile numbers are only ~10 digits, so a script could walk the
       whole range and harvest parent names and children). The call therefore
       returns 403 from the browser and this function resolves to null, which
       makes auth-ui.js fall back to its local household store. That is the
       intended behaviour, not a bug: do not "fix" it by granting the function
       back to anon. Route it through a server endpoint that can rate-limit. */
    householdByPhone: function (phone) {
      var digits = String(phone || "").replace(/\D/g, "");
      if (digits.length < 7 || !enabled()) return Promise.resolve(null);
      var url = rest("rpc/household_by_phone");
      if (!url) return Promise.resolve(null);

      var h = headers(cfg());
      h["Content-Type"] = "application/json";

      return fetch(url, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ p_phone: digits.slice(-10) })
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (rows) {
          if (!rows || !rows.length) return null;
          return {
            accountNo: rows[0].account_no,
            parent: rows[0].parent_name,
            pupils: rows.filter(function (x) { return x.pupil_name; })
                        .map(function (x) {
                          return { name: x.pupil_name, cls: x.class_name, status: x.status };
                        })
          };
        })
        .catch(function () { return null; });
    },

    /* Merge whatever the database knows into the local DB, then tell the page
       to re-render. Safe to call on every page load. */
    hydrate: function () {
      if (!enabled()) return Promise.resolve(false);
      return Promise.all([API.calendar(), API.session(), API.fees()])
        .then(function (res) {
          var cal = res[0], ses = res[1], fees = res[2];
          if (!cal && !ses && !fees) return false;
          try {
            var db = DB.load(), touched = false;
            if (cal && cal.length) { db.calendar = cal; touched = true; }
            if (ses) {
              if (ses.session) { db.school.session = ses.session; touched = true; }
              if (ses.term)    { db.school.term = ses.term;       touched = true; }
            }
            if (fees) { db.school.fees = fees; touched = true; }
            if (touched) DB.save(db);
            return touched;
          } catch (e) { return false; }
        });
    }
  };

  return API;
})();

if (typeof window !== "undefined") window.DBLive = DBLive;

/* Pull fresh school data on load when the database is configured, then let the
   page redraw. Silent and non-blocking: if the database is off, unreachable or
   slow, the page keeps the data store.js already gave it. */
if (typeof window !== "undefined" && typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    if (!DBLive.enabled()) return;
    DBLive.hydrate().then(function (changed) {
      if (!changed) return;
      try {
        document.dispatchEvent(new CustomEvent("ta:db-updated"));
      } catch (e) {}
    });
  });
}
