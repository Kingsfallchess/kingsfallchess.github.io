"use strict";
/* ===== THEME ===== */
(function initTheme(){
  var saved = null;
  try { saved = localStorage.getItem("kf_theme"); } catch(e){}
  if(saved === "ocean") document.body.classList.add("theme-ocean");
})();
var _themeRotation = 45;
$("themeToggle").onclick = function(){
  document.body.classList.toggle("theme-ocean");
  var isOcean = document.body.classList.contains("theme-ocean");
  try { localStorage.setItem("kf_theme", isOcean ? "ocean" : "burgundy"); } catch(e){}
  _themeRotation += 360;
  this.style.setProperty("--crown-rotation", _themeRotation + "deg");
};

/* ===== NAV / PAGES ===== */
function showPage(name){
  document.querySelectorAll(".page").forEach(function(p){ p.classList.remove("active"); });
  document.querySelectorAll(".nav-tab").forEach(function(t){ t.classList.remove("active"); });
  var pageEl = $("page" + name.charAt(0).toUpperCase() + name.slice(1));
  if(pageEl) pageEl.classList.add("active");
  var tabEl = $("nav" + name.charAt(0).toUpperCase() + name.slice(1));
  if(tabEl) tabEl.classList.add("active");
  var navTabsEl = document.querySelector(".nav-tabs");
  if(navTabsEl) navTabsEl.classList.toggle("table-active", name === "table");
  if(navTabsEl) navTabsEl.classList.toggle("honors-active", name === "honors");
  if(navTabsEl) navTabsEl.classList.toggle("admin-active", name === "admin");
  if(name === "table") loadLeaderboard();
  if(name === "honors") loadHonors();
  if(name === "admin") loadAdminPanel();
}
$("navHome").onclick = function(){ showPage("home"); };
$("navTable").onclick = function(){ showPage("table"); };

