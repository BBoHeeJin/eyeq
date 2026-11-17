/* EYEQ B안 — STAGE SELECT
   - 하단 스테이지 카드 클릭 → 선택 상태 + 메인 카드(번호/타이틀/설명/아이콘/버튼) 교체 (Stage Select Panel 설명)
   - 플레이 가능한 스테이지(현재 5개 모두) = PLAY NOW(게임 이동) · 불가 = COMING SOON(팝업)
   - 메인 카드 캐릭터 = HOME에서 선택한 캐릭터
*/
(function () {
  "use strict";
  var E = window.EYEQ;

  var STAGES = E.stages.list;             // 공용 스테이지 정보 (b-stages.js)
  var byId = E.stages.get;

  /* ---------- Stage Icon (314:3578) ---------- */
  function iconHTML(id) {
    switch (id) {
      case "typography":
        return '<span class="b-ico b-ico--typography"><span class="b-ico__A">A</span><span class="b-ico__a">a</span></span>';
      case "spacing":
        return '<span class="b-ico b-ico--spacing"><span class="b-ico__bar"></span><span class="b-ico__bar"></span>' +
               '<img class="b-ico__arrow" src="assets/b/stage-spacing-arrow.svg" alt="" /></span>';
      case "alignment":
        return '<span class="b-ico b-ico--alignment"><span class="b-ico__guide"></span>' +
               '<span class="b-ico__bar"></span><span class="b-ico__bar"></span><span class="b-ico__bar"></span><span class="b-ico__bar"></span></span>';
      case "hierarchy":
        return '<span class="b-ico b-ico--hierarchy"><span class="b-ico__bar"></span><span class="b-ico__bar"></span><span class="b-ico__bar"></span></span>';
      default:
        return '<span class="b-ico b-ico--composition"><img class="b-ico__img" src="assets/b/stage-composition.svg" alt="" /></span>';
    }
  }
  /* Typography 3D (315:3617): 뒤쪽 12장(측면) + 앞면 그라데이션 */
  function icon3dHTML() {
    var out = '<span class="b-ico3d">', i, x, y;
    for (i = 0; i < 13; i++) {
      x = 17.86 - i * 1.0967; y = -27.77 - i * 1.2533;
      out += '<span class="b-ico3d__A' + (i === 12 ? " is-face" : "") + '" style="left:calc(' + x.toFixed(2) + ' * var(--k));top:calc(' + y.toFixed(2) + ' * var(--k))">A</span>';
    }
    for (i = 0; i < 13; i++) {
      x = 174.53 - i * 1.0967; y = -5.03 - i * 1.2533;
      out += '<span class="b-ico3d__a' + (i === 12 ? " is-face" : "") + '" style="left:calc(' + x.toFixed(2) + ' * var(--k));top:calc(' + y.toFixed(2) + ' * var(--k))">a</span>';
    }
    return out + "</span>";
  }

  /* ---------- 진행 상태 (모바일 카드 칩) — 기존 플레이 기록에서 읽기만 함 ----------
     스테이지 최고 정답 수 기준: 3/3 = CLEAR · 그 외 = BEST n/3 · 기록 없음 = 표시 안 함 */
  var BEST = {};
  try {
    (E.getHistory ? E.getHistory() : []).forEach(function (r) {
      if (!r || r.mode === "quick" || !r.stage || typeof r.correct !== "number") return;
      var b = BEST[r.stage];
      if (!b || r.correct > b.correct) BEST[r.stage] = { correct: r.correct, total: r.total || 3 };
    });
  } catch (e) { /* 기록 없음 */ }
  function stateText(id) {
    var b = BEST[id];
    if (!b) return "";
    return b.correct >= b.total ? '<span class="b-scard__state-in is-clear">CLEAR</span>' : '<span class="b-scard__state-k">BEST </span>' + b.correct + "/" + b.total;
  }

  /* ---------- Stage Cards ---------- */
  var cards = document.querySelectorAll(".b-scard");
  Array.prototype.forEach.call(cards, function (el) {
    var s = byId(el.getAttribute("data-stage"));
    var foot = s.playable
      ? '<span class="b-scard__progress" aria-hidden="true"></span>' +
        '<span class="b-scard__go" aria-hidden="true"><img class="b-scard__go-default" src="assets/b/stage-arrow-mobile.svg" alt="" />' +
        '<img class="b-scard__go-selected" src="assets/b/stage-arrow-mobile-selected.svg" alt="" /></span>'
      : '<span class="b-scard__lock" aria-hidden="true"><img src="assets/b/icon-lock.svg" alt="" /></span>';
    el.innerHTML =
      '<span class="b-scard__no">' + s.no + "</span>" + iconHTML(s.id) +
      '<span class="b-scard__name">' + s.name + "</span>" +
      '<span class="b-scard__desc">' + s.desc + "</span>" + foot;   /* 진행 상태 칩(CLEAR · BEST) 삭제 (사용자 요청) */
    el.setAttribute("aria-label", "STAGE " + s.no + " " + s.name + ", " + s.desc + (s.playable ? "" : " (준비 중)"));
    el.addEventListener("click", function () { select(s.id); });
  });

  /* ---------- Main Stage Card ---------- */
  var q = function (sel) { return document.querySelector(sel); };
  var elNo = q("[data-stage-no]"), elName = q("[data-stage-name]"), elDesc = q("[data-stage-desc]"),
      elDescMo = q("[data-stage-desc-mo]"), elCount = q("[data-stage-count]"), elIcon = q("[data-stage-icon]"),
      btnPlay = q("[data-play]"), btnSoon = q("[data-soon]");

  function select(id) {
    var s = byId(id);
    Array.prototype.forEach.call(cards, function (el) {
      var on = el.getAttribute("data-stage") === s.id;
      el.classList.toggle("is-selected", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
    elNo.textContent = "STAGE " + s.no;
    elName.textContent = s.name;
    elDesc.textContent = s.desc;
    elDescMo.innerHTML = s.descMo[0] + "<br />" + s.descMo[1];
    elCount.textContent = parseInt(s.no, 10) + " / " + STAGES.length;
    elIcon.innerHTML = s.id === "typography" ? icon3dHTML() + iconHTML("typography") : iconHTML(s.id);
    btnPlay.hidden = !s.playable;
    btnSoon.hidden = s.playable;
    E.set("session", E.KEY.stage, s.id);
  }

  /* PLAY NOW → 새 게임 시작 (진행 중이던 기록 초기화) */
  /* 여러 번 눌러도 한 번만 시작 (두 번째 이동이 판을 또 만들면 서버 연속 생성 제한에 걸려 시작이 2초 이상 늦어짐) */
  var starting = false;
  btnPlay.addEventListener("click", function (e) {
    if (starting) { e.preventDefault(); return; }
    starting = true;
    E.remove("session", E.KEY.run);
    E.remove("session", E.KEY.result);
  });
  window.addEventListener("pageshow", function (e) { if (e.persisted) starting = false; });   // 뒤로 가기로 돌아오면 다시 시작 가능

  /* COMING SOON → 팝업 */
  btnSoon.addEventListener("click", function () {
    E.soon(["더 다양한 디자인 감각 테스트를 준비하고 있어요.", "지금은 타이포그래피 스테이지를 즐겨보세요!"]);
  });

  /* 메인 카드 캐릭터 = HOME 선택 캐릭터 */
  var charImg = q(".b-mcard__char");
  if (charImg) charImg.setAttribute("src", E.charImg(E.getCharacter()));

  select(E.get("session", E.KEY.stage) || "typography");
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && charImg) charImg.setAttribute("src", E.charImg(E.getCharacter()));
  });
})();
