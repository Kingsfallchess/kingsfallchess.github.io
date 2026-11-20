(() => {
  const panel = document.getElementById('vipPanelLeague');
  // Style the registration CTA even if an older index.html remains cached in Android WebView.
  // The same scoped style in index.html covers clients that cache the older league.js.
  if (!document.getElementById('kfLeagueCtaStyle')) {
    const leagueCtaStyle = document.createElement('style');
    leagueCtaStyle.id = 'kfLeagueCtaStyle';
    leagueCtaStyle.textContent = `/* Kingsfall league registration call-to-action — scoped to the league panel. */
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
`;
    document.head.appendChild(leagueCtaStyle);
  }
  const message = document.createElement('p');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'kf-league-cta';
  message.setAttribute('role', 'status');
  panel.replaceChildren(message, button);
  const alerts = document.createElement('a');
  const alertStatus = document.createElement('p');
  alertStatus.setAttribute('role', 'status');
  alerts.href = '/enable-league-push';
  alerts.hidden = true;
  alerts.onclick = () => {
    alertStatus.textContent = label('Waiting for Android…', 'در انتظار پاسخ اندروید…');
  };
  panel.append(alerts, alertStatus);
  window.addEventListener('message', async event => {
    if (event.source || typeof event.data !== 'string' || !event.data.startsWith('kf-league-token:')) return;
    const reply = await sb.rpc('kf_register_league_device', { device_token: event.data.slice('kf-league-token:'.length) });
    alertStatus.textContent = reply.error ? label('Try enabling alerts again.', 'فعال‌سازی اعلان را دوباره امتحان کن.')
      : label('Phone registered for league alerts.', 'گوشی برای اعلان لیگ ثبت شد.');
  });
  const availability = document.createElement('div');
  panel.append(availability);
  function renderWindows(group) {
    availability.replaceChildren();
    const heading = text => {
      const title = document.createElement('h3'); title.textContent = text; availability.append(title);
    };
    heading(label('Group standings','جدول گروه'));
    const table = document.createElement('table');
    for (const row of group.standings || []) {
      const tr = table.insertRow();
      for (const value of [row.place,row.name,row.points + label(' pts',' امتیاز'),group.finished ? label('Level ','سطح ')+row.next_level : '']) tr.insertCell().textContent=value;
    }
    availability.append(table);
    heading(label('Schedule','برنامهٔ بازی‌ها'));
    for (let day=1; day<=group.round; day++) {
      const games=group.matches.filter(m=>m.day===day);
      const section=document.createElement('details');
      section.open=day===group.round;
      const summary=document.createElement('summary');
      summary.textContent=label('Day ','روز ')+day; section.append(summary);
      if (!games.some(m=>[m.host,m.guest].includes(currentUser?.id))) {
        const p=document.createElement('p');p.textContent=label('No pairing for you · 0 points','برای این روز حریفی نداشتی · صفر امتیاز');section.append(p);
      }
      for (const m of games) {
        const line=document.createElement('p');
        const details = m.state==='won' ? label('Winner: ','برنده: ')+(m.winner===m.host?m.home_name:m.away_name)
          : ({scheduled:label('Scheduled','زمان‌بندی‌شده'),playing:label('Playing','در حال بازی'),draw:label('Draw','مساوی'),cancelled:label('Cancelled','لغوشده')})[m.state];
        line.textContent=m.home_name+' – '+m.away_name+' · '+new Date(m.starts).toLocaleString()+' · '+m.mode+' · '+details;
        section.append(line);
      }
      availability.append(section);
    }
    if (!group.can_edit) return;
    heading(label('Playing times (local time)','ساعت‌های آزاد به وقت محلی'));
    function chooser(caption, items, selected) {
      const field=document.createElement('label'); field.textContent=caption;
      const select=document.createElement('select');
      for (const item of items) select.add(new Option(item.name,item.id));
      if(items.some(item=>item.id===selected))select.value=selected;
      field.append(select); availability.append(field); return select;
    }
    const mode=chooser(label('When hosting · Game ','هنگام میزبانی · نوع بازی '),[{id:'classic',name:label('Classic 5+0','معمولی ۵+۰')},{id:'roulette',name:'Roulette'},{id:'bloodblade',name:'Blood Tributes'}],group.mode);
    const board=chooser(label('Board ','صفحه '),vipBoardThemes,group.style.board);
    const pieces=chooser(label('Pieces ','مهره‌ها '),vipPieceStyles,group.style.pieces);
    const color=chooser(label('Piece colors ','رنگ مهره '),vipPieceColors,group.style.color);
    const rows = document.createElement('div');
    const local = ms => {
      const date = new Date(ms);
      return new Date(ms - date.getTimezoneOffset()*60000).toISOString().slice(0,16);
    };
    const start = Math.ceil((Date.parse(group.deadline)+900000)/900000)*900000;
    const end = Date.parse(group.deadline)+86400000;
    const add = (a,b) => {
      const row = document.createElement('div');
      for (const [value,caption] of [[a,label('From','از')],[b,label('To','تا')]]) {
        const field = document.createElement('input');
        field.type = 'datetime-local'; field.value = local(value); field.min = local(start); field.max = local(end);
        const fieldLabel = document.createElement('label'); fieldLabel.append(caption,field); row.append(fieldLabel);
      }
      const remove = document.createElement('button'); remove.textContent=label('Remove','حذف');
      remove.onclick=()=>row.remove(); row.append(remove); rows.append(row);
    };
    group.windows.forEach(w=>add(Date.parse(w.start),Date.parse(w.end)));
    if (!group.windows.length) add(start,Math.min(start+3600000,end));
    const extra = document.createElement('button'); extra.textContent=label('Add time window','افزودن بازه');
    extra.onclick=()=>add(start,Math.min(start+3600000,end));
    const save = document.createElement('button'); save.textContent=label('Save playing times','ذخیره ساعت‌ها');
    const status = document.createElement('p'); status.setAttribute('role','status');
    save.onclick=async()=>{
      save.disabled=true;
      try {
        const windows=Array.from(rows.children,row=>{
          const [a,b] = Array.from(row.querySelectorAll('input'),f=>new Date(f.value).getTime());
          if (!Number.isFinite(a+b)||a<start||b>end||b-a<900000) throw Error();
          return {start:new Date(a).toISOString(),end:new Date(b).toISOString()};
        });
        const result=await sb.rpc('kf_league_choices',{cutoff:group.deadline,windows,mode:mode.value,style:{board:board.value,pieces:pieces.value,color:color.value}});
        if (result.error) throw Error();
        status.textContent=label('Playing times saved.','ساعت‌ها ذخیره شد.');
      } catch {status.textContent=label('Check your time windows and deadline.','بازه‌های زمانی و مهلت ثبت را بررسی کن.');}
      finally {save.disabled=false;}
    };
    availability.append(rows,extra,save,status);
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
  async function refresh(action = 'status') {
    const request = ++sequence;
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
        if(joined) monitorLeague();
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
    else sequence++;
  }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  sb?.auth.onAuthStateChange((event) => {
    if (!panel.hidden && ['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) setTimeout(() => refresh(), 0);
  });
})();
