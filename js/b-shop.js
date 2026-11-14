/* EYEQ B안 — SKIN SHOP 페이지
   카드: 기본 3종(무료) · 신규 스킨(서버 가격) · 준비 중 3칸 — 새 스킨은 b-common.js SKINS + 서버 skins 표에 추가하면 자동으로 카드가 생김
   버튼: 미보유 = 구매하기(포인트 부족 시 잠금 + 부족 포인트) · 보유·미적용 = 적용하기 · 적용 중 = 적용 중 */
(function (w, d) {
  "use strict";
  var E = w.EYEQ;
  var root = d.querySelector("[data-shop]");
  if (!E || !root || !E.skins) return;
  var S = E.skins;
  var grid = root.querySelector("[data-shop-grid]"), notice = root.querySelector("[data-shop-notice]");
  var SOON = 3;

  function n(v) { return Number(v || 0).toLocaleString("ko-KR"); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function canTrade() { return !!(E.online && E.online.enabled && E.getNickname() && E.online.session && E.online.session()); }

  function render() {
    var owned = E.ownedSkins(), cur = E.getCharacter(), pts = E.getPoints() || 0;
    var ready = S.state.available !== false, trade = canTrade() && ready;
    var list = E.SKINS.filter(function (s) { return s.base || !S.state.active || S.state.active[s.id] !== false || owned.indexOf(s.id) > -1; });
    root.querySelector("[data-shop-owned]").textContent = owned.length;
    root.querySelector("[data-shop-total]").textContent = list.length;

    if (!ready) { notice.textContent = "상점을 준비하고 있어요. 포인트는 준비가 끝나면 쌓이기 시작해요."; notice.hidden = false; }
    else if (!canTrade()) { notice.textContent = "닉네임을 정하고 게임을 플레이하면 포인트가 쌓여요. 정답 하나에 +10P!"; notice.hidden = false; }
    else notice.hidden = true;

    var html = list.map(function (s) {
      var own = owned.indexOf(s.id) > -1, on = s.id === cur, price = S.priceOf(s.id);
      var cls = "b-skin" + (s.base ? " is-base" : " is-new") + (own ? " is-owned" : "") + (on ? " is-applied" : "");
      var tag = on ? '<span class="b-skin__tag is-on">적용 중</span>' : own ? '<span class="b-skin__tag">보유 중</span>' : '<span class="b-skin__tag is-new">NEW</span>';
      var btn, need = "";
      if (on) btn = '<button class="b-skin__btn is-on" type="button" disabled>적용 중</button>';
      else if (own) btn = '<button class="b-skin__btn is-apply" type="button" data-apply="' + s.id + '">적용하기</button>';
      else {
        var lack = Math.max(0, price - pts);
        btn = '<button class="b-skin__btn is-buy" type="button" data-buy="' + s.id + '"' + (!trade || lack > 0 ? " disabled" : "") + ">구매하기</button>";
        if (trade && lack > 0) need = n(lack) + "P 더 모으면 구매할 수 있어요";
      }
      return '<li class="' + cls + '">' +
        '<span class="b-skin__fig"><img src="' + E.charImg(s.id) + '" alt="" loading="lazy" /></span>' + tag +
        '<h2 class="b-skin__name">' + esc(s.name) + "</h2>" +
        '<p class="b-skin__alias">' + esc(s.alias) + "</p>" +
        '<p class="b-skin__desc">' + esc(s.desc) + "</p>" +
        '<div class="b-skin__foot"><span class="b-skin__price">' + (s.base ? "무료" : '<i aria-hidden="true">✦</i>' + n(price) + "P") + "</span>" + btn + "</div>" +
        '<p class="b-skin__need" aria-live="polite">' + need + "</p>" +
        "</li>";
    }).join("");
    for (var i = 0; i < SOON; i++) {
      html += '<li class="b-skin is-soon" aria-label="준비 중인 스킨">' +
        '<span class="b-skin__fig b-skin__fig--soon" aria-hidden="true">?</span>' +
        '<h2 class="b-skin__name">COMING SOON</h2>' +
        '<p class="b-skin__alias">새로운 눈이 곧 찾아와요</p>' +
        '<p class="b-skin__desc">다음 스킨을 준비하고 있어요. 포인트를 미리 모아 두세요!</p>' +
        '<div class="b-skin__foot"><span class="b-skin__price">–</span><button class="b-skin__btn" type="button" disabled>준비 중</button></div>' +
        '<p class="b-skin__need"></p></li>';
    }
    var focusKey = d.activeElement && (d.activeElement.getAttribute("data-buy") || d.activeElement.getAttribute("data-apply"));
    grid.innerHTML = html;
    if (focusKey) { var f = grid.querySelector('[data-buy="' + focusKey + '"],[data-apply="' + focusKey + '"]'); if (f && !f.disabled) f.focus(); }
  }

  grid.addEventListener("click", function (e) {
    var b = e.target.closest("[data-buy]"), a = e.target.closest("[data-apply]");
    if (b && !b.disabled) S.confirmBuy(b.getAttribute("data-buy"), render);
    else if (a) {
      var id = a.getAttribute("data-apply");
      a.disabled = true; a.textContent = "적용 중…";
      S.apply(id).then(render, function (er) {
        render();
        notice.textContent = S.errText(er); notice.hidden = false;
      });
    }
  });

  S.onChange(render);
  render();
  S.loadPrices();
})(window, document);
