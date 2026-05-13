import {
  calculatePersonalityAxisScores,
  estimatePersonalityType,
  getCommunicationRule,
  getPersonalityTypeProfile,
  isPersonalityTypeCode,
} from '@/domain/personality';
import type {
  PersonalityAxis,
  PersonalityAxisPole,
  PersonalityAxisScores,
  PersonalityCheckAnswer,
  PersonalityProfileSource,
  PersonalityTypeCode,
} from '@/domain/personality/personality.types';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildFusionFacts } from './fusionRules';
import type {
  BuildSajuPersonalityFactsInput,
  BuildSajuPersonalityFactsResult,
  PersonalityFacts,
  SajuPersonalityChartInput,
  SajuPersonalityFactSignal,
  SajuPersonalityFacts,
  SajuPersonalityProfileInput,
} from './sajuPersonality.types';

const AXIS_ORDER: readonly PersonalityAxis[] = ['IE', 'SN', 'TF', 'JP'];

const AXIS_POLES: Record<
  PersonalityAxis,
  { negative: PersonalityAxisPole; positive: PersonalityAxisPole }
> = {
  IE: { negative: 'I', positive: 'E' },
  SN: { negative: 'S', positive: 'N' },
  TF: { negative: 'T', positive: 'F' },
  JP: { negative: 'J', positive: 'P' },
};

const TYPE_CODE_AXIS_INDEX: Record<PersonalityAxis, number> = {
  IE: 0,
  SN: 1,
  TF: 2,
  JP: 3,
};

export function buildSajuPersonalityFacts(
  input: BuildSajuPersonalityFactsInput
): BuildSajuPersonalityFactsResult {
  const sajuFacts = buildSajuFacts(input.saju);
  const personalityFacts = buildPersonalityFacts(input.personalityProfile);
  const fusionFacts = buildFusionFacts({
    sajuFacts,
    personalityFacts,
    lifeArea: input.lifeArea,
  });

  return {
    sajuFacts,
    personalityFacts,
    fusionFacts,
  };
}

export function buildSajuFacts(input: SajuPersonalityChartInput): SajuPersonalityFacts {
  if (!isSajuDataV1Like(input)) {
    return normalizeSajuFacts(input);
  }

  const dayMasterLabel = compactText([
    input.dayMaster.metaphor,
    input.dayMaster.description,
  ]).join(' · ');
  const dominantElement = input.fiveElements.dominant;
  const weakestElement = input.fiveElements.weakest;
  const yongsinPrimary = input.yongsin?.primary?.label ?? input.yongsin?.primary?.value;
  const yongsinSecondary = input.yongsin?.secondary?.map((item) => item.label ?? item.value) ?? [];
  const yongsinCautions = input.yongsin?.kiyshin?.map((item) => item.label ?? item.value) ?? [];
  const currentLuckNotes = [
    ...(input.currentLuck?.currentMajorLuck?.notes ?? []),
    ...(input.currentLuck?.saewoon?.notes ?? []),
    ...(input.currentLuck?.wolwoon?.notes ?? []),
  ];

  const strengthSignals = compactSignals([
    createSignal(
      'saju:day-master',
      `일간 ${input.dayMaster.stem}`,
      dayMasterLabel || '타고난 중심 기질을 보여주는 사주 기준점입니다.',
      0.84
    ),
    createSignal(
      'saju:dominant',
      `두드러지는 기운 ${dominantElement}`,
      `${dominantElement} 기운이 상대적으로 선명하게 나타납니다.`,
      0.78
    ),
    input.strength
      ? createSignal(
          'saju:strength',
          `신강약 ${input.strength.level}`,
          input.strength.rationale[0] ?? '기본 에너지 운용 방식을 볼 때 참고하는 신호입니다.',
          0.76
        )
      : null,
    yongsinPrimary
      ? createSignal(
          'saju:yongsin',
          `균형에 도움 되는 단서 ${yongsinPrimary}`,
          input.yongsin?.plainSummary ?? '균형을 잡을 때 참고하는 보완 신호입니다.',
          0.72
        )
      : null,
  ]);

  const cautionSignals = compactSignals([
    createSignal(
      'saju:weakest',
      `보완이 필요한 기운 ${weakestElement}`,
      `${weakestElement} 기운은 과하게 단정하기보다 생활 리듬에서 보완할 단서로 봅니다.`,
      0.72
    ),
    yongsinCautions.length > 0
      ? createSignal(
          'saju:caution-yongsin',
          '과해지면 피로한 단서',
          yongsinCautions.join(', '),
          0.68
        )
      : null,
    input.input.hourKnown
      ? null
      : createSignal(
          'saju:unknown-hour',
          '태어난 시간 미상',
          '시주가 비어 있어 세부 실행 리듬은 보수적으로 해석합니다.',
          0.58
        ),
  ]);

  const timingSignals = currentLuckNotes.slice(0, 3).map((note, index) =>
    createSignal(`saju:timing:${index + 1}`, '현재 흐름 단서', note, 0.66)
  );

  return {
    chartVersion: input.schemaVersion,
    dayMaster: input.dayMaster.stem,
    primaryElements: compactText([dominantElement, yongsinPrimary, ...yongsinSecondary]),
    supportiveElements: compactText([yongsinPrimary, ...yongsinSecondary]),
    tensionElements: compactText([weakestElement, ...yongsinCautions]),
    seasonalTone: `${input.pillars.month.ganzi}월의 계절감`,
    timingSignals,
    strengthSignals,
    cautionSignals,
    raw: {
      source: 'saju-data-v1',
      engineVersion: input.metadata.engineVersion,
      ruleSetVersion: input.metadata.ruleSetVersion,
      completeness: input.metadata.completeness,
    },
  };
}

