/* EYEQ A안 — 메인 화면
   - Typography 카드 → 'Overlay / Typography' 팝업 (PC 111:412 · Mobile 134:487)
     다른 4개 카테고리는 시안에 팝업이 없어 Coming Soon 팝업
   - 모바일 'Carousel / Category' (134:1192 Slide=1~5): 스와이프 · 점 · 양옆 카드 탭으로 이동, 양 끝 순환
*/
(function () {
  "use strict";
  var E = window.EYEQA;

  /* ---------- Typography 팝업 ---------- */
  var pop = E.modal(document.querySelector('[data-modal="typography"]'));
  Array.prototype.forEach.call(document.querySelectorAll('[data-popup-open="typography"]'), function (b) {
    b.addEventListener("click", function () { pop.open(); });
  });

  /* ---------- 모바일 카테고리 캐러셀 ----------
     트랙 = (복제) Hierarchy, Composition · 원본 5장 · (복제) Typography, Spacing — 시안 구성 그대로
     위치 pos = 트랙 인덱스(원본 0번 = 2). 끝에서 넘어가면 복제 카드로 이동한 뒤 같은 원본 위치로 순간 이동 */
  var root = document.querySelector("[data-carousel]");
  if (!root) return;
  var track = root.querySelector("[data-track]");
  var cards = track.querySelectorAll(".a-ccard");
  var dots = root.querySelectorAll("[data-dot]");
  var status = root.querySelector("[data-carousel-status]");
  var NAMES = ["Typography", "Spacing", "Alignment", "Hierarchy", "Composition"];
  var COUNT = 5, OFFSET = 2;
  var pos = OFFSET;

  function real(p) { return ((p - OFFSET) % COUNT + COUNT) % COUNT; }
  function render(animate) {
    track.classList.toggle("no-anim", !animate);
    track.style.setProperty("--pos", pos);
    var r = real(pos);
    Array.prototype.forEach.call(dots, function (d, i) {
      d.classList.toggle("is-active", i === r);
      if (i === r) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
    });
    Array.prototype.forEach.call(cards, function (c, i) {
      var center = i === pos;
      c.classList.toggle("is-center", center);
      if (!c.hasAttribute("data-clone")) c.setAttribute("aria-label", NAMES[real(i)] + (center ? " (선택됨)" : ""));
    });
    if (!animate) { void track.offsetWidth; track.classList.remove("no-anim"); }
  }
  function go(p, announce) {
    pos = p;
    render(true);
    if (announce && status) status.textContent = NAMES[real(pos)];
  }
  // 복제 카드에 도착하면 같은 원본 위치로 순간 이동 (애니메이션 없이)
  track.addEventListener("transitionend", function (e) {
    if (e.target !== track) return;
    if (pos < OFFSET || pos >= OFFSET + COUNT) { pos = OFFSET + real(pos); render(false); }
  });
  function step(dir) {
    if (pos < OFFSET || pos >= OFFSET + COUNT) { pos = OFFSET + real(pos); render(false); }
    go(pos + dir, true);
  }

  Array.prototype.forEach.call(dots, function (d, i) {
    d.addEventListener("click", function () { go(OFFSET + i, true); });
  });
  Array.prototype.forEach.call(cards, function (c, i) {
    c.addEventListener("click", function () {
      if (suppressClick) return;
      if (i !== pos) { go(i, true); return; }                 // 양옆 카드: 가운데로 (구현 제안)
      if (real(i) === 0) pop.open();                          // 가운데 Typography: 팝업
      else E.soon();                                          // 다른 카테고리: 시안에 팝업 없음 → Coming Soon
    });
  });

  /* 터치 스와이프 */
  var startX = null, startY = null, suppressClick = false;
  var viewport = root.querySelector(".a-carousel__viewport");
  viewport.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse") return;
    startX = e.clientX; startY = e.clientY;
  });
  viewport.addEventListener("pointerup", function (e) {
    if (startX === null) return;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    startX = startY = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      suppressClick = true;
      step(dx < 0 ? 1 : -1);
      setTimeout(function () { suppressClick = false; }, 0);
    }
  });
  viewport.addEventListener("pointercancel", function () { startX = startY = null; });

  render(false);
})();
