/* EYEQ A안 — TYPOGRAPHY PRO Q1 에디터 (183:1520 / 211:1938)
   - 포스터 텍스트(칩 또는 포스터에서 직접 선택) → 글자 크기·굵기·자간·행간·정렬 조절, 초기화
   - 시작 값 = Figma 변수 pro/q1/<텍스트>/size·lineheight·letterspacing 기본값 (굵기 Medium, 상세 문구 Regular, 가운데 정렬)
   - PRO 다음 문제·결과 화면은 시안에 없음 → '다음 문제'는 Coming Soon
   - '다음 문제'는 한 번이라도 수정한 뒤 활성 (모바일 시안 Disabled 상태 · 구현 제안)
*/
(function () {
  "use strict";
  var E = window.EYEQA;
  var DEF = {
    brand:    { size: 18, leading: 26, spacing: 1, weight: 500, align: "center" },
    event:    { size: 18, leading: 26, spacing: 1, weight: 500, align: "center" },
    discount: { size: 20, leading: 28, spacing: 0, weight: 500, align: "center" },
    date:     { size: 17, leading: 24, spacing: 0, weight: 500, align: "center" },
    time:     { size: 17, leading: 24, spacing: 0, weight: 500, align: "center" },
    desc:     { size: 15, leading: 22, spacing: 0, weight: 400, align: "center" }
  };
  var NAMES = { brand: "CAFE MELLOW", event: "WEEKEND EVENT", discount: "모든 음료 30% 할인", date: "10.17 - 10.19", time: "오전 10시 - 오후 8시", desc: "상세 문구" };
  var RANGE = { size: [10, 64, 1], spacing: [-2, 10, 0.5], leading: [12, 84, 1] };
  var KEY = E.KEY.pro;
  function fresh() { return { sel: "brand", t: JSON.parse(JSON.stringify(DEF)), changed: false }; }
  var st = E.getJSON("session", KEY);
  if (!st || !st.t || !st.t.brand) st = fresh();
  E.setMode("pro");

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return document.querySelectorAll(s); };
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var live = $("[data-live]"), next = $("[data-next]");

  function save() { E.setJSON("session", KEY, st); }
  function fmt(v) { return (Math.round(v * 10) / 10).toString(); }
  function render() {
    var cur = st.t[st.sel];
    each($$("[data-text]"), function (el) {
      var k = el.getAttribute("data-text"), s = st.t[k];
      el.style.setProperty("--size", s.size);
      el.style.setProperty("--leading", s.leading);
      el.style.setProperty("--spacing", s.spacing);
      el.style.setProperty("--weight", s.weight);
      el.style.setProperty("--align", s.align);
      el.classList.toggle("is-selected", k === st.sel);
      el.setAttribute("aria-pressed", k === st.sel ? "true" : "false");
    });
    each($$("[data-chip]"), function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-chip") === st.sel ? "true" : "false"); });
    each($$("[data-slider]"), function (sl) {
      var k = sl.getAttribute("data-slider"), r = RANGE[k];
      sl.value = cur[k];
      sl.style.setProperty("--fill", ((cur[k] - r[0]) / (r[1] - r[0]) * 100) + "%");
      sl.setAttribute("aria-valuetext", fmt(cur[k]) + "px");
    });
    each($$("[data-val]"), function (v) { v.textContent = fmt(cur[v.getAttribute("data-val")]); });
    each($$("[data-weight]"), function (b) { b.setAttribute("aria-pressed", +b.getAttribute("data-weight") === cur.weight ? "true" : "false"); });
    each($$("[data-align]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-align") === cur.align ? "true" : "false"); });
    var mc = $("[data-mchip]");
    if (mc) mc.textContent = NAMES[st.sel];
    next.disabled = !st.changed;
  }
  function select(k) { st.sel = k; save(); render(); live.textContent = NAMES[k] + " 선택"; }
  function change(prop, v) {
    if (RANGE[prop]) { var r = RANGE[prop]; v = Math.min(r[1], Math.max(r[0], Math.round(v / r[2]) * r[2])); }
    st.t[st.sel][prop] = v;
    st.changed = true;
    save();
    render();
  }

  each($$("[data-text]"), function (el) { el.addEventListener("click", function () { select(el.getAttribute("data-text")); }); });
  each($$("[data-chip]"), function (c) { c.addEventListener("click", function () { select(c.getAttribute("data-chip")); }); });
  each($$("[data-slider]"), function (sl) {
    sl.addEventListener("input", function () { change(sl.getAttribute("data-slider"), parseFloat(sl.value)); });
  });
  each($$("[data-step]"), function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-step");
      change(k, st.t[st.sel][k] + RANGE[k][2] * +b.getAttribute("data-dir"));
    });
  });
  each($$("[data-weight]"), function (b) { b.addEventListener("click", function () { change("weight", +b.getAttribute("data-weight")); }); });
  each($$("[data-align]"), function (b) { b.addEventListener("click", function () { change("align", b.getAttribute("data-align")); }); });
  $("[data-reset]").addEventListener("click", function () {
    var sel = st.sel;
    st = fresh(); st.sel = sel;
    save(); render();
    live.textContent = "모든 텍스트를 처음 상태로 되돌렸어요.";
  });
  next.addEventListener("click", function () {
    if (next.disabled) return;
    E.soon(next.getAttribute("data-soon-msg"));
  });

  E.initSwitch("pro", function () { E.remove("session", KEY); });
  render();
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    var s = E.getJSON("session", KEY);
    st = s && s.t ? s : fresh();
    render();
  });
})();
