/* EYEQ B안 — 온라인 레이스 연결 (Supabase · 라이브러리 없이 fetch만 사용)
   - 익명 로그인: 사용자마다 고유 ID (회원가입 화면 없음) · 세션은 이 브라우저에 저장, 만료되면 자동 갱신
   - 프로필 동기화: 닉네임·캐릭터 (닉네임 중복 허용)
   - 레이스 진행 조회: 서버 값(XP·레벨·플레이 시간·만렙 LV.10)을 받아 헤더에 표시 — 브라우저는 XP를 쓰지 못함(RLS)
   - 연결 실패 = 오프라인: 게임은 그대로 가능, 랭킹 미반영
   공개용 URL·publishable key만 사용 (b-config.js)
*/
(function (w) {
  "use strict";
  var E = w.EYEQ, C = w.EYEQ_CONFIG || {};
  var URL_ = (C.supabaseUrl || "").replace(/\/+$/, ""), KEY = C.supabaseKey || "";
  var enabled = !!(URL_ && KEY && w.fetch);
  var TIMEOUT = 8000;
  var state = { status: enabled ? "unknown" : "disabled", lastError: null };
  var d = w.document;

  function setStatus(s, err) {
    state.status = s;
    state.lastError = err || null;
    d.documentElement.setAttribute("data-online", s);
    try { w.dispatchEvent(new CustomEvent("eyeq:online", { detail: s })); } catch (e) { /* noop */ }
  }

  /* ---------- 요청 ---------- */
  function request(path, opt) {
    opt = opt || {};
    var h = { apikey: KEY, "Content-Type": "application/json" };
    if (opt.token) h.Authorization = "Bearer " + opt.token;
    if (opt.prefer) h.Prefer = opt.prefer;
    var ctrl = w.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opt.timeout || TIMEOUT) : 0;
    return fetch(URL_ + path, {
      method: opt.method || "GET", headers: h,
      body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined,
      signal: ctrl ? ctrl.signal : undefined, cache: "no-store"
    }).then(function (res) {
      clearTimeout(timer);
      return res.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) { data = t; }
        if (!res.ok) { var err = new Error("HTTP " + res.status); err.status = res.status; err.data = data; throw err; }
        return data;
      });
    }, function (e) { clearTimeout(timer); var err = new Error("network"); err.network = true; err.cause = e; throw err; });
  }

  /* ---------- 익명 로그인 세션 ---------- */
  function getSession() { var s = E.getJSON("local", E.KEY.auth); return s && s.access_token && s.user_id ? s : null; }
  function saveSession(data) {
    if (!data || !data.access_token || !data.user) return null;
    var s = {
      access_token: data.access_token, refresh_token: data.refresh_token, user_id: data.user.id,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
      anonymous: data.user.is_anonymous !== false, email: data.user.email || null
    };
    E.setJSON("local", E.KEY.auth, s);
    return s;
  }
  var authing = null;
  function ensureAuth() {
    if (!enabled) return Promise.reject(new Error("disabled"));
    if (authing) return authing;
    var s = getSession();
    if (s && s.expires_at - 60000 > Date.now()) return Promise.resolve(s);
    authing = (s && s.refresh_token
      ? request("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: s.refresh_token } })
          .catch(function (e) {
            if (e.network) throw e;
            var now = getSession();                                         // 다른 탭이 먼저 갱신했으면 그 세션 사용
            if (now && now.access_token !== s.access_token && now.expires_at - 60000 > Date.now()) return { reuse: now };
            return signIn();                                                // 갱신 토큰이 무효(삭제된 계정 등) → 새 익명 계정
          })
      : signIn())
      .then(function (data) { return data && data.reuse ? data.reuse : (saveSession(data) || Promise.reject(new Error("auth"))); })
      .then(function (s2) { authing = null; return s2; }, function (e) { authing = null; throw e; });
    return authing;
  }
  function signIn() {
    var prev = getSession();
    if (prev) E.setJSON("local", "eyeq.b.auth_prev", { user_id: prev.user_id, at: Date.now() });   // 기록 확인용 (덮어쓰기 전 ID 보관)
    return request("/auth/v1/signup", { method: "POST", body: {} });
  }

  /* ---------- 프로필 동기화 (닉네임·캐릭터) ---------- */
  function profileKey() { return (E.getNickname() || "") + "|" + E.getCharacter() + "|" + (E.getMajor() || ""); }
  var noMajorCol = false;                                               // 서버에 major 칸이 아직 없으면(SQL 적용 전) 빼고 저장
  function syncProfile(force) {
    var nick = E.getNickname();
    if (!nick || !E.hasCharacter()) return Promise.resolve(null);       // 프로필 설정 전에는 서버에 만들지 않음
    return ensureAuth().then(function (s) {
      var k = s.user_id + "|" + profileKey();
      if (!force && E.get("local", "eyeq.b.profile_synced") === k) return s;
      function put(withMajor) {
        var body = { id: s.user_id, nickname: nick, avatar: E.getCharacter(), updated_at: new Date().toISOString() };
        if (withMajor) body.major = E.getMajor();
        return request("/rest/v1/profiles?on_conflict=id", {
          method: "POST", token: s.access_token, prefer: "resolution=merge-duplicates,return=minimal", body: body
        });
      }
      var withMajor = !!E.getMajor() && !noMajorCol;
      return put(withMajor).catch(function (e) {
        if (withMajor && e.status === 400 && e.data && (e.data.code === "PGRST204" || /major/.test(e.data.message || ""))) {
          noMajorCol = true;                                            // 칸 없음 → 닉네임·캐릭터만 저장 (게임은 그대로 진행)
          return put(false).then(function () { return "partial"; });
        }
        throw e;
      }).then(function (r) { if (r !== "partial") E.set("local", "eyeq.b.profile_synced", k); return s; });
    });
  }

  /* ---------- 피드백 보내기 (자기 것만 추가 가능 · 읽기·수정·삭제 불가 — 서버 RLS) ---------- */
  function sendFeedback(type, content, page) {
    return ensureAuth().then(function (s) {
      return request("/rest/v1/feedback", {
        method: "POST", token: s.access_token, prefer: "return=minimal",
        body: { feedback_type: type, content: content, page: page }
      });
    });
  }

  /* ---------- 레이스 진행 (서버 값 → 표시용 사본) ---------- */
  function refreshRace() {
    return syncProfile(false).then(function (s) {
      if (!s) return null;
      return request("/rest/v1/race_progress?select=xp,level,play_ms,maxed,final_ms,maxed_at,review_status", { token: s.access_token })
        .then(function (rows) {
          var r = rows && rows[0];
          if (r) E.setRace({ xp: r.xp, level: r.level, play_ms: r.play_ms, maxed: r.maxed, final_ms: r.final_ms, maxed_at: r.maxed_at, review: r.review_status, user_id: s.user_id });
          setStatus("online");
          return r || null;
        });
    }).catch(function (e) { setStatus("offline", e); return null; });
  }

  /* 공개 RPC (랭킹 · 내 순위) */
  function rpc(name, body, needAuth) {
    var go = function (s) { return request("/rest/v1/rpc/" + name, { method: "POST", token: s ? s.access_token : null, body: body || {} }); };
    return needAuth ? ensureAuth().then(go) : go(getSession());
  }

  /* ---------- 공식 레이스 게임 (서버 판정) ----------
     startGame: Edge Function이 서버에서 문제를 만들고 판을 엶 (정답은 서버에만)
     ping → serve(문제 받기 · 서버 시간 측정 시작) → answer(서버 판정 · XP · 시간) */
  function startGame(mode, stage) {
    return syncProfile(false).then(function (s) {
      if (!s) throw new Error("profile");
      return request("/functions/v1/eyeq-game", { method: "POST", token: s.access_token, body: { mode: mode, stage: stage }, timeout: 10000 });
    });
  }
  function ping(sid) { return rpc("eyeq_ping", { p_session: sid }, true); }
  function serve(sid) { return rpc("eyeq_serve", { p_session: sid }, true); }
  function answer(sid, index, attempt, letter, clientMs) {
    return rpc("eyeq_answer", { p_session: sid, p_index: index, p_attempt: attempt, p_letter: letter, p_client_ms: clientMs }, true);
  }
  /* 게임 가능 여부: 설정 · 프로필 · 브라우저 온라인 상태 */
  function canPlayOnline() {
    return enabled && !!E.getNickname() && E.hasCharacter() && w.navigator.onLine !== false;
  }

  E.online = {
    startGame: startGame, ping: ping, serve: serve, answer: answer, canPlayOnline: canPlayOnline,
    enabled: enabled,
    status: function () { return state.status; },
    isOnline: function () { return state.status === "online"; },
    session: getSession,
    ensureAuth: ensureAuth,
    syncProfile: syncProfile,
    sendFeedback: sendFeedback,
    refreshRace: refreshRace,
    request: request,
    rpc: rpc
  };

  if (!enabled) { setStatus("disabled"); return; }
  /* 페이지 열 때: 표시용 사본으로 먼저 그리고(깜빡임 없음), 서버 값으로 갱신 */
  refreshRace();
  w.addEventListener("eyeq:profile", function () { syncProfile(false).then(refreshRace, function (e) { setStatus("offline", e); }); });
  w.addEventListener("online", function () { refreshRace(); });
  w.addEventListener("offline", function () { setStatus("offline"); });
})(window);
