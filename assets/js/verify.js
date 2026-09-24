/* ============================================================================
   Treasure Academy - pupil verification and first-login OTP
   ----------------------------------------------------------------------------
   The gate between "someone filled the registration form" and "someone can
   log in and read a child's records". Three states, in order:

     pending    registered online, waiting for the headmistress
     approved   the headmistress has confirmed the child is real
     active     the parent has passed the OTP and set a password

   Why an OTP at all: a registration form only proves someone typed a phone
   number. The code proves they hold the phone. It is generated here, shown to
   the DEVELOPER in the console with the contact details, and passed to the
   parent by hand - the school has no SMS gateway, and inventing one would be
   a lie in the code.

   The code is bound to the phone the parent is logging in with. Both numbers
   from the registration can log in afterwards, but the code that activates the
   account belongs to the one being used at that moment.
   ========================================================================== */
(function (global) {
  "use strict";

  var OTP_KEY = "treasure_otp_queue_v1";     /* developer inbox */
  var OTP_TTL = 24 * 60 * 60 * 1000;         /* a code is good for a day */
  var MAX_TRIES = 5;

  function db() {
    try {
      if (typeof DB !== "undefined" && DB && DB.load) return DB.load();
    } catch (e) {}
    return null;
  }
  function save(d) {
    try { if (typeof DB !== "undefined" && DB && DB.save) return DB.save(d); }
    catch (e) {}
    return false;
  }
  function readQ() {
    try { return JSON.parse(localStorage.getItem(OTP_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function writeQ(list) {
    try { localStorage.setItem(OTP_KEY, JSON.stringify(list.slice(-200))); return true; }
    catch (e) { return false; }
  }
  function phoneKey(p) {
    try { if (typeof U !== "undefined" && U.phoneKey) return U.phoneKey(p); }
    catch (e) {}
    var d = String(p || "").replace(/\D/g, "");
    return d.length >= 10 ? d.slice(-10) : "";
  }

  /* Four digits, never starting 0 so it reads cleanly when spoken aloud. */
  function makeCode() {
    var n;
    if (global.crypto && global.crypto.getRandomValues) {
      var a = new Uint32Array(1);
      global.crypto.getRandomValues(a);
      n = 1000 + (a[0] % 9000);
    } else {
      n = 1000 + Math.floor(Math.random() * 9000);
    }
    return String(n);
  }

  var Verify = {
    /* ------------------------------------------------------------- state */
    /* A pupil is only allowed in once the headmistress has approved them. */
    statusOf: function (pupil) {
      if (!pupil) return "unknown";
      if (pupil.status === "rejected") return "rejected";
      if (pupil.verified === false) return "pending";
      if (pupil.verified === undefined && pupil.password) return "active";
      if (!pupil.verified) return "pending";
      return pupil.password ? "active" : "approved";
    },

    isApproved: function (pupil) {
      var st = this.statusOf(pupil);
      return st === "approved" || st === "active";
    },

    /* Everyone waiting on the headmistress, newest first. */
    pending: function () {
      var d = db();
      if (!d) return [];
      /* verified===false marks BOTH "not yet decided" and "rejected", so the
         rejected ones must be filtered out or the headmistress keeps seeing
         children she has already turned down. */
      return (d.pupils || []).filter(function (p) {
        return p.verified === false && p.status !== "rejected";
      }).sort(function (a, b) {
        return String(b.registeredAt || "").localeCompare(String(a.registeredAt || ""));
      });
    },

    /* --------------------------------------------- headmistress actions */
    approve: function (pupilId, byWhom) {
      var d = db();
      if (!d) return false;
      var p = (d.pupils || []).filter(function (x) { return x.id === pupilId; })[0];
      if (!p) return false;
      p.verified = true;
      p.verifiedAt = new Date().toISOString();
      p.verifiedBy = byWhom || "Headmistress";
      delete p.status;
      save(d);
      this.log("approved", p, byWhom);
      return true;
    },

    reject: function (pupilId, reason, byWhom) {
      var d = db();
      if (!d) return false;
      var p = (d.pupils || []).filter(function (x) { return x.id === pupilId; })[0];
      if (!p) return false;
      p.verified = false;
      p.status = "rejected";
      p.rejectedReason = String(reason || "").slice(0, 200);
      p.rejectedAt = new Date().toISOString();
      save(d);
      this.log("rejected", p, byWhom);
      return true;
    },

    /* ------------------------------------------------------------- OTP */
    /* Issue a code for the number the parent is actually using right now.
       Returns the record so the caller can show "we have sent it" - the code
       itself only goes to the developer console. */
    issue: function (identifier) {
      var d = db();
      if (!d) return { ok: false, reason: "nodb" };

      var key = phoneKey(identifier);
      var q = String(identifier || "").trim().toUpperCase();
      var matches = (d.pupils || []).filter(function (p) {
        return (String(p.adm || "").toUpperCase() === q) ||
               (String(p.id || "").toUpperCase() === q) ||
               (key && phoneKey(p.phone) === key) ||
               (key && phoneKey(p.phone2) === key);
      });
      if (!matches.length) return { ok: false, reason: "notfound" };

      /* Every child on this account must be approved before any code goes
         out - otherwise an unapproved sibling becomes a way in. */
      var approved = matches.filter(this.isApproved, this);
      if (!approved.length) {
        return { ok: false, reason: "pending", pupil: matches[0] };
      }

      var code = makeCode();
      var rec = {
        id: "otp" + Date.now().toString(36),
        code: code,
        phone: String(identifier || "").trim(),
        phoneKey: key,
        pupilIds: approved.map(function (p) { return p.id; }),
        pupilNames: approved.map(function (p) { return p.name; }),
        parent: approved[0].parent || "",
        classes: approved.map(function (p) { return p.class; }),
        issuedAt: Date.now(),
        expiresAt: Date.now() + OTP_TTL,
        tries: 0,
        used: false
      };
      var list = readQ();
      /* One live code per number - a new request replaces the old. */
      list = list.filter(function (x) {
        return !(x.phoneKey === key && !x.used);
      });
      list.push(rec);
      writeQ(list);

      /* The developer is the delivery channel, so the code has to be visible
         to them together with who asked for it. */
      try {
        console.info("[Treasure OTP] code " + code + " for " + rec.phone +
                     " (" + (rec.parent || "parent") + " - " +
                     rec.pupilNames.join(", ") + ")");
      } catch (e) {}

      return { ok: true, record: { id: rec.id, phone: rec.phone,
               pupils: rec.pupilNames, expiresAt: rec.expiresAt } };
    },

    /* Check a code against the number it was issued for. */
    check: function (identifier, code) {
      var key = phoneKey(identifier);
      var q = String(identifier || "").trim().toUpperCase();
      var list = readQ();
      var now = Date.now();

      var rec = null;
      for (var i = list.length - 1; i >= 0; i--) {
        var x = list[i];
        if (x.used) continue;
        var sameNumber = key && x.phoneKey === key;
        var sameId = String(x.phone || "").toUpperCase() === q;
        if (sameNumber || sameId) { rec = x; break; }
      }
      if (!rec) return { ok: false, reason: "nocode" };
      if (now > rec.expiresAt) return { ok: false, reason: "expired" };
      if (rec.tries >= MAX_TRIES) return { ok: false, reason: "locked" };

      rec.tries++;
      if (String(rec.code) !== String(code || "").trim()) {
        writeQ(list);
        return { ok: false, reason: "wrong",
                 left: Math.max(0, MAX_TRIES - rec.tries) };
      }

      rec.used = true;
      rec.usedAt = now;
      writeQ(list);
      return { ok: true, pupilIds: rec.pupilIds, phone: rec.phone };
    },

    /* --------------------------------------------- developer visibility */
    /* The developer hands codes out by hand, so they need the live list with
       the contact attached. */
    queue: function () {
      var now = Date.now();
      return readQ().slice().reverse().map(function (r) {
        return {
          id: r.id, code: r.code, phone: r.phone, parent: r.parent,
          pupils: r.pupilNames, classes: r.classes,
          issuedAt: r.issuedAt, tries: r.tries,
          state: r.used ? "used" : (now > r.expiresAt ? "expired" : "waiting")
        };
      });
    },

    clearQueue: function () {
      try { localStorage.removeItem(OTP_KEY); return true; } catch (e) { return false; }
    },

    /* ------------------------------------------------------------ audit */
    log: function (action, pupil, byWhom) {
      var d = db();
      if (!d) return;
      d.activity = d.activity || [];
      d.activity.push({
        id: "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        at: new Date().toISOString(),
        actor: byWhom || "system",
        action: action,
        target: pupil ? (pupil.name + " (" + (pupil.adm || pupil.id) + ")") : "",
        role: "headmistress"
      });
      if (d.activity.length > 500) d.activity = d.activity.slice(-500);
      save(d);
    }
  };

  global.TAVerify = Verify;
})(typeof window !== "undefined" ? window : this);
