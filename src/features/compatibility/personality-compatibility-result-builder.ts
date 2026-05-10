import {
  applyReportGuardrails,
  calculateCompatibilityScore,
  PERSONALITY_COMPATIBILITY_SAFETY_NOTE,
  type CompatibilityAxisScores,
  type CompatibilityQuestionFacts,
  type CompatibilityRelationshipType,
  type CompatibilitySajuFacts,
  type CompatibilityScoreAxis,
  type CompatibilityScoreResult,
} from '@/domain/compatibility-personality';
import { getPersonalityTypeProfile } from '@/domain/personality';
import type {
  PersonalityCompatibilityInputPayload,
  PersonalityCompatibilityQuestionKey,
} from '@/features/compatibility/personality-compatibility-input-storage';
import { buildPersonalityCompatibilityScopeKey } from '@/lib/payments/personality-compatibility';
import type { BirthInput } from '@/lib/saju/types';

export interface PersonalityCompatibilityAxisSummary {
  key: CompatibilityScoreAxis;
  label: string;
  value: number;
  caption: string;
  color: string;
}

export interface PersonalityCompatibilityLockedPreview {
  title: string;
  teaser: string;
}

export interface PersonalityCompatibilityPaidSection {
  title: string;
  body: string;
}

export interface PersonalityCompatibilityShareCardData {
  relationshipKeywords: string[];
  axisHighlights: {
    label: '끌림' | '소통' | '회복';
    summary: string;
  }[];
  todayMessage: string;
  brandText: string;
  revisitPath: string;
}

export interface PersonalityCompatibilityFreeResult {
  relationshipLabel: string;
  questionLabel: string;
  headline: string;
  score: CompatibilityScoreResult;
  axisSummaries: PersonalityCompatibilityAxisSummary[];
  keywords: string[];
  paragraphs: string[];
  lockedSections: PersonalityCompatibilityLockedPreview[];
  paidSections: PersonalityCompatibilityPaidSection[];
  safetyNote: string;
}

export interface PersonalityCompatibilityReportSnapshot extends PersonalityCompatibilityFreeResult {
  version: 1;
  resultType: 'free' | 'paid';
  scopeKey: string;
  shareCard: PersonalityCompatibilityShareCardData;
  savedAt: string;
}

const RELATIONSHIP_LABELS: Record<CompatibilityRelationshipType, string> = {
  dating: '연인/썸',
  marriage: '배우자/결혼',
  friendship: '친구/형제',
  family: '부모/자녀',
  business: '동업/파트너',
};

const QUESTION_FACTS: Record<PersonalityCompatibilityQuestionKey, CompatibilityQuestionFacts> = {
  fit: {
    clarityScore: 76,
    mutualIntentScore: 74,
    topicSensitivityScore: 42,
    repairIntentScore: 70,
  },
  conflict: {
    clarityScore: 58,
    emotionalUrgencyScore: 66,
    topicSensitivityScore: 70,
    repairIntentScore: 64,
  },
  heart: {
    clarityScore: 60,
    mutualIntentScore: 66,
    emotionalUrgencyScore: 54,
    topicSensitivityScore: 56,
  },
  recovery: {
    clarityScore: 68,
    mutualIntentScore: 70,
    emotionalUrgencyScore: 48,
    repairIntentScore: 84,
  },
  timing: {
    clarityScore: 70,
    mutualIntentScore: 66,
    emotionalUrgencyScore: 58,
    topicSensitivityScore: 50,
  },
  long_term: {
    stabilityScore: 76,
    clarityScore: 66,
    mutualIntentScore: 72,
    topicSensitivityScore: 54,
    repairIntentScore: 68,
  },
};

const QUESTION_GUIDANCE: Record<PersonalityCompatibilityQuestionKey, string> = {
  fit: '잘 맞는지보다 어느 장면에서 편안해지는지부터 보면 흐름이 더 부드러워집니다.',
  conflict: '반복되는 다툼은 성격 차이만이 아니라 확인 속도와 표현 방식의 차이에서 커질 가능성이 있습니다.',
  heart: '상대 마음을 단정하기보다 표현 방식의 폭을 먼저 보는 편이 도움이 됩니다.',
  recovery: '가까워지는 흐름은 큰 약속보다 다시 말 걸 수 있는 안전한 문장에서 시작되는 경향이 있습니다.',
  timing: '오늘은 길게 밀어붙이기보다 짧고 부담 낮은 확인이 어울립니다.',
  long_term: '오래 맞춰가는 관계는 같은 감정보다 생활 기준을 조율하는 힘에서 안정됩니다.',
};

