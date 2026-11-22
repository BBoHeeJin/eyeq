/* EYEQ B안 — GAME PLAY (공통 엔진 · 스테이지당 미션 3개)
   규칙 출처: Figma Game Board(330:6486) 컴포넌트 설명
   - 문제: b-questions.js 가 스테이지 템플릿으로 생성(FIND / MATCH / PICK, 보기 3 · 정답 1), 카드 안쪽은 b-render.js
   - 카드 클릭 즉시 판정 (정답 확인 단계 없음) → 정답: 피드백 + '다음 문제로' / 오답: 피드백 + '다시 도전하기'
   - XP: 정답 30 → 40 → 50 (연속 정답 콤보), 오답 +5 (미션당 최초 1회, 재시도 오답은 0 · 배지 숨김)
   - 오답 시 콤보 0, '다시 도전하기' = 같은 미션 재시도(Attempt=Retry) · 판정 시 헤더 XP 가산
   - 10초 스피드 게임(서버 설정값): 문제가 플레이 가능해지면 카운트다운 → 카드 클릭(정답·오답) 즉시 정지
     시간 초과 = 오답과 같은 처리('TIME OVER' 피드백, 오답 XP 규칙 그대로 · 미션당 첫 오답만 +5)
     다시 도전·다음 문제 = 새 제한 시간 / 피드백 중 정지 / 새로고침 시 남은 시간 복원(마감 시각 저장)
   - ← 버튼: 미션 2·3 = 직전 문제를 맞힌 상태 그대로 다시 보기(재채점·XP 없음, 풀던 문제 타이머는 멈춤 →
     '다음 문제로'로 돌아오면 남은 시간부터 이어짐) / 미션 1 = STAGE SELECT
   상태 = { stage, seed, questions[3], mission, streak, attempt, selected, phase, deadline, timeLeft } + 기록
          (sessionStorage, 새로고침 시 같은 문제·상태로 복원)
*/
(function () {
  "use strict";
  var E = window.EYEQ;
  var Q = E.questions;

  /* 플레이할 스테이지: STAGE SELECT 에서 고른 값 (플레이 불가면 Typography)
     "quick" = QUICK PLAY (5개 분야 1문제씩 · 같은 엔진 · 미션 수만 5) */
  var QUICK = E.get("session", E.KEY.stage) === "quick";
  var STAGE = QUICK ? { id: "quick", no: "QP", name: "Quick Play" }
                    : (E.stages.playable(E.get("session", E.KEY.stage)) || E.stages.get("typography"));
  var N = QUICK ? 5 : 3;           // 미션 수
  var XP_CORRECT = [30, 40, 50];   // 콤보 1·2·3 (처음 시도 정답만 · LEVEL RACE 규칙)
  /* LEVEL RACE: 오답·시간 초과·재도전 정답 = 0 XP
     온라인 = 서버가 문제 발급 · 정답 판정 · XP · 콤보 · 시간 기록 (브라우저 값은 믿지 않음, 화면은 서버 결과만 표시)
     오프라인(서버 연결 불가 · 프로필 없음) = 로컬 문제 · 로컬 판정 · 레이스/랭킹 미반영 */
  var OL = E.online;
  var TIME = 10000;                // 문제당 제한 시간 (ms) — 온라인 판은 서버가 알려 주는 값(limit_ms)을 그대로 사용
  var WARN = 3000;                 // 남은 시간 경고 색 (10초 → 3초 이하 · 5초 → 2초 이하)
  function setLimit(ms) { TIME = ms > 0 ? ms : TIME; WARN = TIME >= 10000 ? 3000 : 2000; }
  /* 문제 확인(읽기) 단계: 새 문제마다 먼저 3초 동안 문제·보기만 보여 주고(선택 불가) → 끝나면 제한 시간 시작
     오프라인 = 브라우저가 3초 · 온라인 = 서버가 알려 주는 read_ms (서버가 측정 시작 시각을 그만큼 뒤로 미룸 → 읽는 시간은 기록에서 빠짐)
     서버에 읽기 단계가 아직 없으면(read_ms 없음) 온라인 판은 기존처럼 바로 시작 (서버 시간과 어긋나지 않게) */
  var READ = 3000;

  /* ---------- 상태 ---------- */
  function fresh() {
    var run = Q.generateRun(STAGE.id);
    return {
      stage: STAGE.id, seed: run.seed, questions: run.questions, local: run.questions,   // local = 오프라인 전환용 문제
      online: null,                                // 온라인 판: { sid, idx, att, lost } (lost = 도중 오프라인 전환)
      mission: 1, streak: 0, attempt: "first", selected: null, phase: "default", deadline: null, timeLeft: TIME,
      wrongRewarded: {}, firstTry: {}, xpGained: 0, maxCombo: 0, last: null, done: false,
      frontier: 1, log: {}, pending: null,         // 진행한 가장 앞 미션 · 맞힌 미션 기록 · 뒤로 가기 전 풀던 상태
      xpStart: E.getXp(),                          // 판 시작 누적 XP (결과 화면 레벨업 비교용, 지급과 무관)
      playId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),  // 플레이 기록 중복 방지용 고유 ID
      ready: !QUICK                                // QUICK PLAY: 준비 카운트다운이 끝나야 첫 타이머 시작
    };
  }
  /* 저장된 판이 같은 스테이지이고 문제가 유효할 때만 이어서 진행 (이전 버전 기록·손상된 기록은 새 판) */
  function restorable(s) {
    if (!s || s.stage !== STAGE.id || !(s.mission >= 1 && s.mission <= N)) return false;
    if (s.online) return !!s.online.sid && Array.isArray(s.questions) && s.questions.length === N && Q.validRun(STAGE.id, s.local);
    return Q.validRun(STAGE.id, s.questions);
  }
  function normalize(s) {
    if (s.phase === "selected") { s.phase = "default"; s.selected = null; }   // 이전 '선택 후 확인' 단계 기록
    if (typeof s.timeLeft !== "number") s.timeLeft = TIME;                   // 타이머 이전 기록
    if (s.phase !== "default") s.deadline = null;
    if (!s.log) s.log = {};
    if (!(s.frontier >= s.mission)) s.frontier = s.mission;
    if (typeof s.ready !== "boolean") s.ready = true;
    if (s.limit > 0) setLimit(s.limit);                                        // 판 도중 새로고침: 그 판의 제한 시간 유지
    return s;
  }
  var st = E.getJSON("session", E.KEY.run);
  var isNew = !restorable(st);
  st = isNew ? fresh() : normalize(st);
  function save() { E.setJSON("session", E.KEY.run, st); }
  function online() { return !!(st.online && !st.online.lost); }
  function offline() { return !online(); }
  var loading = false, busy = false;               // 서버 응답 대기 중 = 카드 잠금
  var gated = false;                               // 시작 로딩 화면이 떠 있는 동안 = 입력 · 타이머 막기
  var booting = false;                             // 첫 문제(또는 복원 문제) 받기 전 = 카드 숨김
  if (!isNew || !(OL && OL.canPlayOnline())) save();

  /* ---------- 게임 시작 로딩 화면 (새 판만 · 새로고침 복원은 서버 시간이 이미 흐르고 있어 바로 이어서) ----------
     진행률 = 실제 준비 단계의 완료 비율: 화면 리소스(글꼴 · 이미지 디코딩) · 판 만들기(서버) · 연결 확인(지연 측정)
     진행 중인 단계 안에서는 다음 경계의 85%까지만 천천히 차오름(멈춘 것처럼 보이지 않게) → 모두 끝나야 100% → 완료 반응 → 닫힘
     닫히기 전에는 입력 · 타이머 · 문제 발급(serve = 서버 시간 측정 시작) 모두 대기 */
  var goOnline = isNew && OL && OL.canPlayOnline();
  var loader = isNew ? createLoader(goOnline) : null;
  var opened = goOnline ? openSession() : null;    // 판 만들기 요청은 화면 구성보다 먼저 출발 (대기 시간 단축)
  function openSession() {
    var mode = QUICK ? "quick" : "stage";
    return loader.run("session", OL.startGame(mode, STAGE.id).catch(function (err) {
      if (err && err.status === 429) return new Promise(function (r) { setTimeout(r, 2100); }).then(function () { return OL.startGame(mode, STAGE.id); });
      throw err;
    }));
  }
  function noop() {}
  function prepareResources() {
    var jobs = [];
    if (document.fonts && document.fonts.load) {
      ["700 32px Inter", "800 20px Inter", '500 16px "Noto Sans KR"', '700 16px "Noto Sans KR"'].forEach(function (f) {
        jobs.push(document.fonts.load(f, "EYEQ 가나다 0123456789").catch(noop));
      });
    }
    Array.prototype.forEach.call(document.querySelectorAll(".b-bg img, .b-header img, [data-game] img"), function (img) {
      if (img.decode && img.getAttribute("src")) jobs.push(img.decode().catch(noop));
    });
    return Promise.race([Promise.all(jobs), new Promise(function (r) { setTimeout(r, 4000); })]);   // 느린 글꼴 서버 등으로 무한 대기하지 않게
  }
  function createLoader(withServer) {
    var tasks = withServer
      ? [{ id: "res", w: 0.2, msg: "화면을 준비하고 있어요" }, { id: "session", w: 0.6, msg: "문제를 준비하고 있어요" }, { id: "ping", w: 0.2, msg: "서버 연결을 확인하고 있어요" }]
      : [{ id: "res", w: 1, msg: "화면을 준비하고 있어요" }];
    var byId = {};
    tasks.forEach(function (t, i) { t.no = i + 1; t.t0 = 0; t.done = false; byId[t.id] = t; });
    var el = document.createElement("div");
    el.className = "b-load";
    el.innerHTML =
      '<div class="b-load__box">' +
        '<div class="b-load__track" role="progressbar" aria-label="게임 준비" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
          '<span class="b-load__fill"></span>' +
          '<span class="b-load__rider"><span class="b-load__hop"><img class="b-load__char" alt="" /></span></span>' +
        "</div>" +
        '<p class="b-load__msg" role="status" aria-live="polite">게임을 준비하고 있어요</p>' +   // 안내 문구 = 바 아래
        '<p class="b-load__step"></p>' +
        '<p class="b-load__slow" hidden>연결이 평소보다 느려요. 잠시만 기다려 주세요.<br />계속 응답이 없으면 오프라인 플레이로 시작해요.</p>' +
      "</div>";
    document.body.appendChild(el);
    var msgEl = el.querySelector(".b-load__msg"), stepEl = el.querySelector(".b-load__step"), slowEl = el.querySelector(".b-load__slow");
    var track = el.querySelector(".b-load__track"), img = el.querySelector(".b-load__char");
    img.addEventListener("load", function () { el.classList.add("has-char"); });
    img.src = E.charImg(E.getCharacter());                                   // 헤더 캐릭터와 같은 파일 (추가 다운로드 없음)
    /* 로딩 중에는 뒤 화면 조작 불가 (키보드 포커스 포함) */
    var inerted = [];
    Array.prototype.forEach.call(document.body.children, function (c) {
      if (c !== el && c.tagName !== "SCRIPT" && !c.inert) { c.inert = true; inerted.push(c); }
    });
    gated = true;
    var shown = 0, lastMsg = "", lastStep = "", done = null, finishP = null, failed = false, raf2 = 0;
    var slowT = setTimeout(function () { if (!finishP) slowEl.hidden = false; }, 6000);
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function target() {
      var p = 0, now = Date.now();
      tasks.forEach(function (t) {
        if (t.done) p += t.w;
        else if (t.t0) p += t.w * 0.85 * (1 - Math.exp(-(now - t.t0) / 1600));
      });
      return Math.min(1, p);
    }
    var lastTs = 0;
    function frame(ts) {
      var dt = lastTs ? Math.min(100, ts - lastTs) : 16;
      lastTs = ts;
      var tg = target();
      if (done) shown = Math.min(1, shown + dt / 160);                        // 준비 끝 → 0.16초 안에 100%
      else if (tg > shown) shown = tg - shown < 0.003 ? tg : shown + (tg - shown) * (1 - Math.exp(-dt / 110));   // 부드럽게 · 뒤로 가지 않음
      el.style.setProperty("--p", shown.toFixed(4));
      track.setAttribute("aria-valuenow", String(Math.round(shown * 100)));
      var cur = null;
      for (var i = 0; i < tasks.length; i++) if (!tasks[i].done) { cur = tasks[i]; break; }
      var m = failed ? "오프라인 플레이로 시작해요" : cur ? cur.msg : "거의 다 됐어요";
      if (m !== lastMsg) { msgEl.textContent = m; lastMsg = m; }
      var sp = tasks.length > 1 && cur ? cur.no + " / " + tasks.length + " 단계" : "";
      if (sp !== lastStep) { stepEl.textContent = sp; lastStep = sp; }
      if (done && shown >= 0.999) { complete(); return; }
      raf2 = requestAnimationFrame(frame);
    }
    function complete() {
      clearTimeout(slowT);
      slowEl.hidden = true;
      el.style.setProperty("--p", "1");
      track.setAttribute("aria-valuenow", "100");
      if (!failed) { msgEl.textContent = "준비 완료!"; stepEl.textContent = ""; }
      el.classList.add("is-done");                                            // 완료 반응 (캐릭터 점프 · 바 빛남)
      setTimeout(function () {
        el.classList.add("is-out");
        inerted.forEach(function (c) { c.inert = false; });
        gated = false;
        done();                                                               // 게임 화면이 드러나는 순간부터 다음 단계(카운트다운 · 문제 발급)
        setTimeout(function () { el.remove(); }, 300);
      }, reduce ? 120 : 400);
    }
    raf2 = requestAnimationFrame(frame);
    return {
      run: function (id, promise) {
        var t = byId[id];
        if (!t) return promise;
        t.t0 = Date.now();
        return promise.then(function (v) { t.done = true; return v; }, function (e) { t.done = true; throw e; });
      },
      /* 모든 준비가 끝났을 때 한 번만 (두 번 불러도 같은 약속) */
      finish: function (fail) {
        if (finishP) return finishP;
        failed = !!fail;
        tasks.forEach(function (t) { t.done = true; });
        finishP = new Promise(function (res) { done = res; });
        return finishP;
      }
    };
  }

  /* ---------- 요소 ---------- */
  var $ = function (s) { return document.querySelector(s); };
  var root = $("[data-game]");
  var progress = $("[data-progress]");
  var title = $("[data-title]");
  var titleH = title.querySelector(".b-gtitle__h");
  var desc = $("[data-mission-desc]");
  var fb = $("[data-feedback]");
  var answers = $(".b-answers");
  var cards = root.querySelectorAll(".b-ans");
  var action = $("[data-action]");
  var live = $("[data-live]");
  var timerEl = $("[data-timer]");
  var timerText = $("[data-timer-text]");
  var timerRead = $("[data-timer-read]");
  var titleTop = $(".b-gtitle__top");
  var back = $(".b-back");
  var insight = $("[data-insight]");
  var canvas = $(".b-canvas");
  var mqCompact = window.matchMedia("(max-width: 1023px)");

  /* QUICK PLAY: 진행 표시 5단계 (기존 노드 복제 · 같은 영역 안에서 간격만 조정) + 분야 표시
     모드 줄(QUICK 분야 · 오프라인 표시)은 필요할 때만 생성 → 온라인 스테이지 판은 기존 화면 그대로 */
  var modeEl = null;
  function modeText(m) {
    var t = QUICK ? "QUICK PLAY" : "";                                       // 분야는 문제 유형 배지에 표시
    var off = st.online && st.online.lost ? "오프라인 전환 · 일부 랭킹 미반영"      // 온라인 판 도중 연결 끊김
            : offline() && !loading ? "오프라인 플레이 · 랭킹 미반영" : "";
    return t + (off ? (t ? " · " : "") + off : "");
  }
  function drawMode(m) {
    var t = modeText(m);
    if (t && !modeEl) {
      modeEl = document.createElement("p");
      modeEl.className = "b-gtitle__mode";
      titleTop.appendChild(modeEl);                                         // 배지 옆 작은 글씨 (제목 위치 그대로)
    }
    if (modeEl) { modeEl.textContent = t; modeEl.hidden = !t; }
  }
  if (QUICK) {
    progress.classList.add("is-5");
    var n3 = progress.querySelector('[data-node="3"]'), l3 = progress.querySelector('[data-label="3"]');
    for (var q = 4; q <= N; q++) {
      var nn = n3.cloneNode(true); nn.setAttribute("data-node", q); progress.insertBefore(nn, progress.querySelector('[data-label="1"]'));
      var ll = l3.cloneNode(true); ll.setAttribute("data-label", q); ll.textContent = "0" + q; progress.appendChild(ll);
    }
  }

  /* 스테이지 이름 (스크린리더) */
  var stageLabel = root.querySelector(".b-sr-only");
  if (stageLabel && !stageLabel.hasAttribute("data-live")) stageLabel.textContent = "STAGE " + STAGE.no + " " + STAGE.name;

  /* 답안 카드 틀 (공용) — 안쪽 내용(.b-ans__copy)은 렌더러가 채움 */
  Array.prototype.forEach.call(cards, function (el) {
    var L = el.getAttribute("data-letter");
    el.innerHTML =
      '<span class="b-ans__badge">' + L + "</span>" +
      '<span class="b-ans__copy"></span>' +
      '<span class="b-ans__status b-ans__status--check"><img class="b-pc" src="assets/b/card-check.svg" alt="" /><img class="b-mo" src="assets/b/card-check-mobile.svg" alt="" /></span>' +
      '<span class="b-ans__status b-ans__status--x"><img class="b-pc" src="assets/b/card-x.svg" alt="" /><img class="b-mo" src="assets/b/card-x-mobile.svg" alt="" /></span>';
    el.addEventListener("click", function () { pick(L); });
  });

  /* ---------- 타이머 (마감 시각 기준 → 새로고침해도 남은 시간 유지) ---------- */
  var raf = 0;
  /* 마감 시각(deadline) = 읽기 끝 시각(readUntil) + 제한 시간 → 새로고침·뒤로 가기 복귀에도 같은 단계 · 같은 시간 */
  function remaining() { return st.deadline ? Math.max(0, Math.min(TIME, st.deadline - Date.now())) : Math.max(0, Math.min(TIME, st.timeLeft)); }
  function readLeft() { return st.phase === "default" && st.deadline && st.readUntil ? Math.max(0, st.readUntil - Date.now()) : 0; }
  function reading() { return readLeft() > 0; }
  var wasReading = null, lastSec = null;
  var sfx = function (n) { if (E.sfx) E.sfx.play(n); };   // 효과음 (b-sound.js · 없으면 무시)
  function drawTimer() {
    var r = readLeft();
    if (r > 0) {                                                            // 문제 확인: 3 → 2 → 1 (풀이 시간 차감 없음)
      timerText.textContent = String(Math.ceil(r / 1000));
      if (wasReading !== true) lastSec = null;                           // 새 문제 → 카운트 처음부터
      if (Math.ceil(r / 1000) !== lastSec) { lastSec = Math.ceil(r / 1000); sfx("count"); }   // 읽기 3 · 2 · 1
      timerEl.style.setProperty("--t", (r / Math.max(1, st.readMs || READ)).toFixed(4));
      timerEl.classList.remove("is-warn");
    } else {
      var ms = remaining();
      var s = Math.ceil(ms / 100) / 10;                                   // 10.0s → 9.9s → … → 0.0s (앞자리 0 없음 · 숫자 폭 고정 = tabular-nums)
      timerText.textContent = s.toFixed(1) + "s";
      timerEl.style.setProperty("--t", (ms / TIME).toFixed(4));
      timerEl.classList.toggle("is-warn", ms <= WARN);
      if (wasReading !== false) lastSec = null;
      var sec = Math.ceil(ms / 1000);                                     // 경고 구간(마지막 3초)에서 1초마다 똑딱
      if (ms <= WARN && ms > 0 && st.phase === "default" && sec !== lastSec) { lastSec = sec; sfx("tick"); }
    }
    setReading(r > 0);
  }
  /* 단계 전환 (읽기 ↔ 풀이): 위치 변화 없이 색 · 글자만 부드럽게 바뀜 */
  function setReading(on) {
    if (on === wasReading) return;
    var first = wasReading === null;
    wasReading = on;
    timerEl.classList.toggle("is-read", on);
    answers.classList.toggle("is-reading", on);
    timerEl.setAttribute("aria-label", on ? "문제 확인 시간" : "남은 시간");
    applyLock();
    if (!first && !on && st.phase === "default") {
      answers.classList.remove("is-go"); void answers.offsetWidth; answers.classList.add("is-go");   // 풀이 시작 신호 (짧게)
      sfx("go");
      live.textContent = "문제 풀이를 시작하세요.";
    } else if (on) live.textContent = "문제를 읽어보세요. " + Math.ceil(readLeft() / 1000) + "초 뒤에 선택할 수 있어요.";
  }
  function tick() {
    cancelAnimationFrame(raf);
    if (!st.deadline || st.phase !== "default") { drawTimer(); return; }
    if (!reading() && remaining() <= 0) { timeout(); return; }
    drawTimer();
    raf = requestAnimationFrame(tick);
  }
  /* 새 문제(오프라인): 읽기 3초 → 제한 시간. 온라인 문제는 applyServed 가 서버 값으로 정함 */
  function startTimer() {
    var now = Date.now();
    st.readMs = READ;
    st.readUntil = now + READ;
    st.timeLeft = TIME;
    st.deadline = st.readUntil + TIME;
    save(); tick(); preloadFaces();
  }
  function stopTimer() { st.timeLeft = remaining(); st.deadline = null; st.readUntil = null; cancelAnimationFrame(raf); }
  /* 플레이 가능한 상태(판정 전)가 되면 시작 · 이미 진행 중이면 이어서 · 피드백 중이면 멈춘 시간 표시 */
  function syncTimer() {
    if (st.phase === "default") { if (st.deadline) tick(); else startTimer(); }
    else { cancelAnimationFrame(raf); drawTimer(); }
  }
  /* 페이지를 떠날 때 타이머 정리 (뒤로 가기 캐시 복귀 시 pageshow 에서 다시 이어짐) */
  window.addEventListener("pagehide", function () { cancelAnimationFrame(raf); });

  /* ---------- 긴 제목·설명 맞춤: 한 줄을 넘으면 글자 크기만 비례 축소 (모바일 좌우 20 · PC 가운데 영역) ---------- */
  function textWidth(el) {
    var r = document.createRange();
    r.selectNodeContents(el);
    return r.getBoundingClientRect().width;
  }
  function fit(el, max) {
    el.style.fontSize = "";
    if (el.hidden || !el.offsetParent) return;
    var w = textWidth(el);
    if (w > max) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * max / w).toFixed(2) + "px";
  }
  function fitTexts() {
    var compact = mqCompact.matches;
    var k = canvas.getBoundingClientRect().width / (compact ? 390 : 1920);
    var max = (compact ? 350 : 816) * k;                                    // PC: 제목 = 타이머와 미션 진행 사이 가운데 칸 (좌우 대칭 폭)
    fit(titleH, max);
    if (modeEl && !modeEl.hidden) fit(modeEl, max);                       // 안내 줄이 길면 글자 크기만 축소 (한 줄 유지)
  }
  var fitTimer = 0;
  window.addEventListener("resize", function () { clearTimeout(fitTimer); fitTimer = setTimeout(fitTexts, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTexts);

  function descOf(m) { var T = m && m.tid && Q.template(m.tid); return (T && T.desc) || (m && m.desc) || ""; }

  /* ---------- 렌더 ---------- */
  function isLocked() { return st.phase === "correct" || st.phase === "wrong" || !st.ready || loading || busy || reading(); }
  /* 잠금만 다시 계산 (카드 내용은 그대로 → 읽기 → 풀이 전환 때 깜빡임 없음) */
  function applyLock() {
    var locked = isLocked();
    answers.classList.toggle("is-locked", locked);
    Array.prototype.forEach.call(cards, function (el) { if (locked) el.setAttribute("aria-disabled", "true"); else el.removeAttribute("aria-disabled"); });
  }
  function render(animate) {
    var m = st.questions[st.mission - 1];
    var completed = st.mission === N && st.phase === "correct";
    drawMode(m);
    answers.style.visibility = m && !booting ? "" : "hidden";        // 서버 문제 받기 전: 자리만 유지 (레이아웃 변화 없음)
    title.style.visibility = m && !booting ? "" : "hidden";
    if (!m) {
      answers.classList.add("is-locked");
      action.disabled = true;
      return;
    }

    // Mission Progress: 현재 = 링, 완료 = 체크, 예정 = 비활성
    var fill = completed ? 1 : (st.mission - 1) / (N - 1);
    progress.style.setProperty("--fill", fill);
    for (var i = 1; i <= N; i++) {
      var node = progress.querySelector('[data-node="' + i + '"]');
      var label = progress.querySelector('[data-label="' + i + '"]');
      var done = i < st.mission || completed;
      var cur = !done && i === st.mission;
      node.classList.toggle("is-done", done);
      node.classList.toggle("is-current", cur);
      label.classList.toggle("is-on", done || cur);
    }

    var T = (m.tid && Q.template(m.tid)) || {};                       // 화면 문구(제목·설명·정답 설명)는 이 사이트의 문제 템플릿 기준 — 판정·정답은 서버 그대로
    var t = T.title || m.title || Q.TITLES[m.type] || Q.TITLES.FIND;  // 미션 제목 [앞, 강조, 뒤] (없으면 유형 기본)
    titleH.textContent = t[0];
    var em = document.createElement("em");
    em.className = "b-gtitle__accent";
    em.textContent = t[1];
    titleH.appendChild(em);
    titleH.appendChild(document.createTextNode(t[2]));
    desc.textContent = T.desc || m.desc;                              // 판단 기준 설명 = 스크린리더용 (화면은 제목 한 문장)

    /* 말풍선 한 줄: 정답 = 정답인 이유 · 오답/시간 초과 = 다시 볼 곳 힌트 (정답은 알려 주지 않음 → 다시 도전 유지) */
    var why = T.insight || m.insight || "", hint = T.hint || "";
    /* 기존 오답 처리(다시 도전 · 정답 미공개)는 그대로
       - 오답: 고른 카드는 아니라는 것 + 다시 볼 곳 힌트 (정답은 알려 주지 않음)
       - 시간 초과: 시간 안내 + 힌트
       - 재도전 성공: 이제 맞혔으니 정답 번호 + 정답인 이유 */
    var said = "";
    if (st.phase === "correct") said = st.attempt === "retry" && st.selected ? st.selected + "번이 정답이에요! " + why : why;
    else if (st.phase === "wrong") said = st.last && st.last.timeout ? "시간이 다 됐어요. " + hint : (st.selected ? st.selected + "번은 아니에요. " : "") + hint;
    insight.textContent = said;

    var showFb = st.phase === "correct" || st.phase === "wrong";
    title.hidden = showFb;
    fb.hidden = !showFb;
    if (showFb) renderFeedback(animate);

    // 답안 카드 상태
    var locked = isLocked();                                          // 준비 카운트다운 · 서버 응답 대기 · 문제 확인(읽기) 중 선택 불가
    answers.classList.toggle("is-locked", locked);
    Array.prototype.forEach.call(cards, function (el, i) {
      var L = el.getAttribute("data-letter");
      E.render.into(el.querySelector(".b-ans__copy"), m.render, m.options[i].props, m.copy);
      var isSel = st.selected === L;
      el.classList.toggle("is-selected", (st.phase === "selected" || busy) && isSel);
      el.classList.toggle("is-correct", st.phase === "correct" && isSel);
      el.classList.toggle("is-wrong", st.phase === "wrong" && isSel);
      el.classList.toggle("is-dim", st.phase === "selected" && !isSel);
      el.classList.toggle("is-faded", st.phase === "correct" && !isSel);
      el.setAttribute("aria-checked", isSel && st.phase !== "default" ? "true" : "false");
      el.setAttribute("aria-label", "보기 " + L);
      if (locked) el.setAttribute("aria-disabled", "true"); else el.removeAttribute("aria-disabled");
    });

    // 게임 버튼 (카드 클릭 즉시 판정): Disabled(판정 전) / Active(다음·결과) / Secondary(다시 도전)
    action.classList.remove("is-active", "is-secondary");
    action.disabled = false;
    var nextLabel = st.mission === N ? "결과 보기 →" : "다음 문제로 →";
    updateBack();
    if (st.phase === "default" || busy || loading) { action.disabled = true; if (st.phase === "default") action.textContent = nextLabel; }
    else if (st.phase === "correct") { action.textContent = nextLabel; action.classList.add("is-active"); }
    else { action.textContent = "다시 도전하기 →"; action.classList.add("is-secondary"); }
    fitTexts();
  }

  /* 피드백 표정 미리 불러오기 (판정 순간 깜빡임 방지) — 시작 직후 서버 요청과 대역폭을 다투지 않도록 첫 문제가 보인 뒤 한가할 때 */
  var facesLoaded = false;
  function preloadFaces() {
    if (facesLoaded) return;
    facesLoaded = true;
    var go = function () { ["happy", "sad"].forEach(function (m) { new Image().src = E.charImg(E.getCharacter(), m); }); };
    if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 300);
  }
  function renderFeedback(animate) {
    var last = st.last || { correct: true, combo: 1, xp: 30 };
    var type = !last.correct ? "wrong" : last.combo >= 3 ? "combo3" : last.combo === 2 ? "combo2" : "correct";
    fb.setAttribute("data-type", type);
    fb.querySelector("[data-fb-title]").textContent =
      type === "wrong" ? (last.timeout ? "TIME OVER" : "NICE TRY!") : type === "combo3" ? "AMAZING!" : type === "combo2" ? "PERFECT!" : "GREAT!";
    var combo = fb.querySelector("[data-fb-combo]");
    combo.hidden = type.indexOf("combo") !== 0;
    combo.textContent = last.combo + " COMBO";                       // 일반 3문제 = 최대 3 · QUICK PLAY = 최대 5
    var xp = fb.querySelector("[data-fb-xp]");
    var retryWin = last.correct && st.attempt === "retry";           // 재도전 성공 = 0 XP (기존 규칙) → XP 대신 "다시 도전 성공"
    xp.hidden = last.xp <= 0 && !retryWin;          // 오답: XP 배지 숨김
    xp.textContent = retryWin ? "다시 도전 성공" : "+" + last.xp + " XP";
    xp.classList.toggle("is-red", !last.correct);
    xp.classList.toggle("is-retry", retryWin);
    /* 정답 왼쪽 그룹: 결과 문구·XP를 그대로 복사해 크게 표시 (표시 전용 · 판정/XP 로직과 무관) */
    var big = fb.querySelector("[data-fb-big]");
    if (big) big.textContent = fb.querySelector("[data-fb-title]").textContent;
    var bigXp = fb.querySelector("[data-fb-big-xp]");
    if (bigXp) { bigXp.textContent = xp.textContent; bigXp.hidden = xp.hidden; bigXp.classList.toggle("is-retry", retryWin); }
    fb.querySelector("[data-react-char]").setAttribute("src", E.charImg(E.getCharacter(), last.correct ? "happy" : "sad"));   // 맞힘 = 기쁜 표정 · 틀림/시간 초과 = 슬픈 표정
    fb.querySelector("[data-react-face]").hidden = true;            // 표정은 캐릭터 이미지에 포함 → 예전 얼굴 겹침 이미지 사용 안 함
    if (animate) {
      sfx(type !== "wrong" ? type : last.timeout ? "timeout" : "wrong");   // 판정 효과음 (정답 · 2연속 · 3연속 · 오답 · 시간 초과)
      fb.classList.remove("is-in");
      void fb.offsetWidth;
      fb.classList.add("is-in");
    }
  }

  /* ---------- 동작 ---------- */
  /* 카드 클릭 = 즉시 판정 (판정 후에는 잠금) */
  function pick(L) {
    if (st.phase !== "default" || !st.ready || loading || busy || gated || reading()) return;   // gated = 시작 로딩 화면 · reading = 문제 확인 3초
    if (st.deadline && remaining() <= 0) { timeout(); return; }            // 마감 직후 클릭 = 시간 초과
    stopTimer();
    drawTimer();                                                            // 누른 순간의 시간으로 멈춤
    st.selected = L;
    if (online()) judgeOnline(L); else check();
  }
  /* 시간 초과 = 고른 카드 없는 오답 */
  function timeout() {
    if (st.phase !== "default" || busy) return;
    stopTimer();
    st.timeLeft = 0;
    st.selected = null;
    drawTimer();                                                            // 0.0s 로 멈춤
    if (online()) judgeOnline(null); else resolve(false, true);
  }

  function check() {
    resolve(Q.judge(st.questions[st.mission - 1], st.selected), false);
  }

  /* ---------- 온라인 판정 (서버) ----------
     브라우저는 고른 보기 · 측정 시간만 보냄. 정답 여부 · XP · 콤보 · 기록 시간은 서버 응답 그대로 표시 */
  function judgeOnline(L) {
    busy = true;
    var clientMs = L ? Math.max(0, Math.round(TIME - st.timeLeft)) : null;
    st.judging = { letter: L };
    save();
    render(false);
    OL.answer(st.online.sid, st.online.idx, st.online.att, L, clientMs).then(function (res) {
      busy = false;
      st.judging = null;
      applyProgress(res.progress);
      if (res.session) {
        st.xpGained = res.session.xp;
        st.maxCombo = res.session.combo_max;
        st.firstCorrect = res.session.first_correct;
        st.playMs = res.session.play_ms;
      }
      var m = st.questions[st.mission - 1];
      if (res.correct && res.insight) m.insight = res.insight;
      if (res.timeout) st.selected = null;
      settle(!!res.correct, !!res.timeout, res.xp || 0, res.streak || 0);
      if (res.correct && E.skins) E.skins.refresh();                 // 정답 포인트는 서버가 지급 → 헤더 포인트 즉시 갱신 (판정·지급 방식은 그대로)
    }, function (err) {
      busy = false;
      st.judging = null;
      var em = err && err.data && err.data.message;
      if (em === "stale" || em === "too_early") return resumeOnline();      // 이미 처리된 제출 · 서버 읽기 시간 전 제출 → 서버 상태로 맞춤
      goOffline();
    });
  }
  function applyProgress(p) {
    if (!p || typeof p.xp !== "number") return;
    var r = E.getRace() || {};
    E.setRace({ xp: p.xp, level: p.level, play_ms: p.play_ms, maxed: p.maxed, final_ms: p.final_ms, maxed_at: p.maxed_at,
                review: r.review, user_id: r.user_id });
  }

  function resolve(correct, timedOut) {
    var gained = 0, streak = 0;                                      // 오답·시간 초과 = 0 XP · 콤보 0
    if (correct && st.attempt === "first") { streak = st.streak + 1; gained = XP_CORRECT[Math.min(streak, 3) - 1]; }
    // 재도전 정답 = 0 XP · 콤보에도 넣지 않음 (streak 0)
    if (!st.online) st.xpGained += gained;                         // 도중 오프라인 전환 판: 결과 XP = 서버가 지급한 XP만
    settle(correct, timedOut, gained, streak);
  }
  /* 판정 결과 반영 (온라인 = 서버 값 · 오프라인 = 로컬 값) */
  function settle(correct, timedOut, gained, streak) {
    st.streak = streak;
    st.solveMs = (st.solveMs || 0) + Math.max(0, Math.min(TIME, TIME - st.timeLeft));   // 개인 기록용 풀이 시간 (브라우저 측정 · 공식 기록 아님)
    if (correct) {
      st.maxCombo = Math.max(st.maxCombo, streak);
      if (st.attempt === "first") st.firstTry[st.mission] = true;
      st.phase = "correct";
    } else st.phase = "wrong";
    st.last = { correct: correct, combo: correct ? streak : 0, xp: gained, timeout: !!timedOut };
    if (correct) st.log[st.mission] = { selected: st.selected, last: st.last, timeLeft: st.timeLeft };   // ← 로 다시 볼 때 사용
    save();
    render(true);
    live.textContent = correct
      ? "정답입니다. " + gained + " XP를 얻었어요."
      : (timedOut ? "시간이 끝났어요." : "오답입니다.") + (gained ? " " + gained + " XP를 얻었어요." : "") + " 다시 도전해 보세요.";
  }

  /* ---------- ← 이전 문제 / 다음 문제 (다시 보기) ---------- */
  function showReview(m) {
    var L = st.log[m];
    st.mission = m;
    st.phase = "correct";
    st.selected = L.selected;
    st.last = L.last;
    st.timeLeft = L.timeLeft;
    st.deadline = null;
    save();
    render(false);
    syncTimer();
    live.textContent = "미션 " + m + " / " + N + " 다시 보기.";
  }
  function prev() {
    if (st.mission <= 1) return false;
    if (loading || busy || !st.log[st.mission - 1]) return true;           // 응답 대기 · 다시 볼 기록 없음 → 그대로
    /* 온라인: 서버 타이머가 도는 중(판정 전)에는 이전 문제로 이동 불가 → 지금 문제를 푼 뒤(정답·오답 결과 화면)에만 다시 보기
       서버 타이머는 멈추거나 되돌리지 않음 · 다시 보기는 저장된 결과만 보여 줌(재채점·XP 없음) */
    if (online() && st.mission === st.frontier && st.phase === "default") {
      live.textContent = "지금 문제를 푼 뒤에 이전 문제를 다시 볼 수 있어요.";
      return true;
    }
    if (st.mission === st.frontier) {                                       // 풀던 문제 보관 (오프라인 = 타이머 멈춤)
      st.pending = { phase: st.phase, selected: st.selected, last: st.last, attempt: st.attempt, timeLeft: remaining(), reread: reading() };
      cancelAnimationFrame(raf);
    }
    showReview(st.mission - 1);
    return true;
  }
  function restorePending() {
    var P = st.pending;
    st.mission = st.frontier;
    st.phase = P.phase;
    st.selected = P.selected;
    st.last = P.last;
    st.attempt = P.attempt;
    st.timeLeft = P.timeLeft;
    st.deadline = P.phase === "default" && !P.reread ? Date.now() + P.timeLeft : null;  // 오프라인만 해당 (온라인은 판정 후에만 다시 보기) · 읽던 중이면 읽기부터 다시
    st.readUntil = null;
    st.pending = null;
    save();
    render(false);
    syncTimer();
  }
  function updateBack() {
    var wait = online() && st.mission > 1 && st.mission === st.frontier && (st.phase === "default" || busy || loading);
    back.setAttribute("aria-label", st.mission > 1 ? (wait ? "이전 문제 보기 (지금 문제를 푼 뒤 가능)" : "이전 문제 보기") : "스테이지 선택으로 돌아가기");
  }

  function next() {
    if (loading || busy) return;
    if (st.mission < st.frontier) {                                         // 다시 보던 중 → 다음 미션
      if (st.mission + 1 === st.frontier && st.pending) restorePending();
      else showReview(st.mission + 1);
      return;
    }
    if (st.mission === N) {
      var correctCount = 0;
      for (var i = 1; i <= N; i++) if (st.firstTry[i]) correctCount++;
      if (online() && typeof st.firstCorrect === "number") correctCount = st.firstCorrect;   // 서버 집계
      st.done = true;
      if (!st.playId) st.playId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);   // 이전 버전 진행 기록
      save();
      var rec = {                                                // 마이페이지 기록 (같은 ID는 한 번만)
        id: st.playId, stage: st.stage, at: Date.now(),
        correct: correctCount, total: N, xp: st.xpGained, maxCombo: st.maxCombo,
        res: [], solveMs: Math.round(st.solveMs || 0)            // 미션별 첫 시도 정답 여부(영역별 정답률) · 풀이 시간 합(개인 기록)
      };
      for (var k = 1; k <= N; k++) rec.res.push(!!st.firstTry[k]);
      if (QUICK) { rec.mode = "quick"; rec.stages = st.questions.map(function (x) { return x.stage; }); }
      if (offline()) rec.offline = true;                         // 랭킹 미반영 기록 (도중 전환 포함)
      if (st.online && st.online.sid) { rec.session = st.online.sid; if (typeof st.playMs === "number") rec.playMs = st.playMs; }
      E.addPlay(rec);
      E.setJSON("session", E.KEY.result, {
        stage: st.stage, character: E.getCharacter(), mode: QUICK ? "quick" : "stage", offline: offline(),
        partial: !!(st.online && st.online.lost), playMs: online() ? st.playMs : null,
        xp: st.xpGained, maxCombo: st.maxCombo, correct: correctCount, total: N,
        xpStart: st.xpStart, xpEnd: E.getXp()
      });
      window.location.href = "result.html";
      return;
    }
    if (online()) { fetchQuestion(); return; }                           // 서버가 다음 문제 발급
    st.mission += 1;
    st.frontier = st.mission;
    st.pending = null;
    st.attempt = "first";
    st.selected = null;
    st.phase = "default";
    st.last = null;
    st.deadline = null;
    save();
    render(false);
    syncTimer();
    live.textContent = "미션 " + st.mission + " / " + N + ". " + descOf(st.questions[st.mission - 1]);
  }

  function retry() {
    if (loading || busy) return;
    if (online()) { fetchQuestion(); return; }                           // 서버가 같은 문제 재발급 (재도전 = 0 XP)
    st.attempt = "retry";
    st.selected = null;
    st.phase = "default";
    st.last = null;
    st.deadline = null;
    save();
    render(false);
    syncTimer();
    live.textContent = "같은 미션을 다시 풀어 보세요.";
  }

  /* ---------- 온라인 진행 (서버 문제 받기 · 새로고침 복원 · 오프라인 전환) ---------- */
  /* 서버가 발급한 문제 표시: 남은 시간은 서버 기준 (새로고침해도 시간이 되돌아가지 않음) */
  function applyServed(res) {
    var idx = res.index, m = idx + 1;
    booting = false;
    st.online.idx = idx;
    st.online.att = res.attempt;
    if (res.question) st.questions[idx] = res.question;
    if (m > st.frontier) { st.frontier = m; }
    st.mission = m;
    st.pending = null;
    st.attempt = res.attempt > 1 ? "retry" : "first";
    st.selected = null;
    st.last = null;
    if (res.expired) {                                                      // 자리를 비운 사이 시간 초과로 기록됨
      applyProgress(res.progress);
      st.timeLeft = 0;
      st.deadline = null;
      if (!st.questions[idx]) return fetchQuestion();
      loading = false;
      settle(false, true, 0, 0);
      drawTimer();
      return;
    }
    st.phase = "default";
    setLimit(res.limit_ms || 5000);                                           // 서버 제한 시간 (limit_ms 없는 이전 서버 = 5초)
    st.limit = TIME;
    var rd = Math.max(0, +res.read_ms || 0), now = Date.now();               // 서버 읽기 단계 남은 시간 (없으면 0 = 바로 풀이)
    st.readMs = +res.read_total_ms || rd || READ;
    st.readUntil = rd ? now + rd : null;
    st.timeLeft = res.remaining_ms;
    st.deadline = now + rd + res.remaining_ms;
    loading = false;
    save();
    render(false);
    if (st.ready) syncTimer(); else drawTimer();
    live.textContent = "미션 " + st.mission + " / " + N + ". " + descOf(st.questions[idx]);
  }
  function fetchQuestion() {
    loading = true;
    render(false);
    return OL.serve(st.online.sid).then(applyServed, function (err) {
      loading = false;
      var msg = err && err.data && err.data.message;
      if (msg === "session_closed" && st.mission === N && st.phase === "correct") { render(false); return; }
      goOffline();
    });
  }
  /* 새로고침 · 다시 열기: 서버에 지금 상태를 물어 같은 문제 · 남은 시간으로 이어서 */
  function resumeOnline() {
    if (st.phase === "correct" || st.phase === "wrong") {                   // 판정 결과 화면 = 저장된 그대로
      if (!st.judging) { render(false); syncTimer(); return; }
    }
    return fetchQuestion();
  }
  /* 서버 연결이 끊기면: 남은 미션은 로컬 문제로 계속 (오프라인 플레이 · 랭킹 미반영) */
  function localFor(i) {
    if (!QUICK) return st.local[i];
    var used = {};
    for (var k = 0; k < i; k++) if (st.questions[k]) used[st.questions[k].stage] = true;
    for (var j = 0; j < st.local.length; j++) if (!used[st.local[j].stage]) { used[st.local[j].stage] = true; return st.local[j]; }
    return st.local[i];
  }
  function goOffline() {
    loading = false;
    booting = false;
    busy = false;
    if (st.online) st.online.lost = true;
    for (var i = st.mission - 1; i < N; i++) st.questions[i] = localFor(i);
    st.questions = st.questions.map(function (q, i) { return q || localFor(i); });
    st.phase = "default";
    st.attempt = "first";
    st.selected = null;
    st.last = null;
    st.judging = null;
    st.deadline = null;
    st.timeLeft = TIME;
    save();
    render(false);
    if (st.ready) syncTimer(); else drawTimer();
    live.textContent = "서버에 연결할 수 없어 오프라인 플레이로 전환했어요. 랭킹에는 반영되지 않아요.";
  }
  /* 새 온라인 판: 서버가 문제를 만들고(정답은 서버에만) → 왕복 시간 측정 → (로딩 화면 닫힘) → 첫 문제 발급
     - opened: 판 만들기 요청 (스크립트 맨 앞에서 이미 출발 · 아래 kickoff)
     - gate(): 로딩 화면 마무리 + QUICK 카운트다운 → 끝난 뒤에야 serve (서버 시간 측정은 serve 순간부터라 화면이 보이기 전에는 요청하지 않음) */
  function startOnline(opened, resources, gate) {
    loading = true;
    var session = opened.then(function (r) {
      if (!r || !r.session_id || r.n !== N) throw new Error("start");
      st.online = { sid: r.session_id, idx: -1, att: 0, lost: false };
      st.questions = [];
      for (var i = 0; i < N; i++) st.questions.push(null);
      save();
      return loader.run("ping", OL.ping(r.session_id).catch(function () { /* 측정 실패 = 보정 없음 */ }));   // 지연 측정 1회
    });
    return Promise.all([session, resources]).then(function () {
      return gate(false).then(fetchQuestion);
    }, function () {
      return gate(true).then(function () { st.online = null; save(); loading = false; booting = false; render(false); syncTimer(); });
    });
  }

  back.addEventListener("click", function (e) {
    if (prev()) e.preventDefault();                                         // 미션 1 은 기존대로 STAGE SELECT
  });

  action.addEventListener("click", function () {
    if (st.phase === "correct") next();
    else if (st.phase === "wrong") retry();
  });

  /* QUICK PLAY 준비 카운트다운: READY → 3 → 2 → 1 → GO! (처음 한 번만 · 화면 위 오버레이, 레이아웃 변화 없음) */
  function countdown(done) {
    var ov = document.createElement("div");
    ov.className = "b-ready";
    ov.setAttribute("role", "status");
    ov.innerHTML = '<span class="b-ready__mode">QUICK PLAY</span><span class="b-ready__word"></span>';
    document.body.appendChild(ov);
    var word = ov.querySelector(".b-ready__word"), steps = ["READY", "3", "2", "1", "GO!"], i = 0;
    (function stepIt() {
      if (i >= steps.length) { ov.classList.add("is-out"); setTimeout(function () { ov.remove(); }, 200); done(); return; }
      word.textContent = steps[i];
      word.classList.remove("is-pop"); void word.offsetWidth; word.classList.add("is-pop");
      i++;
      setTimeout(stepIt, i === steps.length ? 500 : 700);
    })();
  }

  if (goOnline) loading = booting = true;
  render(false);
  /* QUICK PLAY 카운트다운은 로딩 화면이 닫힌 뒤 (처음 한 번) */
  function readyGate() {
    return st.ready ? Promise.resolve() : new Promise(function (res) { countdown(function () { st.ready = true; save(); res(); }); });
  }
  if (isNew) {
    drawTimer();                                                            // 처음 제한 시간으로 대기 (로딩 중 타이머 정지)
    var resources = loader.run("res", prepareResources());
    var gate = function (fail) { return resources.then(function () { return loader.finish(fail); }).then(readyGate); };
    if (goOnline) startOnline(opened, resources, gate);
    else gate(false).then(function () { render(false); syncTimer(); });
  } else if (online()) {
    if (st.phase === "default") booting = true;                             // 서버 남은 시간 확인 전에는 문제 숨김
    render(false);
    drawTimer();
    if (!st.ready) countdown(function () { st.ready = true; save(); resumeOnline(); });
    else resumeOnline();
  } else if (!st.ready) {
    drawTimer();                                                            // 처음 제한 시간으로 대기
    countdown(function () { st.ready = true; save(); render(false); syncTimer(); });
  } else syncTimer();
  // 뒤로 가기 캐시 복귀 시 저장 상태로 다시 그림
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    var saved = E.getJSON("session", E.KEY.run);
    if (restorable(saved)) { st = normalize(saved); if (online()) resumeOnline(); else { render(false); syncTimer(); } }
  });
})();
