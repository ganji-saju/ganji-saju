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
    summary: '원국·격국·용신·대운 종합',
    recommendation: '내 사주의 바탕과 평생 흐름을 한 번에 정리하고 싶은 분',
    whatToCheck: '원국 구조, 격국 후보, 용신 판단, 대운 흐름',
    href: '/saju/new?product=life-standard',
    badge: '핵심',
  },
  {
    slug: 'yearly-2026',
    title: '2026 연간 운세 전략서',
    summary: '월별 흐름, 주의 달, 기회 달',
    recommendation: '올해 일정과 선택을 월 단위로 미리 점검하고 싶은 분',
    whatToCheck: '상반기/하반기 흐름, 강한 달, 조심할 달, 행동 기준',
    href: '/saju/new?product=yearly-2026',
    badge: '시즌',
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
    recommendation: '연인·배우자·동업 관계의 결을 더 입체적으로 알고 싶은 분',
    whatToCheck: '기본 결, 충돌 지점, 보완 방식, 오래 가는 대화법',
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
    whatToCheck: '선택 기준, timing, 무리한 확장 신호, 보수적 판단 기준',
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
    summary: '리포트 기준 위에서 이어지는 Q&A',
    recommendation: '읽고 끝내지 않고, 내 질문으로 계속 좁혀가고 싶은 분',
    whatToCheck: '리포트 후속 질문, 개인 상황 해석, 다음 행동 정리',
    href: '/dialogue',
  },
] as const;
