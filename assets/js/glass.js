/* ===========================================================================
   Treasure Academy - glass UI
   ---------------------------------------------------------------------------
   Two pieces, both built here rather than pasted into 37 pages:

     1. The auth popup. Login and Register open over the landing page instead
        of navigating away, so the page shows through the panel. The blur sits
        on the page behind; the panel itself stays transparent. Anyone without
        JavaScript still gets portal/login.html, because the trigger is a real
        link and we only intercept it.

     2. The slide-out drawer, opened from the button beside Login/Register.

   =========================================================================== */
(function () {
  "use strict";

  var ROOT = /\/portal\//.test(location.pathname) ? "../" : "";
  var ICONS = ROOT + "assets/img/icons.svg";

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html != null) n.innerHTML = html;
    return n;
  }
  function icon(id, size) {
    return '<svg class="ico" viewBox="0 0 24 24" width="' + (size || 18) + '" height="' +
      (size || 18) + '" fill="currentColor" aria-hidden="true" focusable="false">' +
      '<use href="' + ICONS + '#' + id + '"></use></svg>';
  }

  /* ---------------------------------------------------------------------
     Focus trapping. A dialog that lets the keyboard wander behind it is
     broken for screen-reader and keyboard users, and it is the detail most
     hand-rolled modals miss.
     --------------------------------------------------------------------- */
  var SEL = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';
  function trap(container, ev) {
    if (ev.key !== "Tab") return;
    var f = [].slice.call(container.querySelectorAll(SEL)).filter(function (n) {
      return n.offsetParent !== null;
    });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  }

  /* =====================================================================
     1. Auth popup
     ===================================================================== */
  var veil, lastFocus;

  function buildAuth() {
    if (veil) return veil;
    veil = el("div", { id: "authVeil", role: "dialog", "aria-modal": "true",
                       "aria-labelledby": "authTitle" });
    veil.innerHTML =
      '<div class="ta-authcard">' +
        '<button class="auth-close" type="button" aria-label="Close">&times;</button>' +
        '<img class="auth-crest" src="' + ROOT + 'assets/img/logo.jpg" alt="" width="62" height="62">' +
        '<h2 id="authTitle">Welcome back</h2>' +
        '<p class="auth-sub">Treasure Academy, Ageva &mdash; school portal</p>' +
        '<div class="auth-tabs" role="tablist">' +
          '<button type="button" role="tab" data-tab="login" aria-selected="true">Login</button>' +
          '<button type="button" role="tab" data-tab="register" aria-selected="false">Register</button>' +
        '</div>' +
        '<form id="authForm" autocomplete="off" novalidate>' +
          '<label class="sr-only" for="authId">Phone number or Staff ID</label>' +
          '<input id="authId" name="id" placeholder="Phone number or Staff ID" inputmode="tel">' +
          '<label class="sr-only" for="authPass">Password or PIN</label>' +
          '<input id="authPass" name="pass" type="password" placeholder="Password / PIN">' +
          '<button class="auth-go" type="submit">Continue</button>' +
        '</form>' +
        '<p class="auth-alt" data-alt="login">Not admitted yet? ' +
          '<a href="' + ROOT + 'admissions.html">Apply for admission</a></p>' +
        '<p class="auth-alt" data-alt="register" hidden>Already have an account? ' +
          '<a href="#" data-goto="login">Login instead</a></p>' +
        '<p class="auth-alt"><a href="' + ROOT + 'portal/login.html">Open the full portal page</a></p>' +
      '</div>';
    document.body.appendChild(veil);

    veil.querySelector(".auth-close").addEventListener("click", closeAuth);
    veil.addEventListener("mousedown", function (e) { if (e.target === veil) closeAuth(); });

    veil.querySelectorAll(".auth-tabs button").forEach(function (b) {
      b.addEventListener("click", function () { setTab(b.getAttribute("data-tab")); });
    });
    var gotoLogin = veil.querySelector('[data-goto="login"]');
    if (gotoLogin) gotoLogin.addEventListener("click", function (e) {
      e.preventDefault(); setTab("login");
    });

    // The real sign-in logic lives in the portal. Hand off with the values so
    // the parent is not asked to type them twice.
    veil.querySelector("#authForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var id = veil.querySelector("#authId").value.trim();
      try { sessionStorage.setItem("ta_prefill_id", id); } catch (err) {}
      location.href = ROOT + "portal/login.html" + (id ? "?id=" + encodeURIComponent(id) : "");
    });

    veil.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAuth();
      trap(veil, e);
    });
    return veil;
  }

  function setTab(name) {
    var isReg = name === "register";
    veil.querySelectorAll(".auth-tabs button").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.getAttribute("data-tab") === name));
    });
    veil.querySelector("#authTitle").textContent = isReg ? "Create your account" : "Welcome back";
    veil.querySelector(".auth-sub").textContent = isReg
      ? "Pupils and parents \u2014 start here"
      : "Treasure Academy, Ageva \u2014 school portal";
    veil.querySelector(".auth-go").textContent = isReg ? "Register" : "Continue";
    veil.querySelectorAll("[data-alt]").forEach(function (p) {
      p.hidden = p.getAttribute("data-alt") !== name;
    });
  }

  function openAuth(tab) {
    buildAuth();
    lastFocus = document.activeElement;
    setTab(tab || "login");
    veil.classList.add("show");
    document.body.classList.add("auth-open");
    requestAnimationFrame(function () { veil.classList.add("in"); });
    setTimeout(function () { veil.querySelector("#authId").focus(); }, 260);
  }

  function closeAuth() {
    if (!veil) return;
    veil.classList.remove("in");
    document.body.classList.remove("auth-open");
    setTimeout(function () {
      veil.classList.remove("show");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }, 320);
  }

  /* =====================================================================
     2. Slide-out drawer
     ===================================================================== */
  var PRIMARY = [
    ["index.html",      "Home",        "ta-cap"],
    ["news.html",       "News/Event",  "ta-chat"],
    ["about.html",      "About Us",    "ta-shield"],
    ["contact.html",    "Contact Us",  "ta-chat"],
    ["admissions.html", "Admissions",  "ta-book"]
  ];
  // The rest of the landing page, top to bottom, as the owner asked.
  var MORE = [
    ["academics.html",    "Academics",      "ta-book"],
    ["fees.html",         "School Fees",    "ta-star"],
    ["calendar.html",     "Term Calendar",  "ta-calendar"],
    ["alumni.html",       "Staff & Alumni", "ta-cap"],
    ["gallery",           "Gallery",        "ta-star"],
    ["testimonials.html", "Testimonials",   "ta-star"],
    ["uniform.html",      "Uniform",        "ta-shirt"],
    ["transport.html",    "Transport",      "ta-bus"],
    ["support.html",      "Support Us",     "ta-pledge"],
    ["anthem.html",       "Anthem & Creed", "ta-note"]
  ];

  var drawer, dveil, menuBtn;

  function buildDrawer() {
    if (drawer) return;

    dveil = el("div", { id: "drawerVeil" });
    document.body.appendChild(dveil);
    dveil.addEventListener("click", closeDrawer);

    drawer = el("aside", { id: "navDrawer", role: "dialog", "aria-modal": "true",
                           "aria-label": "Site menu", "aria-hidden": "true" });

    function links(list) {
      return list.map(function (l) {
        var href = l[0] === "gallery" ? ROOT + "index.html#gallery" : ROOT + l[0];
        return '<a class="dw" href="' + href + '">' + icon(l[2]) + '<span>' + l[1] + '</span></a>';
      }).join("");
    }

    drawer.innerHTML =
      '<div class="drawer-head">' +
        '<img src="' + ROOT + 'assets/img/logo.jpg" alt="" width="38" height="38">' +
        '<b>Treasure Academy<br>Ageva</b>' +
        '<button class="drawer-close" type="button" aria-label="Close menu">&times;</button>' +
      '</div>' +
      '<nav aria-label="All pages">' +
        '<p class="drawer-sec">Main</p>' + links(PRIMARY) +
        '<p class="drawer-sec">More</p>'  + links(MORE) +
      '</nav>' +
      '<div class="drawer-foot">' +
        '<button id="drawerLogout" type="button">' + icon("ta-shield", 18) +
        '<span>Logout</span></button>' +
      '</div>';
    document.body.appendChild(drawer);

    drawer.querySelector(".drawer-close").addEventListener("click", closeDrawer);
    drawer.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
      trap(drawer, e);
    });

    drawer.querySelector("#drawerLogout").addEventListener("click", function () {
      try {
        ["ta_session", "ta_user", "ta_role", "session", "currentUser"].forEach(function (k) {
          localStorage.removeItem(k); sessionStorage.removeItem(k);
        });
      } catch (err) {}
      closeDrawer();
      location.href = ROOT + "index.html";
    });
  }

  function openDrawer() {
    buildDrawer();
    lastFocus = document.activeElement;
    drawer.classList.add("in");
    dveil.classList.add("in");
    drawer.setAttribute("aria-hidden", "false");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    setTimeout(function () {
      var f = drawer.querySelector(".drawer-close");
      if (f) f.focus();
    }, 240);
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove("in");
    dveil.classList.remove("in");
    drawer.setAttribute("aria-hidden", "true");
    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.focus();
    }
    document.body.style.overflow = "";
  }

  /* =====================================================================
     Wiring
     ===================================================================== */
  function init() {
    try { wireMenu(); } catch (e) { if (window.console) console.error("TAGlass menu:", e); }
    try { wireAuth(); } catch (e) { if (window.console) console.error("TAGlass auth:", e); }
  }

  function wireMenu() {
    // Menu button, placed right after Login/Register so the row reads as one
    // set of controls.
    var loginLink = document.querySelector('.nav-links a[href*="portal/login"]');
    if (loginLink && !document.querySelector(".nav-menu-btn")) {
      menuBtn = el("button", {
        type: "button", class: "nav-menu-btn", id: "navMenuBtn",
        "aria-expanded": "false", "aria-controls": "navDrawer",
        "aria-label": "Open site menu"
      }, '<span class="bars" aria-hidden="true"><i></i><i></i><i></i></span><span>Menu</span>');
      loginLink.parentNode.insertBefore(menuBtn, loginLink.nextSibling);
      menuBtn.addEventListener("click", function () {
        if (drawer && drawer.classList.contains("in")) closeDrawer(); else openDrawer();
      });
    }
  }

  var authDelegated = false;
  function wireAuth() {
    /* Delegated from document, not bound to each link. site.js re-renders the
       nav after we run, which would throw away per-element listeners; a single
       document-level handler survives any amount of re-rendering and also
       covers links added later. */
    if (authDelegated) return;
    authDelegated = true;

    document.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

      var t = e.target.closest ? e.target.closest("[data-auth]") : null;
      if (t) {
        e.preventDefault();
        openAuth(t.getAttribute("data-auth"));
        return;
      }

      var a = e.target.closest ? e.target.closest('a[href*="portal/login"]') : null;
      if (!a || a.closest("#navDrawer")) return;
      e.preventDefault();
      openAuth(/^\s*register/i.test(a.textContent.trim()) ? "register" : "login");
    });
  }

  /* site.js rebuilds the nav on DOMContentLoaded, so running at the same
     moment is a race - sometimes the login link we anchor to has not been
     written yet. Wait for it, then initialise. Falls back to a plain call so
     pages that never build a nav still wire up their auth triggers. */
  function whenNavReady(fn) {
    var tries = 0;
    (function look() {
      if (document.querySelector('.nav-links a[href*="portal/login"]') || tries > 40) {
        fn();
      } else { tries++; setTimeout(look, 50); }
    })();
  }
  function boot() { whenNavReady(init); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }

  /* site.js renders the nav with box.innerHTML = ..., which throws away any
     button we inserted, and both scripts listen on DOMContentLoaded - so the
     order is a coin toss. Do not fight it: watch the nav and put the button
     back whenever it is rebuilt. Attached immediately rather than inside
     another DOMContentLoaded handler, because a deferred script can run after
     that event has already fired, in which case the handler never runs. */
  function watchNav() {
    var nav = document.getElementById("mainNav") ||
              document.querySelector(".nav-links");
    if (!nav) { setTimeout(watchNav, 60); return; }
    if (!window.MutationObserver) return;
    new MutationObserver(function () {
      if (!document.querySelector(".nav-menu-btn")) {
        try { wireMenu(); } catch (e) {}
      }
    }).observe(nav, { childList: true });
  }
  watchNav();

  window.TAGlass = { openAuth: openAuth, closeAuth: closeAuth,
                     openDrawer: openDrawer, closeDrawer: closeDrawer };
})();
