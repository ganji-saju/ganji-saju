import { CLASSIC_READING_INSTRUCTIONS, type ClassicReadingGrounding } from '@/server/classics/reading-grounding';
import type { SajuLifetimeReport } from '@/domain/saju/report/lifetime-types';
import { getLifetimeCalendarLuck } from '@/domain/saju/report/build-lifetime-report';
import {
  buildReportCounselorInstructions,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import { koreanizeGanzi } from '@/lib/saju/terminology';
import type { ReadingRecord } from '@/lib/saju/readings';

export const SAJU_LIFETIME_INTERPRETATION_PROMPT_VERSION = 'saju-lifetime-interpret-v2-questions';

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
const CORE_SECTION_KEYS = ['wealthStyle', 'careerDirection', 'relationshipPattern'] as const;

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  // Preserve distinctions such as 정관/편관 and explanations of 신강/신약.
  // The legacy public-copy simplifier replaces or removes that natal evidence.
  return koreanizeGanzi(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
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
  return lines.map((line) => `- ${koreanizeGanzi(line)}`).join('\n');
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

// 2026-05-23: 챕터 본문 조립 시 동일 문장이 두 번 들어가던 버그(반복) 차단.
//   각 파트를 문장 단위로 분해해 정규화 키로 중복을 제거한 뒤 다시 합친다.
function joinDistinctSentences(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const part of parts) {
    if (!part) continue;
    const sentences = part
      .replace(/\s+/g, ' ')
      .trim()
      .split(/(?<=[.!?。])\s+/u)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      const normalized = sentence.replace(/[\s.!?。]/gu, '');
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      kept.push(sentence);
    }
  }

  return kept.join(' ');
}

/** 조각 목록을 문장으로 잇는다. 공백으로만 이으면 '혼자 짊어지는 일 줄이기 결정 전 한 번
 *  더 조율하기 …' 처럼 끊긴 조각이 줄줄이 붙어 문장으로 읽히지 않는다(PDF 9장 실측). */
function joinPhrases(items: string[]): string {
  const kept = items.map((item) => item.trim().replace(/[.]$/, '')).filter(Boolean);
  if (kept.length === 0) return '';
  if (kept.length === 1) return `${kept[0]}입니다.`;
  return `${kept.slice(0, -1).join(', ')}, 그리고 ${kept[kept.length - 1]}입니다.`;
}

