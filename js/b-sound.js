/* EYEQ B안 — 효과음 + 배경음악 (Web Audio 코드 합성 · 음원 파일 없음)
   사용: EYEQ.sfx.play("correct", { n: 4 })  ·  EYEQ.sfx.toggle()  ·  EYEQ.bgm.toggle()
   ---------------------------------------------------------------------------
   효과음
     tap       버튼·메뉴·카드 누름          start    PLAY NOW · Quick Play 출발
     open/close 팝업·메뉴 열림 / 닫힘        page     온보딩 다음·이전
     swipe     홈 캐릭터 넘김 (+ 캐릭터별 시그니처 음 char)
     deny      안 되는 동작 (비활성 버튼 · 입력 오류 · 구매 실패)
     count/go  문제 읽기 3·2·1 / 풀이 시작   tick     남은 시간 3초 이하
     correct · combo2 · combo3(+ n: 4연속 이상은 한 단계씩 높게)
     wrong · break(연속 정답이 끊김) · timeout
     check     미션 진행 칸 완료             ready    게임 준비 완료
     roll/ding 결과 숫자 올라감 / 다 참      fill     레벨 바 차오름
     clear · levelup · buy · equip · badge · rankup(순위 상승)
   배경음악 (기본 꺼짐)
     lobby  홈·스테이지·랭킹·상점·마이페이지·결과 — 잔잔한 코드 + 아르페지오 (84 BPM)
     game   플레이 화면 — 경쾌한 베이스 + 아르페지오 + 하이햇 (112 BPM)
     · 페이지를 옮겨도 박자 위치를 이어서 재생 (sessionStorage) · 큰 효과음이 날 때 잠깐 작아짐(덕킹)
     · 탭이 안 보이면 멈춤 → 돌아오면 이어서
   공통 규칙
   · 설정은 이 기기에 저장 — eyeq.b.sfx ("off" = 효과음 끔) · eyeq.b.bgm ("on" = 배경음악 켬)
   · 모바일 브라우저는 첫 터치 전 소리를 막음 → 첫 터치·클릭·키 입력 때 오디오를 깨움
   · 안드로이드: 정답·오답·클리어 등에 짧은 진동 (효과음을 끄면 진동도 끔 · iPhone 웹은 미지원)
   · 게임 로직·데이터와 무관 (소리만 냄) · 이 파일이 없어도 다른 기능은 그대로 동작
*/
(function () {
  "use strict";
  var E = window.EYEQ = window.EYEQ || {};
  var KEY = "eyeq.b.sfx", KEY_BGM = "eyeq.b.bgm", KEY_POS = "eyeq.b.bgmpos";
  var MASTER = 0.5, BGM_VOL = 0.16;              // 전체 음량 · 배경음악 음량 (0~1)
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, out = null, sfxBus = null, bgmBus = null, pending = null, PITCH = 1;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function enabled() { return store(KEY) !== "off"; }
  function bgmOn() { return store(KEY_BGM) === "on"; }

  /* ---------- 오디오 준비 ---------- */
  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { AC = null; return null; }
      out = ctx.createGain(); out.gain.value = MASTER;
      var comp = ctx.createDynamicsCompressor();
      out.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.connect(out);
      bgmBus = ctx.createGain(); bgmBus.gain.value = 0; bgmBus.connect(out);
    }
    return ctx;
  }
  function running() { return ctx && ctx.state === "running"; }
  function unlock() {
    var c = ensure(); if (!c) return;
    if (c.state !== "running") {
      try { var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) { /* iOS 깨우기 */ }
      c.resume().then(woke, function () {});
    } else woke();
  }
  function woke() {
    if (pending && Date.now() - pending.at < 1500) { var p = pending; pending = null; play(p.name, p.opt); }
    pending = null;
    if (bgmOn()) BGM.start();
  }
  ["pointerdown", "touchend", "keydown"].forEach(function (ev) { window.addEventListener(ev, unlock, { capture: true, passive: true }); });

  /* ---------- 합성 도구 (bus 지정 없으면 효과음 버스) ---------- */
  function tone(f, t, d, o) {
    o = o || {};
    var now = (o.at || ctx.currentTime) + (t || 0);
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(f * (o.raw ? 1 : PITCH), now);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to * (o.raw ? 1 : PITCH), now + d);
    var vol = o.g == null ? 0.3 : o.g, a = o.a || 0.006;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + a);
    if (o.hold) g.gain.setValueAtTime(vol, now + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);
    var node = osc;
    if (o.lp) { var f2 = ctx.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = o.lp; osc.connect(f2); node = f2; }
    node.connect(g); g.connect(o.bus || sfxBus);
    osc.start(now); osc.stop(now + d + 0.03);
  }
  var noiseBuf = null;
  function noise(t, d, from, to, g, o) {
    o = o || {};
    var now = (o.at || ctx.currentTime) + (t || 0);
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    var src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), gn = ctx.createGain();
    src.buffer = noiseBuf; bp.type = o.type || "bandpass"; bp.Q.value = o.q || 1.2;
    bp.frequency.setValueAtTime(from, now); bp.frequency.exponentialRampToValueAtTime(to, now + d);
    gn.gain.setValueAtTime(0.0001, now);
    gn.gain.exponentialRampToValueAtTime(g || 0.12, now + Math.min(0.02, d * 0.3));
    gn.gain.exponentialRampToValueAtTime(0.0001, now + d);
    src.connect(bp); bp.connect(gn); gn.connect(o.bus || sfxBus);
    src.start(now); src.stop(now + d + 0.03);
  }
  function arp(notes, step, d, o) { notes.forEach(function (f, i) { tone(f, i * step, d, o); }); }
  function sparkle(t, g) { tone(2637, t, 0.18, { g: g || 0.06 }); tone(3136, t + 0.05, 0.2, { g: (g || 0.06) * 0.8 }); }
  var semi = function (n) { return Math.pow(2, n / 12); };

  /* 캐릭터 시그니처 (홈에서 고를 때 · 상점 스킨 포함 · 없으면 기본 음) */
  var SIG = {
    FOCUS: function () { arp([523, 659], 0.09, 0.3, { type: "sine", g: 0.16 }); },                 // 차분한 두 음
    EYE:   function () { arp([784, 1047, 784], 0.06, 0.16, { type: "triangle", g: 0.14 }); },      // 호기심 (갸웃)
    SPARK: function () { arp([1319, 1760, 2349], 0.045, 0.18, { type: "triangle", g: 0.12 }); sparkle(0.12, 0.05); },
    NOVA:  function () { tone(440, 0, 0.45, { g: 0.12, to: 880 }); tone(1320, 0.18, 0.3, { g: 0.06 }); },   // 우주 (스윕)
    WISH:  function () { arp([1047, 1397, 1760], 0.08, 0.35, { g: 0.1 }); },
    PIXEL: function () { arp([523, 784, 1047], 0.05, 0.08, { type: "square", g: 0.06, lp: 3000 }); }  // 8비트
  };

  /* ---------- 효과음 정의 ---------- */
  var SOUNDS = {
    tap: function () { tone(1250, 0, 0.06, { g: 0.32, to: 1500, a: 0.003 }); },
    start: function () { noise(0, 0.28, 500, 5000, 0.08); arp([659, 988, 1319], 0.06, 0.22, { type: "triangle", g: 0.24 }); },
    open: function () { noise(0, 0.16, 800, 2600, 0.25); tone(660, 0, 0.14, { g: 0.3, to: 990 }); },
    close: function () { noise(0, 0.14, 2400, 700, 0.2); tone(880, 0, 0.12, { g: 0.26, to: 620 }); },
    page: function () { noise(0, 0.12, 1800, 4200, 0.2, { type: "highpass", q: 0.5 }); tone(1175, 0.02, 0.1, { g: 0.2 }); },
    swipe: function () { noise(0, 0.2, 600, 3600, 0.5, { q: 0.8 }); },
    deny: function () { tone(196, 0, 0.09, { type: "square", g: 0.12, lp: 900 }); tone(175, 0.09, 0.14, { type: "square", g: 0.12, lp: 800 }); },
    count: function () { tone(740, 0, 0.11, { type: "triangle", g: 0.45, a: 0.004 }); },
    go: function () { tone(988, 0, 0.08, { type: "triangle", g: 0.22 }); tone(1480, 0.07, 0.16, { type: "triangle", g: 0.2 }); },
    tick: function () { tone(1600, 0, 0.05, { type: "square", g: 0.3, lp: 3200, a: 0.002 }); },
    ready: function () { arp([784, 1175], 0.07, 0.18, { type: "triangle", g: 0.16 }); },
    check: function () { tone(1568, 0, 0.07, { type: "triangle", g: 0.18 }); tone(2093, 0.05, 0.14, { type: "triangle", g: 0.16 }); },
    correct: function () { arp([1047, 1568], 0.08, 0.2, { type: "triangle", g: 0.26 }); sparkle(0.14); },
    combo2: function () { arp([1047, 1319, 1568], 0.07, 0.22, { type: "triangle", g: 0.25 }); sparkle(0.2, 0.07); },
    combo3: function (o) {
      var up = semi(Math.min(7, Math.max(0, ((o && o.n) || 3) - 3) * 2));   // 4연속부터 한 단계(2반음)씩 높게 · 최대 7반음
      arp([1047 * up, 1319 * up, 1568 * up, 2093 * up], 0.065, 0.26, { type: "triangle", g: 0.25 });
      tone(2093 * up, 0.26, 0.45, { g: 0.1 });
      sparkle(0.3, 0.08); sparkle(0.42, 0.05);
    },
    wrong: function () { tone(392, 0, 0.16, { type: "triangle", g: 0.24, to: 370 }); tone(311, 0.13, 0.26, { type: "triangle", g: 0.22, to: 262 }); },
    "break": function () {                                     // 연속 정답이 끊김: 내려가는 세 음 + 바람 빠지는 소리
      arp([784, 622, 466], 0.09, 0.2, { type: "triangle", g: 0.2 });
      tone(466, 0.27, 0.4, { type: "triangle", g: 0.16, to: 330 });
    },
    timeout: function () { tone(220, 0, 0.42, { type: "sawtooth", g: 0.3, lp: 900, to: 165 }); tone(110, 0, 0.42, { type: "sine", g: 0.35, to: 82 }); },
    roll: function () { tone(2200 + Math.random() * 600, 0, 0.04, { type: "triangle", g: 0.22, a: 0.002, raw: true }); },
    ding: function () { tone(1760, 0, 0.35, { type: "triangle", g: 0.3 }); tone(2637, 0.02, 0.3, { g: 0.1 }); },
    fill: function (o) {                                       // 레벨 바: 길이 d초 동안 음이 올라감
      var d = (o && o.d) || 0.9;
      tone(330, 0, d, { type: "triangle", g: 0.12, to: 1320, a: 0.05, hold: d * 0.8 });
      tone(660, 0, d, { type: "sine", g: 0.06, to: 2640, a: 0.05, hold: d * 0.8 });
    },
    clear: function () {
      arp([523, 659, 784, 1047], 0.09, 0.22, { type: "triangle", g: 0.24 });
      [1047, 1319, 1568].forEach(function (f) { tone(f, 0.38, 0.7, { type: "triangle", g: 0.14 }); });
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
    badge: function () { arp([1568, 2093, 2637], 0.08, 0.3, { g: 0.12 }); tone(1047, 0, 0.5, { type: "triangle", g: 0.08 }); },
    rankup: function () { arp([880, 1109, 1319, 1760], 0.06, 0.2, { type: "triangle", g: 0.18 }); sparkle(0.24, 0.06); },
    "char": function (o) { var f = SIG[o && o.id] || SIG.EYE; f(); }
  };

  /* 같은 소리를 아주 짧은 간격으로 겹쳐 내지 않기 (숫자 올라감 등) */
  var GAP = { roll: 55, ding: 90, tap: 40, tick: 200, check: 120, open: 120, close: 120, deny: 150, swipe: 80 };
  /* 반복해도 기계적으로 안 들리게 살짝씩 다른 음 높이 (±2%) */
  var VARY = { tap: 1, correct: 1, check: 1, count: 0.5, roll: 0, page: 1, swipe: 1 };
  /* 큰 소리 = 배경음악을 잠깐 줄임 */
  var DUCK = { correct: 0.45, combo2: 0.5, combo3: 0.6, wrong: 0.4, "break": 0.5, timeout: 0.5, clear: 1.2, levelup: 1.2, buy: 0.5, equip: 0.5, badge: 0.5, rankup: 0.5, start: 0.4 };
  /* 안드로이드 진동 (ms) */
  var BUZZ = { correct: 25, combo2: [20, 40, 25], combo3: [20, 30, 20, 30, 40], wrong: [60, 40, 60], "break": [60, 40, 90], timeout: 180, clear: [30, 50, 30, 50, 80], levelup: [40, 40, 40, 40, 120], deny: 40, buy: 30, rankup: [25, 40, 25] };
  var lastAt = {};

  function play(name, opt) {
    if (!enabled() || !SOUNDS[name]) return;
    var now = Date.now();
    if (GAP[name] && lastAt[name] && now - lastAt[name] < GAP[name]) return;
    lastAt[name] = now;
    if (BUZZ[name] && navigator.vibrate && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      try { navigator.vibrate(BUZZ[name]); } catch (e) { /* 미지원 */ }
    }
    var c = ensure(); if (!c) return;
    if (!running()) { pending = { name: name, opt: opt, at: now }; c.resume().then(woke, function () {}); return; }
    PITCH = VARY[name] ? 1 + (Math.random() * 2 - 1) * 0.02 * VARY[name] : 1;
    try { SOUNDS[name](opt); } catch (e) { /* 소리 실패는 무시 (게임 진행 우선) */ }
    PITCH = 1;
    if (DUCK[name]) BGM.duck(DUCK[name]);
  }

  /* =========================================================
     배경음악 — 16분음표 단위 시퀀서 (미리 0.2초씩 예약 재생)
     ========================================================= */
  var N = { C3: 131, D3: 147, E3: 165, F3: 175, G3: 196, A3: 220, B3: 247, C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, E6: 1319 };
  function ch(s) { return s.split(" ").map(function (k) { return N[k]; }); }
  var TRACKS = {
    lobby: {                                                    // 잔잔 · Cmaj7 – Am7 – Fmaj7 – G6 (마디당 16칸)
      bpm: 84,
      chords: [ch("C4 E4 G4 B4"), ch("A3 C4 E4 G4"), ch("F3 A3 C4 E4"), ch("G3 B3 D4 E4")],
      bass: [N.C3, N.A3, N.F3, N.G3],
      arp: [0, 2, 1, 3, 2, 1, 3, 2],                            // 코드 안 음 순서 (8분음표)
      step: function (s, t, bar, i) {
        var c = this.chords[bar % 4], dur = 60 / this.bpm / 4;
        if (i === 0) {                                          // 마디 첫 박: 부드러운 패드 + 베이스
          c.forEach(function (f) { tone(f, 0, dur * 16, { at: t, type: "triangle", g: 0.05, a: 0.4, hold: dur * 12, lp: 1400, bus: bgmBus, raw: true }); });
          tone(this.bass[bar % 4] / 2, 0, dur * 8, { at: t, type: "sine", g: 0.14, a: 0.05, hold: dur * 5, bus: bgmBus, raw: true });
        }
        if (i === 8) tone(this.bass[bar % 4] / 2, 0, dur * 7, { at: t, type: "sine", g: 0.1, a: 0.05, hold: dur * 4, bus: bgmBus, raw: true });
        if (i % 2 === 0) {                                      // 8분음표 아르페지오 (한 옥타브 위 · 작게)
          var f = c[this.arp[(i / 2) % 8]] * 2;
          tone(f, 0, dur * 3, { at: t, type: "sine", g: bar % 8 < 4 ? 0.045 : 0.06, a: 0.01, bus: bgmBus, raw: true });
        }
        if (i === 4 || i === 12) noise(0, 0.05, 6000, 8000, 0.012, { at: t, type: "highpass", q: 0.7, bus: bgmBus });   // 살짝 쉐이커
      }
    },
    game: {                                                     // 경쾌 · Am – F – C – G
      bpm: 112,
      chords: [ch("A3 C4 E4"), ch("F3 A3 C4"), ch("C4 E4 G4"), ch("G3 B3 D4")],
      bass: [N.A3, N.F3, N.C3 * 2, N.G3],
      pat: [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 0, 1],
      step: function (s, t, bar, i) {
        var c = this.chords[bar % 4], dur = 60 / this.bpm / 4, b = this.bass[bar % 4] / 2;
        if (i % 4 === 0) {                                      // 4분음표 베이스 (첫 박 강하게)
          tone(b, 0, dur * 3, { at: t, type: "triangle", g: i === 0 ? 0.5 : 0.36, a: 0.005, lp: 700, bus: bgmBus, raw: true });
          if (i % 8 === 0) tone(140, 0, 0.16, { at: t, type: "sine", g: 0.5, to: 45, a: 0.002, bus: bgmBus, raw: true });   // 부드러운 킥
        }
        if (i % 4 === 2) noise(0, 0.04, 7000, 9000, 0.08, { at: t, type: "highpass", q: 0.6, bus: bgmBus });           // 하이햇 (엇박)
        if (i === 4 || i === 12) noise(0, 0.12, 2200, 1400, 0.12, { at: t, q: 0.9, bus: bgmBus });                    // 가벼운 스네어
        var f = c[this.pat[i]] * 2 * (bar % 8 >= 4 && i % 8 === 7 ? 2 : 1);
        tone(f, 0, dur * 1.6, { at: t, type: "square", g: 0.06, a: 0.004, lp: 2400, bus: bgmBus, raw: true });        // 16분음표 아르페지오
      }
    }
  };
  var BGM = (function () {
    var track = null, timer = 0, next = 0, idx = 0, playing = false, duckUntil = 0;
    function name() { return document.documentElement.classList.contains("b-page-game") ? "game" : "lobby"; }
    function stepDur() { return 60 / TRACKS[track].bpm / 4; }
    function schedule() {
      var T = TRACKS[track];
      while (next < ctx.currentTime + 0.2) {
        T.step(idx, next, Math.floor(idx / 16), idx % 16);
        next += stepDur(); idx++;
      }
    }
    function savePos() {
      if (!playing) return;
      try { sessionStorage.setItem(KEY_POS, JSON.stringify({ track: track, idx: idx, at: Date.now() })); } catch (e) { /* 무시 */ }
    }
    function start() {
      if (playing || !bgmOn() || !running() || document.visibilityState === "hidden") return;
      track = name();
      idx = 0;
      try {                                                     // 이전 페이지에서 이어서 (같은 곡 · 30초 이내)
        var p = JSON.parse(sessionStorage.getItem(KEY_POS) || "null");
        if (p && p.track === track && Date.now() - p.at < 30000) idx = (p.idx + Math.round((Date.now() - p.at) / 1000 / stepDur())) % (16 * 8);
      } catch (e) { /* 처음부터 */ }
      idx = Math.ceil(idx / 4) * 4;                              // 박 단위로 맞춰 시작
      next = ctx.currentTime + 0.08;
      playing = true;
      bgmBus.gain.cancelScheduledValues(ctx.currentTime);
      bgmBus.gain.setValueAtTime(0.0001, ctx.currentTime);
      bgmBus.gain.exponentialRampToValueAtTime(BGM_VOL, ctx.currentTime + 1.2);   // 페이드 인
      schedule();
      timer = setInterval(schedule, 50);
    }
    function stop(fast) {
      if (!playing) return;
      savePos();
      playing = false;
      clearInterval(timer);
      if (ctx) {
        bgmBus.gain.cancelScheduledValues(ctx.currentTime);
        bgmBus.gain.setValueAtTime(Math.max(0.0001, bgmBus.gain.value), ctx.currentTime);
        bgmBus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (fast ? 0.05 : 0.5));
      }
    }
    function duck(sec) {
      if (!playing) return;
      var t = ctx.currentTime;
      if (t < duckUntil) return;
      duckUntil = t + sec;
      bgmBus.gain.cancelScheduledValues(t);
      bgmBus.gain.setValueAtTime(Math.max(0.0001, bgmBus.gain.value), t);
      bgmBus.gain.exponentialRampToValueAtTime(BGM_VOL * 0.35, t + 0.05);
      bgmBus.gain.setValueAtTime(BGM_VOL * 0.35, t + sec);
      bgmBus.gain.exponentialRampToValueAtTime(BGM_VOL, t + sec + 0.4);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") stop(true); else if (bgmOn() && running()) start();
    });
    window.addEventListener("pagehide", savePos);
    return { start: start, stop: stop, duck: duck, playing: function () { return playing; } };
  })();

  /* =========================================================
     자동 연결 — 페이지 코드를 건드리지 않고 화면 변화에 맞춰 소리
     ========================================================= */
  var TAP = ".b-gbtn, .b-cta, .b-sbtn, .b-scard, .b-card, .b-nav__item, .b-menu__item, .b-pts, .b-qp, .b-lv, " +
            ".b-rk__tab, .b-rbtn, .b-mytabs button, [data-tab], .b-mycard__more, .b-mylist__row, .b-prof__edit, " +
            ".b-modal__btn, .b-sk__btn, .b-shop button, .b-shop a, .b-back, .b-major__opt, .b-tut button, .b-rfilter__btn, .b-sk__opt, .b-carousel__dot, [data-carousel-dot]";
  /* 전용 소리가 있거나(판정·구매·캐릭터 넘김), 팝업 열림·닫힘 소리로 대신하는 버튼 */
  var NO_TAP = ".b-ans, [data-sk-buy], [data-sk-ok], [data-apply], [data-sfx-toggle], [data-bgm-toggle], [data-carousel-prev], [data-carousel-next], " +
               "[aria-haspopup], [data-menu-toggle], [data-prof-toggle], [data-skill-open], [data-modal-close], [data-sk-close], [data-menu-close], [disabled], [aria-disabled='true']";
  var SPECIAL = [["[data-tut-next], [data-tut-prev]", "page"], ["[data-play], [data-quick]", "start"]];
  document.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target : null; if (!el) return;
    for (var i = 0; i < SPECIAL.length; i++) if (el.closest(SPECIAL[i][0])) { E.sfx.play(SPECIAL[i][1]); return; }
    var t = el.closest(TAP);
    if (!t || t.matches(NO_TAP) || t.closest(NO_TAP)) return;
    E.sfx.play("tap");
  }, true);
  /* 비활성 버튼을 누름 = 거절음 (클릭 이벤트가 오지 않으므로 pointerdown 으로) */
  document.addEventListener("pointerdown", function (e) {
    var b = e.target.closest && e.target.closest("button:disabled, [aria-disabled='true']");
    if (b && !b.closest(".b-ans")) E.sfx.play("deny");          // 답안 카드는 읽기 시간 중 잠김 → 조용히
  }, true);

  /* 팝업·메뉴 열림/닫힘 · 입력 오류 · 경고 문구 표시 */
  var OPENABLE = ".b-modal, .b-menu, .b-profmenu";
  function watch() {
    if (!window.MutationObserver) return;
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        var el = m.target; if (el.nodeType !== 1) return;
        if (m.attributeName === "class") {
          var was = (m.oldValue || "").split(/\s+/), now = el.classList;
          if (el.matches(OPENABLE)) {
            var o0 = was.indexOf("is-open") > -1, o1 = now.contains("is-open");
            if (!o0 && o1) E.sfx.play("open"); else if (o0 && !o1) E.sfx.play("close");
          }
          if (now.contains("is-error") && was.indexOf("is-error") < 0) E.sfx.play("deny");
        } else if (m.attributeName === "hidden") {
          if (el.matches("[role='alert']") && !el.hidden && el.textContent.trim()) E.sfx.play("deny");
        }
      });
    }).observe(document.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["class", "hidden"] });
  }

  /* ---------- 켜기/끄기 (PC = 프로필 메뉴 · 모바일 = 햄버거 메뉴) ---------- */
  var IC = {
    on: '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    off: '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    musicOff: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/><path d="M3.5 3.5l17 17"/>'
  };
  function svg(p) { return '<svg class="b-ic24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>"; }
  function sync() {
    var s = enabled(), m = bgmOn();
    Array.prototype.forEach.call(document.querySelectorAll("[data-sfx-toggle]"), function (b) {
      b.setAttribute("aria-pressed", s ? "true" : "false");
      b.innerHTML = svg(s ? IC.on : IC.off) + "<span>" + (s ? "효과음 켜짐" : "효과음 꺼짐") + "</span>";
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-bgm-toggle]"), function (b) {
      b.setAttribute("aria-pressed", m ? "true" : "false");
      b.innerHTML = svg(m ? IC.music : IC.musicOff) + "<span>" + (m ? "배경음악 켜짐" : "배경음악 꺼짐") + "</span>";
    });
  }
  function setSfx(on) { store(KEY, on ? "on" : "off"); sync(); }
  function setBgm(on) {
    store(KEY_BGM, on ? "on" : "off"); sync();
    if (on) { unlock(); BGM.start(); } else BGM.stop();
  }
  function addToggle(host, cls, attr, fn) {
    if (!host || host.querySelector("[" + attr + "]")) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = cls; b.setAttribute(attr, "");
    b.addEventListener("click", fn);
    host.appendChild(b);
  }
  function mount() {
    [["[data-prof-menu]", "b-profmenu__item b-sfx-toggle"], [".b-menu__panel", "b-menu__item b-sfx-toggle"]].forEach(function (h) {
      var host = document.querySelector(h[0]);
      addToggle(host, h[1], "data-sfx-toggle", function () { var on = !enabled(); setSfx(on); if (on) { unlock(); play("tap"); } });
      addToggle(host, h[1], "data-bgm-toggle", function () { setBgm(!bgmOn()); });
    });
    sync();
    watch();
    if (bgmOn()) { ensure(); if (ctx) ctx.resume().then(woke, function () {}); }   // PC 등 자동 재생이 허용되면 바로 · 아니면 첫 터치 때
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  window.addEventListener("storage", function (e) { if (e.key === KEY || e.key === KEY_BGM) sync(); });

  E.sfx = { play: play, enabled: enabled, toggle: function () { setSfx(!enabled()); return enabled(); }, unlock: unlock };
  E.bgm = { enabled: bgmOn, playing: function () { return BGM.playing(); }, toggle: function () { setBgm(!bgmOn()); return bgmOn(); }, start: function () { BGM.start(); }, stop: function () { BGM.stop(); } };
})();
