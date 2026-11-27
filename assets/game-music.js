/* Kingsfall: native-app-only, original procedural ambient scores.
   Music never sends network requests, controls the clock, or touches game state. */
(() => {
  "use strict";
  if (!window.kfIsNativeApp || window.kfGameMusicInstalled) return;
  window.kfGameMusicInstalled = true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !window.Worker) return;
  const scores = [
    [64,4,[[48,52,55,59],[43,47,50,57],[45,48,52,55],[41,45,48,55]], [72,76,79,76,74,71,69,72],0],
    [60,4,[[50,53,57,60],[46,50,53,57],[48,52,55,60],[45,48,52,55]], [69,72,74,77,76,72,69,67],1],
    [70,3,[[43,47,50,54],[40,43,47,50],[48,52,55,59],[50,54,57,62]], [67,71,74,76,74,71,69,66],0],
    [58,4,[[45,48,52,59],[41,45,48,52],[48,52,55,59],[43,47,50,57]], [76,74,72,71,69,72,67,71],2],
    [66,4,[[53,57,60,64],[48,52,55,60],[50,53,57,60],[46,50,53,57]], [77,76,72,74,69,72,74,69],0],
    [62,3,[[52,55,59,62],[48,52,55,59],[43,47,50,54],[50,54,57,62]], [71,74,76,79,76,74,71,69],1],
    [56,4,[[48,55,60,64],[46,53,57,62],[45,52,55,60],[41,48,52,57]], [72,79,76,74,72,69,65,69],2],
    [72,3,[[45,48,52,57],[43,47,50,55],[41,45,48,52],[48,52,55,60]], [69,72,76,74,71,67,72,76],0],
    [63,4,[[50,54,57,61],[47,50,54,57],[43,47,50,54],[45,49,52,57]], [74,78,81,76,74,71,69,73],1],
    [59,4,[[48,51,55,58],[44,48,51,55],[51,55,58,62],[46,50,53,58]], [67,70,72,75,74,70,67,65],2]
  ];
  // Render a single score in a worker; no synthesis work runs on the game's JS thread.
  function renderScore(score) {
    const [tempo, beats, chords, melody, tone] = score;
    const rate = 22050, beat = 60/tempo, bar = beat*beats;
    const length = Math.round(8*bar*rate), out = new Float32Array(length);
    const TAU = 2*Math.PI;
    function note(midi, at, duration, volume, pad) {
      const start = Math.round(at*rate), count = Math.ceil(duration*rate);
      const hz = 440*Math.pow(2,(midi-69)/12);
      const w = TAU*hz/rate, attack = pad ? 0.45 : 0.014;
      const release = pad ? 0.7 : 0.45;
      for(let i=0;i<count;i++){
        const t=i/rate, env=Math.min(1,t/attack,Math.max(0,(duration-t)/release));
        const decay=pad ? 1 : Math.exp(-t*(tone===2?1.2:1.8));
        const wave=pad
          ? (Math.sin(w*i)+0.21*Math.sin(w*i*1.003)+0.12*Math.sin(w*i*2))/1.33
          : (Math.sin(w*i)+0.22*Math.sin(w*i*2)*Math.exp(-2*t)+0.075*Math.sin(w*i*3)*Math.exp(-4*t))/1.295;
        out[(start+i)%length] += wave*env*decay*volume;
      }
    }
    for(let b=0;b<8;b++){
      const c=chords[b%4], start=b*bar;
      note(c[0]-12,start,bar+0.3,0.045,true);
      for(let j=0;j<4;j++) note(c[j],start+0.05,bar+0.25,0.015,true);
      const order=tone===1?[0,2,1,3,2,1,3,2]:tone===2?[0,1,3,2,1,2,3,1]:[0,2,3,1,2,3,1,2];
      for(let k=0;k<beats*2;k++){
        const pitch=c[order[k]]+(k%4===3?12:0);
        note(pitch,start+k*beat/2,beat*1.3,0.062*(k%2?0.76:1),false);
      }
      note(melody[b],start+beat*0.25,beat*1.8,0.085,false);
      if(b%2===0) note(melody[(b+1)%8],start+beat*1.8,beat*1.35,0.052,false);
    }
    // Gentle wraparound echo for a seamless loop.
    const dry=out.slice(), d1=Math.round(rate*0.19), d2=Math.round(rate*0.37);
    for(let i=0;i<length;i++) out[i]=dry[i]+0.16*dry[(i+length-d1)%length]+0.09*dry[(i+length-d2)%length];
    return {rate, samples:out};
  }
  let worker=null, pending=-1, next=-1, prepared=null, ctx=null, source=null, gain=null;
  let currentKey=null, currentTrack=-1, activeTrack=null, bag=[], offlineSerial=0, oldComputer=false;
  let enabled=true, workerFailed=false, lastOfflineFen=null, offlineEnded=false;
  try { enabled=localStorage.getItem("kf_music_enabled_v1")!=="0"; } catch {}
  const buttons=[];
  function shuffle(){
    bag=scores.map((_,i)=>i);
    for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
    if(bag[bag.length-1]===currentTrack){[bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];}
  }
  function choose(){if(!bag.length)shuffle();return bag.pop();}
  function ensureWorker(){
    if(workerFailed)return false;
    if(worker)return true;
    let url;
    try{
      url=URL.createObjectURL(new Blob(["const renderScore="+renderScore.toString()+";self.onmessage=e=>{const r=renderScore(e.data.score);self.postMessage({id:e.data.id,rate:r.rate,samples:r.samples},[r.samples.buffer]);};"],{type:"text/javascript"}));
      worker=new Worker(url);
      worker.onmessage=e=>{
        if(e.data.id!==pending)return;
        pending=-1;
        if(e.data.id===next) prepared=e.data;
        if(currentKey&&currentTrack===e.data.id){activeTrack=e.data;play();}
      };
      worker.onerror=()=>{pending=-1;worker?.terminate();worker=null;workerFailed=true;};
      return true;
    }catch{worker=null;workerFailed=true;return false;}
    finally{if(url)URL.revokeObjectURL(url);}
  }
  function prepare(){
    if(!enabled||currentKey||prepared||pending!==-1)return;
    if(next<0)next=choose();
    if(ensureWorker()){pending=next;worker.postMessage({id:next,score:scores[next]});}
  }
  function stop(){
    if(source){try{source.stop();}catch{}try{source.disconnect();}catch{}source=null;}
    if(gain){try{gain.disconnect();}catch{}gain=null;}
  }
  function unlock(){
    if(!enabled)return;
    try{if(!ctx)ctx=new AC();if(ctx.state!=="running")ctx.resume().then(play).catch(()=>{});else play();}catch{}
  }
  function play(){
    if(!enabled||!currentKey||!activeTrack||document.hidden||!ctx||ctx.state!=="running"||source)return;
    try{
      const audio=ctx.createBuffer(1,activeTrack.samples.length,activeTrack.rate);
      audio.copyToChannel(activeTrack.samples,0);
      source=ctx.createBufferSource();source.buffer=audio;source.loop=true;
      gain=ctx.createGain();gain.gain.value=0.24;source.connect(gain);gain.connect(ctx.destination);source.start();
    }catch{stop();}
  }
  function updateButtons(){
    const fa=window.kfGetLanguage?.()==="fa";
    const label=enabled?(fa?"قطع موسیقی":"Mute music"):(fa?"پخش موسیقی":"Play music");
    for(const b of buttons){b.textContent=enabled?"♫":"♪";b.title=label;b.setAttribute("aria-label",label);b.setAttribute("aria-pressed",String(enabled));b.style.opacity=enabled?"1":".55";}
  }
  function toggle(){
    enabled=!enabled;
    try{localStorage.setItem("kf_music_enabled_v1",enabled?"1":"0");}catch{}
    if(!enabled)stop();
    else{unlock();if(currentKey&&!activeTrack)requestCurrent();else prepare();}
    updateButtons();
  }
  function addButton(parent, offline){
    if(!parent)return;
    const b=document.createElement("button");b.type="button";b.className="kf-music-toggle"+(offline?" kf-music-offline":"");
    b.addEventListener("click",toggle);
    parent.appendChild(b);buttons.push(b);
  }
  const css=document.createElement("style");
  css.textContent=".kf-music-toggle{display:none;flex:none;width:32px;height:32px;padding:0;border:1px solid var(--line2);border-radius:8px;background:var(--btn-bg);color:var(--gold2);font:20px/1 system-ui;cursor:pointer}body.game-focus .kf-music-toggle:not(.kf-music-offline){display:inline-grid;place-items:center}body.computer-mode .kf-music-offline{display:inline-grid;place-items:center}";
  document.head.appendChild(css);
  addButton(document.querySelector(".gfs-topbar .gfs-left"),false);
  addButton(document.getElementById("new")?.parentElement,true);
  updateButtons();
  function readGame(){
    const body=document.body;
    if(body.classList.contains("game-focus") && typeof onlineGame!=="undefined" && onlineGame?.id && onlineGame.status==="active")return "online:"+onlineGame.id;
    const isComputer=body.classList.contains("computer-mode") && document.getElementById("pageHome")?.classList.contains("active");
    if(isComputer&&!oldComputer){offlineSerial++;lastOfflineFen=null;offlineEnded=false;}
    oldComputer=!!isComputer;
    if(isComputer){
      try{
        const fen=game.fen();
        if(fen!==lastOfflineFen){lastOfflineFen=fen;offlineEnded=game.game_over();}
      }catch{}
      if(!offlineEnded)return "computer:"+offlineSerial;
    }
    return null;
  }
  function requestCurrent(){
    if(!enabled||!currentKey||activeTrack||pending===currentTrack)return;
    if(ensureWorker()){pending=currentTrack;worker.postMessage({id:currentTrack,score:scores[currentTrack]});}
  }
  function sync(){
    const key=readGame();
    if(key!==currentKey){
      stop();currentKey=key;activeTrack=null;
      if(key){
        currentTrack=next>=0?next:choose();
        if(prepared?.id===currentTrack)activeTrack=prepared;
        prepared=null;next=-1;
        requestCurrent();play();
      }else prepare();
    }else if(!key)prepare();
    else if(enabled&&!activeTrack)requestCurrent();
  }
  document.addEventListener("pointerdown",unlock,{passive:true,capture:true});
  document.addEventListener("keydown",unlock,{passive:true,capture:true});
  document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();else{sync();play();}});
  window.addEventListener("pagehide",()=>{stop();worker?.terminate();worker=null;pending=-1;});
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:["class"]});
  document.getElementById("new")?.addEventListener("click",()=>{if(oldComputer){offlineSerial++;lastOfflineFen=null;offlineEnded=false;setTimeout(sync,0);}});
  // Read-only lifecycle checks; never hook move submission or clock functions.
  setInterval(sync,900);
  setTimeout(sync,1000);
})();