/* ===== Mobile swipe nav ===== */
(function initSwipeNav(){
  var startX = 0, startY = 0, startTime = 0;
  var SWIPE_MIN = 70;
  var SWIPE_MAX_TIME = 700;
  document.addEventListener("touchstart", function(e){
    if(document.body.classList.contains("game-focus")) return;
    if(document.querySelector("dialog[open]")) return;
    if(e.target && e.target.closest && e.target.closest("#board")) return;
    if(e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, {passive:true});
  document.addEventListener("touchend", function(e){
    if(document.body.classList.contains("game-focus")) return;
    if(document.querySelector("dialog[open]")) return;
    if(e.target && e.target.closest && e.target.closest("#board")) return;
    if(!e.changedTouches || e.changedTouches.length !== 1) return;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    var dt = Date.now() - startTime;
    if(dt > SWIPE_MAX_TIME) return;
    if(Math.abs(dx) < SWIPE_MIN) return;
    if(Math.abs(dx) < Math.abs(dy) * 1.5) return;
    var current = document.querySelector(".page.active");
    if(!current) return;
    // Ordered mobile navigation: Home → Table → Honors → Admin
    if(dx < 0 && current.id === "pageHome") showPage("table");
    else if(dx < 0 && current.id === "pageTable") showPage("honors");
    else if(dx < 0 && current.id === "pageHonors" && currentUser && currentUser.id === adminOwnerId) showPage("admin");
    else if(dx > 0 && current.id === "pageAdmin" && currentUser && currentUser.id === adminOwnerId) showPage("honors");
    else if(dx > 0 && current.id === "pageHonors") showPage("table");
    else if(dx > 0 && current.id === "pageTable") showPage("home");
  }, {passive:true});
})();
  /* ===== GLOBAL STATE ===== */
var boardEl = $("board");
var historyEl = $("history");
var game = null;
var selected = null;
var targets = [];
var flipped = false;
var last = null;
var mode = "signin";
var currentUser = null;
var onlineGameId = null;
var onlineGame = null;
var queuePoll = null;
var queueTimeout = null;
var kfQueueSearching = false;
var gameChannel = null;
var onlineGamePolling = null;
// Fallback database polling is enabled only when both live game feeds are down.
var kfGamePollingEnabled = false;
var kfGamePostgresConnected = false;
var kfGameBroadcastConnected = false;
var kfGamePollBusy = false;
// Authenticated, per-game Broadcast for fast move delivery. PostgreSQL
// Changes remains the fallback for dropped/reconnecting Broadcast channels.
var kfGameBroadcastChannel=null;
var kfGameBroadcastId=null;
function kfStopGameBroadcast(){
  var previous=kfGameBroadcastChannel;
  kfGameBroadcastChannel=null;
  kfGameBroadcastId=null;
  kfGameBroadcastConnected=false;
  kfRefreshGamePolling();
  if(previous&&sb)sb.removeChannel(previous);
}
function kfReceivePostgresGameRow(row){
  if(!row)return;
  // Ignore only an exact snapshot already received from Broadcast.
  if(kfGameBroadcastChannel&&onlineGame&&row.id===onlineGame.id
      &&row.updated_at===onlineGame.updated_at
      &&row.last_move_at===onlineGame.last_move_at)return;
  applyOnlineGame(row);
}
function kfStartGameBroadcast(gameId,row){
  // The game-entry paths already closed the previous channel. Avoid a
  // redundant stop/polling refresh when there is nothing left to remove.
  if(kfGameBroadcastChannel) kfStopGameBroadcast();
  if(!sb||!gameId||!row||!currentUser||
     (row.white_id!==currentUser.id&&row.black_id!==currentUser.id))return;
  kfGameBroadcastId=gameId;
  var channel=sb.channel("kf-game-broadcast:"+gameId,{config:{private:true}})
    .on("broadcast",{event:"kf_move_commit"},function(message){
      if(kfGameBroadcastId!==gameId||onlineGameId!==gameId)return;
      var payload=message&&message.payload;
      var row=payload&&payload.row;
      if(!row||row.id!==gameId||row.last_move_at!==payload.move_at)return;
      if(onlineGame&&row.updated_at===onlineGame.updated_at
         &&row.last_move_at===onlineGame.last_move_at)return;
      applyOnlineGame(row);
    });
  kfGameBroadcastChannel=channel;
  sb.auth.getSession().then(function(result){
    if(kfGameBroadcastChannel!==channel||kfGameBroadcastId!==gameId)return;
    var token=result&&result.data&&result.data.session&&result.data.session.access_token;
    if(!token){console.warn("Game Broadcast unavailable: no signed-in session");return;}
    sb.realtime.setAuth(token);
    channel.subscribe(function(status){
      if(kfGameBroadcastChannel!==channel||onlineGameId!==gameId)return;
      kfGameBroadcastConnected=(status==="SUBSCRIBED");
      kfRefreshGamePolling();
      if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED")
        console.warn("Game Broadcast unavailable; PostgreSQL fallback remains active:",status);
    });
  }).catch(function(error){
    console.warn("Game Broadcast subscription failed; PostgreSQL fallback active:",error);
  });
}

var submittingMove = false;
// Invalidates game-state fetches that began before a local move submission.
var gameSyncGeneration = 0;
var reconnectReloadPending = false;
var clockWhite = 300;
var clockBlack = 300;
var lastClockAt = null;
// Monotonic local anchor for smooth display; avoids wall-clock/device-time jumps.
var clockPerfAnchor = null;
var firstMoveDeadlineAnchor = null;
var firstMoveDeadlinePerfAnchor = null;
var clockPerfBaseWhite = 300;
var clockPerfBaseBlack = 300;
var clockPerfTurn = "w";
// Clock V2: monotonic rendering calibrated against the server.
var kfServerOffsetMs=0, kfServerOffsetKnown=false, kfClockSyncBusy=false;
var kfClockSyncTimer=null, kfPendingClockMove=false, kfClockBeforeMove=null;
// A visual-only phase correction for the running clock. The server's remaining
// time is never modified, and timeout decisions use the unsmoothed time.
var kfRunningClockBlend=null;
function kfAuthoritativeRunningClock(now){
  if(!onlineGame || clockPerfAnchor==null)return null;
  var turn=onlineGame.turn||clockPerfTurn||"w";
  var base=turn==="w"?clockPerfBaseWhite:clockPerfBaseBlack;
  return {turn:turn,time:Math.max(0,base-Math.max(0,(now-clockPerfAnchor)/1000))};
}
function kfVisualRunningClock(now,official){
  if(!kfRunningClockBlend||!official||kfRunningClockBlend.turn!==official.turn)return official?official.time:0;
  var b=kfRunningClockBlend;
  var remaining=Math.max(0,1-(now-b.started)/b.duration);
  if(remaining<=0){kfRunningClockBlend=null;return official.time;}
  return Math.max(0,official.time+b.delta*remaining);
}
function kfBlendClockAfterRebase(previousTurn,previousVisible){
  var now=performance.now();
  var official=kfAuthoritativeRunningClock(now);
  if(!official){kfRunningClockBlend=null;return;}
  if(previousTurn!==official.turn||!Number.isFinite(previousVisible)){
    kfRunningClockBlend=null;return;
  }
  var delta=previousVisible-official.time;
  if(Math.abs(delta)<0.035){kfRunningClockBlend=null;return;}
  delta=Math.max(-1.5,Math.min(1.5,delta));
  kfRunningClockBlend={turn:official.turn,delta:delta,started:now,
    duration:Math.max(2400,Math.abs(delta)*5500)};
}
function kfCalibrateServerTime(iso,start,end){
  var t=Date.parse(iso),rtt=end-start;
  if(!Number.isFinite(t)||rtt<0||rtt>1800)return false;
  var sample=t-(start+end)/2;
  kfServerOffsetMs=kfServerOffsetKnown?0.3*kfServerOffsetMs+0.7*sample:sample;
  kfServerOffsetKnown=true;
  return true;
}
async function kfSyncClock(gid){
  if(document.hidden||!navigator.onLine||!sb||!gid||gid!==onlineGameId||kfClockSyncBusy||submittingMove||kfPendingClockMove)return;
  kfClockSyncBusy=true;var start=Date.now();
  try{
    var res=await sb.rpc("kf_clock_sync",{p_game_id:gid}),end=Date.now();
    if(gid!==onlineGameId||submittingMove||kfPendingClockMove||res.error||!res.data)return;
    if(kfCalibrateServerTime(res.data.server_now,start,end)&&onlineGame){
      var beforeTurn=onlineGame.turn||clockPerfTurn;
      var beforeShown=beforeTurn==="w"?clockWhite:clockBlack;
      anchorClockToServerTime(onlineGame.last_move_at||onlineGame.clock_started_at);
      kfBlendClockAfterRebase(beforeTurn,beforeShown);
    }
  }catch(e){console.debug("[Kingsfall clock] sync failed",e);}
  finally{kfClockSyncBusy=false;}
}
function kfStartClockSync(gid){
  if(kfClockSyncTimer)clearInterval(kfClockSyncTimer);
  kfClockSyncTimer=null;
  if(!gid||document.hidden)return;
  setTimeout(function(){if(gid===onlineGameId&&!document.hidden)kfSyncClock(gid);},0);
  kfClockSyncTimer=setInterval(function(){
    if(gid===onlineGameId&&!document.hidden)kfSyncClock(gid);
  },30000);
}
var clockExpired = false;
var clockClaimPending = false;
var clockStartPending = false;
var clockReadySent = false;
var computerMode = false;
var computerBusy = false;
var computerRating = 1400;
var computerUserColor = "w";
var computerTimer = null;
var names = {k:"King", q:"Queen", r:"Rook", b:"Bishop", n:"Knight", p:"Pawn"};
var files = "abcdefgh";

/* Board optimization */
var _boardBuilt = false;
var _boardFlipped = false;
var _sqEls = {};

/* Tournament */
var tournCurrent = null;
var tournChannel = null;
var tournTickTimer = null;
var tournMyEntry = null;
var kfTournMatchNoticeChannel = null;
var kfTournMatchNoticeUserId = null;
var kfTournMatchRecoveryPromise = null;
var tournActiveMatch = null;
var startingTournMatchId = null;
var tournStartBlockedMatchId = null;
var tournBracketRendered = null;
var tournPlayersLoadState = "loading";
var tournStateRequestId = 0;
var tournBracketRequestId = 0;
var tournEntryRequestId = 0;
var tournLast = null;
var tournLastBracketRendered = null;
var tournView = "next";

/* History */
var historyData = [];
var pendingAnalysisGame = null;

/* Fullscreen */
var fsPlayerColor = "w";

/* Humiliation */
var humilChosenType = null;
var humilApplied = false;
var humilSelecting = false;

/* Rematch */
var rematchRequestTimer = null;
var rematchDialogShown = false;
var _rematchAccepting = false;
var _celebOnDone = null;

/* Celebration */
var celebTimer = null;
var celebInterval = null;

/* Roulette */
var pendingQueueIsRoulette = false;
var pendingQueueIsBloodblade = false;
var currentGameIsRoulette = false;
var rouletteOpeningAnimating = false;
// Retain the latest authoritative Realtime row without interrupting Roulette animations.
var kfRouletteDeferredGameRow = null;
var rouletteServerClockOffsetMs = 0;
function defaultAvatar(){
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#172337"/><circle cx="50" cy="36" r="19" fill="#9AA9BE"/><path d="M16 92c3-23 16-34 34-34s31 11 34 34" fill="#9AA9BE"/></svg>';
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

/* ===== helpers ===== */
function isValidHcp(v){ return v === "n" || v === "b" || v === "r" || v === "q"; }
// Display-only player stat formatter: calculations and stored values remain exact.
function fmtStat(value){
  var n=Number(value);
  if(!Number.isFinite(n)) return "—";
  var abs=Math.abs(n), sign=n<0?"-":"";
  if(abs<1000) return String(n);
  var scale=abs>=1000000?1000000:1000, suffix=scale===1000000?"M":"K";
  var tenths=Math.floor(abs/scale*10+1e-9);
  return sign+Math.floor(tenths/10)+suffix+(tenths%10?"."+(tenths%10):"");
}
function fmtClock(sec){
  sec = Math.max(0, Math.floor(sec));
  return String(Math.floor(sec/60)).padStart(2,"0") + ":" + String(sec%60).padStart(2,"0");
}
// Display-only: show MM:SS at 20 seconds or more, then MM:SS.tenths.
// The authoritative clock and its update cadence are unchanged.
function fmtClockTenths(sec){
  var seconds = Math.max(0,Number(sec)||0);
  if(seconds >= 20) return fmtClock(seconds);
  var tenths = Math.floor(seconds*10+1e-7);
  return "00:"+String(Math.floor(tenths/10)).padStart(2,"0")+"."+(tenths%10);
}
function fmtCountdown(ms){
  if(ms < 0) ms = 0;
  var s = Math.floor(ms/1000);
  var d = Math.floor(s/86400);
  var h = Math.floor((s%86400)/3600);
  var m = Math.floor((s%3600)/60);
  var sec = s%60;
  if(d > 0) return d + "d " + String(h).padStart(2,"0") + ":" + String(m).padStart(2,"0");
  return String(h).padStart(2,"0") + ":" + String(m).padStart(2,"0") + ":" + String(sec).padStart(2,"0");
}
function fmtTimeLocal(iso){
  try{
    var d = new Date(iso);
    return d.toLocaleString(undefined,{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"short"});
  } catch(e){ return iso; }
}
function sq(r,c){ return files[c] + (8-r); }
  /* ===== SVG pieces (with cache) ===== */
var _svgCache = {};
/* Original, lightweight outlined chess silhouettes for the VIP Heritage collection. */
function vipHeritageSvg(p,colorOverride){
  var white=p.color==="w";
  var pair=vipColors(colorOverride,white);
  var fill=pair[0],outline=pair[1],detail=pair[1];
  var outer='fill="'+fill+'" stroke="'+outline+'" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"';
  var line='fill="none" stroke="'+outline+'" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"';
  var accent='fill="none" stroke="'+detail+'" stroke-width="3.2" stroke-linecap="round"';
  var body="", extras="";
  switch(p.type){
    case "p":
      body='<circle cx="50" cy="24" r="12" '+outer+'/><path d="M42 35 Q28 47 32 62 Q23 68 22 85 L78 85 Q77 68 68 62 Q72 47 58 35 Z" '+outer+'/>';
      break;
    case "r":
      body='<path d="M16 20 V12 H31 V20 H42 V12 H58 V20 H69 V12 H84 V28 H78 V34 H22 V28 H16 Z" '+outer+'/><path d="M27 35 H73 L68 72 H32 Z" '+outer+'/><path d="M25 72 H75 L80 82 H20 Z" '+outer+'/><path d="M16 84 H84 V91 H16 Z" '+outer+'/>';
      extras='<path d="M27 40 H73 M30 66 H70 M23 79 H77" '+accent+'/>';
      break;
    case "n":
      body='<path d="M26 85 L30 65 Q23 56 22 47 Q16 44 18 36 L28 19 L41 12 Q63 11 73 27 Q82 43 81 85 Z" '+outer+'/><path d="M29 19 Q48 22 53 40 Q60 52 61 85" '+line+'/>';
      extras='<ellipse cx="33" cy="38" rx="4" ry="5" fill="'+detail+'"/><path d="M21 46 Q27 52 36 47" '+accent+'/>';
      break;
    case "b":
      body='<path d="M50 8 C62 8 65 22 57 29 Q71 41 65 53 L75 66 H25 L35 53 Q29 41 43 29 C35 22 38 8 50 8 Z" '+outer+'/><path d="M27 71 H73 L79 81 H21 Z" '+outer+'/><path d="M16 86 Q50 73 84 86 L88 91 H12 Z" '+outer+'/>';
      extras='<path d="M43 26 L57 44 M35 63 H65 M25 78 H75" '+accent+'/><path d="M50 35 V45 M45 40 H55" '+accent+'/>';
      break;
    case "q":
      body='<circle cx="13" cy="22" r="5" '+outer+'/><circle cx="31" cy="14" r="5" '+outer+'/><circle cx="50" cy="12" r="5" '+outer+'/><circle cx="69" cy="14" r="5" '+outer+'/><circle cx="87" cy="22" r="5" '+outer+'/><path d="M13 28 L27 61 L31 29 L43 61 L50 24 L57 61 L69 29 L73 61 L87 28 L76 73 H24 Z" '+outer+'/><path d="M25 74 H75 L80 83 Q50 92 20 83 Z" '+outer+'/><path d="M19 88 Q50 81 81 88 L83 93 H17 Z" '+outer+'/>';
      extras='<path d="M25 76 Q50 83 75 76 M23 85 Q50 92 77 85" '+accent+'/>';
      break;
    case "k":
      body='<path d="M50 7 V29 M40 17 H60" '+line+'/><path d="M36 31 Q28 24 20 32 Q11 40 21 51 Q27 59 37 63 H63 Q73 59 79 51 Q89 40 80 32 Q72 24 64 31 Q58 24 50 26 Q42 24 36 31 Z" '+outer+'/><path d="M33 59 H67 L76 79 H24 Z" '+outer+'/><path d="M20 83 Q50 75 80 83 L84 91 H16 Z" '+outer+'/>';
      extras='<path d="M27 38 Q37 35 50 53 Q63 35 73 38 M28 78 H72 M22 86 Q50 80 78 86" '+accent+'/>';
      break;
  }
  var label=(white?"White ":"Black ")+names[p.type];
  return '<svg class="piece" viewBox="0 0 100 100" role="img" aria-label="'+label+'" xmlns="http://www.w3.org/2000/svg"><g>'+body+extras+'</g></svg>';
}
/* Exact vector silhouettes extracted from the user's six-piece SVG artwork. */
var vipSilhouettePaths={
"k":"M11542 6488 c-8 -8 -12 -50 -12 -125 l0 -113 -114 0 c-84 0 -116 -4 -125 -14 -8 -9 -11 -70 -9 -197 l3 -184 123 -3 122 -3 0 -99 0 -100 -395 0 c-254 0 -395 -4 -395 -10 0 -5 59 -216 131 -467 72 -252 158 -555 191 -673 34 -118 65 -221 71 -227 5 -7 26 -13 47 -13 l38 0 -5 -63 c-4 -48 -1 -71 12 -96 9 -18 15 -34 13 -35 -2 -1 -18 -8 -36 -16 -53 -21 -89 -71 -97 -134 -9 -72 -2 -98 40 -145 l35 -38 -56 -6 c-202 -21 -239 -283 -52 -362 22 -8 67 -15 107 -15 64 0 72 -2 87 -25 70 -106 78 -431 23 -865 -53 -424 -160 -866 -240 -995 l-32 -50 7 -167 7 -167 -38 -16 c-53 -22 -90 -60 -110 -114 -9 -25 -30 -70 -45 -100 -49 -94 -34 -194 42 -273 l46 -48 -72 0 c-49 0 -75 -4 -83 -14 -8 -10 -9 -80 -4 -262 l8 -249 995 0 995 0 -2 254 c-2 191 -6 257 -15 263 -7 4 -42 8 -78 8 l-65 0 33 21 c67 43 100 171 67 259 -9 25 -20 65 -24 90 -9 53 -30 96 -63 127 -26 25 -88 53 -116 53 -17 0 -20 11 -26 92 -3 50 -6 126 -6 169 0 74 -1 78 -33 110 -63 63 -133 274 -177 533 -93 545 -87 1143 13 1321 l23 40 94 5 c104 6 142 20 183 70 50 59 56 149 15 218 -25 41 -92 80 -153 88 -46 7 -47 7 -26 23 44 34 61 72 61 142 0 52 -5 73 -22 99 -21 30 -68 62 -110 74 -16 5 -16 8 -2 42 10 24 14 59 12 96 -3 57 -3 58 24 58 16 0 31 7 36 18 9 17 392 1350 392 1365 0 4 -173 7 -385 7 l-385 0 0 100 0 100 108 0 c71 0 112 4 120 12 17 17 17 359 0 376 -8 8 -49 12 -120 12 l-108 0 0 113 c0 75 -4 117 -12 125 -9 9 -76 12 -238 12 -162 0 -229 -3 -238 -12z",
"q":"M9428 5926 c-55 -20 -85 -42 -117 -87 -32 -44 -55 -126 -45 -165 l6 -24 -402 0 -402 0 6 -32 c18 -94 385 -1353 395 -1354 6 -1 30 -2 52 -3 36 -1 40 -3 28 -17 -18 -22 -17 -103 4 -143 21 -42 21 -41 -3 -41 -34 0 -79 -28 -95 -60 -9 -17 -18 -59 -22 -93 -6 -71 10 -116 54 -153 l25 -21 -57 -6 c-105 -11 -175 -84 -175 -181 0 -56 14 -93 48 -129 44 -46 81 -61 171 -67 81 -5 86 -6 102 -35 97 -168 46 -908 -101 -1495 -48 -192 -110 -356 -140 -375 -7 -4 -10 -70 -10 -187 l2 -180 -39 -18 c-46 -21 -99 -81 -109 -124 -4 -17 -18 -48 -32 -69 -20 -29 -27 -56 -30 -104 -5 -81 15 -138 70 -192 l40 -41 -68 0 c-38 0 -75 -4 -83 -9 -12 -7 -13 -50 -7 -257 4 -137 11 -252 15 -257 4 -4 452 -6 997 -5 l989 3 -4 250 c-2 147 -7 255 -13 263 -6 7 -34 12 -70 12 l-60 0 31 30 c43 44 74 133 67 193 -3 27 -12 62 -21 79 -8 17 -15 45 -15 61 0 45 -37 114 -77 144 -19 15 -55 32 -81 38 l-47 12 -3 163 -3 164 -39 43 c-21 24 -45 63 -53 86 -9 23 -27 75 -41 115 -73 203 -130 601 -143 982 -9 310 19 554 78 661 l24 44 95 5 c99 6 137 19 177 62 30 32 43 71 43 132 0 94 -70 168 -175 182 l-46 7 31 32 c38 39 52 86 44 150 -12 90 -57 145 -120 145 l-33 0 19 43 c24 51 25 77 6 122 -15 35 -15 35 12 37 45 2 50 3 57 9 10 11 394 1363 389 1371 -3 4 -180 8 -393 8 l-388 0 -1 54 c-1 161 -164 275 -314 222z",
"b":"M7010 5299 c-99 -19 -195 -85 -253 -171 -54 -83 -70 -145 -65 -252 4 -96 23 -154 74 -227 l24 -35 -41 -45 c-173 -186 -262 -452 -262 -784 0 -229 35 -399 122 -590 29 -63 31 -71 15 -80 -43 -26 -68 -51 -80 -81 -18 -43 -18 -147 0 -183 14 -27 14 -28 -19 -40 -18 -6 -47 -27 -63 -45 -62 -71 -48 -225 24 -273 l28 -18 -62 -6 c-106 -10 -168 -70 -180 -175 -6 -59 13 -108 59 -147 48 -42 97 -57 182 -57 62 0 67 -2 88 -31 27 -38 49 -110 49 -161 0 -106 -85 -256 -220 -389 l-87 -85 5 -170 5 -171 -47 -22 c-52 -26 -87 -67 -107 -126 -8 -22 -22 -51 -31 -65 -10 -14 -23 -51 -30 -82 -17 -79 7 -156 67 -216 l42 -42 -73 0 c-43 0 -76 -5 -80 -11 -8 -13 -5 -484 3 -505 4 -12 145 -14 997 -12 l991 3 0 253 c0 214 -2 254 -15 262 -8 5 -43 10 -78 10 l-63 0 37 32 c21 18 45 51 55 73 22 48 24 134 4 190 -8 22 -15 47 -15 55 -1 90 -102 200 -183 200 l-24 0 -6 172 -6 172 -28 20 c-54 39 -153 139 -182 185 -87 136 -79 331 17 434 23 25 32 27 98 27 120 0 188 35 225 115 23 49 24 94 4 143 -31 73 -102 122 -176 122 l-41 0 31 29 c40 38 51 69 51 147 0 95 -38 153 -111 169 -24 5 -29 10 -23 23 5 10 10 58 12 108 l3 91 -33 35 c-18 19 -39 37 -46 39 -9 3 -2 27 23 87 37 88 65 191 85 307 16 99 14 352 -4 455 -9 47 -16 91 -16 98 0 6 -3 12 -7 12 -5 0 -82 -83 -172 -185 -91 -102 -167 -185 -170 -185 -10 0 -121 101 -121 110 0 5 90 110 200 234 l201 225 -32 63 c-37 73 -92 156 -141 212 l-35 40 35 45 c65 86 76 123 77 251 0 109 -2 118 -32 181 -87 177 -282 275 -473 238z",
"n":"M2218 3774 c-40 -21 -90 -92 -152 -213 -61 -120 -88 -207 -111 -356 -19 -128 -19 -221 1 -276 16 -47 18 -56 143 -584 131 -554 169 -811 178 -1200 l6 -240 -68 -19 c-80 -23 -116 -50 -145 -112 -27 -56 -31 -184 -7 -230 16 -31 60 -74 92 -92 16 -9 9 -11 -41 -12 -94 0 -94 0 -94 -222 0 -166 2 -187 18 -201 17 -16 90 -17 840 -17 809 0 822 0 842 20 19 19 20 33 20 200 0 217 -1 220 -101 220 l-62 0 29 23 c70 54 94 102 94 187 0 70 -18 118 -62 166 -34 36 -54 48 -115 67 -64 19 -73 25 -69 42 3 11 8 50 12 87 l7 66 42 17 c135 51 213 243 185 454 -13 104 -56 231 -101 307 -40 66 -83 117 -284 336 -291 316 -290 314 -287 363 4 92 68 212 136 255 51 31 94 34 224 16 62 -9 146 -16 187 -16 64 0 77 3 104 26 20 17 36 44 47 79 14 48 14 57 0 83 -9 17 -31 40 -51 52 -19 12 -35 28 -35 36 0 16 38 45 100 76 62 32 70 62 35 134 -17 35 -44 69 -75 93 -45 36 -56 39 -182 59 -73 11 -209 31 -303 43 -144 19 -175 26 -203 47 -31 23 -41 25 -160 26 -156 1 -258 28 -292 76 -12 16 -34 31 -53 35 -47 11 -87 33 -134 76 -36 33 -49 39 -85 39 -24 -1 -55 -7 -70 -16z",
"r":"M4256 3684 c-14 -14 -16 -62 -14 -412 l3 -397 31 -16 32 -15 -19 -25 c-32 -40 -52 -126 -47 -194 9 -103 59 -174 150 -215 l47 -21 -19 -32 c-36 -59 -19 -176 31 -211 18 -12 18 -19 -11 -207 -70 -450 -146 -745 -248 -961 -21 -46 -42 -95 -45 -110 -4 -14 -24 -37 -47 -52 -45 -30 -59 -65 -38 -99 8 -12 18 -45 21 -74 6 -56 27 -105 60 -140 l20 -23 -56 0 c-87 0 -86 3 -86 -237 0 -114 5 -215 10 -225 9 -17 47 -18 812 -18 611 0 806 3 815 12 17 17 17 439 0 456 -7 7 -30 12 -51 12 l-39 0 25 30 c42 49 60 112 55 183 -6 71 -23 111 -68 156 l-32 31 26 0 c14 0 26 1 26 3 0 2 -30 48 -67 103 -78 117 -104 173 -166 354 -91 267 -157 576 -157 735 0 50 3 62 21 73 45 28 65 148 34 202 -21 36 -19 38 28 52 65 19 141 100 157 167 19 82 9 172 -28 231 l-30 48 35 5 c66 11 63 -10 63 423 l0 393 -22 15 c-20 14 -94 16 -610 16 -522 0 -588 -2 -602 -16z",
"p":"M815 2830 c-203 -43 -349 -190 -392 -393 -32 -154 12 -308 125 -429 l44 -47 -40 -10 c-95 -26 -162 -107 -187 -227 -18 -84 -19 -196 -3 -212 8 -8 47 -12 110 -12 l98 0 -5 -27 c-2 -16 -7 -58 -10 -94 -14 -164 -103 -343 -246 -493 -62 -66 -76 -76 -106 -76 -73 0 -150 -52 -184 -125 -36 -78 -19 -165 45 -230 24 -24 57 -46 75 -50 36 -8 42 -25 8 -25 -43 0 -47 -14 -47 -186 0 -134 3 -165 16 -178 14 -14 96 -16 759 -16 663 0 745 2 759 16 13 13 16 44 16 178 0 168 -4 186 -43 186 -10 0 -17 3 -15 8 30 58 42 99 46 162 6 106 -8 150 -66 202 -139 126 -221 224 -276 335 -55 110 -68 165 -70 296 l-2 117 117 0 c92 0 119 3 129 15 19 23 6 197 -19 266 -36 96 -104 157 -193 174 l-36 7 43 45 c211 220 165 586 -94 753 -97 61 -254 93 -356 70z m65 -43 c0 -1 -48 -50 -107 -107 l-108 -105 105 108 c97 99 110 112 110 104z"
};
var vipSilhouetteBounds={"p":[0,165],"n":[190,380],"r":[400,569],"b":[607,809],"q":[846,1054],"k":[1074,1280]};
function vipSilhouetteSvg(piece,colorOverride){
  var white=piece.color==="w",range=vipSilhouetteBounds[piece.type];
  var pair=vipColors(colorOverride,white);
  var color=pair[0],border=pair[1];
  var label=(white?"White ":"Black ")+names[piece.type];
  return '<svg class="piece" viewBox="'+range[0]+' 0 '+(range[1]-range[0])+' 650" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+label+'" xmlns="http://www.w3.org/2000/svg">'
    +'<g transform="translate(0 650) scale(0.1 -0.1)" fill="'+color+'" stroke="'+border+'" stroke-width="32" stroke-linejoin="round" paint-order="stroke fill">'
    +'<path d="'+vipSilhouettePaths[piece.type]+'"/></g></svg>';
}
/* The uploaded artwork provides filled black and outlined white silhouettes. */
function vipDualClassicSvg(p,colorOverride){
  var white=p.color==="w",pair=vipColors(colorOverride,white);
  var label=(white?"White ":"Black ")+names[p.type];
  var symbol="vip-dual-"+p.color+p.type;
  var sprite="assets/vip-dual-piece-set.svg#"+symbol;
  return '<svg class="piece" viewBox="0 0 100 100" role="img" aria-label="'+label+'" style="color:'+pair[0]+'" xmlns="http://www.w3.org/2000/svg">'
    +'<g transform="translate(50 50) scale(1.10) translate(-50 -50)"><use href="'+sprite+'" xlink:href="'+sprite+'" x="0" y="0" width="100" height="100" xmlns:xlink="http://www.w3.org/1999/xlink"></use></g></svg>';
}
function vipRoseVectorSvg(p,colorOverride){
  var white=p.color==="w",pair=vipColors(colorOverride,white);
  var label=(white?"White ":"Black ")+names[p.type];
  var roseArtType=p.type==="b"?"p":p.type==="p"?"b":p.type;
  var sprite="assets/vip-rose-pieces.svg#vip-rose-"+roseArtType;
  // Keep each Rose piece centered while enlarging its drawing only.
  var tune={k:[-8,1,1.309],q:[1,1,1.309],r:[-14,1,1.309],b:[10,1,1.309],n:[-12,1,1.32],p:[14,1,1.309]}[p.type]||[0,1,1.309];
  return '<svg class="piece" viewBox="0 0 100 100" role="img" aria-label="'+label+'" style="color:'+pair[0]+';filter:drop-shadow(0 1px 1px '+pair[1]+')" xmlns="http://www.w3.org/2000/svg">'
    +'<g transform="translate('+(50+tune[0])+' '+(50+tune[1])+') scale('+tune[2]+') translate(-50 -50)">'
    +'<use href="'+sprite+'" xlink:href="'+sprite+'" x="0" y="0" width="100" height="100" xmlns:xlink="http://www.w3.org/1999/xlink"></use></g></svg>';
}
/* Original vector recreation based on the user's illustrated chess set. */
var vipStorybookShapes={"r":"<path d=\"M22 31 L19 17 Q19 12 25 12 L34 12 L36 23 L43 23 L44 11 L57 11 L59 23 L66 23 L68 13 L77 13 Q82 13 81 20 L79 33 Q78 40 71 41 L29 41 Q23 41 22 31 Z\"/><path d=\"M30 41 L70 41 L74 79 L26 79 Z\"/><path d=\"M20 78 Q17 78 16 86 L16 93 L84 93 L84 86 Q83 78 78 78 Z\"/>","n":"<path d=\"M72 78 Q78 64 77 44 Q75 24 60 18 Q49 12 43 8 L38 18 Q34 25 25 34 L14 47 Q10 55 16 60 Q24 66 37 57 L52 47 Q52 57 40 66 L33 78 Z\"/><path d=\"M24 78 L77 78 Q83 78 84 86 L84 93 L17 93 L17 86 Q18 78 24 78 Z\"/><path d=\"M38 31 Q42 27 47 31 L47 35 L37 35 Z\" class=\"eye\"/>","b":"<path d=\"M50 7 Q41 9 41 19 Q43 25 46 26 Q25 43 26 63 Q27 73 35 78 L67 78 Q75 70 75 58 Q75 42 62 24 L56 48 L47 48 L48 25 Q59 16 57 12 Q55 7 50 7 Z\"/><path d=\"M31 78 L69 78 Q77 78 79 85 L79 93 L21 93 L21 85 Q23 78 31 78 Z\"/>","q":"<path d=\"M18 19 A8 8 0 1 1 29 26 L38 43 L38 19 A8 8 0 1 1 49 17 L50 37 L60 17 A8 8 0 1 1 70 22 L68 43 L80 27 A8 8 0 1 1 89 34 L75 79 L25 79 L10 33 Q5 28 9 23 Q12 20 18 19 Z\"/><path d=\"M25 78 L75 78 Q82 78 83 86 L83 93 L17 93 L17 86 Q18 78 25 78 Z\"/>","k":"<path fill-rule=\"evenodd\" d=\"M44 7 L56 7 L56 16 L65 16 L65 27 L56 27 L56 33 Q76 27 85 38 Q94 50 83 63 L70 79 L30 79 L17 63 Q6 49 16 38 Q25 27 44 33 L44 27 L35 27 L35 16 L44 16 Z M29 46 Q24 52 34 63 L42 65 L42 47 Q35 43 29 46 Z M71 46 Q65 43 58 47 L58 65 L66 63 Q76 52 71 46 Z\"/><path d=\"M27 78 L73 78 Q81 78 82 86 L82 93 L18 93 L18 86 Q19 78 27 78 Z\"/>","p":"<circle cx=\"50\" cy=\"20\" r=\"13\"/><path d=\"M38 32 Q33 37 34 42 L41 44 Q40 52 32 60 Q19 67 20 80 L80 80 Q81 67 68 60 Q60 52 59 44 L66 42 Q67 37 62 32 Z\"/><path d=\"M26 79 L74 79 Q82 79 83 87 L83 93 L17 93 L17 87 Q18 79 26 79 Z\"/>"};
function vipStorybookSvg(p,colorOverride){
  var white=p.color==="w",pair=vipColors(colorOverride,white);
  var edge=white?"#252525":pair[1],fill=pair[0];
  var label=(white?"White ":"Black ")+names[p.type];
  return '<svg class="piece" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+label+'">'
    +'<g fill="'+fill+'" stroke="'+edge+'" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round">'
    +vipStorybookShapes[p.type]+'</g></svg>';
}
function svg(p,styleOverride,colorOverride){
  var style=styleOverride||window.kfVipPieceStyle||"classic";
  var color=colorOverride||window.kfVipPieceColor||"standard";
  var key=style+":"+color+":"+p.color+p.type;
  if(_svgCache[key])return _svgCache[key];
  if(style==="heritage"){var original=vipHeritageSvg(p,color);_svgCache[key]=original;return original;}
  if(style==="silhouette"){var traced=vipSilhouetteSvg(p,color);_svgCache[key]=traced;return traced;}
  if(style==="dualclassic"){var exact=vipDualClassicSvg(p,color);_svgCache[key]=exact;return exact;}
  if(style==="rosevector"){var newArt=vipRoseVectorSvg(p,color);_svgCache[key]=newArt;return newArt;}
  if(style==="storybook"){var illustrated=vipStorybookSvg(p,color);_svgCache[key]=illustrated;return illustrated;}
  var w=p.color==="w";
  var solid={k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"};
  var hollow={k:"♔",q:"♕",r:"♖",b:"♗",n:"♘",p:"♙"};
  var glyph=style==="outline"?hollow[p.type]:solid[p.type];
  var pair=vipColors(color,w);
  var fill=pair[0],stroke=pair[1];
  var strokeW=w?"2.6":"1.4",shadow="drop-shadow(0 2px 2px #0008)";
  if(color==="neon"){strokeW="3";shadow=w?"drop-shadow(0 0 5px #3dfbea)":"drop-shadow(0 0 5px #ff53df)";}
  if(color==="royal"){strokeW="2.4";shadow="drop-shadow(0 2px 3px #5e371b99)";}
  if(style==="outline")strokeW="1.8";
  var fontSizes={k:112,q:100,r:100,b:106,n:108,p:106};
  var label=(w?"White ":"Black ")+names[p.type];
  var result='<svg class="piece" viewBox="0 0 100 100" role="img" aria-label="'+label+'" xmlns="http://www.w3.org/2000/svg">'
    +'<text x="50" y="88" text-anchor="middle" font-family="DejaVu Sans,Arial Unicode MS,Segoe UI Symbol,serif" '
    +'font-size="'+(fontSizes[p.type]||100)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+strokeW+'" '
    +'paint-order="stroke fill" filter="'+shadow+'">'+glyph+'</text></svg>';
  _svgCache[key]=result;return result;
}
vipInit();

/* ===== setPlayer ===== */
function setPlayer(color, player){
  var prefix = color.toLowerCase();
  var card = $(prefix + "Card");
  var name = player && player.username ? player.username : "Waiting for opponent";
  var winsRaw = player && player.wins !== undefined ? Number(player.wins) : NaN;
  var wins = (isFinite(winsRaw) ? fmtStat(winsRaw) : "—") + " crowns";
  var avatar = (player && player.avatar_url) ? player.avatar_url : defaultAvatar();
  $(prefix + "Name").textContent = name;
  $(prefix + "Wins").textContent = wins;
  $(prefix + "Avatar").src = avatar;
  if(card) card.classList.toggle("empty", !player);
  var mc = $(prefix + "CardMobile");
  if(mc){
    $(prefix + "NameMobile").textContent = name;
    $(prefix + "WinsMobile").textContent = wins;
    $(prefix + "AvatarMobile").src = avatar;
    mc.classList.toggle("empty", !player);
  }
}

/* ===== clocks ===== */
// Show server-authoritative clock values directly. Do not keep decrementing
// the stopped player's clock with a post-move visual animation.
function paintClocks(){
  // A clock repaint used to replay the move history up to six times.
  var canRun = game && !clockExpired && !game.game_over();
  var displayTurn = (onlineGameId && onlineGame && onlineGame.turn) ? onlineGame.turn : (game ? game.turn() : "w");
  var colors = ["white", "black"];
  for(var i=0;i<colors.length;i++){
    var color = colors[i];
    var val = color === "white" ? clockWhite : clockBlack;
    var ids = [color + "Clock", color + "ClockMobile"];
    for(var j=0;j<ids.length;j++){
      var el = $(ids[j]);
      if(!el) continue;
      el.textContent = fmtClockTenths(val);
      var active = false;
      if(canRun && !computerMode){
        var turnIsWhite = displayTurn === "w";
        var thisIsWhite = color === "white";
        if(turnIsWhite === thisIsWhite) active = true;
      }
      el.classList.toggle("active", active);
    }
  }
  if(document.body.classList.contains("game-focus")){
    var topColor = fsPlayerColor === "w" ? "black" : "white";
    var topVal = topColor === "white" ? clockWhite : clockBlack;
    var botColor = fsPlayerColor === "w" ? "white" : "black";
    var botVal = botColor === "white" ? clockWhite : clockBlack;
    var topEl = $("gfsTopClock"), botEl = $("gfsBotClock");
    if(topEl){
      topEl.textContent = fmtClockTenths(topVal);
      var topActive = canRun && ((displayTurn==="w")===(topColor==="white"));
      topEl.classList.toggle("active", topActive);
    }
    if(botEl){
      botEl.textContent = fmtClockTenths(botVal);
      var botActive = canRun && ((displayTurn==="w")===(fsPlayerColor==="w"));
      botEl.classList.toggle("active", botActive);
    }
  }
  // Paint the first-move banner with the exact same clock snapshot.
  updateFirstMoveDeadlineUI();
}

// Keep the visible clock aligned with the server's actual timestamp.
// The time values in the row are the stored snapshot; elapsed time since the
// snapshot must be subtracted locally, including network/realtime delivery delay.
function anchorClockToServerTime(timestamp){
  var perfNow = performance.now();
  if(!timestamp){
    clockPerfAnchor = perfNow;
    return;
  }
  var serverTimeMs = new Date(timestamp).getTime();
  if(!Number.isFinite(serverTimeMs)){
    clockPerfAnchor = perfNow;
    return;
  }
  var wallNow = Date.now() + (kfServerOffsetKnown ? kfServerOffsetMs : (currentGameIsRoulette ? rouletteServerClockOffsetMs : 0));
  clockPerfAnchor = perfNow - (wallNow - serverTimeMs);
}

function resetClocks(){
  clockExpired = false;
  clockClaimPending = false;
  clockStartPending = false;
  clockReadySent = false;
  lastClockAt = Date.now();
  clockPerfAnchor=null;
  kfPendingClockMove=false;kfClockBeforeMove=null;
  kfRunningClockBlend=null;
  kfServerOffsetKnown=false;kfServerOffsetMs=0;
  firstMoveDeadlineAnchor=null;
  firstMoveDeadlinePerfAnchor = null;
  
  if(onlineGame){
    // زمان‌ها رو مستقیم از دیتابیس می‌خونیم (سرور قبلاً محاسبه کرده)
    clockWhite = onlineGame.white_time_left != null ? onlineGame.white_time_left : 300;
    clockBlack = onlineGame.black_time_left != null ? onlineGame.black_time_left : 300;
  } else {
    clockWhite = 300;
    clockBlack = 300;
  }
  paintClocks();
  }

function setBloodbladeState(t,o){o=o||{};$("bloodbladeSub").textContent=t;$("cancelBloodblade").hidden=!o.cancel;$("bloodbladeBtn").disabled=!!(o.lock||onlineGameId);}
/* ===== renderPlayers ===== */
function renderPlayers(row){
  if(!row){ setPlayer("Black", null); setPlayer("White", null); return; }
  setPlayer("White", {username: row.white_username, wins: row.white_wins, avatar_url: row.white_avatar});
  setPlayer("Black", {username: row.black_username, wins: row.black_wins, avatar_url: row.black_avatar});
}

/* ===== quick/roulette state ===== */
function setQuickState(text, opts){
  opts = opts || {};
  $("quickState").textContent = text;
  $("cancelQueue").hidden = !opts.cancel;
  $("quickPlay").disabled = !!(opts.lock || onlineGameId);
}
function setRouletteState(text, opts){
  opts = opts || {};
  $("rouletteSub").textContent = text;
  $("cancelRoulette").hidden = !opts.cancel;
  $("rouletteBtn").disabled = !!(opts.lock || onlineGameId);
  }
  /* ============ LEADERBOARD ============ */
var leaderboardSeen = new Set();
var leaderboardCursor = null;
var leaderboardRequest = 0;
var leaderboardBusy = false;
var leaderboardMore = false;
var leaderboardPageSize = 20;
var leaderboardSort = "overall";
var leaderboardSortLabels = {overall:"Overall",wins:"Crowns",tournament_wins:"Tournament wins",humiliation_losses:"Humiliation",bt_wins:"Blood Tributes"};
function getLeaderboardOverall(row){
  return (Number(row.wins) || 0) + (Number(row.bt_wins) || 0) + 20 * (Number(row.tournament_wins) || 0);
}
function appendLeaderboardRows(rows){
  var list = $("lbList");
  var fragment = document.createDocumentFragment();
  for(var row of rows){
    if(leaderboardSeen.has(row.user_id)) continue;
    leaderboardSeen.add(row.user_id);
    var isMe = currentUser && row.user_id === currentUser.id;
    var div = document.createElement("div");
    div.className = "lb-row" + (isMe ? " me" : "");
    var rankNum = leaderboardSeen.size;
    var rankClass = "";
    if(rankNum === 1) rankClass = " gold";
    else if(rankNum === 2) rankClass = " silver";
    else if(rankNum === 3) rankClass = " bronze";
    var medals = ["🥇","🥈","🥉"];
    var rankText = rankNum <= 3 ? medals[rankNum-1] : String(rankNum);
    // Build a fixed template: database-supplied names and avatar URLs must
    // never be parsed as HTML or as attributes.
    div.innerHTML =
      '<div class="lb-rank' + rankClass + '"></div>' +
      '<div class="lb-user"><img alt=""><div class="lb-name"></div></div>' +
      '<div class="lb-stat wins"></div>' +
      '<div class="lb-stat trophies"></div>' +
      '<div class="lb-stat humil"></div>' +
      '<div class="lb-stat bt" title="Blood Tributes wins"></div>' +
      '<div class="lb-stat overall" title="Crowns + BT + 20 × Tournament wins"></div>';
    div.querySelector(".lb-rank").textContent = rankText;
    var avatar = div.querySelector(".lb-user img");
    var avatarUrl = typeof row.avatar_url === "string" ? row.avatar_url.trim() : "";
    avatar.src = /^https:\/\//i.test(avatarUrl) ? avatarUrl : defaultAvatar();
    var nameNode = div.querySelector(".lb-name");
    nameNode.textContent = row.username || "Player";
    if(isMe){
      var you = document.createElement("span");
      you.style.cssText = "color:var(--gold);font-size:10px";
      you.textContent = " (YOU)";
      nameNode.appendChild(you);
    }
    div.querySelector(".lb-stat.wins").textContent = fmtStat(row.wins || 0);
    div.querySelector(".lb-stat.trophies").textContent = fmtStat(row.tournament_wins || 0);
    div.querySelector(".lb-stat.humil").textContent = fmtStat(row.humiliation_losses || 0);
    div.querySelector(".lb-stat.bt").textContent = fmtStat(row.bt_wins || 0);
    div.querySelector(".lb-stat.overall").textContent = fmtStat(getLeaderboardOverall(row));
    fragment.appendChild(div);
  }
  list.appendChild(fragment);
}
function closeLeaderboardSort(){
  $("lbSortMenu").hidden = true;
  $("lbSortBtn").setAttribute("aria-expanded","false");
}
$("lbSortBtn").onclick = function(e){
  e.stopPropagation();
  var menu = $("lbSortMenu");
  menu.hidden = !menu.hidden;
  $("lbSortBtn").setAttribute("aria-expanded",String(!menu.hidden));
};
$("lbSortMenu").addEventListener("click",function(e){
  var btn = e.target.closest("button[data-lb-sort]");
  if(!btn) return;
  var chosen = btn.getAttribute("data-lb-sort");
  if(!Object.prototype.hasOwnProperty.call(leaderboardSortLabels,chosen)) return;
  leaderboardSort = chosen;
  $("lbSortBtn").textContent = "⇅ Sort: " + leaderboardSortLabels[chosen] + " ▾";
  Array.prototype.forEach.call($("lbSortMenu").querySelectorAll("button"),function(b){
    b.setAttribute("aria-pressed", String(b === btn));
  });
  closeLeaderboardSort();
  loadLeaderboard();
});
document.addEventListener("click",function(e){
  if(!e.target.closest(".lb-sort-wrap")) closeLeaderboardSort();
});
var leaderboardNext = document.createElement("button");
leaderboardNext.type = "button";
leaderboardNext.className = "lb-refresh";
leaderboardNext.hidden = true;
$("lbList").after(leaderboardNext);

function loadLeaderboard(){
  ++leaderboardRequest;
  leaderboardSeen.clear();
  leaderboardCursor = null;
  leaderboardMore = true;
  leaderboardBusy = false;
  $("lbList").innerHTML = '<div class="lb-loading">Loading leaderboard…</div>';
  $("lbList").scrollTop = 0;
  return loadLeaderboardPage();
}
async function loadLeaderboardPage(){
  if(leaderboardBusy || !leaderboardMore) return;
  var request = leaderboardRequest;
  var cursor = leaderboardCursor;
  var list = $("lbList");
  leaderboardBusy = true;
  leaderboardNext.hidden = true;
  try{
    if(!sb) throw Error("Supabase unavailable");
    var res = await sb.rpc("kf_leaderboard_page",{
      p_sort:leaderboardSort,
      p_after_score:cursor ? cursor.sort_score : null,
      p_after_id:cursor ? cursor.user_id : null
    });
    if(request !== leaderboardRequest) return;
    if(res.error) throw res.error;
    var data = res.data || [];
    var page = data.slice(0,leaderboardPageSize);
    if(!cursor) list.replaceChildren();
    appendLeaderboardRows(page);
    leaderboardMore = data.length > leaderboardPageSize;
    if(page.length) leaderboardCursor = page[page.length-1];
    if(!leaderboardSeen.size) list.innerHTML = '<div class="lb-empty">No players yet.</div>';
    leaderboardNext.textContent = "Load more players";
    leaderboardNext.hidden = !leaderboardMore;
  }catch(error){
    if(request !== leaderboardRequest) return;
    if(!cursor) list.innerHTML = '<div class="lb-empty">Could not load leaderboard.</div>';
    leaderboardNext.textContent = "Retry loading players";
    leaderboardNext.hidden = false;
    console.warn("Leaderboard request failed:",error);
  }finally{
    if(request === leaderboardRequest) leaderboardBusy = false;
  }
}
$("lbList").addEventListener("scroll",function(){
  if(this.scrollTop > 0 && this.scrollTop + this.clientHeight >= this.scrollHeight - 64)
    loadLeaderboardPage();
},{passive:true});
leaderboardNext.onclick = loadLeaderboardPage;
$("lbRefresh").onclick = loadLeaderboard;

/* ============ TOURNAMENT STATE ============ */
// Coalesce identical in-flight tournament reads, never cache settled results.
// Realtime transitions, manual views and match recovery use fresh reads.
var kfNextTournamentRead=null, kfNextTournamentReadKey=null;
function kfGetTournamentStateOnce(forceFresh){
  var key=currentUser ? "user:"+currentUser.id : "public";
  if(!forceFresh && kfNextTournamentRead && kfNextTournamentReadKey===key)
    return kfNextTournamentRead;
  var promise=Promise.resolve(sb.rpc(currentUser ? "kf_get_next_tournament" : "kf_get_current_tournament_public"));
  kfNextTournamentRead=promise;
  kfNextTournamentReadKey=key;
  function clear(){
    if(kfNextTournamentRead===promise){
      kfNextTournamentRead=null;
      kfNextTournamentReadKey=null;
    }
  }
  promise.then(clear,clear);
  return promise;
}

async function loadLastTournamentState(){
  if(!sb) return;
  try{
    var res = await sb.rpc("kf_get_last_tournament");
    if(res.error) throw res.error;
    tournLast = res.data || null;
    tournLastBracketRendered = null;
    if(tournLast && tournLast.id){
      var full = await sb.rpc("kf_get_tournament_full", {p_tournament_id:tournLast.id});
      if(!full.error && full.data) tournLastBracketRendered = full.data;
    }
    if($("tournDialog").open && tournView === "last") renderTournDialog();
  } catch(err){ console.warn("Last tournament state error:", err); }
}

async function loadTournamentState(recoverAssignedMatch,forceFresh){
  if(!sb) return;
  var requestId = ++tournStateRequestId;
  try{
    var res = await kfGetTournamentStateOnce(!!forceFresh || !!recoverAssignedMatch);
    if(requestId !== tournStateRequestId) return;
    if(res.error) throw res.error;
    var nextTournament = res.data;
    var nextId = nextTournament && nextTournament.id;
    var previousId = tournCurrent && tournCurrent.id;
    if(nextId !== previousId){
      // A bracket and registration always belong to exactly one tournament.
      ++tournBracketRequestId;
      ++tournEntryRequestId;
      tournBracketRendered = null;
      tournMyEntry = null;
      tournPlayersLoadState = "loading";
    }
    tournCurrent = nextTournament;
    // Only load the complete bracket for its visible view or assigned-match recovery.
    var needsVisibleBracket = !document.hidden && $("tournDialog").open && tournView === "next";
    var needsMatchRecovery = !!recoverAssignedMatch && !!currentUser &&
      nextTournament && nextTournament.status === "active";
    if(nextId && (needsVisibleBracket || needsMatchRecovery)){
      var bracketRequestId = ++tournBracketRequestId;
      if(!tournBracketRendered) tournPlayersLoadState = "loading";
      var chRes;
      try{
        chRes = await sb.rpc("kf_get_tournament_full", {p_tournament_id: nextId});
      } catch(err){
        chRes = {error:err};
      }
      if(requestId !== tournStateRequestId || bracketRequestId !== tournBracketRequestId) return;
      if(tournCurrent && tournCurrent.id === nextId && !chRes.error &&
         chRes.data && chRes.data.id === nextId && Array.isArray(chRes.data.entries)){
        tournBracketRendered = chRes.data;
        tournPlayersLoadState = "ready";
      } else if(!tournBracketRendered){
        tournPlayersLoadState = "error";
      }
    }
    if(!document.hidden && $("tournDialog").open && tournView === "last"){
      await loadLastTournamentState();
    }
    if(requestId !== tournStateRequestId) return;
    if(currentUser) await checkMyTournamentEntry();
    if(requestId !== tournStateRequestId) return;
    updateTournButton();
    if($("tournDialog").open && tournView === "next") renderTournDialog();
    startTournChannel();
    if(!document.hidden && tournCurrent && tournCurrent.status==="active") checkTournMatchStatus();
  } catch(err){ if(requestId === tournStateRequestId) console.warn("Tournament state error:", err); }
}

async function checkMyTournamentEntry(){
  var requestId = ++tournEntryRequestId;
  tournMyEntry = null;
  if(!sb || !currentUser || !tournCurrent || !tournCurrent.id) return;
  var tournamentId = tournCurrent.id;
  var userId = currentUser.id;

  // Never use registration entries cached for a different tournament.
  var entries = tournBracketRendered && tournBracketRendered.id === tournamentId &&
    Array.isArray(tournBracketRendered.entries) ? tournBracketRendered.entries : null;
  if(entries){
    tournMyEntry = entries.find(function(e){ return e.user_id === userId; }) || null;
    return;
  }

  // Fallback only when the tournament RPC has not supplied its entries yet.
  var res = await sb.from("kf_tournament_entries")
    .select("*").eq("tournament_id", tournamentId).eq("user_id", userId).maybeSingle();
  if(requestId !== tournEntryRequestId || !tournCurrent ||
     tournCurrent.id !== tournamentId || !currentUser || currentUser.id !== userId) return;
  if(!res.error && res.data) tournMyEntry = res.data;
}

var tournChannelRetryTimer = null;
function startTournChannel(){
  // The 15-second tournament refresh also calls this function. Keep the
  // existing subscription rather than tearing down its WebSocket every time.
  if(!sb || tournChannel) return;
  if(tournChannelRetryTimer){ clearTimeout(tournChannelRetryTimer); tournChannelRetryTimer = null; }
  var channel = sb.channel("kf-tourn-ch")
    .on("postgres_changes",{event:"*",schema:"public",table:"kf_tournament_entries"}, function(p){
      if(document.hidden)return;
      if($("tournDialog").open && tournView==="next"){
        refreshTournLive();
      } else if(currentUser && p.new && p.new.user_id===currentUser.id){
        checkMyTournamentEntry().then(updateTournButton);
      }
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"kf_tournament_matches"}, function(p){
      if(document.hidden)return;
      if($("tournDialog").open && tournView==="next")refreshTournLive();
      // Background match notices must remain active even with the dialog closed.
      var m=p.new;
      if(currentUser && m && m.player2_id && (m.status==="active" || m.status==="pending") &&
         (m.player1_id===currentUser.id || m.player2_id===currentUser.id)){
        kfRecoverTournamentMatch();
      }
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"kf_tournaments"}, function(p){
      if(p.eventType==="INSERT"){
        if(!document.hidden)loadTournamentState(false,true);
      } else if(p.new){
        handleTournUpdate(p.new);
      }
    });
  tournChannel = channel;
  channel.subscribe(function(status){
    if(status !== "CLOSED" && status !== "TIMED_OUT" && status !== "CHANNEL_ERROR") return;
    // Ignore notifications belonging to a previous subscription.
    if(tournChannel !== channel) return;
    tournChannel = null;
    sb.removeChannel(channel);
    if(!tournChannelRetryTimer){
      tournChannelRetryTimer = setTimeout(function(){
        tournChannelRetryTimer = null;
        startTournChannel();
      }, 5000);
    }
  });
}

async function refreshTournLive(){
  if(!sb || document.hidden || !$("tournDialog").open || tournView!=="next" ||
     !tournCurrent || !tournCurrent.id) return;
  var tournamentId = tournCurrent.id;
  var requestId = ++tournBracketRequestId;
  if(!tournBracketRendered) tournPlayersLoadState = "loading";
  var chRes;
  try{
    chRes = await sb.rpc("kf_get_tournament_full", {p_tournament_id: tournamentId});
  } catch(err){
    chRes = {error:err};
  }
  if(requestId !== tournBracketRequestId || !tournCurrent ||
     tournCurrent.id !== tournamentId) return;
  if(!chRes.error && chRes.data && chRes.data.id === tournamentId &&
     Array.isArray(chRes.data.entries)){
    tournBracketRendered = chRes.data;
    tournPlayersLoadState = "ready";
  } else if(!tournBracketRendered){
    tournPlayersLoadState = "error";
  }
  await checkMyTournamentEntry();
  if(requestId !== tournBracketRequestId || !tournCurrent ||
     tournCurrent.id !== tournamentId) return;
  if($("tournDialog").open) renderTournDialog();
  updateTournButton();
  if(!document.hidden && tournCurrent && tournCurrent.status==="active") checkTournMatchStatus();
}

function handleTournUpdate(row){
  if(!row) return;
  if(tournCurrent && row.id === tournCurrent.id){
    tournCurrent = row;
    if(row.status === "completed"&&!document.hidden){
      loadChampion();
      if($("tournDialog").open && tournView==="last")loadLastTournamentState();
    }
    updateTournButton();
    if(!document.hidden&&$("tournDialog").open && tournView === "next") refreshTournLive();
    if(!document.hidden && (row.status==="completed" || row.status==="cancelled")){
      setTimeout(function(){if(!document.hidden)loadTournamentState(false,true);},1500);
    }
  }
}

function updateTournButton(){
  var btn = $("tournamentBtn"), tmr = $("tournBtnTimer"), sub = $("tournBtnSub");
  if(!tournCurrent){
    tmr.textContent = "--:--:--";
    sub.textContent = "Tap to join the next knockout cup";
    btn.classList.remove("registered","live");
    return;
  }
  var now = Date.now();
  var start = new Date(tournCurrent.scheduled_at).getTime();
  if(tournCurrent.status === "registration"){
    tmr.textContent = now >= start ? "STARTING..." : fmtCountdown(start - now);
    if(now >= start){
      btn.classList.remove("registered");
      btn.classList.add("live");
      sub.textContent = "Preparing tournament bracket...";
    } else if(tournMyEntry){
      btn.classList.add("registered"); btn.classList.remove("live");
      sub.textContent = "Registered · Tap to view";
    } else{
      btn.classList.remove("registered","live");
      sub.textContent = "Tap to register";
    }
  } else if(tournCurrent.status === "active"){
    btn.classList.add("live"); btn.classList.remove("registered"); tmr.textContent = "LIVE";
    sub.textContent = tournMyEntry ? (tournMyEntry.eliminated_round ? "Eliminated" : "Playing now") : "In progress";
  } else {
    tmr.textContent = "DONE"; btn.classList.remove("live"); btn.classList.add("registered");
    sub.textContent = "View bracket · champion crowned";
  }
}

function startTournTick(){
  if(tournTickTimer) clearInterval(tournTickTimer);
  tournTickTimer=null;
  if(document.hidden)return;
  tournTickTimer = setInterval(function(){
    updateTournButton();
    if($("tournDialog").open && tournCurrent) updateTournBigTimer();
    if($("tournDialog").open &&
       (!window._lastTournRefresh || Date.now() - window._lastTournRefresh > 15000)){
      window._lastTournRefresh = Date.now();
      loadTournamentState();
    }
  }, 1000);
  }
  function updateTournBigTimer(){
  if(!tournCurrent) return;
  var now = Date.now();
  if(tournCurrent.status === "registration"){
    var start = new Date(tournCurrent.scheduled_at).getTime();
    if(now >= start){
      $("tournBigTimer").textContent = "STARTING...";
      $("tournBigSub").textContent = "Preparing tournament bracket...";
    } else {
      $("tournBigTimer").textContent = fmtCountdown(start - now);
      $("tournBigSub").textContent = "Registration open · " + (tournMyEntry ? "You are registered" : "Tap Register to join");
    }
  } else if(tournCurrent.status === "active"){
    $("tournBigTimer").textContent = "LIVE";
    $("tournBigSub").textContent = "Tournament in progress";
  } else if(tournCurrent.status === "cancelled"){
    $("tournBigTimer").textContent = "CANCELLED";
    $("tournBigSub").textContent = "Tournament cancelled · Not enough players";
  } else if(tournCurrent.status === "completed"){
    $("tournBigTimer").textContent = "🏆";
    $("tournBigSub").textContent = "Champion: " + (tournCurrent.winner_username || "—");
  } else {
    $("tournBigTimer").textContent = "—";
    $("tournBigSub").textContent = "Tournament status unavailable";
  }
}

function openTournDialog(){
  if(kfFeatureFlags.tournaments===false){say("Tournaments are temporarily disabled.",{info:true});return;}
  if(!tournCurrent){ say("Tournament data loading…", {silentToast:true}); return; }
  tournView = "next";
  renderTournDialog();
  $("tournDialog").showModal();
  loadTournamentState(false,true);
}

$("tournNextViewBtn").onclick = function(){
  tournView = "next";
  $("tournNextViewBtn").classList.add("active");
  $("tournLastViewBtn").classList.remove("active");
  renderTournDialog();
  loadTournamentState(false,true);
};

$("tournLastViewBtn").onclick = async function(){
  tournView = "last";
  $("tournLastViewBtn").classList.add("active");
  $("tournNextViewBtn").classList.remove("active");
  await loadLastTournamentState();
  renderTournDialog();
};
$("tournClose").onclick = function(){ $("tournDialog").close(); };

function renderTournDialog(){
  var isLast = tournView === "last";
  var displayTourn = isLast ? tournLast : tournCurrent;
  var displayBracket = isLast ? tournLastBracketRendered : tournBracketRendered;
  $("tournNextViewBtn").classList.toggle("active", !isLast);
  $("tournLastViewBtn").classList.toggle("active", isLast);
  if(!displayTourn){
    $("tournTitle").textContent = isLast ? "Last Tournament" : "Next Tournament";
    $("tournStatusPill").textContent = isLast ? "No completed tournament" : "Loading";
    $("tournStatusPill").className = "pill";
    $("tournScheduleText").textContent = isLast ? "A completed tournament will appear here" : "—";
    $("tournRegisterBtn").hidden = true;
    $("tournBracketWrap").hidden = true;
    $("tournCountdownBig").hidden = false;
    $("tournBigTimer").textContent = "—";
    $("tournBigSub").textContent = isLast ? "No tournament history yet" : "Tournament data loading…";
    $("tournPlayerList").innerHTML = "";
    $("tournPlayerCount").textContent = "0 players";
    return;
  }
  if(isLast){
    $("tournTitle").textContent = "Last Tournament";
    $("tournStatusPill").textContent = "Completed";
    $("tournStatusPill").className = "pill";
    $("tournScheduleText").textContent = "Completed " + fmtTimeLocal(displayTourn.completed_at || displayTourn.scheduled_at);
    $("tournRegisterBtn").hidden = true;
    $("tournMsg").textContent = "";
  } else {
    $("tournTitle").textContent = displayTourn.status === "registration" ? "Next Tournament"
      : displayTourn.status === "active" ? "Live Tournament"
      : displayTourn.status === "cancelled" ? "Tournament Cancelled" : "Tournament Complete";
    var pill = $("tournStatusPill");
    if(displayTourn.status === "registration"){ pill.textContent = "Registration"; pill.className = "pill reg"; }
    else if(displayTourn.status === "active"){ pill.textContent = "● LIVE"; pill.className = "pill live"; }
    else if(displayTourn.status === "cancelled"){ pill.textContent = "Cancelled"; pill.className = "pill"; }
    else { pill.textContent = "Completed"; pill.className = "pill"; }
    $("tournScheduleText").textContent = "Starts " + fmtTimeLocal(displayTourn.scheduled_at);
    updateTournBigTimer();
    var actionBtn = $("tournRegisterBtn");
    if(displayTourn.status === "registration"){
      actionBtn.hidden = false;
      actionBtn.textContent = tournMyEntry ? "Cancel" : "Register";
      actionBtn.classList.toggle("primary", !tournMyEntry);
      actionBtn.classList.toggle("danger", !!tournMyEntry);
      actionBtn.disabled = false;
    } else actionBtn.hidden = true;
  }
  var hasBracket = displayBracket && displayBracket.matches && displayBracket.matches.length > 0;
  if(hasBracket){
    $("tournBracketWrap").hidden = false;
    $("tournCountdownBig").hidden = true;
    renderBracket(displayBracket);
    $("tournPlayerList").innerHTML = "";
    $("tournPlayerCount").textContent = (displayBracket.entries ? displayBracket.entries.length : 0) + " players";
  } else {
    $("tournBracketWrap").hidden = true;
    $("tournCountdownBig").hidden = false;
    if(isLast){
      $("tournBigTimer").textContent = "🏆";
      $("tournBigSub").textContent = "Champion: " + (displayTourn.winner_username || "—");
      $("tournPlayerList").innerHTML = "";
      $("tournPlayerCount").textContent = "0 players";
    } else renderPlayerList();
  }
}

function renderPlayerList(){
  var list = $("tournPlayerList");
  list.innerHTML = "";
  var entries = tournBracketRendered && tournCurrent && tournBracketRendered.id === tournCurrent.id &&
    Array.isArray(tournBracketRendered.entries) ? tournBracketRendered.entries : [];
  var hasEntriesData = !!(tournBracketRendered && tournCurrent &&
    tournBracketRendered.id === tournCurrent.id &&
    Array.isArray(tournBracketRendered.entries));
  if(!hasEntriesData){
    $("tournPlayerCount").textContent = "— players";
    list.innerHTML = tournPlayersLoadState === "error"
      ? '<div class="tourn-empty">Unable to load players. Please try again.</div>'
      : '<div class="tourn-empty">Loading players...</div>';
    return;
  }
  $("tournPlayerCount").textContent = entries.length + " players";
  if(!entries.length){
    list.innerHTML = '<div class="tourn-empty">No players registered yet.<br>Be the first!</div>';
    return;
  }
  for(var i=0;i<entries.length;i++){
    var e = entries[i];
    var row = document.createElement("div");
    row.className = "tourn-player-row";
    if(currentUser && e.user_id === currentUser.id) row.classList.add("me");
    var img = document.createElement("img");
    img.src = e.avatar_url || defaultAvatar();
    img.alt = "";
    var nm = document.createElement("span");
    nm.className = "tp-name";
    nm.textContent = e.username || "Player";
    row.appendChild(img);
    row.appendChild(nm);
    if(currentUser && e.user_id === currentUser.id){
      var b = document.createElement("span");
      b.className = "tp-badge you";
      b.textContent = "YOU";
      row.appendChild(b);
    }
    list.appendChild(row);
  }
}

$("tournRegisterBtn").onclick = async function(){
  if(!sb || !currentUser){ say("Sign in first.", {error:true}); openAuth("signin"); return; }

  var actionBtn = $("tournRegisterBtn");
  var cancelling = !!tournMyEntry;
  actionBtn.disabled = true;
  $("tournMsg").textContent = cancelling ? "Cancelling…" : "Registering…";
  $("tournMsg").classList.remove("error");

  try {
    var res = cancelling
      ? await sb.rpc("kf_cancel_tournament_registration")
      : await sb.rpc("kf_register_tournament");

    if(res.error) throw res.error;

    var resultStatus = res.data && res.data.status;

    if(cancelling && resultStatus !== "cancelled"){
      $("tournMsg").textContent = resultStatus === "already_started"
        ? "The tournament has started. Cancellation is closed."
        : "You are not registered for this tournament.";
      $("tournMsg").classList.add("error");
      await refreshTournLive();
      return;
    }

    if(!cancelling && !["registered", "already"].includes(resultStatus)){
      throw new Error((res.data && res.data.message) || "Registration could not be completed.");
    }

    $("tournMsg").textContent = cancelling
      ? "Registration cancelled."
      : "✅ Registered! You'll be paired when the tournament starts.";

    await refreshTournLive();
  } catch(err) {
    $("tournMsg").textContent = err.message || "Something went wrong. Please try again.";
    $("tournMsg").classList.add("error");
    actionBtn.disabled = false;
  }
};

$("tournamentBtn").onclick = function(){
  if(!currentUser){ say("Sign in to join the tournament.", {error:true}); openAuth("signin"); return; }
  openTournDialog();
};
  function roundName(round, totalRounds){
  var fromEnd = totalRounds - round;
  if(fromEnd === 0) return "Final";
  if(fromEnd === 1) return "Semi-Finals";
  if(fromEnd === 2) return "Quarter-Finals";
  if(fromEnd === 3) return "Round of 16";
  if(fromEnd === 4) return "Round of 32";
  if(fromEnd === 5) return "Round of 64";
  return "Round " + round;
}

function renderBracket(data){
  var wrap = $("tournBracket");
  wrap.innerHTML = "";
  if(!data || !data.matches) return;
  var bracketSize = data.bracket_size || 2;
  var totalRounds = 1;
  while((1<<totalRounds) < bracketSize) totalRounds++;
  var byRound = {};
  for(var i=0;i<data.matches.length;i++){
    var m = data.matches[i];
    if(!byRound[m.round]) byRound[m.round] = [];
    byRound[m.round].push(m);
  }
  for(var r in byRound) byRound[r].sort(function(a,b){ return a.match_index - b.match_index; });
  for(var round=1; round<=totalRounds; round++){
    var col = document.createElement("div");
    col.className = "bracket-round";
    var title = document.createElement("div");
    title.className = "bracket-round-title";
    title.textContent = roundName(round, totalRounds);
    col.appendChild(title);
    var matches = byRound[round] || [];
    var expected = Math.pow(2, totalRounds - round);
    for(var k=0;k<expected;k++){
      var m = matches[k];
      var box = document.createElement("div");
      box.className = "bracket-match";
      if(m){
        if(m.status === "active") box.classList.add("active");
        if(m.status === "completed") box.classList.add("completed");
        box.appendChild(makeBracketPlayer(m.player1_username, m.player1_avatar, m.winner_id && m.winner_id === m.player1_id, m.winner_id && m.player1_id && m.winner_id !== m.player1_id, m.player1_id));
        var vs = document.createElement("div");
        vs.className = "bracket-vs";
        vs.textContent = "VS";
        box.appendChild(vs);
        if(!m.player2_id) box.appendChild(makeByePlayer());
        else box.appendChild(makeBracketPlayer(m.player2_username, m.player2_avatar, m.winner_id && m.winner_id === m.player2_id, m.winner_id && m.player2_id && m.winner_id !== m.player2_id, m.player2_id));
      } else {
        box.appendChild(makeEmptySlot());
        var vs2 = document.createElement("div");
        vs2.className = "bracket-vs";
        vs2.textContent = "VS";
        box.appendChild(vs2);
        box.appendChild(makeEmptySlot());
      }
      col.appendChild(box);
    }
    wrap.appendChild(col);
  }
}

function makeBracketPlayer(name, avatar, isWinner, isLoser, id){
  var el = document.createElement("div");
  el.className = "bracket-player";
  if(isWinner) el.classList.add("winner");
  else if(isLoser) el.classList.add("loser");
  if(!id){ el.classList.add("empty"); el.textContent = "— TBD —"; return el; }
  var img = document.createElement("img");
  img.src = avatar || defaultAvatar();
  img.alt = "";
  var nm = document.createElement("span");
  nm.className = "bp-name";
  nm.textContent = name || "Player";
  el.appendChild(img);
  el.appendChild(nm);
  return el;
}
function makeByePlayer(){ var el = document.createElement("div"); el.className = "bracket-player bye"; el.textContent = "BYE (auto-advance)"; return el; }
function makeEmptySlot(){ var el = document.createElement("div"); el.className = "bracket-player empty"; el.textContent = "— TBD —"; return el; }

function launchConfetti(){
  var layer = $("celebrateLayer");
  layer.innerHTML = "";
  var colors = ["#edc56b","#ffe5a0","#81b64c","#26c2a3","#5c8bb0","#fa412d"];
  for(var i=0;i<80;i++){
    var c = document.createElement("div");
    c.className = "confetti";
    c.style.left = Math.random()*100 + "%";
    c.style.background = colors[Math.floor(Math.random()*colors.length)];
    c.style.animationDuration = (2 + Math.random()*2) + "s";
    c.style.animationDelay = (Math.random()*0.5) + "s";
    layer.appendChild(c);
  }
  setTimeout(function(){ layer.innerHTML = ""; }, 4500);
}

// A private per-player broadcast announces matches without polling.
function kfStopTournamentMatchNotices(){
  var old=kfTournMatchNoticeChannel;
  kfTournMatchNoticeChannel=null;
  kfTournMatchNoticeUserId=null;
  if(old && sb) sb.removeChannel(old);
}
async function kfRecoverTournamentMatch(){
  if(!sb || !currentUser || document.hidden)return;
  if(kfTournMatchRecoveryPromise)return kfTournMatchRecoveryPromise;
  var p=(async function(){
    await loadTournamentState(true);
    if(!document.hidden && currentUser)await checkTournMatchStatus();
  })();
  kfTournMatchRecoveryPromise=p;
  try{await p;}
  catch(err){console.warn("Tournament match recovery failed:",err);}
  finally{if(kfTournMatchRecoveryPromise===p)kfTournMatchRecoveryPromise=null;}
}
function kfStartTournamentMatchNotices(userId){
  if(!sb || !userId || !sb.channel)return;
  if(kfTournMatchNoticeChannel && kfTournMatchNoticeUserId===userId)return;
  kfStopTournamentMatchNotices();
  var channel=sb.channel("kf:tournament:match:"+userId,{config:{private:true}})
    .on("broadcast",{event:"kf_match_ready"},function(message){
      if(kfTournMatchNoticeChannel!==channel || !currentUser || currentUser.id!==userId)return;
      var payload=message && message.payload;
      if(!payload || !payload.match_id || document.hidden)return;
      kfRecoverTournamentMatch();
    });
  kfTournMatchNoticeChannel=channel;
  kfTournMatchNoticeUserId=userId;
  sb.auth.getSession().then(function(response){
    if(kfTournMatchNoticeChannel!==channel || !currentUser || currentUser.id!==userId)return;
    var token=response && response.data && response.data.session && response.data.session.access_token;
    if(!token){console.warn("Tournament private Realtime unavailable: no session");return;}
    sb.realtime.setAuth(token);
    channel.subscribe(function(status){
      if(kfTournMatchNoticeChannel!==channel)return;
      if(status==="SUBSCRIBED" && !document.hidden)kfRecoverTournamentMatch();
      else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED")
        console.warn("Tournament match notice connection:",status);
    });
  }).catch(function(error){console.warn("Tournament notice subscription failed:",error);});
}

async function checkTournMatchStatus(){
  if(!sb || !currentUser || !tournCurrent || tournCurrent.status !== "active") return;
  if(!tournBracketRendered || !tournBracketRendered.matches) return;
  var myMatch = null;
  for(var i=0;i<tournBracketRendered.matches.length;i++){
    var m = tournBracketRendered.matches[i];
    if((m.status === "active" || m.status === "pending") && m.player2_id && (m.player1_id === currentUser.id || m.player2_id === currentUser.id)){
      myMatch = m;
      break;
    }
  }
  if(!myMatch){
    tournStartBlockedMatchId = null;
    if(tournActiveMatch){ tournActiveMatch = null; say("", {silentToast:true}); }
    return;
  }
  if(tournStartBlockedMatchId && tournStartBlockedMatchId !== myMatch.id) tournStartBlockedMatchId = null;
  if(tournStartBlockedMatchId === myMatch.id) return;
  if(tournActiveMatch && tournActiveMatch.id === myMatch.id) return;
  await startTournamentGame(myMatch);
}

async function startTournamentGame(match){
  if(!sb || !currentUser || !match || !match.id) return;
  if(startingTournMatchId === match.id) return;
  if(onlineGameId && onlineGame && onlineGame.status === "active"
     && onlineGame.is_tournament && onlineGame.tournament_match_id === match.id){
    tournActiveMatch = match;
    return;
  }
  if(celebTimer) return;

  startingTournMatchId = match.id;
  var shouldRetry = true;

  try {
    // Re-read the bracket through the same RPC used by the rest of the tournament UI.
    // Direct table reads may be blocked by the table's RLS policies.
    var freshBracketRes = await sb.rpc("kf_get_tournament_full", {p_tournament_id: tournCurrent.id});
    if(freshBracketRes.error){
      shouldRetry = false;
      console.error("Could not verify tournament match:", freshBracketRes.error);
      say("Could not verify match: " + (freshBracketRes.error.message || "please refresh the page"), {error:true});
      return;
    }

    var freshBracket = freshBracketRes.data;
    var freshMatch = null;
    var freshMatches = freshBracket && Array.isArray(freshBracket.matches) ? freshBracket.matches : [];
    for(var mi=0; mi<freshMatches.length; mi++){
      if(freshMatches[mi].id === match.id){
        freshMatch = freshMatches[mi];
        break;
      }
    }

    if(!freshMatch || !["pending", "active"].includes(freshMatch.status)
       || (freshMatch.player1_id !== currentUser.id && freshMatch.player2_id !== currentUser.id)){
      shouldRetry = false;
      if(freshMatch && tournBracketRendered && Array.isArray(tournBracketRendered.matches)){
        for(var mi2=0; mi2<tournBracketRendered.matches.length; mi2++){
          if(tournBracketRendered.matches[mi2].id === match.id){
            tournBracketRendered.matches[mi2].status = freshMatch.status;
            break;
          }
        }
      }
      tournActiveMatch = null;
      await refreshTournLive();
      return;
    }

    // Keep the server-side guard as the final authority, and create/obtain the game
    // before any client-side action can forfeit an unrelated active game.
    var ensureRes = await sb.rpc("kf_ensure_match_game", {p_match_id: match.id});
    if(ensureRes.error){
      var ensureMessage = (ensureRes.error.message || "").toLowerCase();
      var permanentEnsureErrors = [
        "already completed", "you are not part of this match", "not part of this match",
        "not signed in", "not authenticated", "authentication required",
        "permission denied", "not authorized", "unauthorized", "forbidden",
        "invalid match id", "match not found"
      ];
      var permanentEnsureError = permanentEnsureErrors.some(function(fragment){ return ensureMessage.includes(fragment); });
      if(permanentEnsureError){
        shouldRetry = false;
        tournStartBlockedMatchId = match.id;
      }
      if(ensureMessage.includes("already completed")){
        if(tournBracketRendered && Array.isArray(tournBracketRendered.matches)){
          for(var ci=0; ci<tournBracketRendered.matches.length; ci++){
            if(tournBracketRendered.matches[ci].id === match.id){
              tournBracketRendered.matches[ci].status = "completed";
              break;
            }
          }
        }
        tournActiveMatch = null;
        await refreshTournLive();
        return;
      }
      console.error("Tournament game creation failed:", ensureRes.error);
      say("Could not start match: " + (ensureRes.error.message || "unknown error") + (permanentEnsureError ? " · Automatic retry stopped." : " · Retrying..."), {error:true});
      return;
    }

    var gameId = ensureRes.data;
    if(!gameId){
      shouldRetry = false;
      tournStartBlockedMatchId = match.id;
      console.error("Tournament game creation returned no game id.");
      say("Could not start match: server returned no game ID. Automatic retry stopped.", {error:true});
      return;
    }

    match.status = freshMatch.status;
    match.player1_id = freshMatch.player1_id;
    match.player2_id = freshMatch.player2_id;
    match.game_id = gameId;

    if(computerTimer){ clearTimeout(computerTimer); computerTimer = null; }
    computerMode = false;
    computerBusy = false;
    document.body.classList.remove("computer-mode");

    try { await stopQueuePoll(); } catch(e){}
    try { setQuickState("5-minute game · Match by wins"); } catch(e){}
    try { setRouletteState("Random opening · variable-length line auto-played"); } catch(e){}

    kfStopGameBroadcast(); if(gameChannel && sb){ sb.removeChannel(gameChannel); gameChannel = null; }

    if(onlineGameId && onlineGame && !onlineGame.is_tournament && onlineGame.status === "active"){
      var fWinner = (onlineGame.white_id === currentUser.id) ? onlineGame.black_id : onlineGame.white_id;
      var fResult = (onlineGame.white_id === currentUser.id) ? "0-1" : "1-0";
      try {
        // Forfeiting is always authorized and recorded by the server.
        var forfeitRes = await sb.rpc("kf_forfeit_game",{p_game_id:onlineGameId});
        if(forfeitRes.error) throw forfeitRes.error;
      } catch(e){ console.warn("Forfeit failed:", e); }
    }

    onlineGameId = null;
    onlineGame = null;
    submittingMove = false;

    hideCelebration();
    if($("drawOfferDialog").open) $("drawOfferDialog").close();
    if($("rematchDialog").open) $("rematchDialog").close();
    if($("tournDialog").open) $("tournDialog").close();

    tournActiveMatch = match;
    say("🏆 Tournament match starting — entering game!", {silentToast:true});

    var gameRes = await sb.from("kf_tournament_matches").select("*").eq("id", match.id).maybeSingle();
    if(!gameRes.error && gameRes.data) tournActiveMatch = gameRes.data;

    var joined = await joinTournamentGame(gameId);
    // A match can end between the bracket read and the game read.
    // Never re-enter or retry an already completed tournament game.
    if(joined === "finished"){
      shouldRetry = false;
      tournStartBlockedMatchId = match.id;
      tournActiveMatch = null;
      await loadTournamentState(false, true);
      return;
    }
    if(!joined){
      tournActiveMatch = null;
      return;
    }
  } catch(err) {
    tournActiveMatch = null;
    console.error("Tournament entry failed:", err);
    say("Could not enter match. Retrying...", {error:true});
  } finally {
    startingTournMatchId = null;
    if(shouldRetry && (!onlineGameId || !onlineGame || onlineGame.tournament_match_id !== match.id)){
      setTimeout(checkTournMatchStatus, 2000);
    }
  }
}
async function joinTournamentGame(gameId, skipIntro){
  if(!sb || !currentUser) return false;
  var res = await sb.from("kf_games").select("*").eq("id", gameId).maybeSingle();
  if(res.error || !res.data){
    console.error("Could not load tournament game:", res.error || "No game row returned", gameId);
    say("Could not load tournament game: " + ((res.error && res.error.message) || "game row not found") + " · Retrying...", {error:true});
    return false;
  }
  var data = res.data;
  // A delayed entrant must not open a game that the server already ended.
  // Keep the entire existing join path for games that are still active.
  if(data.status === "completed" || data.status === "cancelled"){
    tournActiveMatch = null;
    say("Tournament game already finished.", {silentToast:true});
    return "finished";
  }
  if($("tournDialog").open) $("tournDialog").close();
  kfStopGameBroadcast(); if(gameChannel && sb){ sb.removeChannel(gameChannel); gameChannel = null; }
  onlineGameId = gameId;
  onlineGame = data;
  startGamePolling();
  resetClocks();
  kfStartClockSync(gameId);
  lastClockAt = Date.now();
  humilApplied = false;
  humilChosenType = null;
  humilSelecting = false;
  document.body.classList.remove("computer-mode");
  document.body.classList.add("online");
  enterFullscreenGame(data);
  humilSelecting=!!data.is_bloodblade&&!humilApplied;
  renderPlayers(data);
  if(currentGameIsRoulette){
    // The DB already stores the final opening position; animate from start.
    game = new Chess();
  } else if(game && game.fen() !== data.fen){
    game.load(data.fen);
  }
  selected = null;
  targets = [];
  last = data.last_move || null;
  clockPerfAnchor = null;
  draw();
  updateHumilBadge();

  if(data.is_tournament){
    sb.rpc("kf_player_joined_game", {p_game_id: gameId}).then(function(r){
      if(r.error){ console.warn("join error:", r.error); return; }
      if(r.data){
        onlineGame.white_joined_at = r.data.white_joined_at;
        onlineGame.black_joined_at = r.data.black_joined_at;
        onlineGame.clock_started_at = r.data.clock_started_at;
        updateFirstMoveDeadlineUI();
      }
    });
  }

  var tournamentGameChannel = sb.channel("kf-game-" + gameId)
    .on("postgres_changes", {event:"UPDATE", schema:"public", table:"kf_games", filter:"id=eq." + gameId}, function(payload){ kfReceivePostgresGameRow(payload.new); });
  gameChannel = tournamentGameChannel;
  tournamentGameChannel.subscribe(function(status){
    if(gameChannel!==tournamentGameChannel||onlineGameId!==gameId)return;
    kfGamePostgresConnected=(status==="SUBSCRIBED");
    kfRefreshGamePolling();
    if(status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED"){
      console.warn("Game channel issue:", status);
      kfScheduleGameStateRecovery(gameId);
    }
  });
  kfStartGameBroadcast(gameId,data);
  return true;
}
async function syncGameState(gameId) {
  if(!sb || onlineGameId !== gameId || submittingMove) return;
  var requestGeneration = gameSyncGeneration;
  try {
    var res = await sb.from("kf_games").select("*").eq("id", gameId).maybeSingle();
    // Ignore a response that was already in flight when a move started.
    if(requestGeneration !== gameSyncGeneration || submittingMove || onlineGameId !== gameId) return;
    if(!res.error && res.data) {
      applyOnlineGame(res.data);
    }
  } catch(e){ console.warn("sync error:", e); }
  }
// Realtime channels reconnect internally. Fetching a fresh game snapshot must
// not tear down and recreate the channel: that caused repeated socket joins.
var kfGameRecoveryTimer=null;
var kfGameReloadPromise=null;
var kfGameReloadId=null;
function kfScheduleGameStateRecovery(gameId){
  if(document.hidden||!sb || !gameId || onlineGameId!==gameId || kfGameRecoveryTimer!=null) return;
  kfGameRecoveryTimer=setTimeout(function(){
    kfGameRecoveryTimer=null;
    if(!document.hidden&&onlineGameId===gameId) reloadGameState(gameId);
  },2000);
}
async function reloadGameState(gameId){
  if(!sb || onlineGameId!==gameId) return;
  if(kfGameReloadPromise && kfGameReloadId===gameId) return kfGameReloadPromise;
  kfGameReloadId=gameId;
  var requestGeneration=gameSyncGeneration;
  var promise=(async function(){
    try{
      var res=await sb.from("kf_games").select("*").eq("id",gameId).maybeSingle();
      if(res.error || !res.data){
        if(res.error)console.warn("reloadGameState error:",res.error);
        return;
      }
      // A server read is only a state refresh; existing Realtime subscription
      // survives and the SDK handles transient socket reconnections.
      if(onlineGameId===gameId && !submittingMove && !kfPendingClockMove &&
         requestGeneration===gameSyncGeneration) applyOnlineGame(res.data);
    }catch(e){console.warn("reloadGameState error:",e);}
  })();
  kfGameReloadPromise=promise;
  try{await promise;}
  finally{if(kfGameReloadPromise===promise){kfGameReloadPromise=null;kfGameReloadId=null;}}
}
// Stop repeating network and visual work in background; Realtime stays connected.
document.addEventListener("visibilitychange", function(){
  kfSetClockDisplayVisibility();
  startTournTick();
  kfRefreshGamePolling();
  kfUpdateQueuePollVisibility();
  kfStartChampionRefresh();
  if(document.hidden){
    if(kfClockSyncTimer){clearInterval(kfClockSyncTimer);kfClockSyncTimer=null;}
    if(gfsNameMarqueeTimer){clearInterval(gfsNameMarqueeTimer);gfsNameMarqueeTimer=null;}
    return;
  }
  startFullscreenNameMarquee();
  if(!navigator.onLine)return;
  if(onlineGameId){
    reloadGameState(onlineGameId);
    kfStartClockSync(onlineGameId);
  }
  if(kfQueueSearching)pollQueue();
  // Refresh cached tournament data once, then check for an assigned match.
  window._lastTournRefresh=Date.now();
  (currentUser ? kfRecoverTournamentMatch() : loadTournamentState(false,true))
    .catch(function(err){console.warn("Tournament resume refresh failed:",err);});
  loadFeatureFlags();
  loadChampion();
});
async function handleTournamentTimeout(loserColor){
  await handleOnlineTimeout(loserColor);
}

async function getCurrentProfile(){
  if(!sb) return null;
  var res = await sb.auth.getUser();
  var user = res.data && res.data.user ? res.data.user : null;
  currentUser = user;
  if(!user){kfStopTournamentMatchNotices();return null;}
  kfStartTournamentMatchNotices(user.id);
  var statsRes = await sb.from("kf_player_stats").select("*").eq("user_id", user.id).maybeSingle();
  var stats = statsRes.data;
  var uname = (user.user_metadata && user.user_metadata.username) || (user.email ? user.email.split("@")[0] : "Player");
  var avatar = (user.user_metadata && user.user_metadata.avatar_url) || null;
  return {
    id: user.id,
    username: uname,
    avatar_url: avatar,
    wins: stats && stats.wins !== undefined ? stats.wins : 0,
    tournament_wins: stats && stats.tournament_wins !== undefined ? stats.tournament_wins : 0,
    humiliation_losses: stats && stats.humiliation_losses !== undefined ? stats.humiliation_losses : 0
  };
}

function kfUpdateQueuePollVisibility(){
  if(queuePoll){clearInterval(queuePoll);queuePoll=null;}
  if(!kfQueueSearching||document.hidden)return;
  queuePoll=setInterval(function(){if(!document.hidden)pollQueue();},1800);
}
function kfStartQueuePoll(){
  kfQueueSearching=true;
  kfUpdateQueuePollVisibility();
}
async function stopQueuePoll(){
  kfQueueSearching=false;
  if(queuePoll){ clearInterval(queuePoll); queuePoll = null; }
  if(queueTimeout){ clearTimeout(queueTimeout); queueTimeout = null; }
}

async function leaveOnlineState(){
  computerMode = false;
  computerBusy = false;
  if(computerTimer){ clearTimeout(computerTimer); computerTimer = null; }
  await stopQueuePoll();
  stopGamePolling();
  kfStopGameBroadcast(); if(gameChannel && sb){ sb.removeChannel(gameChannel); gameChannel = null; }
  onlineGameId = null;
  kfDeferredGameRow=null;
  onlineGame=null;submittingMove=false;
  kfPendingClockMove=false;kfClockBeforeMove=null;
  kfRunningClockBlend=null;
  if(kfClockSyncTimer){clearInterval(kfClockSyncTimer);kfClockSyncTimer=null;}
  tournActiveMatch = null;
  document.body.classList.remove("online", "computer-mode", "game-focus");
  hideCelebration();
  exitFullscreenGame();
  $("gameClockLabel").textContent = "KINGSFALL · 5 MIN";
  $("new").disabled = false;
  $("undo").disabled = !(game && game.history().length);
  setQuickState("5-minute game · Match by wins");
  setBloodbladeState("Blood Tributes · mandatory sacrifice");
  renderPlayers(null);
}
  async function pollQueue(){
  if(!sb || !currentUser) return;
  var res = await sb.from("kf_match_queue")
    .select("status,game_id,is_roulette,is_bloodblade")
    .eq("user_id", currentUser.id)
    .eq("is_roulette", pendingQueueIsRoulette)
    .eq("is_bloodblade", pendingQueueIsBloodblade)
    .order("queued_at", {ascending: false})
    .limit(1)
    .maybeSingle();
  if(res.error) return;
  var data = res.data;
  if(data && data.status === "matched" && data.game_id){
    await stopQueuePoll();
    currentGameIsRoulette = !!data.is_roulette;
    await loadOnlineGame(data.game_id);
  }
}
/* ===== VS ANIMATION ===== */
function showVsAnimation(myName, myAvatar, oppName, oppAvatar) {
  return new Promise(function(resolve) {
    var overlay = $("vsOverlay");
    var leftP = overlay.querySelector(".vs-player.left");
    var rightP = overlay.querySelector(".vs-player.right");

    // تنظیم عکس و اسم‌ها
    $("vsAvatarMe").src = myAvatar || defaultAvatar();
    $("vsNameMe").textContent = myName || "You";
    $("vsAvatarOpp").src = oppAvatar || defaultAvatar();
    $("vsNameOpp").textContent = oppName || "Opponent";

    // ریست کردن انیمیشن
    leftP.classList.remove("active");
    rightP.classList.remove("active");
    
    // نمایش صفحه
    overlay.classList.add("show");

    // شروع انیمیشن (بعد از 100 میلی‌ثانیه)
    setTimeout(function() {
      leftP.classList.add("active");
      rightP.classList.add("active");
    }, 100);

    // پایان انیمیشن و بستن صفحه (بعد از 2.5 ثانیه)
    setTimeout(function() {
      overlay.classList.remove("show");
      setTimeout(resolve, 400); // 400 میلی‌ثانیه صبر میکنیم تا محو بشه، بعد بازی شروع بشه
    }, 2500);
  });
  }
function kfRefreshGamePolling(){
  var needsFallback = !document.hidden && kfGamePollingEnabled && sb && onlineGameId &&
    onlineGame && onlineGame.status === "active" &&
    !kfGamePostgresConnected && !kfGameBroadcastConnected;
  if(!needsFallback){
    if(onlineGamePolling){clearInterval(onlineGamePolling);onlineGamePolling=null;}
    return;
  }
  if(onlineGamePolling)return;
  // No REST polling while either Realtime feed is subscribed.
  // Only a total Realtime outage enables the 3-second recovery interval.
  onlineGamePolling=setInterval(function(){
    if(!kfGamePollingEnabled || kfGamePostgresConnected || kfGameBroadcastConnected ||
       document.hidden || !navigator.onLine || !onlineGameId || !onlineGame ||
       onlineGame.status!=="active" || submittingMove || kfPendingClockMove ||
       clockExpired || kfGamePollBusy)return;
    kfGamePollBusy=true;
    syncGameState(onlineGameId).finally(function(){kfGamePollBusy=false;});
  },3000);
}
function startGamePolling(){
  kfGamePollingEnabled=true;
  kfGamePostgresConnected=false;
  kfGameBroadcastConnected=false;
  kfRefreshGamePolling();
}
function stopGamePolling(){
  kfGamePollingEnabled=false;
  if(onlineGamePolling){clearInterval(onlineGamePolling);onlineGamePolling=null;}
}
  
async function loadOnlineGame(id, skipIntro){
  if(!sb) return;
  var res = await sb.from("kf_games").select("*").eq("id", id).maybeSingle();
  if(res.error || !res.data){
    say(res.error ? res.error.message : "Could not load the matched game.", {error: true});
    return;
  }
  var data = res.data;
  kfRouletteDeferredGameRow = null;
  if(currentGameIsRoulette) rouletteOpeningAnimating = true;
  await stopQueuePoll();
  // Skip the VS screen and game room when the initial authoritative read
  // says the game ended before this player arrived.
  if(data.status === "completed" || data.status === "cancelled"){
    rouletteOpeningAnimating = false;
    // Do not interfere with a different game that is still in progress.
    if(!onlineGameId || onlineGameId === id || !onlineGame || onlineGame.status !== "active"){
      stopGamePolling();
      onlineGameId = null; onlineGame = null;
      kfStopGameBroadcast();
      if(gameChannel && sb){sb.removeChannel(gameChannel);gameChannel=null;}
      hideCelebration();
      exitFullscreenGame();
      document.body.classList.remove("online", "computer-mode", "game-focus");
      $("new").disabled = false;
      resetQueueUI();
      setTimeout(loadHistory, 300);
    }
    say("Game already finished. Back to Home.", {silentToast:true});
    return;
  }
  // مراسم شروع فقط برای ورود اولیه به بازی اجرا می‌شود؛ بازیابی اتصال نباید آن را تکرار کند.
  if(!skipIntro){
    var myIsWhite = (data.white_id === currentUser.id);
    var myName = myIsWhite ? data.white_username : data.black_username;
    var myAvatar = myIsWhite ? data.white_avatar : data.black_avatar;
    var oppName = myIsWhite ? data.black_username : data.white_username;
    var oppAvatar = myIsWhite ? data.black_avatar : data.white_avatar;
    await showVsAnimation(myName, myAvatar, oppName, oppAvatar);
  } else {
    var oldOverlay = $("vsOverlay");
    if(oldOverlay) oldOverlay.classList.remove("show");
  }
  kfStopGameBroadcast(); if(gameChannel) sb.removeChannel(gameChannel);
  onlineGameId = id;
  onlineGame = data;
  startGamePolling();
  resetClocks();
  kfStartClockSync(id);
  lastClockAt = Date.now();
  humilApplied = false;
  humilChosenType = null;
  humilSelecting = false;
  document.body.classList.remove("computer-mode");
  document.body.classList.add("online");
  enterFullscreenGame(data);
  humilSelecting=!!data.is_bloodblade&&!humilApplied;
  renderPlayers(data);
  if(game && game.fen() !== data.fen) game.load(data.fen);
  selected = null;
  targets = [];
  last = data.last_move || null;
  draw();
  updateHumilBadge();
  updateFirstMoveDeadlineUI();
  var normalGameChannel = sb.channel("kf-game-" + id)
    .on("postgres_changes", {event:"UPDATE", schema:"public", table:"kf_games", filter:"id=eq." + id}, function(payload){
      if(payload.new && payload.new.id === onlineGameId) kfReceivePostgresGameRow(payload.new);
    });
  gameChannel = normalGameChannel;
  normalGameChannel.subscribe(function(status){
    if(gameChannel!==normalGameChannel||onlineGameId!==id)return;
    kfGamePostgresConnected=(status==="SUBSCRIBED");
    kfRefreshGamePolling();
    if(status==="CHANNEL_ERROR" || status==="TIMED_OUT" || status==="CLOSED"){
      console.warn("Game channel issue:",status);
      kfScheduleGameStateRecovery(id);
    }
  });
kfStartGameBroadcast(id,data);
if(currentGameIsRoulette){
  // Roulette is server-authoritative: both players receive the same stored line.
  // Keep realtime snapshots and the normal clock-start fallback paused while
  // the opening is being shown move by move.
  rouletteOpeningAnimating = true;

  var openingRes = await sb.rpc("kf_apply_roulette_opening", {
    p_game_id: id
  });

  if(openingRes.error){
    rouletteOpeningAnimating = false;
    throw openingRes.error;
  }

  var openingData = openingRes.data;
  if(!openingData || openingData.success !== true ||
     !Array.isArray(openingData.moves) || openingData.moves.length < 3 ||
     !openingData.roulette_line){
    rouletteOpeningAnimating = false;
    throw new Error("Could not load the Roulette opening from the server.");
  }

  var opening = {
    name: openingData.roulette_line,
    moves: openingData.moves
  };

  // All clients use the same server-issued timeline. No player readiness
  // signal or client-side completion can start or delay the game clock.
  var serverNowMs = Date.parse(openingData.server_now);
  var clockStartMs = Date.parse(openingData.clock_started_at);
  if(!Number.isFinite(clockStartMs)){
    rouletteOpeningAnimating = false;
    throw new Error("The server did not provide a valid Roulette clock start time.");
  }
  var serverOffsetMs = Number.isFinite(serverNowMs) ? serverNowMs - Date.now() : 0;
  rouletteServerClockOffsetMs = serverOffsetMs;
  kfServerOffsetMs=serverOffsetMs;
  kfServerOffsetKnown=Number.isFinite(serverNowMs);
  var openingStartMs = clockStartMs - (4800 + opening.moves.length * 800);

  if(onlineGame){
    onlineGame.clock_started_at = openingData.clock_started_at;
    onlineGame.last_move_at = openingData.last_move_at || openingData.clock_started_at;
    onlineGame.white_time_left = 300;
    onlineGame.black_time_left = 300;
  }
  clockWhite = 300;
  clockBlack = 300;
  clockPerfBaseWhite = 300;
  clockPerfBaseBlack = 300;
  clockPerfTurn = openingData.turn || "w";
  anchorClockToServerTime(openingData.last_move_at || openingData.clock_started_at);
  lastClockAt = Date.now();
  clockExpired = false;
  paintClocks();
  updateFirstMoveDeadlineUI();

  // The Jackpot names also come from the active database catalogue.
  await spinJackpot(opening, openingData.opening_names || [], openingStartMs, serverOffsetMs);

  // Animate every SAN ply individually at its absolute server-scheduled time.
  try{
    await applyRouletteOpening(opening, openingStartMs + 4800, serverOffsetMs);
  }catch(animationError){
    rouletteOpeningAnimating = false;
    throw animationError;
  }

  // No finish/ready RPC: the server's precomputed clock_started_at is final.
  // A full, newer Realtime snapshot can make the final REST fetch redundant.
  // The plain opening snapshot is NOT sufficient: a player may already have
  // moved when the animation ends. Keep the server fetch as a safe fallback.
  var rouletteLatest = kfRouletteDeferredGameRow;
  kfRouletteDeferredGameRow = null;
  var rouletteRealtimeBoard = null;
  var rouletteOpeningMoveAt = Date.parse(openingData.last_move_at || openingData.clock_started_at);
  if(rouletteLatest && rouletteLatest.id === id &&
     (kfGamePostgresConnected || kfGameBroadcastConnected) &&
     rouletteLatest.clock_started_at === openingData.clock_started_at &&
     typeof rouletteLatest.pgn === "string" &&
     typeof rouletteLatest.fen === "string" &&
     rouletteLatest.pgn.indexOf(openingData.pgn) === 0 &&
     Date.parse(rouletteLatest.last_move_at) > rouletteOpeningMoveAt){
    try{
      var freshBoard = new Chess();
      if(freshBoard.load_pgn(rouletteLatest.pgn) &&
         freshBoard.fen() === rouletteLatest.fen)
        rouletteRealtimeBoard = freshBoard;
    }catch(ignoreRealtimePosition){}
  }
  if(rouletteRealtimeBoard){
    data = rouletteLatest;
  }else{
    var latestRes = await sb.from("kf_games")
      .select("*")
      .eq("id", id)
      .single();
    if(latestRes.error){
      rouletteOpeningAnimating = false;
      throw latestRes.error;
    }
    data = latestRes.data;
  }
  onlineGame = data;
  if(!game) game = new Chess();
  var openingLoaded = game.load_pgn(data.pgn);
  if(!openingLoaded || game.fen() !== data.fen){
    rouletteOpeningAnimating = false;
    throw new Error("Roulette opening position mismatch.");
  }

  last = data.last_move || null;
  selected = null;
  targets = [];
  clockWhite = Number(data.white_time_left != null ? data.white_time_left : 300);
  clockBlack = Number(data.black_time_left != null ? data.black_time_left : 300);
  clockPerfBaseWhite = clockWhite;
  clockPerfBaseBlack = clockBlack;
  clockPerfTurn = data.turn || "w";
  anchorClockToServerTime(data.last_move_at || data.clock_started_at);
  lastClockAt = Date.now();
  clockExpired = false;

  renderPlayers(data);
  paintClocks();
  updateHumilBadge();
  draw();
  rouletteOpeningAnimating = false;
  updateFirstMoveDeadlineUI();
  say("🎰 Opening: " + opening.name, {silentToast: true});
}
}

// The newest realtime snapshot may arrive before our previous RPC completes.
// Keep it instead of discarding it and waiting for another network fetch.
var kfDeferredGameRow=null;
function kfDrainDeferredGameRow(){
  var row=kfDeferredGameRow;
  kfDeferredGameRow=null;
  if(row && row.id===onlineGameId && !submittingMove && !kfPendingClockMove)
    applyOnlineGame(row);
}
function applyOnlineGame(row){
  if(!row || row.id !== onlineGameId) return;
  // The opening animation must not be interrupted by incoming game updates.
  // Cache the newest full server row for reconciliation at animation end.
  if(rouletteOpeningAnimating){
    if(row.fen && typeof row.pgn === "string" && row.clock_started_at){
      var oldRow = kfRouletteDeferredGameRow;
      var oldAt = oldRow && oldRow.updated_at ? Date.parse(oldRow.updated_at) : 0;
      var newAt = row.updated_at ? Date.parse(row.updated_at) : 0;
      if(!oldRow || newAt >= oldAt) kfRouletteDeferredGameRow = row;
    }
    return;
  }
  // Never replace an in-flight optimistic board. Process the newest update
  // as soon as the RPC ends instead of waiting for the next polling cycle.
  if(submittingMove || kfPendingClockMove){
    var pendingAt=kfDeferredGameRow&&kfDeferredGameRow.last_move_at?
      Date.parse(kfDeferredGameRow.last_move_at):0;
    var incomingAt=row.last_move_at?Date.parse(row.last_move_at):0;
    if(!kfDeferredGameRow || incomingAt>=pendingAt)kfDeferredGameRow=row;
    return;
  }

  // Realtime events can arrive out of order; never apply an older move snapshot.
  var incomingMoveTime = row.last_move_at ? Date.parse(row.last_move_at) : 0;
  var currentMoveTime = onlineGame && onlineGame.last_move_at ? Date.parse(onlineGame.last_move_at) : 0;
  if(incomingMoveTime && currentMoveTime && incomingMoveTime < currentMoveTime) return;

  var prevHumilW = onlineGame ? onlineGame.white_handicap : null;
  var prevHumilB = onlineGame ? onlineGame.black_handicap : null;
  var prevLastMove = onlineGame ? onlineGame.last_move : null;
  var prevLastMoveAt = onlineGame ? onlineGame.last_move_at : null;
  var prevClockStartedAt = onlineGame ? onlineGame.clock_started_at : null;
  var prevConfirmedFen = onlineGame ? onlineGame.fen : null;
  // Preserve the previous turn before applying the newer server snapshot.
  var prevClockTurn = onlineGame ? onlineGame.turn : clockPerfTurn;
  // Keep the received server snapshot independent of local optimistic turns.
  onlineGame = Object.assign({},row);
  if(kfPremoveGameId&&kfPremoveGameId!==row.id)kfMultiReset();
  if(row.status!=="active")kfMultiReset();
  kfPremoveGameId=row.id;
  // Paint only after applying the latest board and clock snapshot.

  /* Clock update: only when new move arrives */
var hasNewMove = false;
if(row.last_move && (!prevLastMove ||
   prevLastMove.from !== row.last_move.from ||
   prevLastMove.to !== row.last_move.to ||
   (row.last_move_at && row.last_move_at !== prevLastMoveAt))){
  hasNewMove = true;
}

if(hasNewMove || row.clock_started_at !== prevClockStartedAt || (row.turn && row.turn !== clockPerfTurn)){
  // Rebase from the authoritative snapshot using monotonic time so the display
  // does not jump when the device wall clock or a delayed realtime event changes.
  var beforeTurn=prevClockTurn||clockPerfTurn;
  var beforeShown=beforeTurn==="w"?clockWhite:clockBlack;
  if(row.white_time_left != null) clockWhite = Number(row.white_time_left);
  if(row.black_time_left != null) clockBlack = Number(row.black_time_left);
  clockPerfBaseWhite = clockWhite;
  clockPerfBaseBlack = clockBlack;
  clockPerfTurn = row.turn || "w";
  anchorClockToServerTime(row.last_move_at || row.clock_started_at);
  kfBlendClockAfterRebase(beforeTurn,beforeShown);
  lastClockAt = Date.now();
  clockExpired = false;
}
  /* Apply the incoming opponent move to the existing chess.js board
   when possible. This preserves history without reparsing the entire PGN. */
var kfBoardNeedsDraw=false;
if(game && row.fen && game.fen()!==row.fen){
  try{
    var kfLoaded=false;
    // The local game may already contain our just-submitted move. Try the
    // incoming one-move delta from that position and verify the resulting FEN.
    // If it doesn't match, undo and safely fall back to the server snapshot.
    if(row.last_move && row.last_move.from && row.last_move.to){
      var kfDelta=null;
      try{
        kfDelta=game.move({
          from:row.last_move.from,
          to:row.last_move.to,
          promotion:row.last_move.promotion||"q"
        });
      }catch(ignore){}
      if(kfDelta){
        if(game.fen()===row.fen) kfLoaded=true;
        else game.undo();
      }
    }
    if(!kfLoaded && row.pgn && row.pgn.length){
      kfLoaded=!!game.load_pgn(row.pgn)&&game.fen()===row.fen;
    }
    if(!kfLoaded || game.fen()!==row.fen)game.load(row.fen);
    last=row.last_move||null;
    // Incoming rapid opponent moves must not discard an already selected
    // friendly piece. Recalculate its legal destinations against the newly
    // confirmed board; never submit a move from a stale position.
    var kfOwnColor=currentUser&&row.white_id===currentUser.id?"w":
      currentUser&&row.black_id===currentUser.id?"b":null;
    var kfSelectionToKeep=selected||kfPremoveSelected;
    selected=null;
    targets=[];
    if(kfSelectionToKeep&&kfOwnColor&&row.status==="active"){
      var kfKeptPiece=game.get(kfSelectionToKeep);
      if(kfKeptPiece&&kfKeptPiece.color===kfOwnColor){
        if(game.turn()===kfOwnColor){
          selected=kfSelectionToKeep;
          kfPremoveSelected=null;
          targets=game.moves({square:selected,verbose:true});
        }else{
          kfPremoveSelected=kfSelectionToKeep;
        }
      }else{
        kfPremoveSelected=null;
      }
    }
    kfBoardNeedsDraw=true;
  }catch(e){
    say("Received an invalid game position.",{error:true});
  }
}

// A rejected premove still needs a repaint of the authoritative position.
var kfHadPremove=!!(kfPremoveQueued && row.status==="active" &&
  currentUser && row.turn===(row.white_id===currentUser.id?"w":"b"));
var kfServerCommittedPremove=!!(kfPremoveQueued&&currentUser&&
  row.id===kfPremoveGameId&&row.last_move&&
  row.last_move.from===kfPremoveQueued.from&&
  row.last_move.to===kfPremoveQueued.to&&
  row.turn!==(row.white_id===currentUser.id?"w":"b")&&
  kfPremoveQueued.expectedFen&&row.fen!==kfPremoveQueued.expectedFen);
if(!kfServerCommittedPremove&&kfPremoveQueued&&
   row.fen!==kfPremoveQueued.expectedFen&&
   kfMultiConfirmedInHistory(row,kfPremoveQueued))
  kfServerCommittedPremove=true;
if(kfServerCommittedPremove)kfMultiAdvance(row);
// One server snapshot may contain two or more confirmed moves. Consume all
// matching queued actions without resubmitting any of them from the browser.
while(kfPremoveQueued&&kfPremoveQueued.expectedFen&&
      kfMultiConfirmedInHistory(row,kfPremoveQueued)){
  kfMultiAdvance(row);
}
// If the queue was accepted by PostgreSQL, do not race the same move
// through the old browser RPC when an intermediate opponent snapshot arrives.
var kfPremoveExecuted=false;
if(kfHadPremove && kfPremoveQueued && kfPremoveQueued.serverReady){
  // Realtime may deliver the opponent's intermediate update while the DB
  // trigger is still committing our premove. Verify the final server row
  // rather than incorrectly discarding the remaining premove queue.
  var pendingPm=kfPremoveQueued, pendingGameId=row.id;
  if(!pendingPm.reconciling){
    pendingPm.reconciling=true;
    sb.from("kf_games").select("*").eq("id",pendingGameId).maybeSingle()
      .then(function(res){
        pendingPm.reconciling=false;
        if(pendingGameId!==onlineGameId||kfPremoveQueued!==pendingPm)return;
        if(res.error||!res.data)return;
        if(res.data.turn!==(res.data.white_id===currentUser.id?"w":"b")){
          applyOnlineGame(res.data);
        }else{
          kfMultiReset();kfPremoveQueueSerial++;draw();
        }
      }).catch(function(){pendingPm.reconciling=false;});
  }
}
kfMultiArm(row);
// If realtime skipped the previous confirmed premove *and* the opponent
// already replied, the next planned action is now an ordinary turn move.
if(kfMultiPremovePending&&row.status==="active"&&currentUser&&
   row.turn===(row.white_id===currentUser.id?"w":"b")&&
   kfMultiPremoveQueue.length&&!submittingMove&&!kfPendingClockMove){
  kfMultiPremovePending=false;
  // PostgreSQL is the only premove executor. Re-arm for the next turn.
  kfPremoveQueued=kfMultiPremoveQueue[0];
  kfMultiPremovePending=true;
}
if(!kfPremoveExecuted &&
   (kfBoardNeedsDraw || (row.last_move_at!==prevLastMoveAt && game && row.fen===game.fen())))
  draw();

if(kfBoardNeedsDraw && hasNewMove && prevConfirmedFen && row.fen !== prevConfirmedFen)
  kfPlayPieceTap(kfDelta && kfDelta.after === row.fen ? kfDelta : row.last_move);

// Keep the realtime-to-premove critical path free of nonessential UI writes.
  /* Humiliation badge for opponent */
  var oppHadHcp = (fsPlayerColor === "w" && isValidHcp(row.black_handicap))
               || (fsPlayerColor === "b" && isValidHcp(row.white_handicap));
  var btCaption = row.is_bloodblade ? "BLOOD TRIBUTES" : "HUMILIATION";
  var topHumilText = $("gfsTopHumil").querySelector("span:last-child");
  var botHumilText = $("gfsBotHumil").querySelector("span:last-child");
  if(topHumilText) topHumilText.textContent = btCaption;
  if(botHumilText) botHumilText.textContent = btCaption;
  ["gfsTopHumil","gfsBotHumil"].forEach(function(id){ $(id).classList.toggle("blood-tributes", !!row.is_bloodblade); });
  $("gfsTopHumil").classList.toggle("roulette-hidden", !!row.is_roulette);
  $("gfsTopHumil").hidden = !!row.is_roulette || !oppHadHcp;

paintClocks();
renderPlayers(row);
  updateHumilBadge();

  updateFirstMoveDeadlineUI();
  if(row.is_tournament && row.white_joined_at && row.black_joined_at && row.clock_started_at && !window._kfClockSyncedAt){
    window._kfClockSyncedAt = true;
    lastClockAt = Date.now();
  }

  /* CORRECTION 2 — فقط handicap خودم باعث فعال شدن badge میشه. (FEN از سمت حریف خودش مهره رو حذف کرده) */
if(prevHumilW !== row.white_handicap || prevHumilB !== row.black_handicap){
  var myHcp = (fsPlayerColor === "w" && isValidHcp(row.white_handicap))
           || (fsPlayerColor === "b" && isValidHcp(row.black_handicap));
  if(myHcp && !humilApplied){
    humilApplied = true;
    humilSelecting = false;
    updateHumilBadge();
  }
}

  /* Draw offers are unavailable in tournament games. */
if(row.is_tournament){
  $("gfsDrawBtn").hidden = true;
  if($("drawOfferDialog").open) $("drawOfferDialog").close();
  if($("drawConfirmDialog").open) $("drawConfirmDialog").close();
} else {
  $("gfsDrawBtn").hidden = false;
  if(row.draw_offer_by && row.draw_offer_by !== currentUser.id && row.draw_offer_status === "pending" && !$("drawOfferDialog").open){
    $("drawOfferDialog").show();
  }
  // Close a stale offer dialog when an offer is cleared.
  if(!row.draw_offer_by && $("drawOfferDialog").open){
    $("drawOfferDialog").close();
  }
  if(row.draw_offer_status === "declined" && onlineGame && onlineGame.draw_offer_by === currentUser.id){
    say("Your draw offer was declined.", {silentToast: true});
  }
  $("gfsDrawBtn").disabled = !!row.draw_offer_by;
}

  /* Rematch — FIX: check expires_at and auto-close expired dialogs */
  if(row.rematch_status === "pending" && row.rematch_requested_by && row.rematch_requested_by !== currentUser.id){
    var expired = false;
    if(row.rematch_expires_at){
      if(Date.now() > new Date(row.rematch_expires_at).getTime()) expired = true;
    }
    if(expired){
      if($("rematchDialog").open) $("rematchDialog").close();
      rematchDialogShown = false;
      say("Rematch request expired.", {silentToast: true});
    } else if(!rematchDialogShown && !$("rematchDialog").open){
      rematchDialogShown = true;
      hideCelebration();
      setTimeout(function(){
        if(!$("rematchDialog").open) $("rematchDialog").showModal();
      }, 100);
      say("🏆 Opponent wants a rematch!", {silentToast: true});
    }
  }
  if(row.rematch_status === "accepted" && row.rematch_game_id && !_rematchAccepting){
    var newId = row.rematch_game_id;
    kfStopGameBroadcast(); if(gameChannel && sb){ sb.removeChannel(gameChannel); gameChannel = null; }
    hideCelebration();
    exitFullscreenGame();
    document.body.classList.remove("online", "computer-mode", "game-focus");
    currentGameIsRoulette = false;
    setTimeout(function(){ loadOnlineGame(newId); }, 200);
    return;
  }
  if(row.rematch_status === "declined" && onlineGame && onlineGame.rematch_requested_by === currentUser.id){
    say("Opponent declined the rematch.", {silentToast: true});
    updateRematchButton();
  }

  /* Quick Play cancelled: show Celebration without a winner or stats. */
  if(row.status === "cancelled" && !row.is_tournament){
    if(!$("celebrationScreen").classList.contains("show")) handleQuickPlayCancelled();
    return;
  }

  /* Game completed */
  if(row.status === "completed"){
    /* Completion scoring and tournament progression happen in database triggers. */
    if(!celebTimer){
      if(row.is_tournament) handleTournamentEnd(row);
      else handleQuickPlayEnd(row);
    }
  }
  }
function tickClock(){
  if(computerMode || !game || (game.game_over() && !kfPendingClockMove) || clockExpired){ paintClocks(); return; }
  if(!onlineGameId || !onlineGame || onlineGame.status !== "active"){ paintClocks(); return; }

  // During a pending local move, the client already has a provisional
  // next-turn monotonic anchor. Keep its clock visibly counting instead
  // of freezing both displays while the server validates the move.
  // Timeout claims remain disabled for unconfirmed moves below.

  // The server clock starts at clock_started_at, independently of player
  // page-entry timestamps and the visual VS/board transition. Never pause the
  // display here: anchor it to the authoritative server timestamp below.
  // Read the existing server clock anchor if the game row has not arrived yet.
  if(!onlineGame.clock_started_at){
    if(!clockStartPending && !clockReadySent && sb){
      clockStartPending = true;
      clockReadySent = true;
      sb.rpc("kf_start_game_clock", {p_game_id: onlineGameId}).then(function(r){
        clockStartPending = false;
        if(r && !r.error && r.data){
          if(r.data.clock_started_at) onlineGame.clock_started_at = r.data.clock_started_at;
          if(r.data.white_time_left != null) clockWhite = Number(r.data.white_time_left);
          if(r.data.black_time_left != null) clockBlack = Number(r.data.black_time_left);
          clockPerfBaseWhite = clockWhite;
          clockPerfBaseBlack = clockBlack;
          clockPerfTurn = onlineGame.turn || "w";
          anchorClockToServerTime(onlineGame.last_move_at || r.data.clock_started_at);
          lastClockAt = Date.now();
        } else {
          clockReadySent = false;
          setTimeout(function(){ if(onlineGameId && onlineGame && !onlineGame.clock_started_at) clockReadySent = false; }, 2500);
        }
      }).catch(function(){
        clockStartPending = false; clockReadySent = false;
        setTimeout(function(){ if(onlineGameId && onlineGame && !onlineGame.clock_started_at) clockReadySent = false; }, 2500);
      });
    }
    paintClocks(); return;
  }

  // Use a monotonic timer between authoritative server snapshots. This keeps
  // the visible clock smooth and prevents jumps caused by Date.now() drift.
  if(clockPerfAnchor == null){
    var anchor = onlineGame.last_move_at || onlineGame.clock_started_at;
    if(!anchor){ paintClocks(); return; }
    var anchorMs = new Date(anchor).getTime();
    if(!Number.isFinite(anchorMs)){ paintClocks(); return; }
    clockPerfBaseWhite = Number(onlineGame.white_time_left != null ? onlineGame.white_time_left : 300);
    clockPerfBaseBlack = Number(onlineGame.black_time_left != null ? onlineGame.black_time_left : 300);
    clockPerfTurn = onlineGame.turn || "w";
    anchorClockToServerTime(anchor);
  }
  var elapsed = Math.max(0, (performance.now() - clockPerfAnchor) / 1000);
  var turn = onlineGame.turn || clockPerfTurn || "w";
  if(turn === "w"){
    clockWhite = Math.max(0, clockPerfBaseWhite - elapsed);
    var officialWhite=clockWhite;
    clockWhite=kfVisualRunningClock(performance.now(),{turn:"w",time:officialWhite});
    clockBlack = Math.max(0, clockPerfBaseBlack);
  } else {
    clockBlack = Math.max(0, clockPerfBaseBlack - elapsed);
    var officialBlack=clockBlack;
    clockBlack=kfVisualRunningClock(performance.now(),{turn:"b",time:officialBlack});
    clockWhite = Math.max(0, clockPerfBaseWhite);
  }

  // Never claim a timeout from the blended display; use server-aligned time.
  var trueRunning=kfAuthoritativeRunningClock(performance.now());
  if(trueRunning && trueRunning.time<=0 && !clockClaimPending && !kfPendingClockMove){
    clockExpired = true;
    var loser = trueRunning.turn==="w" ? "White" : "Black";
    say(loser + " ran out of time. Checking the official result…", {silentToast: true});
    if(onlineGameId) handleOnlineTimeout(loser);
  }
  paintClocks();
}

// The server clock continues; only the 250ms display timer pauses while hidden.
var kfClockDisplayTimer=null;
function kfSetClockDisplayVisibility(){
  if(kfClockDisplayTimer){clearInterval(kfClockDisplayTimer);kfClockDisplayTimer=null;}
  if(document.hidden)return;
  kfClockDisplayTimer=setInterval(tickClock,100);
}
kfSetClockDisplayVisibility();

/* ===== FIRST MOVE DEADLINE (UI only; database owns the deadline/result) ===== */
function updateFirstMoveDeadlineUI(){
  var normal = $("firstMoveDeadlineNormal");
  var fullscreen = $("firstMoveDeadlineFullscreen");
  if(!normal || !fullscreen) return;

  function hide(){ normal.hidden = true; fullscreen.hidden = true; }
  if(currentGameIsRoulette && rouletteOpeningAnimating){ hide(); return; }
  if(!onlineGame || onlineGame.status !== "active" || !currentUser){ hide(); return; }

  var isWhite = onlineGame.white_id === currentUser.id;
  var myTurn = isWhite ? "w" : "b";
  // The deadline banner belongs only to the player whose first move is currently due.
  if(onlineGame.turn !== myTurn){ hide(); return; }

  var firstMoveAt = isWhite ? onlineGame.white_first_move_at : onlineGame.black_first_move_at;
  if(firstMoveAt){ hide(); return; }

  // White's deadline starts with the server clock; Black's starts with White's first move.
  var anchor = isWhite ? onlineGame.clock_started_at : (onlineGame.white_first_move_at || onlineGame.last_move_at);
  if(!anchor){ hide(); return; }
  var anchorMs = new Date(anchor).getTime();
  if(!Number.isFinite(anchorMs)){ hide(); return; }

  // Share the game clock's server-calibrated monotonic anchor. The deadline
  // is independent of total game duration (3, 5, 10 minutes, etc.).
  // The same fractional-second boundary as fmtClock's Math.floor is used:
  // after any fraction of a second, both displayed counters drop by one.
  if(clockPerfAnchor == null || clockPerfTurn !== myTurn){ hide(); return; }
  var elapsed = Math.max(0, (performance.now() - clockPerfAnchor) / 1000);
  var remain = Math.max(0, 20 - Math.ceil(elapsed));
  normal.querySelector("strong").textContent = String(remain);
  fullscreen.querySelector("strong").textContent = String(remain);
  normal.hidden = false;
  fullscreen.hidden = false;
}

/* ===== START QUICK PLAY ===== */
async function startQuickPlay(){
  if(kfFeatureFlags.quick_play===false){say("Quick Play is temporarily disabled.",{info:true});return;}
  if(computerTimer){ clearTimeout(computerTimer); computerTimer = null; }
  computerMode = false;
  document.body.classList.remove("computer-mode");
  if(!sb){ say("Supabase is unavailable.", {error: true}); return; }
  var sess = await sb.auth.getSession();
  var session = sess.data && sess.data.session ? sess.data.session : null;
  if(!session){ openAuth("signin"); say("Sign in before using Quick Play.", {silentToast: true}); return; }
  currentUser = session.user;
  humilApplied = false;
  humilChosenType = null;
  humilSelecting = false;
  pendingQueueIsRoulette = false;
  pendingQueueIsBloodblade = false;
  currentGameIsRoulette = false;
  setQuickState("Finding an opponent · 5-minute game…", {lock: true, cancel: true});
  say("", {silentToast: true});
  try{
    var res = await sb.rpc("kf_join_quick_play");
    if(res.error) throw res.error;
    var data = res.data;
    if(data && data.status === "matched" && data.game_id){
      await loadOnlineGame(data.game_id);
    } else {
      setQuickState("Searching by closest win total · 5 min…", {lock: true, cancel: true});
      kfStartQueuePoll();
      queueTimeout = setTimeout(async function(){
        if(onlineGameId) return;
        await cancelQuickPlay();
        say("No opponents found — search timed out.", {silentToast: true});
      }, 120000);
      await pollQueue();
    }
  } catch(err){
    setQuickState("5-minute game · Match by wins");
    say("Quick Play error: " + (err.message || "Unknown error"), {error: true});
  }
}

async function cancelQuickPlay(){
  await stopQueuePoll();
  try{ if(sb) await sb.rpc("kf_cancel_quick_play"); } catch(e){}
  setQuickState("5-minute game · Match by wins");
  setRouletteState("Random opening · variable-length line auto-played");
  setBloodbladeState("Blood Tributes · mandatory sacrifice");
  say("Search cancelled.", {silentToast: true});
}

/* FIX: autoJoinChecked flag now resets on signOut */
var autoJoinChecked = false;

async function checkActiveGameAndJoin(){
  if(!sb || !currentUser) return;
  if(onlineGameId) return;
  if(computerMode) return;
  if(autoJoinChecked) return;
  autoJoinChecked = true;
  try{
    var savedGameId = null;
    try { savedGameId = sessionStorage.getItem("kf_reconnect_game_id"); } catch(e) {}
    if(savedGameId){
      var savedRes = await sb.from("kf_games").select("*").eq("id", savedGameId).maybeSingle();
      if(!savedRes.error && savedRes.data && savedRes.data.status === "active" &&
         (savedRes.data.white_id === currentUser.id || savedRes.data.black_id === currentUser.id)){
        if(savedRes.data.is_tournament && savedRes.data.tournament_match_id){
          var savedMatch = await sb.from("kf_tournament_matches").select("*").eq("id", savedRes.data.tournament_match_id).maybeSingle();
          if(!savedMatch.error && savedMatch.data) tournActiveMatch = savedMatch.data;
          try { sessionStorage.removeItem("kf_reconnect_game_id"); } catch(e) {}
          await joinTournamentGame(savedRes.data.id, true);
        } else {
          currentGameIsRoulette = !!savedRes.data.is_roulette;
          try { sessionStorage.removeItem("kf_reconnect_game_id"); } catch(e) {}
          await loadOnlineGame(savedRes.data.id, true);
        }
        return;
      }
      if(!savedRes.error && (!savedRes.data || savedRes.data.status !== "active")){
        try { sessionStorage.removeItem("kf_reconnect_game_id"); } catch(e) {}
      }
    }
    var res = await sb.from("kf_games")
      .select("*")
      .eq("status", "active")
      .or("white_id.eq." + currentUser.id + ",black_id.eq." + currentUser.id)
      .gt("created_at", new Date(Date.now() - 10*60*1000).toISOString())
      .order("created_at", {ascending: false})
      .limit(1)
      .maybeSingle();
    if(res.error || !res.data) return;
    var data = res.data;
    if(data.is_tournament && data.tournament_match_id){
      var mres = await sb.from("kf_tournament_matches").select("*").eq("id", data.tournament_match_id).maybeSingle();
      if(!mres.error && mres.data) tournActiveMatch = mres.data;
      await joinTournamentGame(data.id);
    } else {
      currentGameIsRoulette = !!data.is_roulette;
      await loadOnlineGame(data.id);
    }
  } catch(e){ console.warn("Auto-rejoin error:", e); }
  }
var gfsNameMarqueeTimer = null;
function runFullscreenNameMarquee(){
  ["gfsTopName","gfsBotName"].forEach(function(id){
    var box = $(id);
    if(!box) return;
    var label = box.querySelector(".gfs-name-marquee");
    if(!label){
      var initialText = box.textContent || "";
      box.textContent = "";
      label = document.createElement("span");
      label.className = "gfs-name-marquee";
      label.textContent = initialText;
      box.appendChild(label);
    }
    box.classList.remove("marquee-active");
    label.style.transform = "translateX(0)";
    box.style.removeProperty("--gfs-marquee-shift");
    box.style.removeProperty("--gfs-marquee-duration");
    if(label.scrollWidth <= box.clientWidth + 2) return;
    var distance = Math.ceil(label.scrollWidth - box.clientWidth + 12);
    var duration = Math.max(5, Math.min(16, distance / 32));
    box.style.setProperty("--gfs-marquee-shift", (-distance) + "px");
    box.style.setProperty("--gfs-marquee-duration", duration + "s");
    box.classList.add("marquee-active");
    label.onanimationend = function(){
      box.classList.remove("marquee-active");
      label.style.transform = "translateX(0)";
      label.onanimationend = null;
    };
  });
}
function startFullscreenNameMarquee(){
  if(gfsNameMarqueeTimer) clearInterval(gfsNameMarqueeTimer);
  if(!document.body.classList.contains("game-focus")||document.hidden) return;
  gfsNameMarqueeTimer = setInterval(runFullscreenNameMarquee, 30000);
}
function stopFullscreenNameMarquee(){
  if(gfsNameMarqueeTimer){ clearInterval(gfsNameMarqueeTimer); gfsNameMarqueeTimer = null; }
  ["gfsTopName","gfsBotName"].forEach(function(id){
    var box = $(id);
    if(!box) return;
    box.classList.remove("marquee-active");
    box.style.removeProperty("--gfs-marquee-shift");
    box.style.removeProperty("--gfs-marquee-duration");
  });
}

/* Visual-only tournament crest, relying exclusively on cached bracket/match data. */
function kfUpdateRoyalMatchBadges(row){
 var isTournament=!!(row&&row.is_tournament),isFinal=false;
 if(isTournament&&tournActiveMatch&&tournActiveMatch.id===row.tournament_match_id&&
    tournBracketRendered&&tournBracketRendered.id===tournActiveMatch.tournament_id){
   var size=Number(tournBracketRendered.bracket_size),round=Number(tournActiveMatch.round);
   if(Number.isFinite(size)&&size>=2&&Number.isFinite(round)){
     var rounds=1;
     while(Math.pow(2,rounds)<size)rounds++;
     isFinal=round===rounds;
   }
 }
 ["gfsTopMatchBadge","gfsBotMatchBadge"].forEach(function(id){
   var badge=$(id);
   if(!badge)return;
   badge.hidden=!isTournament;
   if(!isTournament)return;
   badge.textContent=isFinal?"👑":"🏆";
   badge.classList.toggle("is-final",isFinal);
   badge.title=isFinal?"Tournament final":"Tournament match";
   badge.setAttribute("aria-label",badge.title);
 });
}
  function enterFullscreenGame(row){
  document.body.classList.add("game-focus");
  kfUpdateRoyalMatchBadges(row);
  fsPlayerColor = (row.white_id === currentUser.id) ? "w" : "b";
  flipped = (fsPlayerColor === "b");
  _boardBuilt = false;
  var wrapEl = $("gfsBoardWrap");
  if(boardEl.parentNode !== wrapEl) wrapEl.appendChild(boardEl);

  var topIsBlack = fsPlayerColor === "w";
  var topName = topIsBlack ? row.black_username : row.white_username;
  var topAvatar = topIsBlack ? row.black_avatar : row.white_avatar;
  var botName = topIsBlack ? row.white_username : row.black_username;
  var botAvatar = topIsBlack ? row.white_avatar : row.black_avatar;

  $("gfsTopName").textContent = topName || "Opponent";
  $("gfsBotName").textContent = botName || "You";
  ["gfsTopName","gfsBotName"].forEach(function(id){
    var el = $(id);
    if(el){ el.textContent = el.textContent; }
  });

  var meHadHandicap = (fsPlayerColor === "w" && isValidHcp(row.white_handicap))
                   || (fsPlayerColor === "b" && isValidHcp(row.black_handicap));
  var oppHadHandicap = (fsPlayerColor === "w" && isValidHcp(row.black_handicap))
                    || (fsPlayerColor === "b" && isValidHcp(row.white_handicap));
  humilApplied = !!meHadHandicap;
  humilSelecting = false;
  var btCaption = row.is_bloodblade ? "BLOOD TRIBUTES" : "HUMILIATION";
  var topHumilText = $("gfsTopHumil").querySelector("span:last-child");
  var botHumilText = $("gfsBotHumil").querySelector("span:last-child");
  if(topHumilText) topHumilText.textContent = btCaption;
  if(botHumilText) botHumilText.textContent = btCaption;
  ["gfsTopHumil","gfsBotHumil"].forEach(function(id){ $(id).classList.toggle("blood-tributes", !!row.is_bloodblade); });
  $("gfsTopHumil").classList.toggle("roulette-hidden", !!row.is_roulette);
  $("gfsTopHumil").hidden = !!row.is_roulette || !oppHadHandicap;
  updateHumilBadge();

  $("gfsTopAvatar").src = topAvatar || defaultAvatar();
  $("gfsBotAvatar").src = botAvatar || defaultAvatar();
  $("gfsResignBtn").disabled = false;
  renderFullscreenStats();
  startFullscreenNameMarquee();
  draw();
}

var kfFullscreenStatsRequestId = 0;
async function renderFullscreenStats(){
  if(!currentUser || !onlineGame || !sb) return;
  var requestId = ++kfFullscreenStatsRequestId;
  var gameSnapshot = onlineGame;
  var userId = currentUser.id;
  var myIsWhite = (gameSnapshot.white_id === userId);
  var oppId = myIsWhite ? gameSnapshot.black_id : gameSnapshot.white_id;
  var myWins = 0, myTrophyWins = 0, oppWins = 0, oppTrophyWins = 0;
  function isCurrent(){
    return requestId === kfFullscreenStatsRequestId &&
      !!onlineGame && onlineGame.id === gameSnapshot.id &&
      !!currentUser && currentUser.id === userId &&
      document.body.classList.contains("game-focus");
  }
  try{
    // Read canonical stats from kf_player_stats, not stale/missing per-game fields.
    var myStatsRes = await sb.from("kf_player_stats").select("wins,tournament_wins").eq("user_id", userId).maybeSingle();
    if(myStatsRes.data){
      myWins = Number(myStatsRes.data.wins || 0);
      myTrophyWins = Number(myStatsRes.data.tournament_wins || 0);
    }
  } catch(e){ console.warn("Could not load own profile stats:", e); }
  if(!isCurrent()) return;

  if(oppId){
    try{
      var oppStatsRes = await sb.from("kf_player_stats").select("wins,tournament_wins").eq("user_id", oppId).maybeSingle();
      if(oppStatsRes.data){
        oppWins = Number(oppStatsRes.data.wins || 0);
        oppTrophyWins = Number(oppStatsRes.data.tournament_wins || 0);
      }
    } catch(e){ console.warn("Could not load opponent profile stats:", e); }
  }
  // Only the latest request for the visible game may update either stats panel.
  if(!isCurrent()) return;
  $("gfsBotStats").innerHTML = '<span class="gfs-stat">🏆 ' + fmtStat(myTrophyWins) + '</span><span class="gfs-stat" title="Crowns">👑 ' + fmtStat(myWins) + '</span>';
  $("gfsTopStats").innerHTML = '<span class="gfs-stat">🏆 ' + fmtStat(oppTrophyWins) + '</span><span class="gfs-stat" title="Crowns">👑 ' + fmtStat(oppWins) + '</span>';
}

function exitFullscreenGame(){
  stopFullscreenNameMarquee();
  document.body.classList.remove("game-focus");
  _boardBuilt = false;
  hideHumilBanner();
  window._kfClockSyncedAt = false;
  var panel = document.querySelector(".board-panel");
  if(panel && boardEl.parentNode !== panel){
    var labels = panel.querySelectorAll(".board-label");
    if(labels.length >= 2) panel.insertBefore(boardEl, labels[1]);
    else panel.appendChild(boardEl);
  }
}

/* ===== Draw offer — NEW: use modal instead of confirm() ===== */
$("gfsDrawBtn").onclick = function(){
  if(!sb || !onlineGameId || !onlineGame || !currentUser) return;
  if(onlineGame.is_tournament){ say("Draw offers are disabled in tournament games.", {silentToast: true}); return; }
  if(onlineGame.status === "completed"){ say("Game is already finished.", {silentToast: true}); return; }
  if(onlineGame.draw_offer_by === currentUser.id){ say("You already offered a draw.", {silentToast: true}); return; }
  $("drawConfirmDialog").showModal();
};
$("drawConfirmNo").onclick = function(){ $("drawConfirmDialog").close(); };
$("drawConfirmYes").onclick = async function(){
  $("drawConfirmDialog").close();
  if(!sb || !onlineGameId || !onlineGame || !currentUser) return;
  if(onlineGame.is_tournament){ say("Draw offers are disabled in tournament games.", {silentToast: true}); return; }
  
  // استفاده از تابع جدید دیتابیس برای کول‌داون
  var res = await sb.rpc("kf_offer_draw", { p_game_id: onlineGameId });
  
  if(res.error){ say("Could not send draw offer: " + res.error.message, {error: true}); return; }
  
  if(res.data.status === "cooldown"){
    say("Please wait " + Math.ceil(res.data.remaining) + " seconds before offering a draw again.", {silentToast: true});
    return;
  }
  if(res.data.status === "already_offered"){
    say("You already offered a draw.", {silentToast: true});
    return;
  }
  
  var upd = {draw_offer_by: currentUser.id, draw_offer_status: "pending"};
  onlineGame = Object.assign({}, onlineGame, upd);
  say("Draw offer sent. Waiting for opponent…", {silentToast: true});
};

async function respondDrawOffer(accept){
  if(!sb || !onlineGameId || !onlineGame || !currentUser) return;
  if(onlineGame.is_tournament){
    if($("drawOfferDialog").open) $("drawOfferDialog").close();
    say("Draw offers are disabled in tournament games.", {silentToast: true});
    return;
  }

  if(
    !onlineGame.draw_offer_by ||
    onlineGame.draw_offer_by === currentUser.id ||
    onlineGame.draw_offer_status !== "pending"
  ) return;

  var res = await sb.rpc("kf_respond_draw", {
    p_game_id: onlineGameId,
    p_accept: accept
  });

  if(res.error){
    say(
      (accept ? "Could not accept draw: " : "Could not decline draw: ") +
      res.error.message,
      {error: true}
    );
    return;
  }

  if(accept){
    var upd = {
      status: "completed",
      result: "1/2-1/2",
      winner_id: null,
      draw_offer_status: "accepted",
      completed_at: new Date().toISOString()
    };

    onlineGame = Object.assign({}, onlineGame, upd);
    applyOnlineGame(onlineGame);
  } else {
    onlineGame = Object.assign({}, onlineGame, {
      draw_offer_by: null,
      draw_offer_status: "declined"
    });

    say("Draw offer declined.", {silentToast: true});
  }

  if($("drawOfferDialog").open){
    $("drawOfferDialog").close();
  }
    }
$("drawAcceptBtn").onclick = function(){ respondDrawOffer(true); };
$("drawDeclineBtn").onclick = function(){ respondDrawOffer(false); };

/* ===== Resign — NEW: use modal instead of confirm() ===== */
var playerReportGameId=null;
$("gfsReportBtn").onclick=function(){
 if(!sb||!currentUser||!onlineGame||!onlineGameId||!["active","waiting"].includes(onlineGame.status)){
  say("Reports are available only during a match.",{silentToast:true});return;
 }
 var opp=onlineGame.white_id===currentUser.id?onlineGame.black_id:onlineGame.white_id;
 if(!opp){say("Opponent has not joined.",{silentToast:true});return;}
 playerReportGameId=onlineGameId;$("playerReportForm").reset();$("playerReportSubmit").disabled=false;$("playerReportDialog").showModal();
};
$("playerReportCancel").onclick=function(){$("playerReportDialog").close();};
$("playerReportForm").addEventListener("submit",async function(e){
 e.preventDefault();
 var selected=this.querySelector('input[name="playerReportReason"]:checked');
 if(!selected||!playerReportGameId||!sb)return;
 var btn=$("playerReportSubmit");btn.disabled=true;
 try{var result=await sb.rpc("kf_submit_player_report",{p_game_id:playerReportGameId,p_reason:selected.value});
 if(result.error)throw result.error;
 $("playerReportDialog").close();say("Report submitted for admin review.",{silentToast:true});}
 catch(err){say("Could not submit report: "+(err.message||err),{error:true});}
 finally{btn.disabled=false;}
});
$("gfsResignBtn").onclick = function(){
  if(!onlineGameId || !onlineGame) return;
  $("resignConfirmDialog").showModal();
};
$("resignConfirmNo").onclick = function(){ $("resignConfirmDialog").close(); };
$("resignConfirmYes").onclick = async function(){
  $("resignConfirmDialog").close();

  if(!onlineGameId || !onlineGame || !currentUser || !sb) return;

  var winnerId = onlineGame.white_id === currentUser.id
    ? onlineGame.black_id
    : onlineGame.white_id;

  var res = await sb.rpc("kf_resign_game", {
    p_game_id: onlineGameId
  });

  if(res.error){
    say("Could not resign: " + res.error.message, {error: true});
    return;
  }

  var upd = {
    status: "completed",
    winner_id: winnerId,
    result: winnerId === onlineGame.white_id ? "1-0" : "0-1",
    completed_at: new Date().toISOString()
  };

  onlineGame = Object.assign({}, onlineGame, upd);

  applyOnlineGame(onlineGame);
};
  /* ===== HUMILIATION ===== */
/* Use server PGN as a fallback if a local FEN reload cleared chess.js history. */
function humiliationMoveCount(){
  var count = 0;
  try {
    if(game) count = game.history({verbose:true}).length;
  } catch(e) {}
  var pgn = (onlineGame && onlineGame.pgn) ? String(onlineGame.pgn) : "";
  if(pgn){
    var cleaned = pgn
      .replace(/^\s*\[[^\]]*\]\s*$/gm, " ")
      .replace(/\{[^}]*\}/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\$\d+/g, " ")
      .replace(/\d+\.(?:\.\.)?/g, " ");
    var tokens = cleaned.split(/\s+/).filter(function(token){
      return token && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token);
    });
    count = Math.max(count, tokens.length);
  }
  return count;
}
function humiliationPlayerHasMoved(color){
  // The server timestamps are authoritative and independent for each player.
  // A move by the opponent must never consume this player's Humiliation eligibility.
  if(onlineGame){
    if(color === "w" && Object.prototype.hasOwnProperty.call(onlineGame, "white_first_move_at")){
      return onlineGame.white_first_move_at !== null && onlineGame.white_first_move_at !== undefined;
    }
    if(color === "b" && Object.prototype.hasOwnProperty.call(onlineGame, "black_first_move_at")){
      return onlineGame.black_first_move_at !== null && onlineGame.black_first_move_at !== undefined;
    }
  }
  // Compatibility fallback only when older game data omits the timestamp columns.
  try {
    if(game && game.history({verbose:true}).some(function(m){ return m.color === color; })) return true;
  } catch(e) {}
  var plies = humiliationMoveCount();
  return color === "w" ? plies >= 1 : plies >= 2;
}

function updateHumilBadge(){
  var badge = $("gfsBotHumil");
  if(!badge) return;
  badge.classList.toggle("blood-tributes", !!(onlineGame && onlineGame.is_bloodblade));
  var isRouletteGame = !!(currentGameIsRoulette || (onlineGame && onlineGame.is_roulette));
  badge.classList.toggle("roulette-hidden", isRouletteGame);
  if(isRouletteGame){
    badge.hidden = true;
    humilSelecting = false;
    return;
  }
  if(!game || !onlineGameId || !onlineGame) return;
  var iHaveMoved = humiliationPlayerHasMoved(fsPlayerColor);
  var canSacrifice = !humilApplied && !iHaveMoved;
  if(onlineGame.is_bloodblade&&canSacrifice)humilSelecting=true;
  if(humilApplied){
    badge.hidden = false;
    badge.classList.remove("inactive", "selecting");
  } else if(canSacrifice){
    badge.hidden = false;
    badge.classList.add("inactive");
    badge.classList.toggle("selecting", !!humilSelecting);
  } else {
    badge.hidden = true;
    badge.classList.remove("inactive", "selecting");
  }
}

function showHumilBanner(){ /* deprecated — nothing */ }
function hideHumilBanner(){ var b = $("humilBanner"); if(b) b.remove(); }

$("gfsBotHumil").onclick = function(){
  if(!onlineGameId || !game || humilApplied || currentGameIsRoulette || (onlineGame && onlineGame.is_roulette)) return;
  if(humiliationPlayerHasMoved(fsPlayerColor)){
    updateHumilBadge();
    return;
  }
  if(onlineGame && onlineGame.is_bloodblade){if(!humilSelecting)enterHumilSelection();return;}
  if(humilSelecting) exitHumilSelection();
  else enterHumilSelection();
};


function renderSacrificeScene(color, type){
  var el = $("sacrPiece");
  if(el) el.innerHTML = svg({color: color, type: type});
}

function isHumilEligiblePiece(sq){
  if(!game) return false;
  var p = game.get(sq);
  if(!p) return false;
  if(p.color !== fsPlayerColor) return false;
  if(p.type === "p" || p.type === "k") return false;
  var row = 8 - parseInt(sq.charAt(1), 10);
  var col = files.indexOf(sq.charAt(0));
  if(row < 0 || row > 7 || col < 0 || col > 7) return false;
  if(fsPlayerColor === "w" && row < 6) return false;
  if(fsPlayerColor === "b" && row > 1) return false;
  return true;
}

function enterHumilSelection(){
  if(!game || humilApplied || currentGameIsRoulette || (onlineGame && onlineGame.is_roulette)) return;
  
  // Allow sacrifice only before this player's first move.
  if (humiliationPlayerHasMoved(fsPlayerColor)) return;

  humilSelecting = true;
  updateHumilBadge();
  draw();
  say("Tap one of your pieces (Knight, Bishop, Rook, Queen) to sacrifice. Tap empty space to cancel.", {silentToast: true});
}

function exitHumilSelection(){
  humilSelecting = false;
  updateHumilBadge();
  draw();
}

/* FIX: applyHandicapToGame now ONLY used for OUR OWN sacrifice (local),
   never for opponent's — opponent's handicap is applied via their FEN.
   When `square` is passed, use it; otherwise fallback (first match of that type). */
function applyHandicapToGame(color, type, square){
  if(!game) return;
  if(square){
    var p = game.get(square);
    if(p && p.color === color && p.type === type){
      game.remove(square);
      last = null;
      selected = null;
      targets = [];
      draw();
      return;
    }
  }
  var board = game.board();
  for(var r=0;r<8;r++){
    for(var c=0;c<8;c++){
      var p2 = board[r][c];
      if(p2 && p2.color === color && p2.type === type){
        var sqName = files[c] + (8-r);
        game.remove(sqName);
        last = null;
        selected = null;
        targets = [];
        draw();
        return;
      }
    }
  }
}

/* Secure server-side Humiliation RPC: never update kf_games directly. */
async function submitHumiliation(square, type){
  if(currentGameIsRoulette || (onlineGame && onlineGame.is_roulette)) throw new Error("Humiliation is unavailable in Roulette.");
  if(!sb || !onlineGameId || !onlineGame || !currentUser || !square || !type) throw new Error("Game or piece selection is missing.");
  var res = await sb.rpc("kf_apply_humiliation", {p_game_id: onlineGameId, p_square: square});
  if(res.error) throw res.error;
  if(typeof res.data !== "string" || !res.data) throw new Error("Server did not return the updated board.");
  var field = onlineGame.white_id === currentUser.id ? "white_handicap" : "black_handicap";
  var upd = {fen: res.data}; upd[field] = type;
  if(!game.load(res.data)) throw new Error("The server returned an invalid board.");
  onlineGame = Object.assign({}, onlineGame, upd);
  humilApplied = true; humilSelecting = false; last = null; selected = null; targets = [];
  playHumiliationSound(); updateHumilBadge(); draw();
}

/* Legacy humilDialog (only if some code still calls it) */
function openHumilDialog(){
  if(currentGameIsRoulette || (onlineGame && onlineGame.is_roulette)) return;
  humilChosenType = null;
  document.querySelectorAll(".humil-piece").forEach(function(el){ el.classList.remove("selected"); });
  $("humilConfirm").disabled = true;
  $("humilMsg").textContent = "";
  var w = fsPlayerColor;
  $("hpPieceN").innerHTML = svg({color: w, type: "n"});
  $("hpPieceB").innerHTML = svg({color: w, type: "b"});
  $("hpPieceR").innerHTML = svg({color: w, type: "r"});
  $("hpPieceQ").innerHTML = svg({color: w, type: "q"});
  $("humilDialog").showModal();
}
$("humilCancel").onclick = function(){ $("humilDialog").close(); };
document.querySelectorAll(".humil-piece").forEach(function(el){
  el.onclick = function(){
    document.querySelectorAll(".humil-piece").forEach(function(x){ x.classList.remove("selected"); });
    el.classList.add("selected");
    humilChosenType = el.dataset.type;
    $("humilConfirm").disabled = false;
    $("humilMsg").textContent = "Selected: " + names[humilChosenType] + " (+" + el.dataset.reward + " wins)";
  };
});
$("humilConfirm").onclick = async function(){
  /* Legacy flow: pick piece type, remove first matching piece */
  if(!humilChosenType || !onlineGameId || !onlineGame) return;
  var board = game.board(), square = null;
  for(var r=0;r<8 && !square;r++) for(var c=0;c<8;c++){
    var piece = board[r][c];
    if(piece && piece.color === fsPlayerColor && piece.type === humilChosenType){ square = files[c] + (8-r); break; }
  }
  if(!square){ $("humilMsg").textContent = "No matching piece is available."; return; }
  try { await submitHumiliation(square, humilChosenType); }
  catch(err){ $("humilMsg").textContent = "Error: " + (err.message || err); return; }
  $("humilDialog").close();
};

/* Random Humiliation SFX. Keep the old synthesized wind sound as a safe
   fallback until the uploaded MP3 files are present or audio is blocked. */
var humiliationSounds = ["humiliation-1.mp3", "humiliation-2.mp3", "humiliation-3.mp3", "humiliation-2.mp3"];
function playHumiliationSound(){
  try {
    var file = humiliationSounds[Math.floor(Math.random() * humiliationSounds.length)];
    var audio = new Audio(file);
    audio.volume = 0.9;
    audio.addEventListener("error", function(){ playWindSound(); }, {once:true});
    var promise = audio.play();
    if(promise && typeof promise.catch === "function") promise.catch(function(){ playWindSound(); });
  } catch(e){ playWindSound(); }
}

/* ===== Sounds ===== */
var kfMoveAudio = null;
var kfMoveBuffers = null;

function kfMakePieceTap(ctx, capture){
  var rate = 22050, pitch = capture ? 505 : 740;
  var buffer = ctx.createBuffer(1, Math.ceil(rate * (capture ? 0.078 : 0.055)), rate);
  var samples = buffer.getChannelData(0);
  for(var i = 0; i < samples.length; i++){
    var t = i / rate;
    var phase = 2 * Math.PI * pitch * t;
    var body = (Math.sin(phase) + 0.48 * Math.sin(phase * 2.37)) * Math.exp(-t * (capture ? 83 : 118));
    var attack = (Math.random() * 2 - 1) * Math.exp(-t * 410);
    samples[i] = (0.28 * body + 0.32 * attack) * Math.min(1, i / 9);
  }
  return buffer;
}
function kfListenForAudioGesture(enable){
  var method = enable ? "addEventListener" : "removeEventListener";
  document[method]("click",kfPreparePieceAudio,true);
  document[method]("keydown",kfPreparePieceAudio,true);
}
function kfPreparePieceAudio(){
  try{
    var AudioCtor = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtor) return;
    if(!kfMoveAudio){
      kfMoveAudio = new AudioCtor({latencyHint:"interactive"});
      kfMoveBuffers = [kfMakePieceTap(kfMoveAudio,false), kfMakePieceTap(kfMoveAudio,true)];
      kfMoveAudio.onstatechange = function(){
        kfListenForAudioGesture(kfMoveAudio.state !== "running");
      };
    }
    if(kfMoveAudio.state === "running") kfListenForAudioGesture(false);
    else kfMoveAudio.resume().catch(function(){});
  }catch(ignore){}
}
kfListenForAudioGesture(true);
function kfPlayPieceTap(move){
  if(!kfMoveBuffers || kfMoveAudio.state !== "running" || document.hidden) return;
  var capture = !!(move && (move.captured || (move.san && move.san.includes("x"))));
  setTimeout(function(){
    if(document.hidden || kfMoveAudio.state !== "running") return;
    try{
      var source = kfMoveAudio.createBufferSource();
      source.buffer = kfMoveBuffers[capture ? 1 : 0];
      source.connect(kfMoveAudio.destination);
      source.start();
    }catch(ignore){}
  },0);
}

