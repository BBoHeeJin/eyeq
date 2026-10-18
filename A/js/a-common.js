/* EYEQ A안 — 공통 스크립트 (모든 페이지)
   - 저장소(테스트 모드·진행·결과) · 모바일 메뉴 · 팝업 · Coming Soon · My Result 링크
   서버 저장·계정 기능 없음 (기획에 없음). A안 전용 — B안 코드와 공유하지 않음.
*/
(function (w, d) {
  "use strict";

  /* ---------- 저장소 ---------- */
  var KEY = {
    mode: "eyeq.a.mode",       // 테스트 모드 basic | pro (localStorage)
    basic: "eyeq.a.basic",     // 진행 중인 BASIC 테스트 (sessionStorage)
    pro: "eyeq.a.pro",         // PRO 에디터 상태 (sessionStorage)
    result: "eyeq.a.result"    // 마지막 BASIC 결과 (localStorage — My Result)
  };
  var memory = {};
  function store(kind) {
    try {
      var s = kind === "session" ? w.sessionStorage : w.localStorage;
      s.setItem("__eyeq_a", "1"); s.removeItem("__eyeq_a");
      return s;
    } catch (e) { return null; }
  }
  function get(kind, key) {
    var s = store(kind);
    try { return s ? s.getItem(key) : (key in memory ? memory[key] : null); } catch (e) { return null; }
  }
  function set(kind, key, v) {
    var s = store(kind);
    try { if (s) s.setItem(key, v); else memory[key] = v; } catch (e) { memory[key] = v; }
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
  function setJSON(kind, key, v) { set(kind, key, JSON.stringify(v)); }
  function getMode() { return get("local", KEY.mode) === "pro" ? "pro" : "basic"; }
  function setMode(m) { set("local", KEY.mode, m === "pro" ? "pro" : "basic"); }

  /* ---------- 팝업 ----------
     닫기: 닫기·확인·취소 버튼, 딤(외부) 클릭, Esc. 팝업 안쪽 클릭은 유지. 열린 동안 배경 스크롤 잠금. */
  function modal(el) {
    if (!el) return null;
    var lastFocus = null;
    var dialog = el.querySelector(".a-modal__dialog");
    function focusables() {
      return Array.prototype.filter.call(dialog.querySelectorAll("button, a[href]"), function (b) { return !b.disabled && b.offsetParent !== null; });
    }
    function open() {
      lastFocus = d.activeElement;
      el.classList.add("is-open");
      el.setAttribute("aria-hidden", "false");
      d.documentElement.classList.add("is-modal-open");
      var f = focusables();
      var first = dialog.querySelector("[data-modal-close]") || f[0];
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
      if (e.key === "Tab") {                       // 포커스를 팝업 안에 유지
        var f = focusables();
        if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); }
        else if (f.indexOf(d.activeElement) < 0) { e.preventDefault(); a.focus(); }
      }
    });
    return { el: el, open: open, close: close, isOpen: function () { return el.classList.contains("is-open"); } };
  }

  /* ---------- Coming Soon ----------
     연결할 화면이 아직 없는 버튼·메뉴([data-soon]) → '아직 준비 중이에요!' 팝업
     data-soon-msg 가 있으면 본문 문구를 바꿔 보여줌 */
  var DEFAULT_SOON = "곧 만나볼 수 있도록 준비하고 있어요.";
  var soonModal = modal(d.querySelector('[data-modal="soon"]'));
  function soon(msg) {
    if (!soonModal) return;
    var body = soonModal.el.querySelector("[data-soon-body]");
    if (body) body.textContent = msg || DEFAULT_SOON;
    closeMenu();
    soonModal.open();
  }
  function bindSoon(root) {
    Array.prototype.forEach.call((root || d).querySelectorAll("[data-soon]"), function (el) {
      if (el.__soon) return;
      el.__soon = true;
      el.addEventListener("click", function (e) {
        e.preventDefault();
        soon(el.getAttribute("data-soon-msg"));
      });
    });
  }

  /* ---------- My Result: 오각형 그래프로 만들 예정 → 지금은 준비 중 팝업 (사용자 요청)
     테스트 결과 화면(result.html)은 BASIC 테스트를 마치면 바로 나옴 ---------- */
  function bindMyResult() {
    Array.prototype.forEach.call(d.querySelectorAll("[data-my-result]"), function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        soon("나의 디자인 감각을 한눈에 보는 My Result를 준비하고 있어요.");
      });
    });
  }

  /* ---------- Test 메뉴: 마지막으로 고른 모드의 카테고리 화면 ---------- */
  function bindModeLinks() {
    Array.prototype.forEach.call(d.querySelectorAll('a[href="category.html"]'), function (a) {
      a.addEventListener("click", function () { a.setAttribute("href", "category.html?mode=" + getMode()); });
    });
    Array.prototype.forEach.call(d.querySelectorAll("[data-start-mode]"), function (a) {
      a.addEventListener("click", function () { setMode(a.getAttribute("data-start-mode")); });
    });
  }

  /* ---------- 모바일 메뉴 (Overlay / Menu – Mobile 134:1373) ---------- */
  var closeMenu = function () {};
  function initMenu() {
    var html = d.documentElement;
    var menu = d.querySelector("[data-menu]");
    var toggle = d.querySelector("[data-menu-toggle]");
    if (!menu || !toggle) return;
    function setMenu(open) {
      menu.classList.toggle("is-open", open);
      menu.setAttribute("aria-hidden", open ? "false" : "true");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      html.classList.toggle("is-menu-open", open);
      if (open) { var c = menu.querySelector(".a-close"); if (c) c.focus(); }
    }
    closeMenu = function () { if (menu.classList.contains("is-open")) setMenu(false); };
    toggle.addEventListener("click", function () { setMenu(true); });
    Array.prototype.forEach.call(menu.querySelectorAll("[data-menu-close]"), function (b) {
      b.addEventListener("click", function () { setMenu(false); toggle.focus(); });
    });
    d.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("is-open")) { setMenu(false); toggle.focus(); }
    });
    var mq = w.matchMedia("(min-width: 1024px)");
    var onChange = function () { if (mq.matches) setMenu(false); };
    if (mq.addEventListener) mq.addEventListener("change", onChange); else mq.addListener(onChange);
    w.addEventListener("pageshow", function () { setMenu(false); });
  }

  w.EYEQA = {
    KEY: KEY, get: get, set: set, remove: remove, getJSON: getJSON, setJSON: setJSON,
    getMode: getMode, setMode: setMode, modal: modal, soon: soon, bindSoon: bindSoon
  };
  initMenu();
  bindSoon();
  bindMyResult();
  bindModeLinks();
})(window, document);
