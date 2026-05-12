import { getPersonalityTypeProfile } from '@/domain/personality';
import {
  PAID_REPORT_SECTION_KEYS,
  SAJU_PERSONALITY_CTA_COPY,
  SAJU_PERSONALITY_REPORT_SECTIONS,
  SAJU_PERSONALITY_SAFETY_NOTE,
  buildSajuPersonalityFacts,
  calculateSajuPersonalityScore,
  type BuildSajuPersonalityFactsResult,
  type SajuPersonalityScoreAxis,
  type SajuPersonalityScores,
} from '@/domain/saju-personality';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuPersonalityScopeKey } from '@/lib/payments/saju-personality';
import type { SajuPersonalityInputPayload } from './saju-personality-input-storage';

export interface SajuPersonalityAxisSummary {
  key: SajuPersonalityScoreAxis;
  label: string;
  value: number;
  caption: string;
  color: string;
}

export interface SajuPersonalityLockedPreview {
  title: string;
  teaser: string;
}

export interface SajuPersonalityPaidSection {
  title: string;
  body: string;
}

export interface SajuPersonalityShareCardData {
  keywords: string[];
  axisHighlights: {
    label: string;
    summary: string;
  }[];
  todayMessage: string;
  brandText: string;
  revisitPath: string;
}

export interface SajuPersonalityResultViewModel {
  lifeArea: SajuPersonalityInputPayload['lifeArea'];
  lifeAreaLabel: string;
  headline: string;
  keywords: string[];
  scores: SajuPersonalityScores;
  axisSummaries: SajuPersonalityAxisSummary[];
  sajuSummary: string;
  personalitySummary: string;
  lockedSections: SajuPersonalityLockedPreview[];
  paidSections: SajuPersonalityPaidSection[];
  safetyNote: string;
}

export interface SajuPersonalityFreeResult extends SajuPersonalityResultViewModel {
  facts: BuildSajuPersonalityFactsResult;
}

export interface SajuPersonalityReportSnapshot extends SajuPersonalityResultViewModel {
  version: 1;
  resultType: 'free' | 'paid';
  scopeKey: string;
  shareCard: SajuPersonalityShareCardData;
  savedAt: string;
}

export const SAJU_PERSONALITY_SCORE_LABELS: Array<{
  key: SajuPersonalityScoreAxis;
  label: string;
  desc: string;
  color: string;
}> = [
  {
    key: 'innerEnergyScore',
    label: '내면 에너지',
    desc: '타고난 결과 에너지 회복 방식의 선명도',
    color: 'var(--app-pink)',
  },
  {
    key: 'expressionScore',
    label: '표현',
    desc: '생각과 감정이 밖으로 드러나는 방식',
    color: '#d97706',
  },
  {
    key: 'decisionScore',
    label: '결정',
    desc: '선택 기준과 판단 습관의 뚜렷함',
    color: '#0f766e',
  },
  {
    key: 'executionRhythmScore',
    label: '실행 리듬',
    desc: '시작하고 끝내는 흐름의 감각',
    color: '#2563eb',
  },
  {
    key: 'relationshipSensitivityScore',
    label: '관계 감도',
    desc: '관계에서 거리와 온도를 읽는 방식',
    color: '#be185d',
  },
  {
    key: 'growthDirectionScore',
    label: '성장 방향',
    desc: '지금 시기에 조절하면 좋은 초점',
    color: '#7c3aed',
  },
];

export const SAJU_PERSONALITY_LOCKED_PREVIEWS = [
  '왜 같은 패턴으로 지치는지',
  '연애에서 반복되는 반응',
  '일에서 성과가 나는 방식',
  '돈을 다루는 습관',
  '지금 시기에 맞는 성장 방향',
  '오늘 바로 할 행동',
] as const;

function getScoreBand(value: number) {
  if (value >= 80) return '특성이 또렷하게 보이는 편';
  if (value >= 68) return '무난하게 선명한 편';
  if (value >= 55) return '상황에 따라 달라지는 편';
  return '천천히 관찰할수록 좋은 편';
}

function buildAxisSummaries(scores: SajuPersonalityScores): SajuPersonalityAxisSummary[] {
  return SAJU_PERSONALITY_SCORE_LABELS.map((axis) => ({
    key: axis.key,
    label: axis.label,
    value: scores[axis.key],
    caption: `${axis.desc} · ${getScoreBand(scores[axis.key])}`,
    color: axis.color,
  }));
}

export function buildSajuPersonalityReportFingerprint(payload: SajuPersonalityInputPayload) {
  return JSON.stringify({
    version: payload.version,
    birthInput: payload.birthInput,
    personality: {
      typeCode: payload.personality.typeCode,
      source: payload.personality.source,
      confidence: payload.personality.confidence,
      axisScores: payload.personality.axisScores,
    },
    lifeArea: payload.lifeArea,
  });
}

