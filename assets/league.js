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
  const leagueHourLocale = () => window.kfGetLanguage?.() === 'fa' ? 'fa-IR' : 'en-GB';
  function renderMemberHours(cell, windows) {
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
    for (const range of windows) {
      const start = new Date(range.start), end = new Date(range.end);
      if(!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue;
      const chip = document.createElement('span');
      chip.className = 'kf-league-available-chip';
      chip.textContent = formatter.format(start) + ' – ' + (start.toDateString() === end.toDateString() ? clock.format(end) : formatter.format(end));
      wrap.append(chip);
    }
    cell.append(wrap);
  }
  let leagueBoardRefreshInFlight = false;
  async function syncLeagueMemberHours() {
    if(panel.hidden || document.hidden || leagueBoardRefreshInFlight) return;
    const rows = availability.querySelectorAll('tr[data-kf-league-player]');
    if (!rows.length) return;
    leagueBoardRefreshInFlight = true;
    const user = currentUser?.id;
    try {
      const result = await sb.rpc('kf_league_board');
      if (result.error || !result.data || currentUser?.id !== user || panel.hidden) return;
      const groups = result.data.availability_by_player || {};
      for (const row of rows) {
        if (!row.isConnected) continue;
        const timeCell = row.querySelector('.kf-league-availability');
        if(timeCell) renderMemberHours(timeCell,groups[row.dataset.kfLeaguePlayer]);
      }
    } catch (_) {
      // Keep the last rendered standings if connection is unavailable.
    } finally { leagueBoardRefreshInFlight = false; }
  }
  setInterval(syncLeagueMemberHours,30000);
  document.addEventListener('visibilitychange',() => {
    if(!document.hidden) syncLeagueMemberHours();
  });
  function renderWindows(group) {
    availability.replaceChildren();
    const heading = text => {
      const title = document.createElement('h3'); title.textContent = text; availability.append(title);
    };
    heading(label('Group standings','جدول گروه'));
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
        renderMemberHours(time,group.availability_by_player?.[row.player]);
      }
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
        const ownRow = availability.querySelectorAll('tr[data-kf-league-player]');
        for (const row of ownRow) {
          if (row.dataset.kfLeaguePlayer !== currentUser?.id) continue;
          const cell = row.querySelector('.kf-league-availability');
          if (cell) renderMemberHours(cell,windows);
        }
        syncLeagueMemberHours();
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
