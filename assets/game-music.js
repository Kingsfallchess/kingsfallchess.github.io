/* Kingsfall Android background playlist; isolated from chess and Supabase. */
(() => {
  "use strict";
  if (!window.kfIsNativeApp || window.kfBackgroundMusic) return;
  window.kfBackgroundMusic = true;
  const key = "kf_music_enabled_v2";
  const ids = ["moonlight","snowfall","undertow","sleep","friday-morning","dream-culture","meditation-01","meditation-02","clear-air","morning","november-lullaby","a-visit-to-virginia","eastern-wind"];
  const base = new URL("assets/music/", document.baseURI);
  const audio = new Audio();
  audio.preload = "none";
  audio.volume = 0.24;
  let enabled = true, ready = false, checking = false, bag = [], last = "", failures = 0, generation = 0, blocked = false, pending = false;
  try { enabled = localStorage.getItem(key) !== "0"; } catch {}
  const row = document.getElementById("kfMusicControl");
  const toggle = document.getElementById("kfMusicEnabled");
  const label = document.getElementById("kfMusicLabel");
  const state = document.getElementById("kfMusicStatus");
  const credits = document.getElementById("kfMusicCredits");
  const creditsTitle = document.getElementById("kfMusicCreditsTitle");
  if (!row || !toggle) return;
  row.hidden = false;
  function render() {
    const fa = window.kfGetLanguage?.() === "fa" || document.documentElement.lang === "fa";
    label.textContent = fa ? "موسیقی پس‌زمینه" : "Background music";
    creditsTitle.textContent = fa ? "سازندگان موسیقی" : "Music credits";
    toggle.checked = enabled;
    state.textContent = !enabled ? (fa ? "خاموش" : "Off") :
      !ready ? (fa ? "فایل‌های موسیقی هنوز در دسترس نیستند" : "Music files unavailable") :
      blocked ? (fa ? "برای شروع پخش، صفحه را لمس کنید" : "Tap to start music") :
      (fa ? "روشن" : "On");
  }
  function canPlay() { return enabled && ready && !document.hidden; }
  function shuffle() {
    bag = ids.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    if (bag[bag.length - 1] === last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
  }
  function advance() {
    if (!canPlay() || failures >= ids.length) return;
    if (!bag.length) shuffle();
    last = bag.pop();
    generation++;
    pending = false;
    audio.src = new URL(last + ".mp3", base).href;
    start();
  }
  function start() {
    if (!canPlay() || pending) return;
    if (!audio.getAttribute("src")) { advance(); return; }
    if (!audio.paused && !audio.ended) return;
    if (audio.ended) { advance(); return; }
    const g = generation;
    pending = true;
    try {
      Promise.resolve(audio.play()).then(() => {
        if (g !== generation) return;
        pending = false; blocked = false;
        if (!canPlay()) audio.pause();
        render();
      }).catch(err => {
        if (g !== generation) return;
        pending = false;
        if (err?.name === "NotAllowedError") { blocked = true; render(); }
      });
    } catch { pending = false; }
  }
  function pause() { generation++; pending = false; audio.pause(); }
  async function check() {
    if (checking || ready || !enabled) return;
    checking = true;
    try {
      const r = await fetch(new URL("ready.json", base), {cache:"no-cache"});
      if (!r.ok) return;
      const data = await r.json();
      ready = Array.isArray(data.files) && ids.every(id => data.files.includes(id + ".mp3"));
      if (ready) start();
    } catch {} finally { checking = false; render(); }
  }
  audio.addEventListener("playing", () => { failures = 0; if (!canPlay()) audio.pause(); });
  audio.addEventListener("ended", advance);
  audio.addEventListener("error", () => {
    if (!audio.getAttribute("src")) return;
    pending = false;
    if (++failures < ids.length && canPlay()) setTimeout(advance, 100);
    else { ready = false; audio.removeAttribute("src"); render(); }
  });
  toggle.addEventListener("change", () => {
    enabled = toggle.checked;
    try { localStorage.setItem(key, enabled ? "1" : "0"); } catch {}
    if (!enabled) pause();
    else { failures = 0; if (ready) start(); else check(); }
    render();
  });
  const retryGesture = () => { if (blocked && canPlay()) start(); };
  document.addEventListener("click", retryGesture, true);
  document.addEventListener("keydown", retryGesture, true);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); else if (ready) start(); else check(); });
  window.addEventListener("pagehide", pause);
  window.addEventListener("pageshow", () => { if (ready) start(); else check(); });
  new MutationObserver(render).observe(document.documentElement, {attributes:true,attributeFilter:["class","lang"]});
  let loadedCredits = false;
  credits.addEventListener("toggle", async () => {
    if (!credits.open || loadedCredits) return;
    try {
      const r = await fetch(new URL("catalog.json", base));
      if (!r.ok) return;
      const data = await r.json();
      const ul = document.getElementById("kfMusicCreditList");
      ul.replaceChildren();
      for (const t of data.filter(t => ids.includes(t.id))) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = t.page; a.target = "_blank"; a.rel = "noopener noreferrer";
        a.textContent = t.title + " — " + t.artist;
        li.append(a, " · ");
        const license = document.createElement("a");
        license.href = t.license; license.target = "_blank"; license.rel = "noopener noreferrer";
        license.textContent = "CC BY 4.0";
        li.append(license, " · compressed MP3"); ul.append(li);
      }
      loadedCredits = true;
    } catch {}
  });
  render();
  check();
})();
