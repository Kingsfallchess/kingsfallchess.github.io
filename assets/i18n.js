/* Kingsfall Android localization: UI-only, no chess rules / clock hooks. */
(function () {
  "use strict";
  if (!window.kfIsNativeApp) return;

  var STORAGE_KEY = "kf_android_ui_language_v1";
  var savedLanguage = "";
  try { savedLanguage = localStorage.getItem(STORAGE_KEY) || ""; } catch (ignore) {}
  var language = savedLanguage === "fa" ? "fa" : "en";

  var persian = {
    "Sign In": "ورود",
    "Sign in": "ورود",
    "Sign Up": "ثبت‌نام",
    "Sign Out": "خروج",
    "Exit Guest": "خروج از مهمان",
    "Guest": "مهمان",
    "Get VIP": "دریافت VIP",
    "WELCOME TO KINGSFALL": "به کینگزفال خوش آمدید",
    "Create your account": "ساخت حساب کاربری",
    "Create account": "ساخت حساب",
    "Create an account": "ساخت حساب",
    "Choose a username": "یک نام کاربری انتخاب کنید",
    "Show my country flag on my profile": "پرچم کشورم در پروفایل نمایش داده شود",
    "Choose your country": "کشور خود را انتخاب کنید",
    "Email address": "آدرس ایمیل",
    "Password": "رمز عبور",
    "New password": "رمز عبور جدید",
    "At least 6 characters": "حداقل ۶ کاراکتر",
    "New to Kingsfall?": "تازه به کینگزفال آمدید؟",
    "Already have an account?": "قبلاً حساب ساخته‌اید؟",
    "Forgot password?": "رمز عبور را فراموش کرده‌اید؟",
    "Choose a new password": "رمز عبور جدید انتخاب کنید",
    "Reset your password": "بازیابی رمز عبور",
    "Save new password": "ذخیره رمز جدید",
    "Email reset link": "ارسال لینک بازیابی",
    "Please wait…": "کمی صبر کنید…",
    "Signed in successfully.": "با موفقیت وارد شدید.",
    "Account created and signed in.": "حساب ساخته شد و وارد شدید.",
    "Account created. Check your email to confirm.": "حساب ساخته شد؛ ایمیلتان را برای تأیید بررسی کنید.",
    "Signing in or creating a new account will replace this guest profile. Guest results may not transfer.": "با ورود یا ثبت‌نام، حساب مهمان جایگزین می‌شود و ممکن است نتایج آن منتقل نشود.",
    "YOUR KINGSFALL ID": "حساب کینگزفال شما",
    "Username / Profile": "نام کاربری / پروفایل",
    "Profile photo": "عکس پروفایل",
    "Choose a JPG, PNG or WebP image up to 5 MB.": "تصویری با فرمت JPG، PNG یا WebP تا حجم ۵ مگابایت انتخاب کنید.",
    "Upload photo": "بارگذاری عکس",
    "Username": "نام کاربری",
    "Use 3–20 letters, numbers, spaces, underscores or hyphens.": "از ۳ تا ۲۰ حرف، عدد، فاصله، زیرخط یا خط تیره استفاده کنید.",
    "Save profile": "ذخیره پروفایل",
    "Saving…": "در حال ذخیره…",
    "Profile saved successfully.": "پروفایل با موفقیت ذخیره شد.",
    "QUICK PLAY": "بازی سریع",
    "5-minute game · Match by wins": "بازی ۵ دقیقه‌ای · حریف‌یابی بر اساس تعداد برد",
    "KNOCKOUT TOURNAMENT": "تورنمنت حذفی",
    "Tap to join the next knockout cup": "برای شرکت در تورنمنت بعدی لمس کنید",
    "Tap to register": "برای ثبت‌نام لمس کنید",
    "Registered · Tap to view": "ثبت‌نام شده · برای مشاهده لمس کنید",
    "Preparing tournament bracket...": "در حال آماده‌سازی جدول تورنمنت…",
    "View bracket · champion crowned": "دیدن جدول · قهرمان مشخص شد",
    "ROULETTE": "رولت",
    "Random opening · variable-length line auto-played": "شروع تصادفی · حرکات آغازین خودکار",
    "NEW": "جدید",
    "BLOODBLADE": "خراج خون",
    "Blood Tributes · mandatory sacrifice": "خراج خون · قربانی اجباری",
    "PLAY VS COMPUTER": "بازی با کامپیوتر",
    "Powered by Stockfish · Practice anytime": "با موتور استاک‌فیش · تمرین در هر زمان",
    "♔ Play as White": "♔ بازی با سفید",
    "♚ Play as Black": "♚ بازی با سیاه",
    "Computer strength": "قدرت کامپیوتر",
    "800 · Beginner": "۸۰۰ · مبتدی",
    "1400 · Club": "۱۴۰۰ · باشگاهی",
    "2000 · Expert": "۲۰۰۰ · حرفه‌ای",
    "CHAMPION OF THE DAY": "قهرمان روز",
    "Waiting for opponent": "در انتظار حریف",
    "White pieces": "مهره‌های سفید",
    "Black pieces": "مهره‌های سیاه",
    "KINGSFALL · 5 MIN": "کینگزفال · ۵ دقیقه",
    "Tap a piece, then a square": "یک مهره و سپس خانه مقصد را لمس کنید",
    "First Move Deadline": "مهلت حرکت اول",
    "Game console": "پنل بازی",
    "White to move": "نوبت سفید",
    "Black to move": "نوبت سیاه",
    "New Game": "بازی جدید",
    "Flip Board": "چرخاندن صفحه",
    "Undo Move": "برگرداندن حرکت",
    "Copy Position": "کپی موقعیت",
    "Analyze Game": "تحلیل بازی",
    "Move history": "تاریخچه حرکات",
    "No moves yet.": "هنوز حرکتی انجام نشده است.",
    "Quick Play pairs you with the available player closest to your number of wins.": "در بازی سریع، نزدیک‌ترین بازیکن آنلاین از نظر تعداد برد حریف شما می‌شود.",
    "📜 RECENT GAMES": "📜 بازی‌های اخیر",
    "Your last 10 finished games": "۱۰ بازی پایان‌یافته اخیر شما",
    "KINGSFALL HONORS": "افتخارات کینگزفال",
    "🏅 Kingsfall Honors": "🏅 افتخارات کینگزفال",
    "50 most recent tournament champions": "۵۰ قهرمان اخیر تورنمنت‌ها",
    "🏆 Kingsfall Leaderboard": "🏆 جدول رده‌بندی کینگزفال",
    "Overall = Crowns + BT + (Tournament wins × 20)": "امتیاز کل = تاج‌ها + خراج خون + (برد تورنمنت × ۲۰)",
    "Player": "بازیکن",
    "Players": "بازیکنان",
    "Overall": "امتیاز کل",
    "Crowns": "تاج‌ها",
    "Tournament wins": "برد تورنمنت",
    "Humiliation": "تحقیر",
    "Blood Tributes": "خراج خون",
    "🔄 Refresh": "🔄 به‌روزرسانی",
    "↻ Refresh": "↻ به‌روزرسانی",
    "Registration": "ثبت‌نام",
    "Register": "ثبت‌نام",
    "Registered Players": "بازیکنان ثبت‌نام‌شده",
    "Next Tournament": "تورنمنت بعدی",
    "Last Tournament": "تورنمنت قبلی",
    "KNOCKOUT CUP": "جام حذفی",
    "Starts in": "شروع تا",
    "Registration open": "ثبت‌نام باز است",
    "Cancel": "لغو",
    "LIVE": "زنده",
    "DONE": "پایان‌یافته",
    "GAME REVIEW": "مرور بازی",
    "Analysis": "تحلیل",
    "HUMILIATION": "تحقیر",
    "Sacrifice a Piece": "قربانی کردن مهره",
    "Give up one of your own pieces before the first move.": "قبل از اولین حرکت، یکی از مهره‌های خود را قربانی کنید.",
    "If you win, you earn bonus wins. If you lose, nothing changes.": "اگر ببرید، برد اضافه می‌گیرید؛ در صورت باخت، امتیازی کسر نمی‌شود.",
    "Knight": "اسب",
    "Bishop": "فیل",
    "Rook": "رخ",
    "Queen": "وزیر",
    "Sacrifice": "قربانی",
    "SACRIFICE": "قربانی",
    "Draw Offer?": "پیشنهاد مساوی؟",
    "Decline": "رد",
    "Accept": "پذیرش",
    "CONFIRM": "تأیید",
    "Offer a draw?": "پیشنهاد مساوی می‌دهید؟",
    "Your opponent will receive a draw offer. They can accept or decline.": "حریف می‌تواند پیشنهاد مساوی را بپذیرد یا رد کند.",
    "Offer Draw": "پیشنهاد مساوی",
    "REMATCH REQUEST": "درخواست بازی مجدد",
    "Opponent wants a rematch": "حریف درخواست بازی مجدد دارد",
    "colors swapped": "با تعویض رنگ‌ها",
    ". Do you accept?": "؛ قبول می‌کنید؟",
    "Accept Rematch": "پذیرش بازی مجدد",
    "Resign this game?": "از بازی انصراف می‌دهید؟",
    "Your opponent will be declared the winner. This cannot be undone.": "حریف برنده اعلام می‌شود و این کار قابل بازگشت نیست.",
    "Resign": "تسلیم",
    "PLAYER REPORT": "گزارش بازیکن",
    "Report opponent": "گزارش حریف",
    "Choose a reason. This report goes to the admin; it does not automatically penalize your opponent.": "دلیل گزارش را انتخاب کنید. گزارش برای مدیر ارسال می‌شود و مجازات خودکار ندارد.",
    "Illegal move": "حرکت غیرقانونی",
    "Using Stockfish": "استفاده از استاک‌فیش",
    "Clock manipulation": "دستکاری ساعت",
    "Submit Report": "ارسال گزارش",
    "WHITE": "سفید",
    "BLACK": "سیاه",
    "LINE": "حرکات",
    "Opponent": "حریف",
    "Draw": "مساوی",
    "Report": "گزارش",
    "You": "شما",
    "WINS": "برد",
    "HUMILIATION VICTORY": "پیروزی تحقیرآمیز",
    "🔄 Rematch": "🔄 بازی مجدد",
    "Analyze": "تحلیل",
    "Exit": "خروج",
    "KINGSFALL CHAT": "چت کینگزفال",
    "Global lobby · Everyone together": "گفت‌وگوی عمومی بازیکنان",
    "Welcome to the Kingsfall lobby.": "به گفت‌وگوی عمومی کینگزفال خوش آمدید.",
    "Send": "ارسال",
    "Sign in to send messages.": "برای ارسال پیام وارد شوید.",
    "Sign in": "ورود",
    "← Back": "← بازگشت"
  };

  var originals = new WeakMap();
  function translateValue(text) {
    if (Object.prototype.hasOwnProperty.call(persian, text)) return persian[text];
    if (/^⇅ Sort: .+ ▾$/.test(text)) {
      var key = text.slice(8, -2).trim();
      return "⇅ مرتب‌سازی: " + (persian[key] || key) + " ▾";
    }
    return null;
  }
  function translateTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    var value = node.nodeValue;
    var original = originals.get(node);
    if (original === undefined || (value !== original &&
        value !== translateStored(original))) {
      original = value;
      originals.set(node, original);
    }
    var desired = language === "fa" ? translateStored(original) : original;
    if (value !== desired) node.nodeValue = desired;
  }
  function translateStored(raw) {
    var trimmed = raw.trim();
    var translated = translateValue(trimmed);
    if (translated === null) return raw;
    var start = raw.match(/^\s*/)[0];
    var end = raw.match(/\s*$/)[0];
    return start + translated + end;
  }
  function visit(root) {
    if (!root) return;
    if (root.nodeType === 3) { translateTextNode(root); return; }
    if (root.nodeType !== 1) return;
    if (root.matches && root.matches("script,style,textarea,svg,canvas,#board,.square,.move-list,#kfChatMessages")) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) {
      var node = walker.currentNode;
      var parent = node.parentElement;
      if (!parent || parent.closest("script,style,textarea,svg,canvas,#board,.square,#kfChatMessages")) continue;
      nodes.push(node);
    }
    nodes.forEach(translateTextNode);
  }
  function applyUi() {
    document.documentElement.classList.toggle("kf-fa", language === "fa");
    document.documentElement.lang = language === "fa" ? "fa" : "en";
    ["header.topnav","#pageHome","#pageTable","#pageHonors","#pageVip",
      "#authDialog","#profileDialog","#tournDialog","#promotionDialog",
      "#drawDialog","#reportDialog","#humilDialog","#kfChatPage"].forEach(function(selector) {
        visit(document.querySelector(selector));
      });
    var authSelect = document.getElementById("kfAuthLanguage");
    var profileSelect = document.getElementById("kfProfileLanguage");
    [authSelect, profileSelect].forEach(function(select) {
      if (!select) return;
      select.value = language;
      Array.prototype.forEach.call(select.options, function(option) {
        option.defaultSelected = option.value === language;
      });
    });
  }
  function changeLanguage(next, saveToAccount) {
    if (next !== "fa" && next !== "en") return;
    language = next;
    try { localStorage.setItem(STORAGE_KEY, language); } catch (ignore) {}
    applyUi();
    if (saveToAccount && typeof sb !== "undefined" && sb && typeof currentUser !== "undefined" &&
        currentUser && !currentUser.is_anonymous) {
      // Profile language changes persist for this account without affecting live games.
      sb.auth.updateUser({data: {ui_language: language}}).catch(function(error) {
        console.warn("Could not sync Kingsfall UI language:", error);
      });
    }
  }
  function adoptAccountLanguage(user) {
    if (!user || !user.user_metadata) return;
    var stored = "";
    try { stored = localStorage.getItem(STORAGE_KEY) || ""; } catch (ignore) {}
    if (stored) return;
    if (user.user_metadata.ui_language === "fa" || user.user_metadata.ui_language === "en") {
      language = user.user_metadata.ui_language;
      applyUi();
    }
  }
  window.kfGetLanguage = function () { return language; };
  window.kfSetLanguage = changeLanguage;
  window.kfAdoptAccountLanguage = adoptAccountLanguage;
  window.kfTranslateUi = applyUi;

  var authSelect = document.getElementById("kfAuthLanguage");
  var profileSelect = document.getElementById("kfProfileLanguage");
  if (authSelect) authSelect.addEventListener("change", function () {
    changeLanguage(this.value, false);
  });
  if (profileSelect) profileSelect.addEventListener("change", function () {
    changeLanguage(this.value, true);
  });
  if (typeof currentUser !== "undefined") adoptAccountLanguage(currentUser);
  applyUi();

  // Observe only low-frequency interface labels, never the realtime board or clock.
  var watched = ["#authDialog","#profileDialog","#tournBtnSub","#quickState",
    "#rouletteSub","#tournDialog","#pageTable .lb-head","#pageHonors .honors-head"];
  var observer = new MutationObserver(function (changes) {
    if (language !== "fa") return;
    changes.forEach(function (change) {
      if (change.type === "characterData") translateTextNode(change.target);
      if (change.type === "childList") {
        Array.prototype.forEach.call(change.addedNodes, visit);
      }
    });
  });
  watched.forEach(function (selector) {
    var item = document.querySelector(selector);
    if (item) observer.observe(item, {childList:true,characterData:true,subtree:true});
  });
})();
