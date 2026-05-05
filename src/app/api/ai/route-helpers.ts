import { NextResponse } from 'next/server';
import { normalizeMoonlightCounselor, type MoonlightCounselorId } from '@/lib/counselors';
import {
  buildDialogueExpertInstructions,
  getDialogueExpertMeta,
  inferDialogueExpertIdFromMessage,
  normalizeDialogueExpertId,
  resolveDialogueExpertId,
  type DialogueExpertId,
} from '@/lib/dialogue-experts';
import { detectSafeRedirect } from '@/domain/safety/safe-redirect';
import type { FocusTopic } from '@/domain/saju/report/types';
import { createAiChatBillingSummary } from '@/lib/credits/ai-chat-access';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import { isOpenAIConfigured } from '@/server/ai/openai-text';

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

export type ParsedAiRequest = DialogueAiRequest | SajuReportAiRequest;

export interface DialogueProfileGrounding {
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

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getCurrentKoreaYear() {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).format(new Date());
  const parsed = Number.parseInt(formatted, 10);

  return Number.isInteger(parsed) ? parsed : new Date().getFullYear();
}

export function parseAiRequest(payload: unknown): ParsedAiRequest | null {
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

export function createSafetyResponse(message: string, includeAiChatBilling = true) {
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

export function inferDialogueFocusTopic(message: string): FocusTopic {
  if (/(연애|애정|썸|고백|이별|결혼|소개팅|재회)/.test(message)) return 'love';
  if (/(재물|돈|금전|수입|지출|투자|사업|매출|정산)/.test(message)) return 'wealth';
  if (/(직장|회사|업무|이직|승진|취업|커리어|직업|면접)/.test(message)) return 'career';
  if (/(관계|인간관계|가족|부모|형제|자매|친구|동료)/.test(message)) return 'relationship';
  return 'today';
}

export function inferYearlyTargetYear(message: string) {
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

export function isYearlyDialogueIntent(message: string) {
  const hasYearSignal = /(신년\s*운세|신년운세|연간\s*운세|올해\s*운세|올해\s*전체|한\s*해|월별\s*흐름|월별\s*운세|리포트|총론|202\d\s*년)/.test(
    message
  );
  const hasBroadAsk =
    /(자세히|깊게|전체|월별|정리|리포트|총평|총론|한번에|제대로)/.test(message) ||
    /(운세|흐름|운을)\s*(봐|읽|알)/.test(message);

  return hasYearSignal && hasBroadAsk;
}

export function buildDialogueFallback(
  message: string,
  profileGrounding?: DialogueProfileGrounding | null,
  expertId: DialogueExpertId = resolveDialogueExpertId(inferDialogueExpertIdFromMessage(message))
) {
  const expert = getDialogueExpertMeta(expertId);

  if (!profileGrounding) {
    return [
      `지금은 정밀 답변 연결이 잠시 비어 있어, ${expert.animal}띠 ${expert.label} 기준으로 먼저 핵심만 짚겠습니다.`,
      `남겨주신 질문은 “${message}”입니다.`,
      '아직 저장된 사주 정보가 연결되지 않았다면 MY 프로필에 생년월일, 성별, 태어난 시간, 출생지를 먼저 넣어 주세요. 기본 정보가 잡혀야 같은 질문도 훨씬 분명하게 풀립니다.',
      `${expert.label} 기본 답변이며, 이 답변은 횟수와 코인을 차감하지 않습니다.`,
    ].join('\n\n');
  }

  const evidenceSummary = profileGrounding.reports.focus.evidence
    .map((item) => simplifySajuCopy(`${item.label} ${item.title}`))
    .join(' · ');

  return [
    `${expert.animal}띠 ${expert.label} 관점에서 저장된 프로필을 보면, ${simplifySajuCopy(profileGrounding.reports.focus.headline)}`,
    simplifySajuCopy(profileGrounding.reports.focus.summary),
    `기본 흐름은 ${simplifySajuCopy(profileGrounding.saju.dayMaster)}, ${simplifySajuCopy(profileGrounding.saju.strength)}, ${simplifySajuCopy(profileGrounding.saju.pattern)} 쪽으로 읽습니다. 오늘은 ${simplifySajuCopy(profileGrounding.saju.yongsin)} 흐름을 잘 쓰는 편이 좋습니다.`,
    evidenceSummary ? `핵심 단서는 ${evidenceSummary}입니다.` : null,
    `질문하신 “${message}”은 ${simplifySajuCopy(profileGrounding.reports.focus.action)} 쪽으로 정리해서 움직이시는 편이 맞습니다.`,
    `${expert.label} 기본 풀이로 먼저 말씀드렸고, 저장된 사주 정보는 그대로 반영했습니다. 이 답변은 횟수와 코인을 차감하지 않습니다.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function normalizeDialogueAnswer(text: string) {
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
    .filter(Boolean);

  return paragraphs.join('\n\n');
}

export function createDialoguePrompt(
  message: string,
  profileGrounding?: DialogueProfileGrounding | null,
  expertId: DialogueExpertId = resolveDialogueExpertId(inferDialogueExpertIdFromMessage(message)),
  recentFeedbackSummary?: string | null
) {
  const expert = getDialogueExpertMeta(expertId);

  return {
    instructions: [
      '당신은 한국어 운세 서비스 달빛인생에서 실제 상담을 맡은 숙련 상담가입니다.',
      `사용자가 선택한 12간지 전문 분야는 ${expert.animal}띠 ${expert.label}입니다.`,
      '사용자의 질문에는 상담실에서 마주 앉아 바로 말하듯, 단정하고 또렷한 존댓말로 답합니다.',
      '말투는 로봇처럼 설명하지 말고 실제 역술가가 손님에게 풀어주듯 자연스럽고 사람다운 한국어로 답합니다.',
      '답변 첫 문장에서 판단을 먼저 잘라 말하고, 이어서 이유와 흐름을 붙인 뒤, 마지막에는 당장 어떻게 움직이면 좋을지 정리합니다.',
      '마크다운 기호를 쓰지 않습니다. 별표 두 개, 샵, 글머리표, 번호 목록, 표식 문장을 쓰지 말고 자연스러운 문단으로만 답합니다.',
      '문단은 3~5개 정도로 짧게 나누고, 한 문단 안에서도 문장을 길게 늘이지 않습니다.',
      'AI 비서처럼 메타 설명하거나, 과하게 조심스러운 군더더기 표현을 반복하지 않습니다.',
      '결론을 흐리게 돌려 말하지 말고, 보이는 흐름은 분명하게 말합니다. 다만 태어난 시간이나 출생지처럼 빠진 정보 때문에 보류해야 하는 부분은 짧고 또렷하게 선을 그어 설명합니다.',
      '말끝마다 가능성만 늘어놓지 말고, 지금 흐름에서 무엇이 강하고 무엇을 조절해야 하는지 힘있게 짚어줍니다.',
      '격국, 용신, 대운, 세운, 월운, 원국, 명식, factJson, evidenceJson 같은 내부 용어는 본문에 직접 쓰지 않습니다. 필요하면 쉬운 생활 언어로만 바꿉니다.',
      '저장 프로필 정보가 제공되면 그 정보를 기본값으로 사용합니다. 다만 사용자가 다른 사람의 사주를 따로 묻는 문맥이면 저장 프로필을 섞지 말고 필요한 출생 정보를 먼저 확인합니다.',
      'recentFeedbackSummary가 있으면 최근 반응을 참고해 단정 표현 강도만 조절하고, 계산 설명보다 앞세우지 않습니다.',
      '의료, 법률, 투자 판단은 해석으로 대신하지 않습니다.',
      '출생 정보나 사주 데이터가 없는 경우 빈말로 얼버무리지 말고, 어떤 정보가 필요한지 짧게 요청합니다.',
      ...buildDialogueExpertInstructions(expertId),
      '',
      profileGrounding
        ? [
            '[저장 프로필 정보]',
            simplifySajuCopy(profileGrounding.profileSummary),
            `기본 초점: ${profileGrounding.focusLabel}`,
            `오행/균형: ${simplifySajuCopy(profileGrounding.saju.dayMaster)} / ${simplifySajuCopy(profileGrounding.saju.strength)}`,
            `역할 흐름: ${simplifySajuCopy(profileGrounding.saju.pattern)}`,
            `보완 힌트: ${simplifySajuCopy(profileGrounding.saju.yongsin)}`,
            profileGrounding.saju.currentLuck
              ? `현재 흐름: ${simplifySajuCopy(profileGrounding.saju.currentLuck)}`
              : null,
            `오늘 풀이 핵심: ${simplifySajuCopy(profileGrounding.reports.today.headline)}`,
            `오늘 풀이 요약: ${simplifySajuCopy(profileGrounding.reports.today.summary)}`,
            `주제 풀이 핵심: ${simplifySajuCopy(profileGrounding.reports.focus.headline)}`,
            `주제 풀이 요약: ${simplifySajuCopy(profileGrounding.reports.focus.summary)}`,
            `주제 풀이 행동 제안: ${simplifySajuCopy(profileGrounding.reports.focus.action)}`,
            `주제 풀이 주의점: ${simplifySajuCopy(profileGrounding.reports.focus.caution)}`,
            profileGrounding.reports.focus.evidence.length > 0
              ? `보조 단서: ${profileGrounding.reports.focus.evidence
                  .map((item) => simplifySajuCopy(`${item.label} ${item.title}`))
                  .join(' · ')}`
              : null,
            profileGrounding.missing.birthTime
              ? '태어난 시간이 빠져 있어 시간대별 세부 흐름은 보수적으로만 다룹니다.'
              : null,
            profileGrounding.missing.birthLocation
              ? '출생지가 없어 진태양시 보정은 적용하지 않았습니다.'
              : null,
            profileGrounding.missing.gender
              ? '성별 정보가 없어 일부 표현은 중성적으로 정리합니다.'
              : null,
          ]
            .filter(Boolean)
            .join('\n')
        : '[저장 프로필 정보]\n현재 연결된 사주 프로필이 없습니다.',
      recentFeedbackSummary
        ? `\n[최근 리포트 반응 요약]\n${recentFeedbackSummary}`
        : null,
      '',
      '[답변 방식]',
      '질문에 대한 결론을 첫 문단에서 먼저 말합니다.',
      '그다음 현재 흐름, 조심할 패턴, 행동 제안을 차례로 붙입니다.',
      '짧은 문단으로 답하고, 사족을 길게 붙이지 않습니다.',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
