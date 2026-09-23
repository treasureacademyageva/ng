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

      /* Who teaches a class. */
      if (/\b(who|which teacher|class teacher)\b/.test(s) && /\bteach|teacher\b/.test(s)) {
        var staff = db.teachers || db.staff || [];
        for (var t = 0; t < staff.length; t++) {
          var cls = String(staff[t].class || staff[t].className || "").toLowerCase();
          if (cls && s.indexOf(cls) >= 0) {
            return { html: "<b>" + esc(staff[t].name) + "</b> teaches <b>" +
                           esc(staff[t].class || staff[t].className) + "</b>.",
                     source: "Staff list" };
          }
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
      if (/^(hi|hello|hey|yo|good (morning|afternoon|evening)|how far|abeg)\b/.test(s)) {
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