export function buildPersonalityFacts(
  input: SajuPersonalityProfileInput
): PersonalityFacts {
  const answers = getAnswers(input);
  const estimated = answers.length > 0 ? estimatePersonalityType(answers) : null;
  const typeCode = resolveTypeCode(input, estimated?.typeCode ?? null);
  const axisScores = resolveAxisScores(input, answers, estimated?.axisScores);
  const source = resolveSource(input);
  const confidence = clamp01(resolveConfidence(input, estimated?.confidence));
  const typeProfile = typeCode ? getPersonalityTypeProfile(typeCode) : null;
  const poles = resolveAxisPoles(typeCode, axisScores);
  const rules = poles.map((pole) => getCommunicationRule(pole));

  const preferenceSignals = compactSignals([
    createSignal(
      'personality:energy',
      rules[0]?.title ?? '에너지 회복 방식',
      rules[0]?.prefers ?? '에너지를 회복하는 방식을 확인할 성향 단서가 부족합니다.',
      confidence
    ),
    createSignal(
      'personality:expression',
      typeProfile?.title ?? '표현 방식',
      typeProfile?.communicationStyle ?? '말과 반응으로 드러나는 방식을 보수적으로 봅니다.',
      confidence
    ),
    createSignal(
      'personality:decision',
      `${rules[1]?.title ?? '정보 처리'} · ${rules[2]?.title ?? '판단 기준'}`,
      `${rules[1]?.prefers ?? ''} ${rules[2]?.prefers ?? ''}`.trim(),
      confidence
    ),
    createSignal(
      'personality:execution',
      rules[3]?.title ?? '실행 리듬',
      rules[3]?.prefers ?? '실행 리듬을 확인할 성향 단서가 부족합니다.',
      confidence
    ),
    createSignal(
      'personality:relationship',
      '관계에서 편해지는 방식',
      typeProfile?.relationshipHint ?? '관계에서 편한 거리와 속도를 조심스럽게 확인합니다.',
      confidence
    ),
  ]);

  const cautionSignals = compactSignals([
    typeProfile
      ? createSignal('personality:caution:type', '성향상 조심할 지점', typeProfile.caution, confidence)
      : null,
    ...rules.map((rule) =>
      createSignal(`personality:caution:${rule.pole}`, rule.title, rule.carePoint, confidence)
    ),
  ]);

  return {
    typeCode,
    source,
    confidence,
    axisScores,
    profileTitle: typeProfile?.title,
    keywords: compactText([typeProfile?.title, ...rules.map((rule) => rule.title)]),
    preferenceSignals,
    cautionSignals,
    raw: {
      source: 'personality-profile',
      inputMethod: source,
      answeredCount: estimated?.answeredCount ?? answers.length,
      missingQuestionIds: estimated?.missingQuestionIds ?? [],
    },
  };
}

