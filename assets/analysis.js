"use strict";
/* ============ ANALYSIS ============ */
var analysisMoves = [];
var analysisPositions = [];
var analysisIndex = 0;
var analysisRunning = false;
var analysisRunId = 0;
var adminReviewedPlayer = null;
var kfCriticalTrial = new URLSearchParams(window.location.search).get("criticalTest");
var kfCriticalTrialActive = kfCriticalTrial === "1200" || kfCriticalTrial === "2300";
var kfCriticalMoveTime = kfCriticalTrial === "2300" ? 2300 : 1200;

var KF_ANALYSIS_CACHE_KEY = "kf_analysis_local_cache_v1";
var KF_ANALYSIS_CACHE_VERSION = "sf19-lite-threepass-critical1200-20261116";
var KF_ANALYSIS_CACHE_MAX = 12;
var KF_ANALYSIS_CACHE_TTL = 21 * 24 * 60 * 60 * 1000;
// This cache is on this browser only. No analysis results are sent to Supabase.
function kfAnalysisCacheId(sourceGame){
  try{
    var h=sourceGame.history({verbose:true});
    if(!h.length)return null;
    var header=sourceGame.header?sourceGame.header():{};
    var start=(header&&header.FEN)||"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    return JSON.stringify([KF_ANALYSIS_CACHE_VERSION,start,h.map(function(m){
      return m.from+m.to+(m.promotion||"");
    })]);
  }catch(e){return null;}
}
function kfAnalysisReadCache(id){
  if(!id)return null;
  try{
    var entries=JSON.parse(localStorage.getItem(KF_ANALYSIS_CACHE_KEY)||"[]");
    if(!Array.isArray(entries))return null;
    var item=entries.find(function(x){return x&&x.id===id&&
      Date.now()-x.savedAt>=0&&Date.now()-x.savedAt<KF_ANALYSIS_CACHE_TTL;});
    if(!item||!Array.isArray(item.moves)||!Array.isArray(item.positions)||
       !item.moves.length||item.positions.length!==item.moves.length+1||
       item.moves.some(function(m){return !m||!m.san||!m.fenAfter||
         !m.quality||m.quality==="unrated";}))return null;
    return item;
  }catch(e){return null;}
}
function kfAnalysisWriteCache(id,moves,positions,progress){
  if(!id||!moves.length||positions.length!==moves.length+1||
     moves.some(function(m){return !m||m.quality==="unrated";}))return;
  try{
    var now=Date.now(),entries=JSON.parse(localStorage.getItem(KF_ANALYSIS_CACHE_KEY)||"[]");
    if(!Array.isArray(entries))entries=[];
    entries=entries.filter(function(x){return x&&x.id!==id&&
      now-x.savedAt>=0&&now-x.savedAt<KF_ANALYSIS_CACHE_TTL;});
    entries.unshift({id:id,savedAt:now,moves:moves,positions:positions,progress:progress});
    localStorage.setItem(KF_ANALYSIS_CACHE_KEY,JSON.stringify(entries.slice(0,KF_ANALYSIS_CACHE_MAX)));
  }catch(e){console.info("Kingsfall local analysis cache unavailable:",String(e&&e.message||e));}
}