const AXIS_META: Record<
  CompatibilityScoreAxis,
  { label: string; color: string; positiveCaption: string }
> = {
  attractionScore: {
    label: '끌림',
    color: 'var(--app-pink)',
    positiveCaption: '서로에게 자연스럽게 눈길이 가는 힘',
  },
  stabilityScore: {
    label: '안정',
    color: 'var(--app-jade)',
    positiveCaption: '일상 리듬을 편하게 맞추는 힘',
  },
  communicationScore: {
    label: '소통',
    color: 'var(--app-gold)',
    positiveCaption: '말의 속도와 확인 방식을 맞추는 힘',
  },
  conflictRiskScore: {
    label: '갈등',
    color: 'var(--app-coral)',
    positiveCaption: '높을수록 말과 기대가 부딪힐 수 있는 신호',
  },
  recoveryScore: {
    label: '회복',
    color: 'var(--app-pink-strong)',
    positiveCaption: '서운함 뒤 다시 편안해지는 힘',
  },
};

const LOCKED_SECTIONS: PersonalityCompatibilityLockedPreview[] = [
  {
    title: '반복 갈등의 진짜 원인',
    teaser: '겉으로 보이는 말다툼 아래의 기대 차이를 더 좁혀 봅니다.',
  },
  {
    title: '상대가 부담을 느끼는 말투',
    teaser: '상대가 밀린다고 느끼기 쉬운 표현을 부드럽게 바꿔 봅니다.',
  },
  {
    title: '오늘 먼저 연락해도 되는지',
    teaser: '지금 질문과 회복 지수를 함께 보며 연락 온도를 제안합니다.',
  },
  {
    title: '관계 회복 문장',
    teaser: '현재 분위기에 맞춘 첫 문장 예시를 준비합니다.',
  },
  {
    title: '장기 관계 가능성',
    teaser: '생활 리듬과 안정 지수를 바탕으로 오래 맞춰갈 조건을 봅니다.',
  },
];

function guardCopy(text: string): string {
  return applyReportGuardrails(text).text;
}

function getScoreBand(value: number): string {
  if (value >= 80) return '강하게 살아나는 편';
  if (value >= 68) return '무난하게 받쳐주는 편';
  if (value >= 55) return '상황에 따라 흔들릴 수 있는 편';
  return '천천히 맞춰갈수록 좋은 편';
}

function getConflictCaption(value: number): string {
  if (value >= 65) return '높을수록 주의가 필요한 신호입니다';
  if (value >= 45) return '서로의 표현 속도를 살피면 낮출 수 있는 신호입니다';
  return '현재는 크게 튀기보다 관리 가능한 신호입니다';
}

function getPositiveAxisValue(scores: CompatibilityAxisScores, axis: CompatibilityScoreAxis) {
  return axis === 'conflictRiskScore' ? 100 - scores.conflictRiskScore : scores[axis];
}

function getStrongestAxis(scores: CompatibilityAxisScores): CompatibilityScoreAxis {
  const positiveAxes: CompatibilityScoreAxis[] = [
    'attractionScore',
    'stabilityScore',
    'communicationScore',
    'recoveryScore',
  ];

  return positiveAxes.reduce((best, axis) =>
    scores[axis] > scores[best] ? axis : best
  );
}

function getCareAxis(scores: CompatibilityAxisScores): CompatibilityScoreAxis {
  if (scores.conflictRiskScore >= 58) return 'conflictRiskScore';

  const careAxes: CompatibilityScoreAxis[] = [
    'attractionScore',
    'stabilityScore',
    'communicationScore',
    'recoveryScore',
  ];

  return careAxes.reduce((lowest, axis) =>
    scores[axis] < scores[lowest] ? axis : lowest
  );
}

function buildNeutralSajuFacts(): CompatibilitySajuFacts {
  return {
    raw: {
      source: 'input_only_preview',
      note: 'Existing saju facts can be connected in a later step.',
    },
  };
}

