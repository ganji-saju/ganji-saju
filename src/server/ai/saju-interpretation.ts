import type { FocusTopic, ReportScore, SajuReport } from '@/domain/saju/report/types';
import {
  buildSajuInterpretationGrounding,
  type SajuInterpretationGrounding,
} from '@/domain/saju/report';
import {
  buildReportCounselorInstructions,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import { limitSajuSentences, simplifySajuCopy } from '@/lib/saju/public-copy';

export const SAJU_INTERPRETATION_PROMPT_VERSION = 'saju-interpret-v4';

export interface SajuAiInterpretation {
  headline: string;
  summary: string;
  insights: string[];
}

export interface ParsedSajuAiInterpretation {
  ok: boolean;
  interpretation: SajuAiInterpretation;
  errorMessage: string | null;
}

const MAX_HEADLINE_LENGTH = 80;
const MAX_SUMMARY_LENGTH = 520;
const MAX_INSIGHT_LENGTH = 220;
const MAX_INSIGHTS = 4;

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeInsights(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanText(item, MAX_INSIGHT_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_INSIGHTS);
}

export function getInterpretationPromptVersion(counselorId: MoonlightCounselorId) {
  return `${SAJU_INTERPRETATION_PROMPT_VERSION}-${counselorId}`;
}

export function buildFallbackInterpretation(
  report: SajuReport,
  counselorId: MoonlightCounselorId = 'female',
  grounding?: SajuInterpretationGrounding
): SajuAiInterpretation {
  const summaryPrefix =
    counselorId === 'male' ? '핵심부터 보면, ' : '흐름을 차분히 읽어보면, ';
  const evidenceCards = grounding?.evidenceJson.classics.cards ?? [];
  const primaryConcept = grounding?.evidenceJson.primaryConcept ?? null;
  const strengthSummary =
    grounding?.evidenceJson.strength.level && grounding?.evidenceJson.strength.score !== null
      ? `강약은 ${grounding.evidenceJson.strength.level} 흐름이며, 현재 균형 점수는 ${grounding.evidenceJson.strength.score}점입니다.`
      : null;
  const patternSummary = grounding?.evidenceJson.pattern.name
    ? `격국의 중심은 ${grounding.evidenceJson.pattern.name}${grounding.evidenceJson.pattern.tenGod ? ` · ${grounding.evidenceJson.pattern.tenGod}` : ''}입니다.`
    : null;
  const yongsinSummary = grounding?.evidenceJson.yongsin.primary
    ? `보완 축은 ${grounding.evidenceJson.yongsin.primary}${grounding.evidenceJson.yongsin.support.length > 0 ? `, ${grounding.evidenceJson.yongsin.support.join(' · ')}` : ''}입니다.`
    : null;
  const luckSummary = grounding?.evidenceJson.luckFlow.currentMajorLuck
    ? `현재 ${grounding.evidenceJson.luckFlow.currentMajorLuck} 대운이 함께 작동합니다.`
    : grounding?.evidenceJson.luckFlow.saewoon
      ? `현재 ${grounding.evidenceJson.luckFlow.saewoon} 세운이 크게 작동합니다.`
      : null;
  const summaryCore = cleanText(
    compactStrings([
      primaryConcept ? `${primaryConcept} 흐름을 참고했습니다.` : null,
      strengthSummary,
      patternSummary,
      yongsinSummary,
      luckSummary,
    ]).join(' '),
    MAX_SUMMARY_LENGTH
  );

  const groundingInsights = evidenceCards
    .slice(0, 3)
    .map((card) =>
      cleanText(`${card.label}: ${card.plainSummary || `${card.title} 흐름이 핵심입니다.`}`, MAX_INSIGHT_LENGTH)
    )
    .filter(Boolean);

  const reportInsights = report.insights
    .map((insight) => cleanText(`${insight.title}: ${insight.body}`, MAX_INSIGHT_LENGTH))
    .filter(Boolean)
    .slice(0, 3);

  return {
    headline: cleanText(simplifySajuCopy(report.headline), MAX_HEADLINE_LENGTH),
    summary: cleanText(
      `${summaryPrefix}${limitSajuSentences(summaryCore || report.summary, 3)}`,
      MAX_SUMMARY_LENGTH
    ),
    insights:
      groundingInsights.length > 0
        ? groundingInsights.map((item) => cleanText(simplifySajuCopy(item), MAX_INSIGHT_LENGTH))
        : reportInsights.length > 0
          ? reportInsights.map((item) => cleanText(simplifySajuCopy(item), MAX_INSIGHT_LENGTH))
        : report.summaryHighlights
            .map((item) => cleanText(simplifySajuCopy(item), MAX_INSIGHT_LENGTH))
            .filter(Boolean)
            .slice(0, 3),
  };
}

function compactStrings(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
}

function extractJsonCandidate(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

export function parseInterpretationText(
  text: string,
  fallback: SajuAiInterpretation
): ParsedSajuAiInterpretation {
  try {
    const parsed = JSON.parse(extractJsonCandidate(text)) as Record<string, unknown>;
    const headline = cleanText(parsed.headline, MAX_HEADLINE_LENGTH);
    const summary = cleanText(parsed.summary, MAX_SUMMARY_LENGTH);
    const insights = normalizeInsights(parsed.insights);

    if (!headline || !summary || insights.length === 0) {
      return {
        ok: false,
        interpretation: fallback,
        errorMessage: 'AI interpretation JSON is missing headline, summary, or insights.',
      };
    }

    return {
      ok: true,
      interpretation: { headline, summary, insights },
      errorMessage: null,
    };
  } catch (error) {
    return {
      ok: false,
      interpretation: fallback,
      errorMessage:
        error instanceof Error ? error.message : 'AI interpretation JSON could not be parsed.',
    };
  }
}

export function createInterpretationPrompt(
  grounding: SajuInterpretationGrounding,
  focus: {
    topic: FocusTopic;
    label: string;
    scoreKey: ReportScore['key'];
  },
  counselorId: MoonlightCounselorId = 'female',
  recentFeedbackSummary?: string | null
) {
  const promptPayload = {
    counselor: {
      id: counselorId,
    },
    focus: {
      topic: focus.topic,
      label: focus.label,
      scoreKey: focus.scoreKey,
    },
    recentFeedbackSummary: recentFeedbackSummary ?? null,
    factJson: grounding.factJson,
    evidenceJson: grounding.evidenceJson,
  };

  return {
    instructions: [
      '당신은 한국 운세 서비스를 쓰는 생활 조언 에디터입니다.',
      '제공된 factJson과 evidenceJson 안에서만 해석하고, 없는 신살·격국·고전 출처를 새로 만들지 않습니다.',
      '사용자는 명리 공부가 아니라 오늘 내 삶에 필요한 말을 보러 왔습니다. 결론, 마음가짐, 오늘 할 행동을 먼저 씁니다.',
      'factJson, evidenceJson, 격국, 용신, 대운, 세운, 월운 같은 내부 용어는 본문에 직접 쓰지 않습니다. 필요하면 쉬운 말로만 바꿉니다.',
      '점수나 계산값을 그대로 반복 나열하지 말고, 지금 어떤 선택을 하면 덜 흔들리는지 생활 언어로 씁니다.',
      'recentFeedbackSummary가 있으면 최근 사용자 반응을 참고해 단정 표현의 강도만 조절하되, 계산 근거보다 앞세우지 않습니다.',
      '문장은 부드럽고 단정한 한국어로 쓰되, 과장하거나 운명을 단정하는 표현은 피합니다.',
      '의학, 법률, 투자, 생명·안전 문제는 단정하지 말고 생활 조언 수준으로 제한합니다.',
      '근거 없는 일반론을 길게 늘어놓지 말고, 사용자가 바로 이해할 수 있는 상황과 행동으로 바꿉니다.',
      '응답은 반드시 JSON 객체 하나만 반환합니다. Markdown, 설명 문장, 코드블록을 붙이지 않습니다.',
      'JSON 스키마: {"headline":"짧은 제목","summary":"2~3문장의 자연어 요약","insights":["근거 기반 통찰 1","근거 기반 통찰 2","근거 기반 통찰 3"]}',
      'headline은 38자 안팎으로, 사용자가 지금 가장 먼저 알아야 할 흐름을 바로 드러냅니다.',
      'summary는 2~3문장으로 쓰고, 첫 문장에는 현재 흐름의 핵심 해석을 넣습니다.',
      'insights는 3~4개로 작성하며, 각 항목은 서로 겹치지 않게 강점/주의점/행동 제안/관계 또는 일의 포인트를 나눠 담습니다.',
      ...buildReportCounselorInstructions(counselorId),
    ].join('\n'),
    input: JSON.stringify(promptPayload, null, 2),
  };
}
