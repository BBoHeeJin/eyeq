/* EYEQ B안 — STAGE CLEAR
   마지막 게임 기록(sessionStorage)으로 획득 XP · 최대 콤보 · 정답 수 표시.
   기록이 없으면(직접 접속) STAGE SELECT 로 이동.
   정답 수 = 첫 시도에 맞힌 미션 수 (오답 후 재시도로 맞힌 미션은 제외) — 해석, README 참고
*/
(function () {
  "use strict";
  var E = window.EYEQ;
  var r = E.getJSON("session", E.KEY.result);
  if (!r) { window.location.replace("stage.html"); return; }

  var $ = function (s) { return document.querySelector(s); };
  $("[data-result-xp]").textContent = "+" + r.xp + " XP";
  $("[data-result-combo]").textContent = r.maxCombo + " COMBO";
  $("[data-result-correct]").textContent = r.correct + " / " + r.total;

  var ch = (r.character || E.getCharacter()).toLowerCase();
  $("[data-react-char]").setAttribute("src", "assets/b/char-" + ch + ".png");
  $("[data-react-face]").setAttribute("src", "assets/b/expression-" + ch + "-happy.svg");
})();
