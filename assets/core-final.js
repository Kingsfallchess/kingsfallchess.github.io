"use strict";
async function submitMove(m, clientWhite, clientBlack, moveStartedAt, isPremove){
  if(!sb || !onlineGameId || !onlineGame) return;
  if(submittingMove) return;
  submittingMove = true;
  var submittedGameId = onlineGameId;
  // A premove has already painted its affected squares synchronously.
  // Avoid a second full 64-square redraw before the server has responded.
  // Normal moves continue to use their existing optimistic paint.
  var optimisticPaint = isPremove===true ? null : setTimeout(function(){
    optimisticPaint = null;
    if(onlineGameId !== submittedGameId) return;
    say(m.san, {silentToast:true});
    draw();
    updateHumilBadge();
  }, 0);
  // Cancel any polling request that started before this move.
  gameSyncGeneration++;
  try {
    var result = null, winnerId = null, status = "active";
    if(game.game_over()){
      status = "completed";
      if(game.in_checkmate()){
        result = game.turn() === "w" ? "0-1" : "1-0";
        winnerId = game.turn() === "w" ? onlineGame.black_id : onlineGame.white_id;
      } else {
        result = "1/2-1/2";
      }
    }

    // Do not report a tournament result before the completed game row is saved.
    // The database may resolve a tournament stalemate to a winner by profile wins.

    // Send the move and let the server persist the authoritative result.
    // Position, history, result and clock are now derived by the server.
    // The client sends only move coordinates and an idempotency token.
    // Browser chess.js has already rejected illegal moves. Submit the legal
    // candidate straight to a restricted authenticated database RPC: one
    // network hop instead of browser -> Edge Function -> database. PostgREST
    // verifies the JWT; the RPC derives player/session identity from it and
    // retains atomic turn, clock, and position enforcement. The heavier
    // independent chess/session verification stays in the shadow-audit queue.
    // Every browser move uses the direct PostgreSQL path.
    // The independent move-audit continues asynchronously.
    var res;
    {
      // One server-controlled path for ordinary moves and every ending.
      // PostgreSQL derives the authoritative status and result; browser
      // checkmate/stalemate claims are never trusted.
      res = await sb.rpc("kf_submit_move_v3", {
        p_game_id: onlineGameId,
        p_expected_fen: onlineGame.fen,
        p_from: m.from,
        p_to: m.to,
        p_promotion: m.promotion || null,
        p_request_id: crypto.randomUUID()
      });
    }
    if(res.error && res.error.context && typeof res.error.context.json === "function"){
      try{
        var rejected = await res.error.context.json();
        if(rejected && rejected.error) res.error.message = rejected.error;
      }catch(e){}
    }
    if(onlineGameId !== submittedGameId) return;
    if(optimisticPaint != null){
      clearTimeout(optimisticPaint);
      optimisticPaint = null;
      if(!res.error){ say(m.san, {silentToast:true}); draw(); updateHumilBadge(); }
    }else if(isPremove===true && !res.error){
      // Reconcile check markers, history, and all UI after the fast partial paint.
      say(m.san, {silentToast:true});
      draw();
      updateHumilBadge();
    }
    
    if(res.error){
      // Any queued selection based on a rejected optimistic move is stale.
      kfMultiReset();
      // Error-only, fire-and-forget diagnostic. Never runs for accepted moves.
      // Server independently verifies legality from the authoritative game FEN.
      // Do not await: UI rollback, clock and premoves must remain independent.
      if(onlineGame && onlineGame.fen && m && m.from && m.to){
        try{
          var rejectedReport = sb.functions.invoke("kf-report-rejected-move", {
            body: {
              game_id: submittedGameId,
              request_id: crypto.randomUUID(),
              from: m.from,
              to: m.to,
              promotion: m.promotion || null,
              expected_fen: onlineGame.fen
            }
          });
          if(rejectedReport && typeof rejectedReport.catch === "function"){
            rejectedReport.catch(function(){ /* Optional diagnostics must not affect play. */ });
          }
        }catch(reportError){ /* Non-blocking report channel. */ }
      }
      if(kfClockBeforeMove){
        clockPerfBaseWhite=kfClockBeforeMove.white;
        clockPerfBaseBlack=kfClockBeforeMove.black;
        clockPerfAnchor=kfClockBeforeMove.anchor;
        clockPerfTurn=kfClockBeforeMove.perfTurn;
        if(onlineGame)onlineGame.turn=kfClockBeforeMove.turn;
      }
      kfPendingClockMove=false;tickClock();
      game.undo();
      selected = null;
      targets = [];
      draw();
      say("Move could not be saved: " + res.error.message, {error: true});
      setTimeout(function(){ reloadGameState(onlineGameId); }, 300);
      return;
    }

    // A move can finish the local chess position (checkmate or stalemate).
    // Re-read the saved row because the database resolves tournament draws.
    if(status === "completed"){
      var completedRes = await sb.from("kf_games").select("*").eq("id", onlineGameId).maybeSingle();
      if(!completedRes.error && completedRes.data){
      }
      await reloadGameState(onlineGameId);
      return;
    }

    // If the server completed a move attempt while the local board was still active,
    // it was an authoritative timeout result.
    if(res.data.status === "completed"){
      if(game.in_checkmate()){
        // A native, server-verified checkmate is not a timeout.
        await reloadGameState(onlineGameId);
        return;
      }
      clockExpired = true;
      clockWhite = res.data.white_time_left;
      clockBlack = res.data.black_time_left;
      
      var winnerIdR = res.data.winner_id;
      var loserIdR = (winnerIdR === onlineGame.white_id) ? onlineGame.black_id : onlineGame.white_id;
      var loserColor = (loserIdR === onlineGame.white_id) ? "White" : "Black";
      
      say(loserColor + " ran out of time.", {silentToast: true});
      await reloadGameState(onlineGameId);
      return;
    }

    // The next turn's display was held until the validated server commit.
    // It will now use last_move_at to account for delivery time.
    kfRunningClockBlend=null;
    // ✅ سرور زمان دقیق رو برگردوند، ما هم همون رو ذخیره می‌کنیم
    onlineGame.turn = game.turn();
    // Keep the confirmed position in sync for the next fast move/premove.
    // This is only reached after the server accepts the move; deferred
    // Realtime snapshots are reconciled in finally below.
    onlineGame.fen = res.data.fen;
    onlineGame.pgn = res.data.pgn;
    onlineGame.white_time_left = res.data.white_time_left;
    onlineGame.black_time_left = res.data.black_time_left;
    onlineGame.last_move = {from: m.from, to: m.to, san: m.san};
    onlineGame.last_move_at = res.data.last_move_at || new Date().toISOString();
    if(res.data.clock_started_at) onlineGame.clock_started_at = res.data.clock_started_at;
    clockExpired = false;
    clockWhite = Number(res.data.white_time_left);
    clockBlack = Number(res.data.black_time_left);
    // Blend only the newly running side. The stopped mover stays exact.
    kfPendingClockMove=false;
    clockPerfBaseWhite=clockWhite;clockPerfBaseBlack=clockBlack;
    clockPerfTurn=onlineGame.turn||"w";
    anchorClockToServerTime(onlineGame.last_move_at||onlineGame.clock_started_at);
    lastClockAt=Date.now();tickClock();
    if(isPremove===true)kfMultiArm(onlineGame);
    // A player may have selected their next piece while this move was still
    // pending. The move is committed now, so publish the staged first premove.
    if(kfPremoveQueued===kfMultiPremoveQueue[0]&&kfPremoveQueued&&
       !kfPremoveQueued.serverPending&&!kfPremoveQueued.serverReady&&
       !kfPremoveQueued.expectedFen&&onlineGame.turn!==m.color){
      kfQueueServerPremove(kfPremoveQueued);

    }

  } catch(err) {
    kfMultiReset();
    // Network failures must not leave the clock with a fake confirmed turn.
    if(kfClockBeforeMove){
      clockPerfBaseWhite=kfClockBeforeMove.white;
      clockPerfBaseBlack=kfClockBeforeMove.black;
      clockPerfAnchor=kfClockBeforeMove.anchor;
      clockPerfTurn=kfClockBeforeMove.perfTurn;
      if(onlineGame)onlineGame.turn=kfClockBeforeMove.turn;
    }
    if(game && m)game.undo();
    kfPendingClockMove=false;
    tickClock();
    draw();
    say("Move confirmation failed. Reconnecting…",{error:true});
    console.warn("[Kingsfall clock] move request failed",err);
  } finally {
    if(optimisticPaint != null) clearTimeout(optimisticPaint);
    submittingMove=false;kfPendingClockMove=false;kfClockBeforeMove=null;
    // Apply the newest buffered Realtime update before the fallback fetch.
    // This is especially important when both players use fast premoves.
    if(onlineGameId===submittedGameId)kfDrainDeferredGameRow();
    // Reconcile once with the server after ignored in-flight/realtime snapshots.
    if(onlineGameId === submittedGameId){
      kfScheduleMoveReconcile(submittedGameId);
    }
  }
}

/* ===== askPromotion ===== */
function askPromotion(color,allowCancel){
  return new Promise(function(resolve){
    var dlg = $("promotionDialog"), grid = $("promoGrid");
    grid.innerHTML = "";
    var pieces = ["q", "r", "b", "n"];
    for(var i=0;i<pieces.length;i++){
      (function(type){
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "promo-btn";
        btn.title = names[type];
        btn.innerHTML = svg({color: color, type: type});
        btn.onclick = function(){ dlg.close(); resolve(type); };
        grid.appendChild(btn);
      })(pieces[i]);
    }
    dlg.oncancel = function(e){ e.preventDefault(); dlg.close(); resolve(allowCancel ? null : "q"); };
    dlg.showModal();
  });
}

/* ============ AUTH ============ */
function closeAuthDialog(){
  var dialog=$("authDialog");
  if(dialog) dialog.classList.remove("is-open");
}
function kfIsCountryCode(code){return typeof code === "string" && /^[A-Z]{2}$/.test(code) && code !== "XX";}
function kfFlagEmoji(code){if(!/^[A-Z]{2}$/.test(code||""))return "";return String.fromCodePoint(code.charCodeAt(0)+127397,code.charCodeAt(1)+127397);}
async function kfDetectCountry(){
  try {
    var result = await withTimeout(sb.rpc("kf_connection_country"), 2000);
    return !result.error && kfIsCountryCode(result.data) ? result.data : "";
  } catch (error) {
    return "";
  }
}
function kfShowsFlag(metadata){
  return typeof metadata.show_country_flag === "boolean"
    ? metadata.show_country_flag : kfIsCountryCode(metadata.country_code);
}
function openAuth(m){
  mode = m;
  $("authForm").reset();
  $("authMessage").textContent = currentUser && currentUser.is_anonymous
    ? "Signing in or creating a new account will replace this guest profile. Guest results may not transfer."
    : "";
  $("authMessage").classList.remove("error");
  var up = m === "signup";
  var reset = m === "reset";
  var recovery = m === "recovery";
  $("authTitle").textContent = recovery ? "Choose a new password" : reset ? "Reset your password" : up ? "Create your account" : "Sign in";
  $("submit").textContent = recovery ? "Save new password" : reset ? "Email reset link" : up ? "Create account" : "Sign In";
  $("switchText").textContent = up ? "Already have an account?" : "New to Kingsfall?";
  $("switch").textContent = up ? "Sign in" : "Create an account";
  $("authSwitchWrap").hidden = recovery;
  $("authForgotWrap").hidden = m !== "signin";
  $("authEmailLabel").hidden = recovery;
  $("email").hidden = recovery;
  $("email").required = !recovery;
  $("authPasswordLabel").hidden = reset;
  $("authPasswordLabel").textContent = recovery ? "New password" : "Password";
  $("password").hidden = reset;
  $("password").required = !reset;
  $("password").autocomplete = (up || recovery) ? "new-password" : "current-password";
  $("signupNameWrap").hidden = !up;
  $("signupName").required = up;
  $("signupCountryOption").hidden = !up;
  $("signupFlagEnabled").checked = false;
  $("authDialog").classList.add("is-open");
  if(window.kfTranslateUi)window.kfTranslateUi();
  setTimeout(function(){var field=$(recovery?"password":up?"signupName":"email");if(field)field.focus();},50);
}
$("signIn").onclick = null;
$("signUp").onclick = null;
$("close").onclick = closeAuthDialog;
$("switch").onclick = function(){ openAuth(mode === "signup" ? "signin" : "signup"); };
$("authForgot").onclick = function(){ window.location.href = "reset-password.html"; };

$("authForm").addEventListener("submit", async function(e){
  e.preventDefault();
  if(!sb){ $("authMessage").textContent = "Supabase did not load."; return; }
  var submitMode = mode;
  var email = $("email").value.trim(), password = $("password").value;
  var submit = $("submit");
  submit.disabled = true;
  submit.textContent = "Please wait…";
  $("authMessage").textContent = "";
  $("authMessage").classList.remove("error");
  try{
    if(submitMode === "reset"){
      window.location.href = "reset-password.html";
      return;
      var resetReply = await withTimeout(sb.auth.resetPasswordForEmail(email, {redirectTo: REDIRECT + "?kf_reset=1"}), 15000);
      if(resetReply.error) throw resetReply.error;
      $("authMessage").textContent = "If this email belongs to a Kingsfall account, a password reset link will arrive shortly. Check spam too.";
      return;
    }
    if(submitMode === "recovery"){
      var recoverySession = await withTimeout(sb.auth.getSession(), 12000);
      if(recoverySession.error || !recoverySession.data || !recoverySession.data.session) throw new Error("Recovery session missing. Please open a fresh password reset email link.");
      var updateReply = await withTimeout(sb.auth.updateUser({password: password}), 15000);
      if(updateReply.error) throw updateReply.error;
      $("authMessage").textContent = "Password updated successfully.";
      kfRecoveryRequested = false;
      try { window.history.replaceState(null, "", window.location.pathname); } catch(ignore) {}
      // Do not sign out here: the recovery link creates an authenticated session.
      return;
    }
    var result;
    if(submitMode === "signup"){
      var uname = ($("signupName").value || "").trim();
      var showFlag = $("signupFlagEnabled").checked;
      var countryCode = await kfDetectCountry();
      result = await withTimeout(sb.auth.signUp({email: email, password: password, options: {emailRedirectTo: REDIRECT, data: {username: uname, registration_country: countryCode, show_country_flag: showFlag, country_code: showFlag ? countryCode : "", ui_language: (window.kfGetLanguage ? window.kfGetLanguage() : "en")}}}), 15000);
    } else {
      result = await withTimeout(sb.auth.signInWithPassword({email: email, password: password}), 15000);
    }
    if(result.error) throw result.error;
    var signedInUser = submitMode === "signin"
      ? (result.data && (result.data.user || (result.data.session && result.data.session.user)))
      : (result.data && result.data.session ? (result.data.user || result.data.session.user) : null);
    if(submitMode === "signup"){
      $("authMessage").textContent = result.data.session ? "Account created and signed in." : "Account created. Check your email to confirm.";
    } else {
      $("authMessage").textContent = "Signed in successfully.";
    }
    // Never wait for getSession() after a successful login. Use the user returned
    // by signInWithPassword so a stalled session read cannot trap the modal.
    applyAuthUser(signedInUser || null);
    if(submitMode === "signin") closeAuthDialog();
  } catch(err){
    var authErrorText=String(err&&err.message||"Authentication failed.");
    if(submitMode==="signin" && /bann?ed|ban_duration|user is banned/i.test(authErrorText)){
      rememberBannedAccount();
      showBannedAccountGate();
      if($("authDialog").classList.contains("is-open"))closeAuthDialog();
    }else{
      $("authMessage").textContent = authErrorText;
      $("authMessage").classList.add("error");
    }
  } finally {
    submit.disabled = false;
    submit.textContent = submitMode === "recovery" ? "Save new password" : submitMode === "reset" ? "Email reset link" : submitMode === "signup" ? "Create account" : "Sign In";
  }
});