/* Secondary engine: independent UCI state, never touches the game/primary engine. */
var analysisAuxEngines = [];
var ANALYSIS_EXTRA_WORKERS = 2;
function closeAnalysisAuxEngines(){
  analysisAuxEngines.forEach(function(engine){if(engine)engine.close();});
  analysisAuxEngines=[];
}
function createAnalysisAuxEngine(runId){
  var worker=null, active=null, closed=false, readyResolve, readyDone=false, bootTimer=null;
  var ready=new Promise(function(resolve){ readyResolve=resolve; });
  function settleReady(ok){if(!readyDone){readyDone=true;readyResolve(ok);}}
  function close(){
    if(closed)return;
    closed=true;
    clearTimeout(bootTimer);
    settleReady(false);
    if(active){
      var job=active;active=null;
      clearTimeout(job.stop);clearTimeout(job.force);
      job.resolve(null);
    }
    if(worker){try{worker.terminate();}catch(err){}worker=null;}
  }
  try{
    worker=new Worker(STOCKFISH_19_JS+"?v=19.0.1");
    worker.onmessage=function(event){
      if(closed||runId!==analysisRunId)return;
      String(event.data||"").split(/\r?\n/).forEach(function(line){
        if(line.indexOf("uciok")>=0){worker.postMessage("isready");return;}
        if(line.indexOf("readyok")>=0){clearTimeout(bootTimer);settleReady(true);return;}
        if(!active)return;
        if(line.indexOf("info ")===0&&!/\b(lowerbound|upperbound)\b/.test(line)){
          var depthM=line.match(/\bdepth (\d+)/);
          var cpM=line.match(/\bscore cp (-?\d+)/);
          var mateM=line.match(/\bscore mate (-?\d+)/);
          if(depthM&&(cpM||mateM)&&Number(depthM[1])>=active.depth){
            var depth=Number(depthM[1]),mate=mateM?Number(mateM[1]):0;
            active.depth=depth;
            active.score=cpM?Number(cpM[1]):(mate>0?10000-mate*100:-10000+Math.abs(mate)*100);
            var pvM=line.match(/\bpv (.+)$/);
            active.pv=pvM?pvM[1].trim().split(/\s+/).slice(0,12):null;
          }
        }
        if(line.indexOf("bestmove ")===0){
          var job=active;active=null;
          clearTimeout(job.stop);clearTimeout(job.force);
          var uci=line.split(/\s+/)[1];
          job.resolve({best:uci&&uci!=="(none)"?uci:null,score:job.score,depth:job.depth,pv:job.pv});
        }
      });
    };
    worker.onerror=close;
    worker.onmessageerror=close;
    bootTimer=setTimeout(close,12000);
    worker.postMessage("uci");
  }catch(err){close();}
  // Only one in-flight command sequence per worker.
  async function analyze(fen,ms,searchMoves){
    if(closed||runId!==analysisRunId||!await ready)return null;
    return new Promise(function(resolve){
      if(closed){resolve(null);return;}
      var job={resolve:resolve,score:null,depth:-1,pv:null,stop:null,force:null};
      active=job;
      try{
        worker.postMessage("setoption name Skill Level value 20");
        worker.postMessage("setoption name UCI_LimitStrength value false");
        worker.postMessage("setoption name MultiPV value 1");
        worker.postMessage("position fen "+fen);
        worker.postMessage("go movetime "+ms+(searchMoves&&searchMoves.length?" searchmoves "+searchMoves.join(" "):""));
        job.stop=setTimeout(function(){
          if(active!==job)return;
          try{worker.postMessage("stop");}catch(err){}
          job.force=setTimeout(function(){if(active===job)close();},1200);
        },ms+500);
      }catch(err){close();}
    });
  }
  return {ready:ready,analyze:analyze,close:close,alive:function(){return !closed;}};
}
async function runAnalysisWorkerPool(items,runId,readyAuxIndices,work,retry,onProgress){
  var next=0,completed=0,results=new Array(items.length),retryList=[];
  async function runner(engineIndex){
    while(analysisRunning&&runId===analysisRunId){
      var idx=next++;
      if(idx>=items.length)break;
      var value=null;
      try{value=await work(items[idx],engineIndex,idx,items.length);}catch(err){console.warn("Analysis job failed",err);}
      results[idx]=value;completed++;
      if(onProgress&&analysisRunning&&runId===analysisRunId)onProgress(completed,items.length);
      if(engineIndex>0&&retry&&retry(value,engineIndex))retryList.push(idx);
    }
  }
  await Promise.all([runner(0)].concat(readyAuxIndices.map(function(i){return runner(i+1);})));
  // Never start two requests simultaneously on the primary UCI channel.
  for(var j=0;j<retryList.length&&analysisRunning&&runId===analysisRunId;j++){
    var ix=retryList[j];
    results[ix]=await work(items[ix],0,ix,items.length);
  }
  return results;
}


$("analyze").onclick = function(){
  if(!game || game.history().length < 1){ say("Play some moves first.", {silentToast: true}); return; }
  openAnalysis();
};
// The native dialog 'close' event also fires after Escape/browser Back,
// so cleanup must not depend on the visible X button alone.
$("analysisDialog").addEventListener("close", function(){
  analysisRunning = false;
  analysisRunId++;
  closeAnalysisAuxEngines();
  if(stockfishAnalysisMode && stockfishWorker){
    try{ stockfishWorker.terminate(); }catch(err){}
    stockfishWorker = null;
    stockfishReady = false;
    stockfishThinking = false;
    stockfishAnalysisMode = false;
    stockfishCallback = null;
  }
  if(pendingAnalysisGame){ game = pendingAnalysisGame; pendingAnalysisGame = null; draw(); }
  adminReviewedPlayer=null;
});
$("analysisClose").onclick = function(){
  $("analysisDialog").close();
};
$("anStartBtn").onclick = function(){ gotoAnalysisIndex(0); };
$("anPrevBtn").onclick = function(){ gotoAnalysisIndex(analysisIndex - 1); };
$("anNextBtn").onclick = function(){ gotoAnalysisIndex(analysisIndex + 1); };
$("anEndBtn").onclick = function(){ gotoAnalysisIndex(analysisMoves.length); };

