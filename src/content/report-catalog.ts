export interface ProductReportCardData {
  slug: string;
  title: string;
  summary: string;
  recommendation: string;
  whatToCheck: string;
  href: string;
  badge?: string;
}

export const PRODUCT_REPORT_CATALOG: readonly ProductReportCardData[] = [
  {
    slug: 'life-standard',
    title: '보관형 사주 리포트',
    summary: '내 성향, 올해 흐름, 선택 힌트를 한 번에 정리',
    recommendation: '내 사주의 바탕과 앞으로의 흐름을 한 번에 남기고 싶은 분',
    whatToCheck: '타고난 성향, 반복되는 패턴, 올해 조언, 다시 볼 요약',
    href: '/saju/new?plan=lifetime',
    badge: '핵심',
  },
  {
    slug: 'new-year-2027',
    title: '2027 신년운세',
    summary: '총운·가족·재물·학업·연애·건강을 월별·분기별로',
    recommendation: '새해를 시작하며 2027년 한 해를 한 번에 정리하고 싶은 분',
    whatToCheck: '분야별 8가지 운, 분기·월별 흐름, 기대할 일과 조심할 일, PDF 저장',
    href: '/saju/new?product=new-year',
    badge: '신년',
  },
  {
    slug: 'career-money',
    title: '재물·커리어 리포트',
    summary: '직업, 사업, 재물 구조',
    recommendation: '돈의 흐름과 일의 구조를 따로 깊게 보고 싶은 분',
    whatToCheck: '버는 방식, 지키는 방식, 일의 구조, 선택 우선순위',
    href: '/saju/new?product=career-money',
  },
  {
    slug: 'relationship-standard',
    title: '궁합 보관 리포트',
    summary: '두 사람의 구조, 갈등, 보완점',
    recommendation: '연인·배우자·동업 관계를 더 입체적으로 알고 싶은 분',
    whatToCheck: '기본 성향, 충돌 지점, 보완 방식, 오래 가는 대화법',
    href: '/compatibility?product=relationship-standard',
    badge: '관계',
  },
  {
    slug: 'family-report',
    title: '가족 사주 리포트',
    summary: '부모·자녀·배우자 관계 구조',
    recommendation: '가족 안에서 반복되는 역할과 거리감을 정리하고 싶은 분',
    whatToCheck: '가족 관계 구조, 기대 역할, 부딪히는 패턴, 조율 포인트',
    href: '/membership?focus=family-report',
  },
  {
    slug: 'decision',
    title: '이직·사업 선택 리포트',
    summary: '선택지 비교형',
    recommendation: '한 번의 결정보다, 어떤 선택 방식이 나와 맞는지 알고 싶은 분',
    whatToCheck: '선택 힌트, timing, 무리한 확장 신호, 보수적 판단 힌트',
    href: '/saju/new?product=decision',
  },
  {
    slug: 'monthly',
    title: '월간 달빛 리포트',
    summary: '이번 달 운세와 실행 체크리스트',
    recommendation: '한 달 단위로 흐름을 가볍게 정리하며 이어가고 싶은 분',
    whatToCheck: '이번 달 초점, 조심할 흐름, 바로 할 일, 재점검 포인트',
    href: '/membership?focus=monthly',
  },
  {
    slug: 'dialogue',
    title: '대화형 사주 상담',
    summary: '리포트 흐름 위에서 이어지는 Q&A',
    recommendation: '읽고 끝내지 않고, 내 질문으로 계속 좁혀가고 싶은 분',
    whatToCheck: '리포트 후속 질문, 개인 상황 해석, 다음 행동 정리',
    href: '/dialogue',
  },
] as const;
