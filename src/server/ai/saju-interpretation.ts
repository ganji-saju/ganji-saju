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

export const SAJU_INTERPRETATION_PROMPT_VERSION = 'saju-interpret-v7';

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
  const personalContext = grounding?.personalizationContext;
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
      personalContext?.sixtyGapja
        ? `${personalContext.sixtyGapja.title} 흐름이 기본 바탕입니다. ${personalContext.sixtyGapja.core}`
        : null,
      primaryConcept ? `${primaryConcept} 흐름을 참고했습니다.` : null,
      strengthSummary,
      patternSummary,
      yongsinSummary,
      luckSummary,
    ]).join(' '),
    MAX_SUMMARY_LENGTH
  );

  const personalInsights = compactStrings([
    personalContext?.sixtyGapja?.actionCue
      ? `오늘의 방향: ${personalContext.sixtyGapja.actionCue}`
      : null,
    personalContext?.sixtyGapja?.strengths[0]
      ? `강점: ${personalContext.sixtyGapja.strengths[0]}을 살리면 좋습니다.`
      : null,
    personalContext?.sixtyGapja?.watchPoints[0]
      ? `주의: ${personalContext.sixtyGapja.watchPoints[0]}`
      : null,
  ]).map((item) => cleanText(simplifySajuCopy(item), MAX_INSIGHT_LENGTH));

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
      personalInsights.length > 0
        ? personalInsights
        : groundingInsights.length > 0
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

const PROMPT_ELEMENT_ORDER = ['목', '화', '토', '금', '수'] as const;
const PROMPT_TEN_GOD_ORDER = ['비겁', '식상', '재성', '관성', '인성'] as const;