function kfSetAnalysisProgress(runId,percent){
  if(runId!==analysisRunId)return;
  var wrapper=$("anProgress"),label=$("anProgressPercent"),fill=$("anProgressFill");
  if(!wrapper||!label||!fill)return;
  var old=Number(wrapper.getAttribute("aria-valuenow"))||0;
  var value=Math.max(old,Math.min(100,Math.max(0,Math.floor(percent))));
  wrapper.classList.remove("error");
  wrapper.setAttribute("aria-valuenow",String(value));
  fill.style.width=value+"%";
  label.textContent=value+"%";
}
function kfAnalysisProgressError(runId,message){
  if(runId!==analysisRunId)return;
  var wrapper=$("anProgress");
  if(!wrapper)return;
  wrapper.classList.add("error");
  wrapper.title=message;
  $("anProgressPercent").textContent="Analysis error";
}
function openAnalysis(){
  closeAnalysisAuxEngines();
  analysisMoves = [];
  analysisPositions = [];
  analysisIndex = 0;
  analysisRunning = false;
  analysisRunId++;
  var thisRun = analysisRunId;
  $("anMoves").innerHTML = "";
  $("anSummary").innerHTML = "";
  $("anEvalWhite").style.height = "50%";
  $("anEvalBlack").style.height = "50%";
  $("anEvalLabel").textContent = "0.0";
  $("anProgress").setAttribute("aria-valuenow","0");
  $("anProgress").classList.remove("error");
  $("anProgress").removeAttribute("title");
  $("anProgressFill").style.width="0%";
  $("anProgressPercent").textContent="0%";
  $("analysisDialog").showModal();
  // Show the actual board immediately, even while Stockfish WASM initializes.
  try{
    var previewHistory=game.history({verbose:true});
    var previewHeader=game.header?game.header():{};
    var previewStart=previewHeader&&previewHeader.FEN?previewHeader.FEN:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    var previewChess=new Chess(previewStart);
    analysisMoves=[];
    analysisPositions=[previewChess.fen()];
    previewHistory.forEach(function(m){
      var move=previewChess.move(m);
      if(!move)return;
      analysisMoves.push({san:move.san,color:move.color,from:move.from,to:move.to,quality:"unrated",fenAfter:previewChess.fen(),evalAfter:null});
      analysisPositions.push(previewChess.fen());
    });
    renderMoveList();
    gotoAnalysisIndex(0);
  }catch(previewError){console.warn("Analysis board preview:",previewError);}
  // Reuse completed analysis of this exact move sequence from this device.
  // Report reviews deliberately bypass the cache.
  var cacheId=adminReviewedPlayer?null:kfAnalysisCacheId(game);
  var cached=kfCriticalTrialActive?null:kfAnalysisReadCache(cacheId);
  if(cached&&thisRun===analysisRunId){
    analysisMoves=cached.moves;
    analysisPositions=cached.positions;
    kfSetAnalysisProgress(thisRun,100);
    renderMoveList();
    renderSummary();
    gotoAnalysisIndex(0);
    console.info("[Kingsfall analysis] Local cache hit; Stockfish not started");
    return;
  }
  // Admin report review uses one engine so mobile browsers do not need
  // to initialize three separate WASM instances at the same time.
  if(!stockfishWorker) initStockfish();
  analysisAuxEngines=adminReviewedPlayer?[]:Array.from({length:ANALYSIS_EXTRA_WORKERS},function(){
    return createAnalysisAuxEngine(thisRun);
  });
  setTimeout(function(){ runFullAnalysis(thisRun); }, 50);
}

