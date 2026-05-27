import type { SajuYearlyReport, YearlyCategoryKey } from '@/domain/saju/report/yearly-types';
import {
  buildReportCounselorInstructions,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import type { ReadingRecord } from '@/lib/saju/readings';

export const SAJU_YEARLY_INTERPRETATION_PROMPT_VERSION = 'saju-yearly-interpret-v7';

const YEARLY_CATEGORY_ORDER: YearlyCategoryKey[] = [
  'work',
  'wealth',
  'love',
  'relationship',
  'health',
  'move',
];

const YEARLY_CATEGORY_LABEL: Record<YearlyCategoryKey, string> = {
  work: '일·직업운',
  wealth: '재물운',
  love: '연애·결혼운',
  relationship: '인간관계운',
  health: '건강운',
  move: '이동·변화운',
};

export interface SajuYearlyAiMonthlyFlow {
  month: number;
  summary: string;
  focus?: string;
  caution?: string;
  action?: string;
}

export interface SajuYearlyAiInterpretation {
  opening: string;
  keywords: string[];
  firstHalf: string;
  secondHalf: string;
  categories: Record<YearlyCategoryKey, string>;
  monthlyFlows: SajuYearlyAiMonthlyFlow[];
  goodPeriods: string[];
  cautionPeriods: string[];
  actionAdvice: string[];
  oneLineSummary: string;
}

export type SajuYearlyInterpretationPromptSection = 'full' | 'narrative' | 'monthly';

export interface SajuYearlyAiNarrativeInterpretation {
  opening: string;
  keywords: string[];
  firstHalf: string;
  secondHalf: string;
  categories: Record<YearlyCategoryKey, string>;
  goodPeriods: string[];
  cautionPeriods: string[];
  actionAdvice: string[];
  oneLineSummary: string;
}

export interface ParsedSajuYearlyAiInterpretation {
  ok: boolean;
  interpretation: SajuYearlyAiInterpretation;
  errorMessage: string | null;
}

export interface ParsedSajuYearlyAiNarrativeInterpretation {
  ok: boolean;
  interpretation: SajuYearlyAiNarrativeInterpretation;
  errorMessage: string | null;
}

export interface ParsedSajuYearlyAiMonthlyFlows {
  ok: boolean;
  monthlyFlows: SajuYearlyAiMonthlyFlow[];
  errorMessage: string | null;
}

const MAX_OPENING_LENGTH = 1400;
const MAX_KEYWORD_LENGTH = 180;
const MAX_HALF_LENGTH = 1100;
const MAX_CATEGORY_LENGTH = 700;
const MAX_MONTHLY_LENGTH = 240;
const MAX_MONTHLY_DETAIL_LENGTH = 110;
const MAX_PERIOD_LENGTH = 260;
const MAX_ACTION_LENGTH = 240;
const MAX_SUMMARY_LENGTH = 220;
const MIN_MONTHS = 12;

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return simplifySajuCopy(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function splitSentences(value: string) {
  return simplifySajuCopy(value)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function tightenLine(value: string, maxSentences = 2, maxLength = 110) {
  const compact = splitSentences(value).slice(0, maxSentences).join(' ').trim();
  if (compact.length <= maxLength) return compact;
  const sliced = compact.slice(0, maxLength).trim();
  return /[.!?。]$/.test(sliced) ? sliced : `${sliced}...`;
}

function normalizeStringArray(
  value: unknown,
  maxLength: number,
  minCount: number,
  maxCount: number
) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, Math.max(minCount, maxCount));
}

function normalizeMonthlyFlows(value: unknown) {
  if (!Array.isArray(value)) return [];

  const flows: SajuYearlyAiMonthlyFlow[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const month =
      typeof row.month === 'number'
        ? row.month
        : typeof row.month === 'string'
          ? Number.parseInt(row.month, 10)
          : NaN;
    const summary = cleanText(row.summary, MAX_MONTHLY_LENGTH);
    const focus = cleanText(row.focus, MAX_MONTHLY_DETAIL_LENGTH);
    const caution = cleanText(row.caution, MAX_MONTHLY_DETAIL_LENGTH);
    const action = cleanText(row.action, MAX_MONTHLY_DETAIL_LENGTH);

    if (!Number.isInteger(month) || month < 1 || month > 12 || !summary) {
      continue;
    }

    flows.push({ month, summary, focus, caution, action });
  }

  flows.sort((a, b) => a.month - b.month);

  const deduped = flows.filter(
    (flow, index) => index === flows.findIndex((candidate) => candidate.month === flow.month)
  );

  return deduped;
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

function normalizeCategoryMap(value: unknown) {
  if (!value || typeof value !== 'object') return null;

  const row = value as Record<string, unknown>;
  const categories = YEARLY_CATEGORY_ORDER.reduce((acc, key) => {
    acc[key] = cleanText(row[key], MAX_CATEGORY_LENGTH);
    return acc;
  }, {} as Record<YearlyCategoryKey, string>);

  return YEARLY_CATEGORY_ORDER.every((key) => categories[key].length > 0)
    ? categories
    : null;
}

function ensureParagraph(value: string, fallback: string) {
  return value.trim().length > 0 ? value.trim() : fallback.trim();
}

function formatKeywordLine(entry: string) {
  const [label, ...rest] = entry.split(':');
  if (rest.length === 0) return `**${entry}**`;
  return `**${label.trim()}**: ${rest.join(':').trim()}`;
}

function renderPeriodLines(lines: string[]) {
  return lines.map((line) => `- ${line}`).join('\n');
}

function renderMonthlyLines(flows: SajuYearlyAiMonthlyFlow[]) {
  return flows
    .sort((a, b) => a.month - b.month)
    .map((flow) =>
      [
        `### ${flow.month}월`,
        flow.summary,
        flow.focus ? `- 먼저 볼 것: ${flow.focus}` : null,
        flow.caution ? `- 조심할 것: ${flow.caution}` : null,
        flow.action ? `- 오늘 할 일: ${flow.action}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n');
}

function serializePillar(pillar: ReadingRecord['sajuData']['pillars']['year'] | null) {
  if (!pillar) return null;

  return {
    ganzi: pillar.ganzi,
    stem: pillar.stem,
    branch: pillar.branch,
    stemElement: pillar.stemElement,
    branchElement: pillar.branchElement,
    stemTenGod: pillar.stemTenGod,
    hiddenStems: pillar.hiddenStems.map((stem) => ({
      stem: stem.stem,
      element: stem.element,
      tenGod: stem.tenGod,
      order: stem.order,
    })),
  };
}

function formatTimingWindowEntries(
  report: SajuYearlyReport,
  key: 'goodPeriods' | 'cautionPeriods'
) {
  return report[key].map((window) => {
    const monthLabel = window.months.map((month) => `${month}월`).join(', ');
    return `${monthLabel}: ${window.reason} ${window.strategy}`;
  });
}

function buildCategoryFallback(
  report: SajuYearlyReport,
  key: YearlyCategoryKey,
  counselorId: MoonlightCounselorId
) {
  const section = report.categories[key];
  const prefix =
    counselorId === 'male'
      ? '핵심부터 보면'
      : '흐름을 차분히 읽어보면';

  return tightenLine([
    `${prefix} ${section.summary}`,
    `좋게 쓰면 ${section.opportunity}`,
    `다만 ${section.caution}`,
    `올해는 ${section.action}`,
  ].join(' '), 3, 260);
}

export function getYearlyInterpretationPromptVersion(
  counselorId: MoonlightCounselorId
) {
  return `${SAJU_YEARLY_INTERPRETATION_PROMPT_VERSION}-${counselorId}`;
}

export function buildFallbackYearlyInterpretation(
  report: SajuYearlyReport,
  counselorId: MoonlightCounselorId = 'female'
): SajuYearlyAiInterpretation {
  const introPrefix =
    counselorId === 'male'
      ? `${report.year}년은 결론부터 보면 방향을 먼저 세우는 해입니다.`
      : `${report.year}년은 한 해의 흐름이 서서히 드러나는 해입니다.`;
  const keywords = report.coreKeywords
    .map((item) => `${item.label}: ${item.reason}`)
    .slice(0, 5);
  const categories = YEARLY_CATEGORY_ORDER.reduce((acc, key) => {
    acc[key] = buildCategoryFallback(report, key, counselorId);
    return acc;
  }, {} as Record<YearlyCategoryKey, string>);
  const monthlyFlows = report.monthlyFlows.map((flow) => ({
    month: flow.month,
    summary: tightenLine(flow.summary, 1, 88),
    focus: tightenLine(flow.focusQuestion, 1, 56),
    caution: tightenLine(flow.caution, 1, 72),
    action: tightenLine(flow.action, 1, 72),
  }));
  const actionAdvice = [
    ...report.actionGuide.useWhenStrong,
    ...report.actionGuide.defendWhenWeak,
  ].slice(0, 6);

  return {
    opening: [
      introPrefix,
      report.overview.summary,
      `${report.firstHalf.summary} ${report.secondHalf.summary}`,
      `올해는 ${report.annualContext.yearGanji} 흐름과 ${
        report.annualContext.currentMajorLuck
          ? `${report.annualContext.currentMajorLuck} 큰 흐름`
          : '타고난 사주의 중심 흐름'
      }이 겹쳐 작동하므로, 기회와 조심할 시기를 함께 읽는 것이 중요합니다.`,
    ].join(' '),
    keywords,
    firstHalf: `${report.firstHalf.summary} 특히 ${report.firstHalf.opportunity} 다만 ${report.firstHalf.caution} 상반기 실천은 ${report.firstHalf.action}`,
    secondHalf: `${report.secondHalf.summary} 하반기에는 ${report.secondHalf.opportunity} 그러나 ${report.secondHalf.caution} 하반기 실천은 ${report.secondHalf.action}`,
    categories,
    monthlyFlows,
    goodPeriods: formatTimingWindowEntries(report, 'goodPeriods'),
    cautionPeriods: formatTimingWindowEntries(report, 'cautionPeriods'),
    actionAdvice,
    oneLineSummary: report.oneLineSummary,
  };
}

export function buildFallbackYearlyNarrativeInterpretation(
  interpretation: SajuYearlyAiInterpretation
): SajuYearlyAiNarrativeInterpretation {
  return {
    opening: interpretation.opening,
    keywords: interpretation.keywords,
    firstHalf: interpretation.firstHalf,
    secondHalf: interpretation.secondHalf,
    categories: interpretation.categories,
    goodPeriods: interpretation.goodPeriods,
    cautionPeriods: interpretation.cautionPeriods,
    actionAdvice: interpretation.actionAdvice,
    oneLineSummary: interpretation.oneLineSummary,
  };
}

export function mergeYearlyInterpretationSections(
  narrative: SajuYearlyAiNarrativeInterpretation,
  monthlyFlows: SajuYearlyAiMonthlyFlow[]
): SajuYearlyAiInterpretation {
  return {
    ...narrative,
    monthlyFlows,
  };
}

export function parseYearlyNarrativeInterpretationText(
  text: string,
  fallback: SajuYearlyAiNarrativeInterpretation
): ParsedSajuYearlyAiNarrativeInterpretation {
  try {
    const parsed = JSON.parse(extractJsonCandidate(text)) as Record<string, unknown>;
    const opening = cleanText(parsed.opening, MAX_OPENING_LENGTH);
    const keywords = normalizeStringArray(parsed.keywords, MAX_KEYWORD_LENGTH, 3, 5);
    const firstHalf = cleanText(parsed.firstHalf, MAX_HALF_LENGTH);
    const secondHalf = cleanText(parsed.secondHalf, MAX_HALF_LENGTH);
    const categories = normalizeCategoryMap(parsed.categories);
    const goodPeriods = normalizeStringArray(parsed.goodPeriods, MAX_PERIOD_LENGTH, 2, 4);
    const cautionPeriods = normalizeStringArray(parsed.cautionPeriods, MAX_PERIOD_LENGTH, 2, 4);
    const actionAdvice = normalizeStringArray(parsed.actionAdvice, MAX_ACTION_LENGTH, 3, 6);
    const oneLineSummary = cleanText(parsed.oneLineSummary, MAX_SUMMARY_LENGTH);

    if (
      !opening ||
      keywords.length < 3 ||
      !firstHalf ||
      !secondHalf ||
      !categories ||
      goodPeriods.length < 1 ||
      cautionPeriods.length < 1 ||
      actionAdvice.length < 3 ||
      !oneLineSummary
    ) {
      return {
        ok: false,
        interpretation: fallback,
        errorMessage: 'Yearly AI narrative JSON is missing required sections.',
      };
    }

    return {
      ok: true,
      interpretation: {
        opening,
        keywords: keywords.slice(0, 5),
        firstHalf,
        secondHalf,
        categories,
        goodPeriods: goodPeriods.slice(0, 4),
        cautionPeriods: cautionPeriods.slice(0, 4),
        actionAdvice: actionAdvice.slice(0, 6),
        oneLineSummary,
      },
      errorMessage: null,
    };
  } catch (error) {
    return {
      ok: false,
      interpretation: fallback,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Yearly AI narrative JSON could not be parsed.',
    };
  }
}

export function parseYearlyMonthlyFlowsText(
  text: string,
  fallback: SajuYearlyAiMonthlyFlow[]
): ParsedSajuYearlyAiMonthlyFlows {
  try {
    const parsed = JSON.parse(extractJsonCandidate(text)) as Record<string, unknown>;
    const monthlyFlows = normalizeMonthlyFlows(parsed.monthlyFlows ?? parsed);

    if (monthlyFlows.length < MIN_MONTHS) {
      return {
        ok: false,
        monthlyFlows: fallback,
        errorMessage: 'Yearly AI monthly JSON is missing one or more months.',
      };
    }

    return {
      ok: true,
      monthlyFlows: monthlyFlows.slice(0, 12),
      errorMessage: null,
    };
  } catch (error) {
    return {
      ok: false,
      monthlyFlows: fallback,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Yearly AI monthly JSON could not be parsed.',
    };
  }
}

export function parseYearlyInterpretationText(
  text: string,
  fallback: SajuYearlyAiInterpretation
): ParsedSajuYearlyAiInterpretation {
  const narrative = parseYearlyNarrativeInterpretationText(
    text,
    buildFallbackYearlyNarrativeInterpretation(fallback)
  );
  const monthly = parseYearlyMonthlyFlowsText(text, fallback.monthlyFlows);

  if (!narrative.ok || !monthly.ok) {
    return {
      ok: false,
      interpretation: fallback,
      errorMessage:
        narrative.errorMessage ??
        monthly.errorMessage ??
        'Yearly AI interpretation JSON could not be parsed.',
    };
  }

  return {
    ok: true,
    interpretation: mergeYearlyInterpretationSections(
      narrative.interpretation,
      monthly.monthlyFlows
    ),
    errorMessage: null,
  };
}

export function renderYearlyInterpretationReport(
  interpretation: SajuYearlyAiInterpretation
) {
  return [
    interpretation.opening,
    '## 올해 핵심 키워드',
    interpretation.keywords.map(formatKeywordLine).join('\n\n'),
    '## 상반기 흐름 분석',
    interpretation.firstHalf,
    '## 하반기 흐름 분석',
    interpretation.secondHalf,
    ...YEARLY_CATEGORY_ORDER.flatMap((key) => [
      `## ${YEARLY_CATEGORY_LABEL[key]}`,
      ensureParagraph(interpretation.categories[key], ''),
    ]),
    '## 월별 흐름 요약',
    renderMonthlyLines(interpretation.monthlyFlows),
    '## 잘 풀리는 시기',
    renderPeriodLines(interpretation.goodPeriods),
    '## 조심해야 할 시기',
    renderPeriodLines(interpretation.cautionPeriods),
    '## 올해를 잘 보내는 행동 조언',
    renderPeriodLines(interpretation.actionAdvice),
    '## 올해의 한 줄 요약',
    `**${interpretation.oneLineSummary}**`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function createSharedGrounding(
  record: ReadingRecord,
  report: SajuYearlyReport,
  counselorId: MoonlightCounselorId
) {
  const data = record.sajuData;
  return {
    counselor: {
      id: counselorId,
    },
    targetYear: report.year,
    birth: {
      year: record.input.year,
      month: record.input.month,
      day: record.input.day,
      hour: record.input.hour ?? null,
      minute: record.input.minute ?? null,
      hourKnown: data.input.hourKnown,
      gender: record.input.gender ?? null,
      birthLocation: record.input.birthLocation?.label ?? null,
    },
    pillars: {
      year: serializePillar(data.pillars.year),
      month: serializePillar(data.pillars.month),
      day: serializePillar(data.pillars.day),
      hour: serializePillar(data.pillars.hour),
    },
    dayMaster: data.dayMaster,
    fiveElements: data.fiveElements,
    tenGods: data.tenGods,
    strength: data.strength,
    pattern: data.pattern,
    yongsin: data.yongsin,
    currentLuck: data.currentLuck,
    personalizationContext: record.grounding.personalizationContext,
    factJson: record.grounding.factJson,
    evidenceJson: record.grounding.evidenceJson,
    kasiComparison: record.kasiComparison,
  };
}

function mapEvidenceCards(report: SajuYearlyReport) {
  return report.evidenceCards.map((card) => ({
    key: card.key,
    label: card.label,
    title: card.title,
    body: card.body,
    details: card.details,
    computed: card.computed,
    confidence: card.confidence,
    topicMapping: card.topicMapping,
  }));
}

function createNarrativeGrounding(
  record: ReadingRecord,
  report: SajuYearlyReport,
  counselorId: MoonlightCounselorId
) {
  return {
    ...createSharedGrounding(record, report, counselorId),
    yearlyEvidence: {
      computation: report.computation,
      annualContext: report.annualContext,
      overview: report.overview,
      coreKeywords: report.coreKeywords,
      firstHalf: report.firstHalf,
      secondHalf: report.secondHalf,
      categories: report.categories,
      goodPeriods: report.goodPeriods,
      cautionPeriods: report.cautionPeriods,
      actionGuide: report.actionGuide,
      oneLineSummary: report.oneLineSummary,
      referenceReports: report.referenceReports,
      evidenceCards: mapEvidenceCards(report),
    },
  };
}

function createMonthlyGrounding(
  record: ReadingRecord,
  report: SajuYearlyReport,
  counselorId: MoonlightCounselorId
) {
  return {
    ...createSharedGrounding(record, report, counselorId),
    yearlyEvidence: {
      computation: report.computation,
      annualContext: report.annualContext,
      monthlyFlows: report.monthlyFlows,
      goodPeriods: report.goodPeriods,
      cautionPeriods: report.cautionPeriods,
      referenceReports: report.referenceReports,
      evidenceCards: report.evidenceCards.map((card) => ({
        key: card.key,
        label: card.label,
        title: card.title,
        plainSummary: card.plainSummary,
        topicMapping: card.topicMapping,
      })),
    },
  };
}

export function createYearlyInterpretationPrompt(
  record: ReadingRecord,
  report: SajuYearlyReport,
  counselorId: MoonlightCounselorId = 'female',
  section: SajuYearlyInterpretationPromptSection = 'full',
  recentFeedbackSummary?: string | null
) {
  const grounding =
    section === 'monthly'
      ? createMonthlyGrounding(record, report, counselorId)
      : section === 'narrative'
        ? createNarrativeGrounding(record, report, counselorId)
        : {
            ...createSharedGrounding(record, report, counselorId),
            yearlyEvidence: {
              computation: report.computation,
              annualContext: report.annualContext,
              overview: report.overview,
              coreKeywords: report.coreKeywords,
              firstHalf: report.firstHalf,
              secondHalf: report.secondHalf,
              categories: report.categories,
              monthlyFlows: report.monthlyFlows,
              goodPeriods: report.goodPeriods,
              cautionPeriods: report.cautionPeriods,
              actionGuide: report.actionGuide,
              oneLineSummary: report.oneLineSummary,
              referenceReports: report.referenceReports,
              evidenceCards: mapEvidenceCards(report),
            },
          };

  const groundedInput = {
    ...grounding,
    recentFeedbackSummary: recentFeedbackSummary ?? null,
  };

  const schemaLine =
    section === 'monthly'
      ? '{"monthlyFlows":[{"month":1,"summary":"1월 핵심 장면","focus":"먼저 볼 질문과 기회","caution":"조심할 장면","action":"오늘 할 일"},...,{"month":12,"summary":"12월 핵심 장면","focus":"먼저 볼 질문과 기회","caution":"조심할 장면","action":"오늘 할 일"}]}'
      : section === 'narrative'
        ? '{"opening":"첫 문단 장문","keywords":["키워드: 설명","..."],"firstHalf":"상반기 장문","secondHalf":"하반기 장문","categories":{"work":"일·직업운 장문","wealth":"재물운 장문","love":"연애·결혼운 장문","relationship":"인간관계운 장문","health":"건강운 장문","move":"이동·변화운 장문"},"goodPeriods":["좋은 시기 설명","..."],"cautionPeriods":["주의 시기 설명","..."],"actionAdvice":["행동 조언","..."],"oneLineSummary":"마지막 한 줄 요약"}'
        : '{"opening":"첫 문단 장문","keywords":["키워드: 설명","..."],"firstHalf":"상반기 장문","secondHalf":"하반기 장문","categories":{"work":"일·직업운 장문","wealth":"재물운 장문","love":"연애·결혼운 장문","relationship":"인간관계운 장문","health":"건강운 장문","move":"이동·변화운 장문"},"monthlyFlows":[{"month":1,"summary":"1월 핵심 장면","focus":"먼저 볼 질문과 기회","caution":"조심할 장면","action":"오늘 할 일"},...,{"month":12,"summary":"12월 핵심 장면","focus":"먼저 볼 질문과 기회","caution":"조심할 장면","action":"오늘 할 일"}],"goodPeriods":["좋은 시기 설명","..."],"cautionPeriods":["주의 시기 설명","..."],"actionAdvice":["행동 조언","..."],"oneLineSummary":"마지막 한 줄 요약"}';

  const sectionSpecificInstructions =
    section === 'monthly'
      ? [
          '이번 응답에서는 monthlyFlows만 작성합니다.',
          'monthlyFlows 외의 키는 출력하지 않습니다.',
          '1월부터 12월까지 반드시 모두 채우고, 각 달마다 summary, focus, caution, action을 모두 넣습니다.',
          'summary는 한 문장, 55자 안팎으로 씁니다.',
          'focus/caution/action은 각각 한 문장으로 쓰고, 20~45자 안에서 바로 판단이 되게 씁니다.',
        ]
      : section === 'narrative'
        ? [
            '이번 응답에서는 opening, keywords, firstHalf, secondHalf, categories, goodPeriods, cautionPeriods, actionAdvice, oneLineSummary만 작성합니다.',
            'monthlyFlows는 생성하지 않습니다.',
          ]
        : [
            '응답은 전체 연간 리포트 JSON 한 벌이어야 합니다.',
            'monthlyFlows는 1월부터 12월까지 반드시 모두 채웁니다.',
          ];

  return {
    instructions: [
      '당신은 한국 운세 서비스를 쓰는 일반 사용자가 한 해 흐름을 쉽게 이해하도록 정리하는 생활 조언 에디터입니다.',
      '제공된 JSON 정보 안에서만 해석하고, 없는 사건이나 공포스러운 예언을 새로 만들지 않습니다.',
      '결과물은 길게 늘인 장문이 아니라, 한 해의 흐름과 행동 조언이 바로 읽히는 모바일 운세 데이터여야 합니다.',
      '사용자는 명리학을 배우러 온 사람이 아니라 올해 무엇을 조심하고 어떻게 움직일지 알고 싶어 합니다.',
      '과장, 희망고문, 공포 조장, 운명을 단정하는 말은 피합니다.',
      '무조건, 반드시, 100% 같은 단정 문구는 쓰지 않습니다.',
      'recentFeedbackSummary가 있으면 최근 실제 반응을 참고해 말 강도만 미세 조정하고, 계산 설명보다 사용자 체감을 앞세웁니다.',
      '격국, 용신, 대운, 세운, 월운, 원국, 명식, factJson, evidenceJson 같은 내부 용어는 본문에 직접 쓰지 않습니다. 필요하면 쉬운 생활 언어로만 바꿉니다.',
      '연애, 일, 재물, 관계, 건강, 이동의 현실 주제를 우선하고, 왜 그런 흐름인지보다 그래서 무엇을 하면 좋은지를 먼저 씁니다.',
      '길게 늘어놓기보다 읽기 쉽게 씁니다. 한 문단은 2~3문장을 넘기지 않고, 같은 접속어와 같은 결론 구조를 반복하지 않습니다.',
      '카드 안 문구는 설명보다 판단이 먼저 보여야 합니다. 짧게 잘라서 한 번에 읽히게 씁니다.',
      '응답은 반드시 JSON 객체 하나만 반환합니다. Markdown, 설명 문장, 코드블록을 붙이지 않습니다.',
      'JSON 스키마:',
      schemaLine,
      'opening은 제목 없이 바로 시작되는 첫 문단이며, 흡입력 있게 시작해야 합니다.',
      'keywords는 3~5개입니다. 각 항목은 한 해의 핵심 키워드와 그 이유를 함께 담습니다.',
      'firstHalf와 secondHalf는 각각 2~3문장 안에서 쓰고, 기회와 리스크와 첫 행동이 겹치지 않게 나눕니다.',
      'categories의 6개 분야는 각 분야마다 "무슨 장면이 핵심인지 / 무엇을 조심할지 / 어떻게 행동할지"가 바로 읽히게 2~3문장 안에서 정리합니다.',
      'monthlyFlows는 1월부터 12월까지 서로 다른 질문을 던져야 합니다. 같은 문장 구조, 같은 도입, 같은 결론을 반복하지 않습니다.',
      'monthlyFlows는 사용자가 실제로 궁금해하는 선택 장면, 돈과 일의 판단, 관계 조율, 달력에 표시해 둘 만한 포인트를 우선해서 씁니다.',
      'monthlyFlows는 체감 가능한 변화 중심으로 쓰고, 설명보다 오늘 할 일이 먼저 보이게 씁니다. 한 달 설명을 장문 단락 하나로 늘리지 않습니다.',
      'monthlyFlows의 summary, focus, caution, action은 서로 역할이 겹치지 않게 씁니다. 같은 말을 조금 바꿔 반복하지 않습니다.',
      'goodPeriods와 cautionPeriods는 시기와 이유, 활용 또는 방어 전략이 함께 드러나야 합니다.',
      'actionAdvice는 3~6개로 작성하고, 한 해를 잘 보내기 위한 실제 행동 힌트를 줍니다.',
      'oneLineSummary는 단정하고 기억에 남게 마무리합니다.',
      ...sectionSpecificInstructions,
      ...buildReportCounselorInstructions(counselorId),
    ].join('\n'),
    input: JSON.stringify(groundedInput, null, 2),
  };
}
