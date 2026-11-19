/* EYEQ B안 — 문제 템플릿 · 인스턴스 · 생성기 (FIND / MATCH / PICK) · 정답 검증
   템플릿(사람이 작성): 스테이지 · 유형 · 설명 · 렌더러 · 바꿀 속성(prop) · 기본 속성 · 값 뽑기(values)
   인스턴스(자동 생성): { tid, stage, type, render, desc, options[3]{props}, answer("A"|"B"|"C"), reference? }
   - 모든 유형은 "보기 3개 중 정답 1개" → 판정은 선택 === answer 하나로 통일
   - 생성 직후 유형 규칙으로 정답이 정확히 하나인지 검증, 아니면 다시 생성
   - 난수는 씨앗값(seed)으로 재현 가능 (새로고침 시 인스턴스는 세션에 저장되어 그대로 유지) */
(function () {
  "use strict";
  var LETTERS = ["A", "B", "C"];

  /* ---------- 씨앗값 난수 (mulberry32) ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    var f = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = function (n) { return Math.floor(f() * n); };
    f.pick = function (arr) { return arr[f.int(arr.length)]; };
    return f;
  }
  function newSeed() { return (Math.random() * 4294967296) >>> 0; }

  function props(t, value) {
    var p = {}, k;
    for (k in t.defaults) p[k] = t.defaults[k];
    p[t.prop] = value;
    return p;
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  /* ---------- 유형별 생성기 ---------- */
  var GEN = {
    /* FIND: 같은 값 2개 + 다른 값 1개 → 다른 하나가 정답.  values → { base, odd } */
    FIND: function (t, r) {
      var v = t.values(r), i = r.int(3), opts = [];
      for (var n = 0; n < 3; n++) opts.push({ props: props(t, n === i ? v.odd : v.base) });
      return { options: opts, answer: LETTERS[i], v: v };
    },
    /* MATCH: 기준 1개 + 보기 중 하나만 기준과 같음.  values → { ref, others: [a, b] } */
    MATCH: function (t, r) {
      var v = t.values(r), i = r.int(3), opts = [], o = 0;
      for (var n = 0; n < 3; n++) opts.push({ props: props(t, n === i ? v.ref : v.others[o++]) });
      return { options: opts, answer: LETTERS[i], reference: props(t, v.ref), v: v };
    },
    /* PICK: 조건(test)을 만족하는 값 1개 + 만족하지 않는 값 2개.  values → { pass, fails: [a, b] } */
    PICK: function (t, r) {
      var v = t.values(r), i = r.int(3), opts = [], o = 0;
      for (var n = 0; n < 3; n++) opts.push({ props: props(t, n === i ? v.pass : v.fails[o++]) });
      return { options: opts, answer: LETTERS[i], v: v };
    }
  };

  /* ---------- 정답 검증: 유형 규칙으로 정답 후보를 직접 세어 정확히 1개 + answer 와 일치 ---------- */
  function correctIndexes(inst, t) {
    var o = inst.options, out = [], i;
    if (!o || o.length !== 3) return out;
    for (i = 0; i < 3; i++) {
      var a = o[i].props, b = o[(i + 1) % 3].props, c = o[(i + 2) % 3].props;
      if (inst.type === "FIND" && !same(a, b) && !same(a, c) && same(b, c)) out.push(i);
      else if (inst.type === "MATCH" && inst.reference && same(a, inst.reference)) out.push(i);
      else if (inst.type === "PICK" && t && t.test && t.test(a, [b, c])) out.push(i);
    }
    return out;
  }
  function validate(inst, t) {
    var idx = correctIndexes(inst, t);
    return idx.length === 1 && LETTERS[idx[0]] === inst.answer;
  }

  /* ---------- 템플릿 (스테이지별 3문제 · 순서 고정) ----------
     Typography: 기존 미션 3개(자간 · 굵기 · 크기). 시안 값이 기본, 자동 변형은 시안 값 근처 범위에서만 */
  /* 수치 세트에서 하나 고르기 → 고른 번호(_n)를 함께 기록 (변형 식별 · 반복 방지) */
  function pool(r, list) { var i = r.int(list.length), v = list[i]; var o = {}; for (var k in v) o[k] = v[k]; o._n = i; return o; }
  function maxOf(arr, f) { var m = -Infinity; for (var i = 0; i < arr.length; i++) m = Math.max(m, f(arr[i])); return m; }

  var TYPO_BASE = { ls: -0.02, fw: 700, fs: 1 };   // .b-ans__kr 기본 (자간 em · 굵기 · 크기 배율)
  /* 문구 세트 (사용자 승인본) — 0번 = 원래 문구. 같은 문제의 보기 3개는 같은 문구, 수치만 다름 */
  var TEMPLATES = {
    typography: [
      { id: "typo-spacing", type: "FIND", render: "typography", prop: "ls", defaults: TYPO_BASE,
        title: ["", "글자 간격", "이 다른 하나는?"], cat: "자간 구별",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "세 가지 중 글자 간격이 다른 하나를 선택하세요.",
        insight: "글자 사이가 고르면 문장이 한 덩어리로 편하게 읽혀요.", hint: "글자와 글자 사이를 천천히 비교해 보세요. 한 장만 간격이 달라요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        values: function (r) { return pool(r, [0.12, 0.13, 0.14, 0.15, 0.16].map(function (x) { return { base: -0.02, odd: x }; })); } },   // 시안 0.14em
      { id: "typo-weight", type: "FIND", render: "typography", prop: "fw", defaults: TYPO_BASE,
        title: ["", "글자 굵기", "가 다른 하나는?"], cat: "굵기 구별",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "세 가지 중 글자 굵기가 다른 하나를 선택하세요.",
        insight: "같은 크기라도 더 굵은 글자는 더 무겁고 중요해 보여요.", hint: "글자 획의 두께를 비교해 보세요. 한 장만 굵기가 달라요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        values: function (r) { return pool(r, [{ base: 400, odd: 700 }, { base: 700, odd: 400 }]); } },    // 시안 Regular 2 + Bold 1
      { id: "typo-size", type: "FIND", render: "typography", prop: "fs", defaults: TYPO_BASE,
        title: ["", "글자 크기", "가 다른 하나는?"], cat: "크기 구별",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "세 가지 중 글자 크기가 다른 하나를 선택하세요.",
        insight: "크기가 조금만 달라도 문장들이 한 묶음으로 보이지 않아요.", hint: "글자의 높이와 너비를 비교해 보세요. 한 장만 크기가 달라요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        values: function (r) {                                                                             // 시안 작은 글자 35.5/40
          var list = [];
          [0.86, 0.875, 0.8875, 0.9].forEach(function (x) { list.push({ base: x, odd: 1 }, { base: 1, odd: x }); });
          return pool(r, list);
        } }
    ],

    /* ---------- STAGE 02 Spacing — 요소 간격 · 안쪽 여백 · 간격의 일관성 (값 = 모바일 px 기준, PC 는 CSS 배율) ---------- */
    spacing: [
      { id: "sp-gap", type: "FIND", render: "sp-noti", prop: "gap", defaults: {},
        title: ["아이콘과 텍스트 ", "간격", "이 다른 하나는?"], cat: "간격 비교",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "아이콘과 텍스트 사이의 간격이 다른 하나를 선택하세요.",
        insight: "아이콘과 글자 사이가 같아야 목록이 정돈돼 보여요.", hint: "아이콘과 글자 사이의 빈 공간만 비교해 보세요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        copy: [["새로운 알림", "새 메시지가 도착했어요"], ["주문 완료", "배송이 곧 시작돼요"], ["예약 확정", "내일 오후 2시에 만나요"],
               ["새 댓글", "내 글에 댓글이 달렸어요"], ["출석 체크", "오늘도 출석했어요"], ["업데이트", "새 기능을 확인해 보세요"]],
        values: function (r) { return pool(r, [{ base: 24, odd: 48 }, { base: 20, odd: 40 }, { base: 16, odd: 32 }, { base: 48, odd: 24 }]); } },
      { id: "sp-padding", type: "PICK", render: "sp-profile", prop: "pad", defaults: {},
        title: ["안쪽 여백이 ", "가장 균형 잡힌", " 카드는?"], cat: "여백 균형",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "테두리 안쪽 여백이 가장 균형 잡힌 카드를 선택하세요.",
        insight: "테두리 안쪽 여백이 사방으로 고르면 내용이 또렷해져요.", hint: "위·아래·왼쪽·오른쪽 여백이 고른지 확인해 보세요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        /* 판정 기준(test)은 그대로: 바깥 크기 고정 카드에서 안쪽 여백이 가장 큰 보기 = 위·아래·좌·우 여백 차이가 가장 작은 보기
           (모든 수치 세트·문구 18가지에서 확인 — 정답 보기만 콘텐츠가 가운데에 가깝고, 나머지는 왼쪽 위로 몰림) */
        copy: [["김아이", "UX 디자이너"], ["이수아", "그래픽 디자이너"], ["박도윤", "브랜드 디자이너"],
               ["최하린", "프로덕트 디자이너"], ["정민준", "일러스트레이터"], ["한지우", "웹 디자이너"]],
        test: function (p, others) { return p.pad > maxOf(others, function (o) { return o.pad; }); },
        values: function (r) { return pool(r, [{ pass: 40, fails: [20, 28] }, { pass: 36, fails: [16, 24] }, { pass: 32, fails: [12, 20] }]); } },
      { id: "sp-rhythm", type: "PICK", render: "sp-chips", prop: "gaps", defaults: {},
        title: ["세 버튼 간격이 ", "모두 같은", " 카드는?"], cat: "간격 일관성",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "세 버튼 사이의 간격이 동일한 카드를 선택하세요.",
        insight: "버튼 사이 간격이 같으면 한 줄이 가지런하고 안정돼 보여요.", hint: "버튼 사이 두 군데의 간격이 같은지 비교해 보세요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        copy: [["전체", "인기", "최신"], ["전체", "추천", "할인"], ["오늘", "이번 주", "이번 달"],
               ["한식", "양식", "일식"], ["봄", "여름", "가을"], ["상의", "하의", "신발"]],
        test: function (p) { return p.gaps[0] === p.gaps[1]; },
        values: function (r) {
          return pool(r, [{ pass: [16, 16], fails: [[12, 28], [24, 8]] }, { pass: [20, 20], fails: [[12, 32], [30, 10]] },
                          { pass: [12, 12], fails: [[6, 22], [20, 6]] }]);
        } }
    ],

    /* ---------- STAGE 03 Alignment — 리스트 시작선 · 중앙 정렬 · 정렬선 일치 ---------- */
    alignment: [
      { id: "al-list", type: "FIND", render: "al-list", prop: "shift", defaults: {},
        title: ["텍스트 ", "시작선", "이 다른 카드는?"], cat: "시작선 비교",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "텍스트의 시작선이 다른 카드를 선택하세요.",
        insight: "글이 같은 선에서 시작하면 목록을 더 빨리 읽을 수 있어요.", hint: "각 줄의 글자가 시작하는 왼쪽 위치를 비교해 보세요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        copy: [["디자인 기초", "정렬 가이드", "색상 팔레트"], ["공지사항", "이벤트", "자주 묻는 질문"], ["계정 설정", "알림 설정", "개인정보"],
               ["장바구니", "주문 내역", "찜 목록"], ["타이포그래피", "레이아웃", "아이콘"], ["오늘 할 일", "진행 중", "완료"]],
        values: function (r) { return pool(r, [{ base: 0, odd: 20 }, { base: 0, odd: 16 }, { base: 0, odd: 24 }]); } },   // 두 번째 행 텍스트만 오른쪽으로
      { id: "al-center", type: "PICK", render: "al-popup", prop: "sx", defaults: {},
        title: ["콘텐츠가 ", "정확히 가운데", "인 카드는?"], cat: "중앙 정렬",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "콘텐츠가 정확히 중앙에 배치된 카드를 선택하세요.",
        insight: "정확히 가운데 놓여야 팝업이 한쪽으로 기울어 보이지 않아요.", hint: "콘텐츠 양옆에 남은 빈 공간이 같은지 비교해 보세요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        copy: [["저장 완료!", "확인"], ["전송 완료!", "확인"], ["업로드 완료!", "닫기"], ["결제 완료!", "확인"], ["등록 완료!", "확인"], ["복사 완료!", "닫기"]],
        test: function (p) { return p.sx === 0; },
        values: function (r) { return pool(r, [{ pass: 0, fails: [-24, 24] }, { pass: 0, fails: [-20, 28] }, { pass: 0, fails: [-28, 20] }]); } },
      { id: "al-edge", type: "PICK", render: "al-product", prop: "off", defaults: {},
        title: ["왼쪽 시작선이 ", "모두 일치하는", " 카드는?"], cat: "정렬선 일치",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "상품 정보의 왼쪽 시작선이 모두 일치하는 카드를 선택하세요.",
        insight: "왼쪽 시작선이 맞으면 상품 정보가 한 줄로 깔끔하게 읽혀요.", hint: "상품 이름·가격·버튼의 왼쪽 끝을 비교해 보세요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        copy: [["미니 백팩", "39,000원", "구매하기"], ["캔버스 토트", "29,000원", "담기"], ["라운드 머그", "12,000원", "구매하기"],
               ["데일리 캡", "25,000원", "구매하기"], ["울 머플러", "45,000원", "담기"], ["가죽 지갑", "59,000원", "구매하기"]],
        test: function (p) { return p.off.p === 0 && p.off.b === 0; },
        values: function (r) {
          return pool(r, [{ pass: { p: 0, b: 0 }, fails: [{ p: 24, b: 0 }, { p: 0, b: 24 }] }, { pass: { p: 0, b: 0 }, fails: [{ p: 20, b: 0 }, { p: 0, b: 20 }] },
                          { pass: { p: 0, b: 0 }, fails: [{ p: 28, b: 0 }, { p: 0, b: 16 }] }]);
        } }
    ],

    /* ---------- STAGE 04 Hierarchy — 강조 정보 · 가격 강조 · 제목과 본문 위계 ---------- */
    hierarchy: [
      { id: "hi-emphasis", type: "FIND", render: "hi-event", prop: "emph", defaults: {},
        title: ["", "다른 정보", "가 가장 크게 강조된 카드는?"], cat: "강조 비교",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "다른 정보가 가장 크게 강조된 카드를 선택하세요.",
        insight: "강조할 정보를 하나로 정해야 메시지가 분명해져요.", hint: "카드마다 가장 크게 쓰인 정보가 무엇인지 비교해 보세요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        copy: [["SPECIAL EVENT", "50% OFF", "이번 주말까지"], ["SUMMER SALE", "30% OFF", "7월 31일까지"], ["WEEKLY DEAL", "1+1", "오늘 자정까지"],
               ["NEW MEMBER", "20% OFF", "가입 후 7일간"], ["FLASH SALE", "70% OFF", "3시간 한정"], ["HOLIDAY", "FREE GIFT", "이번 달까지"]],
        values: function (r) { return pool(r, [{ base: "off", odd: "date" }, { base: "date", odd: "off" }]); } },
      { id: "hi-price", type: "PICK", render: "hi-price", prop: "price", defaults: {},
        title: ["", "가격", "이 가장 크게 강조된 카드는?"], cat: "가격 강조",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "가격이 가장 크게 강조된 카드를 선택하세요.",
        insight: "가격이 가장 크면 보는 사람의 눈이 가격으로 바로 가요.", hint: "카드마다 가격 글자가 가장 큰지 확인해 보세요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        copy: [["데일리 스니커즈", "29,900원", "무료배송"], ["린넨 셔츠", "39,900원", "무료배송"], ["무선 이어폰", "89,000원", "당일 출고"],
               ["캔들 세트", "19,900원", "선물 포장"], ["요가 매트", "24,900원", "무료배송"], ["텀블러", "15,900원", "오늘 출발"]],
        test: function (p, others) { return p.price.s > maxOf(others, function (o) { return o.price.s; }); },
        values: function (r) {
          return pool(r, [{ pass: { s: 40, w: 700 }, fails: [{ s: 24, w: 400 }, { s: 32, w: 700 }] },
                          { pass: { s: 40, w: 700 }, fails: [{ s: 28, w: 400 }, { s: 32, w: 400 }] },
                          { pass: { s: 36, w: 700 }, fails: [{ s: 24, w: 400 }, { s: 28, w: 700 }] }]);
        } },
      { id: "hi-heading", type: "PICK", render: "hi-article", prop: "st", defaults: {},
        title: ["제목이 본문보다 ", "크고 굵은", " 카드는?"], cat: "제목 위계",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "제목이 본문보다 크고 굵게 표현된 카드를 선택하세요.",
        insight: "제목과 본문의 차이가 분명할수록 글의 구조가 잘 읽혀요.", hint: "제목이 본문보다 큰지, 더 굵은지 둘 다 확인해 보세요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        /* 제목·본문이 글자 크기에 따라 줄바꿈되는 카드 → 원래 문구와 단어 길이가 다르면 줄 수·높이가 바뀜.
           승인 문구 중 줄 수가 달라지는 세트는 빼고 원래 문구만 사용 (같은 단어 길이의 대체 문구는 승인 대기) */
        copy: [["새로운 디자인 트렌드", "변화하는 디자인의 흐름을 살펴보세요."]],
        test: function (p) { return p.st.ts > p.st.bs && p.st.tw > p.st.bw; },
        values: function (r) {
          return pool(r, [26, 28, 30].map(function (ts) {
            return { pass: { ts: ts, tw: 700, bs: 16, bw: 400 }, fails: [{ ts: 16, tw: 400, bs: 16, bw: 400 }, { ts: 16, tw: 400, bs: ts, bw: 700 }] };
          }));
        } }
    ],

    /* ---------- STAGE 05 Composition — 배너 구성 · 포스터 균형 · 그리드 ---------- */
    composition: [
      { id: "co-banner", type: "FIND", render: "co-banner", prop: "flip", defaults: {},
        title: ["이미지·텍스트 ", "좌우 배치", "가 다른 카드는?"], cat: "배치 비교",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "이미지와 텍스트의 좌우 배치가 다른 카드를 선택하세요.",
        insight: "이미지와 글의 방향이 같아야 여러 화면이 하나처럼 읽혀요.", hint: "이미지가 왼쪽인지 오른쪽인지 카드마다 비교해 보세요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        copy: [["NEW", "봄 시즌 컬렉션", "새 스타일을 만나보세요", "자세히 보기"], ["BEST", "여름 인기 아이템", "지금 가장 많이 찾는 상품", "보러 가기"],
               ["SALE", "가을 아우터 특가", "최대 40% 할인", "쇼핑하기"], ["EVENT", "겨울 한정 에디션", "따뜻한 선물을 준비했어요", "자세히 보기"],
               ["NEW", "데스크 정리 용품", "깔끔한 책상을 만들어요", "둘러보기"], ["PICK", "이번 주 추천", "에디터가 고른 아이템", "자세히 보기"]],
        values: function (r) { return pool(r, [{ base: 0, odd: 1 }, { base: 1, odd: 0 }]); } },   // 0 = 왼쪽 텍스트 · 1 = 왼쪽 이미지
      { id: "co-poster", type: "PICK", render: "co-poster", prop: "sx", defaults: {},
        title: ["전체 콘텐츠가 ", "중앙", "에 놓인 카드는?"], cat: "중앙 배치",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "전체 콘텐츠가 중앙에 배치된 카드를 선택하세요.",
        insight: "콘텐츠가 가운데 놓이면 화면이 한쪽으로 쏠리지 않아 편해요.", hint: "콘텐츠 묶음의 양옆과 위아래 빈 공간을 비교해 보세요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        copy: [["DESIGN WEEK", "11.20 — 11.24"], ["ART FAIR", "03.14 — 03.17"], ["PHOTO DAYS", "05.02 — 05.06"],
               ["TYPE TALK", "07.10 — 07.12"], ["MUSIC NIGHT", "09.05 — 09.07"], ["CRAFT MARKET", "10.18 — 10.20"]],
        test: function (p) { return p.sx === 0; },
        values: function (r) { return pool(r, [{ pass: 0, fails: [-35, 35] }, { pass: 0, fails: [-30, 40] }, { pass: 0, fails: [-40, 30] }]); } },
      { id: "co-grid", type: "PICK", render: "co-grid", prop: "g", defaults: {},
        title: ["이미지 ", "크기·간격", "이 일정한 카드는?"], cat: "그리드 일관성",   // 제목 = 할 일 한 문장 · 판단 기준(desc)과 같은 뜻
        desc: "이미지 크기와 간격이 모두 일정한 카드를 선택하세요.",
        insight: "이미지 크기와 간격이 일정하면 화면이 정돈돼 보여요.", hint: "이미지들의 크기와 사이 간격이 모두 같은지 보세요.",   // 정답 해설 · 오답 힌트(정답은 알려 주지 않음 — 다시 도전 유지)
        test: function (p) { return p.g.last === 48 && p.g.cg === 8; },
        values: function (r) {
          return pool(r, [{ pass: { last: 48, cg: 8 }, fails: [{ last: 36, cg: 8 }, { last: 48, cg: 20 }] },
                          { pass: { last: 48, cg: 8 }, fails: [{ last: 32, cg: 8 }, { last: 48, cg: 16 }] },
                          { pass: { last: 48, cg: 8 }, fails: [{ last: 40, cg: 8 }, { last: 48, cg: 24 }] }]);
        } }
    ]
  };
  function template(id) {
    for (var s in TEMPLATES) for (var i = 0; i < TEMPLATES[s].length; i++) if (TEMPLATES[s][i].id === id) return TEMPLATES[s][i];
    return null;
  }

  /* avoid: 최근에 낸 변형(variant) 목록 — 가능하면 같은 문구·수치 조합을 다시 내지 않음 */
  function generate(t, r, avoid) {
    var fallback = null;
    for (var tries = 0; tries < 30; tries++) {
      var g = GEN[t.type](t, r);
      var ci = t.copy ? r.int(t.copy.length) : -1;
      var inst = { tid: t.id, stage: null, type: t.type, render: t.render, desc: t.desc, options: g.options, answer: g.answer };
      if (g.reference) inst.reference = g.reference;
      if (t.title) inst.title = t.title;                 // 미션 고유 제목 [앞, 강조, 뒤] (없으면 유형 기본 제목)
      if (t.cat) inst.cat = t.cat;                       // 문제 유형 배지 (예: 자간 구별)
      if (t.insight) inst.insight = t.insight;           // 정답 후 한 줄 인사이트
      if (ci > -1) inst.copy = t.copy[ci].slice();       // 카드 안 문구 (보기 3개 공통)
      inst.variant = t.id + ":" + ci + ":" + (g.v && typeof g.v._n === "number" ? g.v._n : 0);
      if (!validate(inst, t)) continue;
      if (avoid && avoid.indexOf(inst.variant) > -1) { fallback = fallback || inst; continue; }
      return inst;
    }
    if (fallback) return fallback;                       // 모든 조합을 최근에 냈으면 반복 허용
    throw new Error("EYEQ: 정답이 하나인 문제를 만들지 못했어요 (" + t.id + ")");
  }

  /* QUICK PLAY: 5개 분야에서 1문제씩 · 분야 순서와 문제 유형은 씨앗값으로 무작위 (생성·검증은 같은 함수 재사용) */
  var QUICK_STAGES = ["typography", "spacing", "alignment", "hierarchy", "composition"];
  function generateQuick(s, avoid) {
    var r = rng(s), order = QUICK_STAGES.slice(), qs = [];
    for (var i = order.length - 1; i > 0; i--) { var j = r.int(i + 1), x = order[i]; order[i] = order[j]; order[j] = x; }
    order.forEach(function (stage) {
      var inst = generate(r.pick(TEMPLATES[stage]), r, avoid);
      inst.stage = stage;
      qs.push(inst);
    });
    return { seed: s, questions: qs };
  }
  function validQuick(qs) {
    if (!qs || qs.length !== QUICK_STAGES.length) return false;
    var seen = {};
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i], t = template(q && q.tid);
      if (!t || QUICK_STAGES.indexOf(q.stage) < 0 || seen[q.stage] || TEMPLATES[q.stage].indexOf(t) < 0 || q.type !== t.type || !validate(q, t)) return false;
      seen[q.stage] = true;
    }
    return true;
  }

  /* 스테이지 한 판(3문제) 생성 · "quick" = QUICK PLAY 5문제 */
  function generateRun(stage, seed, avoid) {
    if (stage === "quick") return generateQuick(typeof seed === "number" ? seed >>> 0 : newSeed(), avoid);
    var list = TEMPLATES[stage];
    if (!list || list.length < 3) return null;
    var s = typeof seed === "number" ? seed >>> 0 : newSeed();
    var r = rng(s), qs = [];
    for (var i = 0; i < 3; i++) {
      var inst = generate(list[i], r, avoid);
      inst.stage = stage;
      qs.push(inst);
    }
    return { seed: s, questions: qs };
  }
  /* 세션에 저장된 문제가 지금 규칙으로도 유효한지 (새로고침 복원용) */
  function validRun(stage, qs) {
    if (stage === "quick") return validQuick(qs);
    if (!qs || qs.length !== 3) return false;
    for (var i = 0; i < 3; i++) {
      var t = template(qs[i] && qs[i].tid);
      if (!t || qs[i].stage !== stage || qs[i].type !== t.type || !validate(qs[i], t)) return false;
    }
    return true;
  }

  window.EYEQ.questions = {
    LETTERS: LETTERS,
    TITLES: { FIND: ["", "다른 하나", "를 찾아라!"], MATCH: ["", "똑같은 하나", "를 찾아라!"], PICK: ["", "조건에 맞는 하나", "를 찾아라!"] },
    templates: TEMPLATES,
    template: template,
    rng: rng,
    generators: GEN,
    validate: validate,
    generateRun: generateRun,
    validRun: validRun,
    judge: function (inst, letter) { return inst.answer === letter; }
  };
})();
