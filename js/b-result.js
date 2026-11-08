/* EYEQ B안 — STAGE CLEAR
   마지막 게임 기록(sessionStorage)으로 획득 XP · 최대 콤보 · 정답 수 · 레벨 진행 표시.
   기록이 없으면(직접 접속) STAGE SELECT 로 이동.
   정답 수 = 첫 시도에 맞힌 미션 수 (오답 후 재시도로 맞힌 미션은 제외) — 해석, README 참고
   XP는 게임 중 이미 지급됨 → 여기서는 읽기만 함 (새로고침해도 지급 없음)
*/
(function () {
  "use strict";
  var E = window.EYEQ;
  var r = E.getJSON("session", E.KEY.result);
  if (!r) { window.location.replace("stage.html"); return; }

  var $ = function (s) { return document.querySelector(s); };
  var QUICK = r.stage === "quick";                                 // QUICK PLAY 결과 (같은 화면 재사용)
  var S = QUICK ? { id: "quick", no: "", nameKo: "" } : E.stages.get(r.stage);   // 스테이지 번호 · 한글 카테고리명
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  $(".b-clear__stage").textContent = QUICK ? "QUICK PLAY" : "STAGE " + S.no;

  if (QUICK) {
    $(".b-clear__desc").textContent = "5가지 디자인 감각에 도전했어요!";
  } else {
    /* 클리어 기록 → 5개 모두 클리어하면 전체 완료 표시 */
    var cleared = E.getJSON("local", E.KEY.cleared) || [];
    if (cleared.indexOf(S.id) < 0) { cleared.push(S.id); E.setJSON("local", E.KEY.cleared, cleared); }
    var allDone = E.stages.list.every(function (s) { return cleared.indexOf(s.id) > -1; });
    $(".b-clear__desc").textContent = allDone && !E.stages.next(S.id)
      ? "모든 스테이지를 완료했어요!"
      : S.nameKo + " 미션을 모두 완료했어요!";
  }

  /* 정답 수별 보조 메시지 */
  var MSG = [
    "첫 도전을 완료했어요! 다시 한번 도전해 볼까요?",
    "잘했어요! 다시 도전하며 감각을 키워봐요!",
    "좋아요! 조금만 더 관찰하면 완벽해요!",
    "완벽해요! 디자인을 보는 눈이 뛰어나네요!"
  ];
  /* 정답 비율로 메시지 선택 (3문제: 0·1·2·3 그대로 / QUICK PLAY 5문제도 같은 기준) */
  var ratio = r.total ? r.correct / r.total : 0;
  var msgEl = $("[data-result-msg]");
  var msgText = document.createElement("span");
  msgText.className = "b-clear__msgtext";
  msgText.textContent = MSG[ratio >= 1 ? 3 : ratio >= 0.6 ? 2 : ratio > 0 ? 1 : 0];
  msgEl.appendChild(msgText);
  if (QUICK && r.total && r.correct === r.total) {                 // 5문제 모두 정답 → PERFECT CLEAR!
    var pc = document.createElement("b");
    pc.className = "b-clear__perfect";
    pc.textContent = "PERFECT CLEAR!";
    msgEl.insertBefore(pc, msgEl.firstChild);
  }

  /* CTA: 다음 스테이지가 있으면 바로 시작, 마지막(Composition)이면 STAGE SELECT */
  function startStage(id) {
    E.set("session", E.KEY.stage, id);
    E.remove("session", E.KEY.run);
    E.remove("session", E.KEY.result);
  }
  var N = QUICK ? null : E.stages.next(S.id), cta = $(".b-clear__btn");
  if (N) {
    cta.textContent = "다음 스테이지로 →";
    cta.setAttribute("href", "game.html");
    cta.addEventListener("click", function () { startStage(N.id); });
  }
  /* 다시 도전: 같은 스테이지 미션 1부터 새 판 */
  $("[data-retry]").addEventListener("click", function () { startStage(S.id); });   // QUICK PLAY = 새 랜덤 5문제

  /* 결과 숫자 (짧은 카운트업) */
  function count(el, to, fmt) {
    if (calm || !to) { el.textContent = fmt(to); return; }
    var t0 = null, D = 700;
    el.textContent = fmt(0);
    function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / D);
      el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    }
    setTimeout(function () { requestAnimationFrame(step); }, 300);
  }
  count($("[data-result-xp]"), r.xp, function (n) { return "+" + n + " XP"; });
  count($("[data-result-combo]"), r.maxCombo, function (n) { return n + " COMBO"; });
  count($("[data-result-correct]"), r.correct, function (n) { return n + " / " + r.total; });

  /* 레벨 진행: 현재 누적 XP(헤더와 같은 값) vs 판 시작 XP */
  var now = E.getXp();
  var start = r.offline && !r.partial ? now : typeof r.xpStart === "number" ? r.xpStart : Math.max(0, now - r.xp);   // 오프라인 판 = 레이스 변화 없음
  var A = E.levelInfo(Math.min(start, now)), B = E.levelInfo(now);
  var up = B.level > A.level;
  var lv = function (n) { return "LV." + E.two(n); };
  var ratio = function (L) { return L.max ? 1 : L.xp / L.need; };
  $("[data-level-text]").textContent = up ? lv(A.level) + " → " + lv(B.level) : lv(B.level);
  var maxNow = B.max && !A.max;                                      // 이번 판에서 LV.10 첫 달성 → 같은 배지 자리에 문구만 변경
  $("[data-lvup]").textContent = maxNow ? "MAX LEVEL ACHIEVED!" : "LEVEL UP!";
  $("[data-lvup]").hidden = !up;
  $("[data-level-xp]").textContent = B.max ? "XP MAX" : "XP " + B.xp + " / " + B.need;
  if (r.offline) {                                                    // 오프라인 플레이: 레이스 XP·레벨 변화 없음 안내
    var off = document.createElement("b");
    off.className = "b-level__off";
    off.textContent = r.partial ? "오프라인 전환 · 일부 랭킹 미반영" : "오프라인 플레이 · 랭킹 미반영";
    $("[data-level-text]").parentNode.insertBefore(off, $("[data-level-text]"));
  }
  var level = $("[data-level]");
  level.classList.toggle("is-up", up);
  level.classList.toggle("is-max", up && maxNow);
  level.setAttribute("aria-label", (up ? $("[data-lvup]").textContent + " " : "") + $("[data-level-text]").textContent + " · " + $("[data-level-xp]").textContent);
  var to = ratio(B), from = up || calm ? (calm ? to : 0) : ratio(A);
  var fill = $("[data-level-fill]");
  fill.style.setProperty("--p", from);
  if (from !== to) {
    requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.setProperty("--p", to); }); });
  }

  $("[data-react-char]").setAttribute("src", E.charImg(r.character || E.getCharacter(), r.total && r.correct / r.total >= 0.6 ? "happy" : "sad"));   // 정답률 60% 이상(메시지 상위 2단계) = 기쁜 표정 · 미만 = 슬픈 표정
  $("[data-react-face]").hidden = true;                                 // 표정은 캐릭터 이미지에 포함
})();