async function runFullAnalysis(runId){
  var waitStart = Date.now();
  if(!stockfishWorker) initStockfish();
  while(!stockfishWorker && Date.now() - waitStart < 75000){
    if(runId !== analysisRunId) return;
    await new Promise(function(resolve){ setTimeout(resolve, 100); });
  }
  if(runId !== analysisRunId) return;
  if(!stockfishWorker){
    kfAnalysisProgressError(runId,"Engine unavailable. Please retry.");
    return;
  }
  while(!stockfishReady && Date.now() - waitStart < 75000){
    if(runId !== analysisRunId) return;
    await new Promise(function(resolve){ setTimeout(resolve, 100); });
  }
  if(runId !== analysisRunId) return;
  if(!stockfishReady){
    kfAnalysisProgressError(runId,"Engine did not finish loading. Please retry.");
    return;
  }

  var sourceGame = game;
  var history = sourceGame.history({verbose: true});
  var header = sourceGame.header ? sourceGame.header() : {};
  var startFen = (header && header.FEN) ? header.FEN : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  var chess = new Chess(startFen);
  var positions = [chess.fen()];
  for(var i=0; i<history.length; i++){
    var replayed = chess.move(history[i]);
    if(!replayed){
      kfAnalysisProgressError(runId,"Could not replay move " + (i + 1) + ".");
      return;
    }
    positions.push(chess.fen());
  }

  var total = positions.length;
  var posAnalyses = new Array(total);
  var initialAnalyses = new Array(total);
  analysisRunning = true;
  var analysisStartedAt=performance.now();
  // Three independent engines share a position queue across every analysis stage.
  // Failed/slow auxiliary workers are excluded; the primary worker always runs.
  var readyAuxIndices=[];
  var readyStatuses=await Promise.all(analysisAuxEngines.map(function(engine){
    return Promise.race([
      engine.ready,
      new Promise(function(resolve){setTimeout(function(){resolve(false);},4500);})
    ]);
  }));
  readyStatuses.forEach(function(ok,i){
    if(ok&&analysisAuxEngines[i]&&analysisAuxEngines[i].alive())
      readyAuxIndices.push(i);
  });
  if(!analysisRunning||runId!==analysisRunId)return;
  var moveTime=history.length>80?550:850;
  var initialCache=new Map(),criticalCache=new Map();
  var maxCritical=Math.max(10,Math.ceil(total*0.65));
  var criticalCount=0,initialCompleted=0;
  var timeInitialStart=performance.now();
  function positionKey(fen){return fen.split(" ").slice(0,4).join(" ");}
  function analyzeWithEngine(fen,ms,engineIndex,searchMoves){
    if(engineIndex>0){
      var aux=analysisAuxEngines[engineIndex-1];
      if(aux&&aux.alive())return aux.analyze(fen,ms,searchMoves);
      return Promise.resolve(null);
    }
    return analyzeFenPromise(fen,ms,runId,1,searchMoves);
  }
  var positionIndices=Array.from({length:total},function(_,i){return i;});
  var firstResults=await runAnalysisWorkerPool(positionIndices,runId,readyAuxIndices,
    async function(p,engineIndex){
      var fen=positions[p],terminal=new Chess(fen);
      if(terminal.game_over())
        return {best:null,score:terminal.in_checkmate()?-10000:0,depth:99};
      var key=positionKey(fen);
      if(initialCache.has(key))return initialCache.get(key);
      var task=analyzeWithEngine(fen,moveTime,engineIndex);
      initialCache.set(key,task);
      var result=await task;
      if(!result||result.score==null)initialCache.delete(key);
      initialCompleted++;
      if(analysisRunning&&runId===analysisRunId)
        kfSetAnalysisProgress(runId,70*initialCompleted/total);
      return result;
    },function(result){return !result||result.score==null;});
  if(!analysisRunning||runId!==analysisRunId)return;
  for(var p=0;p<total;p++){
    posAnalyses[p]=firstResults[p];
    initialAnalyses[p]=firstResults[p];
  }
  if(!stockfishWorker){
    kfAnalysisProgressError(runId,"Analysis stopped: engine became unavailable.");
    analysisRunning=false;
    closeAnalysisAuxEngines();
    return;
  }
  kfSetAnalysisProgress(runId,70);
  var initialElapsed=performance.now()-timeInitialStart;
  var queuedCritical=new Set();
  for(var p=1;p<total;p++){
    var pre=initialAnalyses[p-1],post=initialAnalyses[p];
    if(!pre||!post)continue;
    var shallow=pre.depth<11||post.depth<11;
    var shift=pre.score!=null&&post.score!=null?Math.abs(pre.score+post.score):0;
    if(shallow||shift>=75){
      if(pre.depth!==99)queuedCritical.add(p-1);
      if(post.depth!==99)queuedCritical.add(p);
    }
  }
  var refineIndices=Array.from(queuedCritical);
  refineIndices.sort(function(a,b){return initialAnalyses[a].depth-initialAnalyses[b].depth;});
  refineIndices=refineIndices.slice(0,maxCritical);
  var timeCriticalStart=performance.now();
  await runAnalysisWorkerPool(refineIndices,runId,readyAuxIndices,
    async function(at,engineIndex){
      var key=positionKey(positions[at]);
      var task=criticalCache.get(key);
      if(!task){
        task=analyzeWithEngine(positions[at],kfCriticalMoveTime,engineIndex);
        criticalCache.set(key,task);
      }
      var checked=await task;
      if((!checked||checked.score==null)&&engineIndex===0&&criticalCache.get(key)===task){
        criticalCache.delete(key);
        checked=await analyzeWithEngine(positions[at],kfCriticalMoveTime,0);
      }
      if(checked&&checked.score!=null&&
         posAnalyses[at]&&checked.depth>=posAnalyses[at].depth)
        posAnalyses[at]=checked;
      criticalCount++;
      if(analysisRunning&&runId===analysisRunId)
        kfSetAnalysisProgress(runId,70+15*criticalCount/Math.max(1,refineIndices.length));
      return checked;
    },function(result){return !result||result.score==null;});
  if(!analysisRunning||runId!==analysisRunId)return;
  kfSetAnalysisProgress(runId,85);
  var criticalElapsed=performance.now()-timeCriticalStart;

  // Review scores from the moving player's perspective using a bounded win chance,
  // not raw centipawn thresholds that exaggerate already won/lost positions.
  function chance(cp){
    if(cp == null || !isFinite(cp)) return null;
    return 1 / (1 + Math.exp(-Math.max(-1500, Math.min(1500, cp)) * 0.0036));
  }
  // Material is measured in pawn units from the original mover's perspective.
  // Check every square, not just the moved piece: a tactic can offer a queen/rook
  // on its original square (e.g. a discovered attack).
  function materialFor(fen, color){
    var c = new Chess(fen), value = {p:1,n:3,b:3,r:5,q:9,k:0};
    var result = 0, squares = "abcdefgh";
    for(var rank=1; rank<=8; rank++){
      for(var file=0; file<8; file++){
        var piece = c.get(squares[file] + rank);
        if(piece) result += (piece.color === color ? 1 : -1) * value[piece.type];
      }
    }
    return result;
  }
  function playUci(c, uci){
    if(!uci || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
    try {
      return c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci.slice(4,5) || "q"});
    } catch(err){ return null; }
  }
  function provenMaterialOffer(index, replyUci, continuation){
    var mover = history[index].color, c = new Chess(positions[index+1]);
    var reply = playUci(c, replyUci);
    // Opponent must actually take a non-pawn piece, whether it moved or not.
    if(!reply || !reply.captured || !({n:1,b:1,r:1,q:1})[reply.captured]) return null;
    // Search continuation for an immediate recapture or equal exchange.
    var line = continuation || [];
    for(var t=0; t<Math.min(4,line.length); t++){
      if(!playUci(c,line[t])) break;
    }
    var materialCost = materialFor(c.fen(),mover) - materialFor(positions[index],mover);
    if(materialCost > -2) return null;
    return {piece:reply.captured, square:reply.to, materialCost:materialCost};
  }
  var moves = [];
  for(var j=0; j<history.length; j++){
    var before = posAnalyses[j], after = posAnalyses[j+1];
    var playedUci = history[j].from + history[j].to + (history[j].promotion ? String(history[j].promotion).toLowerCase() : "");
    var bestUci = before && before.best ? before.best : null;
    var evalBefore = before && before.score != null ? before.score : null;
    var evalAfter = after && after.score != null ? -after.score : null;
    var wBefore = chance(evalBefore), wAfter = chance(evalAfter);
    var loss = evalBefore != null && evalAfter != null ? Math.max(0, evalBefore - evalAfter) : null;
    var winLoss = wBefore != null && wAfter != null ? Math.max(0, wBefore - wAfter) : null;
    var depthOk = before && after && before.depth >= 11 && after.depth >= 11;
    var quality = "unrated";
    if(winLoss != null && depthOk){
      if(bestUci && playedUci === bestUci && winLoss <= 0.04) quality = "best";
      else if(winLoss <= 0.045) quality = "good";
      else if(winLoss <= 0.09) quality = "inaccuracy";
      else if(winLoss <= 0.18) quality = "mistake";
      else quality = "blunder";
    }
    moves.push({
      san:history[j].san, color:history[j].color,
      from:history[j].from, to:history[j].to,
      quality:quality, evalBefore:evalBefore, evalAfter:evalAfter,
      loss:loss, winLoss:winLoss, winBefore:wBefore, winAfter:wAfter,
      beforeDepth:before ? before.depth : -1,
      afterDepth:after ? after.depth : -1,
      best:bestUci, fenAfter:positions[j+1]
    });
  }
  // Review promising best moves for sound sacrifices (Brilliant) and
  // independently compare the second-best move for uniqueness (Great).
  var candidates = moves.map(function(m,i){return {m:m,i:i};}).filter(function(x){
    return x.m.quality === "best" &&
      x.m.beforeDepth >= 11 && x.m.afterDepth >= 11 &&
      x.m.winBefore > 0.08 && x.m.winBefore < 0.92 &&
      x.m.winLoss <= 0.02;
  }).sort(function(a,b){
    // Review tactical candidates before routine opening moves.
    function priority(x){
      var h = history[x.i];
      return (h.piece !== "p" ? 2 : 0) + (h.captured ? 3 : 0) +
             (h.san.indexOf("+") >= 0 ? 2 : 0) + (h.san.indexOf("#") >= 0 ? 4 : 0);
    }
    return priority(b) - priority(a);
  }).slice(0, 12);
  var greatDiagnostics = {candidates:candidates.length,paired:0,unique:0,alternative:0};
  var exceptionalTiming={start:performance.now(),multiMs:0,bestMs:0,secondMs:0,fallbacks:0,pairedDirect:0};
  var verifiedPairs=await runAnalysisWorkerPool(candidates,runId,readyAuxIndices,
    async function(candidate,engineIndex,idx){
      var mi=candidate.i,mm=candidate.m;
      // Progress advances on completed checks, not on task assignment.
      var played=mm.from+mm.to+(history[mi].promotion||"");
      var legal=new Chess(positions[mi]).moves({verbose:true}).map(function(m){
        return m.from+m.to+(m.promotion||"");
      });
      if(legal.length<2||legal.indexOf(played)<0)return null;
      var bestStart=performance.now();
      var best=await analyzeWithEngine(positions[mi],1650,engineIndex);
      exceptionalTiming.bestMs+=performance.now()-bestStart;
      if(!best||best.best!==played||best.score==null||best.depth<12)return null;
      var alternatives=legal.filter(function(u){return u!==played;});
      var secondStart=performance.now();
      var second=await analyzeWithEngine(positions[mi],1650,engineIndex,alternatives);
      exceptionalTiming.secondMs+=performance.now()-secondStart;
      if(!second||!second.best||second.score==null||second.depth<12||
         alternatives.indexOf(second.best)<0)return null;
      return {best:best,second:second};
    },function(result,engineIndex){
      var aux=analysisAuxEngines[engineIndex-1];
      return !result&&(!aux||!aux.alive());
    },function(completed,totalCandidates){
      kfSetAnalysisProgress(runId,85+14*completed/Math.max(1,totalCandidates));
    });
  if(!analysisRunning||runId!==analysisRunId)return;
  for(var ci=0;ci<candidates.length;ci++){
    var candidate=candidates[ci],mi=candidate.i,mm=candidate.m;
    var verified=verifiedPairs[ci];
    if(!verified)continue;
    var verifiedBest=verified.best,verifiedSecond=verified.second;
    var playedMoveUci=mm.from+mm.to+(history[mi].promotion||"");
    var multi={
      uci:verifiedBest.best,score:verifiedBest.score,depth:verifiedBest.depth,
      pv:verifiedBest.pv,
      second:{uci:verifiedSecond.best,score:verifiedSecond.score,depth:verifiedSecond.depth},
      paired:true
    };
      greatDiagnostics.alternative++;
    greatDiagnostics.paired++;
    if(multi.uci !== playedMoveUci) continue;
    var gap = chance(multi.score) - chance(multi.second.score);
    if(isFinite(gap) && gap >= 0.12) greatDiagnostics.unique++;

    // Verify an objectively sound sacrifice. A loose piece alone is not enough:
    // the capture should be the engine's best reply, or a near-best played reply.
    // This correctly rejects 5.Nxe5 Bxd1 in Legal's Mate when taking the queen
    // is itself a huge blunder.
    var offer = null;
    if(multi.pv && multi.pv.length >= 2 && multi.pv[0] === multi.uci){
      offer = provenMaterialOffer(mi, multi.pv[1], multi.pv.slice(2));
    }
    if(!offer && mi+2 < positions.length && history[mi+1] && history[mi+1].captured){
      var replyMove = history[mi+1];
      var postCapture = posAnalyses[mi+2];
      var bestDefender = posAnalyses[mi+1];
      var playedReply = replyMove.from + replyMove.to + (replyMove.promotion || "");
      var replyCost = bestDefender && postCapture && bestDefender.score != null &&
        postCapture.score != null ?
        chance(bestDefender.score) - chance(-postCapture.score) : null;
      if(replyCost != null && replyCost <= 0.045 &&
         bestDefender.depth >= 13 && postCapture.depth >= 13){
        offer = provenMaterialOffer(mi, playedReply,
          postCapture.pv && postCapture.pv.length ? postCapture.pv : []);
      }
    }
    // Brilliant: a verified, objectively sound material sacrifice. Unlike Great,
    // the sacrifice need not be the only good move in the position.
    if(offer && mm.winAfter >= 0.40 && mm.winLoss <= 0.015 &&
       multi.depth >= 15){
      mm.quality = "brilliant";
      mm.sacrifice = offer;
    } else if(isFinite(gap) && mm.winLoss <= 0.02 && multi.depth >= 13 &&
               multi.second.depth >= 13) {
      // Great = the only good move: the strongest alternative must be meaningfully
      // worse and itself fail the Good threshold relative to the best continuation.
      // Do not require checks, sacrifices or spectacular-looking moves.
      var bestChance = chance(multi.score);
      var nextChance = chance(multi.second.score);
      var goodAlternative = bestChance != null && nextChance != null &&
                            (bestChance - nextChance) <= 0.045;
      var onlyGoodMove = bestChance != null && nextChance != null &&
                         bestChance >= 0.40 && gap >= 0.12 &&
                         !goodAlternative;
      // A king's forced response to check, or a simple king capture,
      // is not Great even if the alternative is much worse.
      // Keep the original Best/Good assessment in these cases.
      var kingMove = history[mi].piece === "k";
      var kingEscapeFromCheck = kingMove &&
                                new Chess(positions[mi]).in_check();
      var kingCapturesPiece = kingMove && !!history[mi].captured;
      if(onlyGoodMove && !kingEscapeFromCheck && !kingCapturesPiece) {
        mm.quality = "great";
        mm.alternative = multi.second.uci;
        mm.alternativeGap = gap;
      }
    }
  }

  // Diagnostic-only timing: no changes to Stockfish settings or quality labels.
  console.info("[Kingsfall exceptional moves]", {
    candidates:greatDiagnostics.candidates,
    multiMs:Math.round(exceptionalTiming.multiMs),
    fallbackBestMs:Math.round(exceptionalTiming.bestMs),
    fallbackSecondMs:Math.round(exceptionalTiming.secondMs),
    fallbacks:exceptionalTiming.fallbacks,
    directPairs:exceptionalTiming.pairedDirect,
    verified:greatDiagnostics.paired,
    totalMs:Math.round(performance.now()-exceptionalTiming.start),
    brilliant:moves.filter(function(m){return m.quality === "brilliant";}).length,
    great:moves.filter(function(m){return m.quality === "great";}).length
  });
  var totalElapsed=performance.now()-analysisStartedAt;
  console.info("[Kingsfall dual analysis timing]",{
    activeWorkers:1+readyAuxIndices.length,
    auxiliaryReady:readyAuxIndices.length,
    firstPassMs:Math.round(initialElapsed),
    criticalMs:Math.round(criticalElapsed),
    exceptionalMs:Math.round(performance.now()-exceptionalTiming.start),
    totalMs:Math.round(totalElapsed),positions:total,
    critical:refineIndices.length,exceptional:candidates.length
  });
  closeAnalysisAuxEngines();
  kfSetAnalysisProgress(runId,100);
  if(kfCriticalTrialActive)
    $("anProgressPercent").textContent="100% · "+(totalElapsed/1000).toFixed(1)+"s · "+kfCriticalMoveTime+"ms";
  analysisMoves = moves;
  analysisPositions = positions;
  analysisRunning = false;
  var unrated = moves.filter(function(move){ return move.quality === "unrated"; }).length;
  // Only the percentage is shown; detailed diagnostics remain in the console.
  if(!kfCriticalTrialActive && !adminReviewedPlayer && unrated===0)
    kfAnalysisWriteCache(kfAnalysisCacheId(sourceGame),moves,positions,"100%");
  renderMoveList();
  renderSummary();
  gotoAnalysisIndex(0);
}

