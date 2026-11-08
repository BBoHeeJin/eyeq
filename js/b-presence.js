/* EYEQ B안 — 실시간 접속자 수 (Supabase Realtime Presence · 라이브러리 없이 WebSocket만 사용)
   - 모든 페이지에서 접속 상태를 알리고(track), 숫자는 홈 화면의 [data-presence] 배지에만 표시
   - 같은 브라우저(여러 탭·새로고침·페이지 이동)는 브라우저마다 한 번 만든 접속 키 하나 → 1명으로 계산
   - 연결 전·실패·오프라인: 숫자를 보여주지 않음 (배지 자리만 유지 → 주변 요소 움직임 없음)
   - 공개용 URL·publishable key만 사용 (b-config.js) · 데이터베이스 테이블 사용 안 함
   ※ Presence = '지금 연결된 브라우저 수' (실제 플레이 인원·사람 수를 보장하지 않음) → 문구는 '함께하고 있어요' */
(function (w) {
  "use strict";
  var E = w.EYEQ, C = w.EYEQ_CONFIG || {}, d = w.document;
  var URL_ = (C.supabaseUrl || "").replace(/\/+$/, ""), KEY = C.supabaseKey || "";
  if (!E || !URL_ || !KEY || !w.WebSocket) return;

  var TOPIC = "realtime:eyeq-presence";
  var HEARTBEAT = 25000, PID_KEY = "eyeq.b.pid";
  var ws = null, ref = 0, joinRef = null, beat = 0, beatWait = null, retry = 0, retryTimer = 0, joined = false;
  var state = {};                       // { 접속 키: [phx_ref, ...] }
  var count = null;                     // null = 모름 (표시 안 함)

  /* 브라우저마다 고정된 접속 키 (개인 정보 없음 · 무작위) */
  function pid() {
    var v = E.get("local", PID_KEY);
    if (!v || !/^[a-z0-9]{12,40}$/.test(v)) {
      v = "";
      for (var i = 0; i < 4; i++) v += Math.floor(Math.random() * 2176782336).toString(36);
      v = v.slice(0, 24);
      E.set("local", PID_KEY, v);
    }
    return v;
  }
  /* 토큰: 로그인 세션이 유효하면 그 토큰, 없으면 publishable key (Supabase JS와 같은 방식) */
  function token() {
    var s = E.online && E.online.session && E.online.session();
    return s && s.access_token && s.expires_at - 60000 > Date.now() ? s.access_token : KEY;
  }

  /* ---------- 표시 (홈 화면 배지만) ---------- */
  function draw() {
    Array.prototype.forEach.call(d.querySelectorAll("[data-presence]"), function (el) {
      var known = typeof count === "number" && count > 0;
      el.classList.toggle("is-on", known);
      el.setAttribute("aria-hidden", known ? "false" : "true");
      var n = el.querySelector("[data-presence-n]");
      if (n) n.textContent = known ? count.toLocaleString("ko-KR") : "";
    });
  }
  function recount() {
    var n = 0;
    for (var k in state) if (state[k] && state[k].length) n++;
    count = n;
    draw();
  }
  function unknown() { count = null; state = {}; draw(); }

  /* ---------- Presence 상태 반영 ---------- */
  function refs(metas) { return (metas || []).map(function (m) { return m.phx_ref; }); }
  function onState(p) {
    state = {};
    for (var k in p) state[k] = refs(p[k] && p[k].metas);
    recount();
  }
  function onDiff(p) {
    var k;
    for (k in (p.joins || {})) state[k] = (state[k] || []).concat(refs(p.joins[k].metas));
    for (k in (p.leaves || {})) {
      var gone = refs(p.leaves[k].metas);
      state[k] = (state[k] || []).filter(function (r) { return gone.indexOf(r) < 0; });
      if (!state[k].length) delete state[k];
    }
    recount();
  }

  /* ---------- 연결 ---------- */
  function send(topic, event, payload, jr) {
    if (!ws || ws.readyState !== 1) return null;
    var r = String(++ref);
    ws.send(JSON.stringify({ topic: topic, event: event, payload: payload, ref: r, join_ref: jr === true ? r : (jr || null) }));   // 입장 메시지는 자기 ref = join_ref
    return r;
  }
  function connect() {
    clearTimeout(retryTimer);
    if (ws || w.navigator.onLine === false) return;
    var url = URL_.replace(/^http/, "ws") + "/realtime/v1/websocket?apikey=" + encodeURIComponent(KEY) + "&vsn=1.0.0";
    try { ws = new w.WebSocket(url); } catch (e) { ws = null; schedule(); return; }
    var me = ws;
    ws.onopen = function () {
      if (me !== ws) return;
      joinRef = send(TOPIC, "phx_join", {
        config: { broadcast: { ack: false, self: false }, presence: { key: pid(), enabled: true }, postgres_changes: [], private: false },
        access_token: token()
      }, true);
      if (joinRef) { var jr = joinRef; setTimeout(function () { if (me === ws && !joined && joinRef === jr) drop(); }, 10000); }   // 10초 안에 입장 응답 없음 → 다시 연결
      clearInterval(beat);
      beat = setInterval(function () {
        if (beatWait) { drop(); return; }                                  // 이전 확인 응답 없음 → 끊긴 연결로 보고 다시 연결
        beatWait = send("phoenix", "heartbeat", {});
      }, HEARTBEAT);
    };
    ws.onmessage = function (ev) {
      if (me !== ws) return;
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.topic === "phoenix" && m.event === "phx_reply" && m.ref === beatWait) { beatWait = null; return; }
      if (m.topic !== TOPIC) return;
      if (m.event === "phx_reply" && m.ref === joinRef) {
        if (m.payload && m.payload.status === "ok") {
          joined = true; retry = 0;
          send(TOPIC, "presence", { type: "presence", event: "track", payload: { online_at: new Date().toISOString() } }, joinRef);
        } else drop();                                                     // 입장 거절 → 숫자 표시 안 함 · 잠시 후 다시 시도
        return;
      }
      if (m.event === "presence_state") onState(m.payload || {});
      else if (m.event === "presence_diff") onDiff(m.payload || {});
      else if (m.event === "phx_error" || m.event === "phx_close" || (m.event === "system" && m.payload && m.payload.status === "error")) drop();
    };
    ws.onclose = function () { if (me === ws) { cleanup(); unknown(); schedule(); } };
    ws.onerror = function () { /* onclose 에서 처리 */ };
  }
  function cleanup() {
    clearInterval(beat); beat = 0; beatWait = null; joined = false; joinRef = null;
    var old = ws; ws = null;
    if (old) { old.onopen = old.onmessage = old.onclose = old.onerror = null; try { old.close(); } catch (e) { /* noop */ } }
  }
  function drop() { cleanup(); unknown(); schedule(); }
  function schedule() {
    clearTimeout(retryTimer);
    if (w.navigator.onLine === false) return;                           // 오프라인: 'online' 이벤트에서 다시 연결
    var wait = Math.min(30000, 1000 * Math.pow(2, retry++)) + Math.floor(Math.random() * 500);
    retryTimer = setTimeout(connect, wait);
  }

  w.addEventListener("offline", function () { clearTimeout(retryTimer); cleanup(); unknown(); });
  w.addEventListener("online", function () { retry = 0; cleanup(); connect(); });
  /* 오래 숨겨졌던 탭이 다시 보이면: 연결이 끊겼으면 바로 다시 연결 */
  d.addEventListener("visibilitychange", function () { if (!d.hidden && !ws) { retry = 0; connect(); } });
  /* 페이지를 떠날 때: 연결을 닫아 서버가 바로 '나감'으로 처리 (같은 키라 다른 탭·다음 페이지는 계속 1명) */
  w.addEventListener("pagehide", function () { clearTimeout(retryTimer); cleanup(); });
  w.addEventListener("pageshow", function (e) { if (e.persisted && !ws) { retry = 0; connect(); } });

  E.presence = { count: function () { return count; } };
  draw();
  connect();
})(window);
