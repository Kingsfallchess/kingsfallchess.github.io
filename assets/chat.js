"use strict";
/* Kingsfall Lobby Chat: lazy-loaded, independent of game clocks and premoves. */
(function(){
  var button=document.getElementById("kfChatLauncher");
  var page=document.getElementById("kfChatPage");
  var messages=document.getElementById("kfChatMessages");
  var form=document.getElementById("kfChatForm");
  var input=document.getElementById("kfChatInput");
  var send=document.getElementById("kfChatSend");
  var note=document.getElementById("kfChatNotice");
  var hint=document.getElementById("kfChatHint");
  var channel=null,open=false,loading=false,sending=false,live=false,revision=0;
  var rows=new Map();
  var adminId="cc80cc38-f476-4edd-8efc-45e2722f3c4f";
  if(!button||!page||!messages||!form||!window.sb)return;

  function viewer(){return typeof currentUser!=="undefined" && currentUser?currentUser:null;}
  function status(message,error){
    note.textContent=message||"";
    note.classList.toggle("error",!!error);
  }
  function updateComposer(){
    var logged=!!viewer();
    input.disabled=!logged;
    send.disabled=!logged||sending||!input.value.trim();
    input.placeholder=logged?"Message to everyone…":"Sign in to chat";
    hint.textContent=logged?"Public lobby · max 280 characters":"Sign in to send messages. Everyone can read.";
  }
  function disconnect(){
    if(channel&&window.sb)sb.removeChannel(channel);
    channel=null;live=false;
  }
  function clock(ts){
    var d=new Date(ts);
    return Number.isNaN(d.getTime())?"":d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
  }
  function bubble(item){
    var mine=viewer()&&viewer().id===item.user_id;
    var box=document.createElement("article");
    box.className="kf-chat-message"+(mine?" mine":"");
    box.dataset.chatId=String(item.id);
    var heading=document.createElement("div");heading.className="kf-chat-meta";
    var username=document.createElement("strong");username.textContent=String(item.author_name||"Player");
    heading.appendChild(username);
    if(item.user_id===adminId){
      var crown=document.createElement("span");crown.className="kf-chat-admin";crown.textContent="ADMIN";heading.appendChild(crown);
    }
    var time=document.createElement("time");
    time.textContent=clock(item.created_at);
    if(item.created_at)time.dateTime=item.created_at;
    heading.appendChild(time);
    if(viewer()&&viewer().id===adminId){
      var remove=document.createElement("button");remove.type="button";remove.className="kf-chat-remove";
      remove.title="Delete message";remove.setAttribute("aria-label","Delete message");remove.textContent="×";
      remove.dataset.deleteChat=String(item.id);heading.appendChild(remove);
    }
    var body=document.createElement("div");body.className="kf-chat-text";body.textContent=item.body;
    box.appendChild(heading);box.appendChild(body);
    return box;
  }
  function render(){
    var nearBottom=(messages.scrollHeight-messages.scrollTop-messages.clientHeight)<95;
    var items=[...rows.values()].sort(function(a,b){return Number(a.id)-Number(b.id);});
    var fragment=document.createDocumentFragment();
    items.forEach(function(item){fragment.appendChild(bubble(item));});
    messages.replaceChildren(fragment);
    if(nearBottom||!messages.dataset.viewed){
      messages.scrollTop=messages.scrollHeight;
      messages.dataset.viewed="1";
    }
  }
  async function load(){
    if(!open||loading||!sb)return;
    var currentRevision=revision;
    loading=true;
    status("Loading messages…");
    try{
      var result=await sb.from("kf_chat_messages")
        .select("id,user_id,author_name,body,created_at")
        .order("id",{ascending:false}).limit(60);
      if(!open||currentRevision!==revision)return;
      if(result.error)throw result.error;
      var fresh=new Map();
      (result.data||[]).forEach(function(item){fresh.set(String(item.id),item);});
      // Keep realtime messages newer than the fetched snapshot.
      rows.forEach(function(item,id){
        if(!fresh.has(id)&&result.data&&result.data.length&&Number(item.id)>Number(result.data[0].id))
          fresh.set(id,item);
      });
      rows=fresh;
      render();
      status("");
    }catch(err){
      if(open&&currentRevision===revision)status("Could not load chat. Tap Refresh.",true);
      console.warn("Kingsfall chat load failed:",err);
    }finally{loading=false;}
  }
  function connect(){
    if(!sb||!open||channel)return;
    channel=sb.channel("kf-public-lobby-"+Date.now())
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"kf_chat_messages"},function(event){
        if(!open||!event.new)return;
        rows.set(String(event.new.id),event.new);
        if(rows.size>80){
          var ids=[...rows.keys()].sort(function(a,b){return Number(b)-Number(a);});
          ids.slice(80).forEach(function(id){rows.delete(id);});
        }
        render();
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"kf_chat_messages"},function(event){
        if(!open)return;
        if(event.old&&event.old.id!=null)rows.delete(String(event.old.id));
        render();
      });
    var thisChannel=channel;
    thisChannel.subscribe(function(value){
      if(channel!==thisChannel||!open)return;
      live=value==="SUBSCRIBED";
      if(value==="CHANNEL_ERROR"||value==="TIMED_OUT"||value==="CLOSED")
        status("Live updates paused. Refresh to check messages.",true);
      else if(live)status("");
    });
  }
  function show(){
    open=true;revision++;
    page.hidden=false;
    button.setAttribute("aria-expanded","true");
    document.body.classList.add("kf-chat-open");
    messages.dataset.viewed="";
    updateComposer();
    load();
    connect();
  }
  function hide(){
    open=false;revision++;
    page.hidden=true;
    button.setAttribute("aria-expanded","false");
    document.body.classList.remove("kf-chat-open");
    disconnect();
    status("");
  }
  button.addEventListener("click",function(){if(open)hide();else show();});
  document.getElementById("kfChatClose").addEventListener("click",hide);
  document.getElementById("kfChatRefresh").addEventListener("click",function(){load();});
  page.addEventListener("click",function(e){if(e.target===page)hide();});
  page.addEventListener("touchstart",function(e){e.stopPropagation();},{passive:true});
  page.addEventListener("touchend",function(e){e.stopPropagation();},{passive:true});
  document.addEventListener("keydown",function(e){if(open&&e.key==="Escape")hide();});
  document.getElementById("kfChatSignIn").addEventListener("click",function(){
    if(typeof openAuth==="function")openAuth("signin");
  });
  input.addEventListener("input",updateComposer);
  input.addEventListener("keydown",function(e){
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();form.requestSubmit();}
  });
  messages.addEventListener("click",async function(e){
    var target=e.target.closest("[data-delete-chat]");
    if(!target||!viewer()||viewer().id!==adminId)return;
    var id=target.dataset.deleteChat;
    target.disabled=true;
    try{
      var res=await sb.from("kf_chat_messages").delete().eq("id",id);
      if(res.error)throw res.error;
      rows.delete(String(id));render();
    }catch(err){status("Could not delete message.",true);target.disabled=false;}
  });
  form.addEventListener("submit",async function(e){
    e.preventDefault();
    if(sending)return;
    var user=viewer();
    if(!user){if(typeof openAuth==="function")openAuth("signin");return;}
    var body=input.value.trim();
    if(!body||body.length>280)return;
    sending=true;updateComposer();status("");
    try{
      var result=await sb.from("kf_chat_messages").insert({user_id:user.id,body:body});
      if(result.error)throw result.error;
      input.value="";updateComposer();
      if(!live)await load();
    }catch(err){
      var message=String(err&&err.message||"");
      if(/2 seconds/i.test(message))status("Please wait 2 seconds between messages.",true);
      else status("Message not sent. Please try again.",true);
      console.warn("Kingsfall chat send failed:",err);
    }finally{sending=false;updateComposer();}
  });
  document.addEventListener("visibilitychange",function(){
    if(!open)return;
    if(document.hidden){disconnect();}
    else{load();connect();}
  });
  // Chat remains dormant until opened; never subscribes or polls during a game.
})();