import { Chess } from './chess.js';

const $ = id => document.getElementById(id);
const game = new Chess();
const words = {
  en: ['Offline chess','Your pieces','Strength','White','Black','Easy','Medium','Hard','New game','Online home','Preparing Stockfish…','Your move','Stockfish is thinking…','Checkmate','Stalemate','Draw','Check','Promote to','Queen','Rook','Bishop','Knight','Engine unavailable. Tap New game to retry.','Start a new game?'],
  fa: ['شطرنج آفلاین','رنگ مهره','سختی','سفید','سیاه','آسان','متوسط','سخت','بازی جدید','بازگشت به بخش آنلاین','در حال آماده‌سازی استاک‌فیش…','نوبت شماست','استاک‌فیش در حال فکر کردن است…','کیش‌ومات','پات','مساوی','کیش','ارتقای پیاده به','وزیر','رخ','فیل','اسب','موتور آماده نشد. دوباره بازی جدید را بزنید.','بازی جدید شروع شود؟']
};
const key = 'kf_android_ui_language_v1';
let lang = localStorage.getItem(key) || (navigator.language.startsWith('fa') ? 'fa' : 'en');
const t = index => words[lang === 'fa' ? 'fa' : 'en'][index];
let player = 'w', selected = '', ready = false, failed = false, worker, generation = 0, pending = [];
let engineAssets;
async function engineUrls(){
  const files = ['stockfish-19-lite-single.js','stockfish-19-lite-single.wasm'];
  return Promise.all(files.map(async file => {
    const response = await fetch(file);
    if (!response.ok) throw new Error(file);
    return URL.createObjectURL(await response.blob());
  }));
}
function status(){
  if(failed) return t(22);
  if(!ready) return t(10);
  if(game.isCheckmate()) return t(13);
  if(game.isStalemate()) return t(14);
  if(game.isDraw()) return t(15);
  return (game.turn() === player ? t(11) : t(12)) + (game.isCheck() ? ' · ' + t(16) : '');
}
const cells = [];
function draw(){
  const targets = new Set(selected ? game.moves({square:selected,verbose:true}).map(move=>move.to) : []);
  for(let i=0;i<64;i++){
    const file = player==='w' ? i%8 : 7-i%8;
    const rank = player==='w' ? 8-Math.floor(i/8) : 1+Math.floor(i/8);
    const square = 'abcdefgh'[file]+rank, piece=game.get(square);
    let button=cells[i];
    if(!button){
      button=document.createElement('button');
      button.className='sq'+((file+rank)%2 ? ' dark':'');
      cells.push(button);
      $('board').append(button);
    }
    const id=piece ? piece.color+piece.type : '';
    if(button.dataset.square!==square || button.dataset.piece!==id){
      button.dataset.square=square;
      button.setAttribute('aria-label',square+(id?' '+id:''));
    }
    if(button.dataset.piece!==id){
      button.dataset.piece=id;
      button.innerHTML=piece ? '<svg aria-hidden="true" class="'+(piece.color==='w'?'white':'black')+'"><use href="pieces.svg#vip-dual-'+id+'"/></svg>' : '';
    }
    button.classList.toggle('target',targets.has(square));
    const pressed=String(selected===square);
    if(button.getAttribute('aria-pressed')!==pressed) button.setAttribute('aria-pressed',pressed);
  }
  const message=status();
  if($('status').textContent!==message) $('status').textContent=message;
}
function labels(){
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='fa'?'rtl':'ltr';
  $('language').textContent=lang==='fa'?'English':'فارسی';
  for(const [id,n] of Object.entries({title:0,sideLabel:1,levelLabel:2,start:8,home:9,promote:17})) $(id).textContent=t(n);
  [...$('side').options].forEach((o,i)=>o.text=t(3+i));
  [...$('level').options].forEach((o,i)=>o.text=t(5+i));
  draw();
}
function think(){
  draw();
  if(!ready || game.isGameOver() || game.turn()===player) return;
  worker.postMessage('position fen '+game.fen());
  worker.postMessage('go movetime '+({'0':120,'8':350,'20':800}[$('level').value]));
}
async function start(){
  const current=++generation;
  worker?.terminate(); ready=false; failed=false; selected=''; game.reset(); player=$('side').value;
  draw();
  function error(){
    if(current!==generation) return;
    ready=false; failed=true; draw();
  }
  try{
    engineAssets ??= engineUrls().catch(e=>{engineAssets=null;throw e;});
    const [js,wasm]=await engineAssets;
    if(current!==generation) return;
    worker=new Worker(js+'#'+encodeURIComponent(wasm));
    worker.onerror=error;
    worker.onmessage=({data})=>{
      if(current!==generation || typeof data!=='string') return;
      if(data==='uciok'){
        worker.postMessage('setoption name Skill Level value '+$('level').value);
        worker.postMessage('isready');
      }else if(data==='readyok'){ready=true;think();}
      else if(data.startsWith('bestmove ')){
        const move=data.split(' ')[1];
        try{game.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});draw();}catch{error();}
      }
    };
    worker.postMessage('uci');
  }catch{error();}
}
function play(move){
  game.move(move); selected='';think();
}
$('board').onclick=event=>{
  const square=event.target.closest('[data-square]')?.dataset.square;
  if(!square || !ready || game.turn()!==player || game.isGameOver()) return;
  const moves=selected ? game.moves({square:selected,verbose:true}).filter(m=>m.to===square) : [];
  if(moves.length>1){
    pending=moves;
    $('choices').replaceChildren(...['q','r','b','n'].map((p,i)=>{
      const b=document.createElement('button');b.textContent=t(18+i);
      b.onclick=()=>{$('promotion').close();play(pending.find(m=>m.promotion===p));};
      return b;
    }));
    $('promotion').showModal();
  }else if(moves.length){play(moves[0]);}
  else{selected=selected!==square && game.get(square)?.color===player ? square : '';draw();}
};
$('start').onclick=()=>{if(!game.history().length || game.isGameOver() || confirm(t(23))) start();};
$('language').onclick=()=>{lang=lang==='fa'?'en':'fa';localStorage.setItem(key,lang);labels();};
labels();start();