function playWindSound(){
  try{
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var bufferSize = ctx.sampleRate * 0.8;
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for(var i = 0; i < bufferSize; i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    var filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2000;
    filter.Q.value = 1.2;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch(e){}
}

function playVictorySound(){
  try{
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var notes = [523.25, 659.25, 783.99, 1046.5];
    var t = ctx.currentTime;
    notes.forEach(function(freq, i){
      var osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i*0.15);
      g.gain.linearRampToValueAtTime(0.35, t + i*0.15 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i*0.15 + 0.4);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t + i*0.15);
      osc.stop(t + i*0.15 + 0.5);
    });
  } catch(e){}
}

function playDefeatSound(){
  try{
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var t = ctx.currentTime;
    var bufferSize = ctx.sampleRate * 1.2;
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for(var i = 0; i < bufferSize; i++) data[i] = (Math.random()*2-1) * Math.max(0, 1 - i/bufferSize*1.5);
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4000, t);
    filter.frequency.exponentialRampToValueAtTime(200, t+0.9);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+1.0);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t);
    var osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t+0.7);
    osc.frequency.exponentialRampToValueAtTime(40, t+1.4);
    var g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t+0.7);
    g2.gain.linearRampToValueAtTime(0.5, t+0.75);
    g2.gain.exponentialRampToValueAtTime(0.001, t+1.5);
    osc.connect(g2);
    g2.connect(ctx.destination);
    osc.start(t+0.7);
    osc.stop(t+1.5);
  } catch(e){}
  }
  /* ===== Celebration ===== */
