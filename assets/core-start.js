"use strict";


var SUPABASE_URL = "https://cyqactlxetfjyjvklpox.supabase.co";
var SUPABASE_KEY = "sb_publishable_5kPdWhNs53AY_PB29pRGBw_pvXiB0_k";
var REDIRECT = "https://kingsfallchess.github.io/";
var kfRecoveryRequested = /(?:[?&#])(?:type=recovery|kf_reset=1)(?:[&#]|$)/i.test(window.location.search + window.location.hash);
var sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

function $(id){ return document.getElementById(id); }

// Capture authentication clicks before the rest of the application initializes.
document.addEventListener("click", function(event){
  var button = event.target && event.target.closest ? event.target.closest("#signIn, #signUp") : null;
  if(!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    openAuth(button.id === "signUp" ? "signup" : "signin");
  } catch(error) {
    console.error("Kingsfall authentication dialog error:", error);
    var dialog = $("authDialog");
    var message = $("authMessage");
    if(dialog) {
      if($("authTitle")) $("authTitle").textContent = "Sign-in error";
      if(message) message.textContent = "Could not open sign-in: " + String(error && error.message || error);
      try { if(!dialog.open) dialog.showModal(); } catch(ignore) { dialog.setAttribute("open", ""); }
    }
  }
}, true);


/* ===== TOAST SYSTEM (NEW) ===== */
var _toastWrap = null;
function ensureToastWrap(){
  if(_toastWrap) return _toastWrap;
  var w = $("kfToastWrap");
  if(!w){
    w = document.createElement("div");
    w.id = "kfToastWrap";
    document.body.appendChild(w);
  }
  _toastWrap = w;
  return w;
}
function toast(msg, kind, duration){
  if(!msg) return;
  var w = ensureToastWrap();
  var el = document.createElement("div");
  el.className = "kf-toast" + (kind ? " " + kind : "");
  el.textContent = String(msg);
  w.appendChild(el);
  var dur = duration || 3200;
  setTimeout(function(){
    el.classList.add("leaving");
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 320);
  }, dur);
}
/* say() اکنون هم داخل #message می‌نویسد و هم toast می‌دهد تا در fullscreen هم دیده شود */
function say(msg, opts){
  opts = opts || {};
  var m = $("message");
  if(m) m.textContent = msg || "";
  if(msg && !opts.silentToast){
    toast(msg, opts.error ? "error" : (opts.info ? "info" : ""));
  }
}

