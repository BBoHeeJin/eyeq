/* EYEQ B안 — SKIN SHOP 페이지 (쇼케이스 + 스킨 목록)
   [PC ≥1024] 왼쪽 선택한 스킨 크게 · 오른쪽 스킨 목록 타일
   [모바일·태블릿] 위 목록(옆으로 넘김) · 아래 선택한 스킨
   - 무대: 선택한 스킨을 크게 (캐릭터 무대 · 이름 · 설명 · 표정 미리보기 · 가격 칩 · 목표 게이지 · 구매/적용)
   - 아래: 둥근 썸네일 줄로 스킨 고르기 (모바일은 옆으로 넘김) · 준비 중 3칸
   - 새 스킨은 b-common.js SKINS + 서버 skins 표에 추가하면 자동으로 썸네일이 생김
   - 버튼: 미보유 = 구매하기(포인트 부족 시 잠금 + 게이지) · 보유·미적용 = 적용하기 · 적용 중 = 적용 중 */
(function (w, d) {
  "use strict";
  var E = w.EYEQ;
  var root = d.querySelector("[data-shop]");
  if (!E || !root || !E.skins) return;
  var S = E.skins;
  var stage = root.querySelector("[data-shop-stage]"), shelf = root.querySelector("[data-shop-shelf]"), notice = root.querySelector("[data-shop-notice]");
  var SOON = 3;
  /* 스킨별 무대 빛 색 (EYEQ 보라·파랑 계열 안에서 살짝씩만 다르게) */
  var GLOW = { EYE: "79, 139, 255", SPARK: "160, 124, 255", FOCUS: "124, 108, 255", NOVA: "79, 183, 255", WISH: "176, 108, 255", PIXEL: "236, 122, 217" };
  var sel = null, mood = "";

  function n(v) { return Number(v || 0).toLocaleString("ko-KR"); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function canTrade() { return !!(E.online && E.online.enabled && E.getNickname() && E.online.session && E.online.session()); }
  function list() {
    var owned = E.ownedSkins();
    return E.SKINS.filter(function (s) { return s.base || !S.state.active || S.state.active[s.id] !== false || owned.indexOf(s.id) > -1; });
  }
  /* 처음 고른 스킨: 아직 없는 새 스킨(상점의 주인공) → 모두 있으면 지금 적용 중인 스킨 */
  function firstPick() {
    var owned = E.ownedSkins(), L = list();
    for (var i = 0; i < L.length; i++) if (!L[i].base && owned.indexOf(L[i].id) < 0) return L[i].id;
    return E.getCharacter();
  }

  function renderNotice() {
    var ready = S.state.available !== false;
    if (!ready) { notice.textContent = "상점을 준비하고 있어요. 포인트는 준비가 끝나면 쌓이기 시작해요."; notice.hidden = false; }
    else if (!canTrade()) { notice.textContent = "닉네임을 정하고 게임을 플레이하면 포인트가 쌓여요. 정답 하나에 +10P!"; notice.hidden = false; }
    else notice.hidden = true;
  }

  function tagOf(s) {
    var own = E.ownedSkins().indexOf(s.id) > -1, on = s.id === E.getCharacter();
    return on ? '<span class="b-tag is-on">적용 중</span>' : own ? '<span class="b-tag is-own">✓ 보유 중</span>' : '<span class="b-tag is-new">NEW</span>';
  }
  function chipOf(s) {
    return s.base ? '<span class="b-chip b-chip--free"><span class="b-chip__ic" aria-hidden="true">✓</span>기본 제공</span>'
      : '<span class="b-chip b-chip--price"><span class="b-chip__ic" aria-hidden="true">✦</span>' + n(S.priceOf(s.id)) + '<small>P</small></span>';
  }
  function btnOf(s, cls, applyText) {
    var own = E.ownedSkins().indexOf(s.id) > -1, on = s.id === E.getCharacter();
    var pts = E.getPoints() || 0, trade = canTrade() && S.state.available !== false;
    if (on) return '<button class="' + cls + ' is-on" type="button" disabled>적용 중</button>';
    if (own) return '<button class="' + cls + ' is-apply" type="button" data-apply="' + s.id + '">' + applyText + "</button>";
    return '<button class="' + cls + '" type="button" data-buy="' + s.id + '"' + (!trade || pts < S.priceOf(s.id) ? " disabled" : "") + ">구매하기</button>";
  }
  function goalOf(s) {
    if (E.ownedSkins().indexOf(s.id) > -1) return "";
    var pts = E.getPoints() || 0, price = S.priceOf(s.id), lack = Math.max(0, price - pts), p = price ? Math.min(1, pts / price) : 1;
    return '<div class="b-goal' + (lack ? "" : " is-done") + '">' +
      '<div class="b-goal__top"><span>' + (lack ? esc(s.name) + "까지" : "포인트가 충분해요") + "</span><b>" + (lack ? n(lack) + "P 남음" : "지금 구매할 수 있어요!") + "</b></div>" +
      '<span class="b-goal__track" role="progressbar" aria-label="' + esc(s.name) + ' 구매까지 모은 포인트" aria-valuemin="0" aria-valuemax="' + price + '" aria-valuenow="' + Math.min(pts, price) + '"><span class="b-goal__fill" style="--p:' + p.toFixed(3) + '"></span></span>' +
      '<span class="b-goal__num">' + n(Math.min(pts, price)) + " / " + n(price) + "P</span></div>";
  }
  function renderStage() {
    var s = E.skin(sel); if (!s) return;
    var on = s.id === E.getCharacter();
    var tag = tagOf(s), chip = chipOf(s), btn = btnOf(s, "b-stagebox__btn", "이 캐릭터 적용하기"), goal = goalOf(s);
    var moods = s.mood ? '<div class="b-moods" role="group" aria-label="표정 미리보기">' +
      [["", "기본"], ["happy", "맞혔을 때"], ["sad", "틀렸을 때"]].map(function (m) {
        return '<button class="b-mood' + (m[0] === mood ? " is-on" : "") + '" type="button" aria-pressed="' + (m[0] === mood) + '" data-mood="' + m[0] + '">' +
          '<span class="b-mood__img"><img src="' + E.charImg(s.id, m[0]) + '" alt="" /></span><span class="b-mood__t">' + m[1] + "</span></button>";
      }).join("") + "</div>" : "";

    stage.style.setProperty("--glow", GLOW[s.id] || GLOW.EYE);
    stage.className = "b-stagebox" + (on ? " is-applied" : "");
    stage.innerHTML =
      '<div class="b-stagebox__fig">' +
        '<span class="b-stagebox__light" aria-hidden="true"></span>' +
        '<img class="b-stagebox__floor" src="assets/b/floor-shadow-selected.svg" alt="" aria-hidden="true" />' +
        '<img class="b-stagebox__img" src="' + E.charImg(s.id, mood) + '" alt="' + esc(s.name + ", " + s.alias) + '" />' +
        '<div class="b-stagebox__tags">' + tag + "</div>" +   // 상태 표시: 캐릭터 무대 왼쪽 위
      "</div>" +
      '<div class="b-stagebox__info">' +
        '<h2 class="b-stagebox__name">' + esc(s.name) + "</h2>" +
        '<p class="b-stagebox__alias">' + esc(s.alias) + "</p>" +
        '<p class="b-stagebox__desc">' + esc(s.desc) + "</p>" +
        moods +
        '<div class="b-stagebox__buy">' + chip + btn + "</div>" +
        goal +
      "</div>";
  }

  /* 스킨 목록: 기본 스킨 / 새로운 스킨 두 묶음 + 준비 중 한 줄
     PC = 왼쪽 정렬 가로 행 · 모바일 = 옆으로 넘기는 둥근 썸네일 (묶음 제목은 숨김) */
  function renderShelf() {
    var owned = E.ownedSkins(), cur = E.getCharacter(), L = list();
    function row(s) {
      var own = owned.indexOf(s.id) > -1, on = s.id === cur;
      var st = on ? '<span class="b-th__st is-on">적용 중</span>' : own ? '<span class="b-th__st is-own">✓ 보유</span>' : '<span class="b-th__st is-lock">🔒 ' + n(S.priceOf(s.id)) + "P</span>";
      return '<button class="b-th' + (s.id === sel ? " is-sel" : "") + (own ? "" : " is-locked") + '" type="button" aria-pressed="' + (s.id === sel) + '" data-pick="' + s.id + '" style="--glow:' + (GLOW[s.id] || GLOW.EYE) + '">' +
        '<span class="b-th__ring"><img src="' + E.charImg(s.id) + '" alt="" loading="lazy" /></span>' +
        '<span class="b-th__name">' + esc(s.name) + "</span>" + '<span class="b-th__alias">' + esc(s.alias) + "</span>" + st + "</button>";
    }
    function group(title, items, cls) {
      return items.length ? '<div class="b-shelf__group ' + cls + '"><p class="b-shelf__label">' + title + "</p>" + items.map(row).join("") + "</div>" : "";
    }
    var html = group("기본 스킨", L.filter(function (s) { return s.base; }), "is-base") +
      group("새로운 스킨", L.filter(function (s) { return !s.base; }), "is-new") +
      '<span class="b-th is-soon" aria-label="준비 중인 스킨 ' + SOON + '종"><span class="b-th__ring" aria-hidden="true">?</span><span class="b-th__name"><span class="b-th__pc">COMING </span>SOON</span>' +
      '<span class="b-th__alias">새로운 스킨 ' + SOON + "종을 준비하고 있어요</span><span class=\"b-th__st\">준비 중</span></span>";
    var hadFocus = d.activeElement && d.activeElement.getAttribute && d.activeElement.getAttribute("data-pick");
    shelf.innerHTML = html;
    if (hadFocus) { var f = shelf.querySelector('[data-pick="' + hadFocus + '"]'); if (f) f.focus(); }
  }

  function render() {
    if (!sel || !E.skin(sel)) sel = firstPick();
    renderNotice(); renderStage(); renderShelf();
  }
  function pick(id) {
    if (!E.skin(id) || id === sel) return;
    sel = id; mood = "";
    renderStage(); renderShelf();
    var b = shelf.querySelector('[data-pick="' + id + '"]');
    if (b && b.scrollIntoView) { try { b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); } catch (e) { /* 이전 브라우저 */ } }
  }

  shelf.addEventListener("click", function (e) { var b = e.target.closest("[data-pick]"); if (b) pick(b.getAttribute("data-pick")); });
  stage.addEventListener("click", function (e) {
    var m = e.target.closest("[data-mood]"), b = e.target.closest("[data-buy]"), a = e.target.closest("[data-apply]");
    if (m) {
      mood = m.getAttribute("data-mood");
      stage.querySelector(".b-stagebox__img").src = E.charImg(sel, mood);
      Array.prototype.forEach.call(stage.querySelectorAll("[data-mood]"), function (x) { var on = x === m; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", on); });
    } else if (b && !b.disabled) S.confirmBuy(b.getAttribute("data-buy"), render);
    else if (a && !a.disabled) {
      a.disabled = true; a.textContent = "적용 중…";
      S.apply(a.getAttribute("data-apply")).then(render, function (er) {
        render();
        notice.textContent = S.errText(er); notice.hidden = false;
      });
    }
  });

  S.onChange(render);
  render();
  S.loadPrices();
})(window, document);