function showCelebration(opts){
  var screen = $("celebrationScreen");
  _celebOnDone = opts.onDone || null;
  screen.className = "celebration show " + opts.outcome;
  // Rematch is only available after Quick Play games, never in tournament matches.
  $("celebRematch").hidden = !!opts.isTournament;
  $("celebAnalyze").hidden = false;
  $("celebExit").textContent = "Exit";
  var text = "";
  if(opts.outcome === "win" && opts.hasHumiliation) text = "The Crown Is Yours, Brave King";
  else if(opts.outcome === "win") text = "The Crown Is Yours, My King";
  else if(opts.outcome === "loss") text = "The King Has Fallen";
  else text = "A Draw in the Battle";
  $("celebText").textContent = text;
  $("celebAvatar").src = opts.user && opts.user.user_metadata && opts.user.user_metadata.avatar_url
    ? opts.user.user_metadata.avatar_url
    : defaultAvatar();
  var uname = opts.user && opts.user.user_metadata && opts.user.user_metadata.username
    ? opts.user.user_metadata.username
    : "Player";
  $("celebName").textContent = uname;
  $("celebWinsOld").textContent = "";
  $("celebPlus").textContent = "";
  $("celebWinsNew").textContent = "";
  var humilTag = $("celebHumilTag");
humilTag.classList.remove("loss");
if(opts.hasHumiliation && opts.outcome === "win"){
  humilTag.hidden = false;
  $("celebHumilText").textContent = "HUMILIATION VICTORY";
} else if(opts.hasHumiliation && opts.outcome === "loss"){
  humilTag.hidden = false;
  humilTag.classList.add("loss");
  $("celebHumilText").textContent = "HUMILIATION DEFEAT";
} else {
  humilTag.hidden = true;
}
  if(opts.outcome === "win") setTimeout(playVictorySound, 300);
  else if(opts.outcome === "loss") setTimeout(playDefeatSound, 300);
  if(opts.outcome === "win") launchConfetti();
  var oldW = opts.oldWins || 0;
  var newW = opts.newWins || oldW;
  setTimeout(function(){ $("celebWinsOld").textContent = fmtStat(oldW); }, 900);
  setTimeout(function(){ $("celebPlus").textContent = (newW - oldW > 0) ? "+" + fmtStat(newW - oldW) : ""; }, 1400);
  setTimeout(function(){ $("celebWinsNew").textContent = "→ " + fmtStat(newW); }, 1500);
  var dur = opts.isTournament ? 10000 : 10000;
  $("celebAuto").textContent = "Closing in " + Math.ceil(dur/1000) + "s…";
  if(celebTimer) clearTimeout(celebTimer);
  if(celebInterval) clearInterval(celebInterval);
  var startTime = Date.now();
  celebInterval = setInterval(function(){
    var remain = Math.max(0, dur - (Date.now() - startTime));
    $("celebAuto").textContent = "Closing in " + Math.ceil(remain/1000) + "s…";
    if(remain <= 0) clearInterval(celebInterval);
  }, 250);
  celebTimer = setTimeout(function(){
    clearInterval(celebInterval);
    hideCelebration();
    if(opts.onDone) opts.onDone();
  }, dur);
}
function handleQuickPlayCancelled(){
  var screen = $("celebrationScreen");
  if(celebTimer) clearTimeout(celebTimer);
  if(celebInterval) clearInterval(celebInterval);
  screen.className = "celebration show cancelled";
  $("celebText").textContent = "GAME CANCELLED";
  $("celebAvatar").src = defaultAvatar();
  $("celebName").textContent = "";
  $("celebWinsOld").textContent = "";
  $("celebPlus").textContent = "";
  $("celebWinsNew").textContent = "";
  $("celebHumilTag").hidden = true;
  $("celebRematch").hidden = true;
  $("celebAnalyze").hidden = true;
  $("celebExit").textContent = "Back to Home";
  var finish = function(){
    hideCelebration();
    stopGamePolling();
    onlineGameId = null; onlineGame = null;
    kfStopGameBroadcast(); if(gameChannel && sb){ sb.removeChannel(gameChannel); gameChannel = null; }
    exitFullscreenGame();
    document.body.classList.remove("online", "computer-mode", "game-focus");
    $("new").disabled = false;
    resetQueueUI();
    setTimeout(loadHistory, 300);
  };
  var duration = 10000, started = Date.now();
  $("celebAuto").textContent = "Returning to home in 10s…";
  celebInterval = setInterval(function(){
    var left = Math.max(0, duration - (Date.now() - started));
    $("celebAuto").textContent = "Returning to home in " + Math.ceil(left/1000) + "s…";
    if(left <= 0){ clearInterval(celebInterval); celebInterval = null; }
  }, 250);
  celebTimer = setTimeout(function(){
    celebTimer = null;
    if(celebInterval){ clearInterval(celebInterval); celebInterval = null; }
    finish();
  }, duration);
}
function hideCelebration(){
  if(celebTimer){ clearTimeout(celebTimer); celebTimer = null; }
  if(celebInterval){ clearInterval(celebInterval); celebInterval = null; }
  $("celebrationScreen").classList.remove("show", "win", "loss", "draw", "cancelled");
}
$("celebExit").onclick = function(){
  if(celebTimer){ clearTimeout(celebTimer); celebTimer = null; }
  if(celebInterval){ clearInterval(celebInterval); celebInterval = null; }
  hideCelebration();
  stopGamePolling();
  onlineGameId = null; onlineGame = null;
  kfStopGameBroadcast(); if(gameChannel && sb){ sb.removeChannel(gameChannel); gameChannel = null; }
  exitFullscreenGame();
  document.body.classList.remove("online", "computer-mode", "game-focus");
  $("new").disabled = false;
  resetQueueUI();
  setTimeout(loadHistory, 300);
  setTimeout(refreshTournLive, 500);
};
$("celebAnalyze").onclick = function(){
  if(celebTimer){ clearTimeout(celebTimer); celebTimer = null; }
  if(celebInterval){ clearInterval(celebInterval); celebInterval = null; }
  hideCelebration();
  exitFullscreenGame();

  // 🟢 FIX: لود کردن تاریخچه بازی آنلاین قبل از آنالیز
  if(onlineGame && onlineGame.pgn){
    try {
      var tempGame = new Chess();
      tempGame.load_pgn(onlineGame.pgn);
      if(tempGame.history().length > 0) {
        pendingAnalysisGame = game;
        game = tempGame;
        draw();
      }
    } catch(e) { console.warn("PGN load error for analysis:", e); }
  }

  setTimeout(openAnalysis, 200);
};

