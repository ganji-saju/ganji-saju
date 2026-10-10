import { dedupeSentencesDeep } from '@/lib/saju/dedupe-sentences';
import { READING_SCOPE_INSTRUCTIONS, CLASSIC_READING_INSTRUCTIONS, type ClassicReadingGrounding } from '@/server/classics/reading-grounding';
import type { SajuYearlyReport, YearlyCategoryKey } from '@/domain/saju/report/yearly-types';
import {
  buildReportCounselorInstructions,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import { koreanizeGanzi } from '@/lib/saju/terminology';
import type { ReadingRecord } from '@/lib/saju/readings';
import { describeMonthSignals } from '@/domain/saju/report/monthly-signals';
import { buildFallbackMonthlyFlows, MONTHLY_AREA_KEYS, type MonthlyAreaKey } from './yearly-monthly-fallback';

// v11(2026-10-10): 총론에 세운 근거 팩(세운 십성·원국 합충·대운·삼재·귀인). v10: 월별 6항목·월운 근거·2개월 분할 생성. 버전이 바뀌면 기존 구매자도 다음 열람 때 새로 만든다(사용자 결정).
export const SAJU_YEARLY_INTERPRETATION_PROMPT_VERSION = 'saju-yearly-interpret-v11-year-signals';

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
  /** 이달의 총운 */
  summary: string;
  /** 먼저 살펴볼 것 */
  focus?: string;
  /** 조심할 점 */
  caution?: string;
  action?: string;
  /** 2026-10-10 — 분야별 운(재물·일·애정·건강). 옛 캐시에는 없다. */
  areas?: Partial<Record<MonthlyAreaKey, string>>;
  /** 이렇게 해보세요 — 실천 3가지. 옛 캐시에는 없고 action 한 줄만 있다. */
  actions?: string[];
}

// 2026-09-26 — 2027 신년운세 부가 필드. YearlyCategoryKey 를 넓히지 않고 옵셔널로 붙인다 —
//   그 타입은 buildYearlyReport·패널·year-core 경로 전체로 번지고, 부가 필드는 신년운세·평생 구매자에게만 나가야 한다(route 티어).
export const SAJU_NEW_YEAR_EXTRAS_PROMPT_VERSION = 'saju-newyear-extras-v3-rich-reading';
export type NewYearExtraCategory = 'family' | 'study';
export type NewYearHighlightCategory = YearlyCategoryKey | NewYearExtraCategory;

export interface NewYearQuarterFlow {
  quarter: 1 | 2 | 3 | 4;
  months: [number, number, number];
  summary: string;
  focusCategory: NewYearHighlightCategory;
}

export interface NewYearHighlight {
  month: number;
  category: NewYearHighlightCategory;
  text: string;
}

export interface SajuNewYearExtras {
  categories: Record<NewYearExtraCategory, string>;
  quarterlyFlows: NewYearQuarterFlow[];
  expectations: NewYearHighlight[];
  cautions: NewYearHighlight[];
  /** 캐시 행에 붙는 생성 버전 — 올라가면 부가 단계만 다시 만든다(서비스). */
  _version?: string;
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
  newYear?: SajuNewYearExtras;
}

export type SajuYearlyInterpretationPromptSection = 'full' | 'narrative' | 'monthly' | 'newyear';

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
const MAX_CATEGORY_LENGTH = 1600;
const MAX_MONTHLY_LENGTH = 1200;
const MAX_MONTHLY_DETAIL_LENGTH = 700;
const MAX_MONTHLY_AREA_LENGTH = 500;
const MAX_PERIOD_LENGTH = 260;
const MAX_ACTION_LENGTH = 240;
const MAX_SUMMARY_LENGTH = 220;
const MIN_MONTHS = 12;

const NEW_YEAR_HIGHLIGHT_CATEGORIES: NewYearHighlightCategory[] = [...YEARLY_CATEGORY_ORDER, 'family', 'study'];

export const NEW_YEAR_CATEGORY_LABEL: Record<NewYearHighlightCategory, string> = {
  ...YEARLY_CATEGORY_LABEL,
  family: '가족운',
  study: '학업·시험운',
};

