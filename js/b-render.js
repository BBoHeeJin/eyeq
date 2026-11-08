/* EYEQ B안 — 답안 카드 안쪽 렌더러
   카드 틀(A/B/C 배지 · 체크/X · 상태)은 b-game.js 공용, 렌더러는 .b-ans__copy 안쪽만 담당
   - html(): 카드 안 내용 마크업 (스테이지 고유)
   - apply(el, props): 문제 수치를 CSS 변수로 반영 → 디자인 값은 CSS 기본값 그대로 */
(function () {
  "use strict";
  var R = {
    /* Typography (Answer Copy 326:4350) — 모든 선택지 같은 문구, 자간 · 굵기 · 크기만 다름 */
    typography: {
      html: function () {
        return '<span class="b-ans__kr"><span>좋은 디자인은</span><span>보는 눈에서</span><span>시작된다.</span></span>' +
               '<span class="b-ans__en"><span>GOOD DESIGN STARTS</span><span>WITH A KEEN EYE.</span></span>';
      },
      apply: function (el, p) {
        el.style.setProperty("--ans-ls", p.ls + "em");
        el.style.setProperty("--ans-fw", String(p.fw));
        el.style.setProperty("--ans-fs", String(p.fs));
        el.classList.toggle("is-wide", p.ls > 0);       // 자간이 넓은 카드: 모바일 줄 간격 9 (시안)
      }
    }
  };
  /* =========================================================
     STAGE 02~05 — 카드 안 미니 UI (HTML/CSS · 이미지 파일 없음)
     - 마크업은 고정, 문제 수치는 CSS 변수로만 넣음 (화면에 수치 표시 없음)
     - .is-ui: 카드 가운데 배치 · 크기 단위 --u (모바일 1px · PC 1.9배, b-game.css)
     ========================================================= */
  var ICON = {
    bell: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 20.5a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 12.5l4 4 8-9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function ui(html, vars) {
    return {
      html: function () { return html; },
      apply: function (el, p) {
        el.classList.add("is-ui");
        var v = vars(p);
        for (var k in v) el.style.setProperty(k, String(v[k]));
      }
    };
  }
  /* Spacing */
  R["sp-noti"] = ui(
    '<span class="bq-panel bq-noti"><span class="bq-noti__icon">' + ICON.bell + '</span>' +
    '<span class="bq-noti__text"><span class="bq-t1" data-t="0">새로운 알림</span><span class="bq-t2" data-t="1">새 메시지가 도착했어요</span></span></span>',
    function (p) { return { "--gap": p.gap }; });
  R["sp-profile"] = ui(
    '<span class="bq-panel bq-prof"><span class="bq-prof__in"><span class="bq-avatar"></span>' +
    '<span class="bq-prof__text"><span class="bq-t1" data-t="0">김아이</span><span class="bq-t2" data-t="1">UX 디자이너</span></span></span></span>',
    function (p) { return { "--pad": p.pad }; });
  R["sp-chips"] = ui(
    '<span class="bq-chips"><span class="bq-chip" data-t="0">전체</span><span class="bq-chip" data-t="1">인기</span><span class="bq-chip" data-t="2">최신</span></span>',
    function (p) { return { "--g1": p.gaps[0], "--g2": p.gaps[1] }; });
  /* Alignment */
  R["al-list"] = ui(
    '<span class="bq-panel bq-list">' +
    '<span class="bq-list__row"><span class="bq-list__ico"></span><span class="bq-t1" data-t="0">디자인 기초</span></span>' +
    '<span class="bq-list__row is-2"><span class="bq-list__ico"></span><span class="bq-t1" data-t="1">정렬 가이드</span></span>' +
    '<span class="bq-list__row"><span class="bq-list__ico"></span><span class="bq-t1" data-t="2">색상 팔레트</span></span></span>',
    function (p) { return { "--shift": p.shift }; });
  R["al-popup"] = ui(
    '<span class="bq-panel bq-popup"><span class="bq-popup__group"><span class="bq-popup__icon">' + ICON.check + '</span>' +
    '<span class="bq-t1" data-t="0">저장 완료!</span><span class="bq-btn" data-t="1">확인</span></span></span>',
    function (p) { return { "--sx": p.sx }; });
  R["al-product"] = ui(
    '<span class="bq-panel bq-prod"><span class="bq-img bq-prod__img"></span><span class="bq-prod__info">' +
    '<span class="bq-t1" data-t="0">미니 백팩</span><span class="bq-prod__price" data-t="1">39,000원</span><span class="bq-btn bq-prod__btn" data-t="2">구매하기</span></span></span>',
    function (p) { return { "--px": p.off.p, "--bx": p.off.b }; });
  /* Hierarchy — 강조 안 된 텍스트는 같은 크기·굵기 */
  R["hi-event"] = ui(
    '<span class="bq-panel bq-event"><span class="bq-event__tag" data-t="0">SPECIAL EVENT</span>' +
    '<span class="bq-event__item" data-k="off" data-t="1">50% OFF</span><span class="bq-event__item" data-k="date" data-t="2">이번 주말까지</span></span>',
    function (p) { return { "--off": p.emph === "off" ? 1 : 0, "--date": p.emph === "date" ? 1 : 0 }; });
  R["hi-price"] = ui(
    '<span class="bq-panel bq-price"><span class="bq-t1" data-t="0">데일리 스니커즈</span><span class="bq-price__num" data-t="1">29,900원</span><span class="bq-t2" data-t="2">무료배송</span></span>',
    function (p) { return { "--ps": p.price.s, "--pw": p.price.w }; });
  R["hi-article"] = ui(
    '<span class="bq-panel bq-article"><span class="bq-article__h" data-t="0">새로운 디자인 트렌드</span><span class="bq-article__p" data-t="1">변화하는 디자인의 흐름을 살펴보세요.</span></span>',
    function (p) { return { "--ts": p.st.ts, "--tw": p.st.tw, "--bs": p.st.bs, "--bw": p.st.bw }; });
  /* Composition */
  R["co-banner"] = ui(
    '<span class="bq-panel bq-banner"><span class="bq-banner__text"><span class="bq-banner__cat" data-t="0">NEW</span>' +
    '<span class="bq-t1" data-t="1">봄 시즌 컬렉션</span><span class="bq-t2" data-t="2">새 스타일을 만나보세요</span><span class="bq-btn" data-t="3">자세히 보기</span></span>' +
    '<span class="bq-img bq-banner__img"></span></span>',
    function (p) { return { "--dir": p.flip ? "row-reverse" : "row" }; });
  R["co-poster"] = ui(
    '<span class="bq-panel bq-poster"><span class="bq-poster__group"><span class="bq-img bq-poster__circle"></span>' +
    '<span class="bq-poster__title" data-t="0">DESIGN WEEK</span><span class="bq-t2" data-t="1">11.20 — 11.24</span></span></span>',
    function (p) { return { "--sx": p.sx }; });
  R["co-grid"] = ui(
    '<span class="bq-panel bq-grid"><span class="bq-grid__in"><span class="bq-img"></span><span class="bq-img"></span><span class="bq-img"></span><span class="bq-img bq-grid__last"></span></span></span>',
    function (p) { return { "--last": p.g.last, "--cg": p.g.cg }; });

  window.EYEQ.render = {
    get: function (name) { return R[name] || null; },
    /* 카드 안 내용 교체 + 수치 적용 (같은 렌더러면 마크업 유지) */
    into: function (el, name, props, copy) {
      var r = R[name];
      if (!r) return;
      if (el.getAttribute("data-render") !== name) {
        el.className = "b-ans__copy";                  // 이전 렌더러의 클래스·변수 정리
        el.removeAttribute("style");
        el.innerHTML = r.html();
        el.setAttribute("data-render", name);
        Array.prototype.forEach.call(el.querySelectorAll("[data-t]"), function (t) { t.setAttribute("data-t0", t.textContent); });   // 원래 문구 보관
      }
      /* 문구 변형: 문제의 문구 세트로 바꾸고, 없으면 원래 문구 (마크업·클래스는 그대로) */
      Array.prototype.forEach.call(el.querySelectorAll("[data-t]"), function (t) {
        var i = +t.getAttribute("data-t");
        t.textContent = copy && typeof copy[i] === "string" ? copy[i] : t.getAttribute("data-t0");
      });
      r.apply(el, props);
    }
  };
})();
