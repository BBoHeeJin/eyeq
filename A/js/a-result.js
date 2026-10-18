/* EYEQ A안 — TYPOGRAPHY BASIC RESULT (189:1653 / 213:2035)
   마지막 BASIC 테스트 기록으로 점수·정답 수·문제별 결과를 채움 (점수 = 정답 수 / 3 × 100, 반올림)
   피드백 문구: 시안은 2문제 정답(67점) 문구만 있음 → 3문제·1문제 이하 문구는 새로 작성 (확인 필요)
   기록이 없으면 LEVEL SELECT로 이동
*/
(function () {
  "use strict";
  var E = window.EYEQA;
  var r = E.getJSON("local", E.KEY.result);
  if (!r || !r.answers) { window.location.replace("level.html"); return; }

  var COPY = {
    3: ["완벽한 감각을 가지고 있어요!", "글자의 분위기와 크기, 자간의 차이를 정확하게 보고 있어요.", "다른 디자인 감각 테스트에도 도전해보세요."],
    2: ["좋은 감각을 가지고 있어요!", "글자의 분위기와 가독성을 구분하는 감각이 좋아요.", "조금 더 세밀한 차이에 집중해보세요."],
    1: ["조금 더 연습해볼까요?", "서체, 크기, 자간이 주는 차이를 다시 살펴보세요.", "힌트를 참고하면 차이가 더 잘 보일 거예요."]
  };
  var total = r.total || 3, correct = r.correct || 0;
  var score = Math.round(correct / total * 100);
  var c = COPY[Math.max(1, Math.min(3, correct))];
  var $ = function (s, root) { return (root || document).querySelector(s); };

  $("[data-score-h]").textContent = c[0];
  var fb = $("[data-score-fb]");                       // 두 문장: PC는 두 줄, 모바일은 이어서 흐름
  fb.textContent = "";
  [c[1], c[2]].forEach(function (t, i) {
    if (i) fb.appendChild(document.createTextNode(" "));
    var s = document.createElement("span"); s.textContent = t; fb.appendChild(s);
  });
  $("[data-score-count]").textContent = total + "문제 중 " + correct + "문제 정답";
  $("[data-score-num]").textContent = score;
  $("[data-ring]").style.setProperty("--score", score / 100);
  Array.prototype.forEach.call(document.querySelectorAll("[data-rq]"), function (card) {
    var i = card.getAttribute("data-rq");
    var pick = r.answers[i], key = r.keys[i], ok = pick === key;
    card.classList.toggle("is-correct", ok);
    $("[data-rq-badge]", card).textContent = ok ? "정답" : "오답";
    $("[data-rq-pick]", card).textContent = pick || "-";
    $("[data-rq-answer]", card).textContent = key;
  });
  // 다시 테스트하기: BASIC Q1부터 새로
  $("[data-retry]").addEventListener("click", function () { E.remove("session", E.KEY.basic); E.setMode("basic"); });
})();