/* ===== Rematch ===== */
function updateRematchButton(){
  var btn = $("celebRematch");
  if(!btn || !onlineGame) return;
  var isPending = onlineGame.rematch_status === "pending";
  var isMine = onlineGame.rematch_requested_by === currentUser.id;
  if(isPending && isMine){
    btn.textContent = "⏳ Waiting…";
    btn.disabled = true;
    btn.classList.add("rematch-waiting");
    btn.classList.remove("rematch-pending");
  } else if(isPending && !isMine){
    btn.textContent = "✅ Accept Rematch";
    btn.disabled = false;
    btn.classList.add("rematch-pending");
    btn.classList.remove("rematch-waiting");
  } else {
    btn.textContent = "🔄 Rematch";
    btn.disabled = false;
    btn.classList.remove("rematch-waiting", "rematch-pending");
  }
}
async function requestRematch(){
  if(!sb || !onlineGameId || !onlineGame || !currentUser) return;
  if(onlineGame.status !== "completed"){ say("Game is not finished yet.", {silentToast: true}); return; }
  if(onlineGame.is_tournament){ say("Rematch is not available in tournaments.", {silentToast: true}); return; }
  if(onlineGame.rematch_status === "pending" || onlineGame.rematch_status === "accepted"){
    say("A rematch is already in progress.", {silentToast: true});
    return;
  }
  var res = await sb.rpc("kf_request_rematch", {p_game_id: onlineGameId});
  if(res.error){ say("Could not request rematch: " + res.error.message, {error: true}); return; }
  onlineGame = Object.assign({}, onlineGame, {
    rematch_requested_by: currentUser.id,
    rematch_status: "pending",
    rematch_expires_at: new Date(Date.now() + 30000).toISOString(),
    rematch_game_id: null
  });
  updateRematchButton();
  say("Rematch requested. Waiting for opponent…", {silentToast: true});
  if(rematchRequestTimer) clearTimeout(rematchRequestTimer);
  rematchRequestTimer = setTimeout(function(){
    if(!onlineGame || onlineGame.rematch_status !== "pending") return;
    if(onlineGame.rematch_requested_by !== currentUser.id) return;
    onlineGame.rematch_status = "declined";
    updateRematchButton();
    say("Rematch request expired.", {silentToast: true});
  }, 30000);
}
async function respondRematch(accept){
   if(!sb || !onlineGameId || !onlineGame || !currentUser) return;
  if(onlineGame.rematch_requested_by === currentUser.id) return;
  if(onlineGame.rematch_status !== "pending") return;
  _rematchAccepting = true;
  try{
    var res = await sb.rpc("kf_respond_rematch", {
      p_game_id: onlineGameId,
      p_accept: !!accept
    });
    if(res.error) throw res.error;
    var result = res.data || {};
    if(!result.success){
      say(result.message || "Rematch request expired.", {error: true});
      return;
    }
    if(!accept){
      stopGamePolling();
      $("rematchDialog").close();
      rematchDialogShown = false;
      say("You declined the rematch.", {silentToast: true});
      onlineGameId = null; onlineGame = null;
      kfStopGameBroadcast(); if(gameChannel && sb){ sb.removeChannel(gameChannel); gameChannel = null; }
      exitFullscreenGame();
      document.body.classList.remove("online", "computer-mode", "game-focus");
      $("new").disabled = false;
      resetQueueUI();
      setTimeout(loadHistory, 300);
      return;
    }
    var newGameId = result.new_game_id;
    if(!newGameId) throw new Error("The server did not return the new game ID.");
    $("rematchDialog").close();
    rematchDialogShown = false;
    hideCelebration();
    exitFullscreenGame();
    document.body.classList.remove("online", "computer-mode", "game-focus");
    kfStopGameBroadcast(); if(gameChannel && sb){ sb.removeChannel(gameChannel); gameChannel = null; }
    currentGameIsRoulette = false;
    await loadOnlineGame(newGameId);
  } catch(e){
    say("Rematch error: " + (e.message || "Unknown"), {error: true});
  } finally {
    _rematchAccepting = false;
  }
}
$("celebRematch").onclick = function(){
  if(!onlineGame) return;
  if(onlineGame.rematch_status === "pending" && onlineGame.rematch_requested_by !== currentUser.id){
    respondRematch(true);
  } else if(onlineGame.rematch_status === "pending" && onlineGame.rematch_requested_by === currentUser.id){
    say("Waiting for opponent…", {silentToast: true});
  } else {
    requestRematch();
  }
};
$("rematchAcceptBtn").onclick = function(){ respondRematch(true); };
$("rematchDeclineBtn").onclick = function(){ respondRematch(false); };

