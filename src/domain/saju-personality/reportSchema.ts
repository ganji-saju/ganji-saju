import type {
  FusionFacts,
  PersonalityFacts,
  SajuPersonalityFacts,
  SajuPersonalityLifeArea,
  SajuPersonalityReportSectionKey,
  SajuPersonalityScores,
} from './sajuPersonality.types';

export const SAJU_PERSONALITY_REPORT_SCHEMA_VERSION = 'saju-personality-report-v1' as const;

export type SajuPersonalityReportAccess = 'free' | 'paid';

export interface SajuPersonalityReportSectionSchema {
  key: SajuPersonalityReportSectionKey;
  access: SajuPersonalityReportAccess;
  title: string;
  description: string;
  outputShape: 'paragraph' | 'keywordList' | 'scoreSummary' | 'actionList' | 'cta';
}

export interface SajuPersonalityTextSection {
  title: string;
  body: string;
}

export interface SajuPersonalityListSection {
  title: string;
  items: string[];
}

export interface SajuPersonalityLockedSection {
  key: SajuPersonalityReportSectionKey;
  title: string;
  teaser: string;
  ctaLabel: string;
}

export interface SajuPersonalityFreeReport {
  schemaVersion: typeof SAJU_PERSONALITY_REPORT_SCHEMA_VERSION;
  lifeArea: SajuPersonalityLifeArea;
  headline: string;
  summary: string;
  keywords: string[];
  scoreSummary: string;
  sections: {
    oneLineConclusion: SajuPersonalityTextSection;
    coreKeywords: SajuPersonalityListSection;
    scoreSummary: SajuPersonalityTextSection;
    shortSajuReading: SajuPersonalityTextSection;
    shortPersonalityReading: SajuPersonalityTextSection;
    lockedCta: SajuPersonalityTextSection;
  };
  lockedSections: SajuPersonalityLockedSection[];
  safetyNote: string;
  ctaLabel: string;
}

export interface SajuPersonalityPaidReport extends SajuPersonalityFreeReport {
  sections: SajuPersonalityFreeReport['sections'] & {
    definition: SajuPersonalityTextSection;
    sajuTexture: SajuPersonalityTextSection;
    personalityPattern: SajuPersonalityTextSection;
    strengths: SajuPersonalityListSection;
    fatiguePattern: SajuPersonalityTextSection;
    relationshipSelf: SajuPersonalityTextSection;
    workStyle: SajuPersonalityTextSection;
    moneyAchievement: SajuPersonalityTextSection;
    growthStrategy: SajuPersonalityTextSection;
    todayAction: SajuPersonalityListSection;
  };
  lockedSections: [];
}

export interface SajuPersonalityReportPromptContext {
  life_area: SajuPersonalityLifeArea | string;
  saju_facts: SajuPersonalityFacts | Record<string, unknown>;
  personality_facts: PersonalityFacts | Record<string, unknown>;
  fusion_facts: FusionFacts | Record<string, unknown>;
  score_json: SajuPersonalityScores | Record<string, unknown>;
  requested_sections: readonly SajuPersonalityReportSectionKey[];
}

export const SAJU_PERSONALITY_REPORT_SECTIONS: Record<
  SajuPersonalityReportSectionKey,
  SajuPersonalityReportSectionSchema
