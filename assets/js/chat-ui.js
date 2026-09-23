/* ============================================================================
   Treasure Support AI - the widget
   ----------------------------------------------------------------------------
   Renders the conversation: messages with timestamps, a typing indicator,
   suggested questions, the resolved / not-resolved buttons and the handoff
   actions. Talks to TAChat for every decision, so the flow logic stays
   testable without a browser.

   Replaces the old keyword Chatbot in site.js. The element ids are kept
   (#chatFab, #chatPanel, #chatMsgs, #chatText, #chatSend) so existing CSS and
   the print rules keep working.
   ========================================================================== */
(function (global) {
  "use strict";

  var Core = null;
  var els = {};
  var booted = false;
  var voiceOn = false;

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clockTime(ts) {
    var d = new Date(ts || Date.now());
    var h = d.getHours(), m = d.getMinutes();
    var ap = h >= 12 ? "pm" : "am";
    h = h % 12; if (!h) h = 12;
    return h + ":" + (m < 10 ? "0" : "") + m + ap;
  }

  /* --------------------------------------------------------------- markup */
  function build() {
    var fab = document.createElement("button");
    fab.id = "chatFab";
    fab.className = "chat-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Open the school assistant");
    fab.innerHTML =
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12z"/>' +
      '<circle cx="8.5" cy="12" r="1.3" fill="#fff" stroke="none"/>' +
      '<circle cx="12.5" cy="12" r="1.3" fill="#fff" stroke="none"/>' +
      '<circle cx="16.5" cy="12" r="1.3" fill="#fff" stroke="none"/></svg>' +
      '<span class="ping"></span>';

    var panel = document.createElement("div");
    panel.className = "chat-panel";
    panel.id = "chatPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "School assistant");
    panel.innerHTML =
      '<div class="chat-head">' +
        '<div class="bot" aria-hidden="true">TA</div>' +
        '<div class="who"><b>Treasure Bot</b>' +
        '<small id="chatStatus">Ask me anything about the school</small></div>' +
        '<button class="x" id="chatClear" type="button" title="Clear this conversation" ' +
        'aria-label="Clear conversation">&#8635;</button>' +
        '<button class="x" id="chatClose" type="button" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="chat-msgs" id="chatMsgs" role="log" aria-live="polite"></div>' +
      '<div class="chat-chips" id="chatChips"></div>' +
      '<div class="chat-input">' +
        '<button id="chatMic" type="button" class="mic" title="Speak your question" ' +
        'aria-label="Speak your question">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">' +
        '<path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/>' +
        '<path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V23h2v-3.06A9 9 0 0 0 21 11z"/></svg>' +
        '</button>' +
        '<input id="chatText" autocomplete="off" placeholder="Ask about fees, results, transport..." ' +
        'aria-label="Type your question">' +
        '<button id="chatSend" type="button" aria-label="Send">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
        '<path d="M3 11.5l18-7-7 18-2.5-7.5z"/></svg></button>' +
      '</div>';

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    els.fab = fab;
    els.panel = panel;
    els.msgs = document.getElementById("chatMsgs");
    els.chips = document.getElementById("chatChips");
    els.text = document.getElementById("chatText");
    els.send = document.getElementById("chatSend");
    els.status = document.getElementById("chatStatus");
    els.mic = document.getElementById("chatMic");
  }

  /* -------------------------------------------------------------- render */
  function bubble(role, html, ts, meta) {
    var row = document.createElement("div");
    row.className = "cmsg " + (role === "user" ? "me" : "bot");
    var inner = '<div class="cb">' + html + "</div>" +
                '<div class="cmeta">' + clockTime(ts) +
                (meta ? " &middot; " + esc(meta) : "") + "</div>";
    row.innerHTML = inner;
    els.msgs.appendChild(row);
    els.msgs.scrollTop = els.msgs.scrollHeight;
    return row;
  }

  function typing(on) {
    var old = document.getElementById("chatTyping");
    if (old) old.remove();
    if (!on) return;
    var t = document.createElement("div");
    t.className = "cmsg bot";
    t.id = "chatTyping";
    t.innerHTML = '<div class="cb typing"><span></span><span></span><span></span></div>';
    els.msgs.appendChild(t);
    els.msgs.scrollTop = els.msgs.scrollHeight;
  }

  function chips(list) {
    els.chips.innerHTML = "";
    (list || []).forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = c;
      b.onclick = function () { submit(c); };
      els.chips.appendChild(b);
    });
  }

  /* Feedback row: the resolved / not-resolved loop the spec asks for. */
  function askFeedback() {
    var row = document.createElement("div");
    row.className = "chat-fb";
    row.innerHTML = '<span>Was this helpful?</span>' +
      '<button type="button" data-fb="1" aria-label="Yes, helpful">&#128077; Yes</button>' +
      '<button type="button" data-fb="0" aria-label="No, not helpful">&#128078; No</button>';
    row.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        var yes = b.getAttribute("data-fb") === "1";
        row.innerHTML = "<span>" + (yes ? "Thanks for the feedback." :
                                           "Thanks - let me find you a person.") + "</span>";
        var res = Core.recordFeedback(yes);
        if (res) deliver(res, true);
      };
    });
    els.msgs.appendChild(row);
    els.msgs.scrollTop = els.msgs.scrollHeight;
  }

  function actionButton(action) {
    if (!action) return;
    var wrap = document.createElement("div");
    wrap.className = "chat-act";
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = action.label;
    b.onclick = function () {
      if (action.kind === "login") {
        if (global.TAAuth && TAAuth.login) { TAAuth.login(); }
        else { location.href = "portal/login.html"; }
        return;
      }
      if (action.href) {
        if (action.kind === "whatsapp") window.open(action.href, "_blank", "noopener");
        else location.href = action.href;
      }
    };
    wrap.appendChild(b);
    els.msgs.appendChild(wrap);
    els.msgs.scrollTop = els.msgs.scrollHeight;
  }

  /* Show a bot reply, with a short delay so it reads as a reply, not a dump. */
  function deliver(res, instant) {
    if (!res) return;
    var wait = instant ? 120 : Math.min(900, 260 + String(res.html).length * 1.6);
    typing(true);
    setTimeout(function () {
      typing(false);
      var m = Core.push("bot", res.html, { kind: res.type, source: res.source });
      bubble("bot", res.html, m.t, res.source ? "from " + res.source : "");
      if (res.action) actionButton(res.action);
      if (res.feedback) askFeedback();
      chips(res.chips || Core.suggestions());
      speak(res.html);
    }, wait);
  }

  function submit(text) {
    var q = String(text !== undefined ? text : els.text.value).trim();
    if (!q) return;
    els.text.value = "";
    var m = Core.push("user", esc(q));
    bubble("user", esc(q), m.t);
    chips([]);
    var res = Core.respond(q);
    deliver(res);
  }

  /* ------------------------------------------------- bonus: voice in/out */
  function speak(html) {
    if (!voiceOn || !global.speechSynthesis) return;
    try {
      var txt = String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!txt) return;
      var u = new SpeechSynthesisUtterance(txt.slice(0, 300));
      u.rate = 1.02;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  function initMic() {
    var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (!SR) { els.mic.style.display = "none"; return; }
    var rec = new SR();
    rec.lang = "en-NG";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    els.mic.onclick = function () {
      try {
        els.mic.classList.add("live");
        els.status.textContent = "Listening...";
        rec.start();
      } catch (e) { els.mic.classList.remove("live"); }
    };
    rec.onresult = function (e) {
      var said = e.results[0][0].transcript;
      els.mic.classList.remove("live");
      els.status.textContent = "Ask me anything about the school";
      voiceOn = true;               /* spoke to it, so speak back */
      submit(said);
    };
    rec.onerror = rec.onend = function () {
      els.mic.classList.remove("live");
      els.status.textContent = "Ask me anything about the school";
    };
  }

  /* ---------------------------------------------------------------- boot */
  function replay() {
    els.msgs.innerHTML = "";
    var list = Core.messages || [];
    list.slice(-40).forEach(function (m) {
      bubble(m.role, m.html, m.t, m.source ? "from " + m.source : "");
    });
  }

  function open() {
    els.panel.classList.add("open");
    if (!els.panel.dataset.greeted) {
      els.panel.dataset.greeted = "1";
      if (!(Core.messages || []).length) {
        deliver({ type: "smalltalk", html: Core.greeting(), chips: Core.suggestions() }, true);
      } else {
        chips(Core.suggestions());
      }
    }
    setTimeout(function () { try { els.text.focus(); } catch (e) {} }, 80);
  }

  var UI = {
    init: function () {
      if (booted || typeof document === "undefined") return;
      if (document.getElementById("chatFab")) return;
      booted = true;

      Core = global.TAChat;
      if (!Core) return;

      build();

      /* Knowledge base is fetched once and cached by the service worker. */
      var kbUrl = (document.body.getAttribute("data-root") || "") + "assets/data/kb.json";
      fetch(kbUrl).then(function (r) { return r.json(); })
        .then(function (kb) {
          Core.init(kb);
          replay();
          if (els.panel.classList.contains("open")) chips(Core.suggestions());
        })
        .catch(function () {
          Core.init(null);
          replay();
        });

      els.fab.onclick = function () {
        if (els.panel.classList.contains("open")) els.panel.classList.remove("open");
        else open();
      };
      document.getElementById("chatClose").onclick = function () {
        els.panel.classList.remove("open");
        try { speechSynthesis.cancel(); } catch (e) {}
      };
      document.getElementById("chatClear").onclick = function () {
        Core.clearHistory();
        els.msgs.innerHTML = "";
        delete els.panel.dataset.greeted;
        open();
      };
      els.send.onclick = function () { submit(); };
      els.text.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
      });
      initMic();

      /* When a guest signs in mid-conversation, keep what they already said. */
      global.addEventListener("ta:auth-changed", function () {
        Core.syncGuestToAccount();
        Core.messages = Core.loadHistory();
        replay();
      });
    },
    open: open,
    submit: submit
  };

  global.TAChatUI = UI;
})(typeof window !== "undefined" ? window : this);