/* ===== Celebration stats ===== */
// Read the same authoritative score source used by the visible leaderboard.
// The direct kf_player_stats read can be stale or differ from the leaderboard
// score, which made both celebration numbers incorrect.
async function getCelebrationWins(){
  if(!sb || !currentUser) return null;
  for(var attempt = 0; attempt < 4; attempt++){
    try{
      var lbRes = await sb.rpc("kf_get_leaderboard", {p_limit: 100});
      if(!lbRes.error && Array.isArray(lbRes.data)){
        var mine = lbRes.data.find(function(player){ return player.user_id === currentUser.id; });
        if(mine && mine.wins != null && Number.isFinite(Number(mine.wins))) return Number(mine.wins);
      }
    } catch(e){}
    if(attempt < 3) await new Promise(function(resolve){ setTimeout(resolve, 250); });
  }
  // If the player is outside the leaderboard's returned top 100, use their
  // own stats row as a fallback rather than showing no number at all.
  try{
    var statsRes = await sb.from("kf_player_stats").select("wins").eq("user_id", currentUser.id).maybeSingle();
    if(!statsRes.error && statsRes.data && statsRes.data.wins != null) return Number(statsRes.data.wins) || 0;
  } catch(e){}
  return null;
}

/* ===== Game end handlers ===== */
async function handleQuickPlayEnd(row){
  var iWon = row.winner_id === currentUser.id;
  var isDraw = row.result === "1/2-1/2" || (!row.winner_id && !row.result);
  var outcome = isDraw ? "draw" : (iWon ? "win" : "loss");
  var currentWins = await getCelebrationWins();
  if(currentWins == null) currentWins = 0;
  var bonus = 0;
  if(iWon){
    var hcp = (row.white_id === currentUser.id) ? row.white_handicap : row.black_handicap;
    bonus = 1;
    if(hcp === "n" || hcp === "b") bonus = 2;
    else if(hcp === "r") bonus = 3;
    else if(hcp === "q") bonus = 5;
  }
  var oldWins = currentWins - bonus;
  var newWins = currentWins;
  $("celebRematch").hidden = false;
  updateRematchButton();
  showCelebration({
    outcome: outcome,
    user: currentUser,
    oldWins: oldWins,
    newWins: newWins,
    hasHumiliation: (function(){
  var myHcp, oppHcp;
  if(row.white_id === currentUser.id){
    myHcp = row.white_handicap;
    oppHcp = row.black_handicap;
  } else {
    myHcp = row.black_handicap;
    oppHcp = row.white_handicap;
  }
  if(outcome === "win")  return isValidHcp(myHcp);
  if(outcome === "loss") return isValidHcp(oppHcp);
  return false;
})(),
    isTournament: false,
    onDone: function(){
      stopGamePolling();
      onlineGameId = null; onlineGame = null;
      kfStopGameBroadcast(); if(gameChannel && sb){ sb.removeChannel(gameChannel); gameChannel = null; }
      exitFullscreenGame();
      document.body.classList.remove("online", "computer-mode", "game-focus");
      $("new").disabled = false;
      resetQueueUI();
      setTimeout(loadHistory, 300);
    }
  });
}