function buildBirthFingerprint(input: BirthInput) {
  return {
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.unknownTime ? null : input.hour ?? null,
    minute: input.unknownTime ? null : input.minute ?? null,
    unknownTime: Boolean(input.unknownTime),
    gender: input.gender ?? null,
    birthLocationCode: input.birthLocation?.code ?? null,
    solarTimeMode: input.solarTimeMode ?? null,
  };
}

export function buildPersonalityCompatibilityReportFingerprint(
  payload: PersonalityCompatibilityInputPayload
) {
  return JSON.stringify({
    version: payload.version,
    relationshipType: payload.relationshipType,
    questionKey: payload.questionKey,
    self: {
      birthInput: buildBirthFingerprint(payload.self.birthInput),
      personalityType: payload.self.personality.typeCode,
      personalitySource: payload.self.personality.source,
      personalityAxisScores: payload.self.personality.axisScores ?? null,
    },
    partner: {
      birthInput: buildBirthFingerprint(payload.partner.birthInput),
      personalityType: payload.partner.personality.typeCode,
      personalitySource: payload.partner.personality.source,
      personalityAxisScores: payload.partner.personality.axisScores ?? null,
    },
  });
}

export function buildPersonalityCompatibilityReportScopeKey(
  payload: PersonalityCompatibilityInputPayload
) {
  return buildPersonalityCompatibilityScopeKey(
    buildPersonalityCompatibilityReportFingerprint(payload)
  );
}

function buildHeadline(
  payload: PersonalityCompatibilityInputPayload,
  scores: CompatibilityScoreResult
): string {
  if (scores.conflictRiskScore >= 62) {
    return guardCopy(
      `${payload.self.name}님과 ${payload.partner.name}님은 끌림은 살아 있지만, 말의 온도를 먼저 낮추면 더 편해지는 흐름입니다.`
    );
  }

  if (scores.recoveryScore >= 76) {
    return guardCopy(
      `${payload.self.name}님과 ${payload.partner.name}님은 서운함 뒤에도 다시 맞춰볼 여지가 있는 조합입니다.`
    );
  }

  const strongest = AXIS_META[getStrongestAxis(scores)].label;
  return guardCopy(
    `${payload.self.name}님과 ${payload.partner.name}님은 ${strongest}의 힘이 먼저 보이는 관계 흐름입니다.`
  );
}

function buildAxisSummaries(score: CompatibilityScoreResult): PersonalityCompatibilityAxisSummary[] {
  return (Object.keys(AXIS_META) as CompatibilityScoreAxis[]).map((axis) => ({
    key: axis,
    label: AXIS_META[axis].label,
    value: score[axis],
    color: AXIS_META[axis].color,
    caption:
      axis === 'conflictRiskScore'
        ? getConflictCaption(score.conflictRiskScore)
        : `${AXIS_META[axis].positiveCaption} · ${getScoreBand(score[axis])}`,
  }));
}

function buildKeywords(
  payload: PersonalityCompatibilityInputPayload,
  score: CompatibilityScoreResult
): string[] {
  const strongestAxis = getStrongestAxis(score);
  const careAxis = getCareAxis(score);
  const selfProfile = getPersonalityTypeProfile(payload.self.personality.typeCode);
  const partnerProfile = getPersonalityTypeProfile(payload.partner.personality.typeCode);
  const conflictKeyword =
    score.conflictRiskScore >= 58 ? '갈등 신호 관리' : '낮은 갈등 부담';

  return [
    RELATIONSHIP_LABELS[payload.relationshipType],
    `${payload.self.personality.typeCode} ${selfProfile.title}`,
    `${payload.partner.personality.typeCode} ${partnerProfile.title}`,
    `${AXIS_META[strongestAxis].label} 우세`,
    `${AXIS_META[careAxis].label} 조율`,
    conflictKeyword,
  ];
}

