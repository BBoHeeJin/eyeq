/* EYEQ B안 — RANKING · LEVEL RACE 온라인 순위 (STEP 4)
   데이터: Supabase get_leaderboard(공개) · get_my_rank(내 순위) — 서버가 정렬한 순위를 그대로 표시 (가짜 사용자·기록 없음)
   - 순위(서버 규칙): LV.10 달성자 = 확정 플레이 시간 짧은 순 → 달성 시각 / 도전 중 = 레벨 → XP → 플레이 시간
   - TOP 5 = 전체 순위 1~5위 그대로 (같은 기준 · 아무도 건너뛰거나 앞당기지 않음)
            검토 중 = '검증 중' 상태만 표시 ('인증 필요' 표시는 사용 안 함 — 경품 대상 본인 확인은 운영에서 별도)
            5명 모두 LV.10 달성 전이면 '잠정 순위'
   - 실시간: 20초마다 · 탭으로 돌아올 때 다시 조회 (화면이 안 보이는 동안은 멈춤)
   - 닉네임은 textContent 로만 넣음 (HTML 해석 없음)
*/
(function () {
  "use strict";
  var E = window.EYEQ, OL = E.online;
  var $ = function (s) { return document.querySelector(s); };
  var two = function (n) { return (n < 10 ? "0" : "") + n; };
  var CHARS = ["FOCUS", "EYE", "SPARK"];
  var COLORS = ["gold", "silver", "bronze", "blue", "purple"];   // TOP 5 색 (1~5위)
  var LIMIT = 100, EVERY = 20000;
  var MAXLV = "LV." + two(E.MAX_LEVEL);                         // 만렙 표기 (b-common.js 기준표와 같은 값 · LV.10)

  var listEl = $("[data-rank-list]"), mineEl = $("[data-rank-mine]"), myEl = $("[data-rank-my]");
  var podEl = $("[data-rank-top3]"), runEl = $("[data-rank-runners]"), noteEl = $("[data-rank-note]"), provEl = $("[data-rank-prov]");
  var updEl = $("[data-rank-updated]");
  var view = "all", data = null, mine = null, failed = false;

  /* ---------- 표시 형식 ---------- */
  function avatarOf(a) { return E.charImg(CHARS.indexOf(a) > -1 ? a : "EYE"); }
  function fmtTime(ms) {                                        // 12:34.5 / 1:02:03
    ms = Math.max(0, ms || 0);
    var t = Math.floor(ms / 100), ds = t % 10, s = Math.floor(t / 10) % 60, m = Math.floor(t / 600) % 60, h = Math.floor(t / 36000);
    return h ? h + ":" + two(m) + ":" + two(s) : m + ":" + two(s) + "." + ds;
  }
  function num(n) { return Number(n || 0).toLocaleString("ko-KR"); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function chip(cls, text) { return el("span", "b-rk__chip " + cls, text); }
  function crown(place) {                                       // TOP 5 자리 표시 (1~3 왕관 · 4~5 원형 배지)
    var s = el("span", (place <= 3 ? "b-crown" : "b-rk__place") + " is-" + place);
    s.innerHTML = place <= 3 ? '<svg viewBox="0 0 32 28" aria-hidden="true"><path d="M3 9l7 6 6-11 6 11 7-6-3 16H6z" fill="currentColor"/></svg><b>' + place + "</b>" : "<b>" + place + "</b>";
    return s;
  }

  /* ---------- TOP 5 = 전체 순위 1~5위 ---------- */
  function top5(rows) { return rows.filter(function (r) { return r.rank <= 5; }); }
  function statusChips(r, box, one) {                          // 검증 중 (TOP 5 · 순위표 · MY RANK 공통 문구)
    if (one) { if (r.review) box.appendChild(chip("is-rev", "검증 중")); return; }   // 좁은 자리(시상대·4~5위)
    if (r.review) box.appendChild(chip("is-rev", "검증 중"));
  }

  /* ---------- 순위표 행 ---------- */
  function row(r, place, isMine) {
    var d = el("div", "b-rrow b-rk__row" + (r.maxed ? " is-max" : "") + (r.is_me || isMine ? " is-me" : "") + (place ? " is-top is-" + COLORS[place - 1] : "") + (isMine ? " b-rrow--mine" : ""));
    d.setAttribute("role", "row");
    var rk = el("span", "b-rrow__rank"); rk.setAttribute("role", "cell");
    if (isMine) rk.appendChild(el("small", "b-rrow__mine-label", "내 순위"));
    if (place) rk.appendChild(crown(place));                    // 1~5위 = 같은 숫자의 왕관·배지 (순위 숫자 하나만)
    else rk.appendChild(el("span", "b-rrow__num", String(r.rank)));
    d.appendChild(rk);

    var who = el("span", "b-rrow__stage"); who.setAttribute("role", "cell");
    var av = el("span", "b-rk__ava"); var im = el("img"); im.src = avatarOf(r.avatar); im.alt = ""; av.appendChild(im); who.appendChild(av);
    var w = el("span", "b-rrow__who");
    w.appendChild(el("span", "b-rrow__name", r.nickname || "EYEQPlayer"));
    var tags = el("span", "b-rrow__date b-rk__tags");
    if (r.is_me || isMine) tags.appendChild(chip("is-me", "나"));
    statusChips(r, tags);
    if (tags.childNodes.length) w.appendChild(tags);
    who.appendChild(w);
    d.appendChild(who);

    var lv = el("span", "b-rrow__cor", "LV." + two(r.level)); lv.setAttribute("role", "cell"); d.appendChild(lv);
    var xp = el("span", "b-rrow__rate"); xp.setAttribute("role", "cell");
    if (r.maxed) xp.textContent = "MAX"; else { xp.textContent = num(r.xp); xp.appendChild(el("small", "", " XP")); }
    d.appendChild(xp);
    var stt = el("span", "b-rrow__combo"); stt.setAttribute("role", "cell");
    stt.appendChild(el("span", "b-rchip b-rk__state" + (r.maxed ? " is-max" : ""), r.maxed ? MAXLV + " 달성" : "도전 중"));
    d.appendChild(stt);
    var tm = el("span", "b-rrow__xp b-rk__time", fmtTime(r.time_ms)); tm.setAttribute("role", "cell"); d.appendChild(tm);

    d.setAttribute("aria-label", r.rank + "위 " + (r.nickname || "") + " · LV." + two(r.level) + " · " + (r.maxed ? MAXLV + " 달성 · 기록 " : "XP " + r.xp + " · 플레이 시간 ") + fmtTime(r.time_ms) +
      (place ? " · TOP 5" : "") + (r.review ? " · 검증 중" : ""));
    return d;
  }

  function message(text, retry) {
    var p = el("p", "b-rtable__empty", text);
    if (retry) {
      var b = el("button", "b-rk__retry", "다시 불러오기"); b.type = "button";
      b.addEventListener("click", function () { load(true); });
      p.appendChild(b);
    }
    return p;
  }

  function renderList() {
    listEl.innerHTML = "";
    listEl.setAttribute("aria-busy", data ? "false" : "true");
    if (!data) { listEl.appendChild(message(failed ? "순위를 불러오지 못했어요. 인터넷 연결을 확인해 주세요." : "순위를 불러오는 중이에요…", failed)); return; }
    var rows = data.filter(function (r) { return view === "all" || (view === "max" ? r.maxed : !r.maxed); });
    if (!rows.length) {
      listEl.appendChild(message(!data.length ? "아직 순위에 오른 플레이어가 없어요. 첫 번째 주자가 되어 보세요!"
        : view === "max" ? "아직 " + MAXLV + "을 달성한 플레이어가 없어요." : "도전 중인 플레이어가 없어요."));
      return;
    }
    var places = {};
    top5(data).forEach(function (r) { places[r.rank] = r.rank; });
    var divided = false;
    rows.forEach(function (r, i) {
      if (view === "all" && !r.maxed && !divided && i > 0) {   // LV.10 달성자 / 도전 중 구분선
        var dv = el("p", "b-rk__divider", "도전 중"); dv.setAttribute("role", "presentation"); listEl.appendChild(dv);
      }
      if (!r.maxed) divided = true;
      listEl.appendChild(row(r, places[r.rank], false));
    });
  }

  /* 하단 고정 행: 내 순위 (목록 밖이어도 표시) */
  function renderMine() {
    mineEl.innerHTML = "";
    if (!mine) { mineEl.hidden = true; return; }
    var place = 0;
    if (mine.rank <= 5) place = mine.rank;
    mineEl.hidden = false;
    var r = row(mine, place, true);
    r.setAttribute("role", "group");
    mineEl.appendChild(r);
  }

  /* ---------- MY RANK ---------- */
  function renderMy() {
    myEl.innerHTML = "";
    var head = el("header", "b-mycard__head");
    var h = el("h2", "b-mycard__title", "MY RANK"); h.id = "b-rk-my-t";
    head.appendChild(h);
    myEl.appendChild(head);
    var me = el("div", "b-rk__me");
    var av = el("span", "b-rk__avatar"); var im = el("img"); im.src = E.charImg(mine && CHARS.indexOf(mine.avatar) > -1 ? mine.avatar : E.getCharacter()); im.alt = ""; av.appendChild(im);
    me.appendChild(av);
    var info = el("div", "b-rk__meinfo");
    var nm = el("p", "b-rk__name"); nm.appendChild(el("span", "", mine ? mine.nickname : E.displayName()));
    var L = mine ? E.levelInfo(mine.maxed ? E.XP_MAX_TOTAL : mine.xp) : E.levelInfo(E.getXp());
    nm.appendChild(el("span", "b-rk__lv", "LV." + two(mine ? mine.level : L.level)));
    info.appendChild(nm);
    if (mine) {
      var big = el("p", "b-rk__big");
      big.appendChild(el("b", "", mine.rank + "위"));
      big.appendChild(el("small", "", " / " + num(mine.total) + "명"));
      info.appendChild(big);
      var meta = el("p", "b-rk__meta");
      meta.appendChild(el("span", "b-rchip b-rk__state" + (mine.maxed ? " is-max" : ""), mine.maxed ? MAXLV + " 달성" : "도전 중"));
      meta.appendChild(el("span", "", (mine.maxed ? "기록 " : "플레이 시간 ") + fmtTime(mine.time_ms) +
        (mine.maxed ? "" : " · " + MAXLV + "까지 " + num(Math.max(0, E.XP_MAX_TOTAL - mine.xp)) + " XP")));
      info.appendChild(meta);
      var notes = [];
      if (mine.review) notes.push("기록을 검증하고 있어요. 순위는 그대로 표시되고, 검증이 끝나면 확정돼요.");
      if (notes.length) info.appendChild(el("p", "b-rk__none b-rk__mynote", notes.join(" ")));
    } else {
      info.appendChild(el("p", "b-rk__none", failed ? "내 순위를 불러오지 못했어요." : data ? "아직 순위 기록이 없어요. 게임을 플레이하면 바로 순위에 올라가요!" : "내 순위를 불러오는 중이에요…"));
    }
    me.appendChild(info);
    myEl.appendChild(me);
    var b = el("a", "b-rbtn b-rbtn--primary", mine ? "레이스 이어가기 →" : "게임 시작하기 →");
    b.href = "stage.html";
    myEl.appendChild(b);
  }

  /* ---------- TOP 5 ---------- */
  function renderTop() {
    var T = data ? top5(data) : [];
    podEl.innerHTML = "";
    [2, 1, 3].forEach(function (p) {
      var r = T[p - 1], li = el("li", "b-podium__slot is-" + p + " is-" + COLORS[p - 1] + (r ? "" : " is-empty"));
      var ch = el("span", "b-podium__char");
      if (r) {
        var im = el("img"); im.src = avatarOf(r.avatar); im.alt = ""; ch.appendChild(im);
        if (p === 1) ch.insertAdjacentHTML("beforeend", '<svg class="b-podium__crown" viewBox="0 0 32 28" aria-hidden="true"><path d="M3 9l7 6 6-11 6 11 7-6-3 16H6z" fill="currentColor"/></svg>');
      }
      li.appendChild(ch);
      var bl = el("span", "b-podium__block");
      bl.appendChild(el("b", "", String(p)));
      bl.appendChild(el("span", "b-podium__name", r ? r.nickname : "—"));
      if (r && r.review) { var st = el("span", "b-podium__status"); statusChips(r, st, true); bl.appendChild(st); }   // 기록 줄 대신 상태 표시
      else if (r) bl.appendChild(el("span", "b-podium__val", r.maxed ? fmtTime(r.time_ms) : "LV." + two(r.level) + " · " + num(r.xp) + " XP"));
      li.appendChild(bl);
      li.setAttribute("aria-label", p + "위 " + (r ? r.nickname + " " + (r.maxed ? MAXLV + " 기록 " + fmtTime(r.time_ms) : "LV." + two(r.level) + " XP " + r.xp) + flagText(r) : "비어 있음"));
      podEl.appendChild(li);
    });
    runEl.innerHTML = "";
    [4, 5].forEach(function (p) {
      var r = T[p - 1], li = el("li", "b-rk__runner is-" + COLORS[p - 1] + (r ? "" : " is-empty"));
      li.appendChild(crown(p));
      var av = el("span", "b-rk__ava");
      if (r) { var im = el("img"); im.src = avatarOf(r.avatar); im.alt = ""; av.appendChild(im); }
      li.appendChild(av);
      var nm = el("span", "b-rk__runner-name");
      nm.appendChild(el("span", "b-rk__runner-nick", r ? r.nickname : "—"));
      li.appendChild(nm);
      var val = el("span", "b-rk__runner-val");                   // 기록 자리: 검증 중이면 상태 표시 (시상대와 같은 규칙)
      if (r && r.review) statusChips(r, val, true);
      else if (r) val.textContent = r.maxed ? fmtTime(r.time_ms) : "LV." + two(r.level) + " · " + num(r.xp) + " XP";
      li.appendChild(val);
      li.setAttribute("aria-label", p + "위 " + (r ? r.nickname + flagText(r) : "비어 있음"));
      runEl.appendChild(li);
    });
    var prov = T.length < 5 || T.some(function (r) { return !r.maxed; });
    provEl.hidden = !data || !prov;
    var flagged = T.some(function (r) { return r.review; });
    noteEl.textContent = !data ? "" : !T.length ? "아직 순위에 오른 플레이어가 없어요."
      : (prov ? "5명 모두 " + MAXLV + "을 달성하면 확정돼요." : MAXLV + " 달성 시간으로 정해진 순위예요.") +
        (flagged ? " (검증 후 확정)" : "");
  }

  function flagText(r) { return (r.review ? " · 검증 중" : ""); }
  function render() { renderList(); renderMine(); renderMy(); renderTop(); }

  /* ---------- 조회 (실시간: 주기적 · 탭 복귀 시) ---------- */
  var timer = 0, busy = false;
  function load(manual) {
    if (busy || !OL || !OL.enabled) { if (!OL || !OL.enabled) { failed = true; render(); } return; }
    busy = true;
    var session = OL.session();
    var lb = OL.rpc("get_leaderboard", { limit_n: LIMIT }, !!session);
    var my = session ? OL.rpc("get_my_rank", {}, true).catch(function () { return null; }) : Promise.resolve(null);
    Promise.all([lb, my]).then(function (res) {
      data = Array.isArray(res[0]) ? res[0] : [];
      mine = Array.isArray(res[1]) && res[1][0] ? res[1][0] : null;
      if (mine) mine.is_me = true;
      failed = false;
      var d = new Date();
      updEl.textContent = "업데이트 " + two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds());
    }, function () {
      failed = !data;                                            // 이미 받은 순위가 있으면 그대로 두고 다음 조회에서 다시 시도
      updEl.textContent = data ? "연결이 불안정해요 · 잠시 후 다시 확인해요" : "연결할 수 없어요";
    }).then(function () { busy = false; render(); schedule(); });
    if (manual) clearTimeout(timer);
  }
  function schedule() {
    clearTimeout(timer);
    if (document.visibilityState === "hidden") return;
    timer = setTimeout(load, EVERY);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") load(); else clearTimeout(timer);
  });

  /* ---------- 구분 탭: 전체 / LV.10 달성 / 도전 중 ---------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (b) {
    b.addEventListener("click", function () {
      view = b.getAttribute("data-view");
      Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      renderList();
      listEl.scrollTop = 0;
    });
  });

  render();
  load();
})();
