/* EYEQ A안 — CATEGORY SELECT
   - 모드(BASIC/PRO): 주소의 ?mode= 또는 마지막으로 고른 모드 · 토글로 바로 전환 (진행 기록이 없어 확인 창 없음)
   - Typography 카드 → 해당 모드 테스트 / 나머지 카드 → Coming Soon (공통 스크립트)
*/
(function () {
  "use strict";
  var E = window.EYEQA;
  var DESC = { basic: "디자인을 보고 선택하는 가벼운 테스트", pro: "직접 수정하며 실력을 키우는 심화 테스트" };
  var q = /[?&]mode=(basic|pro)/.exec(window.location.search);
  var mode = q ? q[1] : E.getMode();

  function apply(m) {
    mode = m;
    E.setMode(m);
    document.documentElement.classList.toggle("a-mode-pro", m === "pro");
    Array.prototype.forEach.call(document.querySelectorAll("[data-toggle]"), function (t) {
      t.classList.toggle("is-pro", m === "pro");
      Array.prototype.forEach.call(t.querySelectorAll("[data-mode-btn]"), function (b) {
        var on = b.getAttribute("data-mode-btn") === m;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    });
    var d = document.querySelector("[data-mode-desc]");
    if (d) d.textContent = DESC[m];
    Array.prototype.forEach.call(document.querySelectorAll("[data-cat-start]"), function (a) {
      a.setAttribute("href", m === "pro" ? "test-pro.html" : "test-basic.html");
    });
    if (window.history && history.replaceState) history.replaceState(null, "", "category.html?mode=" + m);
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-mode-btn]"), function (b) {
    b.addEventListener("click", function () {
      var m = b.getAttribute("data-mode-btn");
      if (m !== mode) apply(m);
    });
  });
  apply(mode);
  window.addEventListener("pageshow", function (e) { if (e.persisted) apply(E.getMode()); });
})();
