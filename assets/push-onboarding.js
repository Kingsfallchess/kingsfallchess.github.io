/* Kingsfall Android: one-time, per-email-account push permission onboarding.
   Native WebView owns the Android runtime permission; the website only asks for consent.
   No push requests are shown to browser visitors or anonymous guests. */
(function () {
  "use strict";
  if (!/KingsfallAndroid\/\d/.test(navigator.userAgent) ||
      !/KingsfallLeaguePush\/1/.test(navigator.userAgent) ||
      typeof sb === "undefined" || !sb) return;

  var PREFIX = "kf_league_push_onboarding_v1:";
  var pending = null, activeOverlay = null, activeUserId = null;
  var inMemoryDecisions = Object.create(null);
  var styleId = "kfPushOnboardingStyle";

  function localized(english, persian) {
    return window.kfGetLanguage && window.kfGetLanguage() === "fa" ? persian : english;
  }
  function emailAccount(user) {
    return !!(user && user.id && user.email && !user.is_anonymous);
  }
  function decision(userId) {
    try { return localStorage.getItem(PREFIX + userId) || inMemoryDecisions[userId]; }
    catch (ignored) { return inMemoryDecisions[userId]; }
  }
  function saveDecision(userId, value) {
    inMemoryDecisions[userId] = value;
    try { localStorage.setItem(PREFIX + userId, value); } catch (ignored) {}
  }
  function dismiss() {
    if (activeOverlay) activeOverlay.remove();
    activeOverlay = null;
    activeUserId = null;
  }
  function injectStyle() {
    if (document.getElementById(styleId)) return;
    var style = document.createElement("style");
    style.id = styleId;
    style.textContent = [
      "#kfPushOnboarding{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;background:rgba(8,1,6,.78);backdrop-filter:blur(7px)}",
      "#kfPushOnboarding .kf-push-card{box-sizing:border-box;width:min(100%,390px);padding:28px 24px 22px;border-radius:23px;border:1px solid rgba(246,207,127,.58);background:linear-gradient(155deg,#42101e 0%,#260710 61%,#160409 100%);color:#f8edf0;text-align:center;box-shadow:0 25px 85px rgba(0,0,0,.54)}",
      "#kfPushOnboarding .kf-push-icon{display:grid;place-items:center;margin:0 auto 18px;width:72px;height:72px;border-radius:22px;background:linear-gradient(145deg,#ffe8a2,#c78e34);color:#3e1520;font-size:35px;box-shadow:0 9px 35px rgba(239,187,97,.24)}",
      "#kfPushOnboarding .kf-push-kicker{color:#e9c77c;letter-spacing:.15em;font-size:10px;font-weight:800;margin-bottom:8px}",
      "#kfPushOnboarding h2{color:#ffebbc;font-size:22px;line-height:1.35;margin:0 0 12px;font-weight:850}",
      "#kfPushOnboarding p{color:#e5cfd2;line-height:1.8;font-size:14px;margin:0 auto 24px;max-width:320px}",
      "#kfPushOnboarding .kf-push-actions{display:flex;flex-direction:column;gap:11px}",
      "#kfPushOnboarding .kf-push-enable,#kfPushOnboarding .kf-push-later{display:flex;box-sizing:border-box;align-items:center;justify-content:center;min-height:49px;border-radius:13px;font:inherit;font-size:14px;font-weight:800;text-decoration:none;cursor:pointer}",
      "#kfPushOnboarding .kf-push-enable{background:linear-gradient(125deg,#ffe2a0,#d5a24e);border:1px solid #ffe5aa;color:#321121}",
      "#kfPushOnboarding .kf-push-later{background:rgba(255,255,255,.055);border:1px solid rgba(255,232,197,.19);color:#f6e6e0}",
      "#kfPushOnboarding .kf-push-enable:focus-visible,#kfPushOnboarding .kf-push-later:focus-visible{outline:3px solid #f5dc8f;outline-offset:3px}",
      "#kfPushOnboarding small{display:block;color:#b99e9f;font-size:11px;line-height:1.7;margin-top:16px}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function showFor(user) {
    if (!emailAccount(user) || decision(user.id) || activeOverlay) return;
    if (document.hidden) return;
    // Wait until successful email sign-in has closed the sign-in dialog.
    var auth = document.getElementById("authDialog");
    if (auth && auth.classList.contains("is-open")) {
      pending = setTimeout(function () { showFor(user); }, 500);
      return;
    }
    var gate = document.getElementById("accountGate");
    if (gate && !gate.hidden) return;
    // Avoid covering a chess game; ask on the next authenticated entry instead.
    if (typeof onlineGameId !== "undefined" && onlineGameId) return;

    injectStyle();
    var overlay = document.createElement("div");
    overlay.id = "kfPushOnboarding";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "kfPushHeading");
    overlay.innerHTML = '<section class="kf-push-card">' +
      '<div class="kf-push-icon" aria-hidden="true">♛</div>' +
      '<div class="kf-push-kicker">KINGSFALL CHESS</div>' +
      '<h2 id="kfPushHeading"></h2><p id="kfPushDescription"></p>' +
      '<div class="kf-push-actions"><a id="kfPushEnable" class="kf-push-enable" href="/enable-league-push"></a>' +
      '<button id="kfPushLater" class="kf-push-later" type="button"></button></div>' +
      '<small id="kfPushFootnote"></small></section>';
    overlay.querySelector("#kfPushHeading").textContent =
      localized("Never miss your next match", "هیچ مسابقه‌ای رو از دست نده!");
    overlay.querySelector("#kfPushDescription").textContent =
      localized("Get phone notifications when your league group is ready and it is time to choose your available hours.",
        "وقتی گروه لیگ تکمیل شد و زمان انتخاب ساعت‌های بازی رسید، روی گوشی‌ات خبرت می‌کنیم.");
    overlay.querySelector("#kfPushEnable").textContent =
      localized("Enable notifications", "فعال کردن اعلان‌ها");
    overlay.querySelector("#kfPushLater").textContent =
      localized("Maybe later", "فعلاً نه");
    overlay.querySelector("#kfPushFootnote").textContent =
      localized("You can change this later in your profile.",
        "بعداً هم از پروفایلت می‌تونی اعلان‌ها رو فعال کنی.");

    overlay.querySelector("#kfPushLater").addEventListener("click", function () {
      saveDecision(user.id, "later");
      dismiss();
    });
    overlay.querySelector("#kfPushEnable").addEventListener("click", function () {
      // Keep navigation as a genuine user gesture for Android's native URL handler.
      saveDecision(user.id, "requested");
      dismiss();
    });
    document.body.appendChild(overlay);
    activeOverlay = overlay;
    activeUserId = user.id;
    overlay.querySelector("#kfPushEnable").focus();
  }

  function schedule(user) {
    if (pending) clearTimeout(pending);
    pending = null;
    if (!emailAccount(user) || decision(user.id)) return;
    pending = setTimeout(function () { showFor(user); }, 1200);
  }

  var profileSave = document.getElementById("profileSave");
  var profileAction = document.createElement("a");
  profileAction.id = "kfProfilePushEnable";
  profileAction.className = "btn";
  profileAction.href = "/enable-league-push";
  profileAction.style.cssText = "display:none;margin-top:12px;text-align:center;text-decoration:none";
  profileSave.before(profileAction);

  function refreshProfileAction(user) {
    profileAction.style.display = emailAccount(user) ? "block" : "none";
    profileAction.textContent = localized("Enable phone notifications", "فعال کردن اعلان‌های گوشی");
  }
  function refreshProfileFromAccount() {
    refreshProfileAction(typeof currentUser !== "undefined" ? currentUser : null);
  }
  new MutationObserver(refreshProfileFromAccount).observe(document.getElementById("profileDialog"),
    { attributes: true, attributeFilter: ["open", "class"] });
  new MutationObserver(refreshProfileFromAccount).observe(document.documentElement,
    { attributes: true, attributeFilter: ["lang"] });
  refreshProfileFromAccount();

  sb.auth.onAuthStateChange(function (event, session) {
    refreshProfileAction(session && session.user);
    if (event === "SIGNED_OUT") {
      if (pending) clearTimeout(pending);
      pending = null;
      dismiss();
      return;
    }
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
      schedule(session && session.user);
    }
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && !activeOverlay) {
      var user = typeof currentUser !== "undefined" ? currentUser : null;
      if (emailAccount(user)) schedule(user);
    }
  });

  // FCM posts a native WebMessage from the app's trusted origin.
  // Register tokens through the authenticated RPC even while the League page is closed.
  window.addEventListener("message", async function (event) {
    if (event.source || typeof event.data !== "string" ||
        !event.data.startsWith("kf-league-token:")) return;
    var token = event.data.slice("kf-league-token:".length);
    if (token.length < 32 || token.length > 4096 || /\s/.test(token)) return;
    var succeeded = false;
    try {
      var response = await sb.rpc("kf_register_league_device", { device_token: token });
      if (response.error) throw response.error;
      var user = typeof currentUser !== "undefined" ? currentUser : null;
      if (emailAccount(user)) saveDecision(user.id, "enabled");
      succeeded = true;
      if (typeof toast === "function")
        toast(localized("Phone notifications enabled", "اعلان‌های گوشی فعال شد"));
    } catch (error) {
      console.warn("League push registration failed:", error);
      if (typeof toast === "function")
        toast(localized("Could not register this phone. Try again from your profile.", "ثبت گوشی انجام نشد؛ از پروفایلت دوباره تلاش کن."), "error");
    }
    window.dispatchEvent(new CustomEvent("kf-league-push-status", { detail: { ok: succeeded } }));
  });
})();
