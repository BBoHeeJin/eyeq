/* EYEQ B안 — MY PAGE
   브라우저 저장 데이터만 읽어 표시 (서버·계정 없음)
   - 레벨·XP: 헤더와 같은 eyeq.b.xp + levelInfo (읽기만, 지급 없음)
   - 플레이 기록: eyeq.b.history (게임 완료 시 b-game.js가 플레이 ID로 1번만 저장)
   - 업적: 기록·레벨로 판정, 얻은 업적은 eyeq.b.badges에 저장해 유지
   - 닉네임: eyeq.b.nickname (최대 12자, 앞뒤 공백 제거)
*/
(function () {
  "use strict";
  var E = window.EYEQ, ST = E.stages;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var esc = function (t) { var d = document.createElement("span"); d.textContent = t; return d.innerHTML; };
  var two = function (n) { return (n < 10 ? "0" : "") + n; };
  var pct = function (c, t) { return t ? Math.round(c / t * 100) : 0; };
  var fmtN = function (n) { return Number(n || 0).toLocaleString("ko-KR"); };
  function fmtT(ms) {                                                   // 3:24.6
    var t = Math.floor(Math.max(0, ms) / 100), m = Math.floor(t / 600), sec = Math.floor(t / 10) % 60;
    return m + ":" + two(sec) + "." + (t % 10);
  }
  var FLAME = '<img class="b-ic" src="assets/b/icon-flame-result.svg" alt="" />';
  var CHEV = '<svg class="b-ic b-mylist__chev" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.5 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var H = E.getHistory().slice().sort(function (a, b) { return b.at - a.at; });   // 최신순
  var cleared = E.getJSON("local", E.KEY.cleared) || [];                           // 기록 저장 이전의 클리어 정보

  /* ---------- 프로필 ---------- */
  var L = E.levelInfo(E.getXp());
  function titleOf(lv) {
    return lv >= 10 ? "EYEQ 마스터" : lv >= 8 ? "디자인 탐정" : lv >= 6 ? "감각 수집가" : lv >= 3 ? "디테일 탐험가" : "관찰 새싹";   // LV.10 만렙 기준
  }
  $("[data-my-char]").setAttribute("src", E.charImg(E.getCharacter()));
  /* 포인트 · 보유 스킨 · 내 스킨 관리(캐릭터 선택 팝업) */
  function renderSkin() {
    var o = $("[data-my-owned]"), t = $("[data-my-skintotal]");
    if (o) o.textContent = E.ownedSkins().length;
    if (t) t.textContent = E.SKINS.length;
    $("[data-my-char]").setAttribute("src", E.charImg(E.getCharacter()));
  }
  renderSkin();
  if (E.skins) {
    E.skins.onChange(renderSkin);
    var mg = $("[data-skin-manage]");
    if (mg) mg.addEventListener("click", function () { E.skins.picker(null, function () { mg.focus(); }); });
  }
  $("[data-title-text]").textContent = titleOf(L.level);
  $("[data-lv-num]").textContent = two(L.level);
  $("[data-lv-xp]").textContent = L.max ? fmtN(E.XP_MAX_TOTAL) + " / " + fmtN(E.XP_MAX_TOTAL) + " XP" : "XP " + L.xp + " / " + L.need;
  var LR = L.max ? 1 : L.xp / L.need;                                 // 이번 레벨 진행률
  /* 누적 XP · 다음 레벨까지 · LV.10까지 남은 XP / 만렙 달성 (막대 아래 한 줄 · 카드 크기 변화 없음) */
  var left = $("[data-lv-left]"), fmt = function (n) { return n.toLocaleString("ko-KR"); }, MAXLV = "LV." + two(E.MAX_LEVEL);
  var R = E.getRace();
  if (left) left.innerHTML = L.max
    ? "<b>MAX LEVEL</b> · LEVEL RACE 완료" + (R && R.final_ms ? " · 공식 기록 " + fmtT(R.final_ms) : "") + '<span class="b-prof__l"> · 이후 플레이는 개인 기록에 쌓여요</span>'
    : "누적 " + fmt(L.total) + ' XP · <span class="b-prof__l">다음 레벨까지 </span><span class="b-prof__s">다음 </span>' + fmt(L.need - L.xp) + " XP · " + MAXLV + "까지 " + fmt(L.toMax) + " XP";
  var bar = $("[data-lv-bar]"), fill = $("[data-lv-fill]");
  if (left) bar.setAttribute("aria-valuetext", left.textContent);
  bar.setAttribute("aria-valuenow", String(L.xp));
  fill.style.setProperty("--p", calm ? LR : 0);
  if (!calm) requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.setProperty("--p", LR); }); });

  /* 닉네임 */
  var getName = E.displayName;
  var view = $("[data-name-view]"), form = $("[data-name-form]"), input = $("[data-name-input]"), err = $("[data-name-err]");
  function showName() { $("[data-nickname]").textContent = getName(); }
  function editing(on) {
    view.hidden = on; form.hidden = !on; err.hidden = true;
    form.classList.toggle("is-in", on);
    if (on) { input.value = getName(); input.focus(); input.select(); }
    else $("[data-name-edit]").focus();
  }
  showName();
  $("[data-name-edit]").addEventListener("click", function () { editing(true); });
  $("[data-name-cancel]").addEventListener("click", function () { editing(false); });
  input.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); editing(false); } });
  input.addEventListener("input", function () { err.hidden = true; });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!E.setNickname(input.value)) { err.hidden = false; input.focus(); return; }
    showName();
    editing(false);
  });

  /* ---------- 플레이 통계 (PLAY STATS · 개인 누적 · 이 브라우저 기록) ---------- */
  var T = E.getTotals(), maxCombo = 0;
  H.forEach(function (r) { maxCombo = Math.max(maxCombo, r.maxCombo || 0); });
  $("[data-stat-plays]").textContent = fmtN(T.plays);
  $("[data-stat-correct]").textContent = fmtN(T.correct);
  $("[data-stat-quick]").textContent = fmtN(T.quick);
  var tm = $("[data-stat-time]"), timed = H.some(function (r) { return r.solveMs > 0; });
  if (!timed) tm.innerHTML = "<b>—</b>";                                  // 풀이 시간 기록 전 플레이만 있음 (가짜 값 없음)
  else {
    var sec = Math.round(T.solveMs / 1000);
    tm.innerHTML = sec >= 60 ? "<b>" + fmtN(Math.floor(sec / 60)) + "</b><small>분</small>" : "<b>" + sec + "</b><small>초</small>";
    tm.setAttribute("aria-label", Math.floor(sec / 60) + "분 " + (sec % 60) + "초");
  }

  /* ---------- 디자인 영역별 기록 (DESIGN SKILLS) ----------
     왼쪽 오각형 레이더(5개 영역 누적 정답률) + 오른쪽 목록(정답률 · 최고 콤보 · 자세히 보기) — 둘 다 같은 데이터(area)
     정답률 = 첫 시도 정답 기준 (스테이지 판 = 그 영역 문제 · QUICK PLAY = 문제별 영역, res 기록이 있는 판만)
     성장 = 처음 10문제 정답률 vs 최근 10문제 정답률 (%p) · 문제 순서 = 플레이 시각 → 판 안의 문제 번호 (실제 순서)
     기록이 없는 영역은 0% + '기록 없음' (임의 값 없음) */
  function go(id) {
    if (id === "quick") { E.startQuick(); return; }                 // QUICK PLAY 기록 → 새 QUICK PLAY
    E.set("session", E.KEY.stage, id); window.location.href = "stage.html";
  }
  var QP = { id: "quick", no: '<svg class="b-bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 2.5L5 13.4h5.6l-1 8.1 8.4-11.2h-5.7z" fill="currentColor"/></svg>', name: "QUICK PLAY" };   // 번호 자리 = 번개 아이콘
  var GROW_N = 10;                                                  // 비교 구간: 처음 10문제 · 최근 10문제
  var area = {};
  ST.list.forEach(function (s) { area[s.id] = { c: 0, t: 0, combo: 0, sp: 0, units: [], series: [], days: [] }; });
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()); }   // sp = 스테이지 판 수 (최고 콤보는 한 영역만 푼 스테이지 판 기준)
  H.slice().reverse().forEach(function (r) {                          // 오래된 → 최근
    var touched = {}, dayAdd = {};
    function unit(id, c, t, i) {
      var a = area[id]; a.units.push({ c: c, t: t, at: r.at, pid: r.id, i: i }); touched[id] = 1;
      var x = dayAdd[id] || (dayAdd[id] = { c: 0, t: 0 }); x.c += c; x.t += t;
    }
    if (r.mode !== "quick" && area[r.stage]) {
      var a = area[r.stage], c = r.correct || 0, t = r.total || 0;
      a.c += c; a.t += t; a.sp += 1; a.combo = Math.max(a.combo, r.maxCombo || 0);
      var ok = Array.isArray(r.res) && r.res.length === t && r.res.filter(Boolean).length === c;   // 문제별 기록이 합계와 맞을 때만 문제 단위
      if (ok) r.res.forEach(function (x, i) { unit(r.stage, x ? 1 : 0, 1, i); });
      else if (t) unit(r.stage, c, t, 0);                           // 예전 기록: 한 판 묶음 (판 안 순서를 만들지 않음)
    } else if (r.mode === "quick" && Array.isArray(r.res) && Array.isArray(r.stages)) {
      r.res.forEach(function (x, i) { var a = area[r.stages[i]]; if (!a) return; a.t += 1; if (x) a.c += 1; unit(r.stages[i], x ? 1 : 0, 1, i); });
    }
    Object.keys(touched).forEach(function (id) { var a = area[id]; a.series.push({ at: r.at, c: a.c, t: a.t }); });
    /* 날마다: 그날 푼 문제(dc/dt) + 그날 끝난 시점의 누적(c/t) — 이 기기 시간대 기준 날짜 */
    var dk = dayKey(r.at);
    Object.keys(dayAdd).forEach(function (id) {
      var a = area[id], D = a.days[a.days.length - 1];
      if (!D || D.key !== dk) { D = { key: dk, at: r.at, dc: 0, dt: 0, c: 0, t: 0 }; a.days.push(D); }
      D.dc += dayAdd[id].c; D.dt += dayAdd[id].t; D.c = a.c; D.t = a.t;
    });
  });

  /* 성장 계산 — 처음 10문제 기준값은 한 번 정해지면 eyeq.b.growth 에 보관 (기록 200판 정리 후에도 같은 기준) */
  var GS = E.getJSON("local", E.KEY.growth); if (!GS || typeof GS !== "object") GS = {};
  var gsDirty = false;
  function take(U, fromEnd) {                                       // 앞(또는 뒤)에서 10문제 이상이 될 때까지
    var c = 0, t = 0, n = 0;
    for (var k = 0; k < U.length && t < GROW_N; k++) { var u = U[fromEnd ? U.length - 1 - k : k]; c += u.c; t += u.t; n++; }
    return { c: c, t: t, n: n };
  }
  function growthOf(id) {
    var a = area[id], U = a.units, base = GS[id], first, rest;
    if (base && base.t >= GROW_N) {
      first = base;
      rest = U.filter(function (u) { return u.at > base.at || (u.pid === base.pid && u.i >= base.upto); });
    } else {
      first = take(U, false);
      rest = U.slice(first.n);
      if (first.t >= GROW_N) {
        var lu = U[first.n - 1];
        var upto = 0; for (var q = 0; q < first.n; q++) if (U[q].pid === lu.pid) upto = Math.max(upto, U[q].i + 1);
        GS[id] = { c: first.c, t: first.t, at: lu.at, pid: lu.pid, upto: upto, saved: Date.now() }; gsDirty = true;
      }
    }
    var last = take(rest, true);
    if (first.t < GROW_N || last.t < GROW_N) return { ok: false, need: Math.max(GROW_N, first.t) + GROW_N };   // 처음 구간 + 최근 10문제
    var a0 = pct(first.c, first.t), a1 = pct(last.c, last.t);
    return { ok: true, a0: a0, a1: a1, d: a1 - a0, n0: first.t, n1: last.t };
  }
  var GR = {};
  ST.list.forEach(function (s) { GR[s.id] = growthOf(s.id); });
  if (gsDirty) E.setJSON("local", E.KEY.growth, GS);

  /* 레이더 차트 (SVG 도형 + HTML 글자 → 작은 화면에서도 글자 크기 유지) */
  var radar = $("[data-radar]");
  var RX = 150, RY = 140, RR = 118, NA = ST.list.length, VW = 300, VH = 262;   // 차트 좌표계 300×262
  function pt(i, v) { var ang = -Math.PI / 2 + i * 2 * Math.PI / NA; return [RX + Math.cos(ang) * RR * v, RY + Math.sin(ang) * RR * v]; }
  function poly(v) { return ST.list.map(function (s, i) { return pt(i, typeof v === "function" ? v(s, i) : v).map(function (n) { return n.toFixed(1); }).join(","); }).join(" "); }
  var rate = function (id) { var a = area[id]; return a.t ? a.c / a.t : 0; };
  var anyData = ST.list.some(function (s) { return area[s.id].t > 0; });
  if (radar) {
    var svg = '<svg class="b-radar__svg" viewBox="0 0 300 262" aria-hidden="true" focusable="false">' +
      '<defs><radialGradient id="b-radar-fill" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="#8f7bff" stop-opacity="0.18"/><stop offset="100%" stop-color="#7c5cff" stop-opacity="0.5"/></radialGradient>' +
      '<linearGradient id="b-radar-line" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#c3b2ff"/><stop offset="100%" stop-color="#7c8cff"/></linearGradient>' +
      '<radialGradient id="b-radar-bg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#3b2f9e" stop-opacity="0.35"/><stop offset="100%" stop-color="#1a1d5c" stop-opacity="0"/></radialGradient></defs>' +
      '<polygon points="' + poly(1) + '" fill="url(#b-radar-bg)"/>';
    [0.2, 0.4, 0.6, 0.8, 1].forEach(function (v) { svg += '<polygon class="b-radar__grid' + (v === 1 ? " is-out" : "") + '" points="' + poly(v) + '"/>'; });
    ST.list.forEach(function (s, i) { var e = pt(i, 1); svg += '<line class="b-radar__axis" x1="' + RX + '" y1="' + RY + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '"/>'; });
    svg += '<polygon class="b-radar__area" points="' + poly(function (s) { return rate(s.id); }) + '" fill="url(#b-radar-fill)" stroke="url(#b-radar-line)"/>';
    ST.list.forEach(function (s, i) { var p = pt(i, rate(s.id)); svg += '<circle class="b-radar__dot' + (area[s.id].t ? "" : " is-none") + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5"/>'; });
    svg += "</svg>";
    /* 글자·눌러 보기: 꼭짓점 바깥 이름표 (HTML, 위치는 % → 차트와 같이 커지고 작아짐) */
    var labels = ST.list.map(function (s, i) {
      var a = area[s.id], q = pt(i, 1.12), d = pt(i, rate(s.id)), side = q[0] < RX - 10 ? " is-l" : q[0] > RX + 10 ? " is-r" : "";
      var tip = s.name + " · " + s.nameKo + " — " + (a.t ? "누적 정답률 " + pct(a.c, a.t) + "% · 맞힌 문제 " + a.c + " · 푼 문제 " + a.t : "기록 없음 (0%)");
      return '<button class="b-radar__lbl' + side + (q[1] > RY ? " is-b" : "") + (a.t ? "" : " is-none") + '" type="button" data-area="' + s.id + '" style="left:' + (q[0] / (VW / 100)).toFixed(2) + "%;top:" + (q[1] / (VH / 100)).toFixed(2) + '%" aria-label="' + tip + ' — 자세히 보기">' +
        '<span class="b-radar__name">' + s.name + '</span><span class="b-radar__val">' + (a.t ? pct(a.c, a.t) + "%" : "0% · 기록 없음") + "</span></button>";
    }).join("");
    /* 꼭짓점 위 투명 터치 영역 (마우스 올리거나 눌렀을 때 툴팁) */
    var hits = ST.list.map(function (s, i) { var d = pt(i, rate(s.id)); return '<span class="b-radar__hit" data-hit="' + s.id + '" style="left:' + (d[0] / (VW / 100)).toFixed(2) + "%;top:" + (d[1] / (VH / 100)).toFixed(2) + '%" aria-hidden="true"></span>'; }).join("");
    radar.innerHTML = '<div class="b-radar__in">' + svg + hits + labels + '<div class="b-radar__tip" role="status" aria-live="polite" hidden data-radar-tip></div>' +
      (anyData ? "" : '<p class="b-radar__empty">아직 기록이 없어요<span>플레이하면 그래프가 채워져요</span></p>') + "</div>";
    var tipEl = radar.querySelector("[data-radar-tip]"), tipFor = null;
    function showTip(id) {
      var s = ST.get(id), a = area[id], i = ST.list.indexOf(s), d = pt(i, rate(id));
      tipEl.innerHTML = "<b>" + s.name + ' <small>' + s.nameKo + "</small></b>" +
        (a.t ? '<span class="b-radar__tipv">' + pct(a.c, a.t) + "<small>%</small></span><span>맞힌 문제 <i>" + fmtN(a.c) + "</i> · 푼 문제 <i>" + fmtN(a.t) + "</i></span>"
             : '<span class="b-radar__tipv">0<small>%</small></span><span>아직 기록이 없어요</span>');
      tipEl.style.left = (d[0] / (VW / 100)) + "%"; tipEl.style.top = (d[1] / (VH / 100)) + "%";
      tipEl.classList.toggle("is-below", d[1] < RY);                  // 위쪽 꼭짓점은 아래로 표시
      tipEl.hidden = false; tipFor = id;
      Array.prototype.forEach.call(radar.querySelectorAll("[data-area]"), function (b) { b.classList.toggle("is-on", b.getAttribute("data-area") === id); });
    }
    function hideTip() { tipEl.hidden = true; tipFor = null; Array.prototype.forEach.call(radar.querySelectorAll("[data-area]"), function (b) { b.classList.remove("is-on"); }); }
    radar.addEventListener("pointerover", function (e) { var h = e.target.closest("[data-hit],[data-area]"); if (h && e.pointerType === "mouse") showTip(h.getAttribute("data-hit") || h.getAttribute("data-area")); });
    radar.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") hideTip(); });
    radar.addEventListener("focusin", function (e) { var h = e.target.closest("[data-area]"); if (h) showTip(h.getAttribute("data-area")); });
    radar.addEventListener("focusout", function () { setTimeout(function () { if (!radar.contains(document.activeElement)) hideTip(); }, 0); });
    radar.addEventListener("click", function (e) {
      var h = e.target.closest("[data-hit]"), l = e.target.closest("[data-area]");
      if (h) { var id = h.getAttribute("data-hit"); if (tipFor === id) hideTip(); else showTip(id); return; }   // 터치: 꼭짓점 누르면 툴팁
      if (l) openArea(l.getAttribute("data-area"), l);                // 이름표 누르면 자세히 보기
    });
    document.addEventListener("click", function (e) { if (tipFor && !radar.contains(e.target)) hideTip(); });
  }

  /* 최고 콤보: 이 영역 스테이지 판의 최고 연속 정답 (QUICK PLAY 콤보는 여러 영역이 섞여 제외 · 스테이지 판이 없으면 —) */
  function comboTxt(a) { return a.sp ? "×" + a.combo : "—"; }

  /* 오른쪽: 영역 5줄 목록(정답률 · 최고 콤보) + 그래프 자세히 보기 — 레이더와 같은 값 (요약 배지 3개는 레이더·목록과 중복이라 삭제)
     strong = 자세히 보기 버튼이 처음 여는 영역 (정답률 가장 높은 영역) */
  var withData = ST.list.filter(function (s) { return area[s.id].t > 0; });
  var byRate = withData.slice().sort(function (x, y) { return rate(y.id) - rate(x.id) || area[y.id].t - area[x.id].t; });
  var strong = byRate[0];
  var bestList = $("[data-best]");
  ST.list.forEach(function (s) {
    var a = area[s.id];
    var li = document.createElement("li");
    li.innerHTML =
      '<button class="b-skill__row' + (a.t ? "" : " is-none") + '" type="button" data-area-open="' + s.id + '">' +
      '<span class="b-skill__no">' + s.no + '</span><span class="b-skill__name">' + s.name + "</span>" +
      '<span class="b-skill__bar" aria-hidden="true"><i style="--p:' + (a.t ? (a.c / a.t).toFixed(3) : 0) + '"></i></span>' +
      '<span class="b-skill__rate">' + (a.t ? pct(a.c, a.t) + "<small>%</small>" : "기록 없음") + "</span>" +
      '<span class="b-skill__combo">' + (a.t ? FLAME + comboTxt(a) : "") + "</span></button>";
    li.firstChild.setAttribute("aria-label", s.no + " " + s.name + (a.t ? " 누적 정답률 " + pct(a.c, a.t) + "% (" + a.c + " / " + a.t + "문제) · 최고 콤보 " + (a.sp ? a.combo : "스테이지 기록 없음") : " 기록 없음 (0%)") + " — 성장 리포트 보기");
    li.firstChild.addEventListener("click", function () { openArea(s.id, li.firstChild); });
    bestList.appendChild(li);
  });
  var skillOpen = $("[data-skill-open]");
  if (skillOpen) skillOpen.addEventListener("click", function () { openArea((strong || ST.list[0]).id, skillOpen); });

  /* ---------- 영역 자세히 보기 (PC 팝업 · 모바일 전체 화면 + 뒤로 가기) — 위쪽 탭으로 영역 바꾸기 ---------- */
  var amEl = $('[data-modal="area"]'), am = E.modal(amEl), amBody = amEl && amEl.querySelector("[data-area-body]"), amPlay = amEl && amEl.querySelector("[data-area-play]"), amFor = null;
  if (amPlay) amPlay.addEventListener("click", function () { if (amFor) go(amFor); });
  var DAYS_MAX = 14;                                                  // 그래프: 플레이한 날 최근 14일
  function md(key) { var p = key.split("-"); return Number(p[1]) + "." + Number(p[2]); }
  /* 정답률 변화: 플레이한 날마다 "그날까지 누적 정답률" 꺾은선 하나 (실제 기록만 · 마지막 점 강조 + 값 표시) */
  function rateChart(a, s) {
    var D = a.days.slice(-DAYS_MAX), n = D.length;
    if (!n) return '<p class="b-area__chartnone">아직 이 영역의 기록이 없어요. 플레이한 날마다 점이 하나씩 생겨요.</p>';
    var narrow = window.matchMedia("(max-width: 767px)").matches;
    var W = narrow ? 340 : 640, Hh = narrow ? 190 : 210, L = 40, R = narrow ? 30 : 40, T = 26, B = 28;
    var pw = W - L - R, ph = Hh - T - B;
    var x = function (i) { return n === 1 ? L + pw / 2 : L + pw * i / (n - 1); }, y = function (v) { return T + ph * (1 - v); };
    var P = D.map(function (d, i) { return [x(i), y(d.c / d.t)]; });
    var every = Math.ceil(n / (narrow ? 5 : 8));
    var out = '<defs><linearGradient id="b-area-stroke" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#6c7bff"/><stop offset="1" stop-color="#b79dff"/></linearGradient></defs>';
    out += [0, 0.5, 1].map(function (v) { return '<line class="b-area__gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="b-area__gt" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v * 100 + "%</text>"; }).join("");
    D.forEach(function (d, i) { if ((n - 1 - i) % every === 0) out += '<text class="b-area__gt" x="' + P[i][0].toFixed(1) + '" y="' + (Hh - 6) + '" text-anchor="middle">' + md(d.key) + "</text>"; });
    if (n > 1) {                                                      // 부드러운 곡선 (Catmull-Rom → 베지어 · 0~100% 밖으로 넘지 않게)
      var cl = function (v) { return Math.max(T, Math.min(T + ph, v)); };
      var dpath = "M" + P[0][0].toFixed(1) + " " + P[0][1].toFixed(1);
      for (var i = 0; i < n - 1; i++) {
        var p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
        dpath += " C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + " " + cl(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + " " + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + " " + cl(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + " " + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
      }
      out += '<path class="b-area__line" d="' + dpath + '"/>';
    }
    P.forEach(function (p, i) { if (i < n - 1) out += '<circle class="b-area__dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5"/>'; });
    var lp = P[n - 1], lv = pct(D[n - 1].c, D[n - 1].t);
    out += '<circle class="b-area__last" cx="' + lp[0].toFixed(1) + '" cy="' + lp[1].toFixed(1) + '" r="6.5"/>';
    out += '<text class="b-area__lastv" x="' + Math.min(lp[0], W - 22).toFixed(1) + '" y="' + (lp[1] - 13).toFixed(1) + '" text-anchor="middle">' + lv + "%</text>";
    var label = D.map(function (d) { return md(d.key) + " 누적 " + pct(d.c, d.t) + "%"; }).join(", ");
    return '<svg class="b-area__svg" viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="' + s.name + " 정답률 변화: " + label + '">' + out + "</svg>" +
      '<p class="b-area__cap">플레이한 날의 누적 정답률' + (a.days.length > DAYS_MAX ? " · 최근 " + DAYS_MAX + "일" : "") + " · 이 기기에 저장된 기록 기준</p>";
  }
  /* 영역 선택 드롭다운 화살표 — 최근 플레이 행 화살표(CHEV, 22행)와 이름이 겹쳐 덮어쓰던 문제 수정 → 별도 이름 */
  var SEL_CHEV = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9.5l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function renderArea(id) {
    var s = ST.get(id), a = area[id], g = GR[id];
    amFor = id;
    var pick = '<label class="b-area__pick"><span class="b-sr-only">디자인 영역 선택</span><select class="b-area__select" data-area-pick>' +
      ST.list.map(function (x) { return '<option value="' + x.id + '"' + (x.id === id ? " selected" : "") + ">" + x.name + "</option>"; }).join("") + "</select>" + SEL_CHEV + "</label>";
    /* 성장 수치: 기존 성장 분석 기준(처음 10문제 ↔ 최근 10문제) 그대로 · 데이터가 모자라면 수치 대신 안내 */
    var delta;
    if (!a.t) delta = '<p class="b-area__delta is-wait">아직 이 영역 기록이 없어요</p>';
    else if (!g.ok) delta = '<p class="b-area__delta is-wait">성장 기록을 모으는 중이에요</p>';
    else delta = '<p class="b-area__delta ' + (g.d > 0 ? "is-up" : g.d < 0 ? "is-down" : "") + '">' + (g.d > 0 ? "↗ +" : g.d < 0 ? "↘ −" : "→ ±") + Math.abs(g.d) + "%p <span>처음 " + g.n0 + "문제 대비</span></p>";
    var prog = "";
    if (!g.ok) {
      var need = g.need || 20, left = Math.max(0, need - a.t);
      prog = '<div class="b-area__prog"><p class="b-area__progmsg">성장 분석까지 ' + left + "문제 남았어요!</p>" +
        '<div class="b-area__progbar"><span aria-hidden="true"><i style="--p:' + Math.min(1, a.t / need).toFixed(3) + '"></i></span><b>' + fmtN(a.t) + " / " + need + "문제</b></div></div>";
    }
    amBody.innerHTML =
      '<div class="b-area__head">' + pick + '<h2 class="b-area__title" id="b-area-title" tabindex="-1">' + s.nameKo + " 감각 성장 기록</h2></div>" +
      '<section class="b-area__kpi" aria-label="핵심 성장 지표"><p class="b-area__klabel">현재 정답률</p>' +
        '<div class="b-area__krow"><p class="b-area__kval">' + (a.t ? pct(a.c, a.t) : 0) + "<small>%</small></p>" + delta + "</div>" +
        '<p class="b-area__meta"><b>' + fmtN(a.t) + "</b>문제 풀이 · <b>" + fmtN(a.c) + "</b>문제 정답 · 최고 콤보 <b>" + (a.sp ? "×" + a.combo : "—") + "</b></p></section>" +
      '<section class="b-area__chart"><h3 class="b-area__h">정답률 변화</h3>' + rateChart(a, s) + "</section>" + prog;
  }
  if (amBody) {
    amBody.addEventListener("change", function (e) {
      var t = e.target.closest("[data-area-pick]"); if (!t) return;
      renderArea(t.value);
      var n = amBody.querySelector("[data-area-pick]"); if (n) n.focus();
    });
  }
  function openArea(id) {
    if (!am || !amBody) return;
    renderArea(id);
    am.open();
    var t = amEl.querySelector(window.matchMedia("(max-width: 1023px)").matches ? "[data-area-back]" : "#b-area-title"); if (t) t.focus();   // PC: 제목에 포커스 (드롭다운 테두리가 열리자마자 보이지 않게)
  }

  /* ---------- 업적 (판정·저장은 b-achieve.js · 여기서는 같은 결과를 그림) ---------- */
  var fresh = E.achieve.check(false), saved = E.achieve.saved(), got = 0, BADGES = E.achieve.list;
  BADGES.forEach(function (b) { if (saved[b.id]) got++; });
  var LOCK = '<img class="b-badge__lock" src="assets/b/icon-lock.svg" alt="" />';
  $("[data-badge-count]").textContent = got + " / " + BADGES.length;
  var grid = $("[data-badges]");
  BADGES.forEach(function (b, i) {
    var on = !!saved[b.id];
    var li = document.createElement("li");
    li.className = "b-badge" + (on ? " is-on" : "") + (fresh.indexOf(b.id) > -1 && !calm ? " is-new" : "");
    var mark = !on ? LOCK : E.achieve.mark(b);
    li.innerHTML =
      '<button class="b-badge__btn" type="button" aria-describedby="b-tip-' + i + '">' +
      '<span class="b-badge__hex" aria-hidden="true"><span class="b-badge__in">' + mark + '</span></span>' +
      '<span class="b-badge__name">' + b.name + '</span></button>' +
      '<span class="b-badge__tip" role="tooltip" id="b-tip-' + i + '"><b>' + (on ? "획득 완료" : "미획득") + '</b>' + b.cond + "</span>";
    li.setAttribute("data-badge-id", b.id);
    li.firstChild.setAttribute("aria-label", b.name + " — " + (on ? "획득" : "잠김") + " · 나의 업적 보기");
    li.firstChild.setAttribute("aria-haspopup", "dialog");
    grid.appendChild(li);
  });
  /* 업적 누르면 '나의 업적' 창 (누른 업적 위치로) — 알림의 '전체 업적 보기'와 같은 창 */
  grid.addEventListener("click", function (e) {
    var li = e.target.closest(".b-badge");
    Array.prototype.forEach.call(grid.children, function (x) { x.classList.remove("is-tip"); });
    if (li) E.achieve.openList(li.getAttribute("data-badge-id"));
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-badges]")) Array.prototype.forEach.call(grid.children, function (x) { x.classList.remove("is-tip"); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") Array.prototype.forEach.call(grid.children, function (x) { x.classList.remove("is-tip"); });
  });

  /* ---------- 최근 플레이 · 전체 기록 ---------- */
  function when(t) {
    var d = new Date(t);
    return '<span class="b-y">' + d.getFullYear() + ".</span>" + two(d.getMonth() + 1) + "." + two(d.getDate()) + " " + two(d.getHours()) + ":" + two(d.getMinutes());
  }
  function row(r, link) {
    var s = r.stage === "quick" ? QP : ST.get(r.stage), perfect = r.correct === r.total;
    var inner =
      '<span class="b-mylist__no' + (s.id === "quick" ? " is-quick" : "") + '">' + s.no + '</span>' +
      '<span class="b-mylist__main"><span class="b-mylist__name">' + esc(s.name) + '</span><span class="b-mylist__sub"><time class="b-mylist__date" datetime="' + new Date(r.at).toISOString() + '">' + when(r.at) + '</time>' +
      (perfect ? '<span class="b-perfect b-perfect--sub" aria-hidden="true">PERFECT</span>' : "") + '</span></span>' +
      '<span class="b-mylist__score"><b>' + r.correct + '</b> / ' + r.total + '</span>' +
      '<span class="b-mylist__xp">+' + r.xp + ' XP</span>' +
      '<span class="b-mylist__tag">' + (perfect ? '<span class="b-perfect">PERFECT</span>' : "") + '</span>';
    var li = document.createElement("li");
    if (link) {
      li.innerHTML = '<button class="b-mylist__row" type="button">' + inner + CHEV + "</button>";
      li.firstChild.setAttribute("aria-label", s.no + " " + s.name + " " + when(r.at).replace(/<[^>]+>/g, "") + " · " + r.correct + " / " + r.total + " · +" + r.xp + " XP" + (perfect ? " · PERFECT" : "") + " — 스테이지로 이동");
      li.firstChild.addEventListener("click", function () { go(s.id); });
    } else {
      li.innerHTML = '<div class="b-mylist__row">' + inner + "</div>";
    }
    return li;
  }
  function empty(ul) {
    var li = document.createElement("li");
    li.className = "b-mylist__empty";
    li.textContent = "아직 플레이 기록이 없어요.";
    ul.appendChild(li);
  }
  var recent = $("[data-recent]");
  if (!H.length) empty(recent);
  H.slice(0, 3).forEach(function (r) { recent.appendChild(row(r, true)); });

  /* ---------- 성장 추이 (MY PROGRESS): 최근 플레이 정답률 변화 (오래된 → 최근) ---------- */
  var prog = $('[data-pane="progress"]'), P = H.slice(0, 12).reverse();
  if (P.length < 2) prog.innerHTML = '<p class="b-mypane__empty">2판 이상 플레이하면 정답률 변화를 보여 드려요.</p>';
  else {
    var avg = function (L) { var c = 0, t = 0; L.forEach(function (r) { c += r.correct; t += r.total; }); return pct(c, t); };
    var k = Math.min(3, Math.floor(P.length / 2)), a0 = avg(P.slice(0, k)), a1 = avg(P.slice(-k));
    var bars = P.map(function (r, i) {
      var v = pct(r.correct, r.total);
      return '<li class="b-trend__bar' + (r.stage === "quick" ? " is-quick" : "") + '" style="--p:' + (v / 100) + '"><span class="b-trend__v">' + v + '</span><i></i><span class="b-trend__n">' + (i + 1) + "</span></li>";
    }).join("");
    prog.innerHTML =
      '<p class="b-trend__cap">최근 ' + P.length + '판 정답률 <span>처음 ' + k + '판 평균 <b>' + a0 + '%</b> → 최근 ' + k + '판 평균 <b>' + a1 + '%</b></span></p>' +
      '<ol class="b-trend" aria-label="최근 ' + P.length + '판 정답률 (오래된 순): ' + P.map(function (r) { return pct(r.correct, r.total) + "%"; }).join(", ") + '">' + bars + "</ol>";
  }

  /* ---------- 최고 기록 (PERSONAL BEST) ---------- */
  var pb = $('[data-pane="best"]');
  if (!H.length) pb.innerHTML = '<p class="b-mypane__empty">아직 플레이 기록이 없어요.</p>';
  else {
    var bRate = H.slice().sort(E.compareRecords)[0], bXp = H.reduce(function (a, r) { return r.xp > a.xp ? r : a; }, H[0]);
    var timedR = H.filter(function (r) { return r.solveMs > 0 && r.total; });
    var fast = timedR.reduce(function (a, r) { return !a || r.solveMs / r.total < a.solveMs / a.total ? r : a; }, null);
    var nm = function (r) { return r.stage === "quick" ? "QUICK PLAY" : ST.get(r.stage).name; };
    var tile = function (label, val, sub) { return '<div class="b-pb__tile"><dt>' + label + "</dt><dd>" + val + "</dd><p>" + sub + "</p></div>"; };
    pb.innerHTML = '<dl class="b-pb">' +
      tile("최고 정답률", pct(bRate.correct, bRate.total) + "<small>%</small>", esc(nm(bRate)) + " · " + bRate.correct + " / " + bRate.total) +
      tile("최고 콤보", '<small class="b-stats__x">×</small>' + maxCombo, "한 판 연속 정답") +
      tile("최고 획득 XP", "+" + fmtN(bXp.xp) + "<small>XP</small>", esc(nm(bXp)) + " · 1판") +
      tile("가장 빠른 풀이", fast ? (fast.solveMs / fast.total / 1000).toFixed(1) + "<small>초</small>" : "—", fast ? "문제당 평균 · " + esc(nm(fast)) : "풀이 시간 기록 후 표시") +
      "</dl>";
  }

  /* ---------- 탭 (최근 플레이 · 성장 추이 · 최고 기록) — 같은 카드 크기 안에서 전환 ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-tab]")), more = $("[data-history-open]");
  function selectTab(btn, focus) {
    tabs.forEach(function (t) {
      var on = t === btn;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      $('[data-pane="' + t.getAttribute("data-tab") + '"]').hidden = !on;
    });
    more.style.visibility = btn.getAttribute("data-tab") === "recent" ? "" : "hidden";   // 자리 유지
    if (focus) btn.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { selectTab(t); });
    t.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      selectTab(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length], true);
    });
  });

  var all = $("[data-history]"), hm = E.modal($('[data-modal="history"]'));
  $("[data-history-sub]").textContent = H.length ? "최신순 · 총 " + H.length + "회" : "";
  if (!H.length) empty(all);
  H.forEach(function (r) { all.appendChild(row(r, false)); });
  $("[data-history-open]").addEventListener("click", function () { all.scrollTop = 0; hm.open(); });
})();
