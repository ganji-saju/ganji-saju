// 2026-09-27 — 오늘운세 상세의 시간대·시나리오 문구가 관심사별 한 문장 고정이라 누구에게나 같았다.
//   오늘 천간 오행과 태어난 날 오행의 관계(0 같음 · 1 내가 낳음 · 2 내가 다룸 · 3 나를 다잡음 · 4 나를 도움)로 가른다.
export const PREMIUM_RELATION_COPY: Array<{ favorable: string; caution: string; actNowTail: string; waitTail: string; waitWatch: string }> = [
  {
    favorable: '내 힘으로 밀고 나가기 좋은 시간이라, 혼자 끝낼 수 있는 일을 이때 몰아서 하세요.',
    caution: '고집이 세지기 쉬운 시간이라, 다른 사람의 의견을 한 번 듣고 움직이세요.',
    actNowTail: '내 몫을 먼저 끝내 두면 함께하는 일에서도 주도권이 생깁니다.',
    waitTail: '누구와 나눌지 먼저 정하면 혼자 떠안는 일이 줄어듭니다.',
    waitWatch: '혼자 다 하려다 미루게 되면 오히려 도움받을 때를 놓칠 수 있습니다.',
  },
  {
    favorable: '생각이 말과 결과물로 잘 나오는 시간이라, 보여줄 것을 이때 정리해 꺼내세요.',
    caution: '말이 앞서기 쉬운 시간이라, 약속이나 지적은 한 번 다듬은 뒤에 하세요.',
    actNowTail: '떠오른 생각을 바로 짧은 결과물로 남기면 하루의 성과가 눈에 보입니다.',
    waitTail: '말할 내용을 한 줄로 정리해 두면 전달이 훨씬 부드러워집니다.',
    waitWatch: '표현을 너무 미루면 좋은 아이디어가 흐지부지 사라질 수 있습니다.',
  },
  {
    favorable: '손에 잡히는 결과를 챙기기 좋은 시간이라, 정산·확인·마무리 일을 이때 하세요.',
    caution: '이득을 좇다 무리하기 쉬운 시간이라, 결제나 약속은 조건을 한 번 더 보세요.',
    actNowTail: '바로 거둘 수 있는 일부터 끝내면 하루가 실속 있게 채워집니다.',
    waitTail: '들어올 것과 나갈 것을 먼저 적어 두면 선택이 빨라집니다.',
    waitWatch: '계산만 하고 움직이지 않으면 눈앞의 기회가 다른 사람에게 갈 수 있습니다.',
  },
  {
    favorable: '책임감이 살아나는 시간이라, 미뤄 둔 의무나 보고를 이때 처리하세요.',
    caution: '압박이 커지기 쉬운 시간이라, 급한 요청은 순서를 정하고 도움을 요청하세요.',
    actNowTail: '맡은 일 하나를 제시간에 끝내면 신뢰가 쌓이고 마음도 가벼워집니다.',
    waitTail: '할 수 있는 범위를 먼저 말해 두면 무리한 부탁을 덜 받게 됩니다.',
    waitWatch: '부담스러운 일을 피하기만 하면 마감이 다가올수록 압박이 더 커질 수 있습니다.',
  },
  {
    favorable: '배우고 도움받기 좋은 시간이라, 막힌 것을 묻거나 자료를 찾아보세요.',
    caution: '생각만 길어지기 쉬운 시간이라, 고민은 짧게 적고 작은 행동 하나로 옮기세요.',
    actNowTail: '물어볼 것 하나를 바로 물으면 막혔던 일이 생각보다 쉽게 풀립니다.',
    waitTail: '필요한 정보를 먼저 모아 두면 결정이 한결 편해집니다.',
    waitWatch: '준비만 하다 시작을 미루면 좋은 흐름을 그냥 흘려보낼 수 있습니다.',
  },
];

const CYCLE = ['목', '화', '토', '금', '수'];
export function todayRelationStep(dayElement: string | null | undefined, todayElement: string | null | undefined) {
  if (!dayElement || !todayElement) return null;
  const a = CYCLE.indexOf(dayElement), b = CYCLE.indexOf(todayElement);
  return a < 0 || b < 0 ? null : (b - a + 5) % 5;
}