async function handleTournamentEnd(row){
  var iWon = row.winner_id === currentUser.id;
  $("celebRematch").hidden = true;
  var currentWins = await getCelebrationWins();
  if(currentWins == null) currentWins = 0;
  var hcp = (row.white_id === currentUser.id) ? row.white_handicap : row.black_handicap;
  var bonus = iWon ? 1 : 0;
  if(iWon && hcp){
    if(hcp === "n" || hcp === "b") bonus = 2;
    else if(hcp === "r") bonus = 3;
    else if(hcp === "q") bonus = 5;
  }
  var oldWins = currentWins - bonus;
  var newWins = currentWins;
  showCelebration({
    outcome: iWon ? "win" : "loss",
    user: currentUser,
    oldWins: oldWins,
    newWins: newWins,
    hasHumiliation: (function(){
  var myHcp = (row.white_id === currentUser.id) ? row.white_handicap : row.black_handicap;
  var oppHcp = (row.white_id === currentUser.id) ? row.black_handicap : row.white_handicap;
  if(iWon) return isValidHcp(myHcp);
  return isValidHcp(oppHcp);
})(),
    isTournament: true,
    onDone: function(){
      stopGamePolling();
      onlineGameId = null; onlineGame = null; tournActiveMatch = null;
      kfStopGameBroadcast(); if(gameChannel && sb){ sb.removeChannel(gameChannel); gameChannel = null; }
      exitFullscreenGame();
      document.body.classList.remove("online", "computer-mode", "game-focus");
      $("new").disabled = false;
      resetQueueUI();
      setTimeout(refreshTournLive, 300);
      setTimeout(loadHistory, 300);
    }
  });
}