// Ban status is account-specific and must never persist as a browser-wide flag.
function rememberBannedAccount(){}
function clearRememberedBan(){}
function showBannedAccountGate(){
  $("accountGateTitle").textContent="Account banned";
  $("accountGateMessage").textContent="This account has been banned from Kingsfall. Sign out to use a different account.";
  $("accountGateRetry").hidden=false;
  $("accountGateRetry").textContent="Sign in with another account";
  $("accountGateSignOut").hidden=true;
  $("accountGate").hidden=false;
  document.body.classList.add("account-restricted");
}
// A ban-status request must never block sign-in or the rest of the app.
var _banStatusCheckId=0;
function withTimeout(promise,ms){
  var timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise(function(_,reject){
      timer=setTimeout(function(){reject(new Error("Ban status check timed out"));},ms);
    })
  ]).finally(function(){clearTimeout(timer);});
}
// Do not restore a previous account's ban overlay from shared localStorage.
async function verifyAccountBanStatus(user){
  var gate=$("accountGate");
  var checkId=++_banStatusCheckId;
  if(!gate)return;
  if(!user){
    gate.hidden=true;
    document.body.classList.remove("account-restricted");
    return;
  }
  try{
    var result=await withTimeout(
      sb.functions.invoke("kf-admin",{body:{action:"get_ban_status",user_id:user.id}}),
      7000
    );
    // Ignore late responses belonging to an older account/session.
    if(checkId!==_banStatusCheckId)return;
    if(result.error)throw result.error;
    if(result.data&&result.data.banned){rememberBannedAccount();showBannedAccountGate();}
    else{clearRememberedBan();gate.hidden=true;document.body.classList.remove("account-restricted");}
  }catch(error){
    if(checkId!==_banStatusCheckId)return;
    // Ban API failure/timeout must not freeze the application.
    // Auth bans are also enforced by Supabase during sign-in and token refresh.
    console.error("Account ban status check failed; keeping the app interactive:",error);
    gate.hidden=true;
    document.body.classList.remove("account-restricted");
  }
}
$("accountGateRetry").addEventListener("click",async function(){
  var button=this;
  button.disabled=true;
  try{
    var sr=sb?await sb.auth.getSession():null;
    var session=sr&&sr.data&&sr.data.session;
    if(session&&sb){
      // Keep account switching possible even if the banned session cannot refresh remotely.
      var signedOut=await sb.auth.signOut({scope:"local"});
      if(signedOut.error)throw signedOut.error;
    }
    clearRememberedBan();
    $("accountGate").hidden=true;
    document.body.classList.remove("account-restricted");
    currentUser=null;
    $("userBadge").textContent="";
    $("avatarThumb").style.display="none";
    $("signIn").hidden=false;
    $("signUp").hidden=false;
    $("signOut").hidden=true;
    openAuth("signin");
  }catch(error){
    $("accountGateMessage").textContent="Could not switch accounts: "+String(error&&error.message||error);
  }finally{
    button.disabled=false;
  }
});
$("accountGateSignOut").addEventListener("click",function(){$("signOut").click();});
function applyAuthUser(user){
  if(window.kfAdoptAccountLanguage)window.kfAdoptAccountLanguage(user);
  var isGuest=!!(user && user.is_anonymous);
  var username = user && user.user_metadata ? user.user_metadata.username : null;
  var avatarUrl = user && user.user_metadata ? user.user_metadata.avatar_url : null;
  $("userBadge").textContent = username || (isGuest ? "Guest" : (user ? (user.email || "Player") : ""));
  var metadata = user && user.user_metadata || {};
  var flagCode = kfShowsFlag(metadata) && (metadata.registration_country || metadata.country_code);
  var flag=$("profileFlagBadge");
  flag.textContent=kfIsCountryCode(flagCode)?kfFlagEmoji(flagCode):"";
  flag.style.display=user&&flag.textContent?"inline-block":"none";
  $("userBadge").title = isGuest ? "Temporary guest · stored on this device" :
    username ? ("Signed in as " + username) : (user ? (user.email || "Player") : "");
  $("avatarThumb").src = avatarUrl || defaultAvatar();
  $("avatarThumb").style.display = user ? "block" : "none";
  // Guests can still choose to create a permanent account or sign in.
  $("signIn").hidden = !!user && !isGuest;
  $("signUp").hidden = !!user && !isGuest;
  $("signOut").hidden = !user;
  $("signOut").textContent = isGuest ? "Exit Guest" : "Sign Out";
  configureAdminAccess(user);
  loadFeatureFlags();
  // Ban lookup is deliberately detached from the authentication/UI path.
  verifyAccountBanStatus(user);
}
async function updateAuth(userOverride){
  if(!sb) return;
  var user;
  if(arguments.length){
    user = userOverride || null;
  } else {
    // A stuck session read must not leave startup/auth UI pending forever.
    var res = await withTimeout(sb.auth.getSession(), 8000);
    var session = res.data && res.data.session ? res.data.session : null;
    user = session ? session.user : null;
  }
  applyAuthUser(user);
}
// Each open document renews its own lease on the shared anonymous session.
var kfGuestTabId = crypto.randomUUID();
var kfGuestSession = null;
var kfGuestHeartbeat = null;
var kfGuestPageLeft = false;
function kfCloseGuestTab(session){
  if(!session) return;
  fetch(SUPABASE_URL + "/rest/v1/rpc/kf_guest_tab", {
    method:"POST", keepalive:true,
    headers:{apikey:SUPABASE_KEY, Authorization:"Bearer " + session.access_token, "Content-Type":"application/json"},
    body:JSON.stringify({p_tab:kfGuestTabId,p_close:true})
  }).catch(function(){ /* Server expiry also covers interrupted connections. */ });
}
async function kfGuestIsLive(session){
  const result = await sb.rpc("kf_guest_tab",{p_tab:kfGuestTabId,p_close:false});
  if(result.error) throw result.error;
  if(result.data === true) return true;
  const latest = await sb.auth.getSession();
  if(latest.data.session?.user.id === session.user.id && latest.data.session.user.is_anonymous){
    await sb.auth.signOut({scope:"local"});
  }
  return false;
}
function kfRefreshGuestTab(){
  if(!kfGuestPageLeft && kfGuestSession) kfGuestIsLive(kfGuestSession).catch(function(){});
}
function kfTrackGuest(session){
  const next = session?.user.is_anonymous ? session : null;
  const changed = next?.user.id !== kfGuestSession?.user.id;
  if(changed) kfCloseGuestTab(kfGuestSession);
  kfGuestSession = next;
  if(!changed) return;
  clearInterval(kfGuestHeartbeat);
  if(next){
    setTimeout(kfRefreshGuestTab,0);
    kfGuestHeartbeat = setInterval(kfRefreshGuestTab,60000);
  }
}
window.addEventListener("pagehide",function(){
  kfGuestPageLeft = true;
  kfCloseGuestTab(kfGuestSession);
});
window.addEventListener("pageshow",function(event){
  if(event.persisted) kfGuestTabId = crypto.randomUUID();
  kfGuestPageLeft = false;
  if(event.persisted) kfRefreshGuestTab();
});
document.addEventListener("visibilitychange",function(){ if(!document.hidden) kfRefreshGuestTab(); });
var kfGuestSignInPending=null;
async function kfEnsurePlaySession(){
  if(!sb)throw new Error("Supabase is unavailable.");
  var existing=await withTimeout(sb.auth.getSession(),9000);
  if(existing.error)throw existing.error;
  if(existing.data&&existing.data.session&&existing.data.session.user){
    const session=existing.data.session;
    if(!session.user.is_anonymous || await kfGuestIsLive(session)){
      currentUser=session.user;
      return session;
    }
  }
  if(kfGuestSignInPending)return kfGuestSignInPending;
  kfGuestSignInPending=(async function(){
    var guestName="Guest-"+crypto.randomUUID().replace(/-/g,"").slice(0,6).toUpperCase();
    var result=await withTimeout(sb.auth.signInAnonymously({
      options:{data:{username:guestName}}
    }),15000);
    if(result.error){
      var msg=String(result.error.message||"");
      if(/anonymous.*(disabled|not enabled)|signups.*disabled|anonymous.*not allowed/i.test(msg)){
        throw new Error("Guest access is disabled in Supabase Auth. Enable Anonymous Sign-Ins in Authentication → Providers.");
      }
      throw result.error;
    }
    if(!result.data||!result.data.session||!result.data.session.user)
      throw new Error("Could not create a guest session.");
    kfTrackGuest(result.data.session);
    if(!await kfGuestIsLive(result.data.session)) throw new Error("Guest session expired. Try again.");
    currentUser=result.data.session.user;
    applyAuthUser(currentUser);
    return result.data.session;
  })();
  try{return await kfGuestSignInPending;}
  finally{kfGuestSignInPending=null;}
}
  /* ===== PROFILE ===== */
