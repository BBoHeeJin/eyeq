/* EYEQ B안 — 포인트 · 스킨 (모든 페이지)
   - 서버 지갑(eyeq_wallet) → 표시용 사본(포인트 · 보유 스킨) 갱신 → 헤더 포인트 · 캐릭터
   - 구매(eyeq_buy_skin) · 적용(eyeq_apply_skin): 서버가 잔액·보유를 확인 (브라우저 값은 믿지 않음)
   - 공통 팝업: 구매 확인 → 구매 완료(지금 적용?) → 캐릭터 선택 (Shop · 마이페이지에서 사용)
   - 포인트는 XP · 레벨 · 랭킹과 별개 (이 파일은 XP 를 건드리지 않음) */
(function (w, d) {
  "use strict";
  var E = w.EYEQ;
  if (!E) return;
  var OL = E.online;

  var state = { ready: false, available: null, recent: [], earned: 0, spent: 0 };   // available: 서버 상점 사용 가능 여부 (null = 모름)
  var listeners = [];
  function emit() {
    listeners.forEach(function (f) { try { f(state); } catch (e) { /* 무시 */ } });
    try { w.dispatchEvent(new CustomEvent("eyeq:skins")); } catch (e) { /* 이전 브라우저 */ }   // 메인 캐러셀 등 먼저 로드된 스크립트용
  }

  function setCache(wallet) {
    E.set("local", E.KEY.points, String(wallet.balance || 0));
    E.setJSON("local", E.KEY.owned, (wallet.owned || []).filter(function (id) { var s = E.skin(id); return s && !s.base; }));
    state.recent = wallet.recent || [];
    state.earned = wallet.earned || 0;
    state.spent = wallet.spent || 0;
    state.ready = true; state.available = true;
    /* 이 브라우저의 캐릭터가 서버에서 보유 확인이 안 되면 서버에 적용된 캐릭터(없으면 EYE)로 */
    var local = E.get("local", E.KEY.character);
    if (local && !E.usable(local)) E.set("local", E.KEY.character, E.usable(wallet.applied) ? wallet.applied : "EYE");
    E.renderHeader();
  }

  function hasSession() { return !!(OL && OL.enabled && OL.session && OL.session()); }

  /* 지갑 새로 고침 — 로그인(익명) 세션이 있을 때만 (방문만으로 계정을 만들지 않음) */
  function refresh() {
    if (!hasSession()) { state.ready = true; emit(); return Promise.resolve(null); }
    return OL.rpc("eyeq_wallet", {}, true).then(function (wl) {
      if (wl && typeof wl.balance === "number") setCache(wl);
      emit();
      return wl;
    }, function (e) {
      state.ready = true;
      if (e && (e.status === 404 || (e.data && /eyeq_wallet|function/.test(e.data.message || "")))) state.available = false;   // 서버에 아직 상점이 없음 (SQL 적용 전)
      emit();
      return null;
    });
  }

  function errText(e) {
    var m = (e && e.data && (e.data.message || "")) || "";
    if (e && e.network) return "인터넷 연결을 확인한 뒤 다시 시도해 주세요.";
    if (/insufficient_points/.test(m)) return "포인트가 부족해요.";
    if (/already_owned/.test(m)) return "이미 보유한 스킨이에요.";
    if (/not_for_sale/.test(m)) return "지금은 판매하지 않는 스킨이에요.";
    if (/skin_not_owned/.test(m)) return "보유한 스킨만 적용할 수 있어요.";
    if (/profile_required/.test(m) || (e && e.message === "profile")) return "닉네임을 먼저 정해 주세요. (홈에서 캐릭터 선택 후 시작)";
    if (e && e.status === 404) return "상점을 준비하고 있어요. 잠시 후 다시 시도해 주세요.";
    return "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }

  function buy(id) {
    if (!OL || !OL.enabled) return Promise.reject({ message: "offline" });
    return OL.rpc("eyeq_buy_skin", { p_skin: id }, true).then(function (wl) { setCache(wl); emit(); return wl; });
  }
  /* 적용: 기본 3종은 언제나 · 구매 스킨은 서버 확인 후. 프로필(닉네임)이 있으면 서버에도 저장 */
  function apply(id) {
    if (!E.usable(id)) return Promise.reject({ data: { message: "skin_not_owned" } });
    if (!E.getNickname() || !hasSession()) { E.setCharacter(id); emit(); return Promise.resolve(null); }
    return OL.rpc("eyeq_apply_skin", { p_skin: id }, true).then(function (wl) {
      E.setCharacter(id);                     // 프로필 동기화는 같은 값이라 추가 요청 없음
      if (wl) setCache(wl);
      emit();
      return wl;
    }, function (e) {
      if (e && e.status === 404 && E.skin(id) && E.skin(id).base) { E.setCharacter(id); emit(); return null; }   // 서버 상점 전: 기본 캐릭터는 기존 방식으로
      throw e;
    });
  }

  /* =========================================================
     공통 팝업 (화면 가운데 · 배경 잠금 · ESC · 바깥 클릭 · 포커스 가둠 · 닫으면 원래 버튼으로)
     ========================================================= */
  var root = null, dialog = null, lastFocus = null, busy = false, onClose = null;
  function ensureRoot() {
    if (root) return;
    root = d.createElement("div");
    root.className = "b-modal b-modal--skin";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = '<button class="b-modal__dim" type="button" tabindex="-1" aria-label="닫기" data-sk-close></button>' +
      '<div class="b-modal__dialog b-sk" role="dialog" aria-modal="true" aria-labelledby="b-sk-title" tabindex="-1"></div>';
    d.body.appendChild(root);
    dialog = root.querySelector(".b-sk");
    root.addEventListener("click", function (e) { if (e.target.closest("[data-sk-close]")) close(); });
    d.addEventListener("keydown", function (e) {
      if (!root.classList.contains("is-open")) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "Tab") {
        var f = Array.prototype.filter.call(dialog.querySelectorAll("button, [href], input, [tabindex='0']"), function (el) { return !el.disabled && el.offsetParent !== null; });
        if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (!dialog.contains(d.activeElement)) { e.preventDefault(); a.focus(); }
        else if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
  }
  function show(html, focusSel, closeFn) {
    ensureRoot();
    var wasOpen = root.classList.contains("is-open");
    if (!wasOpen) lastFocus = d.activeElement;
    onClose = closeFn || null;
    dialog.innerHTML = '<button class="b-sk__x" type="button" aria-label="닫기" data-sk-close><img src="assets/b/icon-close.svg" alt="" /></button>' + html;
    dialog.scrollTop = 0;
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    d.documentElement.classList.add("is-modal-open");
    var f = focusSel && dialog.querySelector(focusSel);
    (f || dialog).focus();
  }
  function close() {
    if (!root || !root.classList.contains("is-open") || busy) return;
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    d.documentElement.classList.remove("is-modal-open");
    var fn = onClose; onClose = null;
    if (fn) fn();
    if (lastFocus && d.body.contains(lastFocus) && lastFocus.offsetParent !== null) lastFocus.focus();
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function n(v) { return Number(v || 0).toLocaleString("ko-KR"); }
  function fig(s, cls) { return '<span class="b-sk__fig ' + (cls || "") + '"><img src="' + E.charImg(s.id) + '" alt="" /></span>'; }
  function priceOf(id) { var p = state.prices && state.prices[id]; return typeof p === "number" ? p : (E.skin(id) || {}).price || 0; }

  /* 1) 구매 확인 */
  function confirmBuy(id, done) {
    var s = E.skin(id); if (!s) return;
    var price = priceOf(id), have = E.getPoints() || 0, after = have - price;
    show(fig(s, "is-big") +
      '<h2 class="b-sk__title" id="b-sk-title"><b>' + esc(s.name) + '</b>를 구매하시겠습니까?</h2>' +
      '<dl class="b-sk__sum">' +
        '<div><dt>구매 가격</dt><dd>' + n(price) + 'P</dd></div>' +
        '<div><dt>현재 보유</dt><dd>' + n(have) + 'P</dd></div>' +
        '<div class="is-total"><dt>구매 후 잔액</dt><dd>' + n(after) + 'P</dd></div>' +
      "</dl>" +
      '<p class="b-sk__err" role="alert" data-sk-err hidden></p>' +
      '<div class="b-sk__btns"><button class="b-sk__btn b-sk__btn--ghost" type="button" data-sk-close>취소</button>' +
      '<button class="b-sk__btn b-sk__btn--main" type="button" data-sk-buy' + (after < 0 ? " disabled" : "") + '>구매하기</button></div>', "[data-sk-buy]");
    var btn = dialog.querySelector("[data-sk-buy]"), err = dialog.querySelector("[data-sk-err]");
    btn.addEventListener("click", function () {
      if (busy) return;                                  // 중복 클릭 방지
      busy = true; btn.disabled = true; btn.textContent = "구매 중…"; btn.classList.add("is-loading");
      dialog.setAttribute("aria-busy", "true");
      buy(id).then(function () {
        busy = false; dialog.removeAttribute("aria-busy");
        purchased(id, done);
      }, function (e) {
        busy = false; dialog.removeAttribute("aria-busy");
        btn.disabled = false; btn.textContent = "구매하기"; btn.classList.remove("is-loading");
        err.textContent = errText(e); err.hidden = false;
        refresh();
      });
    });
  }
  /* 2) 구매 완료 → 지금 적용? */
  function purchased(id, done) {
    var s = E.skin(id);
    show(fig(s, "is-big is-pop") +
      '<h2 class="b-sk__title" id="b-sk-title"><b>' + esc(s.name) + '</b> 스킨을 획득했어요!</h2>' +
      '<p class="b-sk__desc">새로운 캐릭터와 함께 디자인 감각을 키워보세요.</p>' +
      '<p class="b-sk__ask">지금 바로 적용하시겠습니까?</p>' +
      '<div class="b-sk__btns"><button class="b-sk__btn b-sk__btn--ghost" type="button" data-sk-close>나중에</button>' +
      '<button class="b-sk__btn b-sk__btn--main" type="button" data-sk-apply>예, 적용할게요</button></div>', "[data-sk-apply]", done);
    dialog.querySelector("[data-sk-apply]").addEventListener("click", function () { picker(id, done); });
  }
  /* 3) 캐릭터 선택 (보유 스킨만 선택 · 미보유는 잠금) — 적용 버튼을 눌러야 실제 변경 */
  function picker(preselect, done) {
    var owned = E.ownedSkins(), cur = E.getCharacter(), sel = preselect && E.usable(preselect) ? preselect : cur;
    var items = E.SKINS.map(function (s) {
      var own = owned.indexOf(s.id) > -1;
      return '<button class="b-sk__opt' + (own ? "" : " is-locked") + (s.id === sel ? " is-selected" : "") + '" type="button" role="radio" aria-checked="' + (s.id === sel) + '"' +
        (own ? "" : ' aria-disabled="true" disabled') + ' data-sk-opt="' + s.id + '">' +
        '<span class="b-sk__optfig"><img src="' + E.charImg(s.id) + '" alt="" /></span>' +
        '<span class="b-sk__optname">' + esc(s.name) + "</span>" +
        '<span class="b-sk__optalias">' + (own ? esc(s.alias) : "🔒 " + n(priceOf(s.id)) + "P") + "</span>" +
        (s.id === cur ? '<span class="b-sk__now">적용 중</span>' : "") +
        "</button>";
    }).join("");
    show('<h2 class="b-sk__title b-sk__title--pick" id="b-sk-title">함께할 눈을 선택해 주세요.</h2>' +
      '<div class="b-sk__grid" role="radiogroup" aria-labelledby="b-sk-title">' + items + "</div>" +
      '<p class="b-sk__err" role="alert" data-sk-err hidden></p>' +
      '<div class="b-sk__btns b-sk__btns--one"><button class="b-sk__btn b-sk__btn--main" type="button" data-sk-ok>이 캐릭터로 적용하기</button></div>',
      ".b-sk__opt.is-selected", done);
    var opts = dialog.querySelectorAll("[data-sk-opt]"), ok = dialog.querySelector("[data-sk-ok]"), err = dialog.querySelector("[data-sk-err]");
    Array.prototype.forEach.call(opts, function (o) {
      o.addEventListener("click", function () {
        sel = o.getAttribute("data-sk-opt");
        Array.prototype.forEach.call(opts, function (x) { var on = x === o; x.classList.toggle("is-selected", on); x.setAttribute("aria-checked", on); });
      });
    });
    ok.addEventListener("click", function () {
      if (busy) return;
      if (sel === E.getCharacter()) { close(); return; }
      busy = true; ok.disabled = true; ok.textContent = "적용 중…";
      apply(sel).then(function () {
        busy = false; close();
        announce(E.skin(sel).name + " 캐릭터를 적용했어요.");
      }, function (e) {
        busy = false; ok.disabled = false; ok.textContent = "이 캐릭터로 적용하기";
        err.textContent = errText(e); err.hidden = false;
      });
    });
  }
  function announce(t) {
    var live = d.querySelector("[data-sk-live]");
    if (!live) { live = d.createElement("p"); live.className = "b-sr-only"; live.setAttribute("aria-live", "polite"); live.setAttribute("data-sk-live", ""); d.body.appendChild(live); }
    live.textContent = ""; setTimeout(function () { live.textContent = t; }, 30);
  }

  /* 서버 가격표 (상점 카드 · 구매 확인에 사용 · 실패하면 화면 목록 가격) */
  function loadPrices() {
    if (!OL || !OL.enabled) return Promise.resolve(null);
    return OL.request("/rest/v1/skins?select=id,price,active,sort", {}).then(function (rows) {
      state.prices = {}; state.active = {};
      (rows || []).forEach(function (r) { state.prices[r.id] = r.price; state.active[r.id] = r.active; });
      emit(); return rows;
    }, function () { return null; });
  }

  E.skins = {
    state: state, refresh: refresh, buy: buy, apply: apply, loadPrices: loadPrices, priceOf: priceOf,
    confirmBuy: confirmBuy, picker: picker, close: close, errText: errText,
    onChange: function (f) { listeners.push(f); }
  };

  /* 다른 탭에서 바뀌면 헤더 갱신 */
  w.addEventListener("storage", function (e) { if (e.key === E.KEY.points || e.key === E.KEY.owned || e.key === E.KEY.character) { E.renderHeader(); emit(); } });
  E.renderPoints();
  /* 처음 방문·닉네임 설정 직후처럼 익명 로그인이 늦게 끝나면, 연결된 뒤 한 번 더 지갑을 불러 헤더 포인트를 채움
     (이미 로그인 세션이 있어 첫 요청을 보냈다면 같은 요청을 다시 보내지 않음 — 페이지마다 중복 요청 제거) */
  var walletAfterLogin = hasSession();
  refresh();
  w.addEventListener("eyeq:online", function (e) {
    if (e.detail === "online" && !walletAfterLogin && (state.available !== false)) { walletAfterLogin = true; refresh(); }
  });
})(window, document);