function buildParagraphs(
  payload: PersonalityCompatibilityInputPayload,
  score: CompatibilityScoreResult
): string[] {
  const selfProfile = getPersonalityTypeProfile(payload.self.personality.typeCode);
  const partnerProfile = getPersonalityTypeProfile(payload.partner.personality.typeCode);
  const strongestAxis = getStrongestAxis(score);
  const careAxis = getCareAxis(score);
  const strongestLabel = AXIS_META[strongestAxis].label;
  const careLabel = AXIS_META[careAxis].label;
  const conflictNote =
    score.conflictRiskScore >= 58
      ? '갈등 신호가 조금 높게 잡혀 있어, 빠른 결론보다 감정 확인을 먼저 두는 편이 좋습니다.'
      : '갈등 신호는 관리 가능한 편이라, 말의 순서만 맞춰도 분위기가 부드러워질 수 있습니다.';

  return [
    guardCopy(
      `${payload.self.name}님은 ${selfProfile.title}, ${payload.partner.name}님은 ${partnerProfile.title} 흐름으로 입력됐습니다. 두 사람은 ${RELATIONSHIP_LABELS[payload.relationshipType]} 관계에서 ${strongestLabel}이 먼저 보이고, 서로의 생활 속 반응을 읽는 방식이 관계 온도를 좌우할 가능성이 있습니다.`
    ),
    guardCopy(
      `5축을 함께 보면 ${strongestLabel}은 ${score[strongestAxis]}점, ${careLabel}은 ${score[careAxis]}점입니다. 갈등 지수는 ${score.conflictRiskScore}점이며, 이 값은 높을수록 주의가 필요한 신호로 해석합니다. ${conflictNote}`
    ),
    guardCopy(
      `현재 질문은 “${payload.questionLabel}”입니다. ${QUESTION_GUIDANCE[payload.questionKey]} 오늘은 긴 설명보다 짧은 확인, 평가보다 관찰 표현을 쓰는 방식이 도움이 됩니다.`
    ),
  ];
}

function buildPaidSections(
  payload: PersonalityCompatibilityInputPayload,
  score: CompatibilityScoreResult
): PersonalityCompatibilityPaidSection[] {
  const conflictBody =
    score.conflictRiskScore >= 58
      ? `${payload.self.name}님과 ${payload.partner.name}님은 감정 자체보다 확인 속도에서 어긋날 가능성이 있습니다. 한쪽은 바로 반응을 원하고, 다른 쪽은 정리할 시간을 원할 때 말의 온도가 올라가기 쉽습니다.`
      : `${payload.self.name}님과 ${payload.partner.name}님은 갈등 신호가 크게 튀기보다 작은 오해가 쌓일 때 흔들릴 수 있습니다. 서운한 지점을 늦게 말하지 않는 편이 도움이 됩니다.`;
  const toneBody =
    score.communicationScore >= 70
      ? '소통 지수는 받쳐주는 편이라 긴 설명보다 질문의 모양을 다듬는 쪽이 좋습니다. “왜 그랬어?”보다 “나는 이렇게 느꼈는데, 네 쪽은 어땠어?”처럼 여지를 남기는 말이 편합니다.'
      : '소통 지수가 조심스럽게 잡혔습니다. 답을 재촉하거나 마음을 바로 확인하려는 말보다, “지금 부담되면 나중에 말해줘도 괜찮아”처럼 숨 쉴 공간을 주는 표현이 어울립니다.';
  const timingBody =
    score.recoveryScore >= 70
      ? '오늘 먼저 연락한다면 긴 대화보다 짧은 안부형 문장이 어울립니다. 목적을 크게 열기보다 “생각나서 짧게 남겨. 답은 편할 때 줘도 괜찮아” 정도의 낮은 압력이 좋습니다.'
      : '오늘은 바로 깊은 대화를 열기보다 분위기를 확인하는 쪽이 안전합니다. 먼저 연락한다면 질문 하나만 남기고, 답이 늦어도 추가 메시지를 겹치지 않는 방식이 도움이 됩니다.';
  const repairBody =
    score.conflictRiskScore >= 58
      ? '추천 문장: “내가 답을 빨리 듣고 싶어서 말이 조금 앞섰던 것 같아. 네가 편한 속도도 같이 맞춰보고 싶어.”'
      : '추천 문장: “요즘 내가 놓친 부분이 있었는지 궁금했어. 부담 주려는 건 아니고, 편하게 이야기해보고 싶어.”';
  const longTermBody =
    score.stabilityScore >= 70
      ? '장기 관계는 감정의 크기보다 생활 기준을 맞추는 힘에서 안정됩니다. 역할, 연락 빈도, 혼자 있는 시간의 기준을 초반에 작게 합의하면 관계가 덜 소모됩니다.'
      : '장기 관계를 보려면 서로의 생활 리듬을 먼저 확인하는 편이 좋습니다. 좋아하는 마음만으로 밀기보다 돈, 시간, 가족, 일상 루틴 같은 실제 기준을 작게 나누어 보는 방식이 어울립니다.';

  return [
    {
      title: '반복 갈등의 진짜 원인',
      body: guardCopy(conflictBody),
    },
    {
      title: '상대가 부담을 느끼는 말투',
      body: guardCopy(toneBody),
    },
    {
      title: '오늘 먼저 연락해도 되는지',
      body: guardCopy(timingBody),
    },
    {
      title: '관계 회복 문장',
      body: guardCopy(repairBody),
    },
    {
      title: '장기 관계 가능성',
      body: guardCopy(longTermBody),
    },
  ];
}