function normalizeSajuFacts(input: SajuPersonalityFacts): SajuPersonalityFacts {
  return {
    ...input,
    primaryElements: input.primaryElements ?? [],
    supportiveElements: input.supportiveElements ?? [],
    tensionElements: input.tensionElements ?? [],
    timingSignals: input.timingSignals ?? [],
    strengthSignals: input.strengthSignals ?? [],
    cautionSignals: input.cautionSignals ?? [],
    raw: {
      ...(input.raw ?? {}),
      source: input.raw?.source ?? 'saju-personality-facts',
    },
  };
}

function resolveTypeCode(
  input: SajuPersonalityProfileInput,
  fallback: PersonalityTypeCode | null
): PersonalityTypeCode | null {
  const value = getRecordValue(input, 'typeCode');
  if (isPersonalityTypeCode(value)) return value;
  return fallback;
}

function resolveAxisScores(
  input: SajuPersonalityProfileInput,
  answers: readonly PersonalityCheckAnswer[],
  fallback?: PersonalityAxisScores
): PersonalityAxisScores | undefined {
  const value = getRecordValue(input, 'axisScores');
  if (isPersonalityAxisScores(value)) return value;
  if (fallback) return fallback;
  if (answers.length > 0) return calculatePersonalityAxisScores(answers);
  return undefined;
}

function resolveSource(input: SajuPersonalityProfileInput): PersonalityProfileSource {
  const source = getRecordValue(input, 'source');
  if (source === 'moonlight_check' || source === 'self_reported') return source;
  return getAnswers(input).length > 0 ? 'moonlight_check' : 'self_reported';
}

function resolveConfidence(
  input: SajuPersonalityProfileInput,
  fallback?: number
): number {
  const confidence = getRecordValue(input, 'confidence');
  if (typeof confidence === 'number') return confidence;
  return fallback ?? 0.55;
}

function resolveAxisPoles(
  typeCode: PersonalityTypeCode | null,
  axisScores?: PersonalityAxisScores
): PersonalityAxisPole[] {
  return AXIS_ORDER.map((axis) => {
    const score = axisScores?.[axis];
    if (typeof score === 'number' && score !== 0) {
      return score > 0 ? AXIS_POLES[axis].positive : AXIS_POLES[axis].negative;
    }

    if (typeCode) {
      const pole = typeCode[TYPE_CODE_AXIS_INDEX[axis]];
      if (isPersonalityAxisPole(pole)) return pole;
    }

    return AXIS_POLES[axis].negative;
  });
}

function getAnswers(input: SajuPersonalityProfileInput): PersonalityCheckAnswer[] {
  const answers = getRecordValue(input, 'answers');
  if (!Array.isArray(answers)) return [];

  return answers.filter((answer): answer is PersonalityCheckAnswer => {
    if (!isRecord(answer)) return false;
    return typeof answer.questionId === 'string' && typeof answer.value === 'string';
  });
}

function isSajuDataV1Like(input: SajuPersonalityChartInput): input is SajuDataV1 {
  return (
    isRecord(input) &&
    input.schemaVersion === 'saju-data/v1' &&
    isRecord(input.input) &&
    isRecord(input.metadata) &&
    isRecord(input.pillars) &&
    isRecord(input.fiveElements) &&
    isRecord(input.dayMaster)
  );
}

function isPersonalityAxisScores(value: unknown): value is PersonalityAxisScores {
  if (!isRecord(value)) return false;
  return AXIS_ORDER.every((axis) => typeof value[axis] === 'number');
}

function isPersonalityAxisPole(value: unknown): value is PersonalityAxisPole {
  return (
    value === 'I' ||
    value === 'E' ||
    value === 'S' ||
    value === 'N' ||
    value === 'T' ||
    value === 'F' ||
    value === 'J' ||
    value === 'P'
  );
}

function createSignal(
  key: string,
  label: string,
  description: string,
  confidence: number
): SajuPersonalityFactSignal {
  return {
    key,
    label,
    description,
    source: key.startsWith('personality:') ? 'personality' : 'saju',
    confidence: clamp01(confidence),
  };
}

function compactSignals(
  signals: readonly (SajuPersonalityFactSignal | null | undefined)[]
): SajuPersonalityFactSignal[] {
  return signals.filter((signal): signal is SajuPersonalityFactSignal => Boolean(signal));
}

function compactText(values: readonly (string | null | undefined)[]): string[] {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function getRecordValue(input: unknown, key: string): unknown {
  if (!isRecord(input)) return undefined;
  return input[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
