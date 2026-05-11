import type {
  CompatibilityPersonalityFacts,
  CompatibilitySajuFacts,
  CompatibilityScores,
} from './compatibility.types';

export const PERSONALITY_COMPATIBILITY_REPORT_SCHEMA_VERSION =
  'compatibility-personality-report-v1' as const;

export type PersonalityCompatibilityReportAccess = 'free' | 'paid';

export type PersonalityCompatibilityReportSectionKey =
  | 'overview'
  | 'scoreSummary'
  | 'attraction'
  | 'stability'
  | 'communication'
  | 'conflictPattern'
  | 'recovery'
  | 'practicalActions'
  | 'questionAdvice';

export interface PersonalityCompatibilityReportSectionSchema {
  key: PersonalityCompatibilityReportSectionKey;
  access: PersonalityCompatibilityReportAccess;
  title: string;
  description: string;
  outputShape: 'paragraph' | 'bulletList' | 'actionList';
}

export interface PersonalityCompatibilityTextSection {
  title: string;
  body: string;
}

export interface PersonalityCompatibilityListSection {
  title: string;
  items: string[];
}

export interface PersonalityCompatibilityLockedSection {
  key: PersonalityCompatibilityReportSectionKey;
  title: string;
  teaser: string;
  ctaLabel: string;
}

export interface PersonalityCompatibilityFreeReport {
  schemaVersion: typeof PERSONALITY_COMPATIBILITY_REPORT_SCHEMA_VERSION;
  headline: string;
  summary: string;
  scoreSummary: string;
  highlights: string[];
  sections: {
    overview: PersonalityCompatibilityTextSection;
    scoreSummary: PersonalityCompatibilityTextSection;
    attraction: PersonalityCompatibilityTextSection;
    stability: PersonalityCompatibilityTextSection;
  };
  lockedSections: PersonalityCompatibilityLockedSection[];
  safetyNote: string;
  ctaLabel: string;
}

export interface PersonalityCompatibilityPaidReport extends PersonalityCompatibilityFreeReport {
  sections: PersonalityCompatibilityFreeReport['sections'] & {
    communication: PersonalityCompatibilityTextSection;
    conflictPattern: PersonalityCompatibilityTextSection;
    recovery: PersonalityCompatibilityTextSection;
    practicalActions: PersonalityCompatibilityListSection;
    questionAdvice: PersonalityCompatibilityTextSection;
  };
  lockedSections: [];
}

export interface PersonalityCompatibilityReportPromptContext {
  relationship_type: string;
  question_type: string;
  saju_facts: CompatibilitySajuFacts | Record<string, unknown>;
  personality_facts: CompatibilityPersonalityFacts | Record<string, unknown>;
  score_json: CompatibilityScores | Record<string, unknown>;
  requested_sections: readonly PersonalityCompatibilityReportSectionKey[];
}

export const PERSONALITY_COMPATIBILITY_REPORT_SECTIONS: Record<
  PersonalityCompatibilityReportSectionKey,
  PersonalityCompatibilityReportSectionSchema
> = {
  overview: {
    key: 'overview',
    access: 'free',
    title: '관계 한눈 요약',
    description: '두 사람의 현재 관계 결을 생활 언어로 짧게 요약합니다.',
    outputShape: 'paragraph',
  },
  scoreSummary: {
    key: 'scoreSummary',
    access: 'free',
    title: '점수 해석',
    description: '5축 점수와 종합 점수를 쉽게 풀어줍니다.',
    outputShape: 'paragraph',
  },
  attraction: {
    key: 'attraction',
    access: 'free',
    title: '끌림 포인트',
    description: '서로에게 자연스럽게 끌리는 지점을 정리합니다.',
    outputShape: 'paragraph',
  },
  stability: {
    key: 'stability',
    access: 'free',
    title: '안정 포인트',
    description: '관계가 편안해지는 조건과 생활 리듬을 정리합니다.',
    outputShape: 'paragraph',
  },
  communication: {
    key: 'communication',
    access: 'paid',
    title: '소통 방식',
    description: '대화 속도, 말투, 확인 방식의 차이를 풀이합니다.',
    outputShape: 'paragraph',
  },
  conflictPattern: {
    key: 'conflictPattern',
    access: 'paid',
    title: '갈등 패턴',
    description: '갈등 위험이 커지는 장면과 조심할 표현을 정리합니다.',
    outputShape: 'paragraph',
  },
  recovery: {
    key: 'recovery',
    access: 'paid',
    title: '회복 방식',
    description: '서운함 이후 관계를 다시 안정시키는 방법을 정리합니다.',
    outputShape: 'paragraph',
  },
  practicalActions: {
    key: 'practicalActions',
    access: 'paid',
    title: '실천 행동',
    description: '관계 유형과 질문에 맞는 구체적인 행동 목록을 제공합니다.',
    outputShape: 'actionList',
  },
  questionAdvice: {
    key: 'questionAdvice',
    access: 'paid',
    title: '질문별 조언',
    description: '사용자가 지금 묻는 주제에 맞춰 다음 대화 방향을 제안합니다.',
    outputShape: 'paragraph',
  },
};

export const FREE_REPORT_SECTION_KEYS = Object.values(PERSONALITY_COMPATIBILITY_REPORT_SECTIONS)
  .filter((section) => section.access === 'free')
  .map((section) => section.key);

export const PAID_REPORT_SECTION_KEYS = Object.values(PERSONALITY_COMPATIBILITY_REPORT_SECTIONS)
  .filter((section) => section.access === 'paid')
  .map((section) => section.key);

export const LOCKED_REPORT_SECTION_KEYS = [...PAID_REPORT_SECTION_KEYS];

export const PERSONALITY_COMPATIBILITY_REPORT_SCHEMA = {
  schemaVersion: PERSONALITY_COMPATIBILITY_REPORT_SCHEMA_VERSION,
  freeReport: {
    required: [
      'headline',
      'summary',
      'scoreSummary',
      'highlights',
      'sections',
      'lockedSections',
      'safetyNote',
      'ctaLabel',
    ],
    sections: FREE_REPORT_SECTION_KEYS,
  },
  paidReport: {
    required: [
      'headline',
      'summary',
      'scoreSummary',
      'highlights',
      'sections',
      'lockedSections',
      'safetyNote',
      'ctaLabel',
    ],
    sections: [...FREE_REPORT_SECTION_KEYS, ...PAID_REPORT_SECTION_KEYS],
  },
  sections: PERSONALITY_COMPATIBILITY_REPORT_SECTIONS,
  lockedSections: LOCKED_REPORT_SECTION_KEYS,
} as const;

export function isReportSectionKey(
  value: string
): value is PersonalityCompatibilityReportSectionKey {
  return value in PERSONALITY_COMPATIBILITY_REPORT_SECTIONS;
}

export function normalizeRequestedReportSections(
  requestedSections: readonly string[] | undefined,
  fallback: readonly PersonalityCompatibilityReportSectionKey[] = FREE_REPORT_SECTION_KEYS
): PersonalityCompatibilityReportSectionKey[] {
  const normalized = (requestedSections ?? []).filter(isReportSectionKey);
  const source = normalized.length > 0 ? normalized : fallback;

  return [...new Set(source)];
}