> = {
  oneLineConclusion: {
    key: 'oneLineConclusion',
    access: 'free',
    title: '한 줄 결론',
    description: '사주와 성향을 함께 본 자기이해 결론을 한 문장으로 정리합니다.',
    outputShape: 'paragraph',
  },
  coreKeywords: {
    key: 'coreKeywords',
    access: 'free',
    title: '핵심 키워드 3개',
    description: '사용자의 결을 기억하기 쉬운 3개 키워드로 정리합니다.',
    outputShape: 'keywordList',
  },
  scoreSummary: {
    key: 'scoreSummary',
    access: 'free',
    title: '6축 점수 요약',
    description: '점수가 좋고 나쁨이 아니라 자기이해 선명도와 특성 강도임을 설명합니다.',
    outputShape: 'scoreSummary',
  },
  shortSajuReading: {
    key: 'shortSajuReading',
    access: 'free',
    title: '짧은 사주 해석',
    description: '기존 사주 facts에서 보이는 타고난 결을 생활 언어로 짧게 풀이합니다.',
    outputShape: 'paragraph',
  },
  shortPersonalityReading: {
    key: 'shortPersonalityReading',
    access: 'free',
    title: '짧은 성향 해석',
    description: '16유형 성향 또는 성향 체크에서 드러나는 선택 습관을 짧게 풀이합니다.',
    outputShape: 'paragraph',
  },
  lockedCta: {
    key: 'lockedCta',
    access: 'free',
    title: '잠금 영역 CTA',
    description: '깊이보기에서 열리는 항목과 다음 행동을 안내합니다.',
    outputShape: 'cta',
  },
  definition: {
    key: 'definition',
    access: 'paid',
    title: '한 줄 정의',
    description: '사용자의 타고난 결과 선택 습관을 압축한 정의를 제공합니다.',
    outputShape: 'paragraph',
  },
  sajuTexture: {
    key: 'sajuTexture',
    access: 'paid',
    title: '사주로 보는 타고난 결',
    description: '사주 facts에서 보이는 기본 기질, 에너지, 균형 단서를 풀이합니다.',
    outputShape: 'paragraph',
  },
  personalityPattern: {
    key: 'personalityPattern',
    access: 'paid',
    title: '성향으로 드러나는 방식',
    description: '16유형 성향이 일상 선택과 반응으로 드러나는 방식을 풀이합니다.',
    outputShape: 'paragraph',
  },
  strengths: {
    key: 'strengths',
    access: 'paid',
    title: '나의 강점',
    description: '사주와 성향이 함께 가리키는 강점과 활용법을 정리합니다.',
    outputShape: 'keywordList',
  },
  fatiguePattern: {
    key: 'fatiguePattern',
    access: 'paid',
    title: '반복해서 지치는 지점',
    description: '과해지거나 어긋날 때 피로가 쌓이는 패턴을 완화 표현으로 풀이합니다.',
    outputShape: 'paragraph',
  },
  relationshipSelf: {
    key: 'relationshipSelf',
    access: 'paid',
    title: '관계에서의 나',
    description: '관계에서 편해지는 거리, 말의 속도, 마음 확인 방식을 정리합니다.',
    outputShape: 'paragraph',
  },
  workStyle: {
    key: 'workStyle',
    access: 'paid',
    title: '일하는 방식',
    description: '일을 시작하고 끝내는 리듬, 몰입 조건, 협업 포인트를 풀이합니다.',
    outputShape: 'paragraph',
  },
  moneyAchievement: {
    key: 'moneyAchievement',
    access: 'paid',
    title: '돈과 성취 방식',
    description: '돈, 성취, 현실 조율을 다루는 습관과 기준을 풀이합니다.',
    outputShape: 'paragraph',
  },
  growthStrategy: {
    key: 'growthStrategy',
    access: 'paid',
    title: '지금 시기의 성장 전략',
    description: '현재 흐름에서 도움이 될 수 있는 성장 초점과 조절 포인트를 제공합니다.',
    outputShape: 'paragraph',
  },
  todayAction: {
    key: 'todayAction',
    access: 'paid',
    title: '오늘의 실행 문장',
    description: '오늘 바로 실천할 수 있는 짧은 문장과 행동을 제공합니다.',
    outputShape: 'actionList',
  },
};

export const FREE_REPORT_SECTION_KEYS = Object.values(SAJU_PERSONALITY_REPORT_SECTIONS)
  .filter((section) => section.access === 'free')
  .map((section) => section.key);

export const PAID_REPORT_SECTION_KEYS = Object.values(SAJU_PERSONALITY_REPORT_SECTIONS)
  .filter((section) => section.access === 'paid')
  .map((section) => section.key);

export const LOCKED_REPORT_SECTION_KEYS = [...PAID_REPORT_SECTION_KEYS];

export const SAJU_PERSONALITY_REPORT_SCHEMA = {
  schemaVersion: SAJU_PERSONALITY_REPORT_SCHEMA_VERSION,
  freeReport: {
    required: [
      'lifeArea',
      'headline',
      'summary',
      'keywords',
      'scoreSummary',
      'sections',
      'lockedSections',
      'safetyNote',
      'ctaLabel',
    ],
    sections: FREE_REPORT_SECTION_KEYS,
  },
  paidReport: {
    required: [
      'lifeArea',
      'headline',
      'summary',
      'keywords',
      'scoreSummary',
      'sections',
      'lockedSections',
      'safetyNote',
      'ctaLabel',
    ],
    sections: [...FREE_REPORT_SECTION_KEYS, ...PAID_REPORT_SECTION_KEYS],
  },
  sections: SAJU_PERSONALITY_REPORT_SECTIONS,
  lockedSections: LOCKED_REPORT_SECTION_KEYS,
} as const;

export function isReportSectionKey(value: string): value is SajuPersonalityReportSectionKey {
  return value in SAJU_PERSONALITY_REPORT_SECTIONS;
}

export function normalizeRequestedReportSections(
  requestedSections: readonly string[] | undefined,
  fallback: readonly SajuPersonalityReportSectionKey[] = FREE_REPORT_SECTION_KEYS
): SajuPersonalityReportSectionKey[] {
  const normalized = (requestedSections ?? []).filter(isReportSectionKey);
  const source = normalized.length > 0 ? normalized : fallback;

  return [...new Set(source)];
}
