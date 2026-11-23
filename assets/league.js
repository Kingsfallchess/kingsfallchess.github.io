(() => {
  const panel = document.getElementById('vipPanelLeague');
  // Style the registration CTA even if an older index.html remains cached in Android WebView.
  // The same scoped style in index.html covers clients that cache the older league.js.
  if (!document.getElementById('kfLeagueCtaStyle')) {
    const leagueCtaStyle = document.createElement('style');
    leagueCtaStyle.id = 'kfLeagueCtaStyle';
    leagueCtaStyle.textContent = `/* Kingsfall league registration call-to-action — scoped to the league panel. */
#vipPanelLeague .kf-league-population{margin:0 0 16px;padding:12px 15px;border:1px solid #967647;border-radius:12px;background:#291723;color:#ffe2a5;font-weight:700;text-align:start}
#vipPanelLeague > button{
  position:relative;display:inline-flex;align-items:center;justify-content:center;gap:11px;
  width:min(100%,290px);min-height:58px;margin:18px 0 8px;padding:14px 22px;
  border:1.5px solid #ffdf91;border-radius:16px;box-sizing:border-box;
  background:linear-gradient(135deg,#fff0b8 0%,#f0cb75 43%,#c8953f 100%);
  color:#172a41;font:inherit;font-size:16px;font-weight:850;line-height:1.3;
  text-align:center;letter-spacing:.2px;cursor:pointer;
  box-shadow:0 10px 24px rgba(194,133,39,.24),inset 0 1px 0 rgba(255,255,255,.7),inset 0 -2px 0 rgba(105,66,19,.26);
  transition:transform .18s ease,box-shadow .18s ease,filter .18s ease;
  -webkit-tap-highlight-color:transparent;
}
#vipPanelLeague > button::before{
  content:"♛";font-size:24px;line-height:1;flex:none;
  color:#293b4f;text-shadow:0 1px 0 rgba(255,255,255,.35);
}
#vipPanelLeague > button:hover:not(:disabled){
  transform:translateY(-2px);filter:brightness(1.05);
  box-shadow:0 14px 30px rgba(194,133,39,.34),0 0 15px rgba(243,200,106,.12),inset 0 1px 0 rgba(255,255,255,.8);
}
#vipPanelLeague > button:active:not(:disabled){
  transform:translateY(1px);box-shadow:0 4px 10px rgba(194,133,39,.23),inset 0 2px 5px rgba(95,54,12,.18);
}
#vipPanelLeague > button:focus-visible{outline:3px solid #fff2b2;outline-offset:4px}
#vipPanelLeague > button.is-secondary{
  background:linear-gradient(145deg,#203954,#10273e);
  color:#f3d99a;border-color:#bd9656;
  box-shadow:0 6px 17px rgba(0,0,0,.17),inset 0 1px 0 rgba(255,255,255,.08);
}
#vipPanelLeague > button.is-secondary::before{content:"↩";font-size:22px;color:#efd18a}
#vipPanelLeague > button[hidden]{display:none!important}
#vipPanelLeague > button:disabled{opacity:.55;cursor:wait;transform:none}
@media(max-width:520px){
  #vipPanelLeague > button{width:100%;min-height:60px;font-size:16px}
}
@media(prefers-reduced-motion:reduce){
  #vipPanelLeague > button{transition:none}
}

/* User-specific league level, shown within the registration button. */
#vipPanelLeague > button{width:min(100%,360px);flex-wrap:wrap}
#vipPanelLeague > button .kf-league-level{
  display:inline-flex;align-items:center;justify-content:center;flex:none;
  min-height:29px;padding:4px 10px;border-radius:9px;box-sizing:border-box;
  border:1px solid rgba(28,50,71,.22);background:rgba(30,51,71,.13);
  color:#172a41;font-size:12px;font-weight:900;line-height:1.2;
  white-space:nowrap;font-variant-numeric:tabular-nums;
}
#vipPanelLeague > button.is-secondary .kf-league-level{
  border-color:rgba(243,217,154,.45);background:rgba(243,217,154,.12);color:#f3d99a;
}

/* League game preferences: responsive visual controls. */
#vipPanelLeague .kf-league-studio{display:grid;gap:16px;margin:26px 0 18px;min-width:0;color:#f7e9e5}
#vipPanelLeague .kf-league-studio *{box-sizing:border-box}
#vipPanelLeague .kf-league-studio button{font:inherit;-webkit-tap-highlight-color:transparent}
#vipPanelLeague .kf-league-card{min-width:0;padding:18px;border-radius:19px;background:linear-gradient(145deg,rgba(59,13,27,.97),rgba(31,5,13,.98));border:1px solid rgba(235,184,108,.28);box-shadow:0 10px 23px rgba(0,0,0,.16)}
#vipPanelLeague .kf-league-card-head{display:flex;align-items:center;gap:11px;margin-bottom:16px}
#vipPanelLeague .kf-league-step{display:grid;place-items:center;flex:none;width:32px;height:32px;border-radius:10px;background:rgba(239,195,111,.13);border:1px solid rgba(239,195,111,.42);color:#f7d993;font-size:14px;font-weight:800}
#vipPanelLeague .kf-league-card-head h3{margin:0!important;color:#ffe4ac!important;font-size:15px!important;letter-spacing:0!important;font-weight:800}
#vipPanelLeague .kf-league-card-head small{display:block;color:#bda8aa;font-size:11px;margin-top:3px}
#vipPanelLeague .kf-league-mode-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
#vipPanelLeague .kf-league-option{appearance:none;min-width:0;background:#290b16;color:#eedbd8;border:1px solid #673143;border-radius:12px;cursor:pointer;transition:background .15s,border-color .15s,box-shadow .15s}
#vipPanelLeague .kf-league-option[aria-pressed=true]{border-color:#f1c877;background:linear-gradient(155deg,#513019,#31151d);box-shadow:inset 0 0 0 1px rgba(255,224,159,.2),0 0 0 2px rgba(241,200,119,.08)}
#vipPanelLeague .kf-league-option:focus-visible,#vipPanelLeague .kf-time-handle:focus-visible,#vipPanelLeague .kf-league-add:focus-visible,#vipPanelLeague .kf-league-save:focus-visible{outline:2px solid #ffe0a1;outline-offset:3px}
#vipPanelLeague .kf-league-mode{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:77px;padding:9px 3px}
#vipPanelLeague .kf-league-mode-symbol{font-size:22px;line-height:1.1}
#vipPanelLeague .kf-league-mode-name{font-size:11px;font-weight:750;text-align:center;line-height:1.2;overflow-wrap:anywhere}
#vipPanelLeague .kf-league-board-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:10px}
#vipPanelLeague .kf-league-board-option{display:flex;flex-direction:column;gap:7px;align-items:center;padding:9px 5px;min-height:111px}
#vipPanelLeague .kf-league-mini-board{display:block;position:relative;width:65px;aspect-ratio:1;border-radius:5px;overflow:hidden;box-shadow:0 1px 7px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.28);background:conic-gradient(var(--league-dark) 25%,var(--league-light) 0 50%,var(--league-dark) 0 75%,var(--league-light) 0) 0 0/50% 50%}
#vipPanelLeague .kf-league-mini-piece{position:absolute;transform:translate(-50%,-50%);font-size:15px;line-height:1;text-shadow:0 1px 2px #000,0 0 1px #fff}
#vipPanelLeague .kf-league-mini-piece.light{color:#fff8ea}
#vipPanelLeague .kf-league-mini-piece.dark{color:#221721;text-shadow:0 0 1px #fff,0 1px 1px #fff}
#vipPanelLeague .kf-league-board-name{font-size:10.5px;line-height:1.25;font-weight:700;text-align:center;min-height:25px;color:#f1dfdd}
#vipPanelLeague .kf-league-style-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px}
#vipPanelLeague .kf-league-style-option{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:5px;min-height:75px;padding:9px 5px}
#vipPanelLeague .kf-league-style-option strong{font-size:10.5px;line-height:1.3;text-align:center;font-weight:750}
#vipPanelLeague .kf-league-piece-preview{display:flex;align-items:center;justify-content:center;gap:3px;height:37px}
#vipPanelLeague .kf-league-piece-preview svg{width:31px!important;height:31px!important;max-width:31px}
#vipPanelLeague .kf-league-color-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:8px}
#vipPanelLeague .kf-league-color-option{display:flex;align-items:center;justify-content:flex-start;gap:9px;padding:10px 9px;min-height:48px;text-align:start}
#vipPanelLeague .kf-league-color-swatch{display:flex;gap:3px;flex:none}
#vipPanelLeague .kf-league-color-swatch i{display:block;width:18px;height:18px;border:1px solid rgba(255,255,255,.34);border-radius:50%;box-shadow:0 1px 2px rgba(0,0,0,.3)}
#vipPanelLeague .kf-league-color-name{font-size:11px;font-weight:750;line-height:1.25}
#vipPanelLeague .kf-league-time-note{font-size:12px;line-height:1.65;color:#d5bec0;margin:-4px 0 14px}
#vipPanelLeague .kf-time-windows{display:grid;gap:12px}
#vipPanelLeague .kf-time-window{min-width:0;background:rgba(12,3,10,.35);border:1px solid rgba(237,197,120,.23);border-radius:15px;padding:13px}
#vipPanelLeague .kf-time-row-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
#vipPanelLeague .kf-time-row-head strong{font-size:12px;color:#ffe0a1}
#vipPanelLeague .kf-time-delete{border:0;background:transparent;color:#dfaaa9;font-size:11px!important;cursor:pointer;padding:5px;border-radius:6px}
#vipPanelLeague .kf-time-values{display:flex;gap:7px;justify-content:space-between;margin-bottom:9px}
#vipPanelLeague .kf-time-chip{display:flex;flex-direction:column;gap:3px;min-width:0;max-width:49%;font-size:11px;white-space:nowrap;direction:ltr;text-align:start;background:#371221;border:1px solid rgba(237,197,120,.21);border-radius:9px;padding:7px 8px;color:#fff2dc;font-variant-numeric:tabular-nums}
#vipPanelLeague .kf-time-chip small{font-size:10px;color:#caadb1}
#vipPanelLeague .kf-time-rail{position:relative;direction:ltr;height:45px;margin:7px 12px 0;touch-action:pan-y}
#vipPanelLeague .kf-time-track{position:absolute;inset-inline:0;top:50%;height:9px;transform:translateY(-50%);border-radius:20px;background:#5a3540;box-shadow:inset 0 1px 3px rgba(0,0,0,.5)}
#vipPanelLeague .kf-time-fill{position:absolute;top:50%;height:9px;transform:translateY(-50%);border-radius:20px;background:linear-gradient(90deg,#b98435,#ffdc91);box-shadow:0 0 8px rgba(250,200,112,.28);pointer-events:none}
#vipPanelLeague .kf-time-handle{position:absolute;top:50%;transform:translate(-50%,-50%);width:34px;height:34px;padding:0;border:3px solid #fbe0a5;border-radius:50%;background:#552b31;box-shadow:0 3px 9px rgba(0,0,0,.42),inset 0 0 0 5px #b98c4b;cursor:ew-resize;touch-action:none;z-index:2}
#vipPanelLeague .kf-time-handle[data-edge=end]{background:#e5b75c;box-shadow:0 3px 9px rgba(0,0,0,.42),inset 0 0 0 5px #603432}
#vipPanelLeague .kf-time-axis{display:flex;justify-content:space-between;gap:3px;margin:0 0 3px;direction:ltr;font-size:10px;color:#b9a4a4;font-variant-numeric:tabular-nums}
#vipPanelLeague .kf-league-add{width:100%;margin-top:12px;min-height:44px;border-radius:12px;border:1px dashed #bd9656;background:rgba(227,183,96,.07);color:#ffe1a0;font-size:13px!important;font-weight:750!important;cursor:pointer}
#vipPanelLeague .kf-league-add:disabled{opacity:.45;cursor:not-allowed}
#vipPanelLeague .kf-league-save{width:100%;min-height:51px;padding:12px;border-radius:13px;border:1px solid #ffe4a4;background:linear-gradient(135deg,#ffe8a9,#e5b960 52%,#b98132);color:#2a1620;font-size:14px!important;font-weight:900!important;cursor:pointer;box-shadow:0 6px 18px rgba(194,137,53,.22)}
#vipPanelLeague .kf-league-save:disabled{opacity:.55;cursor:wait}
#vipPanelLeague .kf-league-save-status{min-height:18px;margin:3px 0 0;color:#d5bbc0;font-size:12px}
#vipPanelLeague .kf-league-save-status.ok{color:#b9dfb0}
#vipPanelLeague .kf-league-save-status.bad{color:#ffafae}
@media(max-width:430px){#vipPanelLeague .kf-league-card{padding:13px}#vipPanelLeague .kf-league-board-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}#vipPanelLeague .kf-league-board-option{padding:8px 2px}#vipPanelLeague .kf-league-time-note{font-size:11px}#vipPanelLeague .kf-time-window{padding:10px}#vipPanelLeague .kf-time-chip{font-size:10px;padding:6px 5px}}

/* League standings: show the next day's chosen availability next to each player. */
#vipPanelLeague .kf-league-standings{width:100%;border-collapse:separate;border-spacing:0 7px;table-layout:fixed;margin:10px 0 23px}
#vipPanelLeague .kf-league-standings tr{background:rgba(53,14,27,.65)}
#vipPanelLeague .kf-league-standings td{padding:10px 6px;vertical-align:middle;min-width:0;border-top:1px solid rgba(233,189,121,.15);border-bottom:1px solid rgba(233,189,121,.15)}
#vipPanelLeague .kf-league-standings td:first-child{width:33px;text-align:center;color:#d8b77c;border-left:1px solid rgba(233,189,121,.15);border-radius:11px 0 0 11px;font-variant-numeric:tabular-nums}
#vipPanelLeague .kf-league-standings td:last-child{border-right:1px solid rgba(233,189,121,.15);border-radius:0 11px 11px 0}
#vipPanelLeague .kf-league-standings .kf-league-player{width:30%;font-size:13px;font-weight:700;overflow-wrap:anywhere}
#vipPanelLeague .kf-league-standings .kf-league-score{width:68px;white-space:nowrap;color:#e5d1ce;font-size:11px}
#vipPanelLeague .kf-league-standings .kf-league-availability{width:auto}
#vipPanelLeague .kf-league-available-title{display:block;color:#b8a0a5;font-size:10px;margin-bottom:5px;line-height:1.3}
#vipPanelLeague .kf-league-available-items{display:flex;flex-wrap:wrap;gap:5px}
#vipPanelLeague .kf-league-available-chip{display:inline-block;color:#ffe3a6;border:1px solid rgba(236,185,99,.37);background:rgba(211,151,68,.12);border-radius:7px;padding:4px 6px;font-size:10px;line-height:1.25;white-space:nowrap;direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums}

/* Highlight shared hours only while a head-to-head game remains. */
#vipPanelLeague .kf-league-available-chip.is-match{
  color:#ddffe8;
  background:linear-gradient(135deg,rgba(34,130,76,.37),rgba(39,106,69,.28));
  border-color:rgba(114,236,152,.82);
  box-shadow:inset 0 0 0 1px rgba(141,255,171,.12),0 0 10px rgba(75,188,113,.16);
}
#vipPanelLeague .kf-league-no-hours{font-size:11px;color:#b3a0a3}
#vipPanelLeague .kf-league-standing-level{font-size:11px;white-space:nowrap}
@media(max-width:480px){
#vipPanelLeague .kf-league-standings{border-spacing:0 6px}
#vipPanelLeague .kf-league-standings td{padding:9px 4px}
#vipPanelLeague .kf-league-standings td:first-child{width:24px}
#vipPanelLeague .kf-league-standings .kf-league-player{width:27%;font-size:11px}
#vipPanelLeague .kf-league-standings .kf-league-score{width:44px;font-size:10px}
#vipPanelLeague .kf-league-available-chip{font-size:9px;padding:4px}
}

/* Manual refresh: no interval-based standings polling. */
#vipPanelLeague .kf-league-standings-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin:25px 0 10px}
#vipPanelLeague .kf-league-standings-header h3{margin:0!important}
#vipPanelLeague .kf-league-refresh-hours{display:inline-flex;align-items:center;justify-content:center;min-height:37px;padding:7px 13px;border:1px solid rgba(239,195,111,.65);background:linear-gradient(145deg,rgba(92,47,32,.86),rgba(49,16,24,.95));color:#ffe4a3;border-radius:10px;font:inherit;font-size:12px;font-weight:750;cursor:pointer;transition:filter .15s ease}
#vipPanelLeague .kf-league-refresh-hours:hover:not(:disabled){filter:brightness(1.17)}
#vipPanelLeague .kf-league-refresh-hours:focus-visible{outline:2px solid #ffe4a3;outline-offset:2px}
#vipPanelLeague .kf-league-refresh-hours:disabled{opacity:.65;cursor:wait}
#vipPanelLeague .kf-league-refresh-status{min-height:14px;margin:0 0 7px;color:#b7d4ad;font-size:11px}
#vipPanelLeague .kf-league-refresh-status.is-error{color:#ffb4b1}

/* Compact mobile-friendly schedule cards; counting down never polls the server. */
#vipPanelLeague .kf-schedule{display:grid;gap:16px;margin:18px 0 28px;min-width:0}
#vipPanelLeague .kf-schedule-title{display:flex;align-items:center;gap:9px;margin:0;color:var(--gold2,#ffe6ad);font-size:17px;font-weight:850;letter-spacing:.015em}
#vipPanelLeague .kf-schedule-day{overflow:hidden;min-width:0;border-radius:19px;border:1px solid rgba(236,193,118,.25);background:linear-gradient(150deg,rgba(67,23,37,.48),rgba(24,8,18,.25));box-shadow:0 12px 26px rgba(0,0,0,.12)}
#vipPanelLeague .kf-schedule-day>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;list-style:none;padding:15px 16px;color:var(--gold2,#ffe6ad);font-size:14px;font-weight:800;cursor:pointer;background:rgba(239,195,111,.065)}
#vipPanelLeague .kf-schedule-day>summary::-webkit-details-marker{display:none}
#vipPanelLeague .kf-schedule-day>summary:focus-visible{outline:2px solid #edc56b;outline-offset:-3px}
#vipPanelLeague .kf-schedule-day>summary .kf-schedule-chevron{color:#d6b273;transition:transform .2s ease}
#vipPanelLeague .kf-schedule-day:not([open])>summary .kf-schedule-chevron{transform:rotate(-90deg)}
#vipPanelLeague .kf-schedule-day-body{display:grid;gap:11px;padding:12px}
#vipPanelLeague .kf-schedule-match{min-width:0;padding:15px;border:1px solid rgba(240,195,112,.24);border-radius:16px;background:linear-gradient(140deg,rgba(102,45,53,.27),rgba(29,9,22,.23));box-shadow:0 5px 16px rgba(0,0,0,.12)}
#vipPanelLeague .kf-schedule-match.is-mine{border-color:rgba(237,197,107,.7);box-shadow:inset 0 0 0 1px rgba(237,197,107,.08),0 6px 18px rgba(0,0,0,.14)}
#vipPanelLeague .kf-schedule-match-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:16px}
#vipPanelLeague .kf-schedule-status{display:inline-flex;gap:5px;align-items:center;border-radius:999px;padding:6px 10px;border:1px solid rgba(238,193,110,.36);color:#ffe0a5;background:rgba(218,165,71,.10);font-size:11px;font-weight:800;white-space:nowrap}
#vipPanelLeague .kf-schedule-status.is-live{color:#b9f8d2;border-color:rgba(82,198,133,.58);background:rgba(60,150,90,.18)}
#vipPanelLeague .kf-schedule-status.is-ended{color:#ced0d9;border-color:rgba(181,181,197,.28);background:rgba(159,159,166,.08)}
#vipPanelLeague .kf-schedule-countdown{display:flex;gap:6px;align-items:center;justify-content:center;min-width:0;padding:7px 10px;border-radius:10px;border:1px solid rgba(241,197,113,.27);background:rgba(255,207,122,.075);color:#ffe4ac;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap;direction:ltr;unicode-bidi:isolate}
#vipPanelLeague .kf-schedule-countdown strong{font-weight:900;letter-spacing:.025em}
#vipPanelLeague .kf-schedule-countdown.is-due{color:#b9f8d2;border-color:rgba(82,198,133,.45);background:rgba(60,150,90,.12)}
#vipPanelLeague .kf-schedule-versus{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:8px;margin-bottom:15px;direction:ltr}
#vipPanelLeague .kf-schedule-player{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0;text-align:center}
#vipPanelLeague .kf-schedule-avatar{display:grid;place-items:center;width:43px;height:43px;border-radius:13px;border:1px solid rgba(243,196,108,.42);background:linear-gradient(145deg,rgba(250,203,113,.16),rgba(95,42,45,.25));color:#ffdfa0;font-size:20px;box-shadow:inset 0 1px rgba(255,255,255,.08)}
#vipPanelLeague .kf-schedule-player-name{display:block;width:100%;overflow-wrap:anywhere;color:var(--text,#fff1eb);font-size:13px;font-weight:780;line-height:1.3}
#vipPanelLeague .kf-schedule-you{color:#e8ca80;font-size:10px}
#vipPanelLeague .kf-schedule-vs{border-radius:100px;padding:7px 8px;border:1px solid rgba(238,198,128,.2);background:rgba(0,0,0,.12);color:#c8a79c;font-size:11px;font-weight:900}
#vipPanelLeague .kf-schedule-details{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;border-top:1px solid rgba(238,193,110,.14);padding-top:12px}
#vipPanelLeague .kf-schedule-detail{display:inline-flex;align-items:center;gap:5px;min-width:0;padding:6px 9px;border-radius:9px;background:rgba(255,255,255,.045);border:1px solid rgba(245,205,134,.14);color:var(--text,#efe1dd);font-size:11px;line-height:1.4}
#vipPanelLeague .kf-schedule-empty{color:var(--muted,#c2a7ad);font-size:12px;padding:10px 5px;text-align:center}
@media(max-width:430px){#vipPanelLeague .kf-schedule-day-body{padding:9px;gap:9px}#vipPanelLeague .kf-schedule-match{padding:11px}#vipPanelLeague .kf-schedule-match-head{margin-bottom:13px}#vipPanelLeague .kf-schedule-avatar{width:37px;height:37px;font-size:17px}#vipPanelLeague .kf-schedule-player-name{font-size:11.5px}#vipPanelLeague .kf-schedule-countdown{font-size:11px;padding:6px 7px}#vipPanelLeague .kf-schedule-detail{font-size:10px}}
@media(prefers-reduced-motion:reduce){#vipPanelLeague .kf-schedule-day>summary .kf-schedule-chevron{transition:none}}

/* Highlight the current player's pairing with a distinct green surface. */
#vipPanelLeague .kf-schedule-match.is-mine{
  border:1.5px solid rgba(108,230,148,.82);
  background:linear-gradient(140deg,rgba(28,108,65,.38),rgba(14,53,40,.48));
  box-shadow:inset 0 0 0 1px rgba(142,255,178,.13),0 7px 21px rgba(12,91,49,.20);
}
#vipPanelLeague .kf-schedule-match.is-mine .kf-schedule-avatar{
  border-color:rgba(135,231,162,.55);
  background:linear-gradient(145deg,rgba(106,205,142,.20),rgba(31,115,74,.32));
  color:#c8f6d5;
}
#vipPanelLeague .kf-schedule-match.is-mine .kf-schedule-you{color:#9df2b8;font-weight:850}
#vipPanelLeague .kf-schedule-match.is-mine .kf-schedule-details{border-top-color:rgba(126,226,150,.25)}
#vipPanelLeague .kf-schedule-match.is-mine .kf-schedule-detail{border-color:rgba(126,226,150,.24)}
#vipPanelLeague .kf-schedule-player.is-winner .kf-schedule-player-name{color:#ffe1a0}
#vipPanelLeague .kf-schedule-player.is-loser .kf-schedule-player-name{opacity:.7}
#vipPanelLeague .kf-schedule-player-result{font-size:10px;color:#b7dbb7;font-weight:800;line-height:1.2}
#vipPanelLeague .kf-schedule-player-result.is-loss{color:#d5a3a7}
#vipPanelLeague .kf-schedule-result{display:flex;flex-direction:column;gap:5px;align-items:center;justify-content:center;margin:-2px 0 12px;padding:11px 8px;border-radius:12px;border:1px solid rgba(241,192,109,.3);background:rgba(221,176,94,.09);text-align:center}
#vipPanelLeague .kf-schedule-result.is-draw{border-color:rgba(185,195,217,.26);background:rgba(152,159,179,.08)}
#vipPanelLeague .kf-schedule-result-score{font-size:23px;font-weight:900;color:#ffe1a0;line-height:1.1;direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums;letter-spacing:.05em}
#vipPanelLeague .kf-schedule-result.is-draw .kf-schedule-result-score{color:#d9dfe8}
#vipPanelLeague .kf-schedule-result-caption{color:#e7dbd0;font-size:11px;font-weight:700;line-height:1.4;overflow-wrap:anywhere}
#vipPanelLeague .kf-schedule-header{display:flex;flex-wrap:wrap;gap:9px;align-items:center;justify-content:space-between}
#vipPanelLeague .kf-schedule-refresh{font:inherit;font-size:11px;font-weight:800;color:#ffe3a6;min-height:35px;border-radius:10px;padding:7px 10px;border:1px solid rgba(236,188,104,.53);background:rgba(219,159,77,.10);cursor:pointer}
#vipPanelLeague .kf-schedule-refresh:disabled{opacity:.55;cursor:wait}
#vipPanelLeague .kf-schedule-refresh:focus-visible{outline:2px solid #ffe4a3;outline-offset:2px}
#vipPanelLeague .kf-schedule-refresh-note{font-size:11px;color:#a8dabc;min-height:15px;line-height:1.3}
#vipPanelLeague .kf-schedule-refresh-note.is-error{color:#f4b4ba}

`;
    document.head.appendChild(leagueCtaStyle);
  }
  const population = document.createElement('p');
  population.className = 'kf-league-population';
  population.setAttribute('role', 'status');
  population.hidden = true;
  const message = document.createElement('p');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'kf-league-cta';
  message.setAttribute('role', 'status');
  panel.replaceChildren(population, message, button);
  const alerts = document.createElement('a');
  const alertStatus = document.createElement('p');
  alertStatus.setAttribute('role', 'status');
  alerts.href = '/enable-league-push';
  alerts.hidden = true;
  alerts.onclick = () => {
    alertStatus.textContent = label('Waiting for Android…', 'در انتظار پاسخ اندروید…');
  };
  panel.append(alerts, alertStatus);
  window.addEventListener('kf-league-push-status', event => {
    alertStatus.textContent = event.detail?.ok
      ? label('Phone registered for league alerts.', 'گوشی برای اعلان لیگ ثبت شد.')
      : label('Try enabling alerts again.', 'فعال‌سازی اعلان را دوباره امتحان کن.');
  });
  const availability = document.createElement('div');
  panel.append(availability);
  const leagueHourLocale = () => window.kfGetLanguage?.() === 'fa' ? 'fa-IR' : 'en-GB';
  function leagueWindowsOverlap(a,b) {
    const aStart=Date.parse(a?.start),aEnd=Date.parse(a?.end);
    const bStart=Date.parse(b?.start),bEnd=Date.parse(b?.end);
    return [aStart,aEnd,bStart,bEnd].every(Number.isFinite) &&
      aEnd>aStart && bEnd>bStart && aStart<bEnd && bStart<aEnd;
  }
  let displayedLeagueWindows = {};
  let ownLeagueWindows = [];
  let completedGames = new Map();
  function updateCompletedGames(matches) {
    completedGames = new Map();
    const user = currentUser?.id;
    for (const match of matches || []) {
      if (match.state !== 'won' && match.state !== 'draw') continue;
      if (match.host !== user && match.guest !== user) continue;
      const opponent = match.host === user ? match.guest : match.host;
      completedGames.set(opponent, (completedGames.get(opponent) || 0) + 1);
    }
  }
  function drawLeagueHourRows(rows) {
    for (const row of rows) {
      if (!row.isConnected) continue;
      const cell=row.querySelector('.kf-league-availability');
      if (!cell) continue;
      const id=row.dataset.kfLeaguePlayer;
      renderMemberHours(cell,displayedLeagueWindows[id],ownLeagueWindows,id);
    }
  }
  function renderMemberHours(cell, windows, myWindows, playerId) {
    cell.replaceChildren();
    const title = document.createElement('span');
    title.className = 'kf-league-available-title';
    title.textContent = label('Chosen hours','ساعت‌های انتخابی');
    cell.append(title);
    if (!Array.isArray(windows) || windows.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'kf-league-no-hours';
      empty.textContent = label('Not selected','ثبت نشده');
      cell.append(empty);
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'kf-league-available-items';
    const locale = leagueHourLocale();
    const formatter = new Intl.DateTimeFormat(locale,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const clock = new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const canMeet = playerId !== currentUser?.id && (completedGames.get(playerId) || 0) < 2;
    for (const range of windows) {
      const start = new Date(range.start), end = new Date(range.end);
      if(!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue;
      const chip = document.createElement('span');
      chip.className = 'kf-league-available-chip';
      if (canMeet && Array.isArray(myWindows) &&
          myWindows.some(mine=>leagueWindowsOverlap(range,mine))) {
        chip.classList.add('is-match');
      }
      chip.textContent = formatter.format(start) + ' – ' + (start.toDateString() === end.toDateString() ? clock.format(end) : formatter.format(end));
      wrap.append(chip);
    }
    cell.append(wrap);
  }
  let leagueBoardRefreshInFlight = false;
  async function syncLeagueMemberHours(button, status) {
    if (panel.hidden || leagueBoardRefreshInFlight) return;
    const rows = availability.querySelectorAll('tr[data-kf-league-player]');
    if (!rows.length) return;
    leagueBoardRefreshInFlight = true;
    const user = currentUser?.id;
    if (button) {
      button.disabled = true;
      button.textContent = label('Refreshing…', 'در حال به‌روزرسانی…');
    }
    if (status) {
      status.textContent = '';
      status.classList.remove('is-error');
    }
    try {
      const result = await sb.rpc('kf_league_board');
      if (result.error || !result.data) throw result.error || new Error('No league board');
      if (currentUser?.id !== user || panel.hidden) return;
      if (!rows[0].isConnected) return;
      updateCompletedGames(result.data.matches);
      displayedLeagueWindows = result.data.availability_by_player || {};
      ownLeagueWindows = Array.isArray(result.data.windows) ? result.data.windows : [];
      drawLeagueHourRows(rows);
      if (status?.isConnected) status.textContent = label('Times updated.', 'ساعت‌ها به‌روز شدند.');
    } catch (_) {
      if (status?.isConnected) {
        status.textContent = label('Refresh failed. Try again.', 'به‌روزرسانی انجام نشد. دوباره تلاش کن.');
        status.classList.add('is-error');
      }
    } finally {
      leagueBoardRefreshInFlight = false;
      if (button?.isConnected) {
        button.disabled = false;
        button.textContent = label('↻ Refresh times', '↻ رفرش ساعت‌ها');
      }
    }
  }

  let leagueCountdownTimer = null;
  function stopLeagueCountdowns() {
    if (leagueCountdownTimer !== null) {
      clearInterval(leagueCountdownTimer);
      leagueCountdownTimer = null;
    }
  }
  function leagueCountFormat(seconds) {
    const total=Math.max(0,Math.ceil(seconds));
    const days=Math.floor(total/86400);
    const hours=Math.floor(total%86400/3600);
    const mins=Math.floor(total%3600/60);
    const secs=total%60;
    const num=n=>String(n).padStart(2,'0');
    const result=(days>0?days+' '+label('d','روز')+'  ':'')+num(hours)+':'+num(mins)+':'+num(secs);
    return window.kfGetLanguage?.()==='fa' ? result.replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : result;
  }
  function updateLeagueCountdowns() {
    if (panel.hidden || document.hidden || !availability.isConnected) {
      stopLeagueCountdowns();
      return;
    }
    let future = 0;
    for (const chip of availability.querySelectorAll('[data-league-start]')) {
      const start=Number(chip.dataset.leagueStart);
      if (!Number.isFinite(start)) continue;
      const delta=start-Date.now();
      if (delta>0) {
        future++;
        chip.classList.remove('is-due');
        chip.replaceChildren();
        const caption=document.createElement('span');
        caption.textContent=label('Starts in','تا شروع')+':';
        const counter=document.createElement('strong');
        counter.textContent=leagueCountFormat(delta/1000);
        chip.append(caption,counter);
      } else {
        chip.classList.add('is-due');
        chip.textContent=label('Kickoff time reached','زمان شروع فرا رسید');
      }
    }
    if (!future) stopLeagueCountdowns();
  }
  function startLeagueCountdowns() {
    stopLeagueCountdowns();
    if (panel.hidden || document.hidden) return;
    updateLeagueCountdowns();
    if (availability.querySelector('[data-league-start]:not(.is-due)')) {
      leagueCountdownTimer=setInterval(updateLeagueCountdowns,1000);
    }
  }
  document.addEventListener('visibilitychange',()=>{
    if (document.hidden) stopLeagueCountdowns();
    else if (!panel.hidden) startLeagueCountdowns();
  });

  function updateLeagueScores(group) {
    const table=availability.querySelector('.kf-league-standings');
    if (!table || !Array.isArray(group.standings)) return;
    const oldRows=new Map(Array.from(table.querySelectorAll('tr[data-kf-league-player]'),row=>[row.dataset.kfLeaguePlayer,row]));
    for (const standing of group.standings) {
      const row=oldRows.get(String(standing.player));
      if (!row) continue;
      if (row.cells[0]) row.cells[0].textContent=standing.place;
      const score=row.querySelector('.kf-league-score');
      if (score) score.textContent=standing.points+label(' pts',' امتیاز');
      table.append(row);
    }
  }
  function renderLeagueSchedule(group) {
    stopLeagueCountdowns();
      const scheduleWrap=document.createElement('section');
      scheduleWrap.className='kf-schedule';
      const scheduleHeader=document.createElement('div');
      scheduleHeader.className='kf-schedule-header';
      const scheduleTitle=document.createElement('h3');
      scheduleTitle.className='kf-schedule-title';
      scheduleTitle.textContent=label('♛  Match schedule','♛  برنامهٔ مسابقات');
      const scheduleRefresh=document.createElement('button');
      scheduleRefresh.type='button';
      scheduleRefresh.className='kf-schedule-refresh';
      scheduleRefresh.textContent=label('↻ Refresh results','↻ رفرش نتایج');
      const scheduleFeedback=document.createElement('span');
      scheduleFeedback.className='kf-schedule-refresh-note';
      scheduleFeedback.setAttribute('role','status');
      scheduleRefresh.onclick=async()=>{
        scheduleRefresh.disabled=true;
        scheduleRefresh.textContent=label('Refreshing…','در حال دریافت…');
        scheduleFeedback.textContent='';
        scheduleFeedback.classList.remove('is-error');
        try {
          const reply=await sb.rpc('kf_league_board');
          if(reply.error || !reply.data || reply.data.group_id!==group.group_id) throw reply.error||new Error('Invalid league board');
          if(panel.hidden || !scheduleWrap.isConnected) return;
          updateCompletedGames(reply.data.matches);
          drawLeagueHourRows(availability.querySelectorAll('tr[data-kf-league-player]'));
          updateLeagueScores(reply.data);
          renderLeagueSchedule(reply.data);
        } catch(_) {
          scheduleFeedback.textContent=label('Could not refresh results.','دریافت نتایج ناموفق بود.');
          scheduleFeedback.classList.add('is-error');
        } finally {
          if(scheduleRefresh.isConnected) {
            scheduleRefresh.disabled=false;
            scheduleRefresh.textContent=label('↻ Refresh results','↻ رفرش نتایج');
          }
        }
      };
      scheduleHeader.append(scheduleTitle,scheduleRefresh);
      scheduleWrap.append(scheduleHeader,scheduleFeedback);
      const modeLabels={
        classic:label('Classic 5+0','عادی ۵+۰'),
        roulette:label('Roulette','رولت'),
        bloodblade:label('Blood Tributes','قربانی خون')
      };
      const stateLabels={
        scheduled:label('● Scheduled','● زمان‌بندی‌شده'),
        playing:label('● Live','● در حال بازی'),
        draw:label('Draw','مساوی'),
        cancelled:label('Cancelled','لغوشده'),
        won:label('Finished','تمام‌شده')
      };
      const matchDateFmt=new Intl.DateTimeFormat(window.kfGetLanguage?.()==='fa'?'fa-IR':'en-GB',{
        day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
      });
      for (let day=1;day<=group.round;day++) {
        const games=(group.matches||[]).filter(m=>m.day===day);
        const section=document.createElement('details');
        section.className='kf-schedule-day';
        section.open=day===group.round;
        const summary=document.createElement('summary');
        summary.textContent=label('Day ','روز ')+day.toLocaleString(window.kfGetLanguage?.()==='fa'?'fa-IR':'en-US');
        const chevron=document.createElement('span');
        chevron.className='kf-schedule-chevron';
        chevron.textContent='▾';
        summary.append(chevron);
        section.append(summary);
        const body=document.createElement('div');
        body.className='kf-schedule-day-body';
        if (!games.length) {
          const empty=document.createElement('p');
          empty.className='kf-schedule-empty';
          empty.textContent=label('No matches have been scheduled for this day.','برای این روز مسابقه‌ای برنامه‌ریزی نشده است.');
          body.append(empty);
        }
        if (games.length && !games.some(m=>m.host===currentUser?.id || m.guest===currentUser?.id)) {
          const note=document.createElement('p');
          note.className='kf-schedule-empty';
          note.textContent=label('No match for you today · 0 points','امروز مسابقه‌ای نداری · صفر امتیاز');
          body.append(note);
        }
        for (const m of games) {
          const own=m.host===currentUser?.id || m.guest===currentUser?.id;
          const card=document.createElement('article');
          card.className='kf-schedule-match'+(own?' is-mine':'');
          const head=document.createElement('div');
          head.className='kf-schedule-match-head';
          const status=document.createElement('span');
          status.className='kf-schedule-status'+(m.state==='playing'?' is-live':(m.state==='scheduled'?'':' is-ended'));
          status.textContent=stateLabels[m.state]||m.state||label('Match','مسابقه');
          const countdown=document.createElement('span');
          countdown.className='kf-schedule-countdown';
          if (m.state==='scheduled' && Number.isFinite(Date.parse(m.starts))) {
            countdown.dataset.leagueStart=String(Date.parse(m.starts));
            countdown.textContent=label('Calculating…','در حال محاسبه…');
          } else {
            countdown.textContent=m.state==='playing'?label('Game is live','بازی در جریان است'):label('Match concluded','مسابقه پایان یافته');
          }
          head.append(status,countdown);
          const versus=document.createElement('div');
          versus.className='kf-schedule-versus';
          const winnerId=m.state==='won' && (m.winner===m.host || m.winner===m.guest) ? m.winner : null;
          const makePlayer=(name,isMine,playerId)=>{
            const player=document.createElement('div');
            player.className='kf-schedule-player'+(winnerId===playerId?' is-winner':(winnerId && playerId!==winnerId?' is-loser':''));
            const avatar=document.createElement('span');
            avatar.className='kf-schedule-avatar';
            avatar.textContent='♚';
            const title=document.createElement('strong');
            title.className='kf-schedule-player-name';
            title.textContent=name||label('Player','بازیکن');
            player.append(avatar,title);
            if (winnerId) {
              const resultMarker=document.createElement('span');
              resultMarker.className='kf-schedule-player-result'+(playerId!==winnerId?' is-loss':'');
              resultMarker.textContent=playerId===winnerId?label('Winner','برنده'):label('Lost','بازنده');
              player.append(resultMarker);
            }
            if (isMine) {
              const you=document.createElement('span');
              you.className='kf-schedule-you';
              you.textContent=label('YOU','شما');
              player.append(you);
            }
            return player;
          };
          const vs=document.createElement('span');
          vs.className='kf-schedule-vs';
          vs.textContent='VS';
          versus.append(makePlayer(m.home_name,m.host===currentUser?.id,m.host),vs,makePlayer(m.away_name,m.guest===currentUser?.id,m.guest));
          const meta=document.createElement('div');
          meta.className='kf-schedule-details';
          const when=document.createElement('span');
          when.className='kf-schedule-detail';
          when.textContent='◷  '+(Number.isFinite(Date.parse(m.starts))?matchDateFmt.format(new Date(m.starts)):'—');
          const gameMode=document.createElement('span');
          gameMode.className='kf-schedule-detail';
          gameMode.textContent='♟  '+(modeLabels[m.mode]||m.mode||'Classic');
          meta.append(when,gameMode);
          card.append(head,versus);
          if (m.state==='won' || m.state==='draw') {
            const result=document.createElement('div');
            result.className='kf-schedule-result'+(m.state==='draw'?' is-draw':'');
            const score=document.createElement('strong');
            score.className='kf-schedule-result-score';
            const explanation=document.createElement('span');
            explanation.className='kf-schedule-result-caption';
            if (m.state==='draw') {
              score.textContent='½ – ½';
              explanation.textContent=label('Draw · half a point each','مساوی · نیم امتیاز برای هر بازیکن');
            } else if (winnerId) {
              score.textContent=winnerId===m.host?'1 – 0':'0 – 1';
              explanation.textContent=label('Winner: ','برنده: ')+(winnerId===m.host?m.home_name:m.away_name);
            } else {
              score.textContent='–';
              explanation.textContent=label('Final result not available','نتیجهٔ نهایی مشخص نیست');
            }
            result.append(score,explanation);
            card.append(result);
          }
          card.append(meta);
          body.append(card);
        }
        section.append(body);
        scheduleWrap.append(section);
      }
      const priorSchedule=availability.querySelector('.kf-schedule');
      if (priorSchedule) priorSchedule.replaceWith(scheduleWrap);
      else availability.append(scheduleWrap);
      startLeagueCountdowns();
  
  }
  function renderWindows(group) {
    stopLeagueCountdowns();
    availability.replaceChildren();
    updateCompletedGames(group.matches);
    displayedLeagueWindows = group.availability_by_player || {};
    ownLeagueWindows = Array.isArray(group.windows) ? group.windows : [];
    const heading = text => {
      const title = document.createElement('h3'); title.textContent = text; availability.append(title);
    };
    const standingsHead = document.createElement('div');
    standingsHead.className = 'kf-league-standings-header';
    const standingsTitle = document.createElement('h3');
    standingsTitle.textContent = label('Group standings','جدول گروه');
    standingsHead.append(standingsTitle);
    const refreshStatus = document.createElement('p');
    refreshStatus.className = 'kf-league-refresh-status';
    refreshStatus.setAttribute('role','status');
    if (!group.finished) {
      const refreshButton = document.createElement('button');
      refreshButton.type = 'button';
      refreshButton.className = 'kf-league-refresh-hours';
      refreshButton.textContent = label('↻ Refresh times', '↻ رفرش ساعت‌ها');
      refreshButton.onclick = () => syncLeagueMemberHours(refreshButton, refreshStatus);
      standingsHead.append(refreshButton);
    }
    availability.append(standingsHead,refreshStatus);
    const table = document.createElement('table');
    table.className = 'kf-league-standings';
    table.dir = 'ltr';
    for (const row of group.standings || []) {
      const tr = table.insertRow();
      tr.dataset.kfLeaguePlayer = String(row.player);
      tr.insertCell().textContent = row.place;
      const name = tr.insertCell();
      name.className = 'kf-league-player';
      name.textContent = row.name;
      const points = tr.insertCell();
      points.className = 'kf-league-score';
      points.textContent = row.points + label(' pts',' امتیاز');
      if(group.finished) {
        const level = tr.insertCell();
        level.className = 'kf-league-standing-level';
        level.textContent = label('Level ','سطح ') + row.next_level;
      } else {
        const time = tr.insertCell();
        time.className = 'kf-league-availability';
        renderMemberHours(time,displayedLeagueWindows[row.player],ownLeagueWindows,row.player);
      }
    }
    availability.append(table);
    renderLeagueSchedule(group);

    if (!group.can_edit) return;
    const studio = document.createElement('div');
    studio.className = 'kf-league-studio';
    studio.dir = window.kfGetLanguage?.() === 'fa' ? 'rtl' : 'ltr';
    availability.append(studio);

    function makeCard(number, en, fa, hintEn, hintFa) {
      const card = document.createElement('section');
      card.className = 'kf-league-card';
      const head = document.createElement('div');
      head.className = 'kf-league-card-head';
      const step = document.createElement('span');
      step.className = 'kf-league-step';
      step.textContent = String(number);
      const heading = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = label(en, fa);
      const hint = document.createElement('small');
      hint.textContent = label(hintEn, hintFa);
      heading.append(title, hint);
      head.append(step, heading);
      card.append(head);
      studio.append(card);
      return card;
    }

    const initialStyle = group.style || {};
    let chosenMode = ['classic', 'roulette', 'bloodblade'].includes(group.mode) ? group.mode : 'classic';
    let chosenBoard = vipBoardThemes.some(t => t.id === initialStyle.board) ? initialStyle.board : 'default';
    let chosenPieces = vipPieceStyles.some(t => t.id === initialStyle.pieces) ? initialStyle.pieces : 'classic';
    let chosenColor = vipPieceColors.some(t => t.id === initialStyle.color) ? initialStyle.color : 'standard';

    const modeCard = makeCard(1, 'Game mode', 'نوع بازی', 'Choose the game played when you host', 'نوع بازی در زمان میزبانی شما');
    const modeGrid = document.createElement('div');
    modeGrid.className = 'kf-league-mode-grid';
    modeCard.append(modeGrid);
    const modes = [
      {id: 'classic', icon: '♟', en: 'Classic 5+0', fa: 'عادی ۵+۰'},
      {id: 'roulette', icon: '🎲', en: 'Roulette', fa: 'رولت'},
      {id: 'bloodblade', icon: '⚔', en: 'Blood Tributes', fa: 'قربانی خون'}
    ];
    function drawModes() {
      modeGrid.replaceChildren();
      modes.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kf-league-option kf-league-mode';
        btn.setAttribute('aria-pressed', String(chosenMode === item.id));
        const symbol = document.createElement('span');
        symbol.className = 'kf-league-mode-symbol';
        symbol.textContent = item.icon;
        const title = document.createElement('span');
        title.className = 'kf-league-mode-name';
        title.textContent = label(item.en, item.fa);
        btn.append(symbol, title);
        btn.onclick = () => { chosenMode = item.id; drawModes(); };
        modeGrid.append(btn);
      });
    }
    drawModes();

    const boardCard = makeCard(2, 'Choose a board', 'انتخاب تخته', 'Tap a miniature board to select it', 'روی تصویر کوچک تخته بزن');
    const boardGrid = document.createElement('div');
    boardGrid.className = 'kf-league-board-grid';
    boardCard.append(boardGrid);
    function drawBoards() {
      boardGrid.replaceChildren();
      vipBoardThemes.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kf-league-option kf-league-board-option';
        btn.setAttribute('aria-pressed', String(chosenBoard === item.id));
        btn.setAttribute('aria-label', item.name);
        const preview = document.createElement('span');
        preview.className = 'kf-league-mini-board';
        preview.style.setProperty('--league-light', item.light);
        preview.style.setProperty('--league-dark', item.dark);
        [[0,0,'♜',true],[3,0,'♞',true],[1,3,'♙',false],[2,3,'♔',false]].forEach(([x,y,glyph,dark]) => {
          const piece = document.createElement('span');
          piece.className = 'kf-league-mini-piece ' + (dark ? 'dark' : 'light');
          piece.textContent = glyph;
          piece.style.left = (12.5 + x * 25) + '%';
          piece.style.top = (12.5 + y * 25) + '%';
          preview.append(piece);
        });
        const title = document.createElement('span');
        title.className = 'kf-league-board-name';
        title.textContent = item.name;
        btn.append(preview, title);
        btn.onclick = () => { chosenBoard = item.id; drawBoards(); };
        boardGrid.append(btn);
      });
    }
    drawBoards();

    const pieceCard = makeCard(3, 'Piece design', 'شکل مهره‌ها', 'Preview the actual piece set', 'پیش‌نمایش ظاهر واقعی مهره‌ها');
    const pieceGrid = document.createElement('div');
    pieceGrid.className = 'kf-league-style-grid';
    pieceCard.append(pieceGrid);
    function drawPieces() {
      pieceGrid.replaceChildren();
      vipPieceStyles.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kf-league-option kf-league-style-option';
        btn.setAttribute('aria-pressed', String(chosenPieces === item.id));
        const preview = document.createElement('span');
        preview.className = 'kf-league-piece-preview';
        try {
          preview.innerHTML = svg({color:'w',type:'n'}, item.id, chosenColor) +
            svg({color:'b',type:'k'}, item.id, chosenColor);
        } catch (e) { preview.textContent = '♘  ♚'; }
        const title = document.createElement('strong');
        title.textContent = item.name;
        btn.append(preview, title);
        btn.onclick = () => { chosenPieces = item.id; drawPieces(); };
        pieceGrid.append(btn);
      });
    }
    drawPieces();

    const colorCard = makeCard(4, 'Piece colors', 'رنگ مهره‌ها', 'Select a matching palette', 'ترکیب رنگ دلخواه را انتخاب کن');
    const colorGrid = document.createElement('div');
    colorGrid.className = 'kf-league-color-grid';
    colorCard.append(colorGrid);
    vipPieceColors.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kf-league-option kf-league-color-option';
      const swatch = document.createElement('span');
      swatch.className = 'kf-league-color-swatch';
      for (const shade of [item.white, item.black]) {
        const dot = document.createElement('i');
        dot.style.background = shade;
        swatch.append(dot);
      }
      const title = document.createElement('span');
      title.className = 'kf-league-color-name';
      title.textContent = item.name;
      btn.append(swatch, title);
      btn.setAttribute('aria-pressed', String(chosenColor === item.id));
      btn.onclick = () => {
        chosenColor = item.id;
        colorGrid.querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed', String(node === btn)));
        drawPieces();
      };
      colorGrid.append(btn);
    });

    const timeCard = makeCard(5, 'Available playing times', 'ساعت‌های آزاد بازی', 'Drag each end of the timeline to choose a time range', 'ابتدا و انتهای نوار را بکش تا بازه انتخاب شود');
    const note = document.createElement('p');
    note.className = 'kf-league-time-note';
    note.textContent = label('Times are shown in your local timezone · 15-minute increments.',
      'ساعت‌ها به وقت محلی شما هستند · گام‌های ۱۵ دقیقه‌ای.');
    timeCard.append(note);
    const timeRows = document.createElement('div');
    timeRows.className = 'kf-time-windows';
    timeCard.append(timeRows);
    const stepMs = 15 * 60 * 1000;
    const base = Math.ceil((Date.parse(group.deadline) + stepMs) / stepMs) * stepMs;
    const last = Date.parse(group.deadline) + 24 * 60 * 60 * 1000;
    const maxStep = Math.max(1, Math.floor((last - base) / stepMs));
    const locale = window.kfGetLanguage?.() === 'fa' ? 'fa-IR' : 'en-GB';
    const dateFmt = new Intl.DateTimeFormat(locale, {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    const axisFmt = new Intl.DateTimeFormat(locale, {hour:'2-digit',minute:'2-digit'});
    const at = index => base + index * stepMs;
    const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
    let ranges = (Array.isArray(group.windows) ? group.windows : []).map(window => {
      const a = Date.parse(window.start), b = Date.parse(window.end);
      if (!Number.isFinite(a + b)) return null;
      const s = clamp(Math.round((a - base) / stepMs), 0, maxStep - 1);
      const e = clamp(Math.round((b - base) / stepMs), s + 1, maxStep);
      return {s,e};
    }).filter(Boolean);
    if (!ranges.length) ranges = [{s:0,e:Math.min(maxStep,4)}];

    function redrawRanges() {
      timeRows.replaceChildren();
      ranges.forEach((range,index) => {
        const row = document.createElement('div');
        row.className = 'kf-time-window';
        const top = document.createElement('div');
        top.className = 'kf-time-row-head';
        const heading = document.createElement('strong');
        heading.textContent = label('Window ','بازهٔ ') + (index + 1).toLocaleString(locale);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'kf-time-delete';
        remove.textContent = label('Remove ×','حذف ×');
        remove.onclick = () => { ranges.splice(index,1); redrawRanges(); };
        top.append(heading,remove);
        const values = document.createElement('div');
        values.className = 'kf-time-values';
        const startChip = document.createElement('span');
        startChip.className = 'kf-time-chip';
        const endChip = document.createElement('span');
        endChip.className = 'kf-time-chip';
        values.append(startChip,endChip);
        const rail = document.createElement('div');
        rail.className = 'kf-time-rail';
        const track = document.createElement('span');
        track.className = 'kf-time-track';
        const fill = document.createElement('span');
        fill.className = 'kf-time-fill';
        const startHandle = document.createElement('button');
        startHandle.type = 'button';
        startHandle.className = 'kf-time-handle';
        startHandle.dataset.edge = 'start';
        startHandle.setAttribute('aria-label', label('Start time, use arrows to adjust','زمان شروع، با فلش‌ها تغییر بده'));
        const endHandle = document.createElement('button');
        endHandle.type = 'button';
        endHandle.className = 'kf-time-handle';
        endHandle.dataset.edge = 'end';
        endHandle.setAttribute('aria-label', label('End time, use arrows to adjust','زمان پایان، با فلش‌ها تغییر بده'));
        rail.append(track,fill,startHandle,endHandle);
        const axis = document.createElement('div');
        axis.className = 'kf-time-axis';
        [0,Math.round(maxStep / 2),maxStep].forEach(tick => {
          const tickEl = document.createElement('span');
          tickEl.textContent = axisFmt.format(at(tick));
          axis.append(tickEl);
        });
        const draw = () => {
          startChip.replaceChildren();
          endChip.replaceChildren();
          const startLabel = document.createElement('small');
          startLabel.textContent = label('From','از');
          const endLabel = document.createElement('small');
          endLabel.textContent = label('To','تا');
          startChip.append(startLabel,document.createTextNode(dateFmt.format(at(range.s))));
          endChip.append(endLabel,document.createTextNode(dateFmt.format(at(range.e))));
          const pct = n => (100 * n / maxStep) + '%';
          fill.style.left = pct(range.s);
          fill.style.width = (100 * (range.e - range.s) / maxStep) + '%';
          startHandle.style.left = pct(range.s);
          endHandle.style.left = pct(range.e);
          startHandle.setAttribute('aria-valuetext', dateFmt.format(at(range.s)));
          endHandle.setAttribute('aria-valuetext', dateFmt.format(at(range.e)));
        };
        const update = (edge, value) => {
          if (edge === 'start') range.s = clamp(value,0,range.e - 1);
          else range.e = clamp(value,range.s + 1,maxStep);
          draw();
        };
        const fromX = x => {
          const rect = rail.getBoundingClientRect();
          return rect.width ? clamp(Math.round((x - rect.left) / rect.width * maxStep),0,maxStep) : 0;
        };
        [[startHandle,'start'],[endHandle,'end']].forEach(([handle,edge]) => {
          let activePointer = null;
          handle.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            activePointer = event.pointerId;
            handle.setPointerCapture(event.pointerId);
            update(edge,fromX(event.clientX));
          });
          handle.addEventListener('pointermove', event => {
            if (event.pointerId === activePointer) update(edge,fromX(event.clientX));
          });
          const stop = event => { if (event.pointerId === activePointer) activePointer = null; };
          handle.addEventListener('pointerup',stop);
          handle.addEventListener('pointercancel',stop);
          handle.addEventListener('keydown', event => {
            const delta = {ArrowLeft:-1,ArrowRight:1,PageDown:-4,PageUp:4}[event.key];
            if (delta === undefined && event.key !== 'Home' && event.key !== 'End') return;
            event.preventDefault();
            const current = edge === 'start' ? range.s : range.e;
            update(edge,event.key === 'Home' ? 0 : event.key === 'End' ? maxStep : current + delta);
          });
        });
        rail.addEventListener('pointerdown', event => {
          if (event.target === startHandle || event.target === endHandle) return;
          const pos = fromX(event.clientX);
          update(Math.abs(pos-range.s) <= Math.abs(pos-range.e) ? 'start' : 'end',pos);
        });
        row.append(top,values,rail,axis);
        timeRows.append(row);
        draw();
      });
    }
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'kf-league-add';
    add.textContent = label('＋ Add another time window','＋ افزودن بازهٔ زمانی دیگر');
    add.onclick = () => {
      if (ranges.length >= 96) return;
      const width = Math.min(maxStep,4);
      let s = 0;
      while (s + width <= maxStep && ranges.some(r => s < r.e && s + width > r.s)) s += width;
      if (s + width > maxStep) s = Math.max(0,maxStep - width);
      ranges.push({s,e:s+width});
      redrawRanges();
      timeRows.lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'});
    };
    timeCard.append(add);
    function updateAdd() { add.disabled = ranges.length >= 96; }
    const savedRedraw = redrawRanges;
    redrawRanges = () => { savedRedraw(); updateAdd(); };
    redrawRanges();

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'kf-league-save';
    save.textContent = label('Save game settings and playing times','ذخیرهٔ مشخصات بازی و ساعت‌ها');
    const status = document.createElement('p');
    status.className = 'kf-league-save-status';
    status.setAttribute('role','status');
    studio.append(save,status);
    save.onclick = async () => {
      save.disabled = true;
      status.classList.remove('ok','bad');
      try {
        const windows = ranges.map(range => ({start:new Date(at(range.s)).toISOString(),end:new Date(at(range.e)).toISOString()}));
        const result = await sb.rpc('kf_league_choices', {
          cutoff:group.deadline,
          windows,
          mode:chosenMode,
          style:{board:chosenBoard,pieces:chosenPieces,color:chosenColor}
        });
        if (result.error) throw result.error;
        status.textContent = label('Settings saved successfully.','تنظیمات با موفقیت ذخیره شد.');
        status.classList.add('ok');
        // Recalculate overlap locally after saving; no polling or extra network request.
        ownLeagueWindows = windows;
        displayedLeagueWindows = {...displayedLeagueWindows,[currentUser.id]:windows};
        drawLeagueHourRows(availability.querySelectorAll('tr[data-kf-league-player]'));
      } catch (error) {
        status.textContent = label('Could not save. Check the deadline and try again.','ذخیره نشد. مهلت ثبت را بررسی کن و دوباره تلاش کن.');
        status.classList.add('bad');
      } finally { save.disabled = false; }
    };

  }
  let sequence = 0;
  function label(en, fa) {
    return window.kfGetLanguage?.() === 'fa' ? fa : en;
  }

  function setLeagueAction(caption, level) {
    button.textContent = caption;
    const numericLevel = Number(level);
    if (!Number.isSafeInteger(numericLevel) || numericLevel < 1) return;
    const badge = document.createElement('span');
    badge.className = 'kf-league-level';
    const formatted = numericLevel.toLocaleString(window.kfGetLanguage?.() === 'fa' ? 'fa-IR' : 'en-US', { useGrouping: false });
    badge.textContent = label('Level ' + formatted, 'سطح ' + formatted);
    button.appendChild(badge);
  }
  async function showLevelPopulation(request) {
    let caption;
    try {
      const { data, error } = await sb.rpc('kf_league_level_population');
      if (error || !data || !Number.isInteger(data.total)) throw Error();
      caption = label(
        'Players at level ' + data.level + ': ' + data.total + ' (including you)',
        'بازیکنان سطح ' + data.level + ' با احتساب خودت: ' + data.total + ' نفر'
      );
    } catch {
      caption = label('Player count unavailable.', 'تعداد بازیکنان فعلاً در دسترس نیست.');
    }
    if (request !== sequence || panel.hidden) return;
    population.dir = window.kfGetLanguage?.() === 'fa' ? 'rtl' : 'ltr';
    population.textContent = caption;
    population.hidden = false;
  }
  function renderWaitingGroup(roster) {
    const header = document.createElement('div');
    header.className = 'kf-league-standings-header';
    const title = document.createElement('h3');
    title.textContent = label('Your group', 'گروه تو') + ' (' + roster.length + '/10)';
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'kf-league-refresh-hours';
    reload.textContent = label('Refresh', 'به‌روزرسانی');
    reload.onclick = () => refresh();
    header.append(title, reload);
    const table = document.createElement('table');
    table.className = 'kf-league-standings';
    table.setAttribute('aria-label', title.textContent);
    const body = table.createTBody();
    for (let index = 0; index < 10; index++) {
      const seat = roster[index];
      const row = body.insertRow();
      row.insertCell().textContent = String(index + 1);
      const name = row.insertCell();
      name.style.overflowWrap = 'anywhere';
      if (seat) {
        name.textContent = (seat.name || label('Player', 'بازیکن')) + (seat.mine ? label(' (you)', ' (تو)') : '');
        if (seat.mine) name.style.fontWeight = 'bold';
      } else {
        name.textContent = label('Open spot', 'جای خالی');
        name.style.opacity = '0.65';
      }
    }
    availability.append(header, table);
  }
  async function refresh(action = 'status') {
    stopLeagueCountdowns();
    const request = ++sequence;
    population.hidden = true;
    availability.replaceChildren();
    alerts.hidden = true;
    alertStatus.textContent = '';
    button.disabled = true;
    button.hidden = true;
    button.classList.remove('is-secondary');
    message.textContent = label('Loading league…', 'در حال دریافت وضعیت لیگ…');
    try {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      if (request !== sequence) return;
      if (!data.session?.user.email || data.session.user.is_anonymous) {
        message.textContent = label('Sign in with an email account to enter the league.', 'برای ورود به لیگ با حساب ایمیل‌دار وارد شو.');
        button.textContent = label('Sign in', 'ورود');
        button.onclick = () => openAuth('signin');
      } else {
        void showLevelPopulation(request);
        const reply = await sb.rpc('kf_league_registration', { action });
        if (request !== sequence) return;
        if (reply.error) throw reply.error;
        alerts.hidden = !navigator.userAgent.includes('KingsfallLeaguePush/1');
        alerts.textContent = label('Enable phone alerts', 'فعال‌سازی اعلان گوشی');
        if (reply.data.group_id) {
          const board = await sb.rpc('kf_league_board');
          if (request!==sequence) return;
          if (board.error || !board.data) throw Error();
          const group=board.data;
          const deadline = new Date(group.deadline);
          message.textContent = label('Registration closed. Availability deadline (local time): ', 'ثبت‌نام گروه بسته شد. مهلت ثبت ساعت آزاد به وقت محلی: ') + deadline.toLocaleString();
          if(group.finished) {
            message.textContent=label('League complete','لیگ به پایان رسید');
            button.hidden=button.disabled=false;
            const ownFinalLevel = group.standings?.find(row => row.player === currentUser?.id)?.next_level;
            setLeagueAction(label('Join next league','ثبت‌نام لیگ بعد'), ownFinalLevel);
            button.onclick=()=>refresh('join');
          } else if(!group.can_edit) {
            message.textContent=label('Registration closed. See your schedule below.','ثبت‌نام بسته شد. برنامهٔ بازی‌ها را ببین.');
          }
          renderWindows(group);
          monitorLeague();
          return;
        }
        const { joined, level, position } = reply.data;
        button.classList.toggle('is-secondary', joined);
        if (joined) {
          if (Array.isArray(reply.data.roster)) renderWaitingGroup(reply.data.roster);
          monitorLeague();
        }
        panel.dir = window.kfGetLanguage?.() === 'fa' ? 'rtl' : 'ltr';
        message.textContent = joined
          ? label('Level ' + level + ' · Your place on the waiting list: ' + position + '. The 24-hour clock has not started.', 'سطح ' + level + ' · جایگاهت در صف پیش‌ثبت‌نام: ' + position + '. هنوز مهلت ۲۴ ساعته شروع نشده.')
          : label('Pre-register for an 18-day league with ten players at your level.', 'پیش‌ثبت‌نام لیگ ۱۸ روزه با ده بازیکن هم‌سطح.');
        setLeagueAction(joined ? label('Leave waiting list', 'لغو پیش‌ثبت‌نام') : label('Pre-register', 'پیش‌ثبت‌نام'), level);
        button.onclick = () => refresh(joined ? 'leave' : 'join');
      }
    } catch (error) {
      if (request !== sequence) return;
      message.textContent = label('Could not load your league status.', 'دریافت وضعیت لیگ ممکن نشد.');
      button.textContent = label('Retry', 'تلاش دوباره');
      button.onclick = () => refresh();
    }
    button.hidden = button.disabled = false;
  }
  new MutationObserver(()=>{
    if(window.kfLeagueStyledGame && !document.body.classList.contains('game-focus')){
      window.kfLeagueStyledGame=null;
      vipApplyAppearance(vipSelectedBoard,vipSelectedPiece,vipSelectedColor);
    }
  }).observe(document.body,{attributes:true,attributeFilter:['class']});
  let wake, busy=false, tracking=null;
  async function monitorLeague() {
    clearTimeout(wake);
    if (busy || document.hidden || !currentUser || currentUser.is_anonymous) return;
    const player=currentUser.id;
    busy=true;
    let delay=60000;
    try {
      if (tracking!==player) {
        const s=await sb.rpc('kf_league_registration',{action:'status'});
        if(s.error) throw Error();
        if(!s.data.joined) {delay=0;return;}
        tracking=player;
      }
      const r=await sb.rpc('kf_league_next_game');
      if(r.error||currentUser?.id!==player) return;
      const match=r.data;
      if(!match) return;
      if(match.state==='scheduled') {
        delay=Math.min(60000,Math.max(1200,Date.parse(match.starts)-Date.now()));
      } else if(onlineGameId!==match.id) {
        await leaveOnlineState();
        showPage('home');
        currentGameIsRoulette=match.mode==='roulette';
        await loadOnlineGame(match.id,true);
      }
      if(onlineGameId===match.id && match.state==='playing' && window.kfLeagueStyledGame!==match.id) {
        const style=match.style;
        vipApplyAppearance(style.board||'default',style.pieces||'classic',style.color||'standard');
        window.kfLeagueStyledGame=match.id;
      }
    } finally {
      busy=false;
      if(delay && !document.hidden) wake=setTimeout(monitorLeague,delay);
    }
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) monitorLeague();});
  sb?.auth.onAuthStateChange((e)=>{if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT'].includes(e)) {
    setTimeout(monitorLeague,1000);
  }});
  setTimeout(monitorLeague,2000);
  if (!panel.hidden) refresh();
  new MutationObserver(() => {
    if (!panel.hidden) refresh();
    else { sequence++; stopLeagueCountdowns(); }
  }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  sb?.auth.onAuthStateChange((event) => {
    if (!panel.hidden && ['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) setTimeout(() => refresh(), 0);
  });
})();