$("avatarThumb").onclick = async function(){
  if(!sb || !currentUser) return;
  var res = await sb.auth.getUser();
  var user = res.data ? res.data.user : null;
  if(!user) return;
  $("profileMessage").textContent = "";
  $("profileMessage").classList.remove("error");
  $("profileName").value = (user.user_metadata && user.user_metadata.username) || "";
  $("profileFlagEnabled").checked = kfShowsFlag(user.user_metadata || {});
  var avatarUrl = user.user_metadata ? user.user_metadata.avatar_url : null;
  $("avatarPreview").src = avatarUrl || defaultAvatar();
  $("avatarFile").value = "";
  $("profileDialog").showModal();
};
$("profileClose").onclick = function(){ $("profileDialog").close(); };
$("changeAvatar").onclick = function(){ $("avatarFile").click(); };
$("avatarFile").addEventListener("change", async function(){
  var file = this.files[0];
  this.value = "";
  if(!sb || !file) return;
  var btn = $("changeAvatar");
  if(btn.disabled) return;
  if(!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 5*1024*1024){
    $("profileMessage").textContent = "Choose a JPG, PNG or WebP image up to 5 MB.";
    $("profileMessage").classList.add("error");
    return;
  }
  btn.disabled = true;
  $("profileMessage").textContent = "Uploading photo…";
  $("profileMessage").classList.remove("error");
  try{
    var userRes = await sb.auth.getUser();
    var user = userRes.data && userRes.data.user;
    if(userRes.error || !user) throw new Error("Please sign in again.");
    var ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    var path = user.id + "/avatar." + ext;
    var upRes = await sb.storage.from("avatars").upload(path, file, {upsert: true, contentType: file.type, cacheControl: "3600"});
    if(upRes.error) throw upRes.error;
    var pub = sb.storage.from("avatars").getPublicUrl(path);
    var avatarUrl = pub.data.publicUrl + "?v=" + Date.now();
    var metaRes = await sb.auth.updateUser({data: {avatar_url: avatarUrl}});
    if(metaRes.error) throw metaRes.error;
    $("avatarPreview").src = avatarUrl;
    $("avatarPreview").hidden = false;
    await updateAuth();
    $("profileMessage").textContent = "Profile photo saved successfully.";
    $("avatarFile").value = "";
  } catch(err){
    $("profileMessage").textContent = (err.message || "Photo upload failed.");
    $("profileMessage").classList.add("error");
  } finally {
    btn.disabled = false;
  }
});
$("profileForm").addEventListener("submit", async function(e){
  e.preventDefault();
  if(!sb) return;
  var username = ($("profileName").value || "").trim();
  if(username.length < 3 || username.length > 20){
    $("profileMessage").textContent = "Username must be 3–20 characters.";
    $("profileMessage").classList.add("error");
    return;
  }
  if(!/^[A-Za-z0-9_ -]+$/.test(username)){
    $("profileMessage").textContent = "Username can only contain letters, numbers, spaces, underscores and hyphens.";
    $("profileMessage").classList.add("error");
    return;
  }
  var btn = $("profileSave");
  btn.disabled = true;
  btn.textContent = "Saving…";
  $("profileMessage").textContent = "";
  try{
    var metadata = currentUser && currentUser.user_metadata || {};
    var showFlag = $("profileFlagEnabled").checked;
    var countryCode = metadata.registration_country || await kfDetectCountry();
    var res = await sb.auth.updateUser({data: {username: username,registration_country: countryCode,show_country_flag: showFlag,country_code: showFlag ? (countryCode || metadata.country_code || "") : "",ui_language: (window.kfGetLanguage ? window.kfGetLanguage() : "en")}});
    if(res.error) throw res.error;
    if(res.data&&res.data.user){currentUser=res.data.user;applyAuthUser(res.data.user);}else{await updateAuth();}
    $("profileMessage").textContent = "Profile saved successfully.";
    setTimeout(function(){ $("profileDialog").close(); }, 700);
  } catch(err){
    $("profileMessage").textContent = err.message || "Could not save username.";
    $("profileMessage").classList.add("error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save profile";
  }
});

/* ===== SIGN OUT (FIX: reset autoJoinChecked) ===== */
$("signOut").onclick = async function(){
  if(!sb) return;
  if(currentUser && currentUser.is_anonymous &&
      !confirm("Exit Guest? This temporary account cannot be recovered after signing out."))return;
  var res = await sb.auth.signOut();
  if(res.error){
    say(res.error.message, {error: true});
  } else {
    await leaveOnlineState();
    await updateAuth();
    autoJoinChecked = false;
    $("historySection").classList.remove("show");
    say("Signed out.", {silentToast: true});
  }
};

/* ===== BOARD BUILD & DRAW ===== */
function buildBoardOnce(){
  boardEl.innerHTML = "";
  _sqEls = {};
  for(var vr=0;vr<8;vr++){
    for(var vc=0;vc<8;vc++){
      var r = flipped ? 7-vr : vr;
      var c = flipped ? 7-vc : vc;
      var s = sq(r, c);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "square " + ((r+c)%2 === 0 ? "light" : "dark");
      b.dataset.sq = s;
      b.onclick = (function(square){
        return function(){ clickSquare(square); };
      })(s);
      boardEl.appendChild(b);
      _sqEls[s] = b;
    }
  }
  _boardBuilt = true;
  _boardFlipped = flipped;
}

function draw(){
  if(!game) return;
  paintClocks();
  if(!_boardBuilt || _boardFlipped !== flipped){
    buildBoardOnce();
  }
  // Read the chess position and premove display state once per board paint.
  // The server-authoritative game and the premove queue are not mutated here.
  var boardSnapshot = game.board();
  var gameTurn = game.turn();
  var pmColor = onlineGame && currentUser ?
    (onlineGame.white_id===currentUser.id?"w":onlineGame.black_id===currentUser.id?"b":null):null;
  var pmVisible = !!(onlineGameId && onlineGame && currentUser &&
    onlineGame.status==="active" && pmColor!==gameTurn);
  var pmPreview = !!(pmVisible && pmColor && kfPremoveQueued && kfPremoveGameId===onlineGameId);
  var premoveToSquares = Object.create(null);
  var premoveFromSquares = Object.create(null);
  var projectedSquares = pmPreview && kfMultiPremoveQueue.length ? Object.create(null) : null;
  for(var qi=0;qi<kfMultiPremoveQueue.length;qi++){
    var queuedPm = kfMultiPremoveQueue[qi];
    premoveToSquares[queuedPm.to] = true;
    premoveFromSquares[queuedPm.from] = true;
    if(projectedSquares){
      // Same sequential visual-only overlay as kfProjectedPiece().
      projectedSquares[queuedPm.from] = null;
      projectedSquares[queuedPm.to] = {type:queuedPm.promotion||queuedPm.piece.type,color:queuedPm.piece.color};
    }
  }
  var targetsSet = Object.create(null);
  for(var k=0;k<targets.length;k++) targetsSet[targets[k].to] = true;
  for(var vr=0;vr<8;vr++){
    for(var vc=0;vc<8;vc++){
      var r = flipped ? 7-vr : vr;
      var c = flipped ? 7-vc : vc;
      var s = sq(r, c);
      // chess.js board() is indexed from rank 8 to 1, matching sq(r,c).
      var p = projectedSquares && s in projectedSquares ?
        projectedSquares[s] : boardSnapshot[r][c];
      var b = _sqEls[s];
      if(!b) continue;
      var kfSquareMarkupCache = "";
      b.classList.toggle("selected", selected === s);
      b.classList.toggle("kf-premove-from",pmVisible&&kfPremoveSelected===s);
      b.classList.toggle("kf-premove-to",pmVisible&&!!premoveToSquares[s]);
      b.classList.toggle("kf-premove-queued",pmVisible&&!!premoveFromSquares[s]);
      b.classList.remove("humil-dim", "humil-target");
      b.style.backgroundImage = "";
      b.classList.toggle("kf-last-from",!!(last && last.from===s && !humilSelecting));
      b.classList.toggle("kf-last-to",!!(last && last.to===s && !humilSelecting));
      if(humilSelecting){
        if(isHumilEligiblePiece(s)){
          b.classList.add("humil-target");
        } else {
          b.classList.add("humil-dim");
        }
      }
      var aria = s + (p ? ", " + (p.color === "w" ? "white" : "black") + " " + names[p.type] : "");
      b.setAttribute("aria-label", aria);
      if(p) kfSquareMarkupCache += svg(p);
      if(targetsSet[s] && !humilSelecting){
        kfSquareMarkupCache += p ? '<span class="ring"></span>' : '<span class="dot"></span>';
      }
      if((flipped ? r === 7 : r === 0) || c === (flipped ? 7 : 0)){
        kfSquareMarkupCache += '<span class="coords">' +
          (c === (flipped ? 7 : 0) ? 8-r : files[c]) + '</span>';
      }
      // Avoid rebuilding all 64 piece SVGs on unchanged state.
      // Fast premove paints explicitly invalidate the affected square.
      if(b._kfMarkupCache !== kfSquareMarkupCache){
        b.innerHTML = kfSquareMarkupCache;
        b._kfMarkupCache = kfSquareMarkupCache;
      }
    }
  }
  var turn = game.turn() === "w" ? "White" : "Black";
  var statusText;
  if(game.in_checkmate()) statusText = "Checkmate — " + (turn === "White" ? "Black" : "White") + " wins";
  else if(game.in_draw()) statusText = "Draw";
  else statusText = turn + " to move" + (game.in_check() ? " · Check" : "");
  $("status").textContent = statusText+(kfMultiPremoveQueue.length?" · Premoves: "+kfMultiPremoveQueue.length:"");
  $("top").textContent = flipped ? "White pieces" : "Black pieces";
  $("bottom").textContent = flipped ? "Black pieces" : "White pieces";
  if(!onlineGameId && !computerMode) $("undo").disabled = !game.history().length;
  updateHistory();
}

var kfLastHistorySignature = null;
function updateHistory(){
  var h = game.history();
  // Do not rebuild the entire move list on piece selections or clock refreshes.
  var signature = h.join("\u001f");
  if(kfLastHistorySignature === signature) return;
  kfLastHistorySignature = signature;
  if(!h.length){ historyEl.textContent = "No moves yet."; return; }
  historyEl.innerHTML = "";
  for(var i=0;i<h.length;i+=2){
    var row = document.createElement("div");
    row.className = "move";
    var cells = ["" + (i/2 + 1) + ".", h[i] || "", h[i+1] || ""];
    for(var j=0;j<cells.length;j++){
      var span = document.createElement("span");
      span.textContent = cells[j];
      row.appendChild(span);
    }
    historyEl.appendChild(row);
  }
  historyEl.scrollTop = historyEl.scrollHeight;
}

/* ===== Browser-only premove: legality checked on the newly received turn ===== */
var kfPremoveSelected=null,kfPremoveQueued=null,kfPremoveGameId=null;
var kfPremoveQueueSerial=0;
var kfMultiPremoveQueue=[],kfMultiPremovePending=false;
var kfPairRequestChain=Promise.resolve();
// Cache a single authoritative PGN replay across the several premove checks
// caused by one fast Realtime snapshot. Never trust this cache across PGNs.
var kfPremoveReplayPgn=null,kfPremoveReplayIndex=null;
var kfPremoveSyncTimer=null,kfPremoveSyncGameId=null;
function kfScheduleMoveReconcile(gid){
  // Rapid alternating premoves should not queue one full SELECT per move.
  // The latest state is still applied immediately via Realtime.
  if(kfPremoveSyncTimer!==null)clearTimeout(kfPremoveSyncTimer);
  kfPremoveSyncGameId=gid;
  kfPremoveSyncTimer=setTimeout(function(){
    kfPremoveSyncTimer=null;
    if(onlineGameId===gid)syncGameState(gid);
  },240);
}
function kfMultiReset(){kfMultiPremoveQueue=[];kfMultiPremovePending=false;kfPremoveSelected=null;kfPremoveQueued=null;}
function kfProjectedPiece(s){
  var p=game.get(s);
  kfMultiPremoveQueue.forEach(function(x){
    if(x.from===s)p=null;
    if(x.to===s)p={type:x.promotion||x.piece.type,color:x.piece.color};
  });
  return p;
}
// Check committed move history when realtime skips the intermediate premove
// snapshot (possible during very rapid exchanges).
// Resolve a committed premove using the full server PGN, including when
// Realtime skipped several intermediate turns of a very fast exchange.
function kfPremoveCommittedAfterFen(row,pm){
  if(!row||!pm||!pm.expectedFen||!row.pgn)return null;
  if(kfPremoveReplayPgn!==row.pgn){
    kfPremoveReplayPgn=row.pgn;
    kfPremoveReplayIndex=Object.create(null);
    try{
      var replay=new Chess();
      if(!replay.load_pgn(row.pgn))throw Error("Invalid move history");
      var moves=replay.history({verbose:true});
      replay=new Chess(moves.length && moves[0].before || undefined);
      var previousFen=null;
      for(var j=0;j<moves.length;j++){
        var beforeFen=replay.fen(),mv=moves[j];
        replay.move(mv);
        // Expected FEN precedes the opponent's move. Our premove must
        // match the *following* move, not the opponent move itself.
        if(j>0){
          var key=previousFen+"|"+mv.from+"|"+mv.to+"|"+(mv.promotion||"");
          kfPremoveReplayIndex[key]=replay.fen();
        }
        previousFen=beforeFen;
      }
    }catch(e){kfPremoveReplayIndex=Object.create(null);}
  }
  return kfPremoveReplayIndex[
    pm.expectedFen+"|"+pm.from+"|"+pm.to+"|"+(pm.promotion||"")
  ]||null;
}
function kfMultiConfirmedInHistory(row,pm){
  return !!kfPremoveCommittedAfterFen(row,pm);
}
function kfMultiAdvance(row){
  var old=kfMultiPremoveQueue.length?kfMultiPremoveQueue.shift():null;
  var afterFen=old&&row?kfPremoveCommittedAfterFen(row,old):null;
  // The immediate one-step server event itself is also a trusted snapshot.
  if(!afterFen&&old&&row&&row.last_move&&
     row.last_move.from===old.from&&row.last_move.to===old.to&&
     row.turn!==(row.white_id===currentUser.id?"w":"b"))
    afterFen=row.fen;
  kfPremoveSelected=null;kfPremoveQueueSerial++;
  if(kfMultiPremoveQueue.length&&afterFen&&kfMultiPremoveQueue[0].serverReady){
    var next=kfMultiPremoveQueue[0];
    next.expectedFen=afterFen;
    kfPremoveQueued=next;
    next.serverReady=true;
    kfMultiPremovePending=false;
    // Remaining premoves are already queued in PostgreSQL.
    if(kfMultiPremoveQueue.some(function(pm){return !pm.serverReady;}))kfQueueAdditionalServerPremoves();
  }else{
    kfPremoveQueued=null;
    kfMultiPremovePending=true;
  }
}
function kfMultiArm(row){
  if(!kfMultiPremovePending||!currentUser||row.status!=="active")return;
  var mine=row.white_id===currentUser.id?"w":row.black_id===currentUser.id?"b":null;
  if(!mine||row.turn===mine)return;
  kfMultiPremovePending=false;
  if(!kfMultiPremoveQueue.length)return;
  kfPremoveQueued=kfMultiPremoveQueue[0];
  kfQueueServerPremove(kfPremoveQueued);
}
function kfCancelQueuedServerPremove(){
  kfPremoveQueueSerial++;
  
  var gid=onlineGameId;
  // Serialized with in-flight queue writes: a delayed old response must
  // never reinstall a cancelled premove.
  if(sb&&gid)kfPairRequestChain=kfPairRequestChain.catch(function(){})
    .then(function(){return sb.rpc("kf_cancel_premove_compact_v3",{p_game_id:gid});});
}
// The client stores at most three *moves*, never speculative opponent FEN/PGN.
// PostgreSQL generates the authoritative successor position on execution.
function kfQueueServerPremove(pm){
  if(!sb||!onlineGame||!onlineGameId||!pm)return;
  var expected=onlineGame.fen,gid=onlineGameId;
  pm.expectedFen=expected;
  kfPublishPremoveQueue(gid,expected);
}
function kfQueueAdditionalServerPremoves(){
  var head=kfMultiPremoveQueue[0];
  if(sb && head && head.expectedFen && onlineGameId)
    kfPublishPremoveQueue(onlineGameId,head.expectedFen);
}
function kfPublishPremoveQueue(gid,expected){
  var pending=kfMultiPremoveQueue.slice(),head=pending[0];
  if(!head||pending.length>3)return;
  var serial=++kfPremoveQueueSerial;
  head.serverPending=true;
  var items=pending.map(function(pm){
    return {from:pm.from,to:pm.to,promotion:pm.promotion||null};
  });
  kfPairRequestChain=kfPairRequestChain.catch(function(){}).then(async function(){
    if(serial!==kfPremoveQueueSerial||gid!==onlineGameId||kfMultiPremoveQueue[0]!==head)return;
    try{
      var res=await sb.rpc("kf_queue_premove_compact_v3",{
        p_game_id:gid,p_expected_fen:expected,p_moves:items
      });
      if(gid!==onlineGameId||kfMultiPremoveQueue[0]!==head)return;
      if(!res.error&&res.data===true){
        pending.forEach(function(pm){pm.serverReady=true;});
      }else if(serial===kfPremoveQueueSerial){
        if(res.error)say("Premove queue could not be saved.",{error:true});
        kfScheduleMoveReconcile(gid);
      }
    }catch(error){
      if(serial===kfPremoveQueueSerial){
        say("Premove queue could not be saved.",{error:true});
        kfScheduleMoveReconcile(gid);
      }
    }finally{
      if(serial===kfPremoveQueueSerial)head.serverPending=false;
    }
  });
}
// Fast, speculative premove geometry. Opponent pieces may move before
// execution, so this deliberately does not claim future legality.
function kfPremoveGeometry(from,to,color){
  if(!/^[a-h][1-8]$/.test(from)||!/^[a-h][1-8]$/.test(to)||from===to)return false;
  var piece=kfProjectedPiece(from);
  if(!piece||piece.color!==color)return false;
  var x=to.charCodeAt(0)-from.charCodeAt(0),y=Number(to[1])-Number(from[1]);
  var ax=Math.abs(x),ay=Math.abs(y),t=piece.type;
  if(t==="n")return (ax===1&&ay===2)||(ax===2&&ay===1);
  if(t==="k"){
    if(Math.max(ax,ay)===1)return true;
    var rook=kfProjectedPiece((x>0?"h":"a")+from[1]);
    return y===0&&ax===2&&rook&&rook.color===color&&rook.type==="r"&&
      !kfProjectedPiece((x>0?"f":"d")+from[1])&&(x>0||!kfProjectedPiece("b"+from[1]));
  }
  if(t==="p"){
    var d=color==="w"?1:-1;
    return (ax===1&&y===d)||(x===0&&(y===d||(y===2*d&&
      Number(from[1])===(color==="w"?2:7)&&
      !kfProjectedPiece(from[0]+(Number(from[1])+d)))));
  }
  var sliding=(t==="b"&&ax===ay&&ax>0)||
    (t==="r"&&(x===0)!==(y===0))||
    (t==="q"&&((ax===ay&&ax>0)||((x===0)!==(y===0))));
  if(!sliding)return false;
  for(var i=1;i<Math.max(ax,ay);i++){
    var sq=String.fromCharCode(from.charCodeAt(0)+Math.sign(x)*i)+
      (Number(from[1])+Math.sign(y)*i);
    var blocker=kfProjectedPiece(sq);
    if(blocker&&blocker.color===color)return false;
  }
  return true;
}
async function kfHandlePremoveSquare(square,color){
  if(!onlineGameId||!onlineGame||onlineGame.status!=="active")return;
  if(kfPremoveGameId!==onlineGameId){kfPremoveGameId=onlineGameId;kfMultiReset();}
  if(square===kfPremoveSelected){kfPremoveSelected=null;draw();return;}
  if(!kfPremoveSelected&&kfMultiPremoveQueue.some(function(x){
    return x.from===square||x.to===square;
  })&&!((kfProjectedPiece(square)||{}).color===color)){
    kfCancelQueuedServerPremove();kfMultiReset();draw();return;
  }
  var piece=kfProjectedPiece(square);
  if(piece&&piece.color===color&&
      (!kfPremoveSelected||!kfPremoveGeometry(kfPremoveSelected,square,color))){
    kfPremoveSelected=square;draw();return;
  }
  if(!kfPremoveSelected)return;
  var from=kfPremoveSelected;kfPremoveSelected=null;
  if(!kfPremoveGeometry(from,square,color)){draw();return;}
  if(kfMultiPremoveQueue.length>=3){
    say("Maximum three premoves.",{silentToast:true});draw();return;
  }
  var src=kfProjectedPiece(from),promotion=null;
  if(src.type==="p"&&square[1]===(color==="w"?"8":"1")){
    var gid=onlineGameId;promotion=await askPromotion(color,true);
    if(!promotion||onlineGameId!==gid||onlineGame.status!=="active"||
       game.turn()===color){draw();return;}
  }
  var pm={from:from,to:square,promotion:promotion,piece:src};
  kfMultiPremoveQueue.push(pm);
  if(kfMultiPremoveQueue.length===1&&!kfMultiPremovePending){
    kfPremoveQueued=pm;
    // Selection can precede confirmation, but never send an unconfirmed FEN.
    if(!submittingMove&&!kfPendingClockMove)kfQueueServerPremove(pm);
  }else if(kfMultiPremoveQueue.length>=2){
    // Send the complete pending two- or three-slot queue.
    kfQueueAdditionalServerPremoves();
  }
  draw();
}
function kfStartOptimisticClock(m){
  if(!onlineGameId)return;
  kfClockBeforeMove={
    turn:onlineGame?onlineGame.turn:m.color,
    white:clockPerfBaseWhite,black:clockPerfBaseBlack,
    anchor:clockPerfAnchor,perfTurn:clockPerfTurn
  };
  kfPendingClockMove=true;
  kfRunningClockBlend=null;
  if(clockPerfAnchor!=null){
    var perfNow=performance.now();
    var elapsedFromAnchor=Math.max(0,(perfNow-clockPerfAnchor)/1000);
    if(clockPerfTurn==="w"){
      clockWhite=Math.max(0,clockPerfBaseWhite-elapsedFromAnchor);
      clockBlack=Math.max(0,clockPerfBaseBlack);
    }else{
      clockBlack=Math.max(0,clockPerfBaseBlack-elapsedFromAnchor);
      clockWhite=Math.max(0,clockPerfBaseWhite);
    }
  }
  clockPerfBaseWhite=clockWhite;
  clockPerfBaseBlack=clockBlack;
  clockPerfTurn=game.turn();
  clockPerfAnchor=performance.now();
  lastClockAt=Date.now();
  if(onlineGame)onlineGame.turn=game.turn();
  // Show the next active clock immediately; the 100 ms timer continues it.
  paintClocks();
}
// Paint only squares affected by the incoming move and the premove.
// The full board/history repaint remains scheduled by submitMove.
// This keeps the first visual update independent of the heavy draw() path.
function kfPaintPremoveSquaresImmediately(row,pm){
  if(!_boardBuilt||!game||!_sqEls)return;
  var squares=[pm.from,pm.to];
  if(row&&row.last_move){
    squares.push(row.last_move.from,row.last_move.to);
  }
  var seen={};
  for(var i=0;i<squares.length;i++){
    var s=squares[i],b=_sqEls[s];
    if(!b||seen[s])continue;
    seen[s]=true;
    var p=game.get(s);
    // Fast partial DOM paints must not leave stale full-draw markup caches.
    b._kfMarkupCache=null;
    // Keep the coordinates element intact where it already exists.
    var oldPiece=b.querySelector("svg");
    if(oldPiece)oldPiece.remove();
    if(p)b.insertAdjacentHTML("afterbegin",svg(p));
    b.setAttribute("aria-label",s+(p?", "+(p.color==="w"?"white":"black")+" "+names[p.type]:""));
    b.classList.remove("kf-premove-from","kf-premove-to","kf-premove-queued","selected");
    b.style.backgroundImage=(s===pm.from||s===pm.to)?
      "linear-gradient(#e5bd6545,#e5bd6545)":"";
  }
}
// Render the just-played move before the deferred full board redraw and RPC.
// Only the changed squares are touched. Server validation and clock authority
// are unchanged; submitMove still rolls back rejected moves.
function kfPaintLocalMoveImmediately(m){
  if(!m||!game||!_boardBuilt||_boardFlipped!==flipped)return;
  var squares=[m.from,m.to];
  var flags=m.flags||"";
  if(flags.indexOf("e")!==-1)squares.push(m.to[0]+m.from[1]); // en passant
  if(flags.indexOf("k")!==-1){ // kingside castling rook
    squares.push(m.color==="w"?"h1":"h8",m.color==="w"?"f1":"f8");
  }
  if(flags.indexOf("q")!==-1){ // queenside castling rook
    squares.push(m.color==="w"?"a1":"a8",m.color==="w"?"d1":"d8");
  }
  var seen=Object.create(null);
  for(var i=0;i<squares.length;i++){
    var sqName=squares[i],b=_sqEls[sqName];
    if(!b||seen[sqName])continue;
    seen[sqName]=true;
    var oldPiece=b.querySelector("svg");
    if(oldPiece)oldPiece.remove();
    var piece=game.get(sqName);
    if(piece)b.insertAdjacentHTML("afterbegin",svg(piece));
    var oldMarker=b.querySelector(".dot,.ring");
    if(oldMarker)oldMarker.remove();
    b._kfMarkupCache=null;
    b.classList.remove("selected");
    b.setAttribute("aria-label",sqName+(piece?", "+(piece.color==="w"?"white":"black")+" "+names[piece.type]:""));
    b.style.backgroundImage=(sqName===m.from||sqName===m.to)?
      "linear-gradient(#e5bd6545,#e5bd6545)":"";
  }
}
/* ===== CLICK SQUARE ===== */
async function clickSquare(s){
  if(!game) return;
  // The automatic Roulette opening is display-only; no move is accepted until
  // its server-defined animation timeline has fully completed.
  if(rouletteOpeningAnimating) return;
  if(onlineGame&&onlineGame.is_bloodblade&&!humilApplied&&!humilSelecting){humilSelecting=true;draw();}
  // In online games the server's official clock-start timestamp is the ONLY
  // movement gate. The VS introduction must never add a second delay after
  // White's clock has started. Keep pre-clock Bloodblade sacrifice available.
  if(onlineGameId && !humilSelecting){
    var officialStart = onlineGame && Date.parse(onlineGame.clock_started_at);
    var serverNow = Date.now() + (kfServerOffsetKnown ? kfServerOffsetMs : 0);
    if(!Number.isFinite(officialStart) || serverNow < officialStart){
      say("Get ready... Game starts in a moment!", {silentToast: false});
      return;
    }
  }

  /* Humiliation: sacrifice selection */
  if(humilSelecting){
    if(isHumilEligiblePiece(s)){
      renderSacrificeScene(fsPlayerColor, game.get(s).type);
      $("humilConfirmDialog").showModal();
      var ok = await new Promise(function(resolve){
        $("humilConfirmYes").onclick = function(){ $("humilConfirmDialog").close(); resolve(true); };
        $("humilConfirmNo").onclick  = function(){ $("humilConfirmDialog").close(); resolve(false); };
        $("humilConfirmDialog").oncancel = function(e){ e.preventDefault(); $("humilConfirmDialog").close(); resolve(false); };
      });
      if(ok){
        var color = fsPlayerColor;
        var type = game.get(s) ? game.get(s).type : null;
        if(!type){ exitHumilSelection(); return; }
        humilSelecting = false;
        try {
          await submitHumiliation(s, type);
        } catch(err) {
          say("Humiliation failed: " + (err.message || err), {error: true});
          humilSelecting = true;
          draw();
          return;
        }
      } else {
        if(!(onlineGame&&onlineGame.is_bloodblade))exitHumilSelection();
      }
    } else {
      if(!(onlineGame&&onlineGame.is_bloodblade))exitHumilSelection();
      else say('Sacrifice a highlighted piece first.',{silentToast:true});
    }
    return;
  }

  if(game.game_over() || clockExpired) return;

  if(computerMode){
    var compColor = (computerUserColor === "w") ? "b" : "w";
    if(game.turn() === compColor || computerBusy){
      say("The computer is thinking…", {silentToast: true});
      return;
    }
  }
  if(onlineGameId){
    // Selection is always responsive while a previous move is being confirmed.
    // Submission remains locked in submitMove; this only stages a premove.
    var myColor = null;
    if(onlineGame && currentUser){
      if(onlineGame.white_id === currentUser.id) myColor = "w";
      else if(onlineGame.black_id === currentUser.id) myColor = "b";
    }
    if(!myColor){
      say("Only players may move.",{silentToast:true});
      return;
    }
    if(submittingMove||kfPendingClockMove||game.turn()!==myColor){
      await kfHandlePremoveSquare(s,myColor);return;
    }
    if(kfPremoveSelected||kfPremoveQueued||kfMultiPremoveQueue.length)kfMultiReset();
  }

  var p = game.get(s);
  if(selected && targets.some(function(m){ return m.to === s; })){
    var piece = game.get(selected);
    var promotion = "q";
    if(piece && piece.type === "p" && (s.charAt(1) === "8" || s.charAt(1) === "1")){
      promotion = await askPromotion(piece.color);
    }
   var moveStartedAt = performance.now();
   var m = game.move({from: selected, to: s, promotion: promotion});
if(m){
  last = {from: m.from, to: m.to};
  selected = null;
  targets = [];
  // Paint the two changed piece squares synchronously, without waiting for
  // setTimeout(draw, 0), chess result checks or the network response.
  if(onlineGameId)kfPaintLocalMoveImmediately(m);

 kfStartOptimisticClock(m);

  if(onlineGameId){
    var submission = submitMove(m, Math.floor(clockWhite), Math.floor(clockBlack), moveStartedAt);
    kfPlayPieceTap(m);
    await submission;
    return;
  }
  say(m.san, {silentToast: true});
  draw();
  kfPlayPieceTap(m);
  if(humilApplied || game.history().length > 0) updateHumilBadge();
  if(computerMode && !game.game_over()){
    lastClockAt = Date.now();
    var compColor2 = (computerUserColor === "w") ? "b" : "w";
    if(game.turn() === compColor2) computerTimer = setTimeout(makeComputerMove, 180);
  }
  return;
} 
  }

  if(p && p.color === game.turn()){
    selected = s;
    targets = game.moves({square: s, verbose: true});
    say("", {silentToast: true});
    draw();
  } else {
    selected = null;
    targets = [];
    draw();
  }
}

/* ===== Local buttons ===== */
$("new").onclick = function(){
  if(onlineGameId){ say("You cannot reset an online or tournament game.", {silentToast: true}); return; }
  if(computerMode){
    if(computerTimer){ clearTimeout(computerTimer); computerTimer = null; }
    clockExpired = false;
    lastClockAt = Date.now();
    game = new Chess();
    selected = null;
    targets = [];
    last = null;
    computerBusy = false;
    _boardBuilt = false;
    draw();
    say("New computer game started.", {silentToast: true});
    return;
  }
  if(confirm("Start a new local game?")) start();
};
$("flip").onclick = function(){ flipped = !flipped; draw(); };
$("undo").onclick = function(){
  if(onlineGameId){ say("Undo is unavailable during online games.", {silentToast: true}); return; }
  if(computerMode){
    if(computerTimer){ clearTimeout(computerTimer); computerTimer = null; }
    computerBusy = false;
    if(!game.history().length){ say("Nothing to undo.", {silentToast: true}); return; }
    var count = game.turn() === "w" ? 2 : 1;
    for(var i=0;i<count && game.history().length;i++) game.undo();
    selected = null;
    targets = [];
    last = null;
    draw();
    say("Move undone.", {silentToast: true});
    return;
  }
  if(game.undo()){
    selected = null;
    targets = [];
    last = null;
    say("Last move undone.", {silentToast: true});
    draw();
  }
};
$("fen").onclick = async function(){
  try{
    await navigator.clipboard.writeText(game.fen());
    say("Position copied as FEN.", {silentToast: true});
  } catch(e){
    prompt("Copy this FEN position:", game.fen());
  }
};

/* ===== START / INIT ===== */
function start(){
  resetClocks();
  if(!window.Chess){
    $("status").textContent = "Chess library unavailable";
    say("Could not load chess.js. Check your connection and refresh.", {error: true});
    return;
  }
  game = new Chess();
  selected = null;
  targets = [];
  last = null;
  say("", {silentToast: true});
  _boardBuilt = false;
  draw();
}

function initApp(){
  if(!sb){
    say("Supabase client failed to load.", {error: true});
    return;
  }

  /* Auth state change */
  sb.auth.onAuthStateChange(function(event,session){
    kfTrackGuest(session);
    if(event === "PASSWORD_RECOVERY"){
      // Legacy recovery links may still return to the home page.
      // Preserve the Supabase URL tokens by navigating to the dedicated recovery page.
      var recoverySuffix = window.location.search + window.location.hash;
      window.location.replace("reset-password.html" + recoverySuffix);
      return;
    }
    // Run Supabase requests after the auth callback returns to avoid auth-lock deadlocks.
    setTimeout(function(){
      updateAuth().catch(function(error){ console.error("Auth refresh failed:",error); });
      getCurrentProfile().then(function(){
      checkMyTournamentEntry().then(function(){
        if($("tournDialog").open) renderTournDialog();
        updateTournButton();
      });
      loadHistory();
      setTimeout(checkActiveGameAndJoin, 800);
      });
    }, 0);
  });

  if(kfRecoveryRequested){
    window.location.replace("reset-password.html" + window.location.search + window.location.hash);
    return;
  }

  /* Initial auth check */
  loadFeatureFlags();
  updateAuth().catch(function(error){
    console.error("Initial auth refresh failed:", error);
  }).then(function(){
    getCurrentProfile().then(function(){
      loadTournamentState();
      loadChampion();
      loadHistory();
      setTimeout(checkActiveGameAndJoin, 800);
    }).catch(function(error){
      console.warn("Initial profile load failed:", error);
    });
  });

  /* Network events: a fresh page resets any Supabase request left pending by an outage.
     Save the exact game id first so reconnecting can restore this game even if it is older
     than the normal quick-rejoin search window. */
  window.addEventListener("online", function(){
    console.log("Network back online");
    if(!onlineGameId || reconnectReloadPending) return;
    reconnectReloadPending = true;
    var gameIdToRestore = onlineGameId;
    try { sessionStorage.setItem("kf_reconnect_game_id", gameIdToRestore); } catch(e) {}
    say("اتصال برگشت؛ بازی در حال بازیابی است...", {silentToast: true});
    setTimeout(function(){
      if(navigator.onLine){
        window.location.reload();
      } else {
        reconnectReloadPending = false;
      }
    }, 1500);
  });
  window.addEventListener("offline", function(){
    console.log("Network offline");
    if(onlineGameId) say("اتصال قطع شد. پس از وصل‌شدن، بازی خودکار بازیابی می‌شود.", {silentToast: true});
  });

  /* Boot */
  renderPlayers(null);
  start();
  startTournTick();
  kfStartChampionRefresh();
}

/* Champion loader (moved here so initApp has it) */
var kfChampionRefreshTimer=null;
function kfStartChampionRefresh(){
  if(kfChampionRefreshTimer){clearInterval(kfChampionRefreshTimer);kfChampionRefreshTimer=null;}
  if(document.hidden)return;
  kfChampionRefreshTimer=setInterval(loadChampion,60000);
}
async function loadChampion(){
  if(document.hidden||!sb) return;
  var res = await sb.rpc("kf_get_current_champion");
  if(res.error || !res.data) return;
  var d = res.data;
  var banner = $("championBanner");
  var crownedAt = Date.parse(d.completed_at);
  var withinChampionHour = Number.isFinite(crownedAt) &&
    Date.now() >= crownedAt && Date.now() - crownedAt < 60 * 60 * 1000;
  if(d.status === "champion" && withinChampionHour){
    $("championAvatar").src = d.winner_avatar || defaultAvatar();
    $("championName").textContent = d.winner_username || "Unknown";
    $("championSub").textContent = "Crowned " + fmtTimeLocal(d.completed_at);
    banner.classList.add("show");
  } else {
    banner.classList.remove("show");
  }
}

/* Run! */
  /* PRIVATE ADMIN PANEL */
var adminOwnerId="cc80cc38-f476-4edd-8efc-45e2722f3c4f",adminUsersCache=[],adminFeatureCache={};
function configureAdminAccess(user){
 var ok=!!(!window.kfIsNativeApp&&user&&user.id===adminOwnerId);$("navAdmin").hidden=!ok;
 if(!ok&&$("pageAdmin").classList.contains("active"))showPage("home");
}
function adminEscape(v){return String(v==null?"":v).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];});}
async function adminInvoke(body){
 if(window.kfIsNativeApp||!currentUser||currentUser.id!==adminOwnerId)throw Error("Administration is available on the website only");
 var r=await sb.functions.invoke("kf-admin",{body:body});if(r.error)throw r.error;if(r.data&&r.data.error)throw Error(r.data.error);return r.data;
}
function adminIllegalBoard(a){
 var fen=String(a.position_fen||"");if(fen==="startpos")fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
 var ranks=fen.split(" ")[0].split("/"),pieces={};
 if(ranks.length!==8)return '<p>Board position unavailable</p>';
 for(var r=0;r<8;r++){var f=0;for(var i=0;i<ranks[r].length;i++){var k=ranks[r][i];if(/^[1-8]$/.test(k))f+=Number(k);else if(/^[a-zA-Z]$/.test(k)&&f<8){pieces["abcdefgh"[f]+(8-r)]={type:k.toLowerCase(),color:k===k.toUpperCase()?"w":"b"};f++;}else return '<p>Invalid board data</p>';}if(f!==8)return '<p>Invalid board data</p>';}
 var flipped=a.player_id===a.black_id,fs=flipped?"hgfedcba":"abcdefgh",rs=flipped?"12345678":"87654321",from=String(a.move_from||""),to=String(a.move_to||"");
 var html='<div class="kf-evidence"><div><div class="kf-evidence-board">';
 for(var y=0;y<8;y++)for(var x=0;x<8;x++){
  var s=fs[x]+rs[y],p=pieces[s],light=(("abcdefgh".indexOf(s[0])+8-Number(s[1]))%2===0);
  html+='<div class="kf-evidence-square '+(light?"light":"dark")+(s===from?" from":"")+(s===to?" to":"")+'" title="'+s+'">'+(p?svg(p):"")+(x===0?'<small class="rank">'+s[1]+'</small>':"")+(y===7?'<small class="file">'+s[0]+'</small>':"")+'</div>';
 }
 if(/^[a-h][1-8]$/.test(from)&&/^[a-h][1-8]$/.test(to)&&from!==to){
  var ax=(fs.indexOf(from[0])+.5)*100,ay=(rs.indexOf(from[1])+.5)*100,bx=(fs.indexOf(to[0])+.5)*100,by=(rs.indexOf(to[1])+.5)*100,dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);
  var id="kf-evidence-arrow-"+String(a.id).replace(/[^0-9]/g,"");
  html+='<svg class="kf-evidence-arrow" viewBox="0 0 800 800" aria-hidden="true"><defs><marker id="'+id+'" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 Z" fill="#f43f5e"/></marker></defs><path d="M'+ax+' '+ay+' L'+(bx-18*dx/len)+' '+(by-18*dy/len)+'" stroke="#f43f5e" stroke-width="9" stroke-linecap="round" fill="none" marker-end="url(#'+id+')"/></svg>';
 }
 html+='</div><div class="kf-evidence-caption">🔴 Rejected move: '+adminEscape(from)+' → '+adminEscape(to)+'</div></div>';
 var p=pieces[from],q=pieces[to];var description=p?(p.color==="w"?"White ":"Black ")+names[p.type]:"No piece at starting square";
 html+='<div class="kf-evidence-info"><strong>Position before the illegal move</strong><p>'+adminEscape(description)+' attempted '+adminEscape(from)+' → '+adminEscape(to)+'</p><p>'+(q?'Target occupied by '+adminEscape((q.color==="w"?"White ":"Black ")+names[q.type]):'Target square empty')+'</p><p class="kf-evidence-warning">The move was rejected; pieces did not move.</p></div></div>';
 return html;
}
// Copy only the reported player's ID, never the opponent's account ID.
$("adminRejectedMoves").addEventListener("click",async function(e){
 var button=e.target.closest(".kf-copy-accused-id");
 if(!button || !this.contains(button) || !currentUser || currentUser.id!==adminOwnerId)return;
 var id=button.getAttribute("data-player-id")||"";
 if(!/^[a-f0-9-]{36}$/i.test(id))return;
 try{
  if(navigator.clipboard && navigator.clipboard.writeText){
   await navigator.clipboard.writeText(id);
  }else{
   var field=document.createElement("textarea");
   field.value=id;field.style.position="fixed";field.style.opacity="0";
   document.body.appendChild(field);field.select();
   var copied=document.execCommand("copy");field.remove();
   if(!copied)throw new Error("Copy is unavailable");
  }
  button.textContent="Copied ✓";
  say("Accused player ID copied.",{silentToast:true});
 }catch(err){say("Unable to copy ID. Select and copy the displayed ID.",{error:true});}
});
// Delete one rejected-move report after the owner confirms it. The server
// performs the authorization check and permanent database deletion.
$("adminRejectedMoves").addEventListener("click",async function(e){
 var button=e.target.closest(".kf-delete-illegal-report");
 if(!button||!this.contains(button)||!currentUser||currentUser.id!==adminOwnerId||button.disabled)return;
 var reportId=button.getAttribute("data-report-id");
 if(!/^[1-9][0-9]*$/.test(reportId||""))return;
 if(!confirm("Permanently delete this rejected-move report from the server? This cannot be undone."))return;
 button.disabled=true;button.textContent="Deleting…";
 try{
   var response=await sb.rpc("kf_admin_delete_invalid_move_report",{p_report_id:Number(reportId)});
   if(response.error)throw response.error;
   if(response.data!==true)throw new Error("Report no longer exists.");
   var card=button.closest(".admin-user");
   if(card)card.remove();
   var rejectedCount=$("adminOverview").querySelector(".rejected-moves-card strong");
   if(rejectedCount)rejectedCount.textContent=fmtStat($("adminRejectedMoves").querySelectorAll(".admin-user").length);
   if(!$("adminRejectedMoves").querySelector(".admin-user")){
     $("adminRejectedMoves").innerHTML='<div class="admin-empty">No rejected illegal moves reported.</div>';
   }
   say("Report permanently deleted from server.",{info:true});
 }catch(err){
   button.disabled=false;button.textContent="Delete";
   say("Delete failed: "+(err.message||err),{error:true});
 }
});
// Private shadow-verification alerts, including completed games.
$("adminAuditAlerts").addEventListener("click",async function(e){
 var copy=e.target.closest(".kf-copy-accused-id");
 if(copy&&this.contains(copy)){
  var uid=copy.getAttribute("data-player-id")||"";
  if(uid){
   try{
    if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(uid);
    else{var field=document.createElement("textarea");field.value=uid;document.body.appendChild(field);field.select();var ok=document.execCommand("copy");field.remove();if(!ok)throw Error("Copy not supported");}
    copy.textContent="Copied ✓";
   }catch(err){say("Could not copy player ID.",{error:true});}
  }
  return;
 }
 var button=e.target.closest(".kf-delete-audit-alert");
 if(!button||!this.contains(button)||!currentUser||currentUser.id!==adminOwnerId||button.disabled)return;
 var id=button.getAttribute("data-audit-id");
 if(!/^[1-9][0-9]*$/.test(id||""))return;
 if(!confirm("Permanently delete this shadow-audit alert?"))return;
 button.disabled=true;button.textContent="Deleting…";
 try{
  var r=await sb.rpc("kf_admin_delete_move_audit_alert",{p_alert_id:Number(id)});
  if(r.error)throw r.error;
  if(r.data!==true)throw Error("Alert no longer exists.");
  var card=button.closest(".admin-user");if(card)card.remove();
  var auditCount=$("adminSecurityFolders").querySelector(".shadow-audit-card strong");
  if(auditCount)auditCount.textContent=fmtStat($("adminAuditAlerts").querySelectorAll(".admin-user").length);
  if(!$("adminAuditAlerts").querySelector(".admin-user"))$("adminAuditAlerts").innerHTML='<div class="admin-empty">No move-integrity alerts.</div>';
 }catch(err){button.disabled=false;button.textContent="Delete";say("Delete failed: "+(err.message||err),{error:true});}
});
async function loadAdminMoveAuditAlerts(){
 if(!sb||!currentUser||currentUser.id!==adminOwnerId)return;
 var target=$("adminAuditAlerts");if(!target)return;
 try{
  var response=await sb.rpc("kf_admin_move_audit_alerts",{p_limit:30});
  if(response.error)throw response.error;
  var entries=Array.isArray(response.data)?response.data:[];
  var auditCount=$("adminSecurityFolders").querySelector(".shadow-audit-card strong");
  if(auditCount)auditCount.textContent=fmtStat(entries.length);
  if(!entries.length){target.innerHTML='<div class="admin-empty">No move-integrity alerts.</div>';return;}
  target.innerHTML=entries.map(function(a){
   var move=a.move_data||{};
   var mark=a.verdict==="flagged"?"⚠️ Confirmed alert":"⚑ Manual review";
   var snapshot={id:"audit-"+a.id,position_fen:a.before_fen,move_from:move.from,move_to:move.to,player_id:a.player_id};
   return '<article class="admin-user"><div class="admin-user-top"><div class="admin-user-ident">'+
     '<div class="admin-user-name">'+adminEscape(mark)+'</div>'+
     '<div class="admin-user-meta">'+adminEscape(a.detail||"No details")+'</div>'+
     '<div class="admin-user-meta">'+adminEscape(a.detected_at?new Date(a.detected_at).toLocaleString():"")+'</div></div></div>'+
     '<div class="kf-accused-id"><span>Accused player ID</span><code>'+adminEscape(a.player_id||"Unknown")+'</code>'+
     '<button type="button" class="kf-copy-accused-id" data-player-id="'+adminEscape(a.player_id||"")+'">Copy ID</button>'+
     '<button type="button" class="kf-delete-audit-alert" data-audit-id="'+adminEscape(a.id)+'">Delete</button></div>'+
     adminIllegalBoard(snapshot)+
     '<details class="kf-evidence-details"><summary>Technical evidence (FEN, PGN, game ID)</summary>'+
     '<div class="admin-user-meta">Game: '+adminEscape(a.game_id||"")+'</div>'+
     '<div class="admin-user-meta">White: '+adminEscape(a.white_username||"")+' · Black: '+adminEscape(a.black_username||"")+'</div>'+
     '<div class="admin-user-meta">Before FEN: '+adminEscape(a.before_fen||"")+'</div>'+
     '<div class="admin-user-meta">After FEN: '+adminEscape(a.after_fen||"")+'</div>'+
     '<div class="admin-user-meta">PGN: '+adminEscape(String(a.archived_pgn||a.after_pgn||"").slice(-1600))+'</div></details></article>';
  }).join("");
 }catch(err){target.innerHTML='<div class="admin-empty">Could not load shadow audit: '+adminEscape(err.message||err)+'</div>';}
}
async function loadAdminRejectedMoveReports(){
 if(!sb||!currentUser||currentUser.id!==adminOwnerId)return;
 var target=$("adminRejectedMoves");if(!target)return;
 try{
  var response=await sb.rpc("kf_admin_invalid_move_reports",{p_limit:30});
  if(response.error)throw response.error;
  var reports=Array.isArray(response.data)?response.data:[];
  var rejectedCount=$("adminOverview").querySelector(".rejected-moves-card strong");
  if(rejectedCount)rejectedCount.textContent=fmtStat(reports.length);
  if(!reports.length){target.innerHTML='<div class="admin-empty">No rejected illegal moves reported.</div>';return;}
  target.innerHTML=reports.map(function(a){
   var side=a.player_id===a.white_id?"White":a.player_id===a.black_id?"Black":"Unknown";
   var name=side==="White"?a.white_username:side==="Black"?a.black_username:"Unknown";
   var opponent=side==="White"?a.black_username:a.white_username;
   var when=a.reported_at?new Date(a.reported_at).toLocaleString():"Unknown time";
   return '<article class="admin-user"><div class="admin-user-top"><div class="admin-user-ident"><div class="admin-user-name">⚠️ '+adminEscape(name||"Unknown player")+' · '+side+'</div><div class="admin-user-meta">Against '+adminEscape(opponent||"Unknown")+' · '+adminEscape(when)+'</div></div></div>'+
    '<div class="kf-accused-id"><span>Accused player ID</span><code>'+adminEscape(a.player_id||"Unknown")+'</code><button type="button" class="kf-copy-accused-id" data-player-id="'+adminEscape(a.player_id||"")+'">Copy ID</button><button type="button" class="kf-delete-illegal-report" data-report-id="'+adminEscape(a.id||"")+'">Delete</button></div>'+
    adminIllegalBoard(a)+
    '<details class="kf-evidence-details"><summary>Technical details (FEN, PGN, IDs)</summary><div class="admin-user-meta">Game: '+adminEscape(a.game_id||"")+' · Account: '+adminEscape(a.player_id||"")+'</div><div class="admin-user-meta">FEN: '+adminEscape(a.position_fen||"")+'</div><div class="admin-user-meta">PGN: '+adminEscape(String(a.position_pgn||"").slice(-1000)||"—")+'</div></details></article>';
  }).join("");
 }catch(err){target.innerHTML='<div class="admin-empty">Could not load rejected moves: '+adminEscape(err.message||err)+'</div>';}
}
async function loadAdminPlayerReportsCount(){
 if(!sb||!currentUser||currentUser.id!==adminOwnerId)return;
 try{var r=await sb.rpc("kf_admin_player_reports_count");if(r.error)throw r.error;
 var el=$("adminSecurityFolders").querySelector(".player-reports-card strong");if(el)el.textContent=fmtStat(r.data||0);}
 catch(err){console.warn("Player report count error:",err);}
}
async function loadAdminPlayerReports(){
 var target=$("adminPlayerReportsList");if(!target||!sb||!currentUser||currentUser.id!==adminOwnerId)return;
 target.innerHTML='<div class="admin-loading">Loading reports…</div>';
 try{
 var r=await sb.rpc("kf_admin_player_reports");if(r.error)throw r.error;
 var rows=Array.isArray(r.data)?r.data:[];
 if(!rows.length){target.innerHTML='<div class="admin-empty">No player reports yet.</div>';return;}
 var reasons={illegal_move:"Illegal move",stockfish:"Using Stockfish",clock_manipulation:"Clock manipulation"};
 target.innerHTML=rows.map(function(x){var time=x.created_at?new Date(x.created_at).toLocaleString():"Unknown";
 return '<article class="admin-report-row"><strong>⚑ '+adminEscape(x.reported_username)+' — '+adminEscape(reasons[x.reason]||x.reason)+'</strong>'+
 '<small>Reported by '+adminEscape(x.reporter_username)+' · '+adminEscape(time)+'</small>'+
 '<small>Accused player ID: <code>'+adminEscape(x.reported_id)+'</code></small>'+
 '<small>Reporter ID: <code>'+adminEscape(x.reporter_id)+'</code></small>'+
 '<small>Game ID: <code>'+adminEscape(x.game_id)+'</code></small>'+
 '<small>Position FEN: <code>'+adminEscape(x.position_fen||"Unavailable")+'</code></small>'+
 '<div class="admin-report-actions">'+
 '<button class="btn" type="button" data-report-action="review" data-report-id="'+adminEscape(x.id)+'">Review moves</button>'+
 (x.reason==="stockfish"?'<button class="btn gold" type="button" data-report-action="analyze" data-report-id="'+adminEscape(x.id)+'">Stockfish analysis</button>':"")+
 (x.reason==="clock_manipulation"?'<button class="btn" type="button" data-report-action="clock" data-report-id="'+adminEscape(x.id)+'">Clock details</button>':"")+
 '</div><div class="admin-report-details" data-report-details="'+adminEscape(x.id)+'"></div></article>';}).join("");
 }catch(err){target.innerHTML='<div class="admin-empty">Could not load player reports: '+adminEscape(err.message||err)+'</div>';}
}
// Admin-only report retrieval; the server validates owner identity before sharing game details.
$("adminPlayerReportsList").addEventListener("click",async function(event){
 var button=event.target.closest("button[data-report-action]");
 if(!button||!currentUser||currentUser.id!==adminOwnerId)return;
 var id=button.getAttribute("data-report-id"),action=button.getAttribute("data-report-action");
 var details=Array.prototype.find.call(this.querySelectorAll(".admin-report-details"),function(x){return x.getAttribute("data-report-details")===id;});
 button.disabled=true;
 try{
  var r=await sb.rpc("kf_admin_player_report_game",{p_report_id:id});
  if(r.error)throw r.error;
  var record=Array.isArray(r.data)?r.data[0]:null;
  if(!record)throw Error("Game not found");
  if(action==="clock"){
    if(details)details.textContent="Server clock snapshot at last recorded state — White: "+(record.white_time_left==null?"unknown":Number(record.white_time_left).toFixed(1)+"s")+
      ", Black: "+(record.black_time_left==null?"unknown":Number(record.black_time_left).toFixed(1)+"s")+
      ". Clock start: "+(record.clock_started_at||"not recorded")+
      ". Last move: "+(record.last_move_at||"not recorded")+
      ". These values alone cannot prove clock manipulation; historical move-by-move server timing is not available in this report.";
    return;
  }
  if(!record.pgn||!String(record.pgn).trim()){
    if(details)details.textContent="No replay data is stored for this game. The recorded FEN cannot reconstruct earlier moves.";
    return;
  }
  var replay=new Chess();
  var loaded=replay.load_pgn(record.pgn);
  if(!loaded||!replay.history().length)throw Error("PGN could not be replayed");
  adminReviewedPlayer=action==="analyze"?{color:record.reported_id===record.white_id?"w":"b",name:record.reported_username||"Reported player"}:null;
  pendingAnalysisGame=game;
  game=replay;
  if(action==="analyze"){
    openAnalysis();
  }else{
    analysisRunning=false;analysisRunId++;closeAnalysisAuxEngines();
    analysisMoves=[];analysisPositions=[];
    var chess=new Chess(),history=replay.history({verbose:true});
    var headers=replay.header?replay.header():{};
    if(headers&&headers.FEN)chess.load(headers.FEN);
    analysisPositions.push(chess.fen());
    history.forEach(function(m){
      var played=chess.move(m);
      if(played){analysisMoves.push({san:played.san,color:played.color,from:played.from,to:played.to,quality:"unrated",fenAfter:chess.fen(),evalAfter:null});analysisPositions.push(chess.fen());}
    });
    $("anMoves").innerHTML="";$("anSummary").innerHTML="";
    $("anProgress").textContent="Game replay · "+analysisMoves.length+" moves · Engine analysis not running";
    $("analysisDialog").showModal();
    renderMoveList();gotoAnalysisIndex(0);
  }
 }catch(err){if(details)details.textContent="Could not load game: "+(err.message||err);}
 finally{button.disabled=false;}
});
/* Security reports load when their hub or folder is visible, not on admin landing.
   Account totals, users and feature controls still refresh normally. */
