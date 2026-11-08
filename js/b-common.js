/* EYEQ B안 — 공통 스크립트 (모든 페이지)
   - 상태 저장소: 선택 캐릭터·누적 XP(localStorage), 진행 중 게임·결과(sessionStorage)
   - 헤더 캐릭터 정보(Character Selected) · 모바일 메뉴 · 연결 대상 없는 버튼 차단 · 팝업
   서버 저장·계정 기능 없음 (기획에 없음)
*/
(function (w, d) {
  "use strict";

  var CHARS = ["FOCUS", "EYE", "SPARK"];
  var KEY = {
    character: "eyeq.b.character",   // 메인에서 선택한 캐릭터 (기존 키 유지)
    xp: "eyeq.b.xp",                 // 누적 XP (헤더 LV/XP)
    stage: "eyeq.b.stage",           // STAGE SELECT 에서 선택한 스테이지
    run: "eyeq.b.run",               // 진행 중인 게임 (탭 단위)
    result: "eyeq.b.result",         // 마지막 STAGE CLEAR 결과 (탭 단위)
    cleared: "eyeq.b.cleared",       // 클리어한 스테이지 id 목록 (전체 완료 표시용)
    history: "eyeq.b.history",       // 완료한 게임 기록 [{id, stage, at, correct, total, xp, maxCombo}] (마이페이지)
    badges: "eyeq.b.badges",         // 획득한 업적 {id: 획득 시각} (한 번 얻으면 유지)
    nickname: "eyeq.b.nickname",     // 마이페이지 닉네임 (브라우저 저장)
    next: "eyeq.b.next",             // 프로필 설정 후 이어갈 곳 ("quick" = QUICK PLAY) · 탭 단위
    race: "eyeq.b.race",             // 온라인 레이스 진행 (서버 값의 표시용 사본 · 서버가 기준)
    legacy: "eyeq.b.legacy",         // 레이스 이전 로컬 XP 보관본 {xp, savedAt} (삭제·변경 안 함)
    auth: "eyeq.b.auth",             // 익명 로그인 세션 (b-online.js)
    totals: "eyeq.b.totals"          // 개인 누적 통계 {plays, correct, total, solveMs, quick} (기록 200판 정리와 무관하게 계속 누적)
  };
  /* LEVEL RACE 레벨 규칙 (확정 · LV.10): 누적 XP 기준 · 모든 사용자 동일
     필요 XP 200 → 250 → 300 → 340 → 380 → 420 → 460 → 500 → 550 (점진 증가) → LV.10 = 3,400 XP
     서버 eyeq_level_for() 기준표와 같은 값 (lv10.sql) — 한쪽만 바꾸지 말 것 */
  var LEVELS = [0, 200, 450, 750, 1090, 1470, 1890, 2350, 2850, 3400];
  var MAX_LEVEL = LEVELS.length;               // 10
  var XP_MAX_TOTAL = LEVELS[MAX_LEVEL - 1];    // 3,400

  var memory = {};
  function store(kind) {
    try {
      var s = kind === "session" ? w.sessionStorage : w.localStorage;
      var t = "__eyeq_t";
      s.setItem(t, "1"); s.removeItem(t);
      return s;
    } catch (e) { return null; }
  }
  function get(kind, key) {
    var s = store(kind);
    try { return s ? s.getItem(key) : (key in memory ? memory[key] : null); } catch (e) { return null; }
  }
  function set(kind, key, value) {
    var s = store(kind);
    try { if (s) s.setItem(key, value); else memory[key] = value; } catch (e) { memory[key] = value; }
  }
  function remove(kind, key) {
    var s = store(kind);
    try { if (s) s.removeItem(key); } catch (e) { /* noop */ }
    delete memory[key];
  }
  function getJSON(kind, key) {
    var raw = get(kind, key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function setJSON(kind, key, value) { set(kind, key, JSON.stringify(value)); }

  function getCharacter() {
    var v = get("local", KEY.character);
    return CHARS.indexOf(v) > -1 ? v : "EYE";
  }
  /* 캐릭터 확정(메인 CTA). 캐릭터는 프로필 외형 → 바꿔도 XP·레벨·기록·업적·닉네임은 그대로 */
  function setCharacter(v) {
    if (CHARS.indexOf(v) < 0) return;
    set("local", KEY.character, v);
    profileChanged();
  }
  /* 닉네임·캐릭터가 바뀌면 온라인 프로필 동기화 (b-online.js가 받음) */
  function profileChanged() {
    try { w.dispatchEvent(new CustomEvent("eyeq:profile")); } catch (e) { /* 이전 브라우저 */ }
  }
  function hasCharacter() { return CHARS.indexOf(get("local", KEY.character)) > -1; }

  /* ---------- 닉네임 (메인 최초 설정 · 마이페이지 · 랭킹 공통) ---------- */
  var NAME_MAX = 12, DEFAULT_NAME = "EYEQPlayer";
  function cleanName(v) { return String(v == null ? "" : v).trim().slice(0, NAME_MAX); }
  function getNickname() { return cleanName(get("local", KEY.nickname)) || null; }     // 저장값 없으면 null
  function displayName() { return getNickname() || DEFAULT_NAME; }
  function setNickname(v) {                                                            // 빈 값이면 저장 안 함 → null
    var n = cleanName(v);
    if (!n) return null;
    set("local", KEY.nickname, n);
    profileChanged();
    return n;
  }

  /* ---------- 플레이 기록 (완료한 게임만 · 플레이 ID로 중복 저장 방지) ---------- */
  var HISTORY_MAX = 200;              // 오래된 기록부터 정리 (저장 공간 보호)
  function getHistory() {
    var h = getJSON("local", KEY.history);
    if (!Array.isArray(h)) return [];
    return h.filter(function (r) { return r && r.id && r.stage && typeof r.correct === "number" && typeof r.total === "number"; });
  }
  /* 성적순: 정답률 → 최고 콤보 → (플레이 소요 시간은 저장하지 않음) 최근 플레이 */
  function rate(r) { return r.total ? r.correct / r.total : 0; }
  function compareRecords(a, b) {
    return (rate(b) - rate(a)) || ((b.maxCombo || 0) - (a.maxCombo || 0)) || (b.at - a.at);
  }
  function beats(a, b) { return rate(a) > rate(b) || (rate(a) === rate(b) && (a.maxCombo || 0) > (b.maxCombo || 0)); }
  /* 스테이지별 최고 기록 { stageId: record } */
  function bestByStage(h) {
    var best = {};
    (h || getHistory()).forEach(function (r) {
      if (!best[r.stage] || compareRecords(r, best[r.stage]) < 0) best[r.stage] = r;
    });
    return best;
  }
  function addPlay(rec) {
    var h = getHistory();
    for (var i = 0; i < h.length; i++) if (h[i].id === rec.id) return false;
    /* NEW BEST: 같은 스테이지의 이전 최고 기록보다 좋을 때만 (이전 기록이 있어야 함 · 저장 시점에 1번 판정) */
    var prev = bestByStage(h)[rec.stage];
    rec.newBest = !!(prev && beats(rec, prev));
    var T = getTotals(h);                         // 기존 기록 기준으로 먼저 준비 (처음 1회)
    h.push(rec);
    if (h.length > HISTORY_MAX) h = h.slice(h.length - HISTORY_MAX);
    setJSON("local", KEY.history, h);
    T.plays += 1; T.correct += rec.correct || 0; T.total += rec.total || 0;
    T.solveMs += rec.solveMs || 0; if (rec.mode === "quick") T.quick += 1;
    setJSON("local", KEY.totals, T);
    return true;
  }
  /* 개인 누적 통계 (공식 레이스와 별개 · 이 브라우저 기록) — 없으면 현재 기록에서 만듦 */
  function getTotals(h) {
    var T = getJSON("local", KEY.totals);
    if (T && typeof T.plays === "number") return T;
    T = { plays: 0, correct: 0, total: 0, solveMs: 0, quick: 0 };
    (h || getHistory()).forEach(function (r) {
      T.plays += 1; T.correct += r.correct || 0; T.total += r.total || 0; T.solveMs += r.solveMs || 0; if (r.mode === "quick") T.quick += 1;
    });
    return T;
  }

  /* ---------- XP (A안: 헤더·마이페이지·랭킹 = 온라인 레이스 XP) ----------
     레이스 XP는 서버만 지급 → 브라우저에는 서버 값 사본(eyeq.b.race)만 있음. 여기서 XP를 더하지 않음
     레이스 이전 로컬 XP(eyeq.b.xp)는 지우거나 바꾸지 않고 '이전 기록'으로 보관 */
  function getRace() {
    var r = getJSON("local", KEY.race);
    return r && typeof r.xp === "number" ? r : null;
  }
  function setRace(r) {
    if (!r || typeof r.xp !== "number") return;
    r.savedAt = Date.now();
    setJSON("local", KEY.race, r);
    renderHeader();
  }
  function getXp() {
    var r = getRace();
    return r ? Math.max(0, Math.min(r.xp, XP_MAX_TOTAL)) : 0;
  }
  function addXp() { return getXp(); }           // 이전 호출 호환용: 레이스 XP는 서버에서만 바뀜
  function getLegacyXp() {
    var a = getJSON("local", KEY.legacy);
    if (a && typeof a.xp === "number") return a.xp;
    var n = parseInt(get("local", KEY.xp), 10);
    return isNaN(n) || n < 0 ? 0 : n;
  }
  /* 처음 한 번: 이전 로컬 XP를 보관본으로 복사 (원래 값도 그대로 둠) */
  (function archiveLegacy() {
    if (getJSON("local", KEY.legacy)) return;
    var raw = get("local", KEY.xp);
    if (raw === null) return;
    var n = parseInt(raw, 10);
    setJSON("local", KEY.legacy, { xp: isNaN(n) || n < 0 ? 0 : n, savedAt: Date.now() });
  })();
  /* 누적 XP → { level, xp(현재 레벨 안), need(이번 레벨 필요 XP), max(LV.10), toMax(LV.10까지 남은 XP) } */
  function levelInfo(total) {
    total = Math.max(0, total || 0);
    var level = 1;
    while (level < MAX_LEVEL && total >= LEVELS[level]) level++;
    var isMax = level >= MAX_LEVEL;
    var need = isMax ? 0 : LEVELS[level] - LEVELS[level - 1];
    return { level: level, xp: isMax ? 0 : total - LEVELS[level - 1], need: need, max: isMax, toMax: Math.max(0, XP_MAX_TOTAL - total), total: total };
  }
  /* 이전 기록(레이스 이전) 레벨: 예전 규칙 그대로 100 XP마다 1 · 최대 LV.05 */
  function legacyLevelInfo(total) {
    var level = Math.min(5, Math.floor(Math.max(0, total) / 100) + 1);
    return { level: level, xp: level >= 5 ? 100 : total - (level - 1) * 100, need: 100, max: level >= 5 };
  }
  function two(n) { return (n < 10 ? "0" : "") + n; }

  function charImg(ch, mood) { return "assets/b/char-" + ch.toLowerCase() + (mood === "happy" || mood === "sad" ? "-" + mood : "") + ".png"; }   // mood: 맞힘 happy / 틀림·시간 초과 sad / 없으면 기본

  /* ---------- 헤더(+ 게임 화면 레벨 카드): 선택 캐릭터 · LV · XP ---------- */
  function renderHeader() {
    Array.prototype.forEach.call(d.querySelectorAll("[data-charinfo]"), renderCharInfo);
  }
  function renderCharInfo(info) {
    var ch = getCharacter();
    var L = levelInfo(getXp());
    var lvText = "LV. " + two(L.level);
    var xpText = L.max ? "XP MAX" : "XP " + L.xp + " / " + L.need;
    var img = info.querySelector("[data-char-img]");
    if (img && img.getAttribute("src") !== charImg(ch)) img.setAttribute("src", charImg(ch));
    var lv = info.querySelector("[data-lv-text]");
    if (lv) lv.textContent = lvText;
    var text = info.querySelector("[data-xp-text]");
    if (text) text.textContent = xpText;
    info.style.setProperty("--xp-ratio", L.max ? 1 : L.xp / L.need);
    info.classList.toggle("is-max", L.max);
    info.setAttribute("aria-label", ch + " · " + lvText + " · " + xpText);
  }

  /* ---------- Coming Soon 팝업 (391:10540) ----------
     시안이 없는 메뉴·버튼(Ranking · About · 알림 · 프로필)을 누르면 열림.
     팝업 마크업이 없는 페이지에는 같은 구조를 넣어 줌 (STAGE 화면은 원래 마크업 사용) */
  var SOON_DEFAULT = ["이 기능은 지금 열심히 준비하고 있어요.", "조금만 기다려 주세요!"];   // 공통 문구 · 제안
  var soonModal = null;
  function soonEl() {
    var el = d.querySelector('[data-modal="soon"]');
    if (el) return el;
    el = d.createElement("div");
    el.className = "b-modal";
    el.setAttribute("data-modal", "soon");
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<button class="b-modal__dim" type="button" tabindex="-1" aria-label="닫기" data-modal-close data-modal-dim></button>' +
      '<div class="b-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="b-soon-title" tabindex="-1">' +
      '<h2 class="b-modal__title" id="b-soon-title">아직 준비 중이에요!</h2>' +
      '<p class="b-modal__body"></p>' +
      '<div class="b-modal__actions">' +
      '<button class="b-modal__btn" type="button" data-modal-close>취소</button>' +
      '<button class="b-modal__btn b-modal__btn--confirm" type="button" data-modal-close data-modal-confirm>확인</button>' +
      "</div></div>";
    d.body.appendChild(el);
    return el;
  }
  function soon(lines) {
    if (!soonModal) soonModal = modal(soonEl());
    var body = soonModal.el.querySelector(".b-modal__body");
    body.innerHTML = "";
    (lines || SOON_DEFAULT).forEach(function (t) {
      var sp = d.createElement("span");
      sp.textContent = t;
      body.appendChild(sp);
    });
    soonModal.open();
  }
  function bindComingSoon() {
    Array.prototype.forEach.call(d.querySelectorAll("[data-coming-soon]"), function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        var menu = d.querySelector("[data-menu].is-open");            // 모바일 메뉴에서 눌렀으면 메뉴는 닫고 팝업
        if (menu) { var t = d.querySelector("[data-menu-toggle]"); if (t) t.click(); }
        soon();
      });
    });
  }

  /* ---------- QUICK PLAY (헤더 버튼 · 모바일 메뉴) ----------
     프로필(캐릭터·닉네임)이 있으면 바로 시작, 없으면 메인의 캐릭터 선택·닉네임 설정 후 이어서 시작 */
  function startQuick() {
    set("session", KEY.stage, "quick");
    remove("session", KEY.run);
    remove("session", KEY.result);
    w.location.href = "game.html";
  }
  function bindQuick() {
    Array.prototype.forEach.call(d.querySelectorAll("[data-quick]"), function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        var menu = d.querySelector("[data-menu].is-open");
        if (menu) { var t = d.querySelector("[data-menu-toggle]"); if (t) t.click(); }
        if (getNickname() && hasCharacter()) { startQuick(); return; }
        set("session", KEY.next, "quick");
        var cta = d.querySelector("[data-cta]");
        if (cta) { w.scrollTo(0, 0); cta.focus(); }          // 이미 메인: 캐릭터 고르고 시작하기
        else w.location.href = "index.html";
      });
    });
  }

  /* ---------- 모바일 메뉴 (337:7072) ---------- */
  function initMenu() {
    var html = d.documentElement;
    var menu = d.querySelector("[data-menu]");
    var toggle = d.querySelector("[data-menu-toggle]");
    if (!menu || !toggle) return;
    function setMenu(open) {
      menu.classList.toggle("is-open", open);
      menu.setAttribute("aria-hidden", open ? "false" : "true");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
      html.classList.toggle("is-menu-open", open);
    }
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    menu.querySelector("[data-menu-close]").addEventListener("click", function () { setMenu(false); });
    d.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("is-open")) { setMenu(false); toggle.focus(); }
    });
    var mq = w.matchMedia("(min-width: 1366px)");   // 1366 이상은 메뉴 없음 (1024–1365는 QUICK PLAY 때문에 메뉴 사용)
    var onChange = function () { if (mq.matches) setMenu(false); };
    if (mq.addEventListener) mq.addEventListener("change", onChange); else mq.addListener(onChange);
    w.addEventListener("pageshow", function () { setMenu(false); });
  }

  /* ---------- 팝업 (Coming Soon 391:10540) ----------
     닫기: 취소·확인 버튼, Dim(외부) 클릭, ESC. 내부 클릭은 유지. */
  function modal(el) {
    if (!el) return null;
    var lastFocus = null;
    var dialog = el.querySelector("[role=dialog]");
    function open() {
      lastFocus = d.activeElement;
      el.classList.add("is-open");
      el.setAttribute("aria-hidden", "false");
      d.documentElement.classList.add("is-modal-open");     // 배경 스크롤 잠금
      var first = el.querySelector("[data-modal-confirm]") || dialog;
      if (first) first.focus();
    }
    function close() {
      el.classList.remove("is-open");
      el.setAttribute("aria-hidden", "true");
      d.documentElement.classList.remove("is-modal-open");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    Array.prototype.forEach.call(el.querySelectorAll("[data-modal-close]"), function (b) {
      b.addEventListener("click", close);
    });
    d.addEventListener("keydown", function (e) {
      if (!el.classList.contains("is-open")) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "Tab") {                                   // 포커스를 팝업 안에 유지
        var f = el.querySelectorAll("button:not([data-modal-dim])");
        if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
    return { el: el, open: open, close: close, isOpen: function () { return el.classList.contains("is-open"); } };
  }

  w.EYEQ = {
    CHARS: CHARS,
    KEY: KEY,
    get: get, set: set, remove: remove, getJSON: getJSON, setJSON: setJSON,
    getCharacter: getCharacter, setCharacter: setCharacter, charImg: charImg, levelInfo: levelInfo,
    getXp: getXp, addXp: addXp, getRace: getRace, setRace: setRace, getLegacyXp: getLegacyXp, legacyLevelInfo: legacyLevelInfo,
    LEVELS: LEVELS, MAX_LEVEL: MAX_LEVEL, XP_MAX_TOTAL: XP_MAX_TOTAL, two: two,
    getHistory: getHistory, addPlay: addPlay, getTotals: getTotals, compareRecords: compareRecords, bestByStage: bestByStage,
    hasCharacter: hasCharacter, startQuick: startQuick, getNickname: getNickname, setNickname: setNickname, displayName: displayName, NAME_MAX: NAME_MAX,
    renderHeader: renderHeader,
    modal: modal,
    soon: soon
  };

  /* 화면 폭 기준(--vw) 갱신: 창 크기 변경 시 (스크롤바를 뺀 실제 폭) */
  function setVw() {
    var sb = parseFloat(getComputedStyle(d.documentElement).getPropertyValue("--sbw")) || 0;   // 스크롤바 폭 (<head>에서 측정 · 겹침 스크롤바 = 0)
    d.documentElement.style.setProperty("--vw", (w.innerWidth - sb) + "px");
  }
  setVw();
  w.addEventListener("resize", setVw);
  bindComingSoon();
  bindQuick();
  initMenu();
  renderHeader();
  // 뒤로 가기(bfcache) 복귀 시 헤더 XP·캐릭터 갱신
  w.addEventListener("pageshow", function (e) { if (e.persisted) renderHeader(); });
})(window, document);