function analyzeFenPromise(fen, moveTime, runId, multiPV, searchMoves){
  return new Promise(function(resolve){
    if(!stockfishWorker || !stockfishReady || runId !== analysisRunId){
      resolve({best: null, score: null, depth: -1});
      return;
    }
    var finished = false;
    var stopTimer = null;
    var forceTimer = null;
    var workerAtStart = stockfishWorker;

    function finish(result){
      if(finished) return;
      finished = true;
      clearTimeout(stopTimer);
      clearTimeout(forceTimer);
      if(stockfishCallback === onBestMove) stockfishCallback = null;
      stockfishAnalysisMode = false;
      stockfishThinking = false;
      resolve(result);
    }
    function onBestMove(result){
      finish({
        best: result && result.uci ? result.uci : null,
        score: result && result.score != null ? result.score : null,
        depth: result && result.depth != null ? result.depth : -1,
        second: result && result.second ? result.second : null,
        pv: result && result.pv ? result.pv : null,
        paired:!!(result && result.paired)
      });
    }

    currentAnalyzeScore = null;
    currentAnalyzeDepth = -1;
    currentAnalyzeSecond = null;
    currentAnalyzePV = null;
    currentAnalyzeLinesByDepth = {};
    currentAnalyzePVCount = multiPV === 2 ? 2 : 1;
    stockfishAnalysisMode = true;
    stockfishThinking = true;
    stockfishCallback = onBestMove;
    workerAtStart.postMessage("setoption name Skill Level value 20");
    workerAtStart.postMessage("setoption name UCI_LimitStrength value false");
    workerAtStart.postMessage("setoption name MultiPV value " + (multiPV === 2 ? 2 : 1));
    workerAtStart.postMessage("position fen " + fen);
    workerAtStart.postMessage("go movetime " + moveTime + (searchMoves && searchMoves.length ? " searchmoves " + searchMoves.join(" ") : ""));

    stopTimer = setTimeout(function(){
      if(finished) return;
      try{ workerAtStart.postMessage("stop"); }catch(err){}
      forceTimer = setTimeout(function(){
        if(finished) return;
        try{ workerAtStart.terminate(); }catch(err){}
        if(stockfishWorker === workerAtStart){
          stockfishWorker = null;
          stockfishReady = false;
        }
        finish({best: null, score: null, depth: -1});
      }, 1200);
    }, 5000);
  });
}

