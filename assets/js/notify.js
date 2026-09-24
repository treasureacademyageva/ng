/* ============================================================================
   Treasure Academy - notifications
   ----------------------------------------------------------------------------
   One inbox per person, written by whoever did the thing worth knowing about:
   a teacher marking the register, the headmistress confirming a fee, a new
   exam appearing on the timetable, a reply in a chat thread.

   Deliberately simple. Every notice carries who it is for, what kind it is,
   and when - nothing else. Rendering decides how it looks; this file only
   decides that it exists and whether it has been read.

   Written straight onto the DB object the caller already holds, so a caller
   can push several notices and save once rather than thrashing storage.
   ========================================================================== */
(function (global) {
  "use strict";

  var CAP = 60;              /* per person - an inbox, not an archive */

  var seq = 0;
  function uid() {
    return "n" + Date.now().toString(36) + (seq++).toString(36) +
           Math.random().toString(36).slice(2, 5);
  }

  var Notify = {
    /* Add a notice to someone's inbox. `db` is mutated, not saved - the
       caller saves, so a register of 30 pupils is one write, not thirty. */
    push: function (db, opts) {
      if (!db || !opts || !opts.to) return null;
      db.notifications = db.notifications || [];
      var n = {
        id: uid(),
        to: String(opts.to),
        kind: opts.kind || "general",
        title: String(opts.title || "").slice(0, 120),
        body: String(opts.body || "").slice(0, 400),
        tone: opts.tone || "info",          /* good | warn | bad | info */
        link: opts.link || "",
        at: new Date().toISOString(),
        /* Monotonic, because several notices are written inside one loop and
           an ISO timestamp cannot separate them. */
        seq: ++seq,
        read: false
      };
      db.notifications.push(n);

      /* Trim this person's inbox, leaving everyone else's alone. */
      var mine = db.notifications.filter(function (x) { return x.to === n.to; })
        .sort(function (a, b) {
          var t = String(a.at).localeCompare(String(b.at));
          return t !== 0 ? t : (a.seq || 0) - (b.seq || 0);
        });
      if (mine.length > CAP) {
        var drop = mine.slice(0, mine.length - CAP).map(function (x) { return x.id; });
        db.notifications = db.notifications.filter(function (x) {
          return drop.indexOf(x.id) < 0;
        });
      }
      return n;
    },

    /* Same notice to many people - a class, all staff, every parent. */
    pushMany: function (db, ids, opts) {
      var out = [];
      (ids || []).forEach(function (id) {
        var n = this.push(db, Object.assign({}, opts, { to: id }));
        if (n) out.push(n);
      }, this);
      return out;
    },

    /* Newest first. */
    forUser: function (db, id, limit) {
      if (!db || !id) return [];
      return (db.notifications || [])
        .filter(function (n) { return n.to === String(id); })
        .sort(function (a, b) {
          var t = String(b.at).localeCompare(String(a.at));
          return t !== 0 ? t : (b.seq || 0) - (a.seq || 0);
        })
        .slice(0, limit || CAP);
    },

    unreadCount: function (db, id) {
      if (!db || !id) return 0;
      return (db.notifications || []).filter(function (n) {
        return n.to === String(id) && !n.read;
      }).length;
    },

    markRead: function (db, id) {
      var touched = 0;
      (db.notifications || []).forEach(function (n) {
        if (n.to === String(id) && !n.read) { n.read = true; touched++; }
      });
      return touched;
    },

    /* Render-ready summary for a dashboard card. */
    summary: function (db, id) {
      var list = this.forUser(db, id, 6);
      return {
        unread: this.unreadCount(db, id),
        items: list
      };
    }
  };

  global.TANotify = Notify;
})(typeof window !== "undefined" ? window : this);
