/* EYEQ B안 — GAME PLAY (Typography · 미션 3개)
   규칙 출처: Figma Game Board(330:6486) 컴포넌트 설명
   - 정답: M1=B(자간), M2=C(굵기), M3=B(크기)
   - XP: 정답 30 → 40 → 50 (연속 정답 콤보), 오답 +5 (미션당 최초 1회, 재시도 오답은 0 · 배지 숨김)
   - 오답 시 콤보 0, '다시 도전하기' = 같은 미션 재시도(Attempt=Retry)
   - 정답 확인 시 헤더 XP 가산
   상태 = { mission, streak, attempt, selected, phase } + 기록 (sessionStorage, 새로고침 유지)
*/
(function () {
  "use strict";
  var E = window.EYEQ;

  var MISSIONS = [
    { desc: "세 가지 중 글자 간격이 다른 하나를 선택하세요.", answer: "B", copy: { A: "",        B: "is-wide", C: "" } },
    { desc: "세 가지 중 글자 굵기가 다른 하나를 선택하세요.", answer: "C", copy: { A: "is-regular", B: "is-regular", C: "" } },
    { desc: "세 가지 중 글자 크기가 다른 하나를 선택하세요.", answer: "B", copy: { A: "is-small", B: "",        C: "is-small" } }
  ];
  var XP_CORRECT = [30, 40, 50];   // 콤보 1·2·3
  var XP_WRONG = 5;
  var LETTERS = ["A", "B", "C"];

  /* ---------- 상태 ---------- */
  function fresh() {
    return {
      stage: "typography", mission: 1, streak: 0, attempt: "first", selected: null, phase: "default",
      wrongRewarded: {}, firstTry: {}, xpGained: 0, maxCombo: 0, last: null, done: false
    };
  }
  var st = E.getJSON("session", E.KEY.run);
  if (!st || st.stage !== "typography" || !(st.mission >= 1 && st.mission <= 3)) st = fresh();
  function save() { E.setJSON("session", E.KEY.run, st); }
  save();

  /* ---------- 요소 ---------- */
  var $ = function (s) { return document.querySelector(s); };
  var root = $("[data-game]");
  var progress = $("[data-progress]");
  var badge = $("[data-mission-badge]");
  var title = $("[data-title]");
  var desc = $("[data-mission-desc]");
  var fb = $("[data-feedback]");
  var answers = $(".b-answers");
  var cards = root.querySelectorAll(".b-ans");
  var action = $("[data-action]");
  var live = $("[data-live]");

  /* 답안 카드 내부 (모든 선택지 동일 문구) */
  Array.prototype.forEach.call(cards, function (el) {
    var L = el.getAttribute("data-letter");
    el.innerHTML =
      '<span class="b-ans__badge">' + L + "</span>" +
      '<span class="b-ans__copy"><span class="b-ans__kr"><span>좋은 디자인은</span><span>보는 눈에서</span><span>시작된다.</span></span>' +
      '<span class="b-ans__en"><span>GOOD DESIGN STARTS</span><span>WITH A KEEN EYE.</span></span></span>' +
      '<span class="b-ans__status b-ans__status--check"><img class="b-pc" src="assets/b/card-check.svg" alt="" /><img class="b-mo" src="assets/b/card-check-mobile.svg" alt="" /></span>' +
      '<span class="b-ans__status b-ans__status--x"><img class="b-pc" src="assets/b/card-x.svg" alt="" /><img class="b-mo" src="assets/b/card-x-mobile.svg" alt="" /></span>';
    el.addEventListener("click", function () { pick(L); });
  });

  /* ---------- 렌더 ---------- */
  function render(animate) {
    var m = MISSIONS[st.mission - 1];
    var completed = st.mission === 3 && st.phase === "correct";

    // Mission Progress: 현재 = 링, 완료 = 체크, 예정 = 비활성
    var fill = completed ? 1 : (st.mission - 1) / 2;
    progress.style.setProperty("--fill", fill);
    for (var i = 1; i <= 3; i++) {
      var node = progress.querySelector('[data-node="' + i + '"]');
      var label = progress.querySelector('[data-label="' + i + '"]');
      var done = i < st.mission || completed;
      var cur = !done && i === st.mission;
      node.classList.toggle("is-done", done);
      node.classList.toggle("is-current", cur);
      label.classList.toggle("is-on", done || cur);
    }

    badge.textContent = "MISSION 0" + st.mission + " / 03";
    desc.textContent = m.desc;

    var showFb = st.phase === "correct" || st.phase === "wrong";
    title.hidden = showFb;
    fb.hidden = !showFb;
    if (showFb) renderFeedback(animate);

    // 답안 카드 상태
    var locked = showFb;
    answers.classList.toggle("is-locked", locked);
    Array.prototype.forEach.call(cards, function (el) {
      var L = el.getAttribute("data-letter");
      var copy = el.querySelector(".b-ans__copy");
      copy.className = "b-ans__copy " + (m.copy[L] || "");
      var isSel = st.selected === L;
      el.classList.toggle("is-selected", st.phase === "selected" && isSel);
      el.classList.toggle("is-correct", st.phase === "correct" && isSel);
      el.classList.toggle("is-wrong", st.phase === "wrong" && isSel);
      el.classList.toggle("is-dim", st.phase === "selected" && !isSel);
      el.classList.toggle("is-faded", st.phase === "correct" && !isSel);
      el.setAttribute("aria-checked", isSel && st.phase !== "default" ? "true" : "false");
      el.setAttribute("aria-label", "보기 " + L);
      if (locked) el.setAttribute("aria-disabled", "true"); else el.removeAttribute("aria-disabled");
    });

    // 게임 버튼: Disabled(미선택) / Active(선택·다음) / Secondary(다시 도전)
    action.classList.remove("is-active", "is-secondary");
    action.disabled = false;
    if (st.phase === "default") { action.textContent = "정답 확인하기 →"; action.disabled = true; }
    else if (st.phase === "selected") { action.textContent = "정답 확인하기 →"; action.classList.add("is-active"); }
    else if (st.phase === "correct") { action.textContent = st.mission === 3 ? "결과 보기 →" : "다음 문제로 →"; action.classList.add("is-active"); }
    else { action.textContent = "다시 도전하기 →"; action.classList.add("is-secondary"); }
  }

  function renderFeedback(animate) {
    var last = st.last || { correct: true, combo: 1, xp: 30 };
    var type = !last.correct ? "wrong" : last.combo >= 3 ? "combo3" : last.combo === 2 ? "combo2" : "correct";
    fb.setAttribute("data-type", type);
    fb.querySelector("[data-fb-title]").textContent =
      type === "wrong" ? "TRY AGAIN!" : type === "combo3" ? "AMAZING!" : type === "combo2" ? "PERFECT!" : "GREAT!";
    fb.querySelector("[data-fb-flame]").hidden = type.indexOf("combo") !== 0;
    var combo = fb.querySelector("[data-fb-combo]");
    combo.hidden = type.indexOf("combo") !== 0;
    combo.textContent = Math.min(last.combo, 3) + " COMBO";
    var xp = fb.querySelector("[data-fb-xp]");
    xp.hidden = last.xp <= 0;                       // 재시도 오답: XP 배지 숨김
    xp.textContent = "+" + last.xp + " XP";
    xp.classList.toggle("is-red", !last.correct);
    var ch = E.getCharacter().toLowerCase();
    fb.querySelector("[data-react-char]").setAttribute("src", "assets/b/char-" + ch + ".png");
    fb.querySelector("[data-react-face]").setAttribute("src", "assets/b/expression-" + ch + "-" + (last.correct ? "happy" : "sad") + ".svg");
    if (animate) {
      fb.classList.remove("is-in");
      void fb.offsetWidth;
      fb.classList.add("is-in");
    }
  }

  /* ---------- 동작 ---------- */
  function pick(L) {
    if (st.phase === "correct" || st.phase === "wrong") return;
    st.selected = L;
    st.phase = "selected";
    save();
    render(false);
  }

  function check() {
    var m = MISSIONS[st.mission - 1];
    var correct = st.selected === m.answer;
    var gained;
    if (correct) {
      st.streak += 1;
      gained = XP_CORRECT[Math.min(st.streak, 3) - 1];
      st.maxCombo = Math.max(st.maxCombo, st.streak);
      if (st.attempt === "first") st.firstTry[st.mission] = true;
      st.phase = "correct";
    } else {
      st.streak = 0;
      gained = st.wrongRewarded[st.mission] ? 0 : XP_WRONG;
      st.wrongRewarded[st.mission] = true;
      st.phase = "wrong";
    }
    st.xpGained += gained;
    st.last = { correct: correct, combo: correct ? st.streak : 0, xp: gained };
    if (gained) E.addXp(gained);
    save();
    render(true);
    live.textContent = correct
      ? "정답입니다. " + gained + " XP를 얻었어요."
      : "오답입니다." + (gained ? " " + gained + " XP를 얻었어요." : "") + " 다시 도전해 보세요.";
  }

  function next() {
    if (st.mission === 3) {
      var correctCount = 0;
      for (var i = 1; i <= 3; i++) if (st.firstTry[i]) correctCount++;
      st.done = true;
      save();
      E.setJSON("session", E.KEY.result, {
        stage: "typography", character: E.getCharacter(),
        xp: st.xpGained, maxCombo: st.maxCombo, correct: correctCount, total: 3
      });
      window.location.href = "result.html";
      return;
    }
    st.mission += 1;
    st.attempt = "first";
    st.selected = null;
    st.phase = "default";
    st.last = null;
    save();
    render(false);
    live.textContent = "미션 " + st.mission + " / 3. " + MISSIONS[st.mission - 1].desc;
  }

  function retry() {
    st.attempt = "retry";
    st.selected = null;
    st.phase = "default";
    st.last = null;
    save();
    render(false);
    live.textContent = "같은 미션을 다시 풀어 보세요.";
  }

  action.addEventListener("click", function () {
    if (st.phase === "selected") check();
    else if (st.phase === "correct") next();
    else if (st.phase === "wrong") retry();
  });

  render(false);
  // 뒤로 가기 캐시 복귀 시 저장 상태로 다시 그림
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    var saved = E.getJSON("session", E.KEY.run);
    if (saved) { st = saved; render(false); }
  });
})();
