/* EYEQ B안 — 공용 스테이지 정보 (STAGE SELECT · GAME · STAGE CLEAR 가 함께 사용)
   playable: 플레이 가능 여부 (5개 모두 처음부터 플레이 가능)
   nameKo: 결과 화면 한글 카테고리명 */
(function () {
  "use strict";
  var STAGES = [
    { id: "typography",  no: "01", name: "Typography",  nameKo: "타이포그래피", desc: "글자의 차이를 발견하는 눈",   descMo: ["글자의 차이를", "발견하는 눈"],   playable: true },
    { id: "spacing",     no: "02", name: "Spacing",     nameKo: "간격",         desc: "여백의 균형을 찾는 눈",       descMo: ["여백의 균형을", "찾는 눈"],       playable: true },
    { id: "alignment",   no: "03", name: "Alignment",   nameKo: "정렬",         desc: "정확한 정렬을 찾아내는 눈",   descMo: ["정확한 정렬을", "찾아내는 눈"],   playable: true },
    { id: "hierarchy",   no: "04", name: "Hierarchy",   nameKo: "위계",         desc: "정보의 위계를 구별하는 눈",   descMo: ["정보의 위계를", "구별하는 눈"],   playable: true },
    { id: "composition", no: "05", name: "Composition", nameKo: "구성",         desc: "전체적인 균형을 완성하는 눈", descMo: ["전체적인 균형을", "완성하는 눈"], playable: true }
  ];
  function find(id) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return STAGES[i];
    return null;
  }
  window.EYEQ.stages = {          /* b-common.js 다음에 로드 */
    list: STAGES,
    get: function (id) { return find(id) || STAGES[0]; },
    /* 플레이 가능한 스테이지만 반환 (아니면 null) */
    playable: function (id) { var s = find(id); return s && s.playable ? s : null; },
    /* 다음 스테이지 (마지막이면 null) */
    next: function (id) { for (var i = 0; i < STAGES.length - 1; i++) if (STAGES[i].id === id) return STAGES[i + 1]; return null; }
  };
})();