// 받침 유무 판정 + 주격 조사(이/가) 선택. 오행 한글명(목/금=받침 O, 화/토/수=받침 X)
// 처럼 받침이 값마다 달라지는 경우 "X가" 고정은 "목가/금가" 오류 → 동적 선택.
function hasBatchim(value: string): boolean {
  const c = value.charCodeAt(value.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
}
function withSubjectParticle(value: string): string {
  return `${value}${hasBatchim(value) ? '이' : '가'}`;
}

function classifyPromptStrength(value: number) {
  if (value <= 0) return '없음';
  if (value >= 2.5) return '강';
  if (value >= 1.2) return '중';
  return '약';
}

function formatRatio(value: number) {
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
}

function buildFiveElementLine(grounding: SajuInterpretationGrounding) {
  const ratio = grounding.personalizationContext.fiveElementRatio;
  return PROMPT_ELEMENT_ORDER.map((element) => `${element}${formatRatio(ratio[element] ?? 0)}%`).join(' ');
}

function buildTenGodLine(grounding: SajuInterpretationGrounding) {
  const distribution = grounding.personalizationContext.tenGodDistribution;

  return PROMPT_TEN_GOD_ORDER.map((group) => {
    const value = distribution[group] ?? 0;
    return `${group}(${classifyPromptStrength(value)}${value > 0 ? ` ${formatRatio(value)}` : ''})`;
  }).join(' ');
}

function buildYongsinLine(grounding: SajuInterpretationGrounding) {
  const yongsin = grounding.personalizationContext.yongsinKiyshin;

  return [
    yongsin.용신 ? `용신: ${yongsin.용신}` : '용신: 미산정',
    yongsin.희신 ? `희신: ${yongsin.희신}` : null,
    yongsin.기신 ? `기신: ${yongsin.기신}` : null,
  ].filter(Boolean).join(' / ');
}

function buildStrengthLine(grounding: SajuInterpretationGrounding) {
  const strength = grounding.personalizationContext.strengthJudgement;
  return `${strength.일간강약 ?? '미산정'} (${strength.월령득기 ? '월령 득기' : '월령 보통'})`;
}

function formatPromptPillar(
  pillar: SajuInterpretationGrounding['factJson']['pillars']['year'] | null
) {
  if (!pillar) return '미상';
  return `${pillar.ganzi} (${pillar.stem}${pillar.branch})`;
}

function buildElementImbalanceLines(grounding: SajuInterpretationGrounding) {
  const ratio = grounding.personalizationContext.fiveElementRatio;

  return PROMPT_ELEMENT_ORDER.flatMap((element) => {
    const value = ratio[element] ?? 0;

    if (value >= 35) {
      return [`${withSubjectParticle(element)} 강함: 이 기운은 장점으로 쓰면 추진력이나 존재감이 되지만, 과하면 속도 조절이 필요합니다.`];
    }

    if (value === 0) {
      return [`${withSubjectParticle(element)} 없음: 이 영역은 의식적으로 빌려 써야 하며, 생활 루틴과 선택 방식에서 보완이 필요합니다.`];
    }

    if (value <= 10) {
      return [`${withSubjectParticle(element)} 약함: 이 기운은 쉽게 부족해질 수 있어 하루 선택에서 작게 보완해야 합니다.`];
    }

    return [];
  }).slice(0, 3);
}

function buildStructuredInterpretationInput(
  grounding: SajuInterpretationGrounding,
  focus: {
    topic: FocusTopic;
    label: string;
    scoreKey: ReportScore['key'];
  },
  counselorId: MoonlightCounselorId,
  recentFeedbackSummary?: string | null
) {
  const context = grounding.personalizationContext;
  const rawPayload = {
    counselor: { id: counselorId },
    focus,
    recentFeedbackSummary: recentFeedbackSummary ?? null,
    personalizationContext: context,
    factJson: grounding.factJson,
    evidenceJson: grounding.evidenceJson,
  };

  return [
    '===사주 원국===',
    `일간: ${grounding.factJson.dayMaster.stem}${grounding.factJson.dayMaster.element ? ` · ${grounding.factJson.dayMaster.element}` : ''}`,
    `년주: ${formatPromptPillar(grounding.factJson.pillars.year)}`,
    `월주: ${formatPromptPillar(grounding.factJson.pillars.month)}`,
    `일주: ${context.dayGanziHanja} (${context.dayGanziCode}) — ${
      context.sixtyGapja
        ? `${context.sixtyGapja.title}. ${context.sixtyGapja.core}`
        : '60갑자 특성 데이터 없음'
    }`,
    `시주: ${formatPromptPillar(grounding.factJson.pillars.hour)}`,
    `오행: ${buildFiveElementLine(grounding)}`,
    `십성: ${buildTenGodLine(grounding)}`,
    `일간 강약: ${buildStrengthLine(grounding)}`,
    buildYongsinLine(grounding),
    `대운현황: ${context.currentLuck.현재대운 ?? '미산정'}${
      context.currentLuck.진행년수 !== null ? ` · 진행 ${context.currentLuck.진행년수}년차` : ''
    }`,
    '',
    '===이 사주의 고유 특성===',
    ...compactStrings([
      context.sixtyGapja ? `- ${context.dayGanziCode}일주 특성: ${context.sixtyGapja.core}` : null,
      context.sixtyGapja?.strengths[0] ? `- 강점 후보: ${context.sixtyGapja.strengths.join(' / ')}` : null,
      context.sixtyGapja?.watchPoints[0] ? `- 주의 후보: ${context.sixtyGapja.watchPoints.join(' / ')}` : null,
      context.sixtyGapja?.actionCue ? `- 행동 후보: ${context.sixtyGapja.actionCue}` : null,
      ...buildElementImbalanceLines(grounding),
    ]),
    '',
    '===풀이 지시===',
    '- 이 사람만의 구체적 특성을 중심으로 풀이하라.',
    '- 위 사주 원국의 수치와 다른 판단을 새로 만들지 말 것.',
    '- 오행 비율, 십성 분포, 일간 강약, 용신/희신/기신 중 최소 3가지를 내부 근거로 사용하라.',
    '- 누구에게나 맞는 일반적인 사주 해설, 평균적인 위로, 반복 문장을 쓰지 말 것.',
    '- 전문용어는 본문에 직접 노출하지 말고 생활 장면으로 번역하라.',
    '- “오늘/이 주제에서 실제로 어떻게 나타나는가”를 구체적인 선택, 말투, 행동으로 바꿔라.',
    '- 출력은 JSON만 반환하라. headline, summary, insights 각각에 서로 다른 개인화 근거가 드러나야 한다.',
    '',
    '[원본 데이터 JSON]',
    JSON.stringify(rawPayload, null, 2),
  ].join('\n');
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
  const structuredInput = buildStructuredInterpretationInput(
    grounding,
    focus,
    counselorId,
    recentFeedbackSummary
  );

  return {
    instructions: [
      '당신은 한국 사주 풀이 전문가가 운영하는 운세 서비스의 작가입니다. 명리 도메인 지식을 갖춘 글쓰기 가이드입니다.',
      '제공된 personalizationContext, factJson, evidenceJson 안에서만 해석하고, 없는 신살·격국·고전 출처를 새로 만들지 않습니다.',
      '개인화의 1순위 근거는 ===사주 원국===과 ===이 사주의 고유 특성===입니다. dayGanziCode, sixtyGapja, fiveElementRatio, tenGodDistribution, strengthJudgement, yongsinKiyshin, currentLuck을 반드시 참고해 사람마다 다른 결론을 만듭니다.',
      '사용자는 명리 공부가 아니라 오늘 내 삶에 필요한 말을 보러 왔습니다. 결론, 마음가짐, 오늘 할 행동을 먼저 씁니다.',
      // 2026-05-15 P1: 한국 사주 사이트 벤치마크상 일주 이름과 격국·용신 같은 명리 라벨을
      // 의도적으로 노출하는 것이 신뢰감의 핵심. 기존 prompt 가 "내부 용어 금지" 였던 것을
      // "사주 글자·격국·용신·일주 라벨은 그대로 인용 권장" 으로 전환.
      '일주 한자(예: 갑자일주/壬寅일주), 격국 이름(예: 정관격·식신격), 용신/희신 글자(예: 火, 木), 강약(신강·신약·중화)은 본문에 그대로 인용해도 좋습니다. 단 한 문장에 하나만 — 카탈로그 나열 금지.',
      'sixtyGapja.title 과 sixtyGapja.core 를 headline 또는 summary 첫 문장에 직접 인용하면 가장 좋습니다. 예: "갑자일주 큰 방향을 세우는 나무, 오늘은 ___합니다."',
      // 2026-05-15 P1: 유보형 → 단정형 + 명령형 전환. 시장 벤치마크상 "할 수 있어요",
      // "편이 좋습니다" 같은 어미가 일반론으로 들려 5명 부정 피드백 1차 원인.
      '문장은 단정형 + 명령형으로 씁니다. "___ 할 수 있어요", "___ 편이 좋습니다", "___ 흐름입니다" 같은 유보형 어미는 금지. 대신 "___ 입니다", "___ 하세요", "___ 합니다" 로 끝맺습니다.',
      '점수나 계산값을 그대로 반복 나열하지 말고, 지금 어떤 선택을 하면 덜 흔들리는지 생활 언어로 씁니다.',
      '서로 다른 사주가 같은 headline, 같은 summary, 같은 insights로 나오면 실패입니다. 반드시 해당 사주의 강한 기운, 약한 기운, 일주 특성, 보완 축 중 구체적인 차이를 반영합니다.',
      'recentFeedbackSummary가 있으면 최근 사용자 반응을 참고해 단정 표현의 강도만 미세 조절하되 유보형으로 돌아가지 않습니다. 계산 근거를 앞세웁니다.',
      '의학, 법률, 투자, 생명·안전 문제는 단정하지 말고 생활 조언 수준으로 제한합니다. 그 외 일·관계·연애·재물 등 일상 흐름은 단정형으로 작성합니다.',
      '근거 없는 일반론을 길게 늘어놓지 말고, 사용자가 바로 이해할 수 있는 상황과 행동으로 바꿉니다.',
      'insights 각 항목은 반드시 "근거 글자 1개(일주/격국/용신/오행 중 하나) + 행동" 구조로 씁니다. 예: "정관격이라 책임을 분명히 적어두세요." / "용신 火를 살리려면 짧게라도 표현하세요."',
      '응답은 반드시 JSON 객체 하나만 반환합니다. Markdown, 설명 문장, 코드블록을 붙이지 않습니다.',
      'JSON 스키마: {"headline":"짧은 제목","summary":"2~3문장의 자연어 요약","insights":["근거 기반 통찰 1","근거 기반 통찰 2","근거 기반 통찰 3"]}',
      'headline은 38자 안팎으로, 일주 이름 또는 격국을 인용해 사용자가 "내 사주 풀이다" 라고 즉시 인식할 수 있게 씁니다.',
      'summary는 2~3문장으로 쓰고, 첫 문장에는 일주 + 격국 + 용신 중 최소 하나를 인용해 현재 흐름의 핵심 해석을 단정형으로 넣습니다.',
      'insights는 3~4개로 작성하며, 각 항목은 서로 겹치지 않게 강점/주의점/행동 제안/관계 또는 일의 포인트를 나눠 담습니다. 모든 항목은 단정형 + 명령형으로 끝맺습니다.',
      ...buildReportCounselorInstructions(counselorId),
    ].join('\n'),
    input: structuredInput,
  };
}
