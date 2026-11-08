/* EYEQ B안 — 업적 (마이페이지 배지 8개 · 획득 판정 · 획득 알림 토스트)
   - 판정·저장은 여기 한 곳 (마이페이지도 이 결과를 그대로 그림) · 획득 기록 eyeq.b.badges {id: 획득 시각} (기존 키 유지)
   - 새로 얻은 업적 → 알림 대기열(eyeq.b.toastq)에 저장 → 게임 화면이 아닌 페이지에서 순서대로 표시
     (문제 풀이 중에는 표시하지 않음 · 결과 화면 등 다음 화면에서 표시)
   - 같은 업적은 한 번만: 획득 기록에 이미 있으면 대기열에 넣지 않음 · 표시를 시작해 1.2초가 지나면 대기열에서 지움
     (그 전에 페이지를 떠나면 다음 페이지에서 다시 표시 → 사라지거나 두 번 뜨지 않음)
   - 처음 도입될 때 이미 조건을 채운 업적은 알림 없이 획득 처리 (예전 업적이 한꺼번에 뜨지 않게)
*/
(function (w, d) {
  "use strict";
  var E = w.EYEQ;
  if (!E) return;
  var KEY_Q = "eyeq.b.toastq", KEY_INIT = "eyeq.b.badges_init";
  var STAGE_IDS = ["typography", "spacing", "alignment", "hierarchy", "composition"];

  var LIST = [
    { id: "first",   name: "첫 플레이",         cond: "게임을 1회 완료하세요.",                 icon: "pad" },
    { id: "combo3",  name: "3연속 정답",        cond: "한 게임에서 3콤보를 달성하세요.",         icon: "flame" },
    { id: "perfect", name: "퍼펙트 클리어",     cond: "한 스테이지의 3문제를 모두 맞히세요.",     icon: "star" },
    { id: "stages",  name: "5개 스테이지 완료", cond: "5개 스테이지를 각각 1회 이상 완료하세요.", icon: "flag" },
    { id: "plays10", name: "10회 플레이",       cond: "게임을 10회 완료하세요.",                text: "10" },
    { id: "lv10",    name: "레벨 10 달성",      cond: "LV.10에 도달하세요.",                     text: "LV" },
    { id: "c50",     name: "50문제 정답",       cond: "누적 정답 50개를 달성하세요.",            text: "50" },
    { id: "c100",    name: "100문제 정답",      cond: "누적 정답 100개를 달성하세요.",           text: "100" }
  ];
  var ICONS = {
    pad: '<path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 5.4l-.9 4.3a2.3 2.3 0 0 1-3.9 1.1L14 15.5h-4l-2.1 2.3A2.3 2.3 0 0 1 4 16.7l-.9-4.3A4.5 4.5 0 0 1 7.5 7z" fill="currentColor"/><path d="M8 10v3M6.5 11.5h3" stroke="#3b3fc4" stroke-width="1.6" stroke-linecap="round"/><circle cx="15.5" cy="11" r="1" fill="#3b3fc4"/><circle cx="17.3" cy="12.8" r="1" fill="#3b3fc4"/>',
    flame: '<path d="M12.9 2.5c.8 5.5 6.6 8.3 6.6 14.4a7.5 7.5 0 0 1-15 0c0-3.2 1.7-5.4 3.4-6.9.3 2 1.2 3.4 2.6 3.9-.3-4.4 1.1-8.3 2.4-11.4z" fill="currentColor"/>',
    star: '<path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.8l-5.4 3 1.2-6.1-4.5-4.2 6.1-.7z" fill="currentColor"/>',
    flag: '<path d="M3 20l6.5-10 3.5 5 2.5-3.5L21 20z" fill="currentColor"/><path d="M15.5 11.5V4l4 1.8-4 1.8" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="currentColor"/>'
  };
  /* 배지 안쪽 표시 (육각형 안: 아이콘 또는 글자) — 마이페이지 · 알림 공통 */
  function mark(b, cls) {
    cls = cls || "b-badge";
    return b.text
      ? '<span class="' + cls + '__txt' + (b.text.length > 2 ? " is-3" : "") + '">' + b.text + "</span>"
      : '<svg class="' + cls + '__svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">' + ICONS[b.icon] + "</svg>";
  }

  /* 현재 기록으로 조건 판정 (마이페이지 기존 조건 그대로) */
  function status() {
    var H = E.getHistory(), cleared = E.getJSON("local", E.KEY.cleared) || [];
    var sumC = 0, maxCombo = 0;
    H.forEach(function (r) { sumC += r.correct || 0; maxCombo = Math.max(maxCombo, r.maxCombo || 0); });
    var best = E.bestByStage(H);
    var L = E.levelInfo(E.getXp());
    var ok = {
      first: H.length >= 1 || cleared.length > 0,
      combo3: maxCombo >= 3,
      perfect: H.some(function (r) { return r.mode !== "quick" && r.correct === r.total; }),
      stages: STAGE_IDS.every(function (id) { return best[id] || cleared.indexOf(id) > -1; }),
      plays10: H.length >= 10,
      lv10: L.level >= 10,
      c50: sumC >= 50,
      c100: sumC >= 100
    };
    return { ok: ok, plays: H.length, sumC: sumC, maxCombo: maxCombo, best: best, level: L.level };
  }
  function saved() {
    var s = E.getJSON("local", E.KEY.badges);
    return s && typeof s === "object" && !Array.isArray(s) ? s : {};
  }
  function queue() { var q = E.getJSON("local", KEY_Q); return Array.isArray(q) ? q : []; }
  function setQueue(q) { E.setJSON("local", KEY_Q, q); }

  /* 판정 → 새로 얻은 업적 저장 (+ 알림 대기열) · 새로 얻은 id 목록 반환 */
  function check(quiet) {
    var st = status(), s = saved(), fresh = [], now = Date.now();
    LIST.forEach(function (b) { if (st.ok[b.id] && !s[b.id]) { s[b.id] = now; fresh.push(b.id); } });
    if (fresh.length) {
      E.setJSON("local", E.KEY.badges, s);
      if (!quiet) {
        fresh.forEach(function (id) { addNoti({ id: "b-" + id, kind: "badge", ref: id }); });
        var q = queue();
        fresh.forEach(function (id) { if (q.indexOf(id) < 0) q.push(id); });
        setQueue(q);
        try { w.dispatchEvent(new CustomEvent("eyeq:achieve")); } catch (e) { /* noop */ }
      }
    }
    return fresh;
  }

  /* ---------- 알림 토스트 ---------- */
  var SHOW = 4000, OUT = 320, SEEN = 1200;
  var busy = false, host = null;
  var calm = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function blocked() { return !!d.querySelector("[data-game]"); }              // 게임 화면(문제 풀이 중)에는 표시 안 함
  function find(id) { for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i]; return null; }
  function ensureHost() {
    if (host && d.body.contains(host)) return host;
    host = d.createElement("div");
    host.className = "b-toasts";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    d.body.appendChild(host);
    return host;
  }
  function next() {
    if (busy || blocked()) return;
    var q = queue(), s = saved();
    while (q.length && (!find(q[0]) || !s[q[0]])) q.shift();                   // 알 수 없는 · 획득 기록 없는 항목 정리
    setQueue(q);
    if (!q.length) return;
    var b = find(q[0]);
    busy = true;
    var el = d.createElement("div");
    el.className = "b-toast";
    el.innerHTML =
      '<span class="b-toast__hex" aria-hidden="true"><span class="b-toast__in">' + mark(b, "b-tmark") + "</span></span>" +
      '<span class="b-toast__body"><b class="b-toast__k">ACHIEVEMENT UNLOCKED!</b>' +
      '<span class="b-toast__name"></span><span class="b-toast__sub">새로운 업적을 획득했어요!</span></span>';
    el.querySelector(".b-toast__name").textContent = b.name;
    ensureHost().appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-in"); }); });
    setTimeout(function () {                                                   // 충분히 보였으면 대기열에서 제거
      var cur = queue(), i = cur.indexOf(b.id);
      if (i > -1) { cur.splice(i, 1); setQueue(cur); }
    }, SEEN);
    setTimeout(function () {
      el.classList.remove("is-in");
      el.classList.add("is-out");
      setTimeout(function () { el.remove(); busy = false; setTimeout(next, 200); }, calm ? 0 : OUT);
    }, SHOW);
  }

  /* 기록이 바뀌는 순간 판정 (게임 완료 기록 · 서버 레벨 반영) — 표시는 게임 화면 밖에서만 */
  var addPlay = E.addPlay, setRace = E.setRace;
  E.addPlay = function () { var r = addPlay.apply(E, arguments); check(false); return r; };
  E.setRace = function (r) { var out = setRace.apply(E, arguments); levelNoti(r); check(false); return out; };

  /* =========================================================
     알림 센터 (헤더 종 아이콘) — 실제로 일어난 일만 기록 (이 브라우저 저장 · 서버 테이블 추가 없음)
     - 업적 획득: 위 check() 에서 새로 얻은 업적만 (같은 업적 1번)
     - 레벨업 · LV.10 달성: 서버 레이스 값이 오를 때만 (처음 연결 · 새로고침 · 다른 기기 값 동기화로는 중복 없음)
     - 읽음: 알림 창을 열면 모두 읽음 · 새로고침해도 유지
     ========================================================= */
  var KEY_N = "eyeq.b.notis", KEY_LV = "eyeq.b.noti_lv", N_MAX = 50;
  function notis() { var n = E.getJSON("local", KEY_N); return Array.isArray(n) ? n : []; }
  function addNoti(n) {
    var L = notis();
    if (n.kind === "badge" && L.some(function (x) { return x.id === n.id; })) return;   // 같은 업적 알림은 한 번만
    n.at = Date.now(); n.read = false;
    if (n.kind !== "badge") n.id = n.id + "-" + n.at;
    L.unshift(n);
    E.setJSON("local", KEY_N, L.slice(0, N_MAX));
    drawDot();
  }
  function levelNoti(r) {
    if (!r || typeof r.xp !== "number") return;
    var lv = E.levelInfo(r.xp).level, seen = parseInt(E.get("local", KEY_LV), 10);
    if (isNaN(seen)) { E.set("local", KEY_LV, String(lv)); return; }            // 처음: 기준만 저장 (예전 레벨 알림 없음)
    if (lv < seen) { E.set("local", KEY_LV, String(lv)); return; }               // 레이스 초기화 등으로 내려감: 알림 없음
    for (var L = seen + 1; L <= lv; L++) addNoti(L >= E.MAX_LEVEL ? { id: "max", kind: "max", ref: L } : { id: "lv" + L, kind: "level", ref: L });
    if (lv !== seen) E.set("local", KEY_LV, String(lv));
  }
  function ago(t) {
    var m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return "방금 전";
    if (m < 60) return m + "분 전";
    var h = Math.floor(m / 60); if (h < 24) return h + "시간 전";
    var dd = Math.floor(h / 24); if (dd < 7) return dd + "일 전";
    var x = new Date(t); return x.getFullYear() + "." + E.two(x.getMonth() + 1) + "." + E.two(x.getDate());
  }
  function dateText(t) { var x = new Date(t); return x.getFullYear() + "." + E.two(x.getMonth() + 1) + "." + E.two(x.getDate()); }
  function drawDot() {
    var unread = notis().some(function (n) { return !n.read; });
    Array.prototype.forEach.call(d.querySelectorAll("[data-noti-dot]"), function (el) { el.hidden = !unread; });
    Array.prototype.forEach.call(d.querySelectorAll("[data-noti-btn]"), function (b) { b.setAttribute("aria-label", unread ? "알림 (읽지 않은 알림 있음)" : "알림"); });
  }

  var panel = null, panelBtn = null, achModal = null;
  function hexHTML(b, on) {
    return '<span class="b-nhex' + (on ? " is-on" : "") + '" aria-hidden="true"><span class="b-nhex__in">' +
      (on ? mark(b, "b-tmark") : '<img class="b-nhex__lock" src="assets/b/icon-lock.svg" alt="" />') + "</span></span>";
  }
  function itemHTML(n) {
    var b = n.kind === "badge" ? find(n.ref) : null;
    var icon = b ? hexHTML(b, true)
      : '<span class="b-nhex is-on is-lv" aria-hidden="true"><span class="b-nhex__in"><span class="b-tmark__txt' + (n.kind === "max" ? " is-3" : "") + '">' + (n.kind === "max" ? "MAX" : "LV") + "</span></span></span>";
    var title = b ? "새로운 업적 획득" : n.kind === "max" ? "MAX LEVEL!" : "LEVEL UP!";
    var text = b ? "'" + b.name + "' 업적을 달성했어요!" : n.kind === "max" ? "LV.10에 도달했어요! LEVEL RACE 기록이 확정됐어요." : "LV." + E.two(n.ref) + "에 도달했어요!";
    return { icon: icon, title: title, text: text };
  }
  function buildPanel() {
    panel = d.createElement("div");
    panel.className = "b-noti";
    panel.id = "b-noti";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "알림");
    panel.hidden = true;
    panel.innerHTML =
      '<div class="b-noti__head"><h2 class="b-noti__title">알림</h2><span class="b-noti__count" data-noti-count></span></div>' +
      '<ul class="b-noti__list" data-noti-list></ul>' +
      '<button class="b-noti__all" type="button" data-ach-open>전체 업적 보기<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.5 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
    d.body.appendChild(panel);
    panel.querySelector("[data-ach-open]").addEventListener("click", function () { closePanel(false); openAch(); });
    panel.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); closePanel(true); } });
  }
  function renderPanel(unreadBefore) {
    var L = notis(), list = panel.querySelector("[data-noti-list]");
    panel.querySelector("[data-noti-count]").textContent = unreadBefore ? "새 알림 " + unreadBefore + "개" : "새 알림 없음";
    list.innerHTML = "";
    if (!L.length) {
      var e = d.createElement("li"); e.className = "b-noti__empty";
      e.textContent = "아직 알림이 없어요. 게임을 플레이하고 업적을 모아 보세요!";
      list.appendChild(e); return;
    }
    L.forEach(function (n, i) {
      var v = itemHTML(n), li = d.createElement("li");
      li.innerHTML = '<button class="b-noti__item' + (i < unreadBefore ? " is-new" : "") + '" type="button">' + v.icon +
        '<span class="b-noti__txt"><b></b><span></span><time></time></span></button>';
      li.querySelector("b").textContent = v.title;
      li.querySelector(".b-noti__txt > span").textContent = v.text;
      var tm = li.querySelector("time"); tm.textContent = ago(n.at); tm.setAttribute("datetime", new Date(n.at).toISOString());
      li.firstChild.addEventListener("click", function () { closePanel(false); openAch(n.kind === "badge" ? n.ref : n.kind === "max" ? "lv10" : null); });
      list.appendChild(li);
    });
  }
  function onDoc(e) { if (panel && !panel.hidden && !panel.contains(e.target) && !e.target.closest("[data-noti-btn]")) closePanel(false); }
  function openPanel(btn) {
    if (!panel) buildPanel();
    panelBtn = btn;
    var L = notis(), unread = L.filter(function (n) { return !n.read; }).length;
    renderPanel(unread);
    if (unread) { L.forEach(function (n) { n.read = true; }); E.setJSON("local", KEY_N, L); drawDot(); }   // 열면 읽음 처리
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(function () { panel.classList.add("is-open"); });
    var first = panel.querySelector(".b-noti__item, .b-noti__all"); if (first) first.focus();
    setTimeout(function () { d.addEventListener("click", onDoc); }, 0);
  }
  function closePanel(focusBtn) {
    if (!panel || panel.hidden) return;
    panel.classList.remove("is-open");
    panel.hidden = true;
    if (panelBtn) { panelBtn.setAttribute("aria-expanded", "false"); if (focusBtn) panelBtn.focus(); }
    d.removeEventListener("click", onDoc);
  }

  /* ---------- 나의 업적 (전체 8개) — 헤더 고정 · 목록만 스크롤 · 배경 스크롤 잠금 ---------- */
  function buildAch() {
    var el = d.createElement("div");
    el.className = "b-modal b-modal--ach";
    el.setAttribute("data-modal", "ach");
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<button class="b-modal__dim" type="button" tabindex="-1" aria-label="닫기" data-modal-close data-modal-dim></button>' +
      '<div class="b-modal__dialog b-ach" role="dialog" aria-modal="true" aria-labelledby="b-ach-title" tabindex="-1">' +
      '<div class="b-ach__head"><h2 class="b-ach__title" id="b-ach-title">나의 업적</h2><span class="b-ach__count" data-ach-count></span>' +
      '<button class="b-ach__close" type="button" aria-label="닫기" data-modal-close data-modal-confirm><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button></div>' +
      '<ul class="b-ach__list" data-ach-list tabindex="0" aria-label="업적 목록"></ul></div>';
    d.body.appendChild(el);
    achModal = E.modal(el);
  }
  function openAch(focusId) {
    if (!achModal) buildAch();
    var s = saved(), got = 0, list = achModal.el.querySelector("[data-ach-list]");
    list.innerHTML = "";
    LIST.forEach(function (b) {
      var on = !!s[b.id]; if (on) got++;
      var li = d.createElement("li");
      li.className = "b-ach__item" + (on ? " is-on" : "") + (b.id === focusId ? " is-focus" : "");
      li.setAttribute("data-ach-id", b.id);
      li.innerHTML = hexHTML(b, on) + '<span class="b-ach__txt"><b></b><span></span></span><span class="b-ach__state"></span>';
      li.querySelector("b").textContent = b.name;
      li.querySelector(".b-ach__txt > span").textContent = b.cond;
      li.querySelector(".b-ach__state").textContent = on ? (s[b.id] > 1000000000000 ? "획득 · " + dateText(s[b.id]) : "획득") : "미획득";
      list.appendChild(li);
    });
    achModal.el.querySelector("[data-ach-count]").textContent = got + " / " + LIST.length;
    var y = w.scrollY;
    achModal.open();
    list.scrollTop = 0;
    var f = focusId && list.querySelector('[data-ach-id="' + focusId + '"]');
    if (f) f.scrollIntoView({ block: "nearest" });
    if (w.scrollY !== y) w.scrollTo(0, y);
  }
  function bindBell() {
    Array.prototype.forEach.call(d.querySelectorAll("[data-noti-btn]"), function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var menu = d.querySelector("[data-menu].is-open");
        if (menu) { var t = d.querySelector("[data-menu-toggle]"); if (t) t.click(); }
        if (panel && !panel.hidden) closePanel(false); else openPanel(btn);
      });
    });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel && !panel.hidden) closePanel(true); });
    drawDot();
  }

  E.achieve = { list: LIST, icons: ICONS, mark: mark, status: status, saved: saved, check: check, show: next, openList: openAch, notis: notis };

  /* 처음 도입: 이미 채운 조건은 알림 없이 획득 처리 */
  if (!E.get("local", KEY_INIT)) { check(true); E.set("local", KEY_INIT, String(Date.now())); }
  w.addEventListener("eyeq:achieve", next);
  w.addEventListener("pageshow", function () { next(); });
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", function () { bindBell(); check(false); next(); });
  else { bindBell(); check(false); next(); }
  w.addEventListener("storage", function (e) { if (e.key === KEY_N) drawDot(); });
})(window, document);
