/* EYEQ A안 — 테스트 중 모드 전환 확인 창 (Overlay / Switch to PRO 161:1161 · Switch to BASIC 188:1717)
   취소: 그대로 / 전환: 지금까지 기록을 지우고 다른 모드의 첫 문제로 이동 */
(function () {
  "use strict";
  var E = window.EYEQA;
  var COPY = {
    pro: { title: "PRO 모드로 전환할까요?", body: "지금까지 진행한 BASIC 테스트 기록은 초기화돼요.", btn: "PRO로 전환", href: "test-pro.html" },
    basic: { title: "BASIC 모드로 전환할까요?", body: "지금까지 진행한 PRO 테스트 기록은 초기화돼요.", btn: "BASIC로 전환", href: "test-basic.html" }
  };
  window.EYEQA.initSwitch = function (current, clearCurrent) {
    var m = E.modal(document.querySelector('[data-modal="switch"]'));
    var el = m.el;
    var target = current === "basic" ? "pro" : "basic";
    var c = COPY[target];
    el.querySelector("[data-switch-title]").textContent = c.title;
    el.querySelector("[data-switch-body]").textContent = c.body;
    var confirm = el.querySelector("[data-switch-confirm]");
    confirm.textContent = c.btn;
    confirm.addEventListener("click", function () {
      clearCurrent();
      E.setMode(target);
      window.location.href = c.href;
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-test-toggle] [data-mode-btn]"), function (b) {
      b.addEventListener("click", function () {
        if (b.getAttribute("data-mode-btn") === target) m.open();
      });
    });
    return m;
  };
})();