export function buildSajuPersonalityReportScopeKey(payload: SajuPersonalityInputPayload) {
  return buildSajuPersonalityScopeKey(buildSajuPersonalityReportFingerprint(payload));
}

function buildPaidSections(
  payload: SajuPersonalityInputPayload,
  result: SajuPersonalityFreeResult
): SajuPersonalityPaidSection[] {
  const { facts, personalityProfile, scores } = {
    facts: result.facts,
    personalityProfile: getPersonalityTypeProfile(payload.personality.typeCode),
    scores: result.scores,
  };
  const focus = facts.fusionFacts.recommendedFocus ?? payload.lifeAreaLabel;
  const strongestAxis = result.axisSummaries.reduce((best, axis) =>
    axis.value > best.value ? axis : best
  );
  const energyHint = facts.fusionFacts.energyPattern.actionHint ?? '회복되는 리듬을 먼저 확보하면 좋습니다.';
  const cautionSummary =
    facts.fusionFacts.cautionPattern.summary ??
    '익숙한 반응이 과해질 때 잠시 멈추는 장치가 도움이 될 수 있습니다.';
  const growthHint =
    facts.fusionFacts.growthPattern.actionHint ??
    '오늘 할 일을 작게 쪼개어 바로 움직일 수 있는 형태로 만드는 편이 좋습니다.';

  return PAID_REPORT_SECTION_KEYS.map((key) => {
    const title = SAJU_PERSONALITY_REPORT_SECTIONS[key].title;

    switch (key) {
      case 'definition':
        return {
          title,
          body: `${payload.displayName}님은 ${strongestAxis.label}이 또렷한 ${personalityProfile.title} 흐름입니다. 지금은 ${focus}를 중심으로 자신을 이해하면 선택의 기준이 더 선명해질 수 있습니다.`,
        };
      case 'sajuTexture':
        return {
          title,
          body: `${facts.sajuFacts.dayMaster ? `${facts.sajuFacts.dayMaster}의 결은` : '현재 사주 흐름은'} ${result.sajuSummary} 이 단서는 타고난 속도와 회복 방식을 살피는 참고점으로 보는 것이 좋습니다.`,
        };
      case 'personalityPattern':
        return {
          title,
          body: `${payload.personality.typeCode} 성향은 ${personalityProfile.communicationStyle} ${result.personalitySummary} 그래서 선택 전에는 생각을 정리할 시간과 표현의 온도를 함께 챙기는 방식이 도움이 될 수 있습니다.`,
        };
      case 'strengths':
        return {
          title,
          body: `강점은 ${result.keywords.join(', ')} 쪽에서 잘 드러납니다. 특히 전체 선명도 ${scores.totalClarityScore}점은 사주와 성향 facts가 비슷한 방향을 가리키는 정도를 보여주는 참고 지표입니다.`,
        };
      case 'fatiguePattern':
        return {
          title,
          body: `${cautionSummary} 피로가 반복될 때는 더 밀어붙이기보다, 기준을 하나만 남기고 나머지는 다음 단계로 미루는 방식이 도움이 될 수 있습니다.`,
        };
      case 'relationshipSelf':
        return {
          title,
          body: `${facts.fusionFacts.relationshipPattern.summary} 관계에서는 빠른 결론보다 확인 질문을 먼저 두면 감정 소모를 줄이고 필요한 거리감을 조절하기 좋습니다.`,
        };
      case 'workStyle':
        return {
          title,
          body: `${facts.fusionFacts.executionPattern.summary} 일에서는 시작 조건을 작게 만들고, 마감 전 점검 시간을 따로 두는 리듬이 성과를 안정적으로 만드는 데 도움이 될 수 있습니다.`,
        };
      case 'moneyAchievement':
        return {
          title,
          body: `${facts.fusionFacts.decisionPattern.summary} 돈과 성취에서는 큰 판단을 한 번에 정하기보다, 기록과 우선순위로 선택 기준을 보이게 만드는 습관이 좋습니다.`,
        };
      case 'growthStrategy':
        return {
          title,
          body: `${focus}에서의 성장 전략은 ${energyHint} 조절할 부분은 줄이고, 이미 잘 되는 반응은 반복 가능한 루틴으로 남겨두면 좋습니다.`,
        };
      case 'todayAction':
        return {
          title,
          body: `오늘의 실행 문장: "${growthHint}" 너무 크게 바꾸려 하기보다, 지금 바로 할 수 있는 한 가지 행동으로 시작해 보세요.`,
        };
      default:
        return {
          title,
          body: SAJU_PERSONALITY_REPORT_SECTIONS[key].description,
        };
    }
  });
}

function isPrivateShareKeyword(keyword: string) {
  return keyword.includes('의 결') || /^[EI][NS][FT][JP]\b/.test(keyword);
}

function buildShareAxisSummary(label: string, value: number) {
  if (value >= 76) return `${label} 흐름이 선명하게 살아나는 편`;
  if (value >= 62) return `${label} 흐름은 천천히 살피기 좋은 편`;
  return `${label} 흐름은 부담을 낮출수록 잘 보이는 편`;
}

