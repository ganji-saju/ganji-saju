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

// 2026-07-06 — interpret 경로는 챕터/총평과 달리 런타임 한자 validator 가 없다.
//   프롬프트 입력에 간지(辛巳 등)가 한자로 들어가 LLM 이 "辛巳대운" 처럼 흘리면
//   그대로 사용자에게 노출된다(한글 규칙 위반). cleanText 가 headline/summary/
//   insights 의 유일 관문이므로 여기서 한자를 제거해 방어한다(프롬프트 금지 + 스트립
//   이중 방어). chapter-validator 와 동일한 문자 클래스(U+4E00–U+9FFF).
const HANJA_PATTERN = /[一-鿿]/g;

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.replace(HANJA_PATTERN, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
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
  // 2026-07-06 — "강약은 …균형 점수는 N점" 은 점수 나열이라 밀착감이 떨어져
  //   레벨만 자연어로. "강약" 은 simplify 가 "컨디션 균형" 으로 바꿔 "균형" 이
  //   세 번 겹치므로 주어를 "기운의 세기" 로 바꿔 겹침을 피한다.
  const strengthSummary = grounding?.evidenceJson.strength.level
    ? `기운의 세기는 ${grounding.evidenceJson.strength.level} 쪽으로 흐릅니다.`
    : null;
  const yongsinSummary = grounding?.evidenceJson.yongsin.primary
    ? `보완 축은 ${grounding.evidenceJson.yongsin.primary}${grounding.evidenceJson.yongsin.support.length > 0 ? `, ${grounding.evidenceJson.yongsin.support.join(' · ')}` : ''}입니다.`
    : null;
  // 2026-07-06 — 밀착 개인화: 사람 얘기(육십갑자 core)로 시작하고, 보완 축·기운
  //   세기처럼 자연어로 깔끔히 읽히는 줄로 받친다. 과거의 "{개념} 흐름을
  //   참고했습니다" 는 풀이가 아니라 인용 각주라 제거.
  //   luckSummary(currentMajorLuck)는 한자 간지("丁酉")를 담아 한글 규칙 위반 +
  //   patternSummary 는 격국명·십성 라벨이 겹쳐 "책임·도전 · 책임·도전" 이 되므로
  //   요약에서는 제외 — 방향은 insights·headline 이 이미 짚는다.
  const summaryCore = cleanText(
    compactStrings([
      personalContext?.sixtyGapja
        ? // 2026-05-23: title 이 이미 '…흐름' 으로 끝나면(예: 임자 '큰 물이 큰 물을 만난 흐름')
          //   ' 흐름이' 를 덧붙여 '흐름 흐름이' 중복이 생기므로, 끝나면 조사만 붙인다.
          `${personalContext.sixtyGapja.title}${/흐름$/.test(personalContext.sixtyGapja.title) ? '이' : ' 흐름이'} 기본 바탕입니다. ${personalContext.sixtyGapja.core}`
        : primaryConcept
          ? `${primaryConcept} 흐름이 이 사주의 중심을 잡습니다.`
          : null,
      yongsinSummary,
      strengthSummary,
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
      `${summaryPrefix}${limitSajuSentences(summaryCore || report.summary, 4)}`,
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
      '일주 이름(한글, 예: 갑자일주), 격국 이름(예: 정관격·식신격), 용신/희신(한글 기운, 예: 화 기운·목 기운), 강약(신강·신약·중화)은 본문에 그대로 인용해도 좋습니다. 단 한 문장에 하나만 — 카탈로그 나열 금지.',
      '한자(漢字)는 본문에 한 글자도 쓰지 않습니다. 입력에 간지가 한자(예: 辛巳·壬寅)로 있어도 절대 그대로 옮기지 말고, 필요하면 한글 일주 이름으로만 씁니다.',
      'sixtyGapja.title 과 sixtyGapja.core 를 headline 또는 summary 첫 문장에 직접 인용하면 가장 좋습니다. 예: "갑자일주 큰 방향을 세우는 나무, 오늘은 ___합니다."',
      // 2026-05-15 P1: 유보형 → 단정형 + 명령형 전환. 시장 벤치마크상 "할 수 있어요",
      // "편이 좋습니다" 같은 어미가 일반론으로 들려 5명 부정 피드백 1차 원인.
      '문장은 단정형 + 명령형으로 씁니다. "___ 할 수 있어요", "___ 편이 좋습니다", "___ 흐름입니다" 같은 유보형 어미는 금지. 대신 "___ 입니다", "___ 하세요", "___ 합니다" 로 끝맺습니다.',
      '점수나 계산값을 그대로 반복 나열하지 말고, 지금 어떤 선택을 하면 덜 흔들리는지 생활 언어로 씁니다.',
      '서로 다른 사주가 같은 headline, 같은 summary, 같은 insights로 나오면 실패입니다. 반드시 해당 사주의 강한 기운, 약한 기운, 일주 특성, 보완 축 중 구체적인 차이를 반영합니다.',
      'recentFeedbackSummary가 있으면 최근 사용자 반응을 참고해 단정 문구의 강도만 미세 조절하되 유보형으로 돌아가지 않습니다. 계산 근거를 앞세웁니다.',
      '의학, 법률, 투자, 생명·안전 문제는 단정하지 말고 생활 조언 수준으로 제한합니다. 그 외 일·관계·연애·재물 등 일상 흐름은 단정형으로 작성합니다.',
      '근거 없는 일반론을 길게 늘어놓지 말고, 사용자가 바로 이해할 수 있는 상황과 행동으로 바꿉니다.',
      // 2026-07-06 — 밀착 개인화(show, don't tell): 추상 성격어 대신 이 사람의 실제 일상 장면으로.
      '[밀착 개인화] 성향·강점·약점을 추상적으로 서술하지 말고 그 성향이 드러나는 구체적 일상 장면으로 보여주세요. "책임감이 강합니다"(추상·일반론) ❌ → "맡은 일은 끝을 봐야 마음이 놓입니다. 남들이 이미 넘어간 자리를 혼자 한 번 더 확인합니다"(장면·단정형) ⭕.',
      '[밀착 개인화] 누구에게나 해당되는 말은 실패입니다. "대인관계가 원만합니다" ❌ → "처음 보는 자리에선 말수를 줄이고 상대를 살핍니다. 편해졌다 싶으면 그때 말문이 트입니다" ⭕. 반드시 이 사주 데이터(강약·격국·용신·오행·일주)에서만 나오는 차이를 장면으로 짚습니다.',
      '[밀착 개인화] structuredInput 의 직업·관계·고민 컨텍스트가 있으면 장면의 배경으로 자연스럽게 깔아 이 사람의 지금 삶에 닿게 합니다. 없는 사실·사건은 지어내지 말고, 일어날 수 있는 장면은 "~한다면", "~할 때"처럼 조건으로 엽니다.',
      'insights 각 항목은 반드시 "근거 글자 1개(일주/격국/용신/오행 중 하나) + 그 성향이 드러나는 구체 장면 + 행동" 구조로 씁니다. 예: "정관격이라 책임을 혼자 떠안다 지치기 쉬우니, 맡기 전에 \'어디까지\' 를 한 줄로 적어두세요." / "용신 火가 약해 하고 싶은 말을 삼키다 뒤늦게 후회하니, 떠오를 때 짧게라도 먼저 말하세요."',
      '응답은 반드시 JSON 객체 하나만 반환합니다. Markdown, 설명 문장, 코드블록을 붙이지 않습니다.',
      'JSON 스키마: {"headline":"짧은 제목","summary":"3~4문장의 자연어 요약","insights":["근거+장면+행동 통찰 1","통찰 2","통찰 3","통찰 4"]}',
      'headline은 38자 안팎으로, 일주 이름 또는 격국을 인용해 사용자가 "내 사주 풀이다" 라고 즉시 인식할 수 있게 씁니다.',
      'summary는 3~4문장으로 풍성하게 씁니다. 첫 문장에는 일주 + 격국 + 용신 중 최소 하나를 인용해 핵심 해석을 단정형으로 넣고, 이어지는 문장은 그 해석이 이 사람 삶에서 어떻게 드러나는지 구체적 장면으로 풀어 읽는 맛을 살립니다.',
      'insights는 4개로 작성하며, 강점/약점(무너지는 자리)/관계 또는 일의 포인트/오늘의 행동을 각각 다른 항목에 담되 서로 겹치지 않게 합니다. 각 항목은 근거 글자 + 구체 장면 + 행동 구조로, 단정형 + 명령형으로 끝맺습니다.',
      ...buildReportCounselorInstructions(counselorId),
    ].join('\n'),
    input: structuredInput,
  };
}
