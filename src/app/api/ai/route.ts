import { NextRequest, NextResponse } from 'next/server';
import {
  buildReportCounselorInstructions,
  resolveMoonlightCounselor,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import {
  buildDialogueExpertInstructions,
  ensureDialogueExpertVisibleOpening,
  getDialogueExpertMeta,
  inferDialogueExpertIdFromMessage,
  resolveDialogueExpertId,
  type DialogueExpertId,
} from '@/lib/dialogue-experts';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildYearlyReport } from '@/domain/saju/report';
import {
  FOCUS_TOPIC_META,
  buildSajuReport,
  normalizeFocusTopic,
} from '@/domain/saju/report/build-report';
import { getReportTopicRulesForTopic } from '@/domain/saju/report/topic-rule-table';
import type { FocusTopic, SajuReport } from '@/domain/saju/report/types';
import {
  createAiChatBillingSummary,
  getAvailableCreditsTotal,
  getAiChatSuccessfulTurns,
  getAiChatTurnPlan,
  hasTodayResultFollowupFreeTurn,
  recordAiChatIncludedTurn,
  recordTodayResultFollowupFreeTurn,
  shouldChargeAiChat,
} from '@/lib/credits/ai-chat-access';
import { deductCreditsAmount, getCredits } from '@/lib/credits/deduct';
import {
  getUserProfileById,
  hasCoreBirthProfile,
  toBirthInputFromProfile,
  type UserProfile,
} from '@/lib/profile';
import { getRecentFortuneFeedbackSummary } from '@/lib/fortune-feedback';
import { toSlug } from '@/lib/saju/pillars';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import { resolveReading, type ReadingRecord } from '@/lib/saju/readings';
import { createClient } from '@/lib/supabase/server';
import { SAJU_PERSONALITY_MINI_PRODUCT_CODE } from '@/lib/payments/saju-personality';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import {
  generateAiText,
  getOpenAIInterpretationModel,
  isOpenAIConfigured,
} from '@/server/ai/openai-text';
import {
  buildDialogueFallback,
  createDialoguePrompt,
  createSafetyResponse,
  inferDialogueFocusTopic,
  inferYearlyTargetYear,
  isYearlyDialogueIntent,
  normalizeDialogueAnswer,
  parseAiRequest,
  type DialogueAiRequest,
  type DialogueProfileGrounding,
  type DialogueSajuPersonalityPromptContext,
  type SajuReportAiRequest,
} from './route-helpers';

export const runtime = 'nodejs';
export const maxDuration = 20;

interface DialogueProfileContext {
  used: boolean;
  summary: string | null;
}

interface DialogueCallToAction {
  label: string;
  href: string;
}

interface DialogueYearlyBridge {
  targetYear: number;
  cta: DialogueCallToAction;
  prompt: {
    instructions: string;
    input: string;
  };
  fallbackText: string;
}

interface SajuPersonalityDialogueContext extends DialogueSajuPersonalityPromptContext {
  reportId: string;
  userId: string;
}

