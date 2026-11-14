/* EYEQ B안 — Main page interactions (HOME / CHARACTER SELECT)
   - Character Carousel: 화살표 / 양옆 카드 / 점 / 터치 스와이프 (Figma 컴포넌트 설명 기준)
   - 선택 캐릭터 localStorage 저장 (Mobile Character Carousel 설명: state.character 저장)
   - CTA: 선택 캐릭터 저장 → STAGE SELECT 이동
   - 모바일 메뉴·연결 대상 없는 버튼 처리는 b-common.js
*/
(function () {
  "use strict";

  var ORDER = window.EYEQ.CHARS;            // FOCUS / EYE / SPARK
  var NAMES = { FOCUS: "FOCUS, 집중하는 눈", EYE: "EYE, 호기심 많은 눈", SPARK: "SPARK, 반짝이는 눈" };

  function load() { return window.EYEQ.getCharacter(); }
  function save(v) { window.EYEQ.setCharacter(v); }

  /* ---------- Carousel ---------- */
  var root = document.querySelector("[data-carousel]");
  if (root) {
    var cards = {};
    Array.prototype.forEach.call(root.querySelectorAll(".b-card"), function (el) {
      cards[el.getAttribute("data-char")] = el;
    });
    var dots = root.querySelectorAll("[data-carousel-dot]");
    var status = root.querySelector("[data-carousel-status]");
    var current = load();
    var roles = {};

    function roleOf(name, sel) {
      var n = ORDER.length;
      var d = (ORDER.indexOf(name) - ORDER.indexOf(sel) + n) % n;
      return d === 0 ? "is-selected" : d === 1 ? "is-next" : "is-prev";
    }

    function render(sel, announce) {
      ORDER.forEach(function (name) {
        var el = cards[name];
        var next = roleOf(name, sel);
        var prev = roles[name];
        // 양 끝을 가로지르는 카드(이전↔다음)는 이동 애니메이션 없이 자리만 바꿈
        // 첫 표시(prev 없음)와 양 끝을 가로지르는 카드(이전↔다음)는 애니메이션 없이 자리만 바꿈
        var wraps = !prev || (prev === "is-prev" && next === "is-next") || (prev === "is-next" && next === "is-prev");
        if (wraps) el.classList.add("no-anim");
        el.classList.remove("is-selected", "is-prev", "is-next");
        el.classList.add(next);
        roles[name] = next;
        if (next === "is-selected") {
          el.setAttribute("aria-current", "true");
          el.setAttribute("aria-label", NAMES[name] + " (선택됨)");
        } else {
          el.removeAttribute("aria-current");
          el.setAttribute("aria-label", NAMES[name] + " 선택");
        }
        if (wraps) {
          void el.offsetWidth;          // 위치 확정 후 애니메이션 복구
          el.classList.remove("no-anim");
        }
      });
      Array.prototype.forEach.call(dots, function (dot) {
        var on = dot.getAttribute("data-carousel-dot") === sel;
        dot.classList.toggle("is-active", on);
        if (on) dot.setAttribute("aria-current", "true"); else dot.removeAttribute("aria-current");
      });
      current = sel;                    // 둘러보기만으로는 저장하지 않음 — CTA에서 확정 (캐릭터 변경 시 XP 초기화)
      if (announce && status) status.textContent = NAMES[sel];
    }

    function step(dir) {
      var i = (ORDER.indexOf(current) + dir + ORDER.length) % ORDER.length;
      render(ORDER[i], true);
    }

    root.querySelector("[data-carousel-prev]").addEventListener("click", function () { step(-1); });
    root.querySelector("[data-carousel-next]").addEventListener("click", function () { step(1); });
    ORDER.forEach(function (name) {
      cards[name].addEventListener("click", function () {
        if (suppressClick) return;
        if (roles[name] !== "is-selected") render(name, true);
      });
    });
    Array.prototype.forEach.call(dots, function (dot) {
      dot.addEventListener("click", function () { render(dot.getAttribute("data-carousel-dot"), true); });
    });

    /* 터치 스와이프 (Mobile Character Carousel 설명) */
    var track = root.querySelector("[data-carousel-track]");
    var startX = null, startY = null, suppressClick = false;
    track.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      startX = e.clientX; startY = e.clientY;
    });
    track.addEventListener("pointerup", function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      startX = startY = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        suppressClick = true;
        step(dx < 0 ? 1 : -1);
        setTimeout(function () { suppressClick = false; }, 0);
      }
    });
    track.addEventListener("pointercancel", function () { startX = startY = null; });

    render(current, false);
  }

  /* ---------- CTA → (닉네임 없으면 최초 설정) → STAGE SELECT ----------
     캐릭터는 외형만 바뀜 (XP·기록 유지). 닉네임이 이미 있으면 팝업 없이 바로 이동 */
  var E = window.EYEQ;
  var cta = document.querySelector("[data-cta]");
  var nickEl = document.querySelector('[data-modal="nick"]');
  var nick = nickEl ? E.modal(nickEl) : null;
  var openNick = null;                               // 팝업이 있을 때만 아래에서 지정
  function chosen() { var sel = document.querySelector(".b-card.is-selected"); return sel ? sel.getAttribute("data-char") : E.getCharacter(); }
  function start(ch) {
    save(ch);
    if (E.get("session", E.KEY.next) === "quick") { E.remove("session", E.KEY.next); E.startQuick(); return; }   // QUICK PLAY로 들어왔으면 이어서 시작
    window.location.href = "stage.html";
  }
  if (cta) {
    cta.addEventListener("click", function () {
      var ch = chosen();
      if ((E.getNickname() && E.getMajor()) || !openNick) { start(ch); return; }   // 닉네임 + 전공 여부가 있으면 바로 시작 (전공 여부가 없던 기존 사용자는 한 번만 물어봄)
      openNick(ch);
    });
  }
  if (nick) {
    var form = nickEl.querySelector("[data-nick-form]"), input = nickEl.querySelector("[data-nick-input]");
    var count = nickEl.querySelector("[data-nick-count]"), hint = nickEl.querySelector("[data-nick-hint]");
    var go = nickEl.querySelector("[data-nick-start]"), pending = null;
    var majors = nickEl.querySelectorAll("[data-major-input]");
    var HINT = hint.textContent;
    function major() { for (var i = 0; i < majors.length; i++) if (majors[i].checked) return majors[i].value; return null; }
    function sync() {
      count.textContent = input.value.length + " / " + E.NAME_MAX;
      go.disabled = !input.value.trim() || !major();                 // 닉네임 + 전공 여부 둘 다 필요
      hint.parentNode.classList.remove("is-error");
      hint.textContent = HINT;
    }
    openNick = function (ch) {
      pending = ch;
      nickEl.querySelector("[data-nick-char]").setAttribute("src", E.charImg(ch));
      input.value = E.getNickname() || "";                            // 기존 사용자: 닉네임 그대로 두고 전공 여부만 고르면 됨
      var mj = E.getMajor();
      for (var i = 0; i < majors.length; i++) majors[i].checked = majors[i].value === mj;
      sync();
      nick.open();
      input.focus();
    };
    input.addEventListener("input", sync);
    for (var mi = 0; mi < majors.length; mi++) majors[mi].addEventListener("change", sync);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !input.value.trim()) {   // 빈 값 Enter → 안내
        e.preventDefault();
        hint.textContent = "닉네임을 입력해 주세요.";
        hint.parentNode.classList.add("is-error");
      }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!major()) { majors[0].focus(); return; }
      if (!E.setNickname(input.value)) { input.focus(); return; }
      E.setMajor(major());
      start(pending || chosen());
    });
  }
})();
