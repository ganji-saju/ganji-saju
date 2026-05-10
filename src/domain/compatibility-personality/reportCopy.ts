import type { PersonalityCompatibilityReportSectionKey } from './reportSchema';

export const PERSONALITY_COMPATIBILITY_SAFETY_NOTE =
  '이 리포트는 참고용 자기이해 콘텐츠이며, 의료·법률·투자 판단을 대신하지 않습니다. 중요한 결정은 실제 상황과 전문가의 조언을 함께 확인해 주세요.';

export const FREE_REPORT_DEFAULT_COPY = {
  headline: '두 사람의 관계 결을 부드럽게 살펴봤습니다',
  summary:
    '사주에서 보이는 관계 흐름과 16유형 성향, 지금의 질문을 함께 보며 관계의 온도와 조율 포인트를 정리합니다.',
  scoreSummary:
    '점수는 좋고 나쁨을 단정하는 값이 아니라, 끌림·안정·소통·갈등 위험·회복 흐름을 나누어 보는 참고 지표입니다.',
  highlights: [
    '서로에게 자연스럽게 끌리는 지점',
    '관계가 편안해지는 생활 리듬',
    '조심하면 도움이 되는 대화 포인트',
  ],
} as const;

export const LOCKED_SECTION_COPY: Record<
  PersonalityCompatibilityReportSectionKey,
  { teaser: string; ctaLabel: string }
> = {
  overview: {
    teaser: '무료 요약에서 바로 확인할 수 있습니다.',
    ctaLabel: '요약 보기',
  },
  scoreSummary: {
    teaser: '무료 점수 해석에서 바로 확인할 수 있습니다.',
    ctaLabel: '점수 보기',
  },
  attraction: {
    teaser: '무료 결과에서 끌림 포인트를 먼저 확인할 수 있습니다.',
    ctaLabel: '끌림 보기',
  },
  stability: {
    teaser: '무료 결과에서 안정 포인트를 먼저 확인할 수 있습니다.',
    ctaLabel: '안정 보기',
  },
  communication: {
    teaser: '말투와 대화 속도 차이를 더 구체적으로 풀어드립니다.',
    ctaLabel: '소통 풀이 열기',
  },
  conflictPattern: {
    teaser: '갈등 위험이 커지는 장면과 피하면 좋은 표현을 정리합니다.',
    ctaLabel: '갈등 패턴 열기',
  },
  recovery: {
    teaser: '서운함 이후 다시 편안해지는 회복 방식을 제안합니다.',
    ctaLabel: '회복 방식 열기',
  },
  practicalActions: {
    teaser: '오늘 바로 써볼 수 있는 관계별 실천 행동을 제공합니다.',
    ctaLabel: '실천 행동 열기',
  },
  questionAdvice: {
    teaser: '지금 질문에 맞춰 다음 대화 방향을 더 선명하게 잡아드립니다.',
    ctaLabel: '질문별 조언 열기',
  },
};

export const PERSONALITY_COMPATIBILITY_CTA_COPY = {
  unlockPaidReport: '상세 풀이 열기',
  retryCheck: '성향 체크 다시 하기',
  saveReport: '리포트 보관하기',
  viewCompatibilityInput: '다른 관계도 보기',
} as const;

export function buildLockedSectionCopy(sectionKey: PersonalityCompatibilityReportSectionKey) {
  return LOCKED_SECTION_COPY[sectionKey];
}