function formatStoredProfileSummary(profile: UserProfile) {
  const birthLabel = `${profile.birthYear}년 ${profile.birthMonth}월 ${profile.birthDay}일 양력`;
  const timeLabel =
    profile.birthHour === null
      ? '태어난 시간 미입력'
      : `${profile.birthHour}시${
          profile.birthMinute === null ? '' : ` ${String(profile.birthMinute).padStart(2, '0')}분`
        }`;
  const genderLabel =
    profile.gender === 'female' ? '여성' : profile.gender === 'male' ? '남성' : '성별 미입력';
  const locationLabel = profile.birthLocationLabel
    ? `${profile.birthLocationLabel}${profile.solarTimeMode === 'longitude' ? ' 경도 보정' : ''}`
    : '출생지 미입력';

  return [birthLabel, genderLabel, timeLabel, locationLabel].join(' · ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

function formatSajuPersonalityScoreSummary(scoreJson: Record<string, unknown>) {
  const axisLabels: Array<[string, string]> = [
    ['innerEnergyScore', '내면 에너지'],
    ['expressionScore', '표현'],
    ['decisionScore', '결정'],
    ['executionRhythmScore', '실행 리듬'],
    ['relationshipSensitivityScore', '관계 감도'],
    ['growthDirectionScore', '성장 방향'],
  ];
  const axisLines = axisLabels
    .map(([key, label]) => {
      const score = readNumber(scoreJson[key]);
      return score === null ? null : `${label} ${score}점`;
    })
    .filter(Boolean);
  const totalScore = readNumber(scoreJson.totalClarityScore);

  return [
    totalScore === null ? null : `전체 선명도 ${totalScore}점`,
    ...axisLines.slice(0, 6),
  ]
    .filter(Boolean)
    .join(', ');
}

function readPatternSummary(fusionFacts: Record<string, unknown>, key: string) {
  const value = fusionFacts[key];
  return isRecord(value) && typeof value.summary === 'string' ? value.summary : null;
}

function formatSajuPersonalityFusionSummary(fusionFacts: Record<string, unknown>) {
  const summaries = [
    readPatternSummary(fusionFacts, 'energyPattern'),
    readPatternSummary(fusionFacts, 'decisionPattern'),
    readPatternSummary(fusionFacts, 'relationshipPattern'),
    readPatternSummary(fusionFacts, 'growthPattern'),
    typeof fusionFacts.recommendedFocus === 'string'
      ? `추천 초점: ${fusionFacts.recommendedFocus}`
      : null,
  ].filter(Boolean);

  return summaries.join(' / ');
}

async function loadSajuPersonalityDialogueContext(
  userId: string,
  reportId: string | null | undefined
): Promise<SajuPersonalityDialogueContext | null> {
  const normalizedReportId = reportId?.trim();
  if (!normalizedReportId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('saju_personality_reports')
    .select('id, user_id, scope_key, life_area, score_json, fusion_facts_json, product_code')
    .eq('id', normalizedReportId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    id: string;
    user_id: string;
    scope_key: string | null;
    life_area: string;
    score_json: Record<string, unknown> | null;
    fusion_facts_json: Record<string, unknown> | null;
    product_code: string;
  };
  const entitlement = await getTasteProductEntitlement(
    userId,
    SAJU_PERSONALITY_MINI_PRODUCT_CODE,
    row.scope_key
  ).catch(() => null);

  return {
    reportId: row.id,
    userId: row.user_id,
    lifeArea: row.life_area,
    scoreSummary: formatSajuPersonalityScoreSummary(row.score_json ?? {}),
    fusionSummary: formatSajuPersonalityFusionSummary(row.fusion_facts_json ?? {}),
    unlocked: Boolean(entitlement || row.product_code === SAJU_PERSONALITY_MINI_PRODUCT_CODE),
  };
}

function createDialogueProfileGrounding(
  profile: UserProfile,
  message: string
): DialogueProfileGrounding | null {
  if (!hasCoreBirthProfile(profile)) return null;

  const input = toBirthInputFromProfile(profile);
  const sajuData = normalizeToSajuDataV1(input, null, {
    location: input.birthLocation?.label ?? null,
  });
  const todayReport = buildSajuReport(input, sajuData, 'today');
  const focusTopic = inferDialogueFocusTopic(message);
  const focusReport = focusTopic === 'today' ? todayReport : buildSajuReport(input, sajuData, focusTopic);

  return {
    profileSummary: formatStoredProfileSummary(profile),
    focusTopic,
    focusLabel: FOCUS_TOPIC_META[focusTopic].label,
    missing: {
      birthTime: profile.birthHour === null,
      birthLocation: !Boolean(profile.birthLocationLabel),
      gender: profile.gender === null,
    },
    saju: {
      pillars: {
        year: sajuData.pillars.year.ganzi,
        month: sajuData.pillars.month.ganzi,
        day: sajuData.pillars.day.ganzi,
        hour: sajuData.pillars.hour?.ganzi ?? null,
      },
      dayMaster: `${sajuData.dayMaster.stem} ${sajuData.dayMaster.element}`,
      dayMasterMeaning: sajuData.dayMaster.description ?? sajuData.dayMaster.metaphor ?? '',
      strength: sajuData.strength
        ? `${sajuData.strength.level} · ${sajuData.strength.score}점`
        : '강약 계산 준비 중',
      pattern: sajuData.pattern?.name ?? '격국 계산 준비 중',
      yongsin:
        sajuData.yongsin?.candidates
          ?.slice(0, 3)
          .map((candidate) => candidate.primary.label)
          .join(' · ') ||
        sajuData.yongsin?.plainSummary ||
        '보완 후보 정리 중',
      currentLuck: sajuData.currentLuck?.currentMajorLuck?.ganzi ?? null,
    },
    reports: {
      today: {
        headline: todayReport.headline,
        summary: todayReport.summary,
        action: `${todayReport.primaryAction.title} - ${todayReport.primaryAction.description}`,
        caution: `${todayReport.cautionAction.title} - ${todayReport.cautionAction.description}`,
      },
      focus: {
        headline: focusReport.headline,
        summary: focusReport.summary,
        action: `${focusReport.primaryAction.title} - ${focusReport.primaryAction.description}`,
        caution: `${focusReport.cautionAction.title} - ${focusReport.cautionAction.description}`,
        evidence: focusReport.evidenceCards.slice(0, 4).map((card) => ({
          label: card.label,
          title: card.title,
        })),
      },
    },
  };
}

function createDialogueProfileContext(
  profile: UserProfile,
  grounding: DialogueProfileGrounding | null
): DialogueProfileContext {
  if (grounding) {
    return {
      used: true,
      summary: grounding.profileSummary,
    };
  }

  if (hasCoreBirthProfile(profile)) {
    return {
      used: false,
      summary: '저장된 생년월일은 있지만 대화에 필요한 사주 정보를 다시 확인하는 중입니다.',
    };
  }

  return {
    used: false,
    summary: 'MY 프로필에 생년월일, 성별, 태어난 시간, 출생지를 저장하면 대화가 내 사주 정보로 바로 이어집니다.',
  };
}

function createYearlyDialogueFallback(
  message: string,
  profileSummary: string,
  targetYear: number,
  expertId: DialogueExpertId,
  summary: {
    overview: string;
    firstHalf: string;
    secondHalf: string;
    goodPeriod: string;
    cautionPeriod: string;
  }
) {
  const expert = getDialogueExpertMeta(expertId);
  const intro = `${expert.teacherName} 관점에서 ${targetYear}년 흐름을 먼저 잡아보면, ${summary.overview}`;

  return [
    intro,
    `${summary.firstHalf} ${summary.secondHalf}`,
    `좋게 쓰기 좋은 시기는 ${summary.goodPeriod} 쪽이고, 속도를 낮춰야 할 구간은 ${summary.cautionPeriod} 쪽입니다.`,
    `지금 질문하신 “${message}”은 저장된 프로필 정보 ${simplifySajuCopy(profileSummary)}를 바탕으로 읽었고, 자세한 12개월 흐름과 분야별 해설은 올해 전략서에서 이어서 확인하시면 됩니다.`,
  ].join('\n\n');
}

function createYearlyDialoguePrompt(input: {
  message: string;
  targetYear: number;
  expertId: DialogueExpertId;
  profileSummary: string;
  yearlyEvidence: ReturnType<typeof buildYearlyReport>;
  recentFeedbackSummary?: string | null;
}) {
  const report = input.yearlyEvidence;

  return {
    instructions: [
      '당신은 달빛인생의 숙련 사주명리 상담가입니다.',
      '이번 답변은 채팅용 짧은 브리지 답변입니다. 올해 전략서 전체를 길게 쓰지 말고 3~5문단으로만 답합니다.',
      '첫 문장에서 해당 연도의 전체 결론을 먼저 말합니다.',
      '이어서 상반기와 하반기의 차이, 잘 쓰기 좋은 시기와 조심할 시기를 짧고 또렷하게 짚습니다.',
      '마크다운 기호, 번호 목록, 별표는 쓰지 않습니다.',
      '결론은 실제 역술가처럼 단정한 존댓말로 말하되, 과장하거나 운명을 단정하지 않습니다.',
      '질문에 대한 답은 요약까지만 하고, 더 자세한 12개월 흐름과 분야별 해설은 올해 전략서에서 본다는 느낌으로 마무리합니다.',
      ...buildDialogueExpertInstructions(input.expertId),
    ].join('\n'),
    input: JSON.stringify(
      {
        question: input.message,
        targetYear: input.targetYear,
        profileSummary: input.profileSummary,
        yearlyEvidence: {
          overview: report.overview,
          coreKeywords: report.coreKeywords.slice(0, 4),
          firstHalf: report.firstHalf,
          secondHalf: report.secondHalf,
          categories: {
            work: report.categories.work,
            wealth: report.categories.wealth,
            love: report.categories.love,
            relationship: report.categories.relationship,
          },
          goodPeriods: report.goodPeriods,
          cautionPeriods: report.cautionPeriods,
          oneLineSummary: report.oneLineSummary,
        },
        recentFeedbackSummary: input.recentFeedbackSummary ?? null,
      },
      null,
      2
    ),
  };
}

function createYearlyDialogueBridge(
  profile: UserProfile,
  message: string,
  expertId: DialogueExpertId,
  recentFeedbackSummary?: string | null
): DialogueYearlyBridge | null {
  if (!hasCoreBirthProfile(profile) || !isYearlyDialogueIntent(message)) {
    return null;
  }

  const targetYear = inferYearlyTargetYear(message);
  if (!targetYear) return null;

  const input = toBirthInputFromProfile(profile);
  const sajuData = normalizeToSajuDataV1(input, null, {
    location: input.birthLocation?.label ?? null,
  });
  const yearlyReport = buildYearlyReport(input, sajuData, targetYear);
  const profileSummary = formatStoredProfileSummary(profile);
  const goodPeriod =
    yearlyReport.goodPeriods[0]
      ? `${yearlyReport.goodPeriods[0].months.join(', ')}월`
      : '상반기 초반';
  const cautionPeriod =
    yearlyReport.cautionPeriods[0]
      ? `${yearlyReport.cautionPeriods[0].months.join(', ')}월`
      : '하반기 후반';

  return {
    targetYear,
    cta: {
      label: `${targetYear} 올해 전략서 보기`,
      href: `/saju/${toSlug(input)}/premium#yearly-report`,
    },
    prompt: createYearlyDialoguePrompt({
      message,
      targetYear,
      expertId,
      profileSummary,
      yearlyEvidence: yearlyReport,
      recentFeedbackSummary,
    }),
    fallbackText: createYearlyDialogueFallback(message, profileSummary, targetYear, expertId, {
      overview: yearlyReport.overview.summary,
      firstHalf: yearlyReport.firstHalf.summary,
      secondHalf: yearlyReport.secondHalf.summary,
      goodPeriod,
      cautionPeriod,
    }),
  };
}

function formatEvidenceCards(report: SajuReport) {
  return report.evidenceCards.map((card) => ({
    label: card.label,
    title: card.title,
    body: card.body,
    details: card.details,
    computed: card.computed,
    source: card.source,
    confidence: card.confidence,
    topicMapping: card.topicMapping,
  }));
}

function buildReportFallback(report: SajuReport) {
  const highlights = report.summaryHighlights.length
    ? report.summaryHighlights.map((item) => `- ${item}`).join('\n')
    : report.summary;
  const evidence = report.evidenceCards
    .slice(0, 6)
    .map((card) => `- ${card.label}: ${card.title}`)
    .join('\n');

  return [
    `${report.headline}`,
    highlights,
    `오늘의 행동 제안: ${report.primaryAction.title} - ${report.primaryAction.description}`,
    `주의 포인트: ${report.cautionAction.title} - ${report.cautionAction.description}`,
    evidence ? `핵심 단서:\n${evidence}` : '',
    'AI 해석이 연결되면 위 단서를 바탕으로 더 자연스러운 개인화 문장으로 확장됩니다.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function createReportGrounding(record: ReadingRecord, report: SajuReport) {
  const data = record.sajuData;

  return {
    birth: {
      year: record.input.year,
      month: record.input.month,
      day: record.input.day,
      hour: record.input.hour ?? null,
      minute: record.input.minute ?? null,
      gender: record.input.gender ?? null,
      location: record.input.birthLocation ?? null,
      solarTimeMode: record.input.solarTimeMode ?? 'standard',
      birthTimeCorrection: data.input.birthTimeCorrection ?? null,
    },
    focus: {
      topic: report.focusTopic,
      label: report.focusLabel,
      badge: report.focusBadge,
      subtitle: FOCUS_TOPIC_META[report.focusTopic].subtitle,
    },
    pillars: {
      year: data.pillars.year.ganzi,
      month: data.pillars.month.ganzi,
      day: data.pillars.day.ganzi,
      hour: data.pillars.hour?.ganzi ?? null,
    },
    dayMaster: data.dayMaster,
    fiveElements: data.fiveElements,
    tenGods: data.tenGods,
    strength: data.strength,
    pattern: data.pattern,
    yongsin: data.yongsin,
    currentLuck: data.currentLuck,
    orrery: {
      relations: data.extensions?.orrery?.relations ?? [],
      gongmang: data.extensions?.orrery?.gongmang ?? null,
      specialSals: data.extensions?.orrery?.specialSals ?? null,
    },
    report: {
      headline: report.headline,
      summaryHighlights: report.summaryHighlights,
      evidenceCards: formatEvidenceCards(report),
      topicRuleTable: getReportTopicRulesForTopic(report.focusTopic),
      scores: report.scores,
      primaryAction: report.primaryAction,
      cautionAction: report.cautionAction,
      insights: report.insights,
      timeline: report.timeline,
    },
  };
}

function createReportPrompt(
  record: ReadingRecord,
  report: SajuReport,
  question?: string,
  counselorId: MoonlightCounselorId = 'female'
) {
  return {
    instructions: [
      '당신은 한국어 운세 서비스 달빛인생의 쉬운 사주풀이 에디터입니다.',
      '반드시 제공된 사주 데이터 안에서만 해석하고, 없는 사건이나 고전 인용을 지어내지 않습니다.',
      '고전 원문은 별도 참고자료가 제공됐을 때만 인용합니다. 현재 참고자료가 없으면 고전 출처를 지어내지 않습니다.',
      '문장은 차분하고 고급스럽게 쓰되, 첫 문장에서 결론을 먼저 전하고 사용자가 바로 읽기 쉽도록 4~6개의 짧은 단락으로 나눕니다.',
      '격국, 용신, 대운, 세운, 월운, 원국, 명식 같은 내부 용어는 본문에 직접 쓰지 않습니다. 필요하면 쉬운 생활 언어로만 바꿉니다.',
      '점수나 계산값을 복붙하듯 나열하지 말고, 현재 흐름의 핵심과 생활 적용으로 자연스럽게 풀어 설명합니다.',
      '사용자가 궁금한 결론, 조심할 패턴, 오늘 할 행동을 먼저 말합니다.',
      '의료·법률·투자 결론은 피하고, 필요한 경우 전문가 확인을 권합니다.',
      ...buildReportCounselorInstructions(counselorId),
    ].join('\n'),
    input: [
      question ? `사용자 추가 질문:\n${question}` : null,
      `사주풀이 참고 데이터:\n${JSON.stringify(createReportGrounding(record, report), null, 2)}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

async function handleDialogue(request: DialogueAiRequest) {
  const safetyResponse = createSafetyResponse(request.message);
  if (safetyResponse) return safetyResponse;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: '로그인이 필요합니다.',
        configured: isOpenAIConfigured(),
        billing: createAiChatBillingSummary('auth_required', null),
      },
      { status: 401 }
    );
  }

  const configured = isOpenAIConfigured();
  const currentCredits = await getCredits(user.id);
  const availableCredits = getAvailableCreditsTotal(currentCredits);
  const successfulTurns = await getAiChatSuccessfulTurns(user.id);
  const turnPlan = getAiChatTurnPlan(successfulTurns);
  const resultFollowupFreeAvailable =
    request.from === 'today-fortune' && request.sourceSessionId
      ? !(await hasTodayResultFollowupFreeTurn(user.id, request.sourceSessionId))
      : false;
  const profile = await getUserProfileById(user.id);
  const profileGrounding = createDialogueProfileGrounding(profile, request.message);
  const profileContext = createDialogueProfileContext(profile, profileGrounding);
  const recentFeedbackSummary = await getRecentFortuneFeedbackSummary(user.id);
  const sajuPersonalityContext = await loadSajuPersonalityDialogueContext(
    user.id,
    request.sajuPersonalityReportId
  );
  const expertId = resolveDialogueExpertId(
    request.expertId,
    inferDialogueExpertIdFromMessage(request.message)
  );
  const expert = getDialogueExpertMeta(expertId);
  const yearlyBridge = createYearlyDialogueBridge(
    profile,
    request.message,
    expertId,
    recentFeedbackSummary
  );

  if (
    configured &&
    !resultFollowupFreeAvailable &&
    turnPlan.cost > 0 &&
    availableCredits < turnPlan.cost
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: '코인이 부족합니다.',
        configured,
        billing: createAiChatBillingSummary('insufficient_credits', availableCredits, turnPlan),
      },
      { status: 402 }
    );
  }

  const prompt = yearlyBridge
    ? yearlyBridge.prompt
    : createDialoguePrompt(
        request.message,
        profileGrounding,
        expertId,
        recentFeedbackSummary,
        sajuPersonalityContext
      );
  const fallbackText = yearlyBridge
    ? yearlyBridge.fallbackText
    : buildDialogueFallback(request.message, profileGrounding, expertId);
  const result = await generateAiText({
    ...prompt,
    fallbackText,
    maxOutputTokens: yearlyBridge ? 420 : 600,
    timeoutMs: yearlyBridge ? 12_000 : undefined,
  });

  if (!shouldChargeAiChat(result.source)) {
    const statusCode = result.fallbackReason === 'ai_not_configured' ? 503 : 502;
    const error =
      result.fallbackReason === 'ai_not_configured'
        ? 'OpenAI 연결 설정이 완료되지 않았습니다.'
        : result.fallbackReason === 'quota_exceeded'
          ? 'OpenAI 계정의 사용량 또는 결제 한도가 초과되어 답변을 만들지 못했습니다.'
        : 'OpenAI 답변 연결에 실패했습니다. 잠시 후 다시 질문해 주세요.';

    console.error('[ai/dialogue] OpenAI generation did not complete', {
      fallbackReason: result.fallbackReason,
      errorMessage: result.errorMessage,
      configured,
      expertId,
    });

    return NextResponse.json(
      {
        ok: false,
        mode: request.mode,
        configured,
        source: result.source,
        model: result.model,
        fallbackReason: result.fallbackReason,
        error,
        errorMessage: process.env.NODE_ENV === 'production' ? null : result.errorMessage,
        expertId,
        expertLabel: expert.label,
        billing: createAiChatBillingSummary('not_charged_fallback', availableCredits, turnPlan),
        profileContext,
      },
      { status: statusCode }
    );
  }

  const dialogueText = ensureDialogueExpertVisibleOpening(
    normalizeDialogueAnswer(result.text),
    expertId
  );
  const dialogueResult = {
    ...result,
    text: dialogueText || ensureDialogueExpertVisibleOpening(fallbackText, expertId),
    cta: yearlyBridge?.cta ?? null,
  };

  if (resultFollowupFreeAvailable && request.sourceSessionId) {
    await recordTodayResultFollowupFreeTurn(
      user.id,
      request.sourceSessionId,
      request.concernId
    );

    return NextResponse.json({
      ok: true,
      mode: request.mode,
      configured,
      expertId,
      expertLabel: expert.label,
      billing: createAiChatBillingSummary('result_intro_free', availableCredits, turnPlan),
      profileContext,
      sajuPersonalityContext: sajuPersonalityContext
        ? {
            used: true,
            reportId: sajuPersonalityContext.reportId,
            lifeArea: sajuPersonalityContext.lifeArea,
            unlocked: sajuPersonalityContext.unlocked,
          }
        : null,
      ...dialogueResult,
    });
  }

  if (turnPlan.status === 'charged_bundle') {
    const deducted = await deductCreditsAmount(user.id, 'ai_chat', turnPlan.cost);

    if (!deducted.success) {
      return NextResponse.json(
        {
          ok: false,
          error: '코인이 부족합니다.',
          configured,
          expertId,
          expertLabel: expert.label,
          billing: createAiChatBillingSummary('insufficient_credits', deducted.remaining, turnPlan),
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: request.mode,
      configured,
      expertId,
      expertLabel: expert.label,
      billing: createAiChatBillingSummary('charged_bundle', deducted.remaining, turnPlan),
      profileContext,
      sajuPersonalityContext: sajuPersonalityContext
        ? {
            used: true,
            reportId: sajuPersonalityContext.reportId,
            lifeArea: sajuPersonalityContext.lifeArea,
            unlocked: sajuPersonalityContext.unlocked,
          }
        : null,
      ...dialogueResult,
    });
  }

  await recordAiChatIncludedTurn(user.id, turnPlan);

  return NextResponse.json({
    ok: true,
    mode: request.mode,
    configured,
    expertId,
    expertLabel: expert.label,
    billing: createAiChatBillingSummary(turnPlan.status, availableCredits, turnPlan),
    profileContext,
    sajuPersonalityContext: sajuPersonalityContext
      ? {
          used: true,
          reportId: sajuPersonalityContext.reportId,
          lifeArea: sajuPersonalityContext.lifeArea,
          unlocked: sajuPersonalityContext.unlocked,
        }
      : null,
    ...dialogueResult,
  });
}

async function handleSajuReport(request: SajuReportAiRequest) {
  const safetyResponse = request.question
    ? createSafetyResponse(request.question, false)
    : null;
  if (safetyResponse) return safetyResponse;

  const reading = await resolveReading(request.readingId);

  if (!reading) {
    return NextResponse.json(
      { ok: false, error: '사주 결과를 찾지 못했습니다.' },
      { status: 404 }
    );
  }

  const topic = normalizeFocusTopic(request.topic);
  const report = buildSajuReport(reading.input, reading.sajuData, topic);
  const storedCounselor =
    reading.userId ? (await getUserProfileById(reading.userId)).preferredCounselor : null;
  const counselorId = resolveMoonlightCounselor(
    request.counselorId,
    storedCounselor
  );
  const prompt = createReportPrompt(reading, report, request.question, counselorId);
  const model = getOpenAIInterpretationModel();
  const result = await generateAiText({
    ...prompt,
    fallbackText: buildReportFallback(report),
    model,
    maxOutputTokens: 900,
  });

  return NextResponse.json({
    ok: true,
    mode: request.mode,
    readingId: request.readingId,
    topic,
    counselorId,
    report: {
      headline: report.headline,
      summaryHighlights: report.summaryHighlights,
      evidenceCards: report.evidenceCards,
      primaryAction: report.primaryAction,
      cautionAction: report.cautionAction,
    },
    ...result,
  });
}

export async function POST(req: NextRequest) {
  const parsed = parseAiRequest(await req.json().catch(() => null));

  if (!parsed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          '요청 형식이 올바르지 않습니다. mode는 dialogue 또는 saju-report여야 합니다.',
      },
      { status: 400 }
    );
  }

  if (parsed.mode === 'dialogue') {
    return handleDialogue(parsed);
  }

  return handleSajuReport(parsed);
}
