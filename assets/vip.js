"use strict";
$("getVipBtn").onclick = function(){ showPage("vip"); window.scrollTo(0,0); };

/* ===== VIP STYLE STUDIO (client-side preview, no paid access yet) ===== */
var vipBoardThemes = [
  {id:"default",name:"Classic",light:"#f0dfc6",dark:"#7a5745"},
  {id:"emerald",name:"Emerald",light:"#d9edcc",dark:"#34836c"},
  {id:"amethyst",name:"Amethyst",light:"#eae0fa",dark:"#77519f"},
  {id:"midnight",name:"Midnight",light:"#adc1d9",dark:"#243d60"},
  {id:"rose",name:"Rose Gold",light:"#f4dacb",dark:"#af6e78"},
  {id:"sapphire",name:"Sapphire",light:"#dce8ff",dark:"#3f5fa8"},
  {id:"bluepomegranate",name:"Blue & Pomegranate",light:"#123b80",dark:"#871b3b"},
  {id:"skylemon",name:"Sky Blue & Lemon",light:"#71cdf5",dark:"#f5e84b"},
  {id:"forest",name:"Forest",light:"#dce8d1",dark:"#4a6b3f"},
  {id:"lava",name:"Lava",light:"#f2d0c2",dark:"#8b3a2f"},
  {id:"ivory",name:"Ivory",light:"#f6f1e3",dark:"#8a7a63"},
  {id:"sunset",name:"Sunset",light:"#ffd9c8",dark:"#c96a4a"}
];
var vipPieceStyles = [
  {id:"classic",name:"Classic"},
  {id:"outline",name:"Outline"},
  {id:"dualclassic",name:"Royal Heritage"},
  {id:"rosevector",name:"Velvet Rose"},
  {id:"storybook",name:"Storybook 2D"}
];
var vipPieceColors = [
  {id:"standard",name:"Classic",white:"#fffdf7",black:"#20100d"},
  {id:"royal",name:"Royal Gold",white:"#fff0b2",black:"#9b6825"},
  {id:"neon",name:"Neon",white:"#d7ffff",black:"#421349"},
  {id:"obsidian",name:"Obsidian",white:"#e6eef5",black:"#172333"},
  {id:"silver",name:"Silver",white:"#f5f7fa",black:"#6e7b8a"},
  {id:"crimson",name:"Crimson",white:"#ffe7e7",black:"#7a1f2b"},
  {id:"bluepomegranate",name:"Blue & Pomegranate",white:"#123b80",black:"#871b3b"},
  {id:"skylemon",name:"Sky Blue & Lemon",white:"#71cdf5",black:"#f5e84b"},
  {id:"jade",name:"Jade",white:"#eafff2",black:"#1f6b57"},
  {id:"frost",name:"Frost",white:"#eefbff",black:"#4f6d7a"}
];
var vipSelectedBoard = "default", vipSelectedPiece = "classic",vipSelectedColor="standard";
function vipGetSaved(key,allowed,fallback){
  try {var val=localStorage.getItem(key);return allowed.some(function(a){return a.id===val;})?val:fallback;}catch(e){return fallback;}
}
function vipColors(colorId,white){
  var id=colorId||window.kfVipPieceColor||"standard";
  var palette={
    standard:{white:["#fffdf7","#2a1810"],black:["#20100d","#f0d8a8"]},
    royal:{white:["#fff0b2","#80531b"],black:["#9b6825","#f6d889"]},
    neon:{white:["#d7ffff","#20f5e2"],black:["#421349","#ff66da"]},
    obsidian:{white:["#e6eef5","#526779"],black:["#172333","#aec5d6"]},
    silver:{white:["#f5f7fa","#7d8794"],black:["#6e7b8a","#d8dee6"]},
    crimson:{white:["#ffe7e7","#9a4450"],black:["#7a1f2b","#f0b7bf"]},
    bluepomegranate:{white:["#123b80","#9fc6ff"],black:["#871b3b","#ffadc4"]},
    skylemon:{white:["#71cdf5","#165c8c"],black:["#f5e84b","#887700"]},
    jade:{white:["#eafff2","#4d8e73"],black:["#1f6b57","#b8ecd7"]},
    frost:{white:["#eefbff","#7aa2b5"],black:["#4f6d7a","#d7eef7"]}
  };
  return (palette[id]||palette.standard)[white?"white":"black"];
}
function vipApplyAppearance(board,piece,color){
  board=vipBoardThemes.some(function(t){return t.id===board;})?board:"default";
  piece=vipPieceStyles.some(function(t){return t.id===piece;})?piece:"classic";
  color=vipPieceColors.some(function(t){return t.id===color;})?color:"standard";
  vipBoardThemes.forEach(function(t){document.body.classList.remove("vip-board-"+t.id);});
  if(board!=="default")document.body.classList.add("vip-board-"+board);
  window.kfVipPieceStyle=piece;
  window.kfVipPieceColor=color;
  if(typeof _svgCache!=="undefined")_svgCache={};
  if(typeof game!=="undefined"&&game&&typeof draw==="function")draw();
}
function vipRenderStudio(){
  var boards=$("vipBoardChoices"),pieces=$("vipPieceChoices"),colors=$("vipColorChoices"),preview=$("vipPreviewBoard");
  if(!boards||!pieces||!colors||!preview)return;
  boards.innerHTML="";
  vipBoardThemes.forEach(function(t){
    var b=document.createElement("button");b.type="button";b.className="vip-choice"+(t.id===vipSelectedBoard?" selected":"");
    b.setAttribute("aria-pressed",String(t.id===vipSelectedBoard));
    b.innerHTML='<span class="vip-swatch" style="--swatch-light:'+t.light+';--swatch-dark:'+t.dark+'"></span><strong>'+t.name+'</strong>';
    b.onclick=function(){vipSelectedBoard=t.id;vipRenderStudio();};boards.appendChild(b);
  });
  pieces.innerHTML="";
  vipPieceStyles.forEach(function(t){
    var b=document.createElement("button");b.type="button";b.className="vip-choice"+(t.id===vipSelectedPiece?" selected":"");
    b.setAttribute("aria-pressed",String(t.id===vipSelectedPiece));
    b.innerHTML='<span class="vip-piece-sample">'+svg({color:"w",type:"n"},t.id,vipSelectedColor)+svg({color:"b",type:"k"},t.id,vipSelectedColor)+'</span><strong>'+t.name+'</strong>';
    b.onclick=function(){vipSelectedPiece=t.id;vipRenderStudio();};pieces.appendChild(b);
  });
  colors.innerHTML="";
  vipPieceColors.forEach(function(t){
    var b=document.createElement("button");b.type="button";b.className="vip-choice"+(t.id===vipSelectedColor?" selected":"");
    b.setAttribute("aria-pressed",String(t.id===vipSelectedColor));
    b.innerHTML='<span class="vip-piece-sample">'+svg({color:"w",type:"q"},vipSelectedPiece,t.id)+svg({color:"b",type:"q"},vipSelectedPiece,t.id)+'</span><strong>'+t.name+'</strong>';
    b.onclick=function(){vipSelectedColor=t.id;vipRenderStudio();};colors.appendChild(b);
  });
  var chosen=vipBoardThemes.find(function(t){return t.id===vipSelectedBoard;})||vipBoardThemes[0];
  preview.innerHTML="";
  var samples=["br","bn","bb","bq","bp",null,"wp","wk","wr","wn",null,"wp",null,"wb","wq","wr"];
  for(var i=0;i<16;i++){
    var cell=document.createElement("div");cell.className="vip-preview-square";
    cell.style.background=(((Math.floor(i/4)+i%4)%2)===0?chosen.light:chosen.dark);
    if(samples[i])cell.innerHTML=svg({color:samples[i][0],type:samples[i][1]},vipSelectedPiece,vipSelectedColor);
    preview.appendChild(cell);
  }
}
function vipInit(){
  vipSelectedBoard=vipGetSaved("kf_vip_board",vipBoardThemes,"default");
  var oldPiece="";
  try{oldPiece=localStorage.getItem("kf_vip_piece")||"";}catch(e){}
  vipSelectedPiece=vipPieceStyles.some(function(t){return t.id===oldPiece;})?oldPiece:"classic";
  var priorColor=(oldPiece==="royal"||oldPiece==="neon")?oldPiece:"standard";
  vipSelectedColor=vipGetSaved("kf_vip_piece_color",vipPieceColors,priorColor);
  vipApplyAppearance(vipSelectedBoard,vipSelectedPiece,vipSelectedColor);
  vipRenderStudio();
}

