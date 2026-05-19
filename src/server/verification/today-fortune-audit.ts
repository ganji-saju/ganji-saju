import { loadSajuDataV2 } from '@/domain/saju/engine';
import { parseBirthInputDraft } from '@/domain/saju/validators/birth-input';
import { MOONLIGHT_ANALYTICS_EVENTS } from '@/lib/analytics-events';
import { normalizeMoonlightCounselor, type MoonlightCounselorId } from '@/lib/counselors';
import { isReadingId, resolveReading } from '@/lib/saju/readings';
import {
  getTodayConcernEntries,
  normalizeConcernId,
  TODAY_CONCERNS,
} from '@/lib/today-fortune/concerns';
import type { ConcernId } from '@/lib/today-fortune/types';
import {
  buildBirthInputFromTodayPayload,
  buildTodayFortuneFreeResult,
  buildTodayFortunePremiumResult,
} from '@/server/today-fortune/build-today-fortune';

const DEFAULT_TODAY_FORTUNE_AUDIT_SLUG = '1982-1-29-8-male';
const DEFAULT_TODAY_FORTUNE_AUDIT_CONCERN: ConcernId = 'general';

const TODAY_FORTUNE_REQUIRED_ANALYTICS_EVENTS = [
  'home_view',
  'today_concern_selected',
  'birth_form_started',
  'birth_form_completed',
  'today_free_result_viewed',
  'premium_teaser_viewed',
  'unlock_clicked',
  'payment_started',
  'payment_completed',
  'premium_result_viewed',
  'followup_question_clicked',
  'dialogue_started_from_result',
  'feedback_submitted',
  'hit_memo_response_correct',
  'hit_memo_response_partial',
  'hit_memo_response_miss',
] as const;

export type TodayFortuneAuditStatus = 'ready' | 'not-found' | 'error';

export interface TodayFortuneVerificationCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

function hasForbiddenGuarantee(text: string) {
  return /(무조건|반드시|절대|100%)/.test(text);
}

function hasUnsafeMedicalDirective(text: string) {
  const normalized = text
    .replace(/질병\s*진단이\s*아니라/g, '')
    .replace(/의학적\s*진단이\s*아니라/g, '')
    .replace(/병명을\s*판단하는\s*것이\s*아니라/g, '');

  return /(병명을\s*(?:알려|말해|단정)|의학적\s*진단|처방전|응급실에\s*가야|치료를\s*받아야|진단명이\s|질병이다)/.test(
    normalized
  );
}

function hasDirectInvestmentDirective(text: string) {
  return /(추천 종목|지금\s*매수|지금\s*매도|수익이\s*보장|몰빵|풀매수)/.test(text);
}

function hasAbsoluteRelationshipDirective(text: string) {
  return /(헤어져야|이혼해야|관계를\s*끝내야|절연해야|반드시.*헤어)/.test(text);
}

function buildUnknownBirthTimeSample() {
  const payload = {
    concernId: 'general' as const,
    calendarType: 'solar' as const,
    timeRule: 'standard' as const,
    year: '1982',
    month: '1',
    day: '29',
    hour: '',
    minute: '',
    unknownBirthTime: true,
    gender: 'male',
    birthLocationCode: 'seoul',
    birthLocationLabel: '서울',
    birthLatitude: '37.5665',
    birthLongitude: '126.978',
  };
  const buildPayload = buildBirthInputFromTodayPayload(payload);
  const parsed = parseBirthInputDraft(buildPayload.birthDraft, { requireGender: false });

  if (!parsed.ok) {
    return null;
  }

  return {
    input: parsed.input,
    sajuData: loadSajuDataV2(parsed.input, null),
  };
}

