import { buildSajuReport, type SajuInterpretationGrounding } from '@/domain/saju/report';
import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { MoonlightCounselorId } from '@/lib/counselors';
import { selectUpsell } from '@/lib/upsell';
import { getTodayConcern } from '@/lib/today-fortune/concerns';
import type {
  ConcernId,
  TodayCalendarType,
  TodayFortuneBirthPayload,
  TodayFortuneFreeResult,
  TodayFortunePremiumResult,
  TodayTimeRule,
} from '@/lib/today-fortune/types';
import type { BirthInput } from '@/lib/saju/types';
import {
  buildPublicGroundingSummary,
  buildPublicOpportunity,
  buildPublicReasonBody,
  buildPublicRisk,
  buildPublicTodayBody,
  buildPublicTodayHeadline,
  buildPublicTodayProfile,
} from './build-today-fortune-copy';
import {
  buildAvoidActions,
  buildConditionScore,
  buildEvidenceLines,
  buildRecommendedActions,
  buildScenarioComparison,
  buildTimeWindows,
  buildTodayGroundingSummary,
  toTodayScores,
} from './build-today-fortune-score';

interface TodayFortuneBuildOptions {
  concernId: ConcernId;
  sourceSessionId: string;
  calendarType: TodayCalendarType;
  timeRule: TodayTimeRule;
  counselorId?: MoonlightCounselorId | null;
  grounding?: SajuInterpretationGrounding | null;
  kasiComparison?: KasiSingleInputComparison | null;
}

export function buildTodayFortuneFreeResult(
  input: BirthInput,
  sajuData: SajuDataV1,
  options: TodayFortuneBuildOptions
): TodayFortuneFreeResult {
  const concern = getTodayConcern(options.concernId);
  const todayReport = buildSajuReport(input, sajuData, 'today');
  const loveReport = buildSajuReport(input, sajuData, 'love');
  const wealthReport = buildSajuReport(input, sajuData, 'wealth');
  const careerReport = buildSajuReport(input, sajuData, 'career');
  const relationshipReport = buildSajuReport(input, sajuData, 'relationship');
  const profile = buildPublicTodayProfile(input, sajuData, options);
  const conditionScore = buildConditionScore(todayReport, loveReport, wealthReport, sajuData);
  const scores = toTodayScores(
    todayReport,
    loveReport,
    wealthReport,
    careerReport,
    relationshipReport,
    conditionScore,
    profile
  );
  const reasonBody = buildPublicReasonBody(profile, Boolean(input.unknownTime));
  const groundingSummary = buildPublicGroundingSummary(profile, options.kasiComparison);
  const upsell = selectUpsell({ scores }, options.concernId);
  const opportunity = buildPublicOpportunity(options.concernId, profile);
  const risk = buildPublicRisk(options.concernId, profile);

  return {
    sourceSessionId: options.sourceSessionId,
    concernId: options.concernId,
    concernLabel: concern.label,
    concernHanja: concern.hanja,
    focusTopic: concern.focusTopic,
    birthMeta: {
      calendarType: options.calendarType,
      timeRule: options.timeRule,
      unknownBirthTime: Boolean(input.unknownTime),
      usesLocation: Boolean(input.birthLocation),
    },
    oneLine: {
      eyebrow: `${concern.prompt} · ${concern.hanja}`,
      headline: buildPublicTodayHeadline(options.concernId, profile),
      body: buildPublicTodayBody(
        options.concernId,
        profile,
        Boolean(input.unknownTime)
      ),
    },
    scores,
    opportunity: {
      title: opportunity.title,
      body: opportunity.body,
    },
    risk: {
      title: risk.title,
      body: risk.body,
    },
    reasonSnippet: {
      title: '사주 근거 한 줄',
      body: reasonBody,
    },
    groundingSummary,
    nextAction: {
      copy: upsell.copy,
      product: 'TODAY_DEEP_READING',
      coinCost: 1,
    },
    followUpQuestions: concern.followUpQuestions,
  };
}

export function buildTodayFortunePremiumResult(
  input: BirthInput,
  sajuData: SajuDataV1,
  concernId: ConcernId,
  grounding?: SajuInterpretationGrounding | null,
  kasiComparison?: KasiSingleInputComparison | null
): TodayFortunePremiumResult {
  const concern = getTodayConcern(concernId);
  const todayReport = buildSajuReport(input, sajuData, 'today');
  const focusReport =
    concern.focusTopic === 'today'
      ? todayReport
      : buildSajuReport(input, sajuData, concern.focusTopic);

  return {
    productCode: 'TODAY_DEEP_READING',
    coinCost: 1,
    groundingSummary: buildTodayGroundingSummary(
      grounding,
      kasiComparison,
      focusReport,
      sajuData
    ),
    favorableWindows: buildTimeWindows(concernId, focusReport, sajuData, 'favorable'),
    cautionWindows: buildTimeWindows(concernId, focusReport, sajuData, 'caution'),
    avoidActions: buildAvoidActions(concernId, focusReport, input, sajuData),
    recommendedActions: buildRecommendedActions(concernId, focusReport, sajuData),
    scenarios: buildScenarioComparison(concernId, focusReport, sajuData),
    evidenceLines: buildEvidenceLines(focusReport, todayReport, sajuData, Boolean(input.unknownTime)),
    followUpQuestions: concern.followUpQuestions,
    safetyNote:
      concernId === 'energy_health'
        ? '건강운은 질병 진단이 아니라 컨디션, 휴식, 생활 리듬을 읽는 참고 조언으로 제한합니다.'
        : concernId === 'money_spend'
          ? '재물운은 투자 종목이나 매수·매도 지시가 아니라 돈이 새기 쉬운 패턴과 정산 타이밍을 읽는 참고 조언입니다.'
          : '관계와 선택의 흐름을 읽는 참고 해석이며, 이별·파혼·법적 판단처럼 큰 결론을 단정하지 않습니다.',
  };
}

export function buildBirthInputFromTodayPayload(
  payload: TodayFortuneBirthPayload
): Omit<TodayFortuneBuildOptions, 'sourceSessionId' | 'counselorId'> & {
  birthDraft: {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    gender: string;
    birthLocationCode: string;
    birthLocationLabel: string;
    birthLatitude: string;
    birthLongitude: string;
    unknownTime: boolean;
    jasiMethod: 'split' | 'unified';
    solarTimeMode: 'standard' | 'longitude';
  };
} {
  const timeRule = payload.timeRule;
  const unknownBirthTime = payload.unknownBirthTime;
  const hasLocation = Boolean(payload.birthLocationCode);
  const useLongitude = timeRule === 'trueSolarTime' && hasLocation;
  const usesSplit = timeRule === 'earlyZi';

  return {
    concernId: payload.concernId,
    calendarType: payload.calendarType,
    timeRule,
    birthDraft: {
      year: payload.year,
      month: payload.month,
      day: payload.day,
      hour: payload.hour,
      minute: payload.minute,
      gender: payload.gender,
      birthLocationCode: payload.birthLocationCode,
      birthLocationLabel: payload.birthLocationLabel,
      birthLatitude: payload.birthLatitude,
      birthLongitude: payload.birthLongitude,
      unknownTime: unknownBirthTime,
      jasiMethod: usesSplit ? 'split' : 'unified',
      solarTimeMode: useLongitude ? 'longitude' : 'standard',
    },
  };
}