function qualityMark(q){
  if(q === "brilliant") return "!!";
  if(q === "great") return "!";
  if(q === "best") return "★";
  if(q === "good") return "✓";
  if(q === "inaccuracy") return "?!";
  if(q === "mistake") return "?";
  if(q === "blunder") return "??";
  return "";
}

function renderMoveList(){
  var el = $("anMoves");
  el.innerHTML = "";
  var num = 1, i = 0;
  while(i < analysisMoves.length){
    var row = document.createElement("div");
    row.className = "an-move-row";
    var n = document.createElement("span");
    n.className = "num";
    n.textContent = num + ".";
    row.appendChild(n);
    var wm = analysisMoves[i];
    var wCell = document.createElement("span");
    wCell.className = "an-move";
    wCell.dataset.idx = i;
    wCell.innerHTML = wm.san + '<span class="q q-' + wm.quality + '">' + qualityMark(wm.quality) + '</span>';
    (function(idx){ wCell.onclick = function(){ gotoAnalysisIndex(idx+1); }; })(i);
    row.appendChild(wCell);
    i++;
    if(i < analysisMoves.length){
      var bm = analysisMoves[i];
      var bCell = document.createElement("span");
      bCell.className = "an-move";
      bCell.dataset.idx = i;
      bCell.innerHTML = bm.san + '<span class="q q-' + bm.quality + '">' + qualityMark(bm.quality) + '</span>';
      (function(idx){ bCell.onclick = function(){ gotoAnalysisIndex(idx+1); }; })(i);
      row.appendChild(bCell);
      i++;
    } else {
      row.appendChild(document.createElement("span"));
    }
    el.appendChild(row);
    num++;
  }
}