export async function getTodayFortuneVerificationAudit({
  slug = DEFAULT_TODAY_FORTUNE_AUDIT_SLUG,
  concernId = DEFAULT_TODAY_FORTUNE_AUDIT_CONCERN,
  counselorId = 'female',
}: {
  slug?: string;
  concernId?: ConcernId;
  counselorId?: MoonlightCounselorId;
} = {}) {
  const generatedAt = new Date().toISOString();
  const normalizedConcernId = normalizeConcernId(concernId);
  const normalizedCounselorId = normalizeMoonlightCounselor(counselorId);

  try {
    const reading = await resolveReading(slug);

    if (!reading) {
      return {
        generatedAt,
        status: 'not-found' as const,
        slug,
        concernId: normalizedConcernId,
        counselorId: normalizedCounselorId,
        errors: ['오늘운세 검증용 사주 결과를 찾지 못했습니다. slug 또는 reading id를 확인하세요.'],
      };
    }

    const concernResults = TODAY_CONCERNS.map((concern) => {
      const free = buildTodayFortuneFreeResult(reading.input, reading.sajuData, {
        concernId: concern.id,
        sourceSessionId: reading.id,
        calendarType: 'solar',
        timeRule: 'standard',
        counselorId: normalizedCounselorId,
        grounding: reading.grounding,
        kasiComparison: reading.kasiComparison,
      });
      const premium = buildTodayFortunePremiumResult(
        reading.input,
        reading.sajuData,
        concern.id,
        reading.grounding,
        reading.kasiComparison
      );
      return { concern, free, premium };
    });

    const selected =
      concernResults.find((item) => item.concern.id === normalizedConcernId) ?? concernResults[0];
    const unknownTimeSample = buildUnknownBirthTimeSample();
    const unknownTimeResult = unknownTimeSample
      ? buildTodayFortuneFreeResult(unknownTimeSample.input, unknownTimeSample.sajuData, {
          concernId: 'general',
          sourceSessionId: 'unknown-time-sample',
          calendarType: 'solar',
          timeRule: 'standard',
          counselorId: normalizedCounselorId,
        })
      : null;

    const combinedText = concernResults
      .flatMap((item) => [
        item.free.oneLine.headline,
        item.free.oneLine.body,
        item.free.opportunity.body,
        item.free.risk.body,
        item.free.reasonSnippet.body,
        item.free.nextAction.copy,
        item.premium.favorableWindows.map((window) => `${window.title} ${window.body}`).join(' '),
        item.premium.cautionWindows.map((window) => `${window.title} ${window.body}`).join(' '),
        item.premium.avoidActions.join(' '),
        item.premium.recommendedActions.join(' '),
        item.premium.scenarios.map((scenario) => `${scenario.title} ${scenario.better} ${scenario.watch}`).join(' '),
        item.premium.evidenceLines.join(' '),
        item.premium.safetyNote,
      ])
      .join(' ');

    const healthText = concernResults.find((item) => item.concern.id === 'energy_health');
    const wealthText = concernResults.find((item) => item.concern.id === 'money_spend');
    const relationshipText = concernResults.find((item) => item.concern.id === 'relationship_conflict');
    const missingAnalyticsEvents = TODAY_FORTUNE_REQUIRED_ANALYTICS_EVENTS.filter(
      (eventName) => !MOONLIGHT_ANALYTICS_EVENTS.includes(eventName)
    );
    const primaryConcernCount = getTodayConcernEntries(false).length;
    const checks: TodayFortuneVerificationCheck[] = [
      {
        key: 'today-free-result-shape',
        label: '무료 결과 카드 구조',
        ok:
          selected.free.scores.length === 6 &&
          selected.free.followUpQuestions.length >= 3 &&
          selected.free.groundingSummary.factLines.length >= 3 &&
          selected.free.groundingSummary.evidenceLines.length >= 2 &&
          selected.free.nextAction.product === 'TODAY_DEEP_READING' &&
          selected.free.nextAction.coinCost === 1,
        detail: `scores ${selected.free.scores.length}개 · grounding facts ${selected.free.groundingSummary.factLines.length}개 · follow-up ${selected.free.followUpQuestions.length}개 · CTA ${selected.free.nextAction.coinCost}코인`,
      },
      {
        key: 'today-premium-result-shape',
        label: '심화 결과 구조',
        ok:
          selected.premium.productCode === 'TODAY_DEEP_READING' &&
          selected.premium.coinCost === 1 &&
          selected.premium.groundingSummary.factLines.length >= 3 &&
          selected.premium.groundingSummary.evidenceLines.length >= 2 &&
          selected.premium.favorableWindows.length >= 2 &&
          selected.premium.cautionWindows.length >= 2 &&
          selected.premium.avoidActions.length === 3 &&
          selected.premium.recommendedActions.length === 3 &&
          selected.premium.scenarios.length >= 2 &&
          selected.premium.evidenceLines.length >= 3,
        detail: `유리 ${selected.premium.favorableWindows.length} · 주의 ${selected.premium.cautionWindows.length} · 피하기 ${selected.premium.avoidActions.length} · 추천 ${selected.premium.recommendedActions.length}`,
      },
      {
        key: 'today-grounding-kasi',
        label: 'grounding / KASI 요약 노출',
        ok:
          selected.free.groundingSummary.primaryConcept.length > 0 &&
          selected.free.groundingSummary.kasi.summary.length > 0 &&
          selected.premium.groundingSummary.kasi.summary.length > 0,
        detail: `${selected.free.groundingSummary.primaryConcept} · ${selected.free.groundingSummary.kasi.summary}`,
      },
      {
        key: 'today-concern-coverage',
        label: '고민 선택 커버리지',
        ok: TODAY_CONCERNS.length === 6 && primaryConcernCount === 4,
        detail: `기본 ${primaryConcernCount}개 · 전체 ${TODAY_CONCERNS.length}개`,
      },
      {
        key: 'today-unknown-birth-time-guard',
        label: '태어난 시간 모름 처리',
        ok:
          Boolean(unknownTimeResult) &&
          unknownTimeResult?.birthMeta.unknownBirthTime === true &&
          /시주|시간이 없어|보수적/.test(
            `${unknownTimeResult?.oneLine.body ?? ''} ${unknownTimeResult?.reasonSnippet.body ?? ''}`
          ),
        detail: unknownTimeResult
          ? `${unknownTimeResult.reasonSnippet.body}`
          : 'unknownBirthTime 샘플을 만들지 못했습니다.',
      },
      {
        key: 'today-safety-forbidden-phrases',
        label: '단정 표현 금지',
        ok: !hasForbiddenGuarantee(combinedText),
        detail: hasForbiddenGuarantee(combinedText)
          ? '무조건/반드시/절대/100% 같은 단정 표현이 오늘운세 문장에 남아 있습니다.'
          : '단정 금지 표현은 오늘운세 문장에서 발견되지 않았습니다.',
      },
      {
        key: 'today-safety-health',
        label: '건강운 안전 문구',
        ok:
          Boolean(healthText) &&
          !hasUnsafeMedicalDirective(
            `${healthText?.free.oneLine.body ?? ''} ${healthText?.premium.safetyNote ?? ''}`
          ) &&
          (healthText?.premium.safetyNote.includes('질병 진단이 아니라') ?? false),
        detail: healthText?.premium.safetyNote ?? '컨디션 안전 문구를 찾지 못했습니다.',
      },
      {
        key: 'today-safety-wealth',
        label: '재물운 투자 지시 금지',
        ok:
          Boolean(wealthText) &&
          !hasDirectInvestmentDirective(
            `${wealthText?.free.oneLine.body ?? ''} ${wealthText?.premium.recommendedActions.join(' ') ?? ''}`
          ) &&
          (wealthText?.premium.safetyNote.includes('매수·매도 지시가 아니라') ?? false),
        detail: wealthText?.premium.safetyNote ?? '재물운 안전 문구를 찾지 못했습니다.',
      },
      {
        key: 'today-safety-relationship',
        label: '관계운 결론 단정 금지',
        ok:
          Boolean(relationshipText) &&
          !hasAbsoluteRelationshipDirective(
            `${relationshipText?.free.oneLine.body ?? ''} ${relationshipText?.premium.recommendedActions.join(' ') ?? ''} ${relationshipText?.premium.safetyNote ?? ''}`
          ) &&
          (relationshipText?.premium.safetyNote.includes('큰 결론을 단정하지 않습니다') ?? false),
        detail: relationshipText?.premium.safetyNote ?? '관계운 안전 문구를 찾지 못했습니다.',
      },
      {
        key: 'today-dialogue-bridge',
        label: '결과 기반 대화 브리지',
        ok:
          Boolean(selected.free.sourceSessionId) &&
          selected.free.followUpQuestions.length >= 3,
        detail: `sourceSessionId 전달 준비 완료 · follow-up ${selected.free.followUpQuestions.length}개 · 결과 기반 첫 질문은 일반 무료 턴과 별도로 1회 무료 처리됩니다.`,
      },
      {
        key: 'today-analytics-registry',
        label: 'analytics 이벤트 등록',
        ok: missingAnalyticsEvents.length === 0,
        detail:
          missingAnalyticsEvents.length === 0
            ? `${TODAY_FORTUNE_REQUIRED_ANALYTICS_EVENTS.length}개 이벤트가 registry에 등록되어 있습니다.`
            : `누락 이벤트: ${missingAnalyticsEvents.join(', ')}`,
      },
    ];

    return {
      generatedAt,
      status: 'ready' as const,
      slug,
      readingId: reading.id,
      readingSource: isReadingId(slug) ? 'database-reading-id' : 'deterministic-slug',
      concernId: selected.concern.id,
      concernLabel: selected.concern.label,
      concernHanja: selected.concern.hanja,
      counselorId: normalizedCounselorId,
      concernCoverage: {
        primaryVisibleCount: primaryConcernCount,
        totalCount: TODAY_CONCERNS.length,
        labels: TODAY_CONCERNS.map((concern) => ({
          id: concern.id,
          label: concern.label,
          hanja: concern.hanja,
        })),
      },
      freeResultSummary: {
        headline: selected.free.oneLine.headline,
        bodyPreview: selected.free.oneLine.body.slice(0, 180),
        scoreCount: selected.free.scores.length,
        scoreKeys: selected.free.scores.map((score) => `${score.key}:${score.score}`),
        reasonSnippet: selected.free.reasonSnippet.body,
        nextAction: selected.free.nextAction.copy,
        followUpQuestions: selected.free.followUpQuestions,
      },
      premiumResultSummary: {
        productCode: selected.premium.productCode,
        coinCost: selected.premium.coinCost,
        favorableWindowCount: selected.premium.favorableWindows.length,
        cautionWindowCount: selected.premium.cautionWindows.length,
        avoidActionCount: selected.premium.avoidActions.length,
        recommendedActionCount: selected.premium.recommendedActions.length,
        scenarioCount: selected.premium.scenarios.length,
        evidenceLineCount: selected.premium.evidenceLines.length,
        safetyNote: selected.premium.safetyNote,
      },
      unknownBirthTimePreview: unknownTimeResult
        ? {
            headline: unknownTimeResult.oneLine.headline,
            reasonSnippet: unknownTimeResult.reasonSnippet.body,
          }
        : null,
      analytics: {
        requiredEvents: [...TODAY_FORTUNE_REQUIRED_ANALYTICS_EVENTS],
        registeredEvents: [...MOONLIGHT_ANALYTICS_EVENTS],
        missingEvents: missingAnalyticsEvents,
        dimensions: ['from=today-fortune', 'concern', 'sourceSessionId'],
      },
      checks,
      warnings: checks.filter((check) => !check.ok).map((check) => check.detail),
      errors: [],
    };
  } catch (error) {
    return {
      generatedAt,
      status: 'error' as const,
      slug,
      concernId: normalizedConcernId,
      counselorId: normalizedCounselorId,
      errors: [
        error instanceof Error
          ? error.message
          : '오늘운세 운영 검증 데이터를 만들지 못했습니다.',
      ],
    };
  }
}
