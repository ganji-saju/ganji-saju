import type { SajuLifetimeReport } from '@/domain/saju/report/lifetime-types';
import {
  buildReportCounselorInstructions,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import type { ReadingRecord } from '@/lib/saju/readings';

export const SAJU_LIFETIME_INTERPRETATION_PROMPT_VERSION = 'saju-lifetime-interpret-v1';

export type SajuLifetimeAiSectionKey =
  | 'coreIdentity'
  | 'strengthBalance'
  | 'patternAndYongsin'
  | 'relationshipPattern'
  | 'wealthStyle'
  | 'careerDirection'
  | 'healthRhythm'
  | 'majorLuckTimeline'
  | 'lifetimeStrategy';

export interface SajuLifetimeAiInterpretation {
  opening: string;
  keywords: string[];
  lifetimeRule: string;
  sections: Record<SajuLifetimeAiSectionKey, string>;
  rememberRules: string[];
  oneLineSummary: string;
}

export interface ParsedSajuLifetimeAiInterpretation {
  ok: boolean;
  interpretation: SajuLifetimeAiInterpretation;
  errorMessage: string | null;
}

const SECTION_ORDER: Array<{ key: SajuLifetimeAiSectionKey; label: string }> = [
  { key: 'coreIdentity', label: '타고난 성향' },
  { key: 'strengthBalance', label: '기운의 균형' },
  { key: 'patternAndYongsin', label: '역할과 보완 힌트' },
  { key: 'relationshipPattern', label: '관계 패턴' },
  { key: 'wealthStyle', label: '재물 감각' },
  { key: 'careerDirection', label: '직업 방향' },
  { key: 'healthRhythm', label: '건강 리듬' },
  { key: 'majorLuckTimeline', label: '10년 단위 큰 흐름' },
  { key: 'lifetimeStrategy', label: '평생 활용 전략' },
];

const MAX_OPENING_LENGTH = 1500;
const MAX_KEYWORD_LENGTH = 180;
const MAX_RULE_LENGTH = 420;
const MAX_SECTION_LENGTH = 1800;
const MAX_REMEMBER_LENGTH = 220;
const MAX_SUMMARY_LENGTH = 220;

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return simplifySajuCopy(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
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

function normalizeSectionMap(value: unknown) {
  if (!value || typeof value !== 'object') return null;

  const row = value as Record<string, unknown>;
  const sections = SECTION_ORDER.reduce((acc, entry) => {
    acc[entry.key] = cleanText(row[entry.key], MAX_SECTION_LENGTH);
    return acc;
  }, {} as Record<SajuLifetimeAiSectionKey, string>);

  return SECTION_ORDER.every((entry) => sections[entry.key].length > 0)
    ? sections
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

function renderBulletLines(lines: string[]) {
  return lines.map((line) => `- ${simplifySajuCopy(line)}`).join('\n');
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

function buildSectionFallback(
  report: SajuLifetimeReport,
  key: SajuLifetimeAiSectionKey,
  counselorId: MoonlightCounselorId
) {
  const prefix =
    counselorId === 'male' ? '핵심부터 보면' : '차분히 흐름을 읽어보면';

  switch (key) {
    case 'coreIdentity':
      return [
        `${prefix} ${report.coreIdentity.summary}`,
        report.coreIdentity.reactionStyle,
        report.coreIdentity.bestEnvironment,
        report.coreIdentity.weakPattern,
      ].join(' ');
    case 'strengthBalance':
      return [
        `${prefix} ${report.strengthBalance.summary}`,
        report.strengthBalance.strongAxis,
        report.strengthBalance.weakAxis,
        `에너지가 새는 지점은 ${report.strengthBalance.energyDrain}`,
        `회복 힌트는 ${report.strengthBalance.recovery}`,
      ].join(' ');
    case 'patternAndYongsin':
      return [
        `${prefix} ${report.patternAndYongsin.summary}`,
        report.patternAndYongsin.patternRole,
        report.patternAndYongsin.yongsinDirection,
        report.patternAndYongsin.choiceRule,
      ].join(' ');
    case 'relationshipPattern':
      return [
        `${prefix} ${report.relationshipPattern.summary}`,
        report.relationshipPattern.distanceStyle,
        report.relationshipPattern.expressionStyle,
        report.relationshipPattern.conflictTriggers,
        report.relationshipPattern.longevityGuide,
      ].join(' ');
    case 'wealthStyle':
      return [
        `${prefix} ${report.wealthStyle.summary}`,
        report.wealthStyle.earningStyle,
        report.wealthStyle.keepingStyle,
        report.wealthStyle.spendingMistakes,
        report.wealthStyle.operatingStyle,
      ].join(' ');
    case 'careerDirection':
      return [
        `${prefix} ${report.careerDirection.summary}`,
        report.careerDirection.fitStructure,
        report.careerDirection.endureVsShine,
        report.careerDirection.independenceStyle,
        report.careerDirection.recognitionStyle,
      ].join(' ');
    case 'healthRhythm':
      return [
        `${prefix} ${report.healthRhythm.summary}`,
        report.healthRhythm.warningSignals,
        report.healthRhythm.recoveryRoutine,
        report.healthRhythm.habitPoints.join(' '),
      ].join(' ');
    case 'majorLuckTimeline':
      return [
        `${prefix} ${report.majorLuckTimeline.summary}`,
        report.majorLuckTimeline.currentMeaning,
        ...report.majorLuckTimeline.cycles
          .slice(0, 3)
          .map((cycle) => `${cycle.ageLabel} ${cycle.ganzi} 흐름은 ${cycle.phase} 쪽으로 읽고 ${cycle.summary}`),
      ].join(' ');
    case 'lifetimeStrategy':
      return [
        `${prefix} ${report.lifetimeStrategy.summary}`,
        `좋을 때는 ${report.lifetimeStrategy.useWhenStrong.join(' ')}`,
        `흔들릴 때는 ${report.lifetimeStrategy.defendWhenShaken.join(' ')}`,
      ].join(' ');
  }
}

export function getLifetimeInterpretationPromptVersion(
  counselorId: MoonlightCounselorId
) {
  return `${SAJU_LIFETIME_INTERPRETATION_PROMPT_VERSION}-${counselorId}`;
}

export function buildFallbackLifetimeInterpretation(
  report: SajuLifetimeReport,
  counselorId: MoonlightCounselorId = 'female'
): SajuLifetimeAiInterpretation {
  const fallback = {
    opening:
      counselorId === 'male'
        ? `${report.targetYear}년 흐름을 곁에 두고 보더라도, 이 사주는 먼저 자기 원칙을 세우고 그 위에서 사람과 돈과 일을 조율할 때 가장 안정적입니다. ${report.cover.oneLineSummary}`
        : `${report.targetYear}년의 흐름을 곁에 두고 읽어도, 이 사주의 큰 결은 쉽게 바뀌지 않습니다. ${report.cover.oneLineSummary}`,
    keywords: report.cover.keywords.map((item) => `${item.label}: ${item.reason}`).slice(0, 5),
    lifetimeRule: report.cover.lifetimeRule,
    sections: SECTION_ORDER.reduce((acc, entry) => {
      acc[entry.key] = buildSectionFallback(report, entry.key, counselorId);
      return acc;
    }, {} as Record<SajuLifetimeAiSectionKey, string>),
    rememberRules: report.lifetimeStrategy.rememberRules.slice(0, 5),
    oneLineSummary: report.cover.oneLineSummary,
  };

  return normalizeLifetimeInterpretation(fallback);
}

function normalizeLifetimeInterpretation(
  interpretation: SajuLifetimeAiInterpretation
): SajuLifetimeAiInterpretation {
  return {
    opening: cleanText(interpretation.opening, MAX_OPENING_LENGTH),
    keywords: interpretation.keywords.map((item) => cleanText(item, MAX_KEYWORD_LENGTH)).filter(Boolean).slice(0, 5),
    lifetimeRule: cleanText(interpretation.lifetimeRule, MAX_RULE_LENGTH),
    sections: SECTION_ORDER.reduce((acc, entry) => {
      acc[entry.key] = cleanText(interpretation.sections[entry.key], MAX_SECTION_LENGTH);
      return acc;
    }, {} as Record<SajuLifetimeAiSectionKey, string>),
    rememberRules: interpretation.rememberRules
      .map((item) => cleanText(item, MAX_REMEMBER_LENGTH))
      .filter(Boolean)
      .slice(0, 5),
    oneLineSummary: cleanText(interpretation.oneLineSummary, MAX_SUMMARY_LENGTH),
  };
}

export function parseLifetimeInterpretationText(
  text: string,
  fallback: SajuLifetimeAiInterpretation
): ParsedSajuLifetimeAiInterpretation {
  try {
    const parsed = JSON.parse(extractJsonCandidate(text)) as Record<string, unknown>;
    const opening = cleanText(parsed.opening, MAX_OPENING_LENGTH);
    const keywords = normalizeStringArray(parsed.keywords, MAX_KEYWORD_LENGTH, 3, 5);
    const lifetimeRule = cleanText(parsed.lifetimeRule, MAX_RULE_LENGTH);
    const sections = normalizeSectionMap(parsed.sections);
    const rememberRules = normalizeStringArray(parsed.rememberRules, MAX_REMEMBER_LENGTH, 5, 6);
    const oneLineSummary = cleanText(parsed.oneLineSummary, MAX_SUMMARY_LENGTH);

    if (
      !opening ||
      keywords.length < 3 ||
      !lifetimeRule ||
      !sections ||
      rememberRules.length < 5 ||
      !oneLineSummary
    ) {
      return {
        ok: false,
        interpretation: fallback,
        errorMessage: 'Lifetime AI JSON is missing required sections.',
      };
    }

    return {
      ok: true,
      interpretation: normalizeLifetimeInterpretation({
        opening,
        keywords: keywords.slice(0, 5),
        lifetimeRule,
        sections,
        rememberRules: rememberRules.slice(0, 5),
        oneLineSummary,
      }),
      errorMessage: null,
    };
  } catch (error) {
    return {
      ok: false,
      interpretation: fallback,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Lifetime AI interpretation JSON could not be parsed.',
    };
  }
}

export function renderLifetimeInterpretationReport(
  interpretation: SajuLifetimeAiInterpretation,
  report: SajuLifetimeReport
) {
  return [
    interpretation.opening,
    '## 핵심 키워드',
    interpretation.keywords.map(formatKeywordLine).join('\n\n'),
    '## 이 사주의 평생 힌트',
    interpretation.lifetimeRule,
    ...SECTION_ORDER.flatMap((entry) => [
      `## ${entry.label}`,
      ensureParagraph(interpretation.sections[entry.key], ''),
    ]),
    '## 평생 반복해서 기억할 것 5개',
    renderBulletLines(interpretation.rememberRules),
    '## 부록: 올해 요약',
    `**${report.yearlyAppendix.yearLabel} · ${report.yearlyAppendix.yearGanji}**`,
    report.yearlyAppendix.oneLineSummary,
    '### 상반기',
    report.yearlyAppendix.firstHalf,
    '### 하반기',
    report.yearlyAppendix.secondHalf,
    '### 잘 풀리는 시기',
    renderBulletLines(report.yearlyAppendix.goodPeriods),
    '### 조심할 시기',
    renderBulletLines(report.yearlyAppendix.cautionPeriods),
    '## 깊은 사주풀이 한 줄 총정리',
    `**${interpretation.oneLineSummary}**`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function createGrounding(
  record: ReadingRecord,
  report: SajuLifetimeReport,
  counselorId: MoonlightCounselorId
) {
  const data = record.sajuData;

  return {
    counselor: {
      id: counselorId,
    },
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
    strength: data.strength,
    pattern: data.pattern,
    yongsin: data.yongsin,
    currentLuck: data.currentLuck,
    majorLuck: data.majorLuck,
    factJson: record.grounding.factJson,
    evidenceJson: record.grounding.evidenceJson,
    kasiComparison: record.kasiComparison,
    lifetimeEvidence: report,
  };
}

export function createLifetimeInterpretationPrompt(
  record: ReadingRecord,
  report: SajuLifetimeReport,
  counselorId: MoonlightCounselorId,
  recentFeedbackSummary?: string | null
) {
  const counselorInstructions = buildReportCounselorInstructions(counselorId).join('\n');

  return {
    instructions: [
      '너는 한국 운세 서비스를 쓰는 일반 사용자가 이해하기 쉽게 평생 사주풀이를 정리하는 생활 조언 에디터이다.',
      '이 리포트는 사주 공부 자료가 아니라 사용자가 자기 성향과 선택 습관을 쉽게 이해하도록 돕는 깊은 사주풀이다.',
      counselorInstructions,
      '반드시 JSON만 반환한다. markdown, 코드블록, 설명 문장은 금지한다.',
      '출력 JSON 형식:',
      '{',
      '  "opening": string,',
      '  "keywords": string[3..5],',
      '  "lifetimeRule": string,',
      '  "sections": {',
      '    "coreIdentity": string,',
      '    "strengthBalance": string,',
      '    "patternAndYongsin": string,',
      '    "relationshipPattern": string,',
      '    "wealthStyle": string,',
      '    "careerDirection": string,',
      '    "healthRhythm": string,',
      '    "majorLuckTimeline": string,',
      '    "lifetimeStrategy": string',
      '  },',
      '  "rememberRules": string[5],',
      '  "oneLineSummary": string',
      '}',
      '규칙:',
      '- 사용자는 명리학을 배우러 온 사람이 아니라 자기 인생의 흐름과 선택을 알고 싶어 한다.',
      '- 격국, 용신, 대운, 세운, 월운, 원국, 명식, factJson, evidenceJson 같은 내부 용어는 본문에 직접 쓰지 않는다. 필요하면 쉬운 생활 언어로만 바꾼다.',
      '- 계산 과정, 기준 설명, 점수 설명을 반복하지 말고 결론, 조심할 패턴, 오늘 할 행동을 먼저 쓴다.',
      '- 올해 운세처럼 쓰지 말고, 평생 반복해서 참고할 풀이처럼 쓴다.',
      '- 과장, 공포 조장, 무조건/반드시/100% 같은 단정 표현은 금지한다.',
      '- recentFeedbackSummary가 있으면 최근 사용자 반응을 참고해 문장의 단정 강도만 조정한다.',
      '- 각 section 문자열은 짧은 문장 여러 개로 이어진 밀도 높은 문단이어야 한다.',
      '- opening은 첫 문단부터 흡입력 있게 쓰되 상담실 톤을 유지한다.',
      '- rememberRules는 실제 생활에 바로 적용 가능한 짧은 기억 문장 5개로 쓴다.',
    ].join('\n'),
    input: JSON.stringify({
      ...createGrounding(record, report, counselorId),
      recentFeedbackSummary: recentFeedbackSummary ?? null,
    }),
  };
}
