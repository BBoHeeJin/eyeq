/* EYEQ B안 — 최초 사용자 튜토리얼 (팝업 하나 · 크기 고정 · 단계별로 보여주는 방식)
   - 자동 표시: 메인에서 '처음' 닉네임 설정이 저장된 직후 1회 (b-main.js 가 E.tutorial.open 호출)
   - 다시 보기: 메뉴(☰) '튜토리얼 다시 보기' · 마이페이지 → 같은 팝업을 처음부터 (닉네임·캐릭터 단계로 돌아가지 않음)
   - 화면: 시작 → STEP 01 문제 확인 → STEP 02 다른 하나 고르기 → STEP 03 결과 확인
     실제 게임 화면(타이머 · 문제 · A/B/C 카드 · GREAT! +XP)을 같은 색·모양으로 보여주기만 함 — 직접 풀지 않음
   - 게임 로직과 분리: 게임·서버 함수를 부르지 않음 → XP/포인트/정답률/랭킹/기록 변화 없음
   - 상태 저장: 이 브라우저(= 현재 익명 사용자) localStorage 'eyeq.b.tutorial' = {status: done|skipped, at} */
(function (w, d) {
  "use strict";
  var E = w.EYEQ;
  if (!E) return;
  var KEY = "eyeq.b.tutorial";
  var PAGE = (w.location.pathname.split("/").pop() || "index.html").replace(".html", "") || "index";

  function state() { return E.getJSON("local", KEY); }
  function mark(status) { E.setJSON("local", KEY, { status: status, at: Date.now() }); }
  /* 자동 표시 대상: 아직 튜토리얼 기록이 없고 · 플레이 기록이 없는 신규 사용자 */
  function shouldShow() {
    if (state()) return false;
    var H = E.getHistory ? E.getHistory() : [];
    return !(H && H.length);
  }

  /* ---------- 게임 화면 미리보기 (실제 게임과 같은 카드 · 자간만 다른 문제) ---------- */
  var STEPS = [
    null,
    { tag: "STEP 01", title: "먼저 문제를 확인해요", sub: "문제마다 무엇이 다른지 알려줘요. 제한 시간은 10초!" },
    { tag: "STEP 02", title: "다른 하나를 골라요", sub: "세 카드 중 딱 하나만 달라요. 다르다고 생각하는 카드를 눌러요." },
    { tag: "STEP 03", title: "결과와 해설을 확인해요", sub: "맞히면 XP와 포인트가 쌓이고, 틀려도 해설로 배울 수 있어요." }
  ];
  function card(k, cls) {
    return '<span class="b-tutm__card' + (cls ? " " + cls : "") + '" data-k="' + k + '">' +
      '<span class="b-tutm__key">' + k + "</span>" +
      '<span class="b-tutm__check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 12.5l4 4 8-9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
      '<span class="b-tutm__copy"><span class="b-tutm__kr">좋은 디자인은<br />보는 눈에서<br />시작된다.</span><span class="b-tutm__en">GOOD DESIGN STARTS<br />WITH A KEEN EYE.</span></span>' +
      "</span>";
  }
  function mock(step) {
    var top = step === 3
      ? '<div class="b-tutm__fb"><span class="b-tutm__great">GREAT!</span><span class="b-tutm__xp">+30 XP</span><span class="b-tutm__pt">+10 P</span>' +
          '<img class="b-tutm__eye" src="' + E.charImg("EYE", "happy") + '" alt="" /></div>' +
        '<p class="b-tutm__insight">글자 간격이 고르면 문장이 한 덩어리로 편하게 읽혀요.</p>'
      : '<div class="b-tutm__bar">' +
          '<span class="b-tutm__timer' + (step === 1 ? " is-mark" : "") + '"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="13.5" r="7" stroke="currentColor" stroke-width="2"/><path d="M12 10v3.5M9.5 3.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><b>' + (step === 1 ? "10.0s" : "06.4s") + '</b><i><em style="width:' + (step === 1 ? 100 : 64) + '%"></em></i>' + (step === 1 ? '<span class="b-tutm__num">1</span>' : "") + "</span>" +
          '<span class="b-tutm__q' + (step === 1 ? " is-mark" : "") + '"><b><em>다른 하나</em>를 찾아라!</b><small>세 가지 중 글자 간격이 다른 하나를 선택하세요.</small>' + (step === 1 ? '<span class="b-tutm__num">2</span>' : "") + "</span>" +
          '<span class="b-tutm__dots" aria-hidden="true"><i class="is-on"></i><i></i><i></i></span>' +
        "</div>";
    var cards = step === 1 ? card("A") + card("B") + card("C")
      : step === 2 ? card("A", "is-selected is-tap") + card("B") + card("C")
      : card("A", "is-correct") + card("B", "is-dim") + card("C", "is-dim");
    return '<div class="b-tutm b-tutm--s' + step + '" aria-hidden="true">' + top + '<div class="b-tutm__cards">' + cards +
      (step === 2 ? '<span class="b-tutm__hand"><svg viewBox="0 0 24 24" fill="none"><path d="M9 11.5V5.2a1.6 1.6 0 0 1 3.2 0v5.3l4.3.9a2 2 0 0 1 1.6 2.2l-.6 4.6a3 3 0 0 1-3 2.6h-3.3a3 3 0 0 1-2.4-1.2L5.6 15a1.6 1.6 0 0 1 2.4-2.1z" fill="#fff" stroke="#1d1b4b" stroke-width="1.4" stroke-linejoin="round"/></svg></span>' : "") +
      "</div></div>";
  }
  function tips(step) {
    var T = {
      1: [["1", "남은 시간", "10초 안에 골라요"], ["2", "문제 설명", "무엇이 다른지 알려줘요"]],
      2: [["✓", "자간 · 굵기 · 여백", "딱 한 가지만 달라요"], ["👆", "카드를 눌러요", "고르면 바로 채점돼요"]],
      3: [["✦", "정답 +10P", "포인트로 스킨을 사요"], ["📈", "3문제 = 1스테이지", "XP로 레벨이 올라요"]]
    }[step];
    return '<ul class="b-tut__tips">' + T.map(function (t) {
      return '<li><span class="b-tut__tipic" aria-hidden="true">' + t[0] + '</span><span><b>' + t[1] + "</b><small>" + t[2] + "</small></span></li>";
    }).join("") + "</ul>";
  }

  /* ---------- 팝업 ---------- */
  var root = null, dialog = null, body = null, lastFocus = null, step = 0, opts = {};
  function ensure() {
    if (root) return;
    root = d.createElement("div");
    root.className = "b-modal b-modal--tut";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = '<div class="b-modal__dim" aria-hidden="true"></div>' +
      '<div class="b-modal__dialog b-tut" role="dialog" aria-modal="true" aria-labelledby="b-tut-title" tabindex="-1">' +
        '<header class="b-tut__head">' +
          '<img class="b-tut__logo" src="assets/b/logo-eyeq.svg" alt="EYEQ" />' +
          '<span class="b-tut__name">플레이 방법</span>' +
          '<span class="b-tut__prog" data-tut-prog aria-live="polite"></span>' +
          '<button class="b-tut__skip" type="button" data-tut-skip>건너뛰기</button>' +
        "</header>" +
        '<div class="b-tut__body" data-tut-body></div>' +
        '<div class="b-tut__foot" data-tut-foot></div>' +
      "</div>";
    d.body.appendChild(root);
    dialog = root.querySelector(".b-tut");
    body = root.querySelector("[data-tut-body]");
    root.addEventListener("click", onClick);
    d.addEventListener("keydown", function (e) {
      if (!root.classList.contains("is-open")) return;
      if (e.key === "Escape") { e.preventDefault(); finish("skipped"); return; }   // ESC = 건너뛰기
      if (e.key === "Tab") {
        var f = Array.prototype.filter.call(dialog.querySelectorAll("button"), function (b) { return !b.disabled && b.offsetParent !== null; });
        if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (!dialog.contains(d.activeElement)) { e.preventDefault(); a.focus(); }
        else if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
  }

  function progress() {
    var p = root.querySelector("[data-tut-prog]");
    p.innerHTML = '<span class="b-tut__bars" aria-hidden="true">' + [1, 2, 3].map(function (i) { return '<i class="' + (i <= step ? "is-on" : "") + '"></i>'; }).join("") + "</span>" +
      '<span class="b-tut__num"><b>0' + step + "</b> / 03</span>";
    p.setAttribute("aria-label", step ? "3단계 중 " + step + "단계" : "시작");
    p.classList.toggle("is-start", !step);
  }

  function render() {
    progress();
    root.querySelector(".b-tut__head [data-tut-skip]").hidden = step === 3;   // 마지막 단계는 시작 버튼 하나만
    var html, foot;
    if (step === 0) {
      html = '<div class="b-tut__intro">' +
          '<span class="b-tut__hero"><img src="' + E.charImg("EYE") + '" alt="" /></span>' +
          '<div class="b-tut__introtext">' +
            '<h2 class="b-tut__title" id="b-tut-title" tabindex="-1">처음이신가요?</h2>' +
            '<p class="b-tut__sub">EYEQ와 함께 간단히 플레이 방법을 알아볼까요?</p>' +
            '<ol class="b-tut__plan">' +
              '<li><span>01</span><b>문제 확인</b><small>무엇이 다른지 · 제한 시간 10초</small></li>' +
              '<li><span>02</span><b>다른 하나 고르기</b><small>세 카드 중 딱 하나만 달라요</small></li>' +
              '<li><span>03</span><b>결과와 해설</b><small>XP · 포인트 · 짧은 디자인 해설</small></li>' +
            "</ol>" +
            '<p class="b-tut__note"><span aria-hidden="true">⏱</span> 약 30초면 끝나요! 한 문제의 흐름을 따라가며 게임 방법을 익혀요.</p>' +
          "</div>" +
        "</div>";
      foot = '<button class="b-tut__btn b-tut__btn--ghost" type="button" data-tut-skip>건너뛰기</button>' +
        '<button class="b-tut__btn b-tut__btn--main" type="button" data-tut-next>튜토리얼 시작하기 →</button>';
    } else {
      var S = STEPS[step];
      html = '<div class="b-tut__guide">' +
          '<span class="b-tut__steptag">' + S.tag + "</span>" +
          '<h2 class="b-tut__title" id="b-tut-title" tabindex="-1">' + S.title + "</h2>" +
          '<p class="b-tut__sub">' + S.sub + "</p>" +
        "</div>" + mock(step) + tips(step);
      foot = '<button class="b-tut__btn b-tut__btn--ghost" type="button" data-tut-prev>← 이전</button>' +
        (step < 3 ? '<button class="b-tut__btn b-tut__btn--main" type="button" data-tut-next>다음으로 →</button>'
          : '<button class="b-tut__btn b-tut__btn--main" type="button" data-tut-done>이제 게임을 시작해 볼까? →</button>');
    }
    body.className = "b-tut__body is-step" + step;
    body.innerHTML = html;
    root.querySelector("[data-tut-foot]").innerHTML = foot;
    body.classList.remove("is-in"); void body.offsetWidth; body.classList.add("is-in");   // 내용만 부드럽게 전환 (팝업 크기·위치 그대로)
    var t = body.querySelector(".b-tut__title");
    if (t) t.focus();
  }

  function onClick(e) {
    if (e.target.closest("[data-tut-skip]")) { finish("skipped"); return; }
    if (e.target.closest("[data-tut-next]")) { step = Math.min(3, step + 1); render(); return; }
    if (e.target.closest("[data-tut-prev]")) { step = Math.max(0, step - 1); render(); return; }
    if (e.target.closest("[data-tut-done]")) { finish("done"); return; }
  }

  function open(o) {
    ensure();
    opts = o || {};
    step = 0;
    lastFocus = d.activeElement;
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    d.documentElement.classList.add("is-modal-open");
    render();
  }
  function finish(status) {
    if (!root || !root.classList.contains("is-open")) return;
    /* 처음 보는 사용자의 상태는 완료든 건너뛰기든 저장 → 다시 자동으로 뜨지 않음 (다시 보기는 기존 상태 유지) */
    if (!opts.replay || !state()) mark(status);
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    d.documentElement.classList.remove("is-modal-open");
    var cb = opts.onDone; opts = {};
    if (cb) { cb(status); return; }                               // 첫 실행: 기존 게임 시작 흐름 이어서
    if (lastFocus && d.body.contains(lastFocus) && lastFocus.offsetParent !== null) lastFocus.focus();
  }

  /* ---------- 다시 보기 진입점 ---------- */
  function replay() {
    var menu = d.querySelector("[data-menu].is-open [data-menu-close]");
    if (menu) menu.click();                                       // 메뉴가 열려 있으면 닫고
    if (E.profileMenu) E.profileMenu.close();
    open({ replay: true });
  }
  /* 다시 보기 진입점: 헤더 프로필 메뉴 '튜토리얼 다시 보기' · 마이페이지 (data-tutorial-open) — 문제 풀이 화면에서는 프로필 메뉴에서 숨김 */
  d.addEventListener("click", function (e) { if (e.target.closest("[data-tutorial-open]")) { e.preventDefault(); replay(); } });

  E.tutorial = { open: open, replay: replay, shouldShow: shouldShow, state: state, isOpen: function () { return !!root && root.classList.contains("is-open"); } };
})(window, document);