const NEW_YEAR_FORBIDDEN_PATTERN = /반드시|무조건|100\s*%|틀림없이|큰\s*병|사고가\s*(?:난다|납니다|날\s*것)/;

const QUARTER_MONTHS: Array<[number, number, number]> = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [10, 11, 12],
];

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return koreanizeGanzi(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function splitSentences(value: string) {
  return koreanizeGanzi(value)
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
    const actions = normalizeStringArray(row.actions, MAX_MONTHLY_DETAIL_LENGTH, 0, 3);
    // 실천 목록이 있으면 action 에 첫 항목을 복사하지 않는다 — 반복 문장 제거가 목록 쪽을 지워 2개만 남았다.
    const action = actions.length ? undefined : cleanText(row.action, MAX_MONTHLY_DETAIL_LENGTH);
    const rawAreas = row.areas && typeof row.areas === 'object' ? row.areas as Record<string, unknown> : {};
    const areas = Object.fromEntries(MONTHLY_AREA_KEYS
      .map((key) => [key, cleanText(rawAreas[key], MAX_MONTHLY_AREA_LENGTH)] as const)
      .filter(([, text]) => text));

    if (!Number.isInteger(month) || month < 1 || month > 12 || !summary) {
      continue;
    }

    flows.push({
      month, summary, focus, caution, action,
      ...(Object.keys(areas).length ? { areas } : {}),
      ...(actions.length ? { actions } : {}),
    });
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

// 2026-09-27 — 기대/조심 목록이 좋은 시기·월별 주의 문장을 그대로 가져와 한 풀이에서 같은 문장이 두 번 나왔다(반복 측정).
//   목록은 그 달의 주제(theme)와 분야로 **자기 문장**을 만든다 — 월별 카드·좋은 시기 문단과 겹치지 않는다.
const HIGHLIGHT_RISE = [
  '내가 직접 이끌 일을 먼저 시작해 보기 좋습니다.',
  '준비한 생각을 말이나 결과물로 꺼내 보기 좋습니다.',
  '손에 잡히는 결과를 챙기고 정산하기 좋습니다.',
  '맡은 책임을 분명히 하고 성과를 보여주기 좋습니다.',
  '배우고 조언을 구해 실력을 채우기 좋습니다.',
];
const HIGHLIGHT_CAUTION = [
  '혼자 밀어붙이기 전에 다른 의견을 한 번 들어 보세요.',
  '말이 앞서지 않게 약속 전에 한 번 더 확인하세요.',
  '이득만 보고 서두르지 말고 조건을 끝까지 읽어 보세요.',
  '책임이 몰리지 않게 할 일의 범위부터 정하세요.',
  '생각만 길어지지 않게 결정할 날짜를 먼저 정하세요.',
];

function highlightText(report: SajuYearlyReport, month: number, tone: 'rise' | 'caution'): string {
  const flow = report.monthlyFlows.find((f) => f.month === month);
  const area = NEW_YEAR_CATEGORY_LABEL[(flow?.relatedAreas[0] ?? (tone === 'rise' ? 'work' : 'health')) as NewYearHighlightCategory];
  const theme = flow?.theme ? `${koreanizeGanzi(flow.theme).replace(/[.。]$/, '')}입니다. ` : '';
  // 그 달과 나의 관계로 행동 문장을 가른다(모두에게 같던 두 문장, 2026-09-28).
  const step = flow?.relationStep;
  if (typeof step === 'number') {
    return `${theme}${month}월에는 ${area} 쪽에서 ${(tone === 'rise' ? HIGHLIGHT_RISE : HIGHLIGHT_CAUTION)[step]}`;
  }
  return tone === 'rise'
    ? `${theme}${month}월에는 ${area} 쪽에서 미뤄 둔 일을 먼저 움직여 보기 좋습니다.`
    : `${theme}${month}월에는 ${area} 쪽 결정을 한 번 더 확인하고 속도를 늦추는 편이 좋습니다.`;
}

function windowHighlights(
  report: SajuYearlyReport,
  windows: SajuYearlyReport['goodPeriods'],
  category: NewYearHighlightCategory,
  tone: 'rise' | 'caution' = 'rise'
): NewYearHighlight[] {
  return windows.flatMap((w) =>
    w.months.slice(0, 1).map((month) => ({
      month,
      // 그 달 흐름이 가리키는 분야가 있으면 그걸 쓴다 — 돈 이야기에 '일' 라벨이 붙지 않게.
      category: report.monthlyFlows.find((f) => f.month === month)?.relatedAreas[0] ?? category,
      text: highlightText(report, month, tone),
    }))
  );
}

// 창(window)에서 3개가 안 나오면 해당 흐름(rise/caution)인 달로 채운다 — 빈 목록을 보여 주지 않는다.
function padHighlights(
  list: NewYearHighlight[],
  report: SajuYearlyReport,
  momentum: 'rise' | 'caution'
): NewYearHighlight[] {
  const out = list
    .filter((h, i) => list.findIndex((o) => o.month === h.month || o.text === h.text) === i)
    .slice(0, 6);
  const pool = [
    ...report.monthlyFlows.filter((f) => f.momentum === momentum),
    ...report.monthlyFlows.filter((f) => f.momentum === 'steady'),
    ...report.monthlyFlows,
  ];
  for (const flow of pool) {
    if (out.length >= 3) break;
    if (out.some((h) => h.month === flow.month)) continue;
    const area = flow.relatedAreas[0] ?? (momentum === 'rise' ? 'work' : 'health');
    const text = highlightText(report, flow.month, momentum);
    if (!text || out.some((h) => h.text === text)) continue;
    out.push({ month: flow.month, category: area, text });
  }
  return out.sort((a, b) => a.month - b.month);
}

const QUARTER_VERB = ['내가 먼저 주도하면', '생각을 먼저 꺼내 보이면', '실속부터 챙기면', '책임을 먼저 정리하면', '먼저 배우고 준비하면'];

function quarterLeadText(flow: SajuYearlyReport['monthlyFlows'][number]) {
  const areas = flow.relatedAreas.map((area) => YEARLY_CATEGORY_LABEL[area]).join('과 ');
  const verb = typeof flow.relationStep === 'number' ? QUARTER_VERB[flow.relationStep] : null;
  return flow.momentum === 'caution'
    ? `${flow.month}월의 ${areas}은 서두르지 말고 한 번 더 확인하는 쪽으로 두세요.`
    : verb
      ? `${flow.month}월에 ${areas} 쪽에서 ${verb} 분기 전체가 수월해집니다.`
      : `${flow.month}월에 ${areas} 쪽을 먼저 움직이면 분기 전체가 수월해집니다.`;
}

export function buildFallbackNewYearExtras(report: SajuYearlyReport): SajuNewYearExtras {
  const byMonth = new Map(report.monthlyFlows.map((f) => [f.month, f]));
  const quarterlyFlows = QUARTER_MONTHS.map((months, i) => {
    const flows = months.map((m) => byMonth.get(m)).filter((f): f is NonNullable<typeof f> => Boolean(f));
    const rising = flows.filter((f) => f.momentum === 'rise').length;
    const caution = flows.filter((f) => f.momentum === 'caution').length;
    // 세 달 중 몇 달이 어떤지까지 말한다(같은 '힘이 붙는 분기' 문장이 거의 모두에게 나왔다).
    const tone =
      rising === 3 ? '세 달 내내 힘이 붙는 분기입니다'
        : rising > caution ? `세 달 중 ${rising}달에 힘이 붙는 분기입니다`
          : caution === 3 ? '세 달 내내 속도를 조절할 분기입니다'
            : caution > rising ? `세 달 중 ${caution}달은 속도를 조절할 분기입니다`
              : '오르내림이 섞여 흐름을 다지는 분기입니다';
    const lead = flows.find((f) => f.momentum === (rising >= caution ? 'rise' : 'caution')) ?? flows[0];
    return {
      quarter: (i + 1) as 1 | 2 | 3 | 4,
      months,
      // 월별 요약 문장을 그대로 가져오면 한 풀이에서 두 번 나온다 — 분기는 이끄는 달과 분야로 자기 문장을 쓴다.
      summary: tightenLine(`${months[0]}~${months[2]}월은 ${tone}. ${lead ? quarterLeadText(lead) : ''}`, 2, 160),
      focusCategory: (lead?.relatedAreas[0] ?? (rising >= caution ? 'work' : 'health')) as NewYearHighlightCategory,
    };
  });
  const rel = report.categories.relationship;
  const work = report.categories.work;
  const move = report.categories.move;
  return dedupeSentencesDeep({
    categories: {
      family: tightenLine(`집안과 가까운 사람 사이에서는 ${rel.summary} ${rel.action}`, 3, 260),
      study: tightenLine(
        // 업무 문단엔 '오늘은…' 같은 하루 단위 조언이 섞여 있어 첫 문장만 쓴다.
        // 행동 조언(actionAdvice)이 useWhenStrong 을 통째로 싣기 때문에 여기서 다시 쓰면 반복이 된다.
        `공부와 자격 준비는 ${tightenLine(work.opportunity, 1, 120)} ${move.opportunity}`,
        3,
        260
      ),
    },
    quarterlyFlows,
    expectations: padHighlights(windowHighlights(report, report.goodPeriods, 'work'), report, 'rise'),
    cautions: padHighlights(windowHighlights(report, report.cautionPeriods, 'health', 'caution'), report, 'caution'),
  });
}

export function parseNewYearExtrasText(
  text: string,
  fallback: SajuNewYearExtras
): { ok: boolean; extras: SajuNewYearExtras; errorMessage: string | null } {
  const fail = (errorMessage: string) => ({ ok: false, extras: fallback, errorMessage });
  try {
    const parsed = JSON.parse(extractJsonCandidate(text)) as Record<string, unknown>;
    const cats = (parsed.categories ?? {}) as Record<string, unknown>;
    const family = cleanText(cats.family, MAX_CATEGORY_LENGTH);
    const study = cleanText(cats.study, MAX_CATEGORY_LENGTH);
    const isCategory = (v: unknown): v is NewYearHighlightCategory =>
      NEW_YEAR_HIGHLIGHT_CATEGORIES.includes(v as NewYearHighlightCategory);
    const quarters = Array.isArray(parsed.quarterlyFlows) ? parsed.quarterlyFlows : [];
    const quarterlyFlows = QUARTER_MONTHS.map((months, i) => {
      const row = quarters.find(
        (q) => Number((q as { quarter?: unknown } | null)?.quarter) === i + 1
      ) as Record<string, unknown> | undefined;
      const summary = cleanText(row?.summary, MAX_PERIOD_LENGTH);
      if (!summary) return null;
      const focus = row?.focusCategory;
      return {
        quarter: (i + 1) as 1 | 2 | 3 | 4,
        months,
        summary,
        focusCategory: isCategory(focus) ? focus : ('work' as NewYearHighlightCategory),
      };
    });
    const highlights = (value: unknown) =>
      (Array.isArray(value) ? value : [])
        .map((item) => {
          const row = (item ?? {}) as Record<string, unknown>;
          const month = typeof row.month === 'number' ? row.month : Number.parseInt(String(row.month), 10);
          const textValue = cleanText(row.text, MAX_PERIOD_LENGTH);
          return Number.isInteger(month) && month >= 1 && month <= 12 && isCategory(row.category) && textValue
            ? { month, category: row.category, text: textValue }
            : null;
        })
        .filter((h): h is NewYearHighlight => h !== null)
        .slice(0, 6);
    const expectations = highlights(parsed.expectations);
    const cautions = highlights(parsed.cautions);
    if (!family || !study || quarterlyFlows.some((q) => q === null) || expectations.length < 3 || cautions.length < 3) {
      return fail('New-year extras JSON is missing required sections.');
    }
    // 결제자 화면·PDF 에 그대로 나가는 문구다. 프롬프트가 금지한 단정·공포 표현만 좁게 본다
    //   (넓은 부분일치 금지어는 멀쩡한 풀이까지 버려 재시도 비용만 태운다 — total_review 검증기 교훈).
    const allText = [family, study, ...quarterlyFlows.map((q) => q!.summary), ...expectations.map((h) => h.text), ...cautions.map((h) => h.text)].join('\n');
    if (NEW_YEAR_FORBIDDEN_PATTERN.test(allText)) {
      return fail('New-year extras contain absolute or fear-inducing phrasing.');
    }
    return {
      ok: true,
      extras: {
        categories: { family, study },
        quarterlyFlows: quarterlyFlows as NewYearQuarterFlow[],
        expectations,
        cautions,
      },
      errorMessage: null,
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'New-year extras JSON could not be parsed.');
  }
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
  // 그해와 나의 관계로 첫 문장을 가른다(고정 첫 문장은 모두에게 같았다).
  const theme = report.annualContext.yearTheme;
  const introPrefix =
    counselorId === 'male'
      ? theme ? `${report.year}년은 결론부터 보면 ${theme}입니다.` : `${report.year}년은 결론부터 보면 방향을 먼저 세우는 해입니다.`
      : theme ? `${report.year}년은 ${theme}입니다.` : `${report.year}년은 한 해의 흐름이 서서히 드러나는 해입니다.`;
  const keywords = report.coreKeywords
    .map((item) => `${item.label}: ${item.reason}`)
    .slice(0, 5);
  const categories = YEARLY_CATEGORY_ORDER.reduce((acc, key) => {
    acc[key] = buildCategoryFallback(report, key, counselorId);
    return acc;
  }, {} as Record<YearlyCategoryKey, string>);
  // 2026-10-10 — 예전엔 1문장 88자로 잘라 월별이 두 줄뿐이었다. 6항목을 월운 근거로 채운다.
  const monthlyFlows = buildFallbackMonthlyFlows(report.monthlyFlows);
  const actionAdvice = [
    ...report.actionGuide.useWhenStrong,
    ...report.actionGuide.defendWhenWeak,
  ].slice(0, 6);

  return dedupeSentencesDeep({
    opening: [
      introPrefix,
      ...(report.yearSignals?.summary ?? []),
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
  });
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
  fallback: SajuYearlyAiMonthlyFlow[],
  /** 분할 생성일 때 이번 호출이 맡은 달. 기본은 12개월 전체. */
  expectedMonths?: number[]
): ParsedSajuYearlyAiMonthlyFlows {
  try {
    const parsed = JSON.parse(extractJsonCandidate(text)) as Record<string, unknown>;
    const all = normalizeMonthlyFlows(parsed.monthlyFlows ?? parsed);

    if (expectedMonths) {
      const monthlyFlows = all.filter((flow) => expectedMonths.includes(flow.month));
      return monthlyFlows.length === expectedMonths.length
        ? { ok: true, monthlyFlows, errorMessage: null }
        : { ok: false, monthlyFlows: fallback, errorMessage: 'Yearly AI monthly JSON is missing one or more months.' };
    }
    const monthlyFlows = all;

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
  // Stored readings can have been calculated in another year. Timing comes
  // only from the target-year report, not the saved daily/monthly snapshot.
  const { luckCycles: _savedCycles, ...natalFacts } = record.grounding.factJson;
  const { luckFlow: _savedFlow, ...natalEvidence } = record.grounding.evidenceJson;
  const { currentLuck: _savedLuck, promptFacts: _savedBrief, ...personalization } = record.grounding.personalizationContext;
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
      hour: data.input.hourKnown ? serializePillar(data.pillars.hour) : null,
    },
    dayMaster: data.dayMaster,
    fiveElements: data.fiveElements,
    tenGods: data.tenGods,
    strength: data.strength,
    pattern: data.pattern,
    yongsin: data.yongsin,
    annualTiming: report.annualContext,
    personalizationContext: personalization,
    factJson: { ...natalFacts, pillars: { ...natalFacts.pillars, hour: data.input.hourKnown ? natalFacts.pillars.hour : null } },
    evidenceJson: natalEvidence,
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
      // 2026-10-10 — 세운 십성·원국 합충·용신 적합·대운 관계·삼재·귀인 달(쉬운 문장 summary 포함).
      yearSignals: report.yearSignals ?? null,
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
  counselorId: MoonlightCounselorId,
  months?: number[]
) {
  const flows = months ? report.monthlyFlows.filter((flow) => months.includes(flow.month)) : report.monthlyFlows;
  return {
    ...createSharedGrounding(record, report, counselorId),
    yearlyEvidence: {
      computation: report.computation,
      annualContext: report.annualContext,
      // 2026-10-10 — 월운 근거(십성·원국 합충·용신 적합·절기 기간)를 쉬운 문장과 함께 넘긴다.
      monthlyFlows: flows.map((flow) => ({
        ...flow,
        signalSummary: flow.signals
          ? describeMonthSignals(flow.signals, flow.monthlyGanji ? koreanizeGanzi(flow.monthlyGanji) : null)
          : [],
      })),
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
  recentFeedbackSummary?: string | null,
  classicGrounding?: ClassicReadingGrounding,
  options: { months?: number[] } = {}
) {
  const grounding =
    section === 'monthly'
      ? createMonthlyGrounding(record, report, counselorId, options.months)
      : section === 'newyear'
        ? (() => {
            const narrative = createNarrativeGrounding(record, report, counselorId);
            return { ...narrative, yearlyEvidence: { ...narrative.yearlyEvidence, monthlyFlows: report.monthlyFlows } };
          })()
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
    classicGrounding: classicGrounding ?? null,
    recentFeedbackSummary: recentFeedbackSummary ?? null,
  };

  const schemaLine =
    section === 'newyear'
      ? '{"categories":{"family":"가족운 6~9문장","study":"학업·시험운 6~9문장"},"quarterlyFlows":[{"quarter":1,"summary":"1~3월 요약","focusCategory":"wealth"},{"quarter":2,"summary":"4~6월 요약","focusCategory":"work"},{"quarter":3,"summary":"7~9월 요약","focusCategory":"love"},{"quarter":4,"summary":"10~12월 요약","focusCategory":"family"}],"expectations":[{"month":5,"category":"wealth","text":"기대할 일 한 문장"},"...3~6개"],"cautions":[{"month":8,"category":"health","text":"조심할 일 한 문장"},"...3~6개"]}'
      : section === 'monthly'
      ? `{"monthlyFlows":[${'{"month":1,"summary":"이달의 총운 4~6문장","areas":{"wealth":"재물 2~3문장","work":"일·직업 2~3문장","love":"애정·관계 2~3문장","health":"건강 2~3문장"},"focus":"먼저 살펴볼 것 3~4문장","caution":"조심할 점 3~4문장","actions":["실천 1","실천 2","실천 3"]}'}, ...맡은 달마다 한 개]}`
      : section === 'narrative'
        ? '{"opening":"첫 문단 장문","keywords":["키워드: 설명","..."],"firstHalf":"상반기 장문","secondHalf":"하반기 장문","categories":{"work":"일·직업운 장문","wealth":"재물운 장문","love":"연애·결혼운 장문","relationship":"인간관계운 장문","health":"건강운 장문","move":"이동·변화운 장문"},"goodPeriods":["좋은 시기 설명","..."],"cautionPeriods":["주의 시기 설명","..."],"actionAdvice":["행동 조언","..."],"oneLineSummary":"마지막 한 줄 요약"}'
        : '{"opening":"첫 문단 장문","keywords":["키워드: 설명","..."],"firstHalf":"상반기 장문","secondHalf":"하반기 장문","categories":{"work":"일·직업운 장문","wealth":"재물운 장문","love":"연애·결혼운 장문","relationship":"인간관계운 장문","health":"건강운 장문","move":"이동·변화운 장문"},"monthlyFlows":[{"month":1,"summary":"1월 핵심 장면","focus":"먼저 볼 질문과 기회","caution":"조심할 장면","action":"해당 달의 선택 기준"},...,{"month":12,"summary":"12월 핵심 장면","focus":"먼저 볼 질문과 기회","caution":"조심할 장면","action":"해당 달의 선택 기준"}],"goodPeriods":["좋은 시기 설명","..."],"cautionPeriods":["주의 시기 설명","..."],"actionAdvice":["행동 조언","..."],"oneLineSummary":"마지막 한 줄 요약"}';

  const sectionSpecificInstructions =
    section === 'newyear'
      ? [
          '이번 응답에서는 categories(family, study), quarterlyFlows, expectations, cautions 만 작성합니다. 다른 키는 출력하지 않습니다.',
          'family 는 본인 사주로 본 부모·배우자·자녀·집안 관계의 올해 흐름입니다. 가족의 생년월일은 없으므로 가족 개인의 운을 단정하지 않습니다.',
          'study 는 공부·자격증·시험·배움의 올해 흐름입니다. 합격이나 불합격을 단정하지 않습니다.',
          'quarterlyFlows 는 1~4분기를 모두 채우고, 월별 흐름의 momentum 을 근거로 분기의 성격과 가장 먼저 볼 분야(focusCategory)를 고릅니다.',
          'expectations 와 cautions 는 각각 3~6개이며 모두 month(1~12)와 category(work, wealth, love, relationship, health, move, family, study 중 하나)를 붙입니다. "언제, 어느 분야에서, 무엇을" 이 한 문장에 보이게 씁니다.',
          '건강은 생활 습관과 컨디션 관리 수준으로만 말하고 질병 진단이나 치료 권유를 하지 않습니다.',
        ]
      : section === 'monthly'
      ? [
          '이번 응답에서는 monthlyFlows만 작성합니다.',
          'monthlyFlows 외의 키는 출력하지 않습니다.',
          options.months
            ? `이번 응답은 ${options.months.join('·')}월만 맡습니다. yearlyEvidence.monthlyFlows 에 있는 달을 모두 채우고 다른 달은 쓰지 않습니다.`
            : '1월부터 12월까지 반드시 모두 채웁니다.',
          '결제한 사용자가 한 달을 A4 한 쪽 분량으로 읽는 상세 풀이입니다. 한 달에 1,000~1,400자를 목표로 하고, 아래 분량을 지킵니다.',
          'summary(이달의 총운)는 4~6문장입니다. 첫 문장에 그 달의 성격을 말하고, signalSummary 의 근거(그 달 기운의 십성, 원국 글자와의 합·충, 용신 해당 여부)를 생활 장면으로 풀어 연결합니다. 명리 용어는 첫 등장에 짧게 풀어 줍니다.',
          'areas 는 wealth(재물), work(일·직업), love(애정·관계), health(건강) 네 개를 모두 채우고 각 2~3문장입니다. relatedAreas 에 있는 분야는 더 구체적으로, 나머지는 그 달 근거에서 이어지는 한 장면으로 씁니다.',
          'focus(먼저 살펴볼 것)와 caution(조심할 점)은 각각 3~4문장입니다. natalRelations 에 충·형·원진이 있으면 그 자리(palace)가 뜻하는 영역을 caution 에서 짚고, 합이 있으면 focus 에서 짚습니다. 사건을 단정하지 말고 "~하는 일이 생기면"처럼 조건으로 엽니다.',
          'actions(이렇게 해보세요)는 정확히 3개이며, 각 항목은 그 달 안에 바로 할 수 있는 구체적 행동 한 문장입니다(언제·무엇을·어떻게).',
          '건강은 생활 습관과 컨디션 관리 수준으로만 말하고 질병 진단이나 치료 권유를 하지 않습니다.',
          '달마다 첫 문장 구조와 결론을 바꾸고, 다른 달과 같은 문장을 쓰지 않습니다.',
          '날짜는 signals.period(절기 기준 기간)에 있는 날짜만 씁니다. 그 밖의 특정 날짜(예: "22일 전후")는 지어내지 않습니다.',
          '명리 용어(십성 이름·격국·용신·신강/신약 등)는 한 달에 두세 개까지만 쓰고 바로 쉬운 말로 풀어 줍니다. "원국"은 "타고난 사주"로, 기둥 이름(연주·시주 등)은 그 자리의 뜻(집안 어른·앞으로의 계획 등)으로 씁니다.',
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
      '결과물은 돈을 내고 읽는 상세 풀이입니다. 근거 없이 늘이지 말되, 항목마다 요구한 분량을 채워 이 사람에게만 해당하는 내용을 충분히 설명합니다.',
      '사용자는 명리학을 배우러 온 사람이 아니라 올해 무엇을 조심하고 어떻게 움직일지 알고 싶어 합니다.',
      '과장, 희망고문, 공포 조장, 운명을 단정하는 말은 피합니다.',
      '무조건, 반드시, 100% 같은 단정 문구는 쓰지 않습니다.',
      'recentFeedbackSummary가 있으면 최근 실제 반응을 참고해 말 강도만 미세 조정하고, 계산 설명보다 사용자 체감을 앞세웁니다.',
      CLASSIC_READING_INSTRUCTIONS,
      READING_SCOPE_INSTRUCTIONS.yearly,
      '격국·용신·대운·세운 등 근거의 한글 명리 용어는 유지하고 첫 등장에 짧게 설명합니다. factJson·evidenceJson 같은 구현 용어와 한자는 본문에 쓰지 않습니다.',
      '"원국"은 "타고난 사주"로, 기둥 이름(연주·월주·일주·시주)은 그 자리의 뜻(집안 어른·부모와 직장·나와 배우자·앞으로의 계획)으로 바꿔 씁니다.',
      '연애, 일, 재물, 관계, 건강, 이동의 질문에 답한 뒤, 해당 연도와 원국의 어떤 관계에서 나온 해석인지 연결하고 적용 조건을 설명합니다.',
      '[밀착 개인화] 성향이나 흐름을 형용사로 요약하지 말고 그 흐름이 드러나는 구체적 장면으로 보여줍니다. "대인관계 운이 좋아요"(요약·일반론) ❌ → "먼저 연락하기 어색한 사람이 있다면, 연락할 목적과 상대가 답할 여유를 먼저 확인해보세요"(장면) ⭕. 열 사람 중 아홉에게 맞는 말은 쓰지 않고, 이 사주 데이터에서 나온 이 사람만의 장면을 짚습니다. 단, 없는 사실·사건(구체적 직업·관계·일화)은 지어내지 말고, 일어날 수 있는 장면은 "~한 사람이 있다면", "~하는 일이 생기면"처럼 조건으로 엽니다.',
      '읽기 쉽게 씁니다. 각 항목은 판단을 먼저 말하고 근거와 장면을 이어 붙이며, 같은 접속어와 같은 결론 구조를 반복하지 않습니다.',
      '응답은 반드시 JSON 객체 하나만 반환합니다. Markdown, 설명 문장, 코드블록을 붙이지 않습니다.',
      'JSON 스키마:',
      schemaLine,
      'opening은 제목 없이 바로 시작되는 첫 문단이며, 흡입력 있게 시작해야 합니다. 8~10문장(700~1,000자)으로, yearlyEvidence.yearSignals 의 근거(올해 기운이 나에게 어떤 자리인지, 타고난 사주의 어느 자리와 맞물리거나 부딪히는지, 필요한 기운인지, 지금 대운과의 관계)를 생활 장면으로 풀어 한 해의 큰 그림을 그립니다.',
      'yearSignals.samjae 가 있으면 opening 이나 cautionPeriods 에서 한 번만 다루고, "옛 풍습으로 보는 조심할 때"라는 뜻으로만 씁니다. 불행·사고를 예고하지 않습니다. yearSignals.gwiinMonths 가 있으면 goodPeriods 에서 "도움을 청하기 좋은 달"로 연결합니다. 행운 색·숫자·방향은 본문에서 다루지 않습니다(화면이 따로 보여 줌).',
      'keywords는 3~5개입니다. 각 항목은 한 해의 핵심 키워드와 그 이유를 함께 담습니다.',
      'firstHalf와 secondHalf는 각각 5~7문장으로 근거와 대비되는 상황을 설명하고, 기회와 리스크와 첫 행동이 겹치지 않게 나눕니다.',
      'categories의 6개 분야는 각 분야마다 "질문의 답 / 확인된 연간 근거 / 유리한 조건과 부담 조건 / 생활 선택"을 7~10개의 짧은 문장(400~650자 목표)으로 설명합니다. 분야마다 다른 근거와 장면을 사용하고 근거가 없으면 보류합니다.',
      'monthlyFlows는 1월부터 12월까지 서로 다른 질문을 던져야 합니다. 같은 문장 구조, 같은 도입, 같은 결론을 반복하지 않습니다.',
      'monthlyFlows는 사용자가 실제로 궁금해하는 선택 장면, 돈과 일의 판단, 관계 조율, 달력에 표시해 둘 만한 포인트를 우선해서 씁니다.',
      'monthlyFlows는 체감 가능한 변화 중심으로 쓰고, 그 달의 근거와 선택 기준이 함께 보이게 씁니다. 한 달 설명을 장문 단락 하나로 늘리지 않습니다.',
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
