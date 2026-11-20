(() => {
  const panel = document.getElementById('vipPanelLeague');
  const message = document.createElement('p');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'vip-section-tab';
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
    if (Date.now() >= Date.parse(group.deadline)) return;
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
        const result=await sb.rpc('kf_league_save_windows',{windows});
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
  async function refresh(action = 'status') {
    const request = ++sequence;
    availability.replaceChildren();
    alerts.hidden = true;
    alertStatus.textContent = '';
    button.disabled = true;
    button.hidden = true;
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
          const deadline = new Date(reply.data.deadline);
          message.textContent = label('Registration closed. Availability deadline (local time): ', 'ثبت‌نام گروه بسته شد. مهلت ثبت ساعت آزاد به وقت محلی: ') + deadline.toLocaleString();
          renderWindows(reply.data);
          return;
        }
        const { joined, level, position } = reply.data;
        panel.dir = window.kfGetLanguage?.() === 'fa' ? 'rtl' : 'ltr';
        message.textContent = joined
          ? label('Level ' + level + ' · Your place on the waiting list: ' + position + '. The 24-hour clock has not started.', 'سطح ' + level + ' · جایگاهت در صف پیش‌ثبت‌نام: ' + position + '. هنوز مهلت ۲۴ ساعته شروع نشده.')
          : label('Pre-register for an 18-day league with ten players at your level.', 'پیش‌ثبت‌نام لیگ ۱۸ روزه با ده بازیکن هم‌سطح.');
        button.textContent = joined ? label('Leave waiting list', 'لغو پیش‌ثبت‌نام') : label('Pre-register', 'پیش‌ثبت‌نام');
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
  if (!panel.hidden) refresh();
  new MutationObserver(() => {
    if (!panel.hidden) refresh();
    else sequence++;
  }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  sb?.auth.onAuthStateChange((event) => {
    if (!panel.hidden && ['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) setTimeout(() => refresh(), 0);
  });
})();