export function buildSajuPersonalityShareCardData(
  result: SajuPersonalityResultViewModel,
  options: { revisitPath?: string | null } = {}
): SajuPersonalityShareCardData {
  const publicKeywords = result.keywords
    .filter((keyword) => !isPrivateShareKeyword(keyword))
    .slice(0, 3);
  const keywords =
    publicKeywords.length >= 3
      ? publicKeywords
      : [...publicKeywords, '자기이해', '선택 습관', '오늘의 조절점'].slice(0, 3);
  const axisHighlights = [...result.axisSummaries]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((axis) => ({
      label: axis.label,
      summary: buildShareAxisSummary(axis.label, axis.value),
    }));
  const todayMessage =
    result.scores.growthDirectionScore >= 70
      ? '오늘은 잘 되는 리듬을 작게 반복하는 편이 도움이 됩니다.'
      : '오늘은 기준을 하나만 남기고 가볍게 움직이는 편이 도움이 됩니다.';

  return {
    keywords,
    axisHighlights,
    todayMessage,
    brandText: '달빛인생',
    revisitPath: options.revisitPath ?? '/saju/personality',
  };
}

export function buildSajuPersonalityFreeResult(
  payload: SajuPersonalityInputPayload
): SajuPersonalityFreeResult {
  const chart = calculateSajuDataV1(payload.birthInput);
  const facts = buildSajuPersonalityFacts({
    saju: chart,
    personalityProfile: payload.personality,
    lifeArea: payload.lifeArea,
  });
  const scores = calculateSajuPersonalityScore(facts);
  const personalityProfile = getPersonalityTypeProfile(payload.personality.typeCode);
  const strongestAxis = SAJU_PERSONALITY_SCORE_LABELS.reduce((best, item) =>
    scores[item.key] > scores[best.key] ? item : best
  );
  const keywords = [
    facts.sajuFacts.dayMaster ? `${facts.sajuFacts.dayMaster}의 결` : '타고난 결',
    personalityProfile.title,
    payload.lifeAreaLabel,
  ].slice(0, 3);
  const headline = `${payload.displayName}님은 ${strongestAxis.label}이 선명하게 드러나는 ${personalityProfile.title} 흐름입니다.`;
  const sajuSummary =
    facts.sajuFacts.strengthSignals?.[0]?.description ??
    facts.fusionFacts.energyPattern.summary;
  const personalitySummary =
    facts.personalityFacts.preferenceSignals?.[1]?.description ??
    personalityProfile.communicationStyle;
  const baseResult: Omit<SajuPersonalityFreeResult, 'paidSections' | 'facts'> = {
    lifeArea: payload.lifeArea,
    lifeAreaLabel: payload.lifeAreaLabel,
    headline,
    keywords,
    scores,
    axisSummaries: buildAxisSummaries(scores),
    sajuSummary,
    personalitySummary,
    lockedSections: SAJU_PERSONALITY_LOCKED_PREVIEWS.map((title) => ({
      title,
      teaser: '깊이보기에서 개인 흐름에 맞춘 구체적인 설명을 엽니다.',
    })),
    safetyNote: SAJU_PERSONALITY_SAFETY_NOTE,
  };

  const result: SajuPersonalityFreeResult = {
    ...baseResult,
    paidSections: [],
    facts,
  };

  return {
    ...result,
    paidSections: buildPaidSections(payload, result),
  };
}

export function buildSajuPersonalityReportSnapshot(input: {
  result: SajuPersonalityFreeResult;
  resultType: 'free' | 'paid';
  scopeKey: string;
  revisitPath: string;
}): SajuPersonalityReportSnapshot {
  const shareCard = buildSajuPersonalityShareCardData(input.result, {
    revisitPath: input.revisitPath,
  });

  return {
    version: 1,
    resultType: input.resultType,
    scopeKey: input.scopeKey,
    lifeArea: input.result.lifeArea,
    lifeAreaLabel: input.result.lifeAreaLabel,
    headline: input.result.headline,
    keywords: input.result.keywords,
    scores: input.result.scores,
    axisSummaries: input.result.axisSummaries,
    sajuSummary: input.result.sajuSummary,
    personalitySummary: input.result.personalitySummary,
    lockedSections: input.result.lockedSections,
    paidSections: input.result.paidSections,
    safetyNote: input.result.safetyNote,
    shareCard,
    savedAt: new Date().toISOString(),
  };
}

export function buildSajuPersonalityShareText(
  data: SajuPersonalityShareCardData,
  absoluteRevisitUrl: string
) {
  return [
    `${data.brandText} 성향사주`,
    `내 성향사주 키워드: ${data.keywords.join(', ')}`,
    `오늘의 한마디: ${data.todayMessage}`,
    `다시 보기: ${absoluteRevisitUrl}`,
    `더보기: ${SAJU_PERSONALITY_CTA_COPY.unlockPaidReport}`,
  ].join('\n');
}
