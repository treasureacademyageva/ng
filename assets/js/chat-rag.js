/* ============================================================================
   Treasure Support AI - retrieval engine
   ----------------------------------------------------------------------------
   Real retrieval, in the browser, with no server required:

       question -> normalise -> expand -> TF-IDF vector
                -> cosine similarity over every KB passage
                -> ranked passages + a confidence score

   Confidence is the whole product. Above the bar the bot answers; below it the
   bot admits it does not know and offers a human. A support bot that guesses
   is worse than no bot at all, because a parent acts on the wrong answer.

   When a FastAPI backend is configured this engine is replaced by real
   sentence embeddings server-side. It stays as the fallback so the widget
   still works when the API is down, and offline.
   ========================================================================== */
(function (global) {
  "use strict";

  /* Words that carry no meaning for retrieval. */
  var STOP = ("a an the is are was were be been being do does did doing have has " +
    "had having i me my we our you your he she it they them this that these those " +
    "of in on at to for with from by about as into like through after over between " +
    "out against during without before under around among and or but if then than " +
    "so because while can could will would shall should may might must please tell " +
    "know want need get got give show say said what which who whom whose where when " +
    "why how there here am pls abeg").split(" ");
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = 1; });

  /* Nigerian English and school vocabulary. The left word is what people type,
     the right words are what the site says. Without this, "how much be school
     fees" never reaches the fees page. */
  var SYN = {
    "pikin": "child pupil", "abeg": "please", "wetin": "what", "wahala": "problem",
    "naira": "fee price cost money", "kobo": "money", "dey": "is",
    "una": "you", "sabi": "know", "comot": "leave", "waka": "walk",
    "howmuch": "cost price fee", "schoolfees": "fee fees",
    "fees": "fee payment cost price money tuition",
    "fee": "fees payment cost price money tuition",
    "pay": "payment fee transfer bank",
    "money": "fee cost price payment",
    "cost": "fee price payment how much",
    "price": "cost fee payment",
    "kid": "child pupil ward", "kids": "children pupils wards",
    "child": "pupil ward kid", "children": "pupils wards kids",
    "ward": "child pupil", "son": "child pupil", "daughter": "child pupil",
    "admission": "admissions apply enrol enroll register registration",
    "apply": "admission register enrol application",
    "enrol": "admission apply register", "enroll": "admission apply register",
    "result": "results report card grade score",
    "results": "result report card grade score",
    "grade": "result score report", "score": "result grade report",
    "timetable": "schedule time table period",
    "close": "closing dismissal pick up time hours",
    "closing": "close dismissal pick up time hours",
    "resume": "resumption start begin open term",
    "resumption": "resume start begin term",
    "holiday": "break vacation holidays",
    "bus": "transport route pickup", "transport": "bus route pickup fare",
    "uniform": "shirt skirt shorts cardigan sportswear clothes wear",
    "book": "textbook shop stationery", "books": "textbook shop stationery",
    "password": "login log in sign in access account pin",
    "login": "log in sign in password account access portal",
    "register": "registration sign up create account admission",
    "phone": "contact call number telephone whatsapp",
    "call": "phone contact number telephone",
    "whatsapp": "chat message contact agent human",
    "agent": "human person staff support whatsapp",
    "human": "agent person staff support",
    "complain": "complaint problem issue support contact",
    "complaint": "complain problem issue support contact",
    "exam": "exams examination test paper",
    "exams": "exam examination test paper",
    "teacher": "staff tutor", "teachers": "staff tutors",
    "headmistress": "head principal proprietor owner",
    "hours": "time open close schedule",
    "time": "hours when schedule clock",
    "location": "address where directions place",
    "address": "location where directions place",
    "owe": "balance outstanding debt fee owing",
    "balance": "owe outstanding fee owing"
  };

  /* Light stemmer: plurals and common endings only. Aggressive stemming hurts
     more than it helps on a corpus this small. */
  function stem(w) {
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + "y";
    if (w.length > 4 && /(sses|shes|ches|xes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    if (w.length > 5 && /ing$/.test(w)) return w.slice(0, -3);
    if (w.length > 4 && /ed$/.test(w)) return w.slice(0, -2);
    return w;
  }

  function tokenise(text, expand) {
    var raw = String(text || "").toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
    var out = [], i, w;
    for (i = 0; i < raw.length; i++) {
      w = raw[i];
      if (!w || w.length < 2 || STOPSET[w]) continue;
      out.push(stem(w));
      if (expand && SYN[w]) {
        SYN[w].split(" ").forEach(function (s) {
          if (!STOPSET[s]) out.push(stem(s));
        });
      }
    }
    return out;
  }

  /* Levenshtein, capped - only used to rescue obvious typos. */
  function near(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 2) return false;
    if (a.length < 4 || b.length < 4) return false;
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      for (j = 0; j <= n; j++) prev[j] = cur[j];
    }
    return prev[n] <= (Math.max(m, n) > 7 ? 2 : 1);
  }

  var RAG = {
    ready: false,
    docs: [],
    idf: {},
    vectors: [],
    vocab: [],

    /* Build the TF-IDF index once, then reuse it for every question. */
    load: function (kb) {
      var docs = (kb && kb.docs) || [];
      this.docs = docs;
      var df = {}, i, toks, seen, t;
      var tokenised = [];

      for (i = 0; i < docs.length; i++) {
        toks = tokenise(docs[i].title + " " + docs[i].keywords + " " + docs[i].text, false);
        tokenised.push(toks);
        seen = {};
        for (t = 0; t < toks.length; t++) {
          if (!seen[toks[t]]) { seen[toks[t]] = 1; df[toks[t]] = (df[toks[t]] || 0) + 1; }
        }
      }

      var N = docs.length || 1;
      this.idf = {};
      for (var w in df) {
        if (df.hasOwnProperty(w)) this.idf[w] = Math.log(1 + N / df[w]);
      }
      this.vocab = Object.keys(this.idf);

      this.vectors = [];
      for (i = 0; i < tokenised.length; i++) {
        this.vectors.push(this._vec(tokenised[i], docs[i]));
      }
      this.ready = true;
      return this;
    },

    /* Weighted term frequency. Title and keyword hits count for more than a
       passing mention deep in a page. */
    _vec: function (toks, doc) {
      var tf = {}, i, w, norm = 0, v = {};
      for (i = 0; i < toks.length; i++) tf[toks[i]] = (tf[toks[i]] || 0) + 1;

      var boost = {};
      if (doc) {
        tokenise(doc.title + " " + doc.keywords, false).forEach(function (k) {
          boost[k] = 2.2;
        });
      }
      for (w in tf) {
        if (!tf.hasOwnProperty(w)) continue;
        var weight = (1 + Math.log(tf[w])) * (this.idf[w] || 1) * (boost[w] || 1);
        v[w] = weight; norm += weight * weight;
      }
      norm = Math.sqrt(norm) || 1;
      for (w in v) { if (v.hasOwnProperty(w)) v[w] /= norm; }
      return v;
    },

    /* Rank every passage against the question. */
    search: function (question, limit) {
      if (!this.ready) return [];
      var qt = tokenise(question, true);
      if (!qt.length) return [];

      /* Rescue typos: map an unknown word onto the closest vocabulary term. */
      var self = this, fixed = [];
      qt.forEach(function (w) {
        if (self.idf[w]) { fixed.push(w); return; }
        for (var i = 0; i < self.vocab.length; i++) {
          if (near(w, self.vocab[i])) { fixed.push(self.vocab[i]); return; }
        }
        fixed.push(w);
      });

      var qv = this._vec(fixed, null), out = [], i, w, dot, overlap;
      for (i = 0; i < this.vectors.length; i++) {
        dot = 0; overlap = 0;
        for (w in qv) {
          if (qv.hasOwnProperty(w) && this.vectors[i][w]) {
            dot += qv[w] * this.vectors[i][w];
            overlap++;
          }
        }
        if (dot > 0) out.push({ doc: this.docs[i], score: dot, overlap: overlap });
      }
      out.sort(function (a, b) { return b.score - a.score; });
      return out.slice(0, limit || 4);
    },

    /* Turn ranked passages into an answer plus a confidence band.
       high  -> answer it
       low   -> say so and offer a human. */
    answer: function (question) {
      var hits = this.search(question, 4);
      if (!hits.length) {
        return { confidence: 0, band: "none", text: "", hits: [] };
      }

      var top = hits[0];
      var second = hits[1] ? hits[1].score : 0;
      /* A clear winner is worth more than a crowded field of weak matches. */
      var margin = top.score - second;
      var conf = Math.min(1, top.score * 1.55 + margin * 0.8);

      /* A weak raw match must never be talked up by the margin bonus. One
         stray word ("colour" matching "Colouring Textbook") used to clear the
         bar and the bot answered a question it had not understood. Below this
         floor the retrieval genuinely found nothing, whatever the shape of the
         rest of the field. */
      if (top.score < 0.22) conf = Math.min(conf, 0.2);

      /* A single shared word is coincidence, not understanding. Require at
         least two question terms to actually appear in the winning passage
         before trusting it - otherwise "sell me a car" rides one stray word
         into a confident-looking answer. */
      if (top.overlap !== undefined && top.overlap < 2 && top.score < 0.45) {
        conf = Math.min(conf, 0.2);
      }

      var band = conf >= 0.52 ? "high" : (conf >= 0.3 ? "medium" : "low");
      return {
        confidence: conf, band: band, doc: top.doc,
        text: top.doc.text, hits: hits,
        needs_login: !!top.doc.needs_login,
        url: top.doc.url, title: top.doc.title
      };
    }
  };

  global.TARag = RAG;
  global.TARagUtil = { tokenise: tokenise, stem: stem, near: near };
})(typeof window !== "undefined" ? window : this);