let leagueModule;
function loadLeagueModule(){
  if(leagueModule) return;
  leagueModule=document.createElement("script");
  leagueModule.src="assets/league.js?v=league-hours3";
  leagueModule.onerror=()=>{leagueModule.remove();leagueModule=null;};
  document.head.appendChild(leagueModule);
}
window.addEventListener("load",loadLeagueModule,{once:true});
if(document.readyState==="complete")loadLeagueModule();
function vipSelectSection(section){
  if(!["tournament","themes"].includes(section))section="themes";
  ["tournament","themes"].forEach(function(name){
    var tab=document.querySelector('[data-vip-section="'+name+'"]');
    var panel=document.getElementById("vipPanel"+name.charAt(0).toUpperCase()+name.slice(1));
    if(tab){tab.classList.toggle("active",name===section);tab.setAttribute("aria-selected",name===section?"true":"false");tab.tabIndex=name===section?0:-1;}
    if(panel)panel.hidden=name!==section;
  });
}
document.querySelectorAll("[data-vip-section]").forEach(function(tab){
  tab.addEventListener("click",function(){vipSelectSection(tab.dataset.vipSection);});
});
vipSelectSection("themes");

const leagueHomeButton = $("leagueBtn");
const leagueHomePanel = $("vipPanelLeague");
function setLeagueOpen(open){
  leagueHomePanel.hidden = !open;
  leagueHomeButton.setAttribute("aria-expanded", String(open));
}
leagueHomeButton.onclick = function(){
  loadLeagueModule();
  setLeagueOpen(leagueHomePanel.hidden);
};
const closeLeagueWhenAway = new MutationObserver(function(){
  if (!$("pageHome").classList.contains("active") || document.body.classList.contains("game-focus")) setLeagueOpen(false);
});
closeLeagueWhenAway.observe($("pageHome"), {attributes:true, attributeFilter:["class"]});
closeLeagueWhenAway.observe(document.body, {attributes:true, attributeFilter:["class"]});

$("vipBack").onclick=function(){showPage("home");};
$("vipApply").onclick=function(){
  vipApplyAppearance(vipSelectedBoard,vipSelectedPiece,vipSelectedColor);
  try{
    localStorage.setItem("kf_vip_board",vipSelectedBoard);
    localStorage.setItem("kf_vip_piece",vipSelectedPiece);
    localStorage.setItem("kf_vip_piece_color",vipSelectedColor);
  }catch(e){}
  toast("Your board, piece shape and colors have been updated.","info");
};
$("vipReset").onclick=function(){
  vipSelectedBoard="default";vipSelectedPiece="classic";vipSelectedColor="standard";
  vipApplyAppearance(vipSelectedBoard,vipSelectedPiece,vipSelectedColor);
  try{
    localStorage.removeItem("kf_vip_board");
    localStorage.removeItem("kf_vip_piece");
    localStorage.removeItem("kf_vip_piece_color");
  }catch(e){}
  vipRenderStudio();toast("Default style restored.","info");
};