function buildSectionFallback(
  report: SajuLifetimeReport,
  key: SajuLifetimeAiSectionKey,
  counselorId: MoonlightCounselorId
) {
  // 2026-08-30 — 이 말머리를 9개 섹션 **전부**에 붙이고 있었다. PDF 9장을 뽑아 보면
  //   "차분히 흐름을 읽어보면"이 아홉 번 연달아 나와 고장 난 레코드처럼 읽힌다.
  //   섹션 리드를 강조하는 새 레이아웃에서는 그 반복이 첫 글자 자리에 그대로 박혀 더 두드러진다.
  //   → 상담사 말투는 **첫 섹션에서 한 번만** 세운다. 나머지는 본문 요약으로 바로 들어간다.
  const isFirstSection = key === 'coreIdentity';
  const prefix = !isFirstSection
    ? ''
    : counselorId === 'male'
      ? '핵심부터 보면'
      : '차분히 흐름을 읽어보면';

  /** 말머리를 붙인다. prefix 가 비면 앞 공백이 남지 않게. */
  const withOpener = (sentence: string): string =>
    prefix ? `${prefix} ${sentence}` : sentence;

  switch (key) {
    case 'coreIdentity':
      return [
        withOpener(report.coreIdentity.summary),
        report.coreIdentity.reactionStyle,
        report.coreIdentity.bestEnvironment,
        report.coreIdentity.weakPattern,
      ].join(' ');
    case 'strengthBalance':
      return [
        withOpener(report.strengthBalance.summary),
        report.strengthBalance.strongAxis,
        report.strengthBalance.weakAxis,
        `에너지가 새는 지점은 ${report.strengthBalance.energyDrain}`,
        `회복 힌트는 ${report.strengthBalance.recovery}`,
      ].join(' ');
    case 'patternAndYongsin':
      // 2026-05-23: summary·patternRole·yongsinDirection 중 동일 문장이 겹쳐
      //   노출되던 버그(반복) 차단 — 문장 단위 중복 제거 후 합친다.
      return joinDistinctSentences([
        withOpener(report.patternAndYongsin.summary),
        report.patternAndYongsin.patternRole,
        report.patternAndYongsin.yongsinDirection,
        report.patternAndYongsin.choiceRule,
      ]);
    case 'relationshipPattern':
      return [
        withOpener(report.relationshipPattern.summary),
        report.relationshipPattern.distanceStyle,
        report.relationshipPattern.expressionStyle,
        report.relationshipPattern.conflictTriggers,
        report.relationshipPattern.longevityGuide,
      ].join(' ');
    case 'wealthStyle':
      return [
        withOpener(report.wealthStyle.summary),
        report.wealthStyle.earningStyle,
        report.wealthStyle.keepingStyle,
        report.wealthStyle.spendingMistakes,
        report.wealthStyle.operatingStyle,
      ].join(' ');
    case 'careerDirection':
      return [
        withOpener(report.careerDirection.summary),
        report.careerDirection.fitStructure,
        report.careerDirection.endureVsShine,
        report.careerDirection.independenceStyle,
        report.careerDirection.recognitionStyle,
      ].join(' ');
    case 'healthRhythm':
      return [
        withOpener(report.healthRhythm.summary),
        report.healthRhythm.warningSignals,
        report.healthRhythm.recoveryRoutine,
        joinPhrases(report.healthRhythm.habitPoints),
      ].join(' ');
    case 'majorLuckTimeline':
      return [
        withOpener(report.majorLuckTimeline.summary),
        report.majorLuckTimeline.currentMeaning,
        ...report.majorLuckTimeline.cycles
          .filter((cycle) => cycle.ganzi !== '대운 미산정')
          .slice(0, 3)
          .map((cycle) => `${cycle.ageLabel} ${cycle.ganzi} 흐름은 ${cycle.phase} 쪽으로 읽고 ${cycle.summary}`),
      ].join(' ');
    case 'lifetimeStrategy':
      return [
        withOpener(report.lifetimeStrategy.summary),
        ...report.lifetimeStrategy.useWhenStrong,
        ...report.lifetimeStrategy.defendWhenShaken,
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
        : `${report.targetYear}년의 흐름을 곁에 두고 읽어도, 이 사주의 큰 본질은 쉽게 바뀌지 않습니다. ${report.cover.oneLineSummary}`,
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

    // A syntactically valid nine-slot response can still omit the paid report's
    // main answers. Keep the complete grounded fallback instead of a thin final.
    if (CORE_SECTION_KEYS.some((key) => sections[key].length < 180 || /오늘은|오늘의 운세|이번\s*달|내일은/.test(sections[key]))) {
      return { ok: false, interpretation: fallback, errorMessage: 'Lifetime core sections lack depth or contain daily-only advice.' };
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
  const luckCycles = getLifetimeCalendarLuck(data, record.input.year);

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
    readingContext: {
      calendarAge: Math.max(0, report.targetYear - record.input.year),
      isMinor: report.targetYear - record.input.year < 19,
      userSituation: record.grounding.personalizationContext.userSituation ?? null,
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
    currentLuck: luckCycles.currentLuck,
    majorLuck: luckCycles.majorLuck,
    personalizationContext: record.grounding.personalizationContext,
    factJson: { ...record.grounding.factJson, luckCycles },
    evidenceJson: {
      ...record.grounding.evidenceJson,
      luckFlow: {
        ...record.grounding.evidenceJson.luckFlow,
        currentMajorLuckNotes: luckCycles.currentLuck?.currentMajorLuck?.notes ?? [],
        saewoonNotes: luckCycles.currentLuck?.saewoon?.notes ?? [],
      },
    },
    kasiComparison: record.kasiComparison,
    lifetimeEvidence: report,
  };
}

export function createLifetimeInterpretationPrompt(
  record: ReadingRecord,
  report: SajuLifetimeReport,
  counselorId: MoonlightCounselorId,
  recentFeedbackSummary?: string | null,
  classicGrounding?: ClassicReadingGrounding
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
      CLASSIC_READING_INSTRUCTIONS,
      '규칙:',
      '- 사용자는 명리학을 배우러 온 사람이 아니라 자기 인생의 흐름과 선택을 알고 싶어 한다.',
      '- 명리 용어는 정관·편관·신강·신약·격국·용신처럼 정확한 한글 원어를 유지하고, 처음 등장할 때만 짧은 생활 언어 설명을 붙인다. 서로 다른 용어를 하나의 뜻으로 뭉개지 않는다. 한자와 factJson·evidenceJson 같은 구현 용어는 본문에 쓰지 않는다.',
      '- 계산 과정, 원칙 설명, 점수 설명을 반복하지 말고 결론, 조심할 패턴, 생활에서 적용할 선택을 먼저 쓴다.',
      '- 올해 운세처럼 쓰지 말고, 평생 반복해서 참고할 풀이처럼 쓴다.',
      '- 과장, 공포 조장, 무조건/반드시/100% 같은 단정 문구는 금지한다.',
      '- recentFeedbackSummary가 있으면 최근 사용자 반응을 참고해 문장의 단정 강도만 조정한다.',
      '- 각 section 문자열은 짧은 문장 여러 개로 이어진 밀도 높은 문단이어야 한다. 기존 9개 section 키를 빠짐없이 유지한다.',
      '- 분량은 재물·직업·관계 3개 핵심 장에 우선 배정한다. wealthStyle, careerDirection, relationshipPattern은 각 400~550자, 나머지 6개 장은 각 100~140자를 목표로 쓴다. 전체 문장은 2200~2700자 안에서 마무리하고 JSON을 완성한다.',
      '- 재물 장은 ① 무엇을 어떤 조건으로 대가에 연결하는가 ② 벌어도 남지 않는 패턴은 무엇인가 ③ 큰 결정을 앞두고 어떤 조건을 비교할 것인가에 답한다. lifetimeEvidence.wealthStyle의 네 상세 필드를 근거로 사용한다.',
      '- 직업 장은 ① 어떤 역할과 환경에서 실력이 드러나는가 ② 잘하지만 소진되는 일은 무엇인가 ③ 조직·독립을 고를 때 어떤 조건이 필요한가에 답한다. 직업명 목록 대신 실제로 맡는 과정·권한·평가 조건을 비교한다.',
      '- 관계 장은 ① 편안하게 가까워지는 방식은 무엇인가 ② 표현과 기대가 어긋나는 장면은 무엇인가 ③ 오래 가는 관계를 위해 어떤 합의가 필요한가에 답한다. 입력한 현재 관계 상태만 사용한다.',
      '- 각 핵심 장은 결론 → 확인된 사주 신호와 그 의미 → 실제로 있을 법한 조건부 장면 → 선택 기준 순서로 쓴다. 장마다 다른 장면을 쓰고, 같은 근거 설명이나 보편적 생활 조언을 반복해서 분량을 채우지 않는다.',
      '- 핵심 장에서 오늘·내일·이번 달의 운세를 섞지 않는다. 참고 자료에 일일 조언이 있어도 평생 장의 답으로 복사하지 않는다. 월별 풀이를 추가하지 않는다.',
      '- 나이는 해당 연도에서 출생 연도를 뺀 연도 나이를 사용한다. 대운 나이도 lifetimeEvidence.majorLuckTimeline의 범위를 그대로 따른다. cycles가 비어 있거나 현재 대운이 없으면 전환기·진입기 등 시기나 단계를 부여하지 말고 확인된 원국과 실제 생활 조건만 안내한다.',
      '- readingContext.isMinor가 참이면 핵심 3장을 돌봄·친구·배움·준비물·용돈의 선택으로 해석한다. 성인의 혼인·직장·사업 상황을 대입하지 않고, 장래의 직업·수입·배우자를 확정하지 않는다.',
      '- 생시 미입력은 시주를 근거로 쓰지 않는다. 입력하지 않은 소득·직업·부모의 성격·배우자의 외모·자녀 수·건강 상태를 만들어내지 않는다. 충·합이나 십성의 개수를 사건·성공 확률로 바꾸지 않는다.',
      '- opening은 첫 문단부터 흡입력 있게 쓰되 상담실 톤을 유지한다.',
      '- rememberRules는 실제 생활에 바로 적용 가능한 짧은 기억 문장 5개로 쓴다.',
      '- [밀착 개인화] 성향을 형용사로 요약하지 말고 그 성향이 드러나는 구체적 일상 장면으로 보여준다(show, don\'t tell). "책임감이 강하다"(요약) ❌ → "맡은 일은 끝을 봐야 마음이 놓여서, 남들이 이미 넘어간 자리를 혼자 한 번 더 확인하곤 한다"(장면) ⭕.',
      '- [밀착 개인화] 열 사람 중 아홉에게 맞는 말("대인관계가 원만하다")은 실패다. 이 사주 데이터에서만 나오는 이 사람만의 차이를 장면으로 짚는다. 사용자 컨텍스트(직업·관계·나이·고민)가 있으면 장면의 배경으로 자연스럽게 깔되, 없는 사실·사건은 지어내지 않는다.',
    ].join('\n'),
    input: JSON.stringify({
      ...createGrounding(record, report, counselorId),
      classicGrounding: classicGrounding ?? null,
      recentFeedbackSummary: recentFeedbackSummary ?? null,
    }),
  };
}