function kfRefreshVisibleAdminSecurity(){
 if(!currentUser || currentUser.id!==adminOwnerId)return;
 if(!$("adminSecurityHubView").hidden){
  loadAdminPlayerReportsCount();
  loadAdminMoveAuditAlerts();
  loadAdminClockReports();
  loadAdminStreakReviews();
  loadAdminSuspiciousPlayers();
 }else if(!$("adminClockReportsSection").hidden){
  loadAdminClockReports();
 }else if(!$("adminMoveAuditSection").hidden){
  loadAdminMoveAuditAlerts();
 }else if(!$("adminStreakReviewsSection").hidden){
  loadAdminStreakReviews();
 }else if(!$("adminSuspiciousPlayersSection").hidden){
  loadAdminSuspiciousPlayers();
 }else if(!$("adminPlayerReportsSection").hidden){
  loadAdminPlayerReports();
 }
}
var adminVipRequest = 0;
async function loadAdminVipMembers(){
 var card = $("adminVipCard"), list = $("adminVipMembers"), request = ++adminVipRequest;
 if (!card || !card.open) return;
 list.replaceChildren();
 if (!currentUser || currentUser.id !== adminOwnerId) return;
 var fa = window.kfGetLanguage?.() === "fa";
 list.textContent = fa ? "در حال دریافت اعضا…" : "Loading members…";
 try {
  var result = await sb.rpc("kf_admin_vip_members");
  if (request !== adminVipRequest || !card.open || currentUser?.id !== adminOwnerId) return;
  if (result.error || !Array.isArray(result.data)) throw Error();
  var members = result.data;
  list.replaceChildren();
  if (!members.length) list.textContent = fa ? "هنوز عضو VIP ثبت نشده است." : "No VIP members yet.";
  members.forEach(function(member){
   var row = document.createElement("div");
   row.className = "admin-user";
   var days = member.days_remaining;
   var duration = days === null ? (fa ? "دائمی" : "Permanent") :
     (fa ? days.toLocaleString("fa-IR") + " روز باقی‌مانده" : days + (days === 1 ? " day left" : " days left"));
   row.textContent = member.name + " · " + duration;
   list.append(row);
  });
 } catch {
  if (request === adminVipRequest) list.textContent = fa ? "دریافت فهرست ممکن نشد. دوباره تلاش کنید." : "Could not load VIP members. Please refresh.";
 }
}
if ($("adminVipCard")) $("adminVipCard").addEventListener("toggle", loadAdminVipMembers);
if ($("adminVipGrant")) {
 function vipGrantText(en, fa){return window.kfGetLanguage?.() === "fa" ? fa : en;}
 $("adminVipCard").addEventListener("toggle",function(){
  $("vipGrantPlayerLabel").textContent=vipGrantText("Username, email or player ID","نام کاربری، ایمیل یا شناسهٔ بازیکن");
  $("vipGrantPlanLabel").textContent=vipGrantText("Subscription","مدت اشتراک");
  $("vipGrantMonth").textContent=vipGrantText("One month","یک‌ماهه");
  $("vipGrantPermanent").textContent=vipGrantText("Permanent","دائمی");
  $("vipGrantSubmit").textContent=vipGrantText("Activate VIP","فعال‌سازی VIP");
 });
 $("adminVipGrant").addEventListener("submit",async function(event){
  event.preventDefault();
  var submit=$("vipGrantSubmit"),status=$("vipGrantStatus");
  if(submit.disabled || currentUser?.id!==adminOwnerId)return;
  var player=$("vipGrantPlayer").value.trim(),plan=$("vipGrantPlan").value;
  if(!player){$("vipGrantPlayer").focus();return;}
  submit.disabled=true;
  status.textContent="";
  try {
   var result=await sb.rpc("kf_admin_grant_vip",{player,plan});
   if(result.error)throw result.error;
   status.textContent=result.data+" · "+(plan==="month"?vipGrantText("Monthly VIP activated","اشتراک یک‌ماهه فعال شد"):vipGrantText("Permanent VIP activated","اشتراک دائمی فعال شد"));
   this.reset();
   await loadAdminVipMembers();
  } catch(error){
   var messages={
    "Player not found":["Player not found.","بازیکن پیدا نشد."],
    "Ambiguous player":["Multiple matches. Enter the player ID.","چند حساب پیدا شد. شناسهٔ بازیکن را وارد کنید."],
    "Already permanent":["This player already has permanent VIP.","این بازیکن از قبل VIP دائمی دارد."]
   };
   status.textContent=vipGrantText(...(messages[error.message]||["Could not activate VIP. Please retry.","فعال‌سازی ممکن نشد. دوباره تلاش کنید."]));
  } finally {submit.disabled=false;}
 });
}
async function loadAdminPanel(){
 if(!currentUser||currentUser.id!==adminOwnerId)return;
 if ($("adminVipCard")?.open) loadAdminVipMembers();
 kfRefreshVisibleAdminSecurity();
 $("adminUsers").innerHTML='<div class="admin-loading">Loading registered users…</div>';
 $("adminFeatures").innerHTML='<div class="admin-loading">Loading features…</div>';
 $("adminOverview").innerHTML='<div class="admin-stat registered-users-card" role="button" tabindex="0" aria-label="Show all registered users, newest first"><span>Registered users</span><strong>Loading…</strong></div><div class="admin-stat"><span>Banned users</span><strong>—</strong></div><div class="admin-stat security-reports-card" role="button" tabindex="0" aria-label="Open security reports"><span>🛡️ Security Reports</span><strong>›</strong></div><div class="admin-stat feature-management-card" role="button" tabindex="0" aria-label="Manage game features"><span>⚙️ Feature Management</span><strong>›</strong></div>';
 // Count directly in the database; independent of the user-list endpoint.
 try{
  var countResult=await sb.rpc("kf_admin_registered_user_count");
  if(countResult.error)throw countResult.error;
  var registeredCount=Number(countResult.data||0);
  var overview=$("adminOverview");
  var first=overview.querySelector(".admin-stat strong");
  if(first)first.textContent=fmtStat(registeredCount);
 }catch(countError){
  var first=$("adminOverview").querySelector(".admin-stat strong");
  if(first)first.textContent="Error";
  console.error("Registered-user count failed:",countError);
 }
 try{
  var usersResult=await adminInvoke({action:"list_users"});
  adminUsersCache=(usersResult.users||[]).slice().sort(function(a,b){return (Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0);});
  var banned=adminUsersCache.filter(function(u){return u.banned_until&&new Date(u.banned_until)>new Date();}).length;
  var firstValue=$("adminOverview").querySelector(".admin-stat strong");
  $("adminOverview").innerHTML='<div class="admin-stat registered-users-card" role="button" tabindex="0" aria-label="Show all registered users, newest first"><span>Registered users</span><strong>'+(firstValue?adminEscape(firstValue.textContent):'—')+'</strong></div><div class="admin-stat"><span>Banned users</span><strong>'+fmtStat(banned)+'</strong></div><div class="admin-stat security-reports-card" role="button" tabindex="0" aria-label="Open security reports"><span>🛡️ Security Reports</span><strong>›</strong></div><div class="admin-stat feature-management-card" role="button" tabindex="0" aria-label="Manage game features"><span>⚙️ Feature Management</span><strong>›</strong></div>';
  renderAdminUsers();
 }catch(e){
  $("adminUsers").innerHTML='<div class="admin-empty">Could not load user list: '+adminEscape(e.message||e)+'</div>';
  console.error("Admin user list failed:",e);
 }
 try{
  var featuresResult=await sb.rpc("kf_admin_list_features");
  if(featuresResult.error)throw featuresResult.error;
  renderAdminFeatures(featuresResult.data||[]);
 }catch(featureError){
  $("adminFeatures").innerHTML='<div class="admin-empty">Feature settings unavailable.</div>';
  console.error("Admin features failed:",featureError);
 }
}
function renderAdminUsers(){
 var q=($("adminUserSearch").value||"").toLowerCase().trim(),list=adminUsersCache.filter(function(u){return !q||(u.username+" "+u.email+" "+u.id).toLowerCase().includes(q);});
 if(!list.length){$("adminUsers").innerHTML='<div class="admin-empty">No matching accounts.</div>';return;}
 $("adminUsers").innerHTML=list.map(function(u){
  var banned=!!u.banned_until&&new Date(u.banned_until)>new Date(),id=adminEscape(u.id);
  return '<article class="admin-user" data-user-id="'+id+'"><div class="admin-user-top"><img src="'+adminEscape(u.avatar_url||defaultAvatar())+'" alt=""><div class="admin-user-ident"><div class="admin-user-name">'+adminEscape(u.username)+'</div><div class="admin-user-meta">'+adminEscape(u.email)+' · '+id+'</div></div><span class="admin-user-state '+(banned?'banned':'')+'">'+(banned?'BANNED':'ACTIVE')+'</span></div>'+
  '<div class="admin-user-stats"><span class="admin-chip admin-edit-count" role="button" tabindex="0" data-metric="wins" aria-label="Edit wins count">♟ Wins: '+fmtStat(u.wins||0)+'</span><span class="admin-chip admin-edit-count" role="button" tabindex="0" data-metric="tournament_wins" aria-label="Edit trophies count">🏆 Trophies: '+fmtStat(u.tournament_wins||0)+'</span><span class="admin-chip admin-edit-count" role="button" tabindex="0" data-metric="humiliation_losses" aria-label="Edit humiliation losses count">🎭 Humiliation: '+fmtStat(u.humiliation_losses||0)+'</span><span class="admin-chip">Joined: '+adminEscape(new Date(u.created_at).toLocaleDateString())+'</span></div>'+
  '<div class="admin-actions"><button class="btn admin-ban" type="button" data-banned="'+banned+'">'+(banned?'Unban':'Ban')+'</button></div></article>';
 }).join("");
}
function renderAdminFeatures(rows){
 $("adminFeatures").innerHTML=rows.filter(function(f){return f.feature_key!=="rematch";}).map(function(f){return '<div class="admin-feature"><div><strong>'+adminEscape(f.label)+'</strong><small>'+adminEscape(f.description)+'</small></div><input class="admin-toggle" type="checkbox" data-feature="'+adminEscape(f.feature_key)+'" '+(f.enabled?'checked':'')+' aria-label="Toggle '+adminEscape(f.label)+'"></div>';}).join("")||'<div class="admin-empty">No features configured.</div>';
}
/* Owner-only read-only monitoring. Manual refresh prevents background database load. */
var kfMonitorBusy=false;
function kfMonitorValue(v,suffix){
 if(v===null||v===undefined||!isFinite(Number(v)))return "—";
 return Number(v).toLocaleString("en-US",{maximumFractionDigits:2})+(suffix||"");
}
function kfMonitorCard(label,value,detail){
 return '<div class="admin-stat" style="cursor:default"><span>'+adminEscape(label)+'</span><strong>'+adminEscape(value)+'</strong>'+(detail?'<small style="display:block;color:var(--muted);font-size:11px;margin-top:6px">'+adminEscape(detail)+'</small>':'')+'</div>';
}
async function kfLoadMonitoring(){
 if(kfMonitorBusy||!sb||!currentUser||currentUser.id!==adminOwnerId||$("adminMonitoringSection").hidden)return;
 kfMonitorBusy=true;
 var button=$("adminMonitoringRefresh"), status=$("adminMonitoringStatus");
 button.disabled=true;status.textContent="Reading database snapshot…";
 try{
  var result=await sb.rpc("kf_admin_monitor_snapshot");
  if(result.error)throw result.error;
  var d=result.data||{};
  $("adminMonitoringMetrics").innerHTML=[
   kfMonitorCard("Active games",kfMonitorValue(d.active_games),"Games currently marked active"),
   kfMonitorCard("Games created · last hour",kfMonitorValue(d.games_created_last_hour)),
   kfMonitorCard("Database connections",kfMonitorValue(d.connections_total)+" / "+kfMonitorValue(d.db_max_connections),"Active queries: "+kfMonitorValue(d.connections_active)),
   kfMonitorCard("Waiting on locks",kfMonitorValue(d.waiting_locks)),
   kfMonitorCard("Database size",kfMonitorValue(d.db_size_mb," MB")),
   kfMonitorCard("Database cache hit",kfMonitorValue(d.cache_hit_percent,"%"),"Cumulative PostgreSQL statistic")
  ].join("");
  $("adminMonitoringMove").innerHTML=[
   kfMonitorCard("Tracked move RPC calls",kfMonitorValue(d.move_calls_since_reset),"Cumulative PostgREST calls"),
   kfMonitorCard("Average database time",kfMonitorValue(d.move_mean_db_ms," ms"),"Excludes network"),
   kfMonitorCard("Largest recorded database time",kfMonitorValue(d.move_max_db_ms," ms"),"Historical maximum; may be an outlier")
  ].join("");
  var at=d.sampled_at?new Date(d.sampled_at).toLocaleString():"unknown time";
  status.textContent="Snapshot updated: "+at+" · Refresh manually for new figures.";
 }catch(error){
  status.textContent="Monitoring unavailable: "+(error.message||String(error));
  console.error("[Kingsfall monitoring] Read-only snapshot failed",error);
 }finally{kfMonitorBusy=false;button.disabled=false;}
}
function showAdminMonitoring(){
 if(!currentUser||currentUser.id!==adminOwnerId)return;
 ["adminOverviewView","adminSecurityHubView","adminFeaturesSection","adminClockReportsSection",
  "adminMoveAuditSection","adminRejectedMovesSection","adminStreakReviewsSection",
  "adminSuspiciousPlayersSection","adminPlayerReportsSection","adminUserManagementSection"].forEach(function(id){$(id).hidden=true;});
 $("adminMonitoringSection").hidden=false;
 adminSecurityFolderOpen=false;
 $("adminPageTitle").textContent="📊 Server Monitoring";
 $("adminPageSubtitle").textContent="Private database health and move processing metrics";
 $("adminBackToOverview").hidden=false;
 kfLoadMonitoring();
 window.scrollTo({top:0,behavior:"smooth"});
}
$("adminMonitoringOpen").addEventListener("click",showAdminMonitoring);
$("adminMonitoringRefresh").addEventListener("click",kfLoadMonitoring);
$("navAdmin").onclick=function(){if(currentUser&&currentUser.id===adminOwnerId)showPage("admin");};
$("adminRefresh").onclick=loadAdminPanel;$("adminUserSearch").addEventListener("input",renderAdminUsers);

