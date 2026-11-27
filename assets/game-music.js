/* Native-only music preference. Audio is bundled in the Android APK. */
(() => {
  "use strict";
  if (!window.kfIsNativeApp || !/KingsfallLocalMusic\/1\b/.test(navigator.userAgent) || !window.KingsfallMusic) return;
  const row = document.getElementById("kfMusicControl");
  const toggle = document.getElementById("kfMusicEnabled");
  const state = document.getElementById("kfMusicStatus");
  const label = document.getElementById("kfMusicLabel");
  if (!row || !toggle) return;
  const bridge = window.KingsfallMusic;
  const key = "kf_music_enabled_v2";
  let enabled = true;
  try {
    if (!bridge.hasPreference()) {
      const previous = localStorage.getItem(key);
      if (previous !== null) bridge.setEnabled(previous !== "0");
      enabled = previous !== "0";
    } else enabled = bridge.isEnabled();
  } catch { return; }
  function render() {
    const fa = window.kfGetLanguage?.() === "fa" || document.documentElement.lang === "fa";
    toggle.checked = enabled;
    label.textContent = fa ? "موسیقی پس‌زمینه" : "Background music";
    state.textContent = enabled ? (fa ? "روشن · بدون اینترنت" : "On · offline") : (fa ? "خاموش" : "Off");
    document.getElementById("kfMusicCreditsTitle").textContent = fa ? "سازندگان موسیقی" : "Music credits";
  }
  toggle.addEventListener("change", () => {
    enabled = toggle.checked;
    try { bridge.setEnabled(enabled); localStorage.setItem(key, enabled ? "1" : "0"); } catch {}
    render();
  });
  const credits = document.getElementById("kfMusicCredits");
  let loaded = false;
  credits.addEventListener("toggle", async () => {
    if (!credits.open || loaded) return;
    try {
      const r = await fetch(new URL("assets/music/catalog.json", document.baseURI));
      if (!r.ok) return;
      const data = await r.json();
      const ul = document.getElementById("kfMusicCreditList");
      ul.replaceChildren();
      for (const t of data) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = t.page; a.target = "_blank"; a.rel = "noopener noreferrer";
        a.textContent = t.title + " — " + t.artist;
        const license = document.createElement("a");
        license.href = t.license; license.target = "_blank"; license.rel = "noopener noreferrer";
        license.textContent = "CC BY 4.0";
        li.append(a, " · ", license, " · compressed MP3"); ul.append(li);
      }
      loaded = true;
    } catch {}
  });
  new MutationObserver(render).observe(document.documentElement, {attributes:true,attributeFilter:["class","lang"]});
  row.hidden = false;
  render();
})();