function buildShareAxisSummary(
  label: '끌림' | '소통' | '회복',
  value: number
): string {
  if (value >= 76) return `${label} 흐름이 자연스럽게 살아나는 편`;
  if (value >= 62) return `${label} 흐름은 천천히 맞추기 좋은 편`;
  return `${label} 흐름은 부담을 낮출수록 좋아지는 편`;
}

function isPrivateShareKeyword(keyword: string) {
  return /^[EI][NS][FT][JP]\b/.test(keyword);
}

export function buildPersonalityCompatibilityShareCardData(
  result: PersonalityCompatibilityFreeResult,
  options: { revisitPath?: string | null } = {}
): PersonalityCompatibilityShareCardData {
  const publicKeywords = result.keywords
    .filter((keyword) => !isPrivateShareKeyword(keyword))
    .slice(0, 4);
  const relationshipKeywords =
    publicKeywords.length >= 3
      ? publicKeywords
      : [
          ...publicKeywords,
          '관계 온도 조율',
          '짧은 확인',
          '회복 여지',
        ].slice(0, 4);

  const todayMessage =
    result.score.recoveryScore >= 70
      ? '오늘은 긴 설명보다 짧고 다정한 확인이 도움이 됩니다.'
      : '오늘은 답을 재촉하기보다 부담 낮은 한마디가 도움이 됩니다.';

  return {
    relationshipKeywords,
    axisHighlights: [
      {
        label: '끌림',
        summary: buildShareAxisSummary('끌림', result.score.attractionScore),
      },
      {
        label: '소통',
        summary: buildShareAxisSummary('소통', result.score.communicationScore),
      },
      {
        label: '회복',
        summary: buildShareAxisSummary('회복', result.score.recoveryScore),
      },
    ],
    todayMessage: guardCopy(todayMessage),
    brandText: '달빛인생',
    revisitPath: options.revisitPath ?? '/compatibility/personality',
  };
}

export function buildPersonalityCompatibilityFreeResult(
  payload: PersonalityCompatibilityInputPayload
): PersonalityCompatibilityFreeResult {
  const personalityFacts = {
    selfType: payload.self.personality.typeCode,
    partnerType: payload.partner.personality.typeCode,
    selfSource: payload.self.personality.source,
    partnerSource: payload.partner.personality.source,
    selfConfidence: payload.self.personality.confidence,
    partnerConfidence: payload.partner.personality.confidence,
    selfAxisScores: payload.self.personality.axisScores,
    partnerAxisScores: payload.partner.personality.axisScores,
    raw: {
      source: 'personality_compatibility_input',
    },
  };
  const score = calculateCompatibilityScore({
    relationshipType: payload.relationshipType,
    sajuFacts: buildNeutralSajuFacts(),
    personalityFacts,
    questionFacts: QUESTION_FACTS[payload.questionKey],
  });

  return {
    relationshipLabel: RELATIONSHIP_LABELS[payload.relationshipType],
    questionLabel: payload.questionLabel,
    headline: buildHeadline(payload, score),
    score,
    axisSummaries: buildAxisSummaries(score),
    keywords: buildKeywords(payload, score),
    paragraphs: buildParagraphs(payload, score),
    lockedSections: LOCKED_SECTIONS.map((section) => ({
      title: guardCopy(section.title),
      teaser: guardCopy(section.teaser),
    })),
    paidSections: buildPaidSections(payload, score),
    safetyNote: PERSONALITY_COMPATIBILITY_SAFETY_NOTE,
  };
}
