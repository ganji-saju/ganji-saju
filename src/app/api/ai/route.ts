import { NextRequest, NextResponse } from 'next/server';
import {
  buildReportCounselorInstructions,
  normalizeMoonlightCounselor,
  resolveMoonlightCounselor,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import {
  buildDialogueExpertInstructions,
  ensureDialogueExpertVisibleOpening,
  getDialogueExpertMeta,
  getDialogueExpertRagOverlay,
  inferDialogueExpertIdFromMessage,
  normalizeDialogueExpertId,
  resolveDialogueExpertId,
  type DialogueExpertId,
} from '@/lib/dialogue-experts';
import { detectSafeRedirect } from '@/domain/safety/safe-redirect';
import { loadSajuDataV2 } from '@/domain/saju/engine';
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
import { limitSajuSentences, simplifySajuCopy } from '@/lib/saju/public-copy';
import { resolveReading, type ReadingRecord } from '@/lib/saju/readings';
import { createClient } from '@/lib/supabase/server';
import {
  generateAiText,
  getOpenAIInterpretationModel,
  isOpenAIConfigured,
} from '@/server/ai/openai-text';

export const runtime = 'nodejs';
export const maxDuration = 20;

type AiMode = 'dialogue' | 'saju-report';

interface DialogueAiRequest {
  mode: 'dialogue';
  message: string;
  expertId?: DialogueExpertId;
  sourceSessionId?: string;
  concernId?: string;
  from?: string;
}

interface SajuReportAiRequest {
  mode: 'saju-report';
  readingId: string;
  topic?: string;
  question?: string;
  counselorId?: MoonlightCounselorId;
}

type ParsedAiRequest = DialogueAiRequest | SajuReportAiRequest;

interface DialogueProfileContext {
  used: boolean;
  summary: string | null;
}

interface DialogueCallToAction {
  label: string;
  href: string;
}

interface DialogueProfileGrounding {
  profileSummary: string;
  focusTopic: FocusTopic;
  focusLabel: string;
  missing: {
    birthTime: boolean;
    birthLocation: boolean;
    gender: boolean;
  };
  saju: {
    pillars: {
      year: string;
      month: string;
      day: string;
      hour: string | null;
    };
    dayMaster: string;
    dayMasterMeaning: string;
    strength: string;
    pattern: string;
    yongsin: string;
    currentLuck: string | null;
  };
  reports: {
    today: {
      headline: string;
      summary: string;
      action: string;
      caution: string;
    };
    focus: {
      headline: string;
      summary: string;
      action: string;
      caution: string;
      evidence: Array<{
        label: string;
        title: string;
      }>;
    };
  };
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

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

function hasBatchim(value: string) {
  const trimmed = value.trim();
  const lastChar = trimmed.charAt(trimmed.length - 1);
  if (!lastChar) return false;
  const code = lastChar.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}

function withParticle(value: string, consonantParticle: string, vowelParticle: string) {
  return `${value}${hasBatchim(value) ? consonantParticle : vowelParticle}`;
}

function getCurrentKoreaYear() {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).format(new Date());
  const parsed = Number.parseInt(formatted, 10);

  return Number.isInteger(parsed) ? parsed : new Date().getFullYear();
}

function parseAiRequest(payload: unknown): ParsedAiRequest | null {
  if (!payload || typeof payload !== 'object') return null;

  const data = payload as Record<string, unknown>;
  const mode = readString(data, 'mode') as AiMode;

  if (mode === 'dialogue') {
    const message = readString(data, 'message');
    const expertId = normalizeDialogueExpertId(data.expertId);
    return message
      ? {
          mode,
          message,
          expertId: expertId ?? undefined,
          sourceSessionId: readString(data, 'sourceSessionId') || undefined,
          concernId: readString(data, 'concernId') || undefined,
          from: readString(data, 'from') || undefined,
        }
      : null;
  }

  if (mode === 'saju-report') {
    const readingId = readString(data, 'readingId');
    if (!readingId) return null;

    return {
      mode,
      readingId,
      topic: readString(data, 'topic') || undefined,
      question: readString(data, 'question') || undefined,
      counselorId: normalizeMoonlightCounselor(data.counselorId) ?? undefined,
    };
  }

  return null;
}

function createSafetyResponse(message: string, includeAiChatBilling = true) {
  const safety = detectSafeRedirect(message);

  if (!safety.shouldBlockResponse) return null;

  return NextResponse.json({
    ok: false,
    mode: 'safe_redirect',
    source: 'safe_redirect',
    text: safety.userMessage,
    safety,
    redirectPath: safety.redirectPath,
    configured: isOpenAIConfigured(),
    ...(includeAiChatBilling
      ? { billing: createAiChatBillingSummary('not_charged_safe_redirect', null) }
      : {}),
  });
}

function inferDialogueFocusTopic(message: string): FocusTopic {
  if (/(연애|애정|썸|고백|이별|결혼|소개팅|재회)/.test(message)) return 'love';
  if (/(재물|돈|금전|수입|지출|투자|사업|매출|정산)/.test(message)) return 'wealth';
  if (/(직장|회사|업무|이직|승진|취업|커리어|직업|면접)/.test(message)) return 'career';
  if (/(관계|인간관계|가족|부모|형제|자매|친구|동료)/.test(message)) return 'relationship';
  return 'today';
}

function inferYearlyTargetYear(message: string) {
  const explicitYear = message.match(/(20\d{2})\s*년?/);
  if (explicitYear?.[1]) {
    const parsed = Number.parseInt(explicitYear[1], 10);
    if (Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100) {
      return parsed;
    }
  }

  if (/(신년|올해|금년|연간|한 해)/.test(message)) {
    return getCurrentKoreaYear();
  }

  return null;
}

function isYearlyDialogueIntent(message: string) {
  const hasYearSignal = /(신년\s*운세|신년운세|연간\s*운세|올해\s*운세|올해\s*전체|한\s*해|월별\s*흐름|월별\s*운세|리포트|총론|202\d\s*년)/.test(
    message
  );
  const hasBroadAsk =
    /(자세히|깊게|전체|월별|정리|리포트|총평|총론|한번에|제대로)/.test(message) ||
    /(운세|흐름|운을)\s*(봐|읽|알)/.test(message);

  return hasYearSignal && hasBroadAsk;
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

function createDialogueProfileGrounding(
  profile: UserProfile,
  message: string
): DialogueProfileGrounding | null {
  if (!hasCoreBirthProfile(profile)) return null;

  const input = toBirthInputFromProfile(profile);
  const sajuData = loadSajuDataV2(input, null, {
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

function buildDialogueFallback(
  message: string,
  profileGrounding?: DialogueProfileGrounding | null,
  expertId: DialogueExpertId = resolveDialogueExpertId(inferDialogueExpertIdFromMessage(message))
) {
  const expert = getDialogueExpertMeta(expertId);
  const overlay = getDialogueExpertRagOverlay(expertId);

  if (!profileGrounding) {
    return [
      `${expert.teacherName}으로 보면, 이 질문은 ${overlay.primaryLens[0]}부터 짚는 게 좋습니다.`,
      `정확한 생년월일과 태어난 시간이 있으면 더 개인적으로 볼 수 있어요. 지금은 질문 내용만 놓고 짧게 말씀드릴게요.`,
      `오늘은 ${overlay.actionPattern[0]} 이 한 가지만 먼저 해보세요.`,
    ].join('\n\n');
  }

  const headline = limitSajuSentences(profileGrounding.reports.focus.headline, 1);
  const summary = limitSajuSentences(profileGrounding.reports.focus.summary, 2);
  const action = limitSajuSentences(profileGrounding.reports.focus.action, 1);
  const caution = limitSajuSentences(profileGrounding.reports.focus.caution, 1);

  return [
    `${expert.teacherName}으로 보면, ${headline}`,
    summary,
    action ? `지금은 ${action} 이 한 가지를 먼저 잡아보세요.` : null,
    caution ? `조심할 점은 ${caution}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function isDialogueInternalMemo(paragraph: string) {
  return /(?:이 질문은 .*답변|이 질문은 .*흐름|기본 흐름은|핵심 단서는|보조 단서|우선 판단 렌즈|답변 순서|행동 제안 방식|피할 방식|오행\/균형|역할 흐름|보완 힌트|fact_?json|evidence_?json|engine[_ -]?version|rule[_ -]?set|[甲乙丙丁戊己庚辛壬癸]\s*타고난 기질|[木火土金水]\s*\([^)]+\)\s*(?:·|기운))/iu.test(
    paragraph
  );
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
    `지금 질문하신 “${message}”${withParticle(message, '은', '는')} 저장된 프로필 정보 ${withParticle(simplifySajuCopy(profileSummary), '을', '를')} 바탕으로 읽었고, 자세한 12개월 흐름과 분야별 해설은 올해 전략서에서 이어서 확인하시면 됩니다.`,
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
      '당신은 간지사주의 숙련 사주명리 상담가입니다.',
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
  const sajuData = loadSajuDataV2(input, null, {
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

function normalizeDialogueAnswer(text: string) {
  const cleaned = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*•▪︎◦]+\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[ \t]+\n/g, '\n');

  const paragraphs = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => simplifySajuCopy(line.replace(/\s{2,}/g, ' ')))
    .filter((line) => !isDialogueInternalMemo(line))
    .filter(Boolean);

  return paragraphs.join('\n\n');
}

function formatDialogueProfileBrief(profileGrounding: DialogueProfileGrounding) {
  return [
    `기본 초점: ${profileGrounding.focusLabel}`,
    `한 줄 소재: ${limitSajuSentences(profileGrounding.reports.focus.headline, 1)}`,
    `짧은 해석: ${limitSajuSentences(profileGrounding.reports.focus.summary, 2)}`,
    `바로 할 일: ${limitSajuSentences(profileGrounding.reports.focus.action, 1)}`,
    `조심할 점: ${limitSajuSentences(profileGrounding.reports.focus.caution, 1)}`,
    profileGrounding.missing.birthTime
      ? '태어난 시간이 없어 시간대별 세부 흐름은 짧게만 말합니다.'
      : null,
    profileGrounding.missing.birthLocation
      ? '출생지가 없어 지역 보정 이야기는 답변에 꺼내지 않습니다.'
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function createDialoguePrompt(
  message: string,
  profileGrounding?: DialogueProfileGrounding | null,
  expertId: DialogueExpertId = resolveDialogueExpertId(inferDialogueExpertIdFromMessage(message)),
  recentFeedbackSummary?: string | null
) {
  const expert = getDialogueExpertMeta(expertId);
  const expertRagOverlay = getDialogueExpertRagOverlay(expertId);

  return {
    instructions: [
      '당신은 한국어 운세 서비스 간지사주에서 실제 상담을 맡은 숙련 상담가입니다.',
      `사용자가 선택한 12간지 전문 분야는 ${expert.teacherName} · ${expert.label}입니다.`,
      '사용자의 질문에는 상담실에서 마주 앉아 바로 말하듯, 단정하고 또렷한 존댓말로 답합니다.',
      '말투는 로봇처럼 설명하지 말고 실제 역술가가 손님에게 풀어주듯 자연스럽고 사람다운 한국어로 답합니다.',
      '반드시 사용자 질문의 핵심 단어와 상황을 붙잡고 답합니다. 저장된 사주 정보는 배경일 뿐이며, 질문과 상관없는 오늘운세나 일반 성향 설명으로 빠지지 않습니다.',
      '답변 첫 문장에서 판단을 먼저 잘라 말하고, 이어서 이유와 흐름을 붙인 뒤, 마지막에는 당장 어떻게 움직이면 좋을지 정리합니다.',
      '마크다운 기호를 쓰지 않습니다. 별표 두 개, 샵, 글머리표, 번호 목록, 표식 문장을 쓰지 말고 자연스러운 문단으로만 답합니다.',
      '문단은 3~5개 정도로 짧게 나누고, 한 문단 안에서도 문장을 길게 늘이지 않습니다.',
      '대화방 답변은 긴 사주 리포트가 아닙니다. 사용자의 사주에서 핵심 소재는 한두 줄만 쓰고, 나머지는 질문에 맞는 피드백으로 답합니다.',
      '사용자에게 보이는 답변에는 “기본 흐름”, “핵심 단서”, “답변 순서”, “오행/균형”, “보완 힌트”, “저장 프로필 정보”, 한자 기호, 점수, 내부 JSON 이름을 쓰지 않습니다.',
      '전문 근거는 화면에 드러내지 말고 쉬운 생활 언어로 바꿔 말합니다.',
      'AI 비서처럼 메타 설명하거나, 과하게 조심스러운 군더더기 말을 반복하지 않습니다.',
      '결론을 흐리게 돌려 말하지 말고, 보이는 흐름은 분명하게 말합니다. 다만 태어난 시간이나 출생지처럼 빠진 정보 때문에 보류해야 하는 부분은 짧고 또렷하게 선을 그어 설명합니다.',
      '말끝마다 가능성만 늘어놓지 말고, 지금 흐름에서 무엇이 강하고 무엇을 조절해야 하는지 힘있게 짚어줍니다.',
      '격국, 용신, 대운, 세운, 월운, 원국, 명식, factJson, evidenceJson 같은 내부 용어는 본문에 직접 쓰지 않습니다. 필요하면 쉬운 생활 언어로만 바꿉니다.',
      '저장 프로필 정보가 제공되면 그 정보를 기본값으로 사용합니다. 다만 사용자가 다른 사람의 사주를 따로 묻는 문맥이면 저장 프로필을 섞지 말고 필요한 출생 정보를 먼저 확인합니다.',
      'recentFeedbackSummary가 있으면 최근 반응을 참고해 단정 문구 강도만 조절하고, 계산 설명보다 앞세우지 않습니다.',
      '의료, 법률, 투자 판단은 해석으로 대신하지 않습니다.',
      '출생 정보나 사주 데이터가 없는 경우 빈말로 얼버무리지 말고, 어떤 정보가 필요한지 짧게 요청합니다.',
      '고전 원문이나 출처는 제공된 참고자료가 없으면 인용하지 않습니다.',
      '다음과 같은 말은 피합니다: 결론적으로, 분석해보면, 참고로, AI로서, 표로 정리하면, 1번 2번 3번.',
      ...buildDialogueExpertInstructions(expertId),
    ].join('\n'),
    input: [
      [
        '선택된 12지신 전문 오버레이 RAG:',
        `첫 문단 관점: ${expertRagOverlay.visibleOpening}`,
        `질문을 볼 렌즈: ${expertRagOverlay.primaryLens.join(' / ')}`,
        `피드백 방향: ${expertRagOverlay.actionPattern.join(' / ')}`,
        `피해야 할 답변: ${expertRagOverlay.avoid.join(' / ')}`,
      ].join('\n'),
      profileGrounding
        ? `대화용 개인화 소재:\n${formatDialogueProfileBrief(profileGrounding)}`
        : '대화용 개인화 소재 없음. 저장 프로필이 비어 있으면 필요한 출생 정보를 짧게 요청합니다.',
      recentFeedbackSummary
        ? `최근 사용자 피드백 요약:\n${recentFeedbackSummary}`
        : null,
      `사용자 질문:\n${message}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
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
      '당신은 한국어 운세 서비스 간지사주의 쉬운 사주풀이 에디터입니다.',
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
        recentFeedbackSummary
      );
  const fallbackText = yearlyBridge
    ? yearlyBridge.fallbackText
    : buildDialogueFallback(request.message, profileGrounding, expertId);
  const result = await generateAiText({
    ...prompt,
    fallbackText,
    maxOutputTokens: yearlyBridge ? 420 : 600,
    timeoutMs: yearlyBridge ? 12_000 : undefined,
    feature: 'chat',
    userId: user.id,
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
    feature: 'chat',
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
