/* EYEQ B안 — 피드백 (버튼 · 팝업 · 감사 화면 · 결과 화면 안내)
   - 표시: Home · Stage · Ranking · My Page · Result (문제 풀이 화면에는 이 파일을 넣지 않음 → 버튼 없음)
   - 저장: Supabase public.feedback (자기 피드백 추가만 가능 · 읽기/수정/삭제 불가 · 서버에서 길이·유형·반복 제출 검사)
   - 실패 시 입력 내용 유지 · 성공했을 때만 감사 화면
   - 이 브라우저에서 보낸 적 있음: eyeq.b.fb_sent (결과 화면 안내 반복 안 함) */
(function (w) {
  "use strict";
  var E = w.EYEQ, d = w.document;
  if (!E) return;

  var MAX = 300, SENT_KEY = "eyeq.b.fb_sent";
  var PAGE = (function () {
    var f = (w.location.pathname.split("/").pop() || "index.html").replace(/\.html?$/, "") || "index";
    return { index: "home", stage: "stage", ranking: "ranking", mypage: "mypage", result: "result" }[f] || null;
  })();
  if (!PAGE) return;                                                     // 그 밖의 페이지(게임 등)에서는 아무것도 하지 않음

  var TYPES = [
    { v: "good", ic: "😊", t: "좋았어요" },
    { v: "idea", ic: "💡", t: "개선 아이디어" },
    { v: "bug", ic: "🛠️", t: "오류 제보" }
  ];
  var BUBBLE = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-7.2L7.6 20.4c-.4.3-1 0-1-.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 10.2h8M8 13.2h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  /* ---------- 버튼 (오른쪽 아래 고정) ---------- */
  var fab = d.createElement("button");
  fab.type = "button";
  fab.className = "b-fb-fab";
  fab.setAttribute("aria-label", "피드백 보내기");
  fab.setAttribute("aria-haspopup", "dialog");
  fab.setAttribute("data-fb-open", "");
  fab.innerHTML = BUBBLE + '<span class="b-fb-fab__t">피드백</span>';
  d.body.appendChild(fab);
  d.documentElement.classList.add("has-fb", "fb-" + PAGE);

  /* 모바일 메뉴에도 같은 항목 (화면이 좁아 버튼을 숨기는 페이지에서도 열 수 있게) */
  var panel = d.querySelector(".b-menu__panel");
  if (panel) {
    var mi = d.createElement("button");
    mi.type = "button";
    mi.className = "b-menu__item b-menu__item--fb";
    mi.setAttribute("data-fb-open", "");
    mi.innerHTML = '<span class="b-menu__bar" aria-hidden="true"></span>' + BUBBLE + "<span>피드백 보내기</span>";
    panel.appendChild(mi);
  }

  /* ---------- 팝업 ---------- */
  var root = d.createElement("div");
  root.className = "b-modal b-modal--fb";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML =
    '<button class="b-modal__dim" type="button" tabindex="-1" aria-label="닫기" data-fb-close></button>' +
    '<div class="b-modal__dialog b-fb" role="dialog" aria-modal="true" aria-labelledby="b-fb-title" aria-describedby="b-fb-desc" tabindex="-1">' +
      '<button class="b-fb__x" type="button" aria-label="닫기" data-fb-close><img src="assets/b/icon-close.svg" alt="" /></button>' +
      '<form class="b-fb__form" data-fb-form novalidate>' +
        '<h2 class="b-fb__title" id="b-fb-title">EYEQ, 어떠셨나요?</h2>' +
        '<p class="b-fb__desc" id="b-fb-desc">더 나은 디자인 경험을 위해 여러분의 의견을 들려주세요.</p>' +
        '<fieldset class="b-fb__types"><legend class="b-fb__sr">피드백 유형</legend>' +
          TYPES.map(function (t) {
            return '<label class="b-fb__type"><input type="radio" name="b-fb-type" value="' + t.v + '" data-fb-type />' +
              '<span><i aria-hidden="true">' + t.ic + "</i>" + t.t + "</span></label>";
          }).join("") +
        "</fieldset>" +
        '<span class="b-fb__field">' +
          '<textarea class="b-fb__text" maxlength="' + MAX + '" rows="5" placeholder="EYEQ를 사용하면서 느낀 점을 자유롭게 작성해 주세요." aria-label="의견 (최대 ' + MAX + '자)" data-fb-text></textarea>' +
          '<span class="b-fb__count" aria-hidden="true" data-fb-count>0 / ' + MAX + "</span>" +
        "</span>" +
        '<p class="b-fb__err" role="alert" data-fb-err hidden></p>' +
        '<span class="b-fb__btns">' +
          '<button class="b-fb__btn b-fb__btn--ghost" type="button" data-fb-close>취소</button>' +
          '<button class="b-fb__btn b-fb__btn--send" type="submit" data-fb-send>피드백 보내기 →</button>' +
        "</span>" +
      "</form>" +
      '<div class="b-fb__done" data-fb-done hidden>' +
        '<span class="b-fb__char" aria-hidden="true"><img src="assets/b/char-spark-happy.png" alt="" /></span>' +
        '<h2 class="b-fb__title" tabindex="-1" data-fb-done-title>소중한 의견 고마워요!</h2>' +
        '<p class="b-fb__desc">여러분의 의견으로 EYEQ는 더욱 성장할게요.</p>' +
        '<button class="b-fb__btn b-fb__btn--send b-fb__ok" type="button" data-fb-close>확인</button>' +
      "</div>" +
    "</div>";
  d.body.appendChild(root);

  var dialog = root.querySelector(".b-fb"), form = root.querySelector("[data-fb-form]"), done = root.querySelector("[data-fb-done]");
  var text = root.querySelector("[data-fb-text]"), count = root.querySelector("[data-fb-count]"), err = root.querySelector("[data-fb-err]");
  var send = root.querySelector("[data-fb-send]"), types = root.querySelectorAll("[data-fb-type]");
  var lastFocus = null, sending = false;

  function type() { for (var i = 0; i < types.length; i++) if (types[i].checked) return types[i].value; return null; }
  function ready() { return !!type() && !!text.value.trim(); }
  function sync() {
    count.textContent = text.value.length + " / " + MAX;
    send.disabled = sending || !ready();
  }
  function showErr(msg) { err.textContent = msg; err.hidden = !msg; }

  function open(e) {
    if (root.classList.contains("is-open")) return;
    lastFocus = (e && e.currentTarget) || d.activeElement;
    var menu = d.querySelector("[data-menu].is-open");                  // 모바일 메뉴에서 열었으면 메뉴는 닫기
    if (menu) { var mc = menu.querySelector("[data-menu-close]"); if (mc) mc.click(); lastFocus = d.querySelector("[data-menu-toggle]") || fab; }
    form.hidden = false; done.hidden = true;
    showErr(""); sync();
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    d.documentElement.classList.add("is-modal-open");                   // 배경 스크롤 잠금 (스크롤 위치 그대로)
    fab.setAttribute("aria-expanded", "true");
    (types[0] || dialog).focus();
  }
  function close() {
    if (!root.classList.contains("is-open") || sending) return;
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    d.documentElement.classList.remove("is-modal-open");
    fab.setAttribute("aria-expanded", "false");
    if (!done.hidden) {                                                  // 보낸 뒤 닫으면 다음에 열 때 새 입력
      form.reset(); sync();
    }
    var back = lastFocus && d.body.contains(lastFocus) && lastFocus.offsetParent !== null ? lastFocus : fab;
    if (back && back.focus) back.focus();
  }
  function focusables() {
    return Array.prototype.filter.call(dialog.querySelectorAll("button, input, textarea, [tabindex='0']"), function (el) {
      return !el.disabled && el.offsetParent !== null && !(el.type === "radio" && !el.checked && type());
    });
  }

  Array.prototype.forEach.call(d.querySelectorAll("[data-fb-open]"), function (b) { b.addEventListener("click", open); });
  Array.prototype.forEach.call(root.querySelectorAll("[data-fb-close]"), function (b) { b.addEventListener("click", close); });
  d.addEventListener("keydown", function (e) {
    if (!root.classList.contains("is-open")) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "Tab") {                                              // 포커스를 팝업 안에 유지
      var f = focusables(); if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (!dialog.contains(d.activeElement)) { e.preventDefault(); a.focus(); }
      else if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });
  Array.prototype.forEach.call(types, function (r) { r.addEventListener("change", function () { showErr(""); sync(); }); });
  text.addEventListener("input", function () {
    if (text.value.length > MAX) text.value = text.value.slice(0, MAX);
    showErr(""); sync();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending) return;                                                 // 중복 클릭 방지
    var t = type(), body = text.value.trim();
    if (!t) { showErr("피드백 유형을 선택해 주세요."); types[0].focus(); return; }
    if (!body) { showErr("의견을 입력해 주세요."); text.focus(); return; }
    if (!E.online || !E.online.enabled || !E.online.sendFeedback) { showErr("지금은 피드백을 보낼 수 없어요. 잠시 후 다시 시도해 주세요."); return; }
    sending = true; sync();
    send.classList.add("is-loading"); send.textContent = "보내는 중…";
    dialog.setAttribute("aria-busy", "true");
    E.online.sendFeedback(t, body.slice(0, MAX), PAGE).then(function () {
      sending = false;
      E.set("local", SENT_KEY, String(Date.now()));
      var nudge = d.querySelector("[data-fb-nudge]"); if (nudge) nudge.hidden = true;
      form.hidden = true; done.hidden = false;
      root.querySelector("[data-fb-done-title]").focus();
    }, function (x) {
      sending = false;
      var m = (x && x.data && (x.data.message || x.data.hint)) || "";
      if (x && x.network) showErr("인터넷 연결을 확인한 뒤 다시 보내 주세요.");
      else if (/rate_limited/.test(m) || (x && x.status === 429)) showErr("조금 전에 보낸 피드백이 있어요. 잠시 후 다시 보내 주세요.");
      else showErr("피드백을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");   // 입력 내용은 그대로 유지
    }).then(function () {
      send.classList.remove("is-loading"); send.textContent = "피드백 보내기 →";
      dialog.removeAttribute("aria-busy");
      sync();
    });
  });

  /* ---------- 결과 화면 안내 (3판 이상 완료 · 이 브라우저에서 아직 안 보냈을 때만 · 자동으로 열지 않음) ---------- */
  if (PAGE === "result" && !E.get("local", SENT_KEY) && E.getTotals && (E.getTotals().plays || 0) >= 3) {
    var host = d.querySelector(".b-clear");
    if (host) {
      var n = d.createElement("button");
      n.type = "button";
      n.className = "b-fb-nudge";
      n.setAttribute("data-fb-nudge", "");
      n.setAttribute("aria-haspopup", "dialog");
      n.innerHTML = '<span aria-hidden="true">💬</span> EYEQ를 플레이해 보니 어떠셨나요? <b>의견 남기기 →</b>';
      n.addEventListener("click", open);
      host.appendChild(n);
    }
  }

  E.feedback = { open: open, close: close };
})(window);