async function handleOnlineTimeout(loserColor){
  if(!onlineGameId || !onlineGame || clockClaimPending) return;
  clockClaimPending = true;
  try{
    // Never let a client directly award a timeout win. The database checks the
    // active side and elapsed server time while holding a row lock.
    var res = await sb.rpc("kf_claim_timeout", {p_game_id: onlineGameId});
    if(res.error) throw res.error;
    var data = res.data || {};
    if(data.white_time_left != null) clockWhite = data.white_time_left;
    if(data.black_time_left != null) clockBlack = data.black_time_left;
    if(data.status === "completed"){
      clockExpired = true;
      onlineGame.status = "completed";
      onlineGame.result = data.result;
      onlineGame.winner_id = data.winner_id;
      await reloadGameState(onlineGameId);
    } else {
      // Local display reached zero before the server did (device clock skew).
      clockExpired = false;
      if(data.last_move_at) onlineGame.last_move_at = data.last_move_at;
      if(data.clock_started_at) onlineGame.clock_started_at = data.clock_started_at;
      if(data.white_time_left != null) onlineGame.white_time_left = data.white_time_left;
      if(data.black_time_left != null) onlineGame.black_time_left = data.black_time_left;
      clockPerfBaseWhite = Number(onlineGame.white_time_left != null ? onlineGame.white_time_left : 300);
      clockPerfBaseBlack = Number(onlineGame.black_time_left != null ? onlineGame.black_time_left : 300);
      clockPerfTurn = onlineGame.turn || "w";
      var timeoutAnchor = onlineGame.last_move_at || onlineGame.clock_started_at;
      anchorClockToServerTime(timeoutAnchor);
      paintClocks();
    }
  } catch(e){
    console.warn("Authoritative timeout check failed:", e);
    // Keep the game recoverable; next sync can retry rather than declaring a local win.
    clockExpired = false;
  } finally {
    clockClaimPending = false;
  }
}

function resetQueueUI(){
  try{ stopQueuePoll(); } catch(e){}
  try{ setQuickState("5-minute game · Match by wins"); } catch(e){}
  try{ setRouletteState("Random opening · variable-length line auto-played"); } catch(e){}
  try{ setBloodbladeState("Blood Tributes · mandatory sacrifice"); } catch(e){}
}

/* ===== History ===== */
async function loadHistory(){
  var section = $("historySection");
  if(!sb || !currentUser){ section.classList.remove("show"); return; }
  var res = await sb.rpc("kf_get_my_history", {p_limit: 10});
  if(res.error){ console.warn("History error:", res.error); section.classList.remove("show"); return; }
  historyData = res.data || [];
  renderHistory();
  section.classList.add("show");
}

function renderHistory(){
  var list = $("historyList");
  list.innerHTML = "";
  if(!historyData.length){
    list.innerHTML = '<div class="history-empty">No finished games yet. Play a match to see your history!</div>';
    return;
  }
  for(var i=0;i<historyData.length;i++){
    (function(g){
      var row = document.createElement("div");
      row.className = "hist-row";
      var outcomeIcon = g.my_outcome === "win" ? "🟢" : g.my_outcome === "loss" ? "🔴" : "🟡";
      var outcomeEl = document.createElement("span");
      outcomeEl.className = "hist-outcome";
      outcomeEl.textContent = outcomeIcon;
      var img = document.createElement("img");
      img.className = "hist-avatar";
      img.src = g.opponent_avatar || defaultAvatar();
      img.alt = "";
      var info = document.createElement("div");
      info.className = "hist-info";
      var nm = document.createElement("div");
      nm.className = "hist-name";
      nm.textContent = "vs " + (g.opponent_username || "Opponent");
      var meta = document.createElement("div");
      meta.className = "hist-meta";
      var tagClass = g.is_tournament ? "tourn" : (g.is_roulette ? "roulette" : "quick");
      var tagText = g.is_tournament ? "🏆 Tournament" : (g.is_roulette ? "🎰 Roulette" : "⚡ Quick Play");
      var tag = document.createElement("span");
      tag.className = "hist-tag " + tagClass;
      tag.textContent = tagText;
      var when = document.createElement("span");
      when.textContent = fmtTimeLocal(g.completed_at);
      var color = document.createElement("span");
      color.textContent = g.my_color === "w" ? "Played White" : "Played Black";
      meta.appendChild(tag);
      meta.appendChild(when);
      meta.appendChild(color);
      info.appendChild(nm);
      info.appendChild(meta);
      var badge = document.createElement("span");
      badge.className = "hist-result-badge " + g.my_outcome;
      badge.textContent = g.my_outcome === "win" ? "WIN" : g.my_outcome === "loss" ? "LOSS" : "DRAW";
      var ana = document.createElement("button");
      ana.className = "hist-analyze";
      ana.type = "button";
      var hasReplay = typeof g.pgn === "string" && g.pgn.trim().length > 0;
      ana.textContent = hasReplay ? "Analyze" : "No moves to analyze";
      ana.disabled = !hasReplay;
      if(hasReplay){
        ana.onclick = function(e){ e.stopPropagation(); startAnalysisFromHistory(g); };
        row.onclick = function(){ startAnalysisFromHistory(g); };
      }
      row.appendChild(outcomeEl);
      row.appendChild(img);
      row.appendChild(info);
      row.appendChild(badge);
      row.appendChild(ana);
      list.appendChild(row);
    })(historyData[i]);
  }
}

function startAnalysisFromHistory(g){
  if(!g.pgn){ say("This game has no replay data.", {silentToast: true}); return; }
  try{
    var tempGame = new Chess();
    tempGame.load_pgn(g.pgn);
    if(!tempGame.history().length){ say("Could not load this game.", {silentToast: true}); return; }
    pendingAnalysisGame = game;
    game = tempGame;
    draw();
    openAnalysis();
  } catch(e){
    say("Could not load this game: " + e.message, {error: true});
  }
  }
  /* ===== ROULETTE ===== */
function rouletteDelayUntil(serverTargetMs, serverOffsetMs){
  return Math.max(0, serverTargetMs - (Date.now() + (serverOffsetMs || 0)));
}
function waitForRouletteServerTime(serverTargetMs, serverOffsetMs){
  return new Promise(function(resolve){
    var delay = rouletteDelayUntil(serverTargetMs, serverOffsetMs);
    if(delay <= 0) resolve();
    else setTimeout(resolve, delay);
  });
}
function spinJackpot(opening, openingNames, openingStartMs, serverOffsetMs){
  return new Promise(function(resolve){
    var overlay = $("jackpotOverlay");
    var colW = $("jpColWhite"), colB = $("jpColBlack"), colL = $("jpColLine"), res = $("jpResult");
    colW.className = "jackpot-col spinning";
    colB.className = "jackpot-col spinning";
    colL.className = "jackpot-col spinning";
    res.textContent = "";
    res.classList.remove("show");
    overlay.classList.add("show");
    var wPool = ["e4","d4","c4","Nf3","e3","g3","b3"];
    var bPool = ["e5","c5","e6","c6","d5","Nf6","d6","g6"];
    var lPool = (openingNames && openingNames.length) ? openingNames : [opening.name];
    var tw = setInterval(function(){ colW.textContent = wPool[Math.floor(Math.random()*wPool.length)]; }, 70);
    var tb = setInterval(function(){ colB.textContent = bPool[Math.floor(Math.random()*bPool.length)]; }, 70);
    var tl = setInterval(function(){ colL.textContent = lPool[Math.floor(Math.random()*lPool.length)]; }, 70);
    function at(offsetMs, callback){
      setTimeout(callback, rouletteDelayUntil(openingStartMs + offsetMs, serverOffsetMs));
    }
    at(1400, function(){ clearInterval(tw); colW.textContent = opening.moves[0] || "—"; colW.className = "jackpot-col locked"; });
    at(2200, function(){ clearInterval(tb); colB.textContent = opening.moves[1] || "—"; colB.className = "jackpot-col locked"; });
    at(3000, function(){ clearInterval(tl); colL.textContent = opening.name; colL.className = "jackpot-col locked"; res.textContent = "🎯 " + opening.name; res.classList.add("show"); });
    at(4800, function(){ clearInterval(tw); clearInterval(tb); clearInterval(tl); overlay.classList.remove("show"); resolve(opening); });
  });
}
async function applyRouletteOpening(opening, firstMoveAtMs, serverOffsetMs){
  if(!game) throw new Error("Chess board is not ready for Roulette opening.");

  for(var i=0; i<opening.moves.length; i++){
    await waitForRouletteServerTime(firstMoveAtMs + i * 800, serverOffsetMs);
    var m = game.move(opening.moves[i]);
    if(!m) throw new Error("Invalid Roulette move: " + opening.moves[i]);

    last = {from:m.from, to:m.to};
    selected = null;
    targets = [];
    draw();
    kfPlayPieceTap(m);
    say(m.san, {silentToast:true});

  }
  // Hold the final automatic position until the exact server clock anchor.
  await waitForRouletteServerTime(firstMoveAtMs + opening.moves.length * 800, serverOffsetMs);
}
async function startRoulette(){
  if(kfFeatureFlags.roulette===false){say("Roulette is temporarily disabled.",{info:true});return;}
  if(computerTimer){ clearTimeout(computerTimer); computerTimer = null; }
  computerMode = false;
  document.body.classList.remove("computer-mode");
  if(!sb){ say("Supabase is unavailable.", {error: true}); return; }
  var sess = await sb.auth.getSession();
  var session = sess.data && sess.data.session ? sess.data.session : null;
  if(!session){ openAuth("signin"); say("Sign in before using Roulette.", {silentToast: true}); return; }
  currentUser = session.user;
  humilApplied = false;
  humilChosenType = null;
  humilSelecting = false;
  pendingQueueIsRoulette = true;
  pendingQueueIsBloodblade = false;
  currentGameIsRoulette = false;
  setRouletteState("Finding opponent…", {lock: true, cancel: true});
  say("", {silentToast: true});
  try{
    var res = await sb.rpc("kf_join_quick_play", {p_is_roulette: true});
    if(res.error) throw res.error;
    var data = res.data;
    if(data && data.status === "matched" && data.game_id){
      currentGameIsRoulette = true;
      setRouletteState("Random opening · variable-length line auto-played", {});
      await loadOnlineGame(data.game_id);
    } else {
      setRouletteState("Searching · 5 min game…", {lock: true, cancel: true});
      kfStartQueuePoll();
      queueTimeout = setTimeout(async function(){
        if(onlineGameId) return;
        await cancelQuickPlay();
        say("No roulette opponents found — timed out.", {silentToast: true});
      }, 120000);
      await pollQueue();
    }
  } catch(err){
    setRouletteState("Random opening · variable-length line auto-played", {});
    say("Roulette error: " + (err.message || "Unknown"), {error: true});
  }
}
async function startBloodblade(){
 if(kfFeatureFlags.bloodblade===false){say("Bloodblade is disabled.",{info:true});return;}
 if(!sb){say("Supabase unavailable.",{error:true});return;}
 var sess=await sb.auth.getSession(),session=sess.data&&sess.data.session;
 if(!session){openAuth("signin");say("Sign in before Bloodblade.",{silentToast:true});return;}
 currentUser=session.user;
 if(computerTimer){clearTimeout(computerTimer);computerTimer=null;}
 computerMode=false;document.body.classList.remove("computer-mode");
 humilApplied=false;humilChosenType=null;humilSelecting=false;
 pendingQueueIsRoulette=false;pendingQueueIsBloodblade=true;currentGameIsRoulette=false;
 setBloodbladeState("Finding opponent…",{lock:true,cancel:true});say("",{silentToast:true});
 try{
  var res=await sb.rpc("kf_join_bloodblade");
  if(res.error)throw res.error;
  var data=res.data;
  if(data&&data.status==="matched"&&data.game_id){
   setBloodbladeState("Blood Tributes · mandatory sacrifice");
   await loadOnlineGame(data.game_id);
  }else{
   setBloodbladeState("Searching by wins…",{lock:true,cancel:true});
   kfStartQueuePoll();
   queueTimeout=setTimeout(async function(){if(onlineGameId)return;await cancelQuickPlay();say("No Bloodblade opponents found.",{silentToast:true});},120000);
   await pollQueue();
  }
 }catch(err){setBloodbladeState("Blood Tributes · mandatory sacrifice");say("Bloodblade error: "+(err.message||err),{error:true});}
}
$("bloodbladeBtn").onclick=startBloodblade;
$("cancelBloodblade").onclick=cancelQuickPlay;
$("rouletteBtn").onclick = startRoulette;
$("cancelRoulette").onclick = cancelQuickPlay;
$("quickPlay").onclick = startQuickPlay;
$("cancelQueue").onclick = cancelQuickPlay;

/* ===== COMPUTER GAME ===== */
$("computerRating").addEventListener("input", function(){
  computerRating = Number($("computerRating").value);
  $("computerRatingLabel").textContent = String(computerRating);
});

function startComputerGame(userColor){
  if(kfFeatureFlags.computer_mode===false){say("Play vs Computer is temporarily disabled.",{info:true});return;}
  if(onlineGameId){ say("Finish the current game first.", {silentToast: true}); return; }
  if(computerTimer){ clearTimeout(computerTimer); computerTimer = null; }
  stopQueuePoll();
  computerMode = true;
  computerBusy = false;
  computerUserColor = userColor;
  initStockfish();
  onlineGameId = null;
  onlineGame = null;
  document.body.classList.remove("online");
  document.body.classList.add("computer-mode");
  $("gameClockLabel").textContent = "KINGSFALL · STOCKFISH";
  clockExpired = false;
  lastClockAt = Date.now();
  paintClocks();
  flipped = (userColor === "b");
  game = new Chess();
  selected = null;
  targets = [];
  last = null;
  _boardBuilt = false;
  renderPlayers(null);
  var uname = (currentUser && currentUser.user_metadata && currentUser.user_metadata.username) || "You";
  var avatar = (currentUser && currentUser.user_metadata && currentUser.user_metadata.avatar_url) || null;
  if(userColor === "w"){
    setPlayer("White", {username: uname, wins: "—", avatar_url: avatar});
    setPlayer("Black", {username: "Stockfish", wins: computerRating + " rating", avatar_url: null});
  } else {
    setPlayer("Black", {username: uname, wins: "—", avatar_url: avatar});
    setPlayer("White", {username: "Stockfish", wins: computerRating + " rating", avatar_url: null});
  }
  $("new").disabled = false;
  $("undo").disabled = false;
  setQuickState("Computer practice · Stockfish");
  say("Computer game started. You play " + (userColor === "w" ? "White" : "Black") + ".", {silentToast: true});
  draw();
  if(userColor === "b"){
    lastClockAt = Date.now();
    computerTimer = setTimeout(makeComputerMove, 400);
  }
}
$("computerPlayWhite").onclick = function(){ startComputerGame("w"); };
$("computerPlayBlack").onclick = function(){ startComputerGame("b"); };

/* ===== STOCKFISH ENGINE ===== */
var stockfishWorker = null;
var stockfishReady = false;
var stockfishThinking = false;
var stockfishFallbackTimer = null;
var stockfishAnalysisMode = false;
var stockfishCallback = null;
var currentAnalyzeScore = null;
var currentAnalyzeDepth = -1;
var currentAnalyzeSecond = null;
var currentAnalyzePV = null;
var currentAnalyzeLinesByDepth = {};
var currentAnalyzePVCount = 1;
var stockfishBootTimer = null;
var stockfishBootGeneration = 0;
var stockfishEngineName = "Loading";
var stockfishBootError = "";
var STOCKFISH_19_JS = "engine/stockfish-19-lite-single.js";
var STOCKFISH_19_WASM = "engine/stockfish-19-lite-single.wasm";

function initStockfish(){
  if(stockfishWorker) return;
  var generation = ++stockfishBootGeneration;
  stockfishBootError = "";
  stockfishEngineName = "Loading";
  try {
    // Same-origin JS/WASM engine for game review and computer play.
    var worker = new Worker(STOCKFISH_19_JS + "?v=19.0.1");
    attachStockfishWorker(worker, generation);
  } catch(err){
    stockfishBootError = "Stockfish 19 worker creation failed: " + String(err && err.message || err);
    stockfishReady = false;
    computerBusy = false;
    say(stockfishBootError, {error:true});
  }
}

function attachStockfishWorker(worker, generation){
  if(generation !== stockfishBootGeneration){ try{worker.terminate();}catch(e){} return; }
  stockfishWorker = worker;
  stockfishReady = false;
  stockfishEngineName = "Stockfish 19 Lite";
  function fail(reason){
    if(stockfishWorker !== worker || generation !== stockfishBootGeneration) return;
    clearTimeout(stockfishBootTimer);
    stockfishBootError = reason || "Stockfish 19 startup failed";
    try{worker.terminate();}catch(err){}
    stockfishWorker = null;
    stockfishReady = false;
    stockfishThinking = false;
    computerBusy = false;
    if(stockfishAnalysisMode && stockfishCallback){
      var cb = stockfishCallback;
      stockfishCallback = null;
      stockfishAnalysisMode = false;
      cb(null);
    }
    say("Stockfish 19 unavailable: " + stockfishBootError, {error:true});
  }
  worker.onmessage = function(e){
    if(generation !== stockfishBootGeneration || stockfishWorker !== worker) return;
    String(e.data || "").split(/\r?\n/).forEach(function(line){ if(line) handleStockfishMessage(line); });
    if(stockfishReady) clearTimeout(stockfishBootTimer);
  };
  worker.onerror = function(e){
    if(e && e.preventDefault) e.preventDefault();
    fail("Worker error: " + ((e && e.message) || "unknown") +
         (e && e.filename ? " (" + e.filename + ":" + e.lineno + ")" : ""));
  };
  worker.onmessageerror = function(){ fail("Worker message decoding failed"); };
  stockfishBootTimer = setTimeout(function(){
    if(!stockfishReady) fail("Engine initialization timed out waiting for readyok");
  }, 60000);
  try{worker.postMessage("uci");}
  catch(err){fail("Unable to send UCI: " + String(err && err.message || err));}
}

function handleStockfishMessage(line){
  if(line.indexOf("info ") === 0 && stockfishAnalysisMode){
    var depthM = line.match(/\bdepth (\d+)/);
    var cpM = line.match(/\bscore cp (-?\d+)/);
    var mateM = line.match(/\bscore mate (-?\d+)/);
    if(!/\b(?:lowerbound|upperbound)\b/.test(line) && (cpM || mateM)){
      var depth = depthM ? parseInt(depthM[1], 10) : 0;
      var multipvM = line.match(/\bmultipv (\d+)/);
      var pvNumber = multipvM ? parseInt(multipvM[1], 10) : 1;
      var score = cpM ? parseInt(cpM[1], 10) : null;
      if(mateM){
        var mate = parseInt(mateM[1], 10);
        score = mate > 0 ? (10000 - mate * 100) : (-10000 - Math.abs(mate) * -100);
      }
      var pvM = line.match(/\bpv ((?:[a-h][1-8][a-h][1-8][qrbn]?(?:\s+|$)){1,6})/);
      if(currentAnalyzePVCount === 2 && (pvNumber === 1 || pvNumber === 2) && pvM && depth > 0){
        if(!currentAnalyzeLinesByDepth[depth]) currentAnalyzeLinesByDepth[depth] = {};
        currentAnalyzeLinesByDepth[depth][pvNumber] = {
          score:score, depth:depth, uci:pvM[1].trim().split(/\s+/)[0],
          pv:pvM[1].trim().split(/\s+/)
        };
      }
      if(pvNumber === 1 && depth >= currentAnalyzeDepth){
        currentAnalyzeDepth = depth;
        currentAnalyzeScore = score;
        currentAnalyzePV = pvM ? pvM[1].trim().split(/\s+/) : null;
      } else if(pvNumber === 2 && (!currentAnalyzeSecond || depth >= currentAnalyzeSecond.depth)){
        currentAnalyzeSecond = {score:score, depth:depth, uci:pvM ? pvM[1].trim().split(/\s+/)[0] : null};
      }
    }
    return;
  }
  if(line.indexOf("uciok") !== -1){ stockfishWorker.postMessage("isready"); return; }
  if(line.indexOf("readyok") !== -1){
    stockfishReady = true;
    if(stockfishAnalysisMode && stockfishCallback) return;
    if(computerMode && game && !game.game_over() && !stockfishThinking){
      var compColor = (computerUserColor === "w") ? "b" : "w";
      if(game.turn() === compColor) setTimeout(triggerStockfishGo, 50);
    }
    return;
  }
  if(line.indexOf("bestmove ") === 0){
    clearTimeout(stockfishFallbackTimer);
    stockfishThinking = false;
    var parts = line.split(/\s+/), uci = parts[1];
    if(stockfishAnalysisMode){
      var analysisCb = stockfishCallback;
      stockfishCallback = null;
      var verifiedPair = null;
      if(currentAnalyzePVCount === 2){
        Object.keys(currentAnalyzeLinesByDepth).map(Number).sort(function(a,b){return b-a;}).some(function(d){
          var pair = currentAnalyzeLinesByDepth[d];
          if(pair[1] && pair[2] && pair[1].uci && pair[2].uci &&
             pair[1].uci !== pair[2].uci){
            verifiedPair = pair; return true;
          }
          return false;
        });
      }
      if(analysisCb) analysisCb({
        uci: verifiedPair ? verifiedPair[1].uci : (uci && uci !== "(none)" ? uci : null),
        score: verifiedPair ? verifiedPair[1].score : currentAnalyzeScore,
        depth: verifiedPair ? verifiedPair[1].depth : currentAnalyzeDepth,
        second: verifiedPair ? verifiedPair[2] : null,
        pv: verifiedPair ? verifiedPair[1].pv : currentAnalyzePV,
        paired:!!verifiedPair
      });
      return;
    }
    if(!uci || uci === "(none)"){
      computerBusy = false;
      if(stockfishCallback){ var cb0 = stockfishCallback; stockfishCallback = null; cb0(null); }
      return;
    }
    var from = uci.slice(0, 2), to = uci.slice(2, 4), promotion = uci.slice(4, 5) || "q";
    var m = game.move({from: from, to: to, promotion: promotion});
    if(m) last = {from: m.from, to: m.to};
    computerBusy = false;
    selected = null;
    targets = [];
    lastClockAt = Date.now();
    draw();
    if(m) kfPlayPieceTap(m);
    if(game.game_over()){
      if(game.in_checkmate()) say("Checkmate — " + (game.turn() === "w" ? "Stockfish" : "you") + " wins.", {silentToast: true});
      else say("Draw.", {silentToast: true});
    } else {
      say("Stockfish played " + (m ? m.san : uci) + ".", {silentToast: true});
    }
  }
}

function triggerStockfishGo(){
  var compColor = (computerUserColor === "w") ? "b" : "w";
  if(!computerMode || !game || game.game_over() || game.turn() !== compColor) return;
  if(!stockfishWorker || !stockfishReady || stockfishThinking) return;
  computerBusy = true;
  stockfishThinking = true;
  stockfishAnalysisMode = false;
  var skill = Math.max(0, Math.min(20, Math.round((computerRating - 800) / 60)));
  if(computerRating < 1000){
    stockfishWorker.postMessage("setoption name UCI_LimitStrength value true");
    stockfishWorker.postMessage("setoption name UCI_Elo value " + computerRating);
  } else {
    stockfishWorker.postMessage("setoption name Skill Level value " + skill);
    stockfishWorker.postMessage("setoption name UCI_LimitStrength value false");
  }
  stockfishWorker.postMessage("position fen " + game.fen());
  var depth = computerRating < 1100 ? 3 : computerRating < 1400 ? 6 : computerRating < 1700 ? 10 : 14;
  stockfishWorker.postMessage("go depth " + depth);
  stockfishFallbackTimer = setTimeout(function(){
    if(stockfishThinking){
      stockfishThinking = false;
      computerBusy = false;
      say("Stockfish is taking too long. Try again.", {silentToast: true});
    }
  }, 30000);
}

function makeComputerMove(){
  computerTimer = null;
  if(!computerMode || !game || game.game_over()) return;
  var compColor = (computerUserColor === "w") ? "b" : "w";
  if(game.turn() !== compColor) return;
  computerBusy = true;
  if(!stockfishWorker) initStockfish();
  if(!stockfishReady){ say("Stockfish is warming up…", {silentToast: true}); return; }
  triggerStockfishGo();
  }
  