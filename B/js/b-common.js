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
    result: "eyeq.b.result"          // 마지막 STAGE CLEAR 결과 (탭 단위)
  };
  /* 레벨 규칙 (사용자 지정): 100 XP마다 레벨 +1, 최대 LV 5 → 'XP MAX'
     누적 XP는 LV 5 도달 시점(400)에서 멈춤. 캐릭터를 바꾸면 XP·레벨 초기화 */
  var MAX_XP = 100;                  // 레벨당 XP (Figma: XP 0 / 100)
  var MAX_LEVEL = 5;
  var XP_CAP = (MAX_LEVEL - 1) * MAX_XP;

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
  /* 캐릭터 확정(메인 CTA). 이전과 다른 캐릭터면 XP·레벨과 진행 중 게임·결과 초기화 */
  function setCharacter(v) {
    if (CHARS.indexOf(v) < 0) return;
    var prev = get("local", KEY.character);
    if (prev !== v) {
      set("local", KEY.xp, "0");
      remove("session", KEY.run);
      remove("session", KEY.result);
    }
    set("local", KEY.character, v);
  }

  function getXp() {
    var n = parseInt(get("local", KEY.xp), 10);
    return isNaN(n) || n < 0 ? 0 : Math.min(n, XP_CAP);
  }
  function addXp(n) {
    var total = Math.min(getXp() + n, XP_CAP);
    set("local", KEY.xp, String(total));
    renderHeader();
    return total;
  }
  /* 누적 XP → { level, xp(현재 레벨 안), max(LV 5 여부) } */
  function levelInfo(total) {
    var level = Math.min(MAX_LEVEL, Math.floor(total / MAX_XP) + 1);
    var isMax = level >= MAX_LEVEL;
    return { level: level, xp: isMax ? MAX_XP : total - (level - 1) * MAX_XP, max: isMax };
  }

  function charImg(ch) { return "assets/b/char-" + ch.toLowerCase() + ".png"; }

  /* ---------- 헤더(+ 게임 화면 레벨 카드): 선택 캐릭터 · LV · XP ---------- */
  function renderHeader() {
    Array.prototype.forEach.call(d.querySelectorAll("[data-charinfo]"), renderCharInfo);
  }
  function renderCharInfo(info) {
    var ch = getCharacter();
    var L = levelInfo(getXp());
    var lvText = "LV. 0" + L.level;
    var xpText = L.max ? "XP MAX" : "XP " + L.xp + " / " + MAX_XP;
    var img = info.querySelector("[data-char-img]");
    if (img && img.getAttribute("src") !== charImg(ch)) img.setAttribute("src", charImg(ch));
    var lv = info.querySelector("[data-lv-text]");
    if (lv) lv.textContent = lvText;
    var text = info.querySelector("[data-xp-text]");
    if (text) text.textContent = xpText;
    info.style.setProperty("--xp-ratio", L.xp / MAX_XP);
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
    var mq = w.matchMedia("(min-width: 1024px)");
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
    getXp: getXp, addXp: addXp,
    renderHeader: renderHeader,
    modal: modal,
    soon: soon
  };

  bindComingSoon();
  initMenu();
  renderHeader();
  // 뒤로 가기(bfcache) 복귀 시 헤더 XP·캐릭터 갱신
  w.addEventListener("pageshow", function (e) { if (e.persisted) renderHeader(); });
})(window, document);
