/* EYEQ B안 — 효과음 (Web Audio 코드 합성 · 음원 파일 없음)
   사용: EYEQ.sfx.play("correct")  ·  EYEQ.sfx.toggle()  ·  EYEQ.sfx.enabled()
   소리 목록
     tap      버튼·메뉴·카드 누름 (짧은 '톡')
     count    문제 읽기 3·2·1          go       풀이 시작
     tick     남은 시간 3초 이하 1초마다
     correct  정답 (GREAT!)            combo2   2연속 (PERFECT!)      combo3  3연속 이상 (AMAZING!)
     wrong    오답 (NICE TRY!)         timeout  시간 초과 (TIME OVER)
     clear    스테이지 클리어           levelup  레벨 업
     buy      스킨 구매 완료            equip    스킨 장착              badge   업적 획득
   규칙
   · 설정은 이 기기에 저장 (localStorage eyeq.b.sfx = "off" 이면 꺼짐) · 기본 = 켜짐
   · 모바일 브라우저는 첫 터치 전 소리를 막음 → 첫 터치·클릭·키 입력 때 오디오를 깨움
     (깨우기 전에 요청된 소리는 1.5초 안에 깨어나면 재생, 아니면 버림)
   · 게임 로직·데이터와 무관 (소리만 냄) · 이 파일이 없어도 다른 기능은 그대로 동작
*/
(function () {
  "use strict";
  var E = window.EYEQ = window.EYEQ || {};
  var KEY = "eyeq.b.sfx";
  var MASTER = 0.5;                          // 전체 음량 (0~1)
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, out = null, pending = null;

  function enabled() { try { return localStorage.getItem(KEY) !== "off"; } catch (e) { return true; } }
  function setEnabled(on) { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { /* 저장 불가 = 이번 화면만 */ } sync(); }

  /* ---------- 오디오 준비 (첫 사용자 입력 때) ---------- */
  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { AC = null; return null; }
      out = ctx.createGain();
      out.gain.value = MASTER;
      var comp = ctx.createDynamicsCompressor();      // 여러 소리가 겹쳐도 찢어지지 않게
      out.connect(comp); comp.connect(ctx.destination);
    }
    return ctx;
  }
  function unlock() {
    var c = ensure(); if (!c) return;
    if (c.state !== "running") {
      try {                                            // iOS: 사용자 입력 안에서 무음 한 번 재생해야 깨어남
        var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
        s.buffer = b; s.connect(c.destination); s.start(0);
      } catch (e) { /* 무시 */ }
      c.resume().then(flush, function () {});
    } else flush();
  }
  function flush() {
    if (pending && Date.now() - pending.at < 1500) { var n = pending.name; pending = null; play(n); }
    pending = null;
  }
  ["pointerdown", "touchend", "keydown"].forEach(function (ev) {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  });

  /* ---------- 합성 도구 ---------- */
  // 음 하나: 주파수 f(→ to 로 미끄러짐) · 시작 t(초, 지금 기준) · 길이 d · 파형 · 음량 g
  function tone(f, t, d, o) {
    o = o || {};
    var now = ctx.currentTime + (t || 0);
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(f, now);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, now + d);
    var vol = o.g == null ? 0.3 : o.g, a = o.a || 0.006;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + a);              // 짧은 어택 (딸깍 소리 방지)
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);           // 자연스러운 감쇠
    var node = osc;
    if (o.lp) { var f2 = ctx.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = o.lp; osc.connect(f2); node = f2; }
    node.connect(g); g.connect(out);
    osc.start(now); osc.stop(now + d + 0.02);
  }
  // 잡음(바람·휙 소리): 길이 d · 대역 필터 from → to
  function noise(t, d, from, to, g) {
    var now = ctx.currentTime + (t || 0);
    var len = Math.max(1, Math.floor(ctx.sampleRate * d)), buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), gn = ctx.createGain();
    src.buffer = buf; bp.type = "bandpass"; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(from, now); bp.frequency.exponentialRampToValueAtTime(to, now + d);
    gn.gain.setValueAtTime(0.0001, now);
    gn.gain.exponentialRampToValueAtTime(g || 0.12, now + d * 0.3);
    gn.gain.exponentialRampToValueAtTime(0.0001, now + d);
    src.connect(bp); bp.connect(gn); gn.connect(out);
    src.start(now); src.stop(now + d + 0.02);
  }
  function arp(notes, step, d, o) { notes.forEach(function (f, i) { tone(f, i * step, d, o); }); }
  function sparkle(t, g) { tone(2637, t, 0.18, { g: g || 0.06 }); tone(3136, t + 0.05, 0.2, { g: (g || 0.06) * 0.8 }); }

  /* ---------- 소리 정의 (음 이름: C5=523 · E5=659 · G5=784 · C6=1047 · E6=1319 · G6=1568 · C7=2093) ---------- */
  var SOUNDS = {
    tap: function () { tone(1250, 0, 0.06, { g: 0.32, to: 1500, a: 0.003 }); },
    count: function () { tone(740, 0, 0.11, { type: "triangle", g: 0.45, a: 0.004 }); },
    go: function () { tone(988, 0, 0.08, { type: "triangle", g: 0.22 }); tone(1480, 0.07, 0.16, { type: "triangle", g: 0.2 }); },
    tick: function () { tone(1600, 0, 0.05, { type: "square", g: 0.3, lp: 3200, a: 0.002 }); },
    correct: function () {
      arp([1047, 1568], 0.08, 0.2, { type: "triangle", g: 0.26 });
      sparkle(0.14);
    },
    combo2: function () {
      arp([1047, 1319, 1568], 0.07, 0.22, { type: "triangle", g: 0.25 });
      sparkle(0.2, 0.07);
    },
    combo3: function () {
      arp([1047, 1319, 1568, 2093], 0.065, 0.26, { type: "triangle", g: 0.25 });
      tone(2093, 0.26, 0.45, { g: 0.1 });
      sparkle(0.3, 0.08); sparkle(0.42, 0.05);
    },
    wrong: function () {
      tone(392, 0, 0.16, { type: "triangle", g: 0.24, to: 370 });
      tone(311, 0.13, 0.26, { type: "triangle", g: 0.22, to: 262 });
    },
    timeout: function () {
      tone(220, 0, 0.42, { type: "sawtooth", g: 0.3, lp: 900, to: 165 });
      tone(110, 0, 0.42, { type: "sine", g: 0.35, to: 82 });
    },
    clear: function () {
      arp([523, 659, 784, 1047], 0.09, 0.22, { type: "triangle", g: 0.24 });
      [1047, 1319, 1568].forEach(function (f) { tone(f, 0.38, 0.7, { type: "triangle", g: 0.14 }); });   // 마무리 화음
      sparkle(0.42, 0.07); sparkle(0.6, 0.05);
    },
    levelup: function () {
      noise(0, 0.35, 400, 4000, 0.06);
      arp([784, 988, 1175, 1568], 0.075, 0.24, { type: "square", g: 0.08, lp: 3500 });
      tone(1568, 0.32, 0.55, { type: "triangle", g: 0.16 });
      sparkle(0.36, 0.07);
    },
    buy: function () { tone(1175, 0, 0.09, { type: "square", g: 0.2, lp: 4000 }); tone(1760, 0.08, 0.3, { type: "square", g: 0.2, lp: 4000 }); sparkle(0.12, 0.05); },
    equip: function () { noise(0, 0.22, 600, 3000, 0.07); tone(880, 0.12, 0.12, { type: "triangle", g: 0.18 }); tone(1319, 0.2, 0.3, { type: "triangle", g: 0.18 }); },
    badge: function () { arp([1568, 2093, 2637], 0.08, 0.3, { g: 0.12 }); tone(1047, 0, 0.5, { type: "triangle", g: 0.08 }); }
  };

  function play(name) {
    if (!enabled() || !SOUNDS[name]) return;
    var c = ensure(); if (!c) return;
    if (c.state !== "running") { pending = { name: name, at: Date.now() }; c.resume().then(flush, function () {}); return; }
    try { SOUNDS[name](); } catch (e) { /* 소리 실패는 무시 (게임 진행 우선) */ }
  }

  /* ---------- 버튼 탭 소리 (판정·구매처럼 따로 소리가 있는 버튼은 제외) ---------- */
  var TAP = ".b-gbtn, .b-cta, .b-sbtn, .b-scard, .b-arrow, .b-card, .b-nav__item, .b-menu__item, .b-hd-menu, .b-hprof, .b-profmenu__item, .b-pts, .b-qp, " +
            ".b-rk__tab, .b-rbtn, .b-mytabs button, [data-tab], .b-mycard__more, .b-mylist__row, .b-skill__open, .b-prof__skin, .b-prof__edit, " +
            ".b-modal__btn, .b-sk__btn, .b-shop button, .b-shop a, .b-back, .b-major__opt, .b-tut button, .b-rfilter__btn, .b-sk__opt";
  var NO_TAP = ".b-ans, [data-sk-buy], [data-sk-ok], [data-apply], [data-sfx-toggle], [disabled], [aria-disabled='true']";
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(TAP);
    if (!t || t.closest(NO_TAP) || t.matches(NO_TAP)) return;
    E.sfx.play("tap");
  }, true);

  /* ---------- 켜기/끄기 (PC = 프로필 메뉴 · 모바일 = 햄버거 메뉴) — 헤더 배치는 그대로 ---------- */
  var ICON_ON = '<svg class="b-ic24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
  var ICON_OFF = '<svg class="b-ic24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
  function sync() {
    var on = enabled();
    Array.prototype.forEach.call(document.querySelectorAll("[data-sfx-toggle]"), function (b) {
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.innerHTML = (on ? ICON_ON : ICON_OFF) + "<span>" + (on ? "효과음 켜짐" : "효과음 꺼짐") + "</span>";
    });
  }
  function addToggle(host, cls) {
    if (!host || host.querySelector("[data-sfx-toggle]")) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = cls; b.setAttribute("data-sfx-toggle", "");
    b.addEventListener("click", function () { var on = !enabled(); setEnabled(on); if (on) { unlock(); play("tap"); } });
    host.appendChild(b);
  }
  function mount() {
    addToggle(document.querySelector("[data-prof-menu]"), "b-profmenu__item b-sfx-toggle");
    addToggle(document.querySelector(".b-menu__panel"), "b-menu__item b-sfx-toggle");
    sync();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  window.addEventListener("storage", function (e) { if (e.key === KEY) sync(); });   // 다른 탭에서 바꾸면 같이 반영

  E.sfx = { play: play, enabled: enabled, toggle: function () { setEnabled(!enabled()); return enabled(); }, unlock: unlock };
})();