async function loadAdminClockReports(){
 if(!sb||!currentUser||currentUser.id!==adminOwnerId)return;
 var target=$("adminClockReportsList");
 try{
  var response=await sb.rpc("kf_admin_clock_violation_reports",{p_limit:50});
  if(response.error)throw response.error;
  var reports=Array.isArray(response.data)?response.data:[];
  var count=$("adminSecurityFolders").querySelector(".clock-reports-card strong");
  if(count)count.textContent=fmtStat(reports.length);
  if(!reports.length){target.innerHTML='<div class="admin-empty">No clock violations reported.</div>';return;}
  target.innerHTML=reports.map(function(r){
   function showTime(v){return v==null?"—":Number(v).toFixed(3)+"s";}
   var id=adminEscape(String(r.id||""));
   var player=adminEscape(String(r.player_id||"Unknown"));
   var title=adminEscape(String(r.rule_code||"Clock anomaly").replace(/_/g," "));
   return '<article class="admin-user"><div class="admin-user-top"><div class="admin-user-ident"><div class="admin-user-name">⏱️ '+title+'</div>'+
    '<div class="admin-user-meta">'+adminEscape(r.detail||"Clock review required")+'</div>'+
    '<div class="admin-user-meta">'+adminEscape(r.detected_at?new Date(r.detected_at).toLocaleString():"")+'</div></div></div>'+
    '<div class="kf-accused-id"><span>Player ID</span><code>'+player+'</code><button type="button" class="kf-clock-copy-id" data-player-id="'+player+'">Copy ID</button>'+
    '<button type="button" class="kf-clock-delete-report" data-report-id="'+id+'">Delete</button></div>'+
    '<div class="admin-user-meta">Game: <code>'+adminEscape(r.game_id||"—")+'</code> · Move: '+adminEscape(r.move_number==null?"—":String(r.move_number))+'</div>'+
    '<div class="admin-user-meta">White: '+showTime(r.previous_white_time)+' → '+showTime(r.current_white_time)+'</div>'+
    '<div class="admin-user-meta">Black: '+showTime(r.previous_black_time)+' → '+showTime(r.current_black_time)+'</div>'+
    '<details class="kf-evidence-details"><summary>Server evidence</summary><div class="admin-user-meta">Previous timestamp: '+adminEscape(r.previous_received_at||"—")+'</div>'+
    '<div class="admin-user-meta">Current timestamp: '+adminEscape(r.current_received_at||"—")+'</div>'+
    '<pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+adminEscape(JSON.stringify(r.evidence||{},null,2))+'</pre></details></article>';
  }).join("");
 }catch(e){target.innerHTML='<div class="admin-empty">Could not load clock reports: '+adminEscape(e.message||e)+'</div>';}
}
$("adminClockReportsList").addEventListener("click",async function(e){
 var copy=e.target.closest(".kf-clock-copy-id");
 if(copy){
  var value=copy.getAttribute("data-player-id")||"";
  try{
   if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(value);
   else{var t=document.createElement("textarea");t.value=value;document.body.appendChild(t);t.select();document.execCommand("copy");t.remove();}
   copy.textContent="Copied ✓";
  }catch(err){say("Could not copy ID.",{error:true});}
  return;
 }
 var button=e.target.closest(".kf-clock-delete-report");
 if(!button||button.disabled||!currentUser||currentUser.id!==adminOwnerId)return;
 var id=button.getAttribute("data-report-id");
 if(!/^[1-9][0-9]*$/.test(id||"")||!confirm("Permanently delete this clock report?"))return;
 button.disabled=true;
 try{
  var r=await sb.rpc("kf_admin_delete_clock_violation_report",{p_report_id:Number(id)});
  if(r.error)throw r.error;
  if(r.data!==true)throw Error("Report already deleted");
  await loadAdminClockReports();
 }catch(err){button.disabled=false;say("Could not delete clock report: "+(err.message||err),{error:true});}
});
function showClockReports(){
 if(!currentUser||currentUser.id!==adminOwnerId)return;
 adminSecurityFolderOpen=true;
 ["adminOverviewView","adminSecurityHubView","adminFeaturesSection","adminMoveAuditSection","adminStreakReviewsSection","adminSuspiciousPlayersSection","adminPlayerReportsSection","adminUserManagementSection"].forEach(function(id){$(id).hidden=true;});
 $("adminClockReportsSection").hidden=false;
 $("adminPageTitle").textContent="⏱️ Clock Violations";
 $("adminPageSubtitle").textContent="Independent clock anomalies · Admin only";
 $("adminBackToOverview").hidden=false;
 loadAdminClockReports();
 window.scrollTo({top:0,behavior:"smooth"});
}
var adminSecurityFolderOpen=false;
function showSecurityHub(){$("adminMonitoringSection").hidden=true;$("adminClockReportsSection").hidden=true;
 if(!currentUser||currentUser.id!==adminOwnerId)return;
 ["adminOverviewView","adminFeaturesSection","adminMoveAuditSection","adminStreakReviewsSection","adminSuspiciousPlayersSection","adminPlayerReportsSection","adminUserManagementSection"].forEach(function(id){$(id).hidden=true;});
 $("adminSecurityHubView").hidden=false;
 adminSecurityFolderOpen=false;
 $("adminPageTitle").textContent="🛡️ Security Reports";
 $("adminPageSubtitle").textContent="Reports, verification alerts and investigations · Admin only";
 $("adminBackToOverview").hidden=false;
 kfRefreshVisibleAdminSecurity();
 window.scrollTo({top:0,behavior:"smooth"});
}
function showShadowMoveAudit(){$("adminMonitoringSection").hidden=true;$("adminClockReportsSection").hidden=true;$("adminSecurityHubView").hidden=true;adminSecurityFolderOpen=true;
 if(!currentUser||currentUser.id!==adminOwnerId)return;
 ["adminOverviewView","adminRejectedMovesSection","adminStreakReviewsSection","adminSuspiciousPlayersSection","adminPlayerReportsSection","adminUserManagementSection"].forEach(function(id){$(id).hidden=true;});
 $("adminMoveAuditSection").hidden=false;
 $("adminPageTitle").textContent="🔎 Move Integrity";
 $("adminPageSubtitle").textContent="Server-side move verification alerts · Admin only";
 $("adminBackToOverview").hidden=false;
 loadAdminMoveAuditAlerts();
 window.scrollTo({top:0,behavior:"smooth"});
}
function showStreakReviews(){$("adminMonitoringSection").hidden=true;$("adminClockReportsSection").hidden=true;$("adminSecurityHubView").hidden=true;adminSecurityFolderOpen=true;$("adminMoveAuditSection").hidden=true;
 if(!currentUser||currentUser.id!==adminOwnerId)return;
 ["adminOverviewView","adminRejectedMovesSection","adminSuspiciousPlayersSection","adminPlayerReportsSection","adminUserManagementSection"].forEach(function(id){$(id).hidden=true;});
 $("adminStreakReviewsSection").hidden=false;
 $("adminPageTitle").textContent="🔎 Anti-Cheat Cases";
 $("adminPageSubtitle").textContent="Three consecutive wins · Admin-only reviews";
 $("adminBackToOverview").hidden=false;
 loadAdminStreakReviews();
 window.scrollTo({top:0,behavior:"smooth"});
}
var kfStreakReviewRows=[];
async function loadAdminStreakReviews(){
 if(!sb||!currentUser||currentUser.id!==adminOwnerId)return;
 var target=$("adminStreakReviewsList");
 try{
  var responses=await Promise.all([
   sb.rpc("kf_admin_win_streak_reviews"),
   sb.rpc("kf_admin_win_streak_engine_reports")
  ]);
  if(responses[0].error)throw responses[0].error;
  if(responses[1].error)throw responses[1].error;
  var rows=Array.isArray(responses[0].data)?responses[0].data:[];
  var analyses=Array.isArray(responses[1].data)?responses[1].data:[];
  var reportById={};
  analyses.forEach(function(x){reportById[String(x.id)]=x;});
  kfStreakReviewRows=rows;
  var total=$("adminSecurityFolders").querySelector(".streak-reviews-card strong");
  if(total)total.textContent=fmtStat(rows.filter(function(x){return x.review_status==="pending";}).length);
  target.innerHTML=rows.length?rows.map(function(r){
   var games=Array.isArray(r.game_snapshots)?r.game_snapshots:[];
   var buttons=games.map(function(g,i){
    var pgn=typeof g.pgn==="string"?g.pgn:"";
    return '<div class="admin-report-details" style="margin:10px 0;padding:9px;border:1px solid var(--line);border-radius:8px">'+
      '<strong>Game '+(i+1)+' · PGN</strong>'+
      '<div class="admin-report-actions">'+
      '<button type="button" class="btn" data-streak-id="'+adminEscape(String(r.id))+'" data-streak-copy="'+i+'" '+(pgn?'':'disabled')+'>Copy PGN</button>'+
      '<button type="button" class="btn" data-streak-id="'+adminEscape(String(r.id))+'" data-streak-game="'+i+'" '+(pgn?'':'disabled')+'>Analyze game '+(i+1)+'</button></div>'+
      '<div style="white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;font-size:12px;line-height:1.6">'+adminEscape(pgn||"PGN unavailable")+'</div></div>';
   }).join("");
   var outcome=reportById[String(r.id)]||{};
   var eng=outcome.report||null;
   var summary=eng&&eng.aggregate;
   var analysisText="Stockfish: "+(outcome.status||"pending");
   if(summary){
    analysisText+=" · Top 1: "+fmtStat(summary.weighted_top1_pct)+"% · Top 3: "+fmtStat(summary.weighted_top3_pct)+
      "% · Average CPL: "+fmtStat(summary.weighted_average_centipawn_loss)+" ("+fmtStat(summary.evaluated_moves)+" moves)";
   }
   var gameMetrics=eng&&Array.isArray(eng.games)?eng.games.map(function(g,i){
     if(g.status!=="analyzed")return 'Game '+(i+1)+': '+String(g.status||"unknown");
     return 'Game '+(i+1)+': Top 1 '+g.top1_pct+'%, Top 3 '+g.top3_pct+
       '%, ACPL '+g.average_centipawn_loss+', large errors '+g.large_errors;
   }).join(" | "):"";
   return '<article class="admin-report-row"><strong>'+adminEscape(r.player_username||"Player")+
    ' · '+fmtStat(r.consecutive_wins||3)+' straight wins</strong>'+
    '<small>Player ID: <code>'+adminEscape(r.player_id)+'</code></small>'+
    '<small>Created: '+adminEscape(r.created_at?new Date(r.created_at).toLocaleString():"—")+
    ' · '+adminEscape(r.review_status||"pending")+'</small>'+
    '<small>'+adminEscape(analysisText)+'</small>'+
    (gameMetrics?'<small>'+adminEscape(gameMetrics)+'</small>':'')+
    (outcome.error?'<small>Worker error: '+adminEscape(outcome.error)+'</small>':'')+
    '<small>Engine agreement is a review signal, not proof of cheating. No automatic ban.</small>'+
    '<div class="admin-report-actions">'+buttons+
    '<button type="button" class="btn" data-streak-id="'+adminEscape(String(r.id))+
    '" data-streak-status="'+(r.review_status==="pending"?"reviewed":"pending")+'">'+
    (r.review_status==="pending"?"Mark reviewed":"Reopen")+'</button>'+
    '<button type="button" class="btn" data-streak-id="'+adminEscape(String(r.id))+
    '" data-streak-delete="1" style="color:#ef8b83">Delete</button></div></article>';
  }).join(""):'<div class="admin-empty">No three-win streaks queued yet.</div>';
 }catch(e){
  target.innerHTML='<div class="admin-empty">Unable to load anti-cheat cases: '+adminEscape(e.message||e)+'</div>';
 }
}
$("adminStreakReviewsList").addEventListener("click",async function(event){
 var button=event.target.closest("button[data-streak-id]");
 if(!button||!currentUser||currentUser.id!==adminOwnerId)return;
 var id=button.getAttribute("data-streak-id");
 var record=kfStreakReviewRows.find(function(x){return String(x.id)===id;});
 if(!record)return;
 if(button.hasAttribute("data-streak-copy")){
  var copyIndex=Number(button.getAttribute("data-streak-copy"));
  var copyGame=Array.isArray(record.game_snapshots)?record.game_snapshots[copyIndex]:null;
  var pgnText=copyGame&&typeof copyGame.pgn==="string"?copyGame.pgn:"";
  if(!pgnText){say("PGN unavailable.",{error:true});return;}
  try{
   await navigator.clipboard.writeText(pgnText);
   say("Game "+(copyIndex+1)+" PGN copied.",{silentToast:true});
  }catch(e){
   var area=document.createElement("textarea");
   area.value=pgnText;
   area.style.position="fixed";area.style.opacity="0";
   document.body.appendChild(area);
   area.focus();area.select();
   var copied=false;
   try{copied=document.execCommand("copy");}catch(ignore){}
   area.remove();
   if(copied)say("Game "+(copyIndex+1)+" PGN copied.",{silentToast:true});
   else say("Could not copy PGN. Select the displayed text to copy.",{error:true});
  }
  return;
 }
 if(button.hasAttribute("data-streak-delete")){
  if(!confirm("Permanently delete this anti-cheat case and its saved analysis from Supabase? This cannot be undone."))return;
  button.disabled=true;
  try{
   var deleted=await sb.rpc("kf_admin_delete_win_streak_review",{p_review_id:Number(id)});
   if(deleted.error)throw deleted.error;
   if(deleted.data!==true)throw Error("Case was not found or already deleted");
   await loadAdminStreakReviews();
   say("Anti-cheat case permanently deleted.",{silentToast:true});
  }catch(e){
   say("Could not delete anti-cheat case: "+(e.message||e),{error:true});
   button.disabled=false;
  }
  return;
 }
 if(button.hasAttribute("data-streak-status")){
  button.disabled=true;
  try{
   var r=await sb.rpc("kf_admin_set_win_streak_review_status",{p_review_id:Number(id),p_status:button.getAttribute("data-streak-status")});
   if(r.error)throw r.error;
   await loadAdminStreakReviews();
  }catch(e){say("Could not update review: "+(e.message||e),{error:true});button.disabled=false;}
  return;
 }
 var ix=Number(button.getAttribute("data-streak-game"));
 var gameRecord=Array.isArray(record.game_snapshots)?record.game_snapshots[ix]:null;
 if(!gameRecord||!gameRecord.pgn){say("Game replay is unavailable.",{error:true});return;}
 try{
  var replay=new Chess();
  if(!replay.load_pgn(gameRecord.pgn)||!replay.history().length)throw Error("PGN could not be replayed");
  adminReviewedPlayer={color:gameRecord.color||"w",name:record.player_username||"Player"};
  pendingAnalysisGame=game;
  game=replay;
  openAnalysis();
 }catch(e){say("Could not analyze case: "+(e.message||e),{error:true});}
});
function showPlayerReports(){$("adminMonitoringSection").hidden=true;$("adminClockReportsSection").hidden=true;$("adminSecurityHubView").hidden=true;adminSecurityFolderOpen=true;$("adminMoveAuditSection").hidden=true;$("adminRejectedMovesSection").hidden=true;$("adminStreakReviewsSection").hidden=true;$("adminSuspiciousPlayersSection").hidden=true;
 if(!currentUser||currentUser.id!==adminOwnerId)return;
 $("adminOverviewView").hidden=true;$("adminUserManagementSection").hidden=true;$("adminPlayerReportsSection").hidden=false;
 $("adminPageTitle").textContent="⚑ Player Reports";$("adminPageSubtitle").textContent="Player submissions for admin review";$("adminBackToOverview").hidden=false;
 loadAdminPlayerReports();window.scrollTo({top:0,behavior:"smooth"});
}
function showSuspiciousPlayers(){$("adminMonitoringSection").hidden=true;$("adminClockReportsSection").hidden=true;$("adminSecurityHubView").hidden=true;adminSecurityFolderOpen=true;$("adminMoveAuditSection").hidden=true;$("adminRejectedMovesSection").hidden=true;$("adminStreakReviewsSection").hidden=true;
 if(!currentUser||currentUser.id!==adminOwnerId)return;
 $("adminOverviewView").hidden=true;$("adminUserManagementSection").hidden=true;$("adminPlayerReportsSection").hidden=true;$("adminSuspiciousPlayersSection").hidden=false;
 $("adminPageTitle").textContent="⚠ Suspicious Players";$("adminPageSubtitle").textContent="Private watchlist · Admin only";$("adminBackToOverview").hidden=false;loadAdminSuspiciousPlayers();window.scrollTo({top:0,behavior:"smooth"});
}
async function loadAdminSuspiciousPlayers(){
 if(!sb||!currentUser||currentUser.id!==adminOwnerId)return;
 var target=$("adminSuspiciousList");
 try{var r=await sb.rpc("kf_admin_suspicious_players");if(r.error)throw r.error;var rows=Array.isArray(r.data)?r.data:[];
 var count=$("adminSecurityFolders").querySelector(".suspicious-players-card strong");if(count)count.textContent=fmtStat(rows.length);
 target.innerHTML=rows.length?rows.map(function(p){return '<article class="admin-user"><div class="admin-user-top"><div class="admin-user-ident"><div class="admin-user-name">'+adminEscape(p.username||"Player")+' <span class="admin-chip">× '+fmtStat(p.count)+'</span></div><div class="admin-user-meta">'+adminEscape(p.id)+'</div></div></div></article>';}).join(""):'<div class="admin-empty">No suspicious players registered.</div>';
 }catch(e){target.innerHTML='<div class="admin-empty">Could not load suspicious players: '+adminEscape(e.message||e)+'</div>';console.error(e);}
}
$("adminSuspiciousForm").addEventListener("submit",async function(e){
 e.preventDefault();if(!sb||!currentUser||currentUser.id!==adminOwnerId)return;
 var field=$("adminSuspiciousId"),id=field.value.trim(),button=$("adminSuspiciousSubmit");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){say("Enter a valid player UUID.",{error:true});return;}
 button.disabled=true;
 try{var r=await sb.rpc("kf_admin_mark_suspicious",{p_user_id:id});if(r.error)throw r.error;field.value="";await loadAdminSuspiciousPlayers();say("Suspicion count updated to "+fmtStat(r.data)+".",{silentToast:true});}
 catch(err){say("Could not save suspicious player: "+(err.message||err),{error:true});}
 finally{button.disabled=false;}
});
function showRegisteredUsers(){$("adminMonitoringSection").hidden=true;$("adminClockReportsSection").hidden=true;$("adminSecurityHubView").hidden=true;adminSecurityFolderOpen=false;$("adminMoveAuditSection").hidden=true;$("adminRejectedMovesSection").hidden=true;$("adminStreakReviewsSection").hidden=true;$("adminSuspiciousPlayersSection").hidden=true;if(!currentUser||currentUser.id!==adminOwnerId)return;$("adminPlayerReportsSection").hidden=true;$("adminOverviewView").hidden=true;$("adminUserManagementSection").hidden=false;$("adminPageTitle").textContent="👥 User Management";$("adminPageSubtitle").textContent="Manage Kingsfall accounts";$("adminBackToOverview").hidden=false;$("adminUserSearch").value="";renderAdminUsers();window.scrollTo({top:0,behavior:"smooth"});}
function showAdminOverview(){$("adminMonitoringSection").hidden=true;$("adminClockReportsSection").hidden=true;$("adminSecurityHubView").hidden=true;adminSecurityFolderOpen=false;$("adminFeaturesSection").hidden=true;$("adminMoveAuditSection").hidden=true;$("adminRejectedMovesSection").hidden=true;$("adminStreakReviewsSection").hidden=true;$("adminSuspiciousPlayersSection").hidden=true;$("adminPlayerReportsSection").hidden=true;$("adminUserManagementSection").hidden=true;$("adminOverviewView").hidden=false;$("adminPageTitle").textContent="🛡️ Admin Panel";$("adminPageSubtitle").textContent="Private administration · Owner access only";$("adminBackToOverview").hidden=true;window.scrollTo({top:0,behavior:"smooth"});}
function showAdminFeatureManagement(){$("adminMonitoringSection").hidden=true;$("adminClockReportsSection").hidden=true;$("adminSecurityHubView").hidden=true;adminSecurityFolderOpen=false;
 if(!currentUser||currentUser.id!==adminOwnerId)return;
 ["adminOverviewView","adminMoveAuditSection","adminRejectedMovesSection","adminStreakReviewsSection","adminSuspiciousPlayersSection","adminPlayerReportsSection","adminUserManagementSection"].forEach(function(id){$(id).hidden=true;});
 $("adminFeaturesSection").hidden=false;
 $("adminPageTitle").textContent="⚙️ Feature Management";
 $("adminPageSubtitle").textContent="Enable or disable game features · Admin only";
 $("adminBackToOverview").hidden=false;
 window.scrollTo({top:0,behavior:"smooth"});
}
$("adminBackToOverview").addEventListener("click",function(){if(adminSecurityFolderOpen)showSecurityHub();else showAdminOverview();});
$("adminOverview").addEventListener("click",function(e){if(e.target.closest(".registered-users-card"))showRegisteredUsers();else if(e.target.closest(".security-reports-card"))showSecurityHub();else if(e.target.closest(".feature-management-card"))showAdminFeatureManagement();});
$("adminOverview").addEventListener("keydown",function(e){if(e.key!=="Enter"&&e.key!==" ")return;if(e.target.closest(".registered-users-card")){e.preventDefault();showRegisteredUsers();}else if(e.target.closest(".security-reports-card")){e.preventDefault();showSecurityHub();}else if(e.target.closest(".feature-management-card")){e.preventDefault();showAdminFeatureManagement();}});
$("adminSecurityFolders").addEventListener("click",function(e){if(e.target.closest(".player-reports-card"))showPlayerReports();else if(e.target.closest(".shadow-audit-card"))showShadowMoveAudit();else if(e.target.closest(".clock-reports-card"))showClockReports();else if(e.target.closest(".streak-reviews-card"))showStreakReviews();else if(e.target.closest(".suspicious-players-card"))showSuspiciousPlayers();});
$("adminSecurityFolders").addEventListener("keydown",function(e){if(e.key!=="Enter"&&e.key!==" ")return;if(e.target.closest(".player-reports-card")){e.preventDefault();showPlayerReports();}else if(e.target.closest(".shadow-audit-card")){e.preventDefault();showShadowMoveAudit();}else if(e.target.closest(".clock-reports-card")){e.preventDefault();showClockReports();}else if(e.target.closest(".streak-reviews-card")){e.preventDefault();showStreakReviews();}else if(e.target.closest(".suspicious-players-card")){e.preventDefault();showSuspiciousPlayers();}});
var adminWinsTargetId=null,adminWinsTargetMetric="wins",adminWinsValue=0,adminWinsDragY=null,adminWinsDragRemainder=0;
function updateAdminWinsDisplay(){var n=$("adminWinsNumber");n.textContent=adminWinsValue.toLocaleString("en-US");$("adminWinsWheel").setAttribute("aria-valuenow",String(adminWinsValue));}
function openAdminWinsEditor(userId,metric){var u=adminUsersCache.find(function(x){return x.id===userId;});if(!u)return;var labels={wins:"Wins",tournament_wins:"Trophies",humiliation_losses:"Humiliation"};if(!Object.prototype.hasOwnProperty.call(labels,metric))return;adminWinsTargetId=userId;adminWinsTargetMetric=metric;adminWinsValue=Math.max(metric==="humiliation_losses"?-100000000:0,Math.min(100000000,Number(u[metric])||0));$("adminWinsTitle").textContent=labels[metric];$("adminWinsSave").textContent="Save "+labels[metric].toLowerCase();$("adminWinsPlayer").textContent=u.username||"Player";updateAdminWinsDisplay();$("adminWinsEditor").hidden=false;}
function closeAdminWinsEditor(){$("adminWinsEditor").hidden=true;adminWinsTargetId=null;adminWinsDragY=null;adminWinsDragRemainder=0;}
function changeAdminWins(delta){adminWinsValue=Math.max(adminWinsTargetMetric==="humiliation_losses"?-100000000:0,Math.min(100000000,adminWinsValue+delta));updateAdminWinsDisplay();}
$("adminUsers").addEventListener("click",function(e){var chip=e.target.closest(".admin-edit-count");if(chip){var userCard=chip.closest(".admin-user");if(userCard)openAdminWinsEditor(userCard.getAttribute("data-user-id"),chip.getAttribute("data-metric"));}});
$("adminUsers").addEventListener("keydown",function(e){var chip=e.target.closest(".admin-edit-count");if(chip&&(e.key==="Enter"||e.key===" ")){e.preventDefault();var userCard=chip.closest(".admin-user");if(userCard)openAdminWinsEditor(userCard.getAttribute("data-user-id"),chip.getAttribute("data-metric"));}});
$("adminWinsClose").addEventListener("click",closeAdminWinsEditor);$("adminWinsCancel").addEventListener("click",closeAdminWinsEditor);
$("adminWinsEditor").addEventListener("click",function(e){if(e.target===$("adminWinsEditor"))closeAdminWinsEditor();});
$("adminWinsWheel").addEventListener("wheel",function(e){e.preventDefault();changeAdminWins(e.deltaY<0?1:-1);},{passive:false});
$("adminWinsWheel").addEventListener("pointerdown",function(e){adminWinsDragY=e.clientY;adminWinsDragRemainder=0;this.setPointerCapture(e.pointerId);});
$("adminWinsWheel").addEventListener("pointermove",function(e){if(adminWinsDragY===null)return;var dy=adminWinsDragY-e.clientY;adminWinsDragY=e.clientY;adminWinsDragRemainder+=dy;var steps=Math.trunc(adminWinsDragRemainder/28);if(steps){changeAdminWins(steps);adminWinsDragRemainder-=steps*28;}});
$("adminWinsWheel").addEventListener("pointerup",function(){adminWinsDragY=null;adminWinsDragRemainder=0;});
$("adminWinsWheel").addEventListener("pointercancel",function(){adminWinsDragY=null;adminWinsDragRemainder=0;});
$("adminWinsWheel").addEventListener("keydown",function(e){if(e.key==="ArrowUp"){e.preventDefault();changeAdminWins(1);}if(e.key==="ArrowDown"){e.preventDefault();changeAdminWins(-1);}if(e.key==="PageUp"){e.preventDefault();changeAdminWins(10);}if(e.key==="PageDown"){e.preventDefault();changeAdminWins(-10);}});
$("adminWinsSave").addEventListener("click",async function(){if(!adminWinsTargetId)return;var btn=this;btn.disabled=true;try{var result=await sb.rpc("kf_admin_update_stats",{p_user_id:adminWinsTargetId,p_metric:adminWinsTargetMetric,p_value:adminWinsValue});if(result.error)throw result.error;var u=adminUsersCache.find(function(x){return x.id===adminWinsTargetId;});if(u)u[adminWinsTargetMetric]=adminWinsValue;renderAdminUsers();closeAdminWinsEditor();say((adminWinsTargetMetric==="wins"?"Wins":adminWinsTargetMetric==="tournament_wins"?"Trophies":"Humiliation")+" count updated.",{silentToast:true});}catch(err){say("Could not update wins: "+(err.message||err),{error:true});}finally{btn.disabled=false;}});
$("adminUsers").addEventListener("click",async function(e){
 var card=e.target.closest(".admin-user");if(!card)return;var id=card.getAttribute("data-user-id");
 if(e.target.closest(".admin-save-stat")){
  var metric=card.querySelector(".admin-metric").value,value=Number(card.querySelector(".admin-stat-value").value),btn=e.target.closest("button");
  if(!Number.isInteger(value)||value<0||value>100000000){say("Enter a valid non-negative whole number.",{error:true});return;}
  btn.disabled=true;try{var r=await sb.rpc("kf_admin_update_stats",{p_user_id:id,p_metric:metric,p_value:value});if(r.error)throw r.error;say("Player record updated.",{silentToast:true});await loadAdminPanel();}catch(err){say("Could not update record: "+(err.message||err),{error:true});btn.disabled=false;}
 }
 if(e.target.closest(".admin-ban")){
  var b=e.target.closest("button"),ban=b.getAttribute("data-banned")!=="true";if(!confirm((ban?"Ban":"Unban")+" this player?"))return;b.disabled=true;
  try{
   var banResult=await adminInvoke({action:"set_ban",user_id:id,banned:ban});
   var target=adminUsersCache.find(function(u){return u.id===id;});
   if(target)target.banned_until=banResult.banned_until||null;
   var userCard=card, state=userCard.querySelector(".admin-user-state");
   if(state){state.textContent=ban?"BANNED":"ACTIVE";state.classList.toggle("banned",ban);}
   b.textContent=ban?"Unban":"Ban";b.setAttribute("data-banned",String(ban));b.disabled=false;
   var bannedCount=adminUsersCache.filter(function(u){return u.banned_until&&new Date(u.banned_until)>new Date();}).length;
   var overviewStats=$("adminOverview").querySelectorAll(".admin-stat strong");
   if(overviewStats[1])overviewStats[1].textContent=String(bannedCount);
   say(ban?"Player banned.":"Player unbanned.",{silentToast:true});
  }catch(err){say("Account action failed: "+(err.message||err),{error:true});b.disabled=false;}
 }
});
$("adminFeatures").addEventListener("change",async function(e){
 if(!e.target.matches(".admin-toggle"))return;var el=e.target,key=el.dataset.feature,on=el.checked;el.disabled=true;
 try{var r=await sb.rpc("kf_admin_set_feature",{p_feature_key:key,p_enabled:on});if(r.error)throw r.error;await loadFeatureFlags();say("Feature setting updated.",{silentToast:true});}
 catch(err){el.checked=!on;say("Could not change feature: "+(err.message||err),{error:true});}finally{el.disabled=false;}
});
var kfFeatureFlags={},kfFeatureChannel=null,kfFeatureLoadBusy=false;
function applyFeatureFlagsToUI(f){
 // Keep cancellation controls visible for players already queued when a feature is disabled.
 var quickBar=document.querySelector(".quickbar"),quickButton=$("quickPlay"),quickState=$("quickState"),cancelQueue=$("cancelQueue");
 if(quickButton)quickButton.hidden=f.quick_play===false;
 if(quickState)quickState.hidden=f.quick_play===false;
 if(quickBar)quickBar.hidden=f.quick_play===false&&(!cancelQueue||cancelQueue.hidden);
 var rouletteBar=document.querySelector(".roulette-bar"),rouletteButton=$("rouletteBtn"),cancelRoulette=$("cancelRoulette");
 if(rouletteButton)rouletteButton.hidden=f.roulette===false;
  var bbBar=document.querySelector('.bloodblade-bar'),bbButton=$('bloodbladeBtn'),bbCancel=$('cancelBloodblade');
  if(bbButton)bbButton.hidden=f.bloodblade===false;
  if(bbBar)bbBar.hidden=f.bloodblade===false&&(!bbCancel||bbCancel.hidden);
 if(rouletteBar)rouletteBar.hidden=f.roulette===false&&(!cancelRoulette||cancelRoulette.hidden);
 var tournamentBar=document.querySelector(".tournament-bar");
 if(tournamentBar)tournamentBar.hidden=f.tournaments===false;
 if(f.tournaments===false&&$("tournDialog").open)$("tournDialog").close();
 var computerPanel=document.querySelector(".computer-panel");
 if(computerPanel)computerPanel.hidden=f.computer_mode===false;
}
function startFeatureFlagRealtime(){
 if(!sb||kfFeatureChannel||!sb.channel)return;
 kfFeatureChannel=sb.channel("kf-feature-flags")
  .on("postgres_changes",{event:"*",schema:"public",table:"kf_feature_flags"},function(){if(!document.hidden)loadFeatureFlags();})
  .subscribe(function(status){if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")console.warn("Feature flag Realtime unavailable; settings refresh on page return or reload.");});
}
async function loadFeatureFlags(){
 if(!sb||kfFeatureLoadBusy)return; kfFeatureLoadBusy=true;
 try{
  var r=await sb.rpc("kf_get_feature_flags");
  if(r.error){console.warn("Feature flags unavailable",r.error);return;}
  var f=r.data||{};kfFeatureFlags=f;applyFeatureFlagsToUI(f);startFeatureFlagRealtime();
 }catch(error){console.warn("Feature flag refresh failed",error);}
 finally{kfFeatureLoadBusy=false;}
}
// Feature flags are updated by Realtime and fetched on initial load or page return.

/* ===== HONORS PAGE ===== */
var honorsLoadSequence = 0;
async function loadHonors(){
  var grid = $("honorsGrid"), status = $("honorsStatus");
  if(!grid || !status) return;
  var sequence = ++honorsLoadSequence;
  status.hidden = false;
  status.textContent = "Loading champions…";
  if(!sb){ status.textContent = "Unable to connect to the champions archive."; return; }
  try{
    var response = await sb.rpc("kf_get_recent_tournament_champions");
    if(sequence !== honorsLoadSequence) return;
    if(response.error) throw response.error;
    var champions = Array.isArray(response.data) ? response.data.slice(0,50) : [];
    grid.replaceChildren();
    if(!champions.length){ status.textContent = "No tournament champions yet."; return; }
    champions.forEach(function(champion){
      var card=document.createElement("article");
      card.className="honors-champion";
      var photo=document.createElement("img");
      photo.className="honors-avatar";
      photo.alt="Champion avatar";
      photo.loading="lazy";
      photo.src=champion.winner_avatar || defaultAvatar();
      photo.onerror=function(){ this.onerror=null;this.src=defaultAvatar(); };
      var name=document.createElement("div");
      name.className="honors-name";
      name.textContent=champion.winner_username || "Champion";
      var date=document.createElement("time");
      date.className="honors-date";
      var finished=new Date(champion.completed_at);
      if(Number.isFinite(finished.getTime())){
        date.dateTime=champion.completed_at;
        date.textContent=finished.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
        date.title=finished.toLocaleString();
      }else{date.textContent="Date unavailable";}
      card.appendChild(photo);card.appendChild(name);card.appendChild(date);
      grid.appendChild(card);
    });
    status.hidden=true;
  }catch(error){
    if(sequence !== honorsLoadSequence) return;
    console.warn("Kingsfall Honors load failed:",error);
    status.textContent="Could not load tournament champions. Tap Refresh to retry.";
  }
}
$("honorsRefresh").onclick = loadHonors;
$("navHonors").onclick = function(){ showPage("honors"); };

initApp();