function renderSummary(){
  var counts = {brilliant:0, great:0, best:0, good:0, inaccuracy:0, mistake:0, blunder:0, unrated:0};
  analysisMoves.forEach(function(m){ counts[m.quality]++; });
  var el = $("anSummary");
  var playerScore = "";
  if(adminReviewedPlayer){
    var relevant = analysisMoves.filter(function(move){return move.color===adminReviewedPlayer.color && move.quality!=="unrated" && Number.isFinite(Number(move.winLoss));});
    if(relevant.length){
      var avg = relevant.reduce(function(total,move){
        return total + Math.max(0,100-200*Math.max(0,Number(move.winLoss)));
      },0) / relevant.length;
      playerScore = '<div class="stat-row"><strong>Estimated move accuracy · '+adminReviewedPlayer.name.replace(/[&<>"\x27]/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","\x27":"&#39;"}[ch]||ch;})+'</strong><strong>'+avg.toFixed(1)+'%</strong></div>'+
        '<div style="font-size:11px;margin:5px 0 10px">Kingsfall estimate from '+relevant.length+' evaluated moves. Not a Chess.com score or proof of cheating.</div>';
    }else playerScore='<div class="stat-row">Not enough evaluated moves for an accuracy estimate.</div>';
  }
  el.innerHTML = playerScore +
    '<div style="font-weight:800;margin-bottom:6px;">Move quality</div>' +
    '<div class="stat-row"><span>!! Brilliant</span><span>' + counts.brilliant + '</span></div>' +
    '<div class="stat-row"><span>! Great</span><span>' + counts.great + '</span></div>' +
    '<div class="stat-row"><span>★ Best</span><span>' + counts.best + '</span></div>' +
    '<div class="stat-row"><span>✓ Good</span><span>' + counts.good + '</span></div>' +
    '<div class="stat-row"><span>?! Inaccuracy</span><span>' + counts.inaccuracy + '</span></div>' +
    '<div class="stat-row"><span>? Mistake</span><span>' + counts.mistake + '</span></div>' +
    '<div class="stat-row"><span>?? Blunder</span><span>' + counts.blunder + '</span></div>' +
    '<div class="stat-row"><span>Not evaluated</span><span>' + counts.unrated + '</span></div>';
}

