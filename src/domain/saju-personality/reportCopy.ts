import type { SajuPersonalityReportSectionKey } from './sajuPersonality.types';

export const SAJU_PERSONALITY_SAFETY_NOTE =
  '이 리포트는 참고용 자기이해 콘텐츠이며, 의료·법률·투자 판단을 대신하지 않습니다. 중요한 결정은 실제 상황과 전문가의 조언을 함께 확인해 주세요.';

export const FREE_REPORT_DEFAULT_COPY = {
  headline: '사주와 성향으로 나의 결을 가볍게 살펴봤습니다',
  summary:
    '타고난 사주의 결과 16유형 성향에서 보이는 선택 습관을 함께 보며, 지금 나에게 도움이 될 수 있는 자기이해 포인트를 정리합니다.',
  scoreSummary:
    '6축 점수는 좋고 나쁨을 재는 값이 아니라, 어떤 특성이 더 선명하게 드러나는지 보는 참고 지표입니다.',
  keywords: ['타고난 결', '선택 습관', '오늘의 조절점'],
  ctaLabel: '990원으로 깊이보기',
} as const;

export const LOCKED_SECTION_COPY: Record<
  SajuPersonalityReportSectionKey,
  { teaser: string; ctaLabel: string }
> = {
  oneLineConclusion: {
    teaser: '무료 결과에서 바로 확인할 수 있습니다.',
    ctaLabel: '요약 보기',
  },
  coreKeywords: {
    teaser: '무료 결과에서 핵심 키워드를 먼저 확인할 수 있습니다.',
    ctaLabel: '키워드 보기',
  },
  scoreSummary: {
    teaser: '무료 결과에서 6축 점수 요약을 먼저 확인할 수 있습니다.',
    ctaLabel: '점수 보기',
  },
  shortSajuReading: {
    teaser: '무료 결과에서 짧은 사주 해석을 먼저 확인할 수 있습니다.',
    ctaLabel: '사주 요약 보기',
  },
  shortPersonalityReading: {
    teaser: '무료 결과에서 짧은 성향 해석을 먼저 확인할 수 있습니다.',
    ctaLabel: '성향 요약 보기',
  },
  lockedCta: {
    teaser: '깊이보기에서 더 구체적인 자기이해 전략을 열 수 있습니다.',
    ctaLabel: '깊이보기',
  },
  definition: {
    teaser: '나를 설명하는 한 줄 정의를 더 선명하게 정리합니다.',
    ctaLabel: '한 줄 정의 열기',
  },
  sajuTexture: {
    teaser: '사주에서 보이는 타고난 결과 에너지 흐름을 더 자세히 풀이합니다.',
    ctaLabel: '타고난 결 열기',
  },
  personalityPattern: {
    teaser: '16유형 성향으로 드러나는 선택 습관과 반응 방식을 풀어드립니다.',
    ctaLabel: '성향 방식 열기',
  },
  strengths: {
    teaser: '사주와 성향이 함께 가리키는 나의 강점을 정리합니다.',
    ctaLabel: '강점 열기',
  },
  fatiguePattern: {
    teaser: '반복해서 지치는 지점과 조절하면 좋을 신호를 정리합니다.',
    ctaLabel: '피로 패턴 열기',
  },
  relationshipSelf: {
    teaser: '관계에서 편해지는 거리와 말의 속도를 살펴봅니다.',
    ctaLabel: '관계 속 나 열기',
  },
  workStyle: {
    teaser: '일을 시작하고 끝내는 방식, 몰입 조건을 정리합니다.',
    ctaLabel: '일 방식 열기',
  },
  moneyAchievement: {
    teaser: '돈과 성취를 다루는 기준과 현실 조율 방식을 살펴봅니다.',
    ctaLabel: '돈과 성취 열기',
  },
  growthStrategy: {
    teaser: '지금 시기에 도움이 될 수 있는 성장 전략을 제안합니다.',
    ctaLabel: '성장 전략 열기',
  },
  todayAction: {
    teaser: '오늘 바로 실행해볼 수 있는 짧은 문장을 제공합니다.',
    ctaLabel: '오늘의 문장 열기',
  },
};

export const SAJU_PERSONALITY_CTA_COPY = {
  unlockPaidReport: '990원으로 깊이보기',
  retryCheck: '성향 체크 다시 하기',
  saveReport: '리포트 저장하기',
  shareReport: '공유 카드 만들기',
  startAiChat: 'AI에게 이어서 물어보기',
  restartInput: '다시 입력하기',
} as const;

export function buildLockedSectionCopy(sectionKey: SajuPersonalityReportSectionKey) {
  return LOCKED_SECTION_COPY[sectionKey];
}
