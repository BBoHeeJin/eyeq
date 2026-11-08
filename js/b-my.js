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

  /* ---------- 디자인 영역별 기록 (DESIGN SKILLS): 누적 정답률(첫 시도 기준) · 최고 콤보 ----------
     스테이지 판 = 그 영역 3문제 · QUICK PLAY = 문제별 영역(res 기록이 있는 판만) */
  function go(id) {
    if (id === "quick") { E.startQuick(); return; }                 // QUICK PLAY 기록 → 새 QUICK PLAY
    E.set("session", E.KEY.stage, id); window.location.href = "stage.html";
  }
  var QP = { id: "quick", no: '<svg class="b-bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 2.5L5 13.4h5.6l-1 8.1 8.4-11.2h-5.7z" fill="currentColor"/></svg>', name: "QUICK PLAY" };   // 번호 자리 = 번개 아이콘
  var best = E.bestByStage(H), area = {};
  ST.list.forEach(function (s) { area[s.id] = { c: 0, t: 0 }; });
  H.forEach(function (r) {
    if (r.mode !== "quick" && area[r.stage]) { area[r.stage].c += r.correct || 0; area[r.stage].t += r.total || 0; }
    else if (r.mode === "quick" && Array.isArray(r.res) && Array.isArray(r.stages)) {
      r.res.forEach(function (ok, i) { var a = area[r.stages[i]]; if (a) { a.t += 1; if (ok) a.c += 1; } });
    }
  });
  var bestList = $("[data-best]");
  ST.list.forEach(function (s) {
    var b = best[s.id], a = area[s.id];
    var li = document.createElement("li");
    li.innerHTML =
      '<button class="b-mylist__row" type="button">' +
      '<span class="b-mylist__no">' + s.no + '</span>' +
      '<span class="b-mylist__name">' + s.name + '</span>' +
      (a.t ? '<span class="b-mylist__meter" aria-hidden="true"><i style="--p:' + (a.c / a.t).toFixed(3) + '"></i></span>' +
             '<span class="b-mylist__rate">' + pct(a.c, a.t) + '<small>%</small></span>' +
             '<span class="b-mylist__combo">' + FLAME + '×' + (b ? b.maxCombo || 0 : 0) + '</span>'
           : '<span class="b-mylist__none">기록 없음</span>') +
      CHEV + '</button>';
    li.firstChild.setAttribute("aria-label", s.no + " " + s.name + (a.t ? " 누적 정답률 " + pct(a.c, a.t) + "% (" + a.c + " / " + a.t + "문제) · 최고 콤보 " + (b ? b.maxCombo || 0 : 0) : " 기록 없음") + " — 스테이지로 이동");
    li.firstChild.addEventListener("click", function () { go(s.id); });
    bestList.appendChild(li);
  });

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
      tile("최고 획득 XP", "+" + bXp.xp + "<small> XP</small>", esc(nm(bXp)) + " · 1판") +
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