function gotoAnalysisIndex(idx){
  if(idx < 0) idx = 0;
  if(idx > analysisMoves.length) idx = analysisMoves.length;
  analysisIndex = idx;
  var fen = idx === 0 ? analysisPositions[0] : analysisMoves[idx-1].fenAfter;
  var lastMoveInfo = idx > 0 ? analysisMoves[idx-1] : null;
  renderAnalysisBoard(fen, lastMoveInfo);
  updateEvalBar(idx);
  highlightActiveMove(idx);
}

function highlightActiveMove(idx){
  var cells = document.querySelectorAll("#anMoves .an-move");
  for(var i=0;i<cells.length;i++){
    cells[i].classList.toggle("active", parseInt(cells[i].dataset.idx, 10) === idx - 1);
  }
}

function renderAnalysisBoard(fen, lastMoveInfo){
  var tempGame = new Chess(fen);
  var board = $("anBoard");
  board.innerHTML = "";
  for(var vr=0;vr<8;vr++){
    for(var vc=0;vc<8;vc++){
      var s = files[vc] + (8-vr);
      var p = tempGame.get(s);
      var b = document.createElement("div");
      b.className = "square " + ((vr+vc)%2 === 0 ? "light" : "dark");
      if(p) b.innerHTML = svg(p);
      if(lastMoveInfo && lastMoveInfo.to === s){
        var badge = document.createElement("span");
        badge.className = "an-badge q-" + lastMoveInfo.quality;
        badge.textContent = qualityMark(lastMoveInfo.quality);
        b.appendChild(badge);
      }
      board.appendChild(b);
    }
  }
}

function updateEvalBar(idx){
  var evalCp = null;
  if(idx === 0 && analysisMoves.length && analysisMoves[0].evalBefore != null){
    evalCp = analysisMoves[0].evalBefore * (analysisMoves[0].color === "w" ? 1 : -1);
  } else if(idx > 0){
    var m = analysisMoves[idx-1];
    var moverColor = m.color === "w" ? 1 : -1;
    if(m.evalAfter != null) evalCp = m.evalAfter * moverColor;
  }
  if(evalCp == null){
    $("anEvalWhite").style.height = "50%";
    $("anEvalBlack").style.height = "50%";
    $("anEvalLabel").textContent = "—";
    return;
  }
  var whitePct = 100 / (1 + Math.pow(10, -evalCp/400));
  if(whitePct < 3) whitePct = 3;
  if(whitePct > 97) whitePct = 97;
  $("anEvalWhite").style.height = whitePct + "%";
  $("anEvalBlack").style.height = (100 - whitePct) + "%";
  var label;
  if(Math.abs(evalCp) >= 9000){
    var mateIn = Math.round((10000 - Math.abs(evalCp)) / 100);
    label = (evalCp > 0 ? "M" : "-M") + mateIn;
  } else {
    label = (evalCp >= 0 ? "+" : "") + (evalCp/100).toFixed(1);
  }
  $("anEvalLabel").textContent = label;
  }
  /* ===== UNIFIED submitMove (FIX: try/finally + tournament ordering) ===== */
