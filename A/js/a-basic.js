/* EYEQ A안 — TYPOGRAPHY BASIC (Q1 시안 142:1166 · Q2·Q3는 결과 화면(189:1653)의 주제·정답에 맞춰 새로 구성)
   - 정답: Q1 서체 선택 = B · Q2 글자 크기 = B · Q3 자간 비교 = A (결과 시안 기준)
   - 보기를 고르기 전에는 '다음 문제' 비활성 (모바일 시안 Button / Next Disabled)
   - 진행 상태는 탭 단위로 저장 → 새로고침·뒤로가기에도 유지 / 마지막 문제 후 결과 저장 → result.html
*/
(function () {
  "use strict";
  var E = window.EYEQA;
  var QS = [
    { title: "<em>고급스럽고 세련된</em> 카페에 어울리는 서체를 선택해보세요.",
      titleMo: "<em>고급스럽고 세련된</em> 카페에<br />어울리는 서체를 선택해보세요.",
      sub: "아래 보기 중, 카페 브랜드의 이미지에 더 잘 어울리는 서체를 골라주세요.",
      hint: "서체가 전달하는 분위기를 비교해보세요.", hintMo: "서체의 분위기를 비교해보세요.", answer: "B", name: "서체 선택" },
    { title: "<em>가장 중요한 정보</em>가 먼저 보이는 포스터를 선택해보세요.",
      titleMo: "<em>가장 중요한 정보</em>가 먼저 보이는<br />포스터를 선택해보세요.",
      sub: "아래 보기 중, 할인 정보가 더 잘 전달되는 포스터를 골라주세요.",
      hint: "정보의 중요도에 따라 글자 크기에 차이를 줘보세요.", hintMo: "중요한 정보는 더 크게 보여야 해요.", answer: "B", name: "글자 크기" },
    { title: "<em>로고가 자연스럽게</em> 읽히는 자간을 선택해보세요.",
      titleMo: "<em>로고가 자연스럽게</em> 읽히는<br />자간을 선택해보세요.",
      sub: "아래 보기 중, 글자 사이 간격이 더 자연스러운 로고를 골라주세요.",
      hint: "자간이 너무 넓으면 한 단어로 읽기 어려워요.", hintMo: "자간이 넓으면 읽기 어려워요.", answer: "A", name: "자간 비교" }
  ];
  var KEY = E.KEY.basic;
  var st = E.getJSON("session", KEY);
  if (!st || !(st.q >= 1 && st.q <= 3)) st = { q: 1, answers: {} };
  E.setMode("basic");

  var $ = function (s) { return document.querySelector(s); };
  var title = $("[data-q-title]"), sub = $("[data-q-sub]"), hint = $("[data-q-hint]"), num = $("[data-q-num]");
  var bars = document.querySelectorAll("[data-progress] .a-qprog__bar span");
  var prev = $("[data-prev]"), next = $("[data-next]"), nextLabel = $("[data-next-label]"), live = $("[data-live]");

  function save() { E.setJSON("session", KEY, st); }
  function render(announce) {
    var Q = QS[st.q - 1];
    title.innerHTML = '<span class="a-pc">' + Q.title + '</span><span class="a-mo">' + Q.titleMo + "</span>";
    sub.textContent = Q.sub;
    hint.innerHTML = '<span class="a-pc"></span><span class="a-mo"></span>';           // 모바일은 한 줄에 들어가는 짧은 문구
    hint.firstChild.textContent = Q.hint;
    hint.lastChild.textContent = Q.hintMo;
    num.textContent = "Q" + st.q;
    Array.prototype.forEach.call(bars, function (b, i) { b.classList.toggle("is-on", i < st.q); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-q]"), function (g) {
      var on = +g.getAttribute("data-q") === st.q;
      g.hidden = !on;
      Array.prototype.forEach.call(g.querySelectorAll("[data-option]"), function (o) {
        o.setAttribute("aria-checked", on && st.answers[st.q] === o.getAttribute("data-option") ? "true" : "false");
      });
    });
    prev.hidden = st.q === 1;
    next.disabled = !st.answers[st.q];
    nextLabel.textContent = st.q === 3 ? "결과 보기" : "다음 문제";
    if (announce) live.textContent = "Q" + st.q + " / 3. " + title.textContent;
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-option]"), function (o) {
    o.addEventListener("click", function () {
      st.answers[st.q] = o.getAttribute("data-option");
      save();
      render(false);
      live.textContent = "보기 " + st.answers[st.q] + " 선택됨";
    });
  });
  prev.addEventListener("click", function () {
    if (st.q > 1) { st.q -= 1; save(); render(true); }
  });
  next.addEventListener("click", function () {
    if (!st.answers[st.q]) return;
    if (st.q < 3) { st.q += 1; save(); render(true); return; }
    var correct = 0, keys = {};
    QS.forEach(function (Q, i) { keys[i + 1] = Q.answer; if (st.answers[i + 1] === Q.answer) correct += 1; });
    E.setJSON("local", E.KEY.result, { category: "typography", mode: "basic", answers: st.answers, keys: keys, correct: correct, total: 3 });
    E.remove("session", KEY);
    window.location.href = "result.html";
  });

  E.initSwitch("basic", function () { E.remove("session", KEY); });
  render(false);
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    var s = E.getJSON("session", KEY);
    st = s && s.q ? s : { q: 1, answers: {} };
    render(false);
  });
})();
