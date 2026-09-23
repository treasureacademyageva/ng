/* ============================================================================
   Treasure Support AI - conversation engine
   ----------------------------------------------------------------------------
   Owns everything that is not the pixels: history, the answer flow, the
   resolved / not-resolved loop, the urgency question that decides WhatsApp vs
   contact form, and the analytics the developer console reads.

   History rules, as specified:
     guest      sessionStorage. Closing the browser ends it. Moving between
                pages keeps it, because that is one visit.
     logged in  localStorage per account, and anything said as a guest in this
                visit is merged in on login so nothing is lost.
   ========================================================================== */
(function (global) {
  "use strict";

  var GUEST_KEY = "treasure_chat_guest_v1";     /* sessionStorage */
  var USER_KEY = "treasure_chat_user_v1";       /* localStorage, keyed by account */
  var STATS_KEY = "treasure_chat_stats_v1";     /* localStorage, developer only */
  var WHATSAPP = "09063932487";

  function now() { return Date.now(); }
  function uid() { return "m" + now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function readJSON(store, key, fallback) {
    try { var v = store.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function writeJSON(store, key, val) {
    try { store.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  /* Who is asking. Answers that depend on a pupil's own record need this. */
  function session() {
    try {
      if (global.Auth && typeof Auth.get === "function") return Auth.get();
      var raw = localStorage.getItem("treasure_session_v1") ||
                sessionStorage.getItem("treasure_session_v1");
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function accountKey() {
    var s = session();
    if (!s) return null;
    return USER_KEY + ":" + (s.refId || s.id || s.adm || s.name || "user");
  }

  var Core = {
    WHATSAPP: WHATSAPP,
    messages: [],
    pending: null,          /* awaiting feedback / urgency */
    ragReady: false,
    apiBase: null,          /* set when a FastAPI backend is configured */

    /* ---------------------------------------------------------------- boot */
    init: function (kb) {
      if (global.TARag && kb) { global.TARag.load(kb); this.ragReady = true; }
      try {
        var cfg = JSON.parse(localStorage.getItem("treasure_ai_cfg") || "null");
        if (cfg && cfg.url && cfg.enabled !== false) this.apiBase = String(cfg.url).replace(/\/+$/, "");
      } catch (e) {}
      this.messages = this.loadHistory();
      return this;
    },

    /* ------------------------------------------------------------- history */
    loadHistory: function () {
      var key = accountKey();
      if (key) {
        var mine = readJSON(localStorage, key, null);
        if (mine && mine.length) return mine;
        /* First load after signing in: adopt whatever was said as a guest. */
        var guest = readJSON(sessionStorage, GUEST_KEY, []);
        if (guest.length) { writeJSON(localStorage, key, guest); return guest; }
        return [];
      }
      return readJSON(sessionStorage, GUEST_KEY, []);
    },

    saveHistory: function () {
      var key = accountKey();
      var trimmed = this.messages.slice(-120);
      if (key) return writeJSON(localStorage, key, trimmed);
      return writeJSON(sessionStorage, GUEST_KEY, trimmed);
    },

    /* Called after a successful login: fold the guest thread into the account
       so the parent does not lose the questions that led them to sign in. */
    syncGuestToAccount: function () {
      var key = accountKey();
      if (!key) return false;
      var guest = readJSON(sessionStorage, GUEST_KEY, []);
      if (!guest.length) return false;
      var mine = readJSON(localStorage, key, []);
      var seen = {};
      mine.forEach(function (m) { seen[m.id] = 1; });
      guest.forEach(function (m) { if (!seen[m.id]) mine.push(m); });
      mine.sort(function (a, b) { return a.t - b.t; });
      writeJSON(localStorage, key, mine.slice(-120));
      try { sessionStorage.removeItem(GUEST_KEY); } catch (e) {}
      this.messages = mine.slice(-120);
      return true;
    },

    clearHistory: function () {
      var key = accountKey();
      try {
        if (key) localStorage.removeItem(key);
        sessionStorage.removeItem(GUEST_KEY);
      } catch (e) {}
      this.messages = [];
    },

    push: function (role, html, extra) {
      var m = { id: uid(), role: role, html: html, t: now() };
      if (extra) for (var k in extra) { if (extra.hasOwnProperty(k)) m[k] = extra[k]; }
      this.messages.push(m);
      this.saveHistory();
      return m;
    },

    /* --------------------------------------------------------- the answer */
    /* Returns a plain object the UI renders. No DOM here on purpose: the flow
       is testable without a browser. */
    respond: function (question) {
      var q = String(question || "").trim();
      if (!q) return null;

      /* Mid-flow answers take priority over retrieval. */
      if (this.pending && this.pending.kind === "urgency") {
        var u = this.readUrgency(q);
        if (u) return this.handoff(u);
      }
      if (this.pending && this.pending.kind === "feedback") {
        /* "thank you" and "goodbye" are courtesy, not a rating. Treating them
           as a thumbs-up both skews the satisfaction figure and makes the bot
           reply with the wrong thing. Let small talk answer, and keep the
           feedback question open for a real yes or no. */
        if (!/^(thanks|thank you|thank u|nice one|well done|ok thanks|bye|goodbye|see you|later)\b/i
              .test(String(q).trim())) {
          var fb = this.readFeedback(q);
          if (fb !== null) return this.recordFeedback(fb);
        }
      }

      /* Conversation memory. "How much is Primary 3?" then "and Primary 4?"
         is one conversation, not two unrelated questions. Carry the previous
         topic forward when the new message is only a fragment, which is how
         people actually speak. */
      q = this.withContext(q);

      var greet = this.smallTalk(q);
      if (greet) return greet;

      /* A bare "it can wait" or "yes" outside a flow is a stray chip click,
         not a question. Only treat it as such when the whole message is that
         phrase, so real questions like "is there school today" are untouched. */
      if (/^(yes|no|yeah|nope|ok|okay|it can wait|i need it now|now|later|anytime)[.!]?$/i
            .test(String(q).trim())) {
        return { type: "smalltalk",
                 html: "No problem. What would you like to ask?",
                 chips: this.suggestions() };
      }

      /* Questions whose answer changes by the hour cannot come from a file
         built at deploy time. An emergency closure, today's status, the next
         PTA meeting or a class fee are read from live data at the moment the
         question is asked. */
      var live = this.liveAnswer(q);
      if (live) {
        this.stat("asked", q);
        this.stat("answered", q, 1);
        this.pending = { kind: "feedback", question: q, title: live.source || "Live school data" };
        return { type: "answer", html: live.html, source: live.source,
                 confidence: 1, feedback: true };
      }

      var res = global.TARag ? global.TARag.answer(q) : { band: "none", confidence: 0 };
      this.stat("asked", q);

      /* Not confident enough to be trusted with a parent's decision. */
      if (res.band === "low" || res.band === "none") {
        this.stat("unanswered", q);

        /* Never a bare dead end. Even with no confident match, the question
           usually has a shape - a topic word, a class, a subject - and the
           related thing the school DOES know is far more useful than
           "I don't know". Offer that first; the human is the last resort,
           not the first. */
        var near = this.nearestHelp(q, res);
        if (near) {
          this.pending = { kind: "feedback", question: q, title: near.source };
          return { type: "answer", html: near.html, source: near.source,
                   confidence: 0.3, feedback: true, salvaged: true };
        }

        this.pending = { kind: "urgency", question: q };
        return {
          type: "handoff-ask",
          html: "I could not find a confident answer to that in the school's " +
                "information, and I would rather not guess.<br><br>" +
                "<b>Do you need a reply right now, or can it wait?</b>",
          chips: ["I need it now", "It can wait"]
        };
      }

      /* The answer exists but belongs to the person's own record. */
      if (res.needs_login && !session()) {
        this.stat("login_required", q);
        return {
          type: "needs-login",
          html: "That information is tied to your own account, so I need you " +
                "to be logged in before I can show it.<br><br>" +
                "<b>" + esc(res.title) + "</b> is where it lives once you are in.",
          action: { label: "Log in / Register", kind: "login" },
          chips: ["Something else"]
        };
      }

      this.stat("answered", q, res.confidence);
      this.pending = { kind: "feedback", question: q, title: res.title };
      return {
        type: "answer",
        html: this.compose(res),
        source: res.title,
        url: res.url,
        confidence: res.confidence,
        feedback: true
      };
    },

    /* Build readable prose from the retrieved passage. Data passages are
       already written as sentences; page passages get trimmed to the part
       that actually matters. */
    compose: function (res) {
      var body = String(res.text || "").trim();
      if (body.length > 420) {
        var cut = body.slice(0, 420);
        var stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "));
        body = (stop > 180 ? cut.slice(0, stop + 1) : cut + "...");
      }
      var out = esc(body);
      if (res.url) {
        out += '<br><br><a class="chat-link" href="' + esc(res.url) + '">' +
               "Open " + esc(res.title) + "</a>";
      }
      return out;
    },

    /* What the last substantive question was about, so a fragment can inherit
       it. Held in memory only - it is conversational state, not history. */
    topic: null,

    /* Expand a fragment into a full question using the previous topic.
       "and primary 4?" after a fee question becomes "fees primary 4". */
    withContext: function (q) {
      var raw = String(q).trim();
      var ent = global.TAEntities ? global.TAEntities.read(raw) : null;
      var words = raw.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
                     .filter(Boolean);

      /* A fragment: short, and opening like a continuation. */
      var isFragment = words.length <= 6 &&
        /^(and|what about|how about|what of|also|then|ok what about|so)\b/
          .test(raw.toLowerCase());

      /* Or just a bare entity - "primary 4?" on its own. */
      var bareEntity = words.length <= 3 && ent &&
        (ent.klass || ent.subject || ent.thing) && !ent.intent;

      if ((isFragment || bareEntity) && this.topic) {
        var carried = this.topic + " " + raw;
        /* Remember the new subject but keep the old intent. */
        if (ent && ent.klass) this.topicClass = ent.klass;
        return carried;
      }

      /* A full question - remember what it was about for next time. */
      if (ent && ent.intent) {
        this.topic = ent.intent === "price" ? "fees"
                   : ent.intent === "timetable" ? "timetable"
                   : ent.intent === "lost" ? "lost property"
                   : ent.intent === "result" ? "results"
                   : ent.intent;
      } else if (words.length > 3) {
        /* No clear intent: keep the two most meaningful words. */
        var keep = words.filter(function (w) {
          return w.length > 3 && !/^(what|when|where|which|about|does|your|have|the|and|for|how|much|please|tell)$/.test(w);
        });
        if (keep.length) this.topic = keep.slice(0, 2).join(" ");
      }
      return raw;
    },

    /* When retrieval is not confident, work out what the question was ABOUT
       and answer that, honestly flagged. A parent asking something the school
       has never written down should still leave knowing the nearest fact and
       who to ask - not a shrug. */
    nearestHelp: function (q, res) {
      var ent = global.TAEntities ? global.TAEntities.read(q) : null;
      if (!ent) return null;
      var bits = [], where = "";

      /* They named a class - give that class's fee and where it sits. */
      if (ent.klass) {
        var db = null;
        try { if (typeof DB !== "undefined" && DB.load) db = DB.load(); } catch (e) {}
        var fees = (db && db.school && db.school.fees) || {};
        var label = ent.klass.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        var amount = null;
        for (var k in fees) {
          if (fees.hasOwnProperty(k) && k.toLowerCase() === ent.klass) amount = fees[k];
        }
        bits.push("<b>" + esc(label) + "</b>" +
                  (amount ? " costs <b>\u20a6" + Number(amount).toLocaleString("en-NG") +
                            "</b> per term." : " is one of our classes."));
        where = "academics.html";
      }

      /* They named a subject. */
      if (ent.subject) {
        bits.push("<b>" + esc(ent.subject.replace(/\b\w/g, function (c) {
          return c.toUpperCase(); })) + "</b> is taught here and appears in the " +
          "exam timetable.");
        where = where || "exams.html";
      }

      /* Retrieval had a near miss - not confident, but genuinely in the same
         area. Offer it as a suggestion rather than passing it off as the
         answer. Below this the "closest thing" is noise: suggesting School
         Hours to someone asking about swimming lessons helps nobody, and an
         honest handoff is the better answer. */
      if (!bits.length && res && res.title && res.confidence >= 0.26 &&
          res.band === "low") {
        bits.push("The closest thing I have is <b>" + esc(res.title) + "</b>.");
        where = res.url || "";
      }

      if (!bits.length) return null;

      return {
        source: res && res.title ? res.title : "School information",
        html: "I do not have that written down exactly, so I will not guess at " +
              "it.<br><br>" + bits.join("<br><br>") +
              (where ? "<br><br><a class=\"chat-link\" href=\"" + esc(where) +
                       "\">Open the page</a>" : "") +
              "<br><br>If that is not what you meant, ask me another way, or say " +
              "<b>talk to someone</b> and I will put you through to the school."
      };
    },

    /* Live answers. Returns null when the question is not one of these, and
       the normal retrieval path takes over. */
    liveAnswer: function (q) {
      /* store.js declares DB with `const`, so it is a script-scope binding and
         never lands on window. Reference it directly and let the try/catch
         handle the case where store.js has not loaded. */
      var db = null;
      try {
        if (typeof DB !== "undefined" && DB && typeof DB.load === "function") {
          db = DB.load();
        }
      } catch (e) { return null; }
      if (!db) return null;
      var s = String(q).toLowerCase();
      var school = db.school || {};
      var WHATSAPP = Core.WHATSAPP;
      /* What is this person actually asking about? */
      var ent = global.TAEntities ? global.TAEntities.read(q)
                                  : { intent: null, thing: null, klass: null, subject: null };

      function naira(n) {
        return "\u20a6" + Number(n || 0).toLocaleString("en-NG");
      }
      function dayName(d) {
        return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
                "Friday", "Saturday"][d.getDay()];
      }
      function pretty(iso) {
        var d = new Date(String(iso) + "T12:00:00");
        if (isNaN(d.getTime())) return String(iso);
        return dayName(d) + " " + d.getDate() + " " +
               ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November",
                "December"][d.getMonth()] + " " + d.getFullYear();
      }

      /* Internal or private information the bot must never try to supply,
         even though the words look familiar. A wifi password is not login
         help, and the school's own credentials are nobody's business. */
      if (/\b(wifi|wi-fi|router|network) *(password|code|key)\b|\b(staff|admin|teacher)('?s)? (password|pin|login)\b/.test(s)) {
        return { html: "That is internal to the school, so it is not something " +
                       "I can give out.<br><br>" +
                       "If you are staff and locked out, the headmistress resets " +
                       "staff PINs - see her, or call <b>" + WHATSAPP + "</b>. " +
                       "If you are a parent trying to reach your child's records, " +
                       "ask me about <b>logging in</b> instead.",
                 source: "Security" };
      }

      /* Things the school genuinely does not publish. Saying "I don't know"
         here is correct, but pointing at who does know is what makes it
         useful. */
      if (/\b(scholarship\w*|bursar\w*|free tuition|financial aid|grant for)\b/.test(s)) {
        return { html: "The school does not publish a scholarship or bursary " +
                       "scheme, so I have nothing on file.<br><br>" +
                       "Fee questions and any arrangement over payment are " +
                       "handled personally by the office - speak to the " +
                       "headmistress on <b>" + WHATSAPP + "</b>. Sibling " +
                       "discounts may apply where more than one child attends.",
                 source: "Fees" };
      }
      if (/\b(canteen\w*|cafeteria\w*|tuck shop|who cooks|kitchen)\b/.test(s) ||
          (ent.intent === "food")) {
        return { html: "Meals are served fresh daily and children eat at " +
                       "school - the Creche even has its own nap and meal " +
                       "routine.<br><br>" +
                       "The school does not publish a menu or canteen price " +
                       "list, so for exactly what is served this term, and any " +
                       "allergy arrangements, ask the office on <b>" +
                       WHATSAPP + "</b>.",
                 source: "School day" };
      }
      if (/\b(registered|accredit\w*|approved by|government|licence\w*|license\w*|ministry)\b/.test(s)) {
        return { html: "Treasure Academy has operated in Ageva since <b>2015</b> " +
                       "and has been on its own permanent site since 2018, " +
                       "running Creche through Primary 6.<br><br>" +
                       "Registration and accreditation papers are not published " +
                       "on the website - the office will show you the " +
                       "documents if you ask. Call <b>" + WHATSAPP + "</b> or " +
                       "visit; you are welcome to come and see the school.",
                 source: "About" };
      }

      /* An emergency notice outranks everything else on the site. */
      var emg = school.emergency;
      if (emg && emg.on && emg.text &&
          /\b(school|closed|close|open|today|holiday|resume|emergency)\b/.test(s)) {
        return { html: "<b>Notice from the school:</b><br>" + esc(emg.text),
                 source: "Emergency notice" };
      }

      /* Is there school today? */
      if (/\b(school|class|lesson)\b/.test(s) &&
          /\b(today|now|open|closed|running)\b/.test(s)) {
        var today = new Date();
        var weekend = today.getDay() === 0 || today.getDay() === 6;
        if (weekend) {
          return { html: "Today is " + dayName(today) + ", so there is no school. " +
                         "Lessons run Monday to Friday, 8:00am to 3:00pm.",
                   source: "School hours" };
        }
        return { html: "Yes, there is school today (" + dayName(today) + "). " +
                       "The gate opens at 7:00am, assembly is 7:45am and closing " +
                       "time is 3:00pm.",
                 source: "School hours" };
      }

      /* Fees for one named class, with the real figure. */
      if (/\b(fee|fees|cost|price|how much|pay)\b/.test(s)) {
        var fees = school.fees || {};
        var names = Object.keys(fees);
        for (var i = 0; i < names.length; i++) {
          var key = names[i].toLowerCase();
          var shortKey = key.replace("primary ", "p").replace("nursery ", "n");
          if (s.indexOf(key) >= 0 || (shortKey.length > 1 && s.indexOf(shortKey) >= 0)) {
            return { html: "<b>" + esc(names[i]) + "</b> is <b>" +
                           naira(fees[names[i]]) + "</b> per term.<br><br>" +
                           "Payment is by bank transfer to the school account, " +
                           "and a receipt number is issued once it is confirmed.",
                     source: "Fee list" };
          }
        }
        if (names.length && /\b(fee|fees|school fees|all|list|each|every)\b/.test(s)) {
          var rows = names.map(function (n) {
            return esc(n) + " " + naira(fees[n]);
          }).join("<br>");
          return { html: "<b>School fees per term:</b><br>" + rows +
                         "<br><br>All payments are by bank transfer to the school account.",
                   source: "Fee list" };
        }
      }

      /* The next PTA meeting. */
      if (/\bpta\b|parent teacher/.test(s)) {
        var pta = (db.ptaMeetings || []).slice().sort(function (a, b) {
          return String(a.date).localeCompare(String(b.date));
        });
        var todayIso = new Date().toISOString().slice(0, 10);
        var next = pta.filter(function (m) { return String(m.date) >= todayIso; })[0];
        if (next) {
          return { html: "The next <b>PTA</b> meeting is <b>" + esc(next.title) +
                         "</b> on " + pretty(next.date) +
                         (next.venue ? " at " + esc(next.venue) : "") + ".",
                   source: "PTA meetings" };
        }
        if (pta.length) {
          return { html: "No <b>PTA</b> meeting is scheduled at the moment. The " +
                         "last one was " + esc(pta[pta.length - 1].title) + " on " +
                         pretty(pta[pta.length - 1].date) + ".",
                   source: "PTA meetings" };
        }
      }

      /* The next exam paper. */
      if (/\bexam|test|paper\b/.test(s) && /\bnext|when|coming|soon\b/.test(s)) {
        var ex = (db.exams || []).slice().sort(function (a, b) {
          return String(a.date).localeCompare(String(b.date));
        });
        var iso = new Date().toISOString().slice(0, 10);
        var up = ex.filter(function (e) { return String(e.date) >= iso; })[0];
        if (up) {
          return { html: "The next paper is <b>" + esc(up.subject) + "</b> on " +
                         pretty(up.date) + (up.time ? " at " + esc(up.time) : "") +
                         (up.classes ? " for " + esc(up.classes) : "") + ".",
                   source: "Exam timetable" };
        }
      }

      /* ---- Who the school is. -------------------------------------------
         These are facts about the institution, so they are written here as
         facts rather than scraped out of prose. Every figure below appears on
         the About page; nothing is invented. Counts come from live data so
         they cannot go stale. */

      /* One class, from the class page data behind class.html?class=NAME. */
      if (ent.intent === "classinfo" && ent.klass) {
        var pages = db.classPages || [];
        for (var cp = 0; cp < pages.length; cp++) {
          if (String(pages[cp].class || "").toLowerCase() === ent.klass) {
            var page = pages[cp];
            var acts = (page.activities || []).slice(0, 6);
            var who = (db.staffWall || []).filter(function (x) {
              return x.name && !/\(demo\)/i.test(x.name) &&
                     String(x.class || "").toLowerCase() === ent.klass;
            })[0];
            var fee = (school.fees || {})[page.class];
            return { html: "<b>" + esc(page.class) + "</b>" +
                           (page.tagline ? " - " + esc(page.tagline) : "") + "<br><br>" +
                           esc(page.about || "") +
                           (acts.length ? "<br><br><b>What they do:</b><br>&bull; " +
                            acts.map(esc).join("<br>&bull; ") : "") +
                           (who ? "<br><br>Class teacher: <b>" + esc(who.name) + "</b>." : "") +
                           (fee ? "<br>Fee: <b>" + naira(fee) + "</b> per term." : "") +
                           "<br><br><a class=\"chat-link\" href=\"class.html?class=" +
                           encodeURIComponent(page.class) + "\">Open the " +
                           esc(page.class) + " page</a>",
                     source: page.class };
          }
        }
      }

      /* The whole ladder of classes, with ages where the school states them. */
      if (ent.intent === "classlist") {
        var names = (db.classPages || []).map(function (c) { return c.class; })
                      .filter(Boolean);
        if (!names.length) {
          names = Object.keys(school.fees || {});
        }
        if (names.length) {
          return { html: "Treasure Academy runs <b>" + names.length +
                         "</b> classes, from the youngest upwards:<br>&bull; " +
                         names.map(esc).join("<br>&bull; ") +
                         "<br><br>Creche takes babies from <b>six months</b>, and " +
                         "the ladder runs right through to <b>Primary 6</b>, so a " +
                         "child never has to change school mid-way.<br><br>" +
                         "Ask me about any one of them and I will tell you what " +
                         "happens in it.",
                   source: "Academics" };
        }
      }

      /* E-learning: Primary 6 Common Entrance practice, inside the portal. */
      if (ent.intent === "elearning") {
        var forP6 = /\bprimary\s*[1-5]\b|\bnursery\b|\bcreche\b/.test(s);
        return { html: "<b>E-Learning</b> at Treasure Academy is Common Entrance " +
                       "practice for <b>Primary 6</b>, inside the pupil portal - " +
                       "real-style questions in Mathematics, English, Basic " +
                       "Science and more, with an instant score after every " +
                       "attempt.<br><br>" +
                       (forP6
                         ? "It appears only on <b>Primary 6</b> dashboards, so " +
                           "younger classes do not see it yet.<br><br>"
                         : "The questions are uploaded by the school and grow " +
                           "every term.<br><br>") +
                       "Log in to the pupil portal to use it." +
                       "<br><br><a class=\"chat-link\" href=\"elearning.html\">" +
                       "Open E-Learning</a>",
                 source: "E-Learning" };
      }

      /* Clubs, excursions and everything outside the timetable - read from
         the activities the class pages actually list. */
      if (ent.intent === "activity" ||
          /\b(show ?(and|&) ?tell|trip|trips|outing)\b/.test(s)) {
        var byClass = {};
        (db.classPages || []).forEach(function (c) {
          (c.activities || []).forEach(function (a) {
            if (!byClass[a]) byClass[a] = [];
            byClass[a].push(c.class);
          });
        });
        var keys = Object.keys(byClass);
        /* Match on the words that carry meaning, and treat common synonyms
           for the same thing as the same thing. */
        var ALIAS = { trip: "excursion", trips: "excursion", outing: "excursion",
                      club: "club", clubs: "club", read: "reading",
                      quiz: "quiz", debate: "debate", code: "coding",
                      coding: "coding", computer: "computer" };
        var words = s.split(/\s+/).map(function (w) {
          var c = w.replace(/[^a-z]/g, "");
          return ALIAS[c] || c;
        }).filter(function (w) {
          return w.length > 3 &&
            !/^(what|when|where|which|about|does|your|have|they|this|that|there|with|from|children|child|pupil|pupils|school)$/.test(w);
        });
        var asked = keys.filter(function (a) {
          var la = a.toLowerCase();
          return words.some(function (w) { return la.indexOf(w) >= 0; });
        });
        if (asked.length) {
          return { html: asked.slice(0, 3).map(function (a) {
                     return "<b>" + esc(a) + "</b> - in " +
                            esc(byClass[a].join(", ")) + ".";
                   }).join("<br><br>") +
                   "<br><br>Every class has its own activities; ask me about a " +
                   "class to see the full list.",
                   source: "Academics" };
        }
        if (keys.length) {
          return { html: "<b>Beyond the lessons</b><br>Activities run by class " +
                         "include: " + esc(keys.slice(0, 14).join(", ")) +
                         ".<br><br>Ask me about a particular class for its own list.",
                   source: "Academics" };
        }
      }

      /* Homework. The owner's rule: no online submission. */
      if (ent.intent === "homework") {
        return { html: "Yes - homework is set by the class teacher and written " +
                       "in the pupil's book.<br><br>" +
                       "There is <b>no online submission</b>: work is done on " +
                       "paper and handed to the teacher, the way the school " +
                       "prefers it. Holiday assignments are given at the end of " +
                       "term.<br><br>If your child is unsure what was set, ask " +
                       "the class teacher.",
                 source: "Homework" };
      }

      /* What parents say. The testimonials page is painted by JavaScript, so
         there is no prose to scrape - the reviews live in the database and are
         read from there, approved ones only. */
      if (ent.intent === "testimonial") {
        var approved = (db.testimonials || []).filter(function (t) {
          return t.approved !== false && (t.text || t.message || t.body);
        });
        if (approved.length) {
          var quote = approved[0];
          var body = String(quote.text || quote.message || quote.body || "").trim();
          if (body.length > 220) body = body.slice(0, 217) + "...";
          return { html: "<b>" + approved.length + "</b> approved parent " +
                         (approved.length === 1 ? "review is" : "reviews are") +
                         " published on the <b>Testimonials</b> page.<br><br>" +
                         "\u201c" + esc(body) + "\u201d" +
                         (quote.name ? "<br><small>\u2014 " + esc(quote.name) +
                          (quote.role ? ", " + esc(quote.role) : "") + "</small>" : "") +
                         "<br><br><a class=\"chat-link\" href=\"testimonials.html\">" +
                         "Read them all</a>",
                   source: "Testimonials" };
        }
        return { html: "Parent reviews are collected on the <b>Testimonials</b> " +
                       "page. None are published at the moment - parents, " +
                       "teachers and pupils can submit one from their dashboard " +
                       "after logging in, and the school approves it before it " +
                       "appears.<br><br><a class=\"chat-link\" href=\"testimonials.html\">" +
                       "Open Testimonials</a>",
                 source: "Testimonials" };
      }

      /* Subjects. The list is read from what the school actually records
         against exams, results and class pages, so it stays true as the
         curriculum changes. Naming a subject we do not teach gets a plain
         "no", not a vague deflection. */
      if (ent.intent === "curriculum") {
        var found = {};
        (db.exams || []).forEach(function (e) { if (e.subject) found[e.subject] = 1; });
        (db.results || []).forEach(function (r) { if (r.subject) found[r.subject] = 1; });
        (db.classPages || []).forEach(function (c) {
          (c.subjects || []).forEach(function (x) { if (x) found[x] = 1; });
        });
        /* Teachers carry the subjects they actually teach, which is the most
           reliable list the school keeps. */
        (db.staffWall || []).forEach(function (t) {
          (t.subjects || []).forEach(function (x) { if (x) found[x] = 1; });
        });
        /* Class activities name real subjects - "Handwriting mastery",
           "Phonics & reading" - so recognise the subject inside the phrase. */
        var KNOWN = ["Handwriting", "Phonics", "Reading", "Spelling", "Grammar",
                     "Comprehension", "Essay writing", "Mental maths",
                     "Times tables", "Science", "Coding", "Debate",
                     "Computer", "Colouring", "Counting"];
        (db.classPages || []).forEach(function (c) {
          (c.activities || []).forEach(function (a) {
            KNOWN.forEach(function (k) {
              if (String(a).toLowerCase().indexOf(k.toLowerCase()) >= 0) found[k] = 1;
            });
          });
        });
        (db.teachers || []).forEach(function (t) {
          (t.subjects || []).forEach(function (x) { if (x) found[x] = 1; });
        });
        (db.timetable || []).forEach(function (row) {
          (row.periods || []).forEach(function (x) {
            if (x && typeof x === "string") found[x] = 1;
          });
        });
        var subjects = Object.keys(found).filter(function (x) {
          return !/^school fees/i.test(x);
        }).sort();

        /* They named one. Answer about that one. */
        if (ent.subject) {
          var want = ent.subject.toLowerCase();
          var taught = subjects.filter(function (x) {
            return x.toLowerCase().indexOf(want) >= 0 ||
                   want.indexOf(x.toLowerCase()) >= 0;
          });
          if (taught.length) {
            return { html: "Yes - <b>" + esc(taught[0]) + "</b> is taught here." +
                           (subjects.length ? "<br><br>The full list: " +
                            esc(subjects.join(", ")) + "." : ""),
                     source: "Curriculum" };
          }
        }
        /* A subject word we know of but the school does not record. */
        var missing = null;
        if (/\bfrench\b/.test(s)) missing = "French";
        else if (/\barabic\b/.test(s)) missing = "Arabic";
        else if (/\bmusic\b/.test(s)) missing = "Music";
        else if (/\bspanish\b/.test(s)) missing = "Spanish";
        if (missing) {
          return { html: "<b>" + missing + "</b> is not one of the subjects the " +
                         "school records, so I would say no - but the office can " +
                         "confirm what is offered this term on <b>" + WHATSAPP +
                         "</b>." +
                         (subjects.length ? "<br><br>What is taught: " +
                          esc(subjects.join(", ")) + "." : ""),
                   source: "Curriculum" };
        }
        if (subjects.length) {
          return { html: "<b>Subjects taught</b><br>" + esc(subjects.join(", ")) +
                         ".<br><br>Primary 6 also practises <b>Common Entrance</b> " +
                         "questions in the portal through the year.",
                   source: "Curriculum" };
        }
      }

      /* "Tell me about the school" - the broadest possible question, and the
         one a first-time visitor actually asks. Answer it as a person would:
         what it is, how long, what it covers, and one way in. */
      if (ent.intent === "location") {
        return { html: "Treasure Academy is at <b>Ageva, Okene, Kogi State</b>." +
                       "<br><br>The office is open <b>Monday to Friday, 7:30am " +
                       "to 3:00pm</b>, and you are welcome to call in. The " +
                       "<b>Contact</b> page has a map and directions, and school " +
                       "transport runs on three routes - Adavi, Okene Town and " +
                       "Ageva.<br><br>Phone or WhatsApp: <b>" + WHATSAPP + "</b>" +
                       "<br><a class=\"chat-link\" href=\"contact.html\">" +
                       "Directions and map</a>",
                 source: "Contact" };
      }

      if (ent.intent === "overview") {
        var nClasses = (db.classPages || []).length ||
                       Object.keys(school.fees || {}).length;
        return { html: "<b>Treasure Academy, Ageva</b> is a private school in " +
                       "Ageva, Okene, Kogi State, founded in <b>2015</b> by " +
                       "Shaibu Sidikat Ruth and run today by headmistress " +
                       "<b>Mrs. Salihu Nanahawa</b>.<br><br>" +
                       "It covers " + (nClasses ? "<b>" + nClasses + "</b> classes " : "") +
                       "from <b>Creche</b> at six months right through to " +
                       "<b>Primary 6</b>, on its own permanent site since 2018, " +
                       "with a computer room, library, playground and an online " +
                       "portal where parents check results.<br><br>" +
                       "In 2024 every Primary 6 pupil passed the Common " +
                       "Entrance.<br><br>" +
                       "Ask me about fees, a particular class, admissions or " +
                       "visiting - I can go into any of it.",
                 source: "About" };
      }

      if (ent.intent === "leadership") {
        return { html: "<b>Mrs. Salihu Nanahawa</b> is the headmistress and runs " +
                       "the school day to day.<br><br>" +
                       "The school was founded and is owned by " +
                       "<b>Shaibu Sidikat Ruth</b>, Founder and Proprietress, " +
                       "who started it in 2015.<br><br>" +
                       "Either can be reached through the school office on <b>" +
                       WHATSAPP + "</b>.",
                 source: "About" };
      }

      if (ent.intent === "staffinfo") {
        var team = (db.staffWall || []).filter(function (x) {
          return x.name && !/\(demo\)/i.test(x.name);
        });
        if (team.length) {
          var teaching = team.filter(function (x) { return x.class; });
          var others = team.filter(function (x) { return !x.class; });
          var html = "<b>The team</b><br>" +
            teaching.map(function (x) {
              return "&bull; <b>" + esc(x.name) + "</b> - " + esc(x.class) +
                     (x.quals ? " <small>(" + esc(x.quals) + ")</small>" : "");
            }).join("<br>");
          if (others.length) {
            html += "<br><br><b>Support</b><br>" + others.map(function (x) {
              return "&bull; <b>" + esc(x.name) + "</b> - " +
                     esc(x.position || "staff") +
                     (x.quals ? " <small>(" + esc(x.quals) + ")</small>" : "");
            }).join("<br>");
          }
          html += "<br><br>Every teacher is qualified - the school hires for " +
                  "character first, then skill.";
          return { html: html, source: "Staff list" };
        }
      }

      if (ent.intent === "pickup") {
        return { html: "Pupils are released only to a <b>parent or a named " +
                       "guardian</b> - never to whoever turns up. If someone " +
                       "else must collect your child, tell the class teacher or " +
                       "the office beforehand.<br><br>" +
                       "Closing is <b>3:00pm</b>, and children are supervised " +
                       "until they are collected. Supervised school transport " +
                       "runs on three routes if you would rather your child came " +
                       "home by bus.",
                 source: "School day" };
      }

      if (ent.intent === "founder") {
        return { html: "Treasure Academy was founded in <b>2015</b> by " +
                       "<b>Shaibu Sidikat Ruth</b>, a mother and trained " +
                       "teacher, who wanted the children of Ageva to have a " +
                       "school that feels like home and teaches like the very " +
                       "best.<br><br>" +
                       "It began with a handful of pupils and a few teachers in " +
                       "a rented apartment, and moved to its own permanent site " +
                       "in <b>2018</b>. She remains Founder and Proprietress.<br><br>" +
                       "The headmistress who runs the school day to day is " +
                       "<b>Mrs. Salihu Nanahawa</b>.",
                 source: "About" };
      }

      if (ent.intent === "mission") {
        return { html: "<b>Mission</b><br>Building an effective and efficient " +
                       "future leader - raising confident, brilliant and " +
                       "well-mannered children through strong academics and " +
                       "morals.<br><br>" +
                       "<b>Vision</b><br>To be the most trusted school in Okene, " +
                       "where every graduate shines in secondary school and " +
                       "beyond.<br><br>" +
                       "The promise the school repeats most often: " +
                       "<i>every child can excel - our work is to give them the " +
                       "foundation to do so</i>.",
                 source: "About" };
      }

      if (ent.intent === "history") {
        return { html: "<b>The journey so far</b><br>" +
                       "<b>2015</b> - Founded by Shaibu Sidikat Ruth: a handful " +
                       "of pupils, a few teachers, one big dream.<br>" +
                       "<b>2018</b> - Moved to a permanent site in Ageva with " +
                       "bigger classrooms and a playground.<br>" +
                       "<b>2021</b> - Computer room and library opened; the " +
                       "coding club began for Primary pupils.<br>" +
                       "<b>2024</b> - 100% Common Entrance pass; all Primary 6 " +
                       "pupils entered top secondary schools.<br>" +
                       "<b>2026</b> - Online portal launched, putting results, " +
                       "attendance and notices on parents' phones.",
                 source: "About" };
      }

      if (ent.intent === "facilities") {
        /* Answer about the specific thing asked for, the same rule used for
           lost property: name it, then give the rest. */
        var have = {
          "library": "a <b>library</b>, opened in 2021 - pupils borrow books home",
          "computer": "a <b>computer room</b>, opened in 2021, with a coding club for Primary pupils",
          "playground": "a <b>playground</b>, on the permanent site since 2018",
          "classroom": "bright <b>classrooms</b> on the school's own permanent site",
          "portal": "an <b>online portal</b> where parents check results, attendance and notices",
          "sick": "a <b>sick bay</b> for minor injuries, with parents called straight away"
        };
        var askedFor = null;
        if (/\blibrar/.test(s)) askedFor = "library";
        else if (/\bcomputer|ict|coding|lab\b/.test(s)) askedFor = "computer";
        else if (/\bplay ?ground|play area\b/.test(s)) askedFor = "playground";
        else if (/\bsick|clinic|nurse|first aid\b/.test(s)) askedFor = "sick";

        /* Things the school does not have. Saying so plainly is better than a
           vague answer that leaves a parent assuming. */
        if (/\bswimming|pool\b/.test(s)) {
          return { html: "There is no <b>swimming pool</b> - Treasure Academy " +
                         "does not offer swimming.<br><br>What the school does " +
                         "have: a computer room, a library, a playground and a " +
                         "sick bay, all on its own permanent site.<br><br>" +
                         "If that matters for your decision, the office can talk " +
                         "you through the school day on <b>" + WHATSAPP + "</b>.",
                   source: "About" };
        }
        if (/\b(boarding|hostel|dormitory|sleep over)\b/.test(s)) {
          return { html: "Treasure Academy is a <b>day school</b> - there is no " +
                         "boarding. Pupils arrive from 7:00am and are collected " +
                         "by 3:00pm, and supervised transport runs on three " +
                         "routes if you need it.",
                   source: "About" };
        }

        var all = "a <b>computer room</b> and <b>library</b> (both since 2021, " +
                  "with a coding club), a <b>playground</b>, classrooms on the " +
                  "school's own permanent site, a <b>sick bay</b>, and an " +
                  "<b>online portal</b> for parents.";
        if (askedFor) {
          return { html: "Yes - the school has " + have[askedFor] + ".<br><br>" +
                         "Altogether: " + all,
                   source: "About" };
        }
        return { html: "<b>What the school has</b><br>" + all +
                       "<br><br>Supervised transport runs on three routes.",
                 source: "About" };
      }

      if (ent.intent === "performance") {
        return { html: "In <b>2024</b> every Primary 6 pupil passed the " +
                       "<b>Common Entrance</b> examination - a 100% pass rate - " +
                       "and all of them went on to top secondary schools.<br><br>" +
                       "Primary 6 pupils practise Common Entrance questions " +
                       "inside the portal through the year, which is how that " +
                       "result is built rather than hoped for.",
                 source: "About" };
      }

      if (ent.intent === "staffcount") {
        var teachers = (db.teachers || []).length;
        var pupils = (db.pupils || []).length;
        var lines = [];
        if (teachers) lines.push("<b>" + teachers + "</b> teaching staff are on the roll");
        if (pupils) lines.push("<b>" + pupils + "</b> pupils are currently enrolled");
        if (lines.length) {
          return { html: lines.join(", and ") + ".<br><br>Classes are kept " +
                         "deliberately small so every child is known by name " +
                         "rather than by number. The exact size of a particular " +
                         "class changes each term - the office will tell you " +
                         "what it is right now on <b>" + WHATSAPP + "</b>.",
                   source: "Staff list" };
        }
        return { html: "Classes are kept deliberately small so every child is " +
                       "known by name. Exact numbers change each term, so the " +
                       "office is the reliable source - <b>" + WHATSAPP + "</b>.",
                 source: "About" };
      }

      /* ---- People who are not parents here yet. -------------------------
         Prospective parents, job seekers, organisations. These visitors are
         the reason a school has a website at all, and the old bot had nothing
         for them. Every answer ends with a next step. */

      /* Someone looking for work. */
      if (ent.intent === "employment") {
        return { html: "<b>Teaching and support roles</b><br>" +
                       "Treasure Academy hires for character first, then skill - " +
                       "people who keep promises, speak kindly and treat every child " +
                       "like their own. Qualifications matter, but discipline and " +
                       "warmth matter more.<br><br>" +
                       "What you get: small classes, supportive leadership, a termly " +
                       "teaching plan that actually guides you, and pay discussed at " +
                       "interview and paid on time.<br><br>" +
                       "Apply with the form on the <b>Careers</b> page - name, " +
                       "WhatsApp number, the role, your highest qualification and " +
                       "brief experience. Shortlisted applicants are called within " +
                       "<b>two weeks</b>.<br><br>" +
                       "<a class=\"chat-link\" href=\"careers.html\">Open the Careers page</a>",
                 source: "Careers" };
      }

      /* Organisations, sponsors, would-be partners. We hold no partner list,
         so say that honestly and route them to a person rather than invent
         names. */
      if (ent.intent === "partner") {
        return { html: "Partnerships, sponsorships and supplier enquiries are " +
                       "handled personally by the school office rather than listed " +
                       "on the website, so I do not have a published list to read " +
                       "from.<br><br>" +
                       "The quickest route is to speak to the headmistress, " +
                       "<b>Mrs. Salihu Nanahawa</b>, directly on <b>" + WHATSAPP +
                       "</b>, or send the details through the <b>Contact</b> page " +
                       "and the office will come back to you by email.<br><br>" +
                       "If you are offering support in kind - books, furniture, " +
                       "fans - the <b>Support Us</b> page lists what the school is " +
                       "currently asking for.",
                 source: "Contact" };
      }

      /* A parent thinking about bringing a child here. */
      if (ent.intent === "enrol") {
        var fees0 = school.fees || {};
        var keys0 = Object.keys(fees0);
        var range = "";
        if (keys0.length) {
          var amounts = keys0.map(function (k) { return Number(fees0[k]) || 0; })
                             .filter(function (n) { return n > 0; })
                             .sort(function (a, b) { return a - b; });
          if (amounts.length) {
            range = "<br><br>Fees run from <b>" + naira(amounts[0]) + "</b> to <b>" +
                    naira(amounts[amounts.length - 1]) + "</b> per term depending on " +
                    "the class. Ask me about any class for its exact fee.";
          }
        }
        return { html: "<b>Yes - admissions are open.</b><br>" +
                       "Treasure Academy takes children from <b>Creche</b> " +
                       "(6 months) through <b>Nursery</b> to <b>Primary 6</b>, at " +
                       "Ageva, Okene, Kogi State." + range + "<br><br>" +
                       "<b>How to start:</b> tap <b>Login/Register</b> and complete " +
                       "the three steps - ward, guardian, payment - then visit the " +
                       "school within two weeks to finish. If you would rather see " +
                       "the place first, just come to the office; you are welcome to " +
                       "look around.<br><br>" +
                       "Already have a child here? Register the second one with the " +
                       "same phone number and both sit under one account.<br><br>" +
                       "<a class=\"chat-link\" href=\"admissions.html\">Open Admissions</a>",
                 source: "Admissions" };
      }

      /* Someone who wants to come and look. */
      if (ent.intent === "visit") {
        return { html: "You are welcome to visit. The school is at <b>Ageva, Okene, " +
                       "Kogi State</b> and the office is open <b>Monday to Friday, " +
                       "7:30am to 3:00pm</b>.<br><br>" +
                       "No appointment is needed to look around, but a quick message " +
                       "on <b>" + WHATSAPP + "</b> means someone is expecting you and " +
                       "the headmistress can make time for your questions.<br><br>" +
                       "<a class=\"chat-link\" href=\"contact.html\">Directions and map</a>",
                 source: "Contact" };
      }

      /* Why this school rather than another. Answered from what is true. */
      if (ent.intent === "compare") {
        return { html: "Fair question. What the school actually offers:<br><br>" +
                       "&bull; <b>Small classes</b>, so a child is known by name, not " +
                       "by number.<br>" +
                       "&bull; <b>Creche to Primary 6</b> on one site - no moving your " +
                       "child mid-way.<br>" +
                       "&bull; Founded in <b>2015</b> by Shaibu Sidikat Ruth, a mother " +
                       "and trained teacher, and on its own permanent site since " +
                       "year three.<br>" +
                       "&bull; <b>Common Entrance practice</b> built into Primary 6.<br>" +
                       "&bull; Supervised <b>school transport</b> on three routes.<br>" +
                       "&bull; Results, attendance and fees visible to parents in the " +
                       "portal, not locked in a file.<br><br>" +
                       "The honest way to judge it is to visit while school is " +
                       "running and watch how the children behave.",
                 source: "About" };
      }

      /* Safety - the question every parent asks and few sites answer. */
      if (ent.intent === "safety") {
        return { html: "Children are supervised from arrival to pick-up. The gate " +
                       "opens at 7:00am, assembly is 7:45am and closing is 3:00pm; " +
                       "pupils are released to a parent or a named guardian, not to " +
                       "anyone who turns up.<br><br>" +
                       "A duty teacher is on the assembly ground each day, minor " +
                       "injuries are handled at the sick bay and you are called " +
                       "straight away if your child is unwell.<br><br>" +
                       "If something has happened today, do not wait for email - " +
                       "call the school on <b>" + WHATSAPP + "</b>.",
                 source: "School day" };
      }

      /* Term dates, straight from the calendar. */
      if (/\bresumption|resume|term date|calendar|deadline|closing date|last day|cut off|cut-off|when.*(start|begin|open)\b/.test(s)) {
        var cal = (db.calendar || []).slice().sort(function (a, b) {
          return String(a.date).localeCompare(String(b.date));
        });
        var iso0 = new Date().toISOString().slice(0, 10);
        var soon = cal.filter(function (c) { return String(c.date) >= iso0; })[0];
        /* The admission deadline is resumption + 14 days. The upcoming list
           only holds future events, so once term starts resumption drops out
           and the deadline used to vanish for parents asking mid-term. Fall
           back to the whole calendar so the date is still quoted, and report
           it honestly as closed. */
        var resAny = cal.filter(function (c) {
          return /resump/i.test(c.title || "");
        }).sort(function (a, b) {
          return String(b.date).localeCompare(String(a.date));
        })[0];
        var tail = "<br><br>Ask the office about the admission deadline for this term.";
        if (resAny) {
          var dd = new Date(String(resAny.date) + "T12:00:00");
          dd.setDate(dd.getDate() + 14);
          var dIso = dd.toISOString().slice(0, 10);
          var left = Math.round((dd - new Date()) / 86400000);
          tail = "<br><br>Admission deadline: <b>" + pretty(dIso) + "</b> (" +
                 (left < 0 ? "closed" : left === 0 ? "closes today" : left + " days left") + ").";
        }
        if (soon) {
          return { html: "<b>" + esc(soon.title) + "</b> is on " + pretty(soon.date) +
                         "." + tail, source: "School calendar" };
        }
        if (cal.length) {
          return { html: "Term dates are being updated. The last entry on the " +
                         "calendar was <b>" + esc(cal[cal.length - 1].title) +
                         "</b> on " + pretty(cal[cal.length - 1].date) + "." + tail,
                   source: "School calendar" };
        }
        /* No calendar loaded yet. Still answer rather than dropping the
           person into a handoff for a question the school can obviously
           answer. */
        return { html: "The term calendar is being updated, so I do not have " +
                       "the dates in front of me." + tail + "<br><br>" +
                       "The <b>Calendar</b> page always carries the current " +
                       "dates, or call the office on <b>" + WHATSAPP + "</b>.",
                 source: "School calendar" };
      }

      /* Who teaches a class.

         Two lists exist. db.teachers is the login roster and still carries
         retired demo rows marked "(demo)"; db.staffWall is the real staff the
         school publishes, with qualifications. Prefer the staff wall, and
         never read out a demo name to a parent. */
      if (/\b(who|which teacher|class teacher)\b/.test(s) && /\bteach|teacher\b/.test(s)) {
        var real = (db.staffWall || []).filter(function (x) {
          return x.name && !/\(demo\)/i.test(x.name);
        });
        var roster = (db.teachers || db.staff || []).filter(function (x) {
          return x.name && !/\(demo\)/i.test(x.name);
        });
        var pool = real.length ? real : roster;
        var wantCls = ent.klass;

        for (var t = 0; t < pool.length; t++) {
          var cls = String(pool[t].class || pool[t].className || "").toLowerCase();
          if (!cls) continue;
          if ((wantCls && cls === wantCls) || (!wantCls && s.indexOf(cls) >= 0)) {
            return { html: "<b>" + esc(pool[t].name) + "</b> is the " +
                           esc(String(pool[t].position || "class teacher").toLowerCase()) +
                           " for <b>" + esc(pool[t].class || pool[t].className) + "</b>" +
                           (pool[t].quals ? ", holding " + esc(pool[t].quals) : "") + ".",
                     source: "Staff list" };
          }
        }

        /* Asked about staff generally rather than one class. */
        if (/\b(staff|teachers|team|qualif)\b/.test(s) && pool.length) {
          var listed = pool.slice(0, 12).map(function (x) {
            return "&bull; <b>" + esc(x.name) + "</b>" +
                   (x.class ? " - " + esc(x.class) : "") +
                   (x.quals ? " <small>(" + esc(x.quals) + ")</small>" : "");
          }).join("<br>");
          return { html: "<b>The teaching team</b><br>" + listed +
                         "<br><br>Every teacher is qualified, and the school " +
                         "hires for character first.",
                   source: "Staff list" };
        }
      }

      /* Phone and WhatsApp. */
      if (/\b(call|phone|number|whatsapp|reach|speak to)\b/.test(s)) {
        return { html: "You can reach the school on <b>" + WHATSAPP + "</b> " +
                       "(WhatsApp or call).<br><br>For anything that can wait, " +
                       "the message form on the <b>Contact</b> page replies by email.",
                 source: "Contact" };
      }

      /* Lost property. A parent naming a specific item deserves a specific
         answer about THAT item - "no cardigan has been handed in" - and then
         the next most useful thing, never a bare referral. Checked before
         uniform because "lost his cardigan" is not a price enquiry. */
      if (ent.intent === "lost") {
        var lf = (db.lostfound || []).filter(function (x) {
          return !x.claimed && !x.archived;
        });
        var listAll = function () {
          return lf.slice(0, 6).map(function (x) {
            return "&bull; " + esc(x.item) + (x.date ? " <small>(handed in " +
                   esc(x.date) + ")</small>" : "");
          }).join("<br>");
        };

        /* They named something. Answer about that thing first. */
        if (ent.thing && global.TAEntities) {
          var hit = lf.filter(function (x) {
            return global.TAEntities.matches((x.item || "") + " " + (x.desc || ""), ent.thing);
          });
          if (hit.length) {
            return { html: "Good news - something matching that is waiting at the " +
                           "school office:<br><br>" +
                           hit.slice(0, 4).map(function (x) {
                             return "&bull; <b>" + esc(x.item) + "</b>" +
                                    (x.desc ? "<br><small>" + esc(x.desc) + "</small>" : "") +
                                    (x.date ? "<br><small>Handed in " + esc(x.date) + "</small>" : "");
                           }).join("<br><br>") +
                           "<br><br>Describe it at the office to collect it.",
                     source: "Lost & Found" };
          }
          /* Not there. Say so about their item, then still be useful. */
          if (lf.length) {
            return { html: "No <b>" + esc(ent.thing) + "</b> has been handed in yet, " +
                           "so nothing matches that exactly.<br><br>These are the " +
                           "items currently unclaimed:<br>" + listAll() +
                           "<br><br>Items are usually handed in a day or two later, " +
                           "so it is worth checking at the office. If it does not " +
                           "turn up, tell the class teacher so they can watch for it.",
                     source: "Lost & Found" };
          }
          return { html: "No <b>" + esc(ent.thing) + "</b> has been handed in, and " +
                         "the Lost &amp; Found is empty at the moment.<br><br>" +
                         "Tell the class teacher so they can look out for it, and " +
                         "check again in a day or two - things are usually found " +
                         "after the classrooms are swept.",
                   source: "Lost & Found" };
        }

        /* No specific item named. */
        if (lf.length) {
          return { html: "<b>Unclaimed items at the school office:</b><br>" +
                         listAll() +
                         "<br><br>Describe yours at the office to collect it.",
                   source: "Lost & Found" };
        }
        return { html: "Nothing is waiting in <b>Lost &amp; Found</b> right now. " +
                       "If your child has lost something today, tell the class " +
                       "teacher - most things are found once the classrooms are swept.",
                 source: "Lost & Found" };
      }

      /* Uniform prices. */
      if (/\buniform|shirt|skirt|short|cardigan|sandal|beret|sock\b/.test(s)) {
        var uni = db.uniform || [];
        if (uni.length) {
          for (var u = 0; u < uni.length; u++) {
            var nm = String(uni[u].name || "").toLowerCase();
            if (nm && s.split(" ").some(function (w) {
                  return w.length > 3 && nm.indexOf(w) >= 0; })) {
              return { html: "<b>" + esc(uni[u].name) + "</b> is <b>" +
                             naira(uni[u].price) + "</b>.",
                       source: "Uniform price list" };
            }
          }
          var ulist = uni.map(function (x) {
            return esc(x.name) + " " + naira(x.price);
          }).join("<br>");
          return { html: "<b>Uniform prices:</b><br>" + ulist +
                         "<br><br>Uniforms are collected at the school office.",
                   source: "Uniform price list" };
        }
      }
      return null;
    },

    smallTalk: function (q) {
      var s = q.toLowerCase().replace(/[^a-z\s]/g, " ").trim();
      /* A greeting only counts when the message is essentially just that.
         "abeg who be the head of the school" is a question with a polite
         opener, not a hello. */
      if (/^(hi|hello|hey|yo|good (morning|afternoon|evening)|how far|abeg)\b/.test(s) &&
          s.split(/\s+/).filter(Boolean).length <= 4) {
        return { type: "smalltalk", html: this.greeting(), chips: this.suggestions() };
      }
      if (/^(thanks|thank you|thank u|nice one|well done|ok thanks)\b/.test(s)) {
        return { type: "smalltalk", html: "You are very welcome. Anything else I can check for you?" };
      }
      if (/^(bye|goodbye|see you|later)\b/.test(s)) {
        return { type: "smalltalk", html: "Goodbye, and thank you for visiting Treasure Academy." };
      }
      return null;
    },

    greeting: function () {
      var s = session();
      var who = s && s.name ? (", " + String(s.name).split(" ")[0]) : "";
      return "Hello" + esc(who) + ". I am <b>Treasure Bot</b>, the assistant for " +
             "<b>Treasure Academy, Ageva</b>.<br><br>" +
             "I can answer questions about admissions, fees, results, the exam " +
             "timetable, transport, uniform, the shop and school hours - I read " +
             "the school's own pages to answer.<br><br>" +
             (s ? "You are logged in, so I can also point you to your own records."
                : "Some answers are personal to your account. If you ask for one " +
                  "of those I will offer to log you in first.") +
             "<br><br>What would you like to know?";
    },

    /* Suggested questions. They follow the conversation rather than sitting
       static, because the most useful next question depends on what was just
       asked - and a new visitor needs different prompts from a parent who is
       already logged in. */
    suggestions: function () {
      var t = this.topic;
      if (t === "fees") {
        return ["How do I pay?", "Is there a sibling discount?",
                "What does the uniform cost?", "When is the deadline?"];
      }
      if (t === "lost property") {
        return ["What else is unclaimed?", "Where is the school office?",
                "School hours", "Call the school"];
      }
      if (t === "employment") {
        return ["What roles are open?", "How do I apply?",
                "Where is the school?", "Who is the headmistress?"];
      }
      if (t === "enrol" || t === "visit") {
        return ["How much are the fees?", "Can I visit the school?",
                "What classes do you have?", "How do I register?"];
      }
      if (t === "timetable" || t === "results") {
        return ["When is the next exam?", "When does term end?",
                "How much are the fees?", "School hours"];
      }
      if (session()) {
        return ["My results", "My fees balance", "When is the next exam?",
                "School hours"];
      }
      return ["How much are the fees?", "What time does school close?",
              "Can I visit the school?", "How do I register my child?"];
    },

    /* ------------------------------------------------- urgency and handoff */
    readUrgency: function (text) {
      var s = text.toLowerCase();
      if (/\b(now|urgent|urgently|immediate|immediately|right now|fast|quick|asap|today|emergency|chat|talk|agent|human|person|call)\b/.test(s)) return "now";
      if (/\b(wait|later|anytime|any time|no rush|not urgent|whenever|tomorrow|email|form|message)\b/.test(s)) return "later";
      return null;
    },

    handoff: function (kind) {
      var q = (this.pending && this.pending.question) || "";
      this.pending = null;
      this.stat(kind === "now" ? "handoff_whatsapp" : "handoff_ticket", q);

      if (kind === "now") {
        var text = encodeURIComponent(
          "Hello Treasure Academy, I need help with: " + q);
        return {
          type: "handoff-whatsapp",
          html: "For a real-time reply, talk to a person on WhatsApp.<br><br>" +
                "<b>Support line: " + WHATSAPP + "</b><br>" +
                "Someone will chat with you directly. I have written your " +
                "question into the message so you do not have to type it again.",
          action: { label: "Open WhatsApp", kind: "whatsapp",
                    href: "https://wa.me/234" + WHATSAPP.replace(/^0/, "") + "?text=" + text },
          chips: ["Ask something else"]
        };
      }
      return {
        type: "handoff-ticket",
        html: "Then the best route is the message form on the <b>Contact</b> " +
              "page. It reaches the school office and the reply comes to you " +
              "by email, so you do not have to wait by your phone.<br><br>" +
              "I will carry your question across for you.",
        action: { label: "Open the contact form", kind: "contact",
                  href: "contact.html?q=" + encodeURIComponent(q) },
        chips: ["Ask something else"]
      };
    },

    /* --------------------------------------------------------- feedback */
    readFeedback: function (text) {
      var s = text.toLowerCase();
      if (/^(yes|yeah|yep|resolved|solved|helpful|thanks|thank you|good|correct|that helps)\b/.test(s)) return true;
      if (/^(no|nope|not really|unresolved|not resolved|wrong|unhelpful|bad)\b/.test(s)) return false;
      return null;
    },

    recordFeedback: function (helpful) {
      var p = this.pending || {};
      this.pending = null;
      this.stat(helpful ? "resolved" : "not_resolved", p.question || "", null, p.title);

      if (helpful) {
        return {
          type: "resolved",
          html: "Good - I am glad that helped. You can ask me anything else " +
                "whenever you need to.",
          chips: this.suggestions()
        };
      }
      this.pending = { kind: "urgency", question: p.question || "" };
      return {
        type: "handoff-ask",
        html: "Sorry that did not help. Let me put you in front of a person " +
              "instead.<br><br><b>Do you need a reply right now, or can it wait?</b>",
        chips: ["I need it now", "It can wait"]
      };
    },

    /* --------------------------------------------------------- analytics */
    /* Local, aggregate, and deliberately free of personal data: the question
       text is kept so the developer can see what the bot could not answer,
       which is the whole point of the dashboard. */
    stat: function (event, question, confidence, title) {
      var s = readJSON(localStorage, STATS_KEY, null) || {
        totals: {}, unanswered: [], asked: {}, daily: {},
        confidence: [], started: now()
      };
      s.totals[event] = (s.totals[event] || 0) + 1;

      var day = new Date().toISOString().slice(0, 10);
      s.daily[day] = s.daily[day] || {};
      s.daily[day][event] = (s.daily[day][event] || 0) + 1;

      var q = String(question || "").trim().slice(0, 140);
      if (event === "asked" && q) {
        var k = q.toLowerCase();
        s.asked[k] = (s.asked[k] || 0) + 1;
      }
      if ((event === "unanswered" || event === "not_resolved") && q) {
        s.unanswered.unshift({ q: q, t: now(), why: event, topic: title || "" });
        s.unanswered = s.unanswered.slice(0, 80);
      }
      if (typeof confidence === "number") {
        s.confidence.push(Math.round(confidence * 100));
        if (s.confidence.length > 300) s.confidence = s.confidence.slice(-300);
      }
      s.loggedIn = !!session();
      writeJSON(localStorage, STATS_KEY, s);
    },

    stats: function () {
      var s = readJSON(localStorage, STATS_KEY, null) || {
        totals: {}, unanswered: [], asked: {}, daily: {}, confidence: []
      };
      var t = s.totals || {};
      var answered = t.answered || 0;
      var resolved = t.resolved || 0;
      var notResolved = t.not_resolved || 0;
      var unanswered = t.unanswered || 0;
      var handoffs = (t.handoff_whatsapp || 0) + (t.handoff_ticket || 0);
      var asked = t.asked || 0;
      var rated = resolved + notResolved;

      var top = Object.keys(s.asked || {})
        .map(function (k) { return { q: k, n: s.asked[k] }; })
        .sort(function (a, b) { return b.n - a.n; }).slice(0, 12);

      var avgConf = (s.confidence && s.confidence.length)
        ? Math.round(s.confidence.reduce(function (a, b) { return a + b; }, 0) / s.confidence.length)
        : 0;

      return {
        totalQuestions: asked,
        answered: answered,
        unanswered: unanswered,
        resolutionRate: asked ? Math.round((answered / asked) * 100) : 0,
        satisfaction: rated ? Math.round((resolved / rated) * 100) : 0,
        handoffRate: asked ? Math.round((handoffs / asked) * 100) : 0,
        handoffWhatsapp: t.handoff_whatsapp || 0,
        handoffTicket: t.handoff_ticket || 0,
        loginRequired: t.login_required || 0,
        avgConfidence: avgConf,
        topQuestions: top,
        gaps: s.unanswered || [],
        daily: s.daily || {},
        raw: t
      };
    },

    resetStats: function () {
      try { localStorage.removeItem(STATS_KEY); } catch (e) {}
    }
  };

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  Core.esc = esc;
  global.TAChat = Core;
})(typeof window !== "undefined" ? window : this);
