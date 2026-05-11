import { Solar } from 'lunar-typescript';
import type { ReportEvidenceCard, ReportScore, SajuInterpretationGrounding, SajuReport } from '@/domain/saju/report';
import { getTopicInterpretationRule, selectEvidenceCard, toEvidenceSnippet } from '@/domain/saju/report/interpretation-rule-table';
import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import type { ConcernId, TodayScoreItem, TodayTimeWindow } from '@/lib/today-fortune/types';
import type { BirthInput, Branch, Element, Stem } from '@/lib/saju/types';
import {
  CONCERN_EASY_TIME_COPY, CONCERN_WINDOW_COPY, TIME_BRANCH_LABELS, TIME_BRANCH_WINDOW_COPY,
  type PublicTodayProfile, buildAxisScoreSummary, compactStrings, compactActionDescription,
  joinUniqueSentences, polishFortuneCopy, splitSentences, uniqueStrings, withKoreanParticle,
} from './build-today-fortune-copy';

export const SCORE_LABELS: Record<TodayScoreItem['key'], string> = {
  overall: '총운',
  love: '연애',
  wealth: '재물',
  career: '직장',
  relationship: '관계',
  condition: '컨디션',
};

export const TIME_BLOCKS: Array<{
  range: string;
  startHour: number;
  midpointHour: number;
  dayOffset: number;
}> = [
  { range: '23:00 - 01:00', startHour: 23, midpointHour: 0, dayOffset: 1 },
  { range: '01:00 - 03:00', startHour: 1, midpointHour: 2, dayOffset: 0 },
  { range: '03:00 - 05:00', startHour: 3, midpointHour: 4, dayOffset: 0 },
  { range: '05:00 - 07:00', startHour: 5, midpointHour: 6, dayOffset: 0 },
  { range: '07:00 - 09:00', startHour: 7, midpointHour: 8, dayOffset: 0 },
  { range: '09:00 - 11:00', startHour: 9, midpointHour: 10, dayOffset: 0 },
  { range: '11:00 - 13:00', startHour: 11, midpointHour: 12, dayOffset: 0 },
  { range: '13:00 - 15:00', startHour: 13, midpointHour: 14, dayOffset: 0 },
  { range: '15:00 - 17:00', startHour: 15, midpointHour: 16, dayOffset: 0 },
  { range: '17:00 - 19:00', startHour: 17, midpointHour: 18, dayOffset: 0 },
  { range: '19:00 - 21:00', startHour: 19, midpointHour: 20, dayOffset: 0 },
  { range: '21:00 - 23:00', startHour: 21, midpointHour: 22, dayOffset: 0 },
];

export const STEM_ELEMENT_MAP: Record<Stem, Element> = {
  '甲': '목',
  '乙': '목',
  '丙': '화',
  '丁': '화',
  '戊': '토',
  '己': '토',
  '庚': '금',
  '辛': '금',
  '壬': '수',
  '癸': '수',
};

export const BRANCH_ELEMENT_MAP: Record<Branch, Element> = {
  '子': '수',
  '丑': '토',
  '寅': '목',
  '卯': '목',
  '辰': '토',
  '巳': '화',
  '午': '화',
  '未': '토',
  '申': '금',
  '酉': '금',
  '戌': '토',
  '亥': '수',
};

export const BRANCH_ORDER: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export const BRANCH_SIX_HARMONIES = new Map<string, string>(
  [
    ['子-丑', '토'],
    ['寅-亥', '목'],
    ['卯-戌', '화'],
    ['辰-酉', '금'],
    ['巳-申', '수'],
    ['午-未', '토'],
  ] as const
);

export const BRANCH_CLASHES = new Set<string>(['子-午', '丑-未', '寅-申', '卯-酉', '辰-戌', '巳-亥']);

export const BRANCH_HARMS = new Set<string>(['子-未', '丑-午', '寅-巳', '卯-辰', '申-亥', '酉-戌']);

export const BRANCH_BREAKS = new Set<string>(['子-酉', '卯-午', '辰-丑', '未-戌', '寅-亥', '巳-申']);

export const BRANCH_PUNISHMENTS = new Set<string>([
  '寅-巳',
  '巳-申',
  '寅-申',
  '丑-未',
  '未-戌',
  '丑-戌',
  '子-卯',
  '辰-辰',
  '午-午',
  '酉-酉',
  '亥-亥',
]);

export const HALF_HARMONY_PAIRS = new Map<string, string>(
  [
    ['申-子', '수 반합'],
    ['子-辰', '수 반합'],
    ['亥-卯', '목 반합'],
    ['卯-未', '목 반합'],
    ['寅-午', '화 반합'],
    ['午-戌', '화 반합'],
    ['巳-酉', '금 반합'],
    ['酉-丑', '금 반합'],
  ] as const
);

export const GENERATED_BY_MAP: Record<Element, Element> = {
  목: '화',
  화: '토',
  토: '금',
  금: '수',
  수: '목',
};

export const GENERATOR_OF_MAP: Record<Element, Element> = {
  목: '수',
  화: '목',
  토: '화',
  금: '토',
  수: '금',
};

export const CONTROLLER_OF_MAP: Record<Element, Element> = {
  목: '금',
  화: '수',
  토: '목',
  금: '화',
  수: '토',
};

export function clampScore(value: number) {
  return Math.max(48, Math.min(92, Math.round(value)));
}

export interface LocalDateTimeSnapshot {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface TodayTimeBlockEvaluation {
  range: string;
  timeGanzi: string;
  stem: Stem;
  branch: Branch;
  stemElement: Element;
  branchElement: Element;
  score: number;
  supportiveDelta: number;
  relationDelta: number;
  evidenceCard: ReportEvidenceCard | undefined;
  evidenceSnippet: string | null;
  actionLead: string;
  hint: string | null;
  relationSummary: string | null;
  supportSummary: string | null;
  cautionSummary: string | null;
}

export function getLocalDateTimeSnapshot(
  calculatedAt: string,
  timeZone: string
): LocalDateTimeSnapshot {
  const parsed = new Date(calculatedAt);
  const sourceDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    const parts: Partial<Record<keyof LocalDateTimeSnapshot, number>> = {};

    for (const part of formatter.formatToParts(sourceDate)) {
      if (
        part.type === 'year' ||
        part.type === 'month' ||
        part.type === 'day' ||
        part.type === 'hour' ||
        part.type === 'minute'
      ) {
        parts[part.type] = Number.parseInt(part.value, 10);
      }
    }

    if (
      parts.year !== undefined &&
      parts.month !== undefined &&
      parts.day !== undefined &&
      parts.hour !== undefined &&
      parts.minute !== undefined
    ) {
      return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: parts.hour,
        minute: parts.minute,
      };
    }
  } catch {
    // Fall through to UTC below.
  }

  return {
    year: sourceDate.getUTCFullYear(),
    month: sourceDate.getUTCMonth() + 1,
    day: sourceDate.getUTCDate(),
    hour: sourceDate.getUTCHours(),
    minute: sourceDate.getUTCMinutes(),
  };
}

export function pad2(value: number) {
  return String(value).padStart(2, '0');
}

export function addDaysToDateParts(
  year: number,
  month: number,
  day: number,
  dayOffset: number
) {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function resolveTimeZoneOffset(baseDate: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(baseDate);
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+9';
    const normalized = offset.replace('GMT', '');
    const match = normalized.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!match) return '+09:00';
    const [, sign, hours, minutes] = match;
    return `${sign}${hours.padStart(2, '0')}:${(minutes ?? '00').padStart(2, '0')}`;
  } catch {
    return '+09:00';
  }
}

export function sortBranchKey(left: Branch, right: Branch) {
  return [left, right]
    .sort((a, b) => BRANCH_ORDER.indexOf(a) - BRANCH_ORDER.indexOf(b))
    .join('-');
}

export function generatedByElement(element: Element) {
  return GENERATED_BY_MAP[element];
}

export function generatorOfElement(element: Element) {
  return GENERATOR_OF_MAP[element];
}

export function controllerOfElement(element: Element) {
  return CONTROLLER_OF_MAP[element];
}

export function getScore(report: SajuReport, key: ReportScore['key']) {
  return report.scores.find((item) => item.key === key);
}

export function buildConditionScore(
  todayReport: SajuReport,
  loveReport: SajuReport,
  wealthReport: SajuReport,
  sajuData: SajuDataV1
) {
  const overall = getScore(todayReport, 'overall')?.score ?? 70;
  const love = getScore(loveReport, 'love')?.score ?? overall;
  const wealth = getScore(wealthReport, 'wealth')?.score ?? overall;
  const dominantCount = sajuData.fiveElements.byElement[sajuData.fiveElements.dominant]?.count ?? 0;
  const weakestCount = sajuData.fiveElements.byElement[sajuData.fiveElements.weakest]?.count ?? 0;
  const balancePenalty = Math.max(0, dominantCount - weakestCount) * 2;
  const strengthAdjust =
    sajuData.strength?.level === '신약' ? -4 : sajuData.strength?.level === '신강' ? 2 : 0;

  return clampScore((overall + love + wealth) / 3 - balancePenalty + strengthAdjust);
}

export function buildKasiSummary(kasiComparison: KasiSingleInputComparison | null | undefined) {
  if (!kasiComparison) {
    return {
      available: false,
      ok: true,
      summary: '역법 대조 정보는 아직 함께 저장되지 않았습니다.',
    };
  }

  const lunarDate = `${kasiComparison.kasi.lunYear}.${kasiComparison.kasi.lunMonth}.${kasiComparison.kasi.lunDay}${kasiComparison.kasi.lunLeapmonth === '윤' ? ' 윤달' : ''}`;
  if (kasiComparison.issues.length === 0) {
    return {
      available: true,
      ok: true,
      summary: `공식 달력 정보와 대조했을 때 음력일과 하루 흐름이 일치합니다. 음력일은 ${lunarDate}, 하루 흐름은 ${kasiComparison.kasi.lunIljin ?? '미제공'}입니다.`,
    };
  }

  const issueSummary = kasiComparison.issues
    .slice(0, 2)
    .map((issue) => `${issue.field} 차이`)
    .join(', ');

  return {
    available: true,
    ok: false,
    summary: `공식 달력 대조에서 ${issueSummary}가 확인됐습니다. 음력일은 ${lunarDate}, 하루 흐름은 ${kasiComparison.kasi.lunIljin ?? '미제공'}입니다.`,
  };
}

export function buildTodayGroundingSummary(
  grounding: SajuInterpretationGrounding | null | undefined,
  kasiComparison: KasiSingleInputComparison | null | undefined,
  focusReport: SajuReport,
  sajuData: SajuDataV1
) {
  const evidenceCards =
    focusReport.focusTopic === 'today'
      ? grounding?.evidenceJson.classics.cards ?? focusReport.evidenceCards
      : focusReport.evidenceCards;
  const primaryConcept = simplifySajuCopy(
    focusReport.evidenceCards[0]?.label ?? grounding?.evidenceJson.primaryConcept ?? '보완 힌트'
  );
  const strengthLine =
    grounding?.evidenceJson.strength.level && grounding?.evidenceJson.strength.score !== null
      ? `기운의 균형 ${grounding.evidenceJson.strength.level}`
      : `기운의 균형 ${sajuData.strength?.level ?? '정리 중'}`;
  const patternLine =
    grounding?.evidenceJson.pattern.name
      ? `역할 흐름 ${grounding.evidenceJson.pattern.name}${grounding.evidenceJson.pattern.tenGod ? ` · ${grounding.evidenceJson.pattern.tenGod}` : ''}`
      : `역할 흐름 ${sajuData.pattern?.name ?? '정리 중'}`;
  const yongsinLine =
    grounding?.evidenceJson.yongsin.primary
      ? `보완 힌트 ${grounding.evidenceJson.yongsin.primary}${grounding.evidenceJson.yongsin.support.length > 0 ? ` · 보조 ${grounding.evidenceJson.yongsin.support.join(' · ')}` : ''}`
      : `보완 힌트 ${sajuData.yongsin?.primary?.label ?? '정리 중'}`;
  const luckLine = grounding?.evidenceJson.luckFlow.currentMajorLuck
    ? `현재 큰 흐름 ${grounding.evidenceJson.luckFlow.currentMajorLuck}`
    : grounding?.evidenceJson.luckFlow.saewoon
      ? `올해 흐름 ${grounding.evidenceJson.luckFlow.saewoon}`
      : `현재 흐름 ${sajuData.currentLuck?.saewoon?.ganzi ?? '정리 중'}`;

  return {
    primaryConcept,
    factLines: [
      `나를 나타내는 기운 ${sajuData.dayMaster.stem}${sajuData.dayMaster.element ? ` · ${sajuData.dayMaster.element}` : ''}`,
      strengthLine,
      patternLine,
      yongsinLine,
      luckLine,
    ],
    evidenceLines: evidenceCards
      .slice(0, 3)
      .map((card) => polishFortuneCopy(`${card.label} · ${card.plainSummary || card.title}`)),
    kasi: buildKasiSummary(kasiComparison),
  };
}

export function getTodayEvidenceSnippet(report: SajuReport) {
  const rule = getTopicInterpretationRule(report.focusTopic);
  const card = selectEvidenceCard(report.evidenceCards, rule.evidencePriority);
  return toEvidenceSnippet(card);
}

export function getTodayEvidenceCard(
  report: SajuReport,
  type: 'lead' | 'caution'
) {
  const rule = getTopicInterpretationRule(report.focusTopic);
  const priorities = type === 'lead' ? rule.evidencePriority : rule.cautionPriority;
  return selectEvidenceCard(report.evidenceCards, priorities);
}

export function getEvidenceActionHints(
  report: SajuReport,
  type: 'lead' | 'caution',
  limit = 2
) {
  return uniqueStrings(getTodayEvidenceCard(report, type)?.practicalActions ?? [], limit);
}

export function getLuckFactLine(sajuData: SajuDataV1) {
  return compactStrings([
    sajuData.currentLuck?.currentMajorLuck?.ganzi
      ? `${sajuData.currentLuck.currentMajorLuck.ganzi} 큰 흐름`
      : null,
    sajuData.currentLuck?.saewoon?.ganzi
      ? `${sajuData.currentLuck.saewoon.ganzi} 올해 흐름`
      : null,
    sajuData.currentLuck?.wolwoon?.ganzi
      ? `${sajuData.currentLuck.wolwoon.ganzi} 이번 달 흐름`
      : null,
  ]).join(' / ');
}

export function getTimeBlockBaseScore(report: SajuReport) {
  const focusScore = getScore(report, report.focusScoreKey);
  return focusScore?.score ?? getScore(report, 'overall')?.score ?? 70;
}

export function getTimeBlockCalculatedAt(
  sajuData: SajuDataV1,
  block: (typeof TIME_BLOCKS)[number]
) {
  const baseDate = new Date(sajuData.metadata.calculatedAt);
  const local = getLocalDateTimeSnapshot(
    sajuData.metadata.calculatedAt,
    sajuData.input.timezone
  );
  const nextDate = addDaysToDateParts(local.year, local.month, local.day, block.dayOffset);
  const offset = resolveTimeZoneOffset(baseDate, sajuData.input.timezone);
  return `${nextDate.year}-${pad2(nextDate.month)}-${pad2(nextDate.day)}T${pad2(block.midpointHour)}:00:00${offset}`;
}

export function parseTimeBlockPillar(
  sajuData: SajuDataV1,
  block: (typeof TIME_BLOCKS)[number]
) {
  const calculatedAt = getTimeBlockCalculatedAt(sajuData, block);
  const local = getLocalDateTimeSnapshot(calculatedAt, sajuData.input.timezone);
  const solar = Solar.fromYmdHms(local.year, local.month, local.day, local.hour, 0, 0);
  const eightChar = solar.getLunar().getEightChar();
  eightChar.setSect(sajuData.input.jasiMethod === 'split' ? 1 : 2);

  const timeGanzi = eightChar.getTime();
  const stem = timeGanzi[0] as Stem;
  const branch = timeGanzi[1] as Branch;

  return {
    calculatedAt,
    timeGanzi,
    stem,
    branch,
    stemElement: STEM_ELEMENT_MAP[stem],
    branchElement: BRANCH_ELEMENT_MAP[branch],
  };
}

export function describeBranchRelation(left: Branch, right: Branch) {
  const branchKey = sortBranchKey(left, right);

  if (BRANCH_SIX_HARMONIES.has(branchKey)) {
    return { label: '육합', delta: 7, tone: 'support' as const };
  }
  if (HALF_HARMONY_PAIRS.has(branchKey)) {
    return { label: '반합', delta: 5, tone: 'support' as const };
  }
  if (BRANCH_CLASHES.has(branchKey)) {
    return { label: '충', delta: -7, tone: 'caution' as const };
  }
  if (BRANCH_PUNISHMENTS.has(branchKey)) {
    return { label: '형', delta: -5, tone: 'caution' as const };
  }
  if (BRANCH_BREAKS.has(branchKey)) {
    return { label: '파', delta: -4, tone: 'caution' as const };
  }
  if (BRANCH_HARMS.has(branchKey)) {
    return { label: '해', delta: -3, tone: 'caution' as const };
  }

  return null;
}

export function getTimeBlockRelationImpact(
  blockBranch: Branch,
  sajuData: SajuDataV1
) {
  const natalBranches = [
    { slot: '시주', branch: sajuData.pillars.hour?.branch ?? null, weight: 0.9 },
    { slot: '일주', branch: sajuData.pillars.day.branch, weight: 1.35 },
    { slot: '월주', branch: sajuData.pillars.month.branch, weight: 1.15 },
    { slot: '년주', branch: sajuData.pillars.year.branch, weight: 0.8 },
  ];

  const details = natalBranches
    .filter((entry): entry is { slot: string; branch: Branch; weight: number } => Boolean(entry.branch))
    .map((entry) => {
      const relation = describeBranchRelation(blockBranch, entry.branch);
      if (!relation) return null;
      return {
        ...relation,
        slot: entry.slot,
        branch: entry.branch,
        weightedDelta: Math.round(relation.delta * entry.weight),
      };
    })
    .filter(
      (
        detail
      ): detail is {
        label: string;
        delta: number;
        tone: 'support' | 'caution';
        slot: string;
        branch: Branch;
        weightedDelta: number;
      } => Boolean(detail)
    );

  const totalDelta = details.reduce((sum, detail) => sum + detail.weightedDelta, 0);
  const supportLabels = details
    .filter((detail) => detail.tone === 'support')
    .map((detail) => `${detail.slot} ${detail.branch}와 ${detail.label}`)
    .slice(0, 2);
  const cautionLabels = details
    .filter((detail) => detail.tone === 'caution')
    .map((detail) => `${detail.slot} ${detail.branch}와 ${detail.label}`)
    .slice(0, 2);

  return {
    totalDelta,
    supportLabels,
    cautionLabels,
  };
}

export function getTimeBlockElementImpact(sajuData: SajuDataV1, stemElement: Element, branchElement: Element) {
  const primaryElement = (sajuData.yongsin?.primary?.value as Element | undefined) ?? null;
  const supportElements = (sajuData.yongsin?.secondary ?? []).map((item) => item.value as Element);
  const cautionElements = (sajuData.yongsin?.kiyshin ?? []).map((item) => item.value as Element);
  const dayMasterElement = sajuData.dayMaster.element;
  const resourceElement = generatorOfElement(dayMasterElement);
  const outputElement = generatedByElement(dayMasterElement);
  const officerElement = controllerOfElement(dayMasterElement);

  let delta = 0;
  const supportLines: string[] = [];
  const cautionLines: string[] = [];

  if (primaryElement && branchElement === primaryElement) {
    delta += 8;
    supportLines.push(`${branchElement} 기운이 오늘의 보완 힌트와 맞닿습니다.`);
  }
  if (primaryElement && stemElement === primaryElement) {
    delta += 4;
    supportLines.push(`${stemElement} 기운이 오늘 부족한 부분을 한 번 더 받쳐줍니다.`);
  }
  if (supportElements.includes(branchElement)) {
    delta += 5;
    supportLines.push(`${branchElement} 기운이 보조 힌트와 이어져 작은 선택을 받쳐줍니다.`);
  }
  if (supportElements.includes(stemElement)) {
    delta += 2;
  }
  if (cautionElements.includes(branchElement)) {
    delta -= 6;
    cautionLines.push(`${branchElement} 기운이 조절할 흐름과 닿아 과한 반응을 키우기 쉽습니다.`);
  }
  if (cautionElements.includes(stemElement)) {
    delta -= 3;
  }

  if (sajuData.strength?.level === '신강') {
    if (branchElement === outputElement || branchElement === officerElement) {
      delta += 3;
      supportLines.push(`${branchElement} 기운이 강한 내 기운을 밖으로 잘 풀어줍니다.`);
    }
    if (branchElement === dayMasterElement || branchElement === resourceElement) {
      delta -= 3;
      cautionLines.push(`${branchElement} 기운이 이미 강한 축을 더 키워 균형을 무겁게 만들 수 있습니다.`);
    }
  }

  if (sajuData.strength?.level === '신약') {
    if (branchElement === dayMasterElement || branchElement === resourceElement) {
      delta += 4;
      supportLines.push(`${branchElement} 기운이 약한 축을 바로 보강해 버티는 힘을 줍니다.`);
    }
    if (branchElement === outputElement || branchElement === officerElement) {
      delta -= 4;
      cautionLines.push(`${branchElement} 기운이 약한 내 기운을 더 빨리 소모시킬 수 있습니다.`);
    }
  }

  if (branchElement === sajuData.fiveElements.weakest) {
    delta += 2;
  }
  if (branchElement === sajuData.fiveElements.dominant) {
    delta -= 2;
  }

  return {
    delta,
    supportLines,
    cautionLines,
  };
}

export function selectTimeBlockEvidenceCard(
  report: SajuReport,
  type: 'favorable' | 'caution',
  supportiveDelta: number,
  relationDelta: number
) {
  const rule = getTopicInterpretationRule(report.focusTopic);
  const priorities = type === 'favorable' ? rule.evidencePriority : rule.cautionPriority;
  const relationWeighted = Math.abs(relationDelta) >= 4;
  const strengthWeighted = Math.abs(supportiveDelta) >= 6;

  return [...report.evidenceCards].sort((left, right) => {
    const scoreCard = (card: ReportEvidenceCard) => {
      let score = 24 - Math.max(0, priorities.indexOf(card.key)) * 4;
      if (priorities.indexOf(card.key) === -1) score = 2;
      if (card.key === 'relations' && relationWeighted) score += 8;
      if (card.key === 'yongsin' && supportiveDelta > 0) score += 7;
      if (card.key === 'strength' && strengthWeighted) score += 5;
      if (card.key === 'gongmang' && type === 'caution' && supportiveDelta < 0) score += 3;
      return score;
    };

    return scoreCard(right) - scoreCard(left);
  })[0];
}

export function buildTimeBlockEvaluations(
  concernId: ConcernId,
  report: SajuReport,
  sajuData: SajuDataV1
) {
  const baseScore = getTimeBlockBaseScore(report);
  const concernCopy = CONCERN_WINDOW_COPY[concernId];
  const actionRuleLeadHints = getEvidenceActionHints(report, 'lead', 3);
  const actionRuleCautionHints = getEvidenceActionHints(report, 'caution', 3);
  const luckFact = getLuckFactLine(sajuData);

  return TIME_BLOCKS.map((block) => {
    const timePillar = parseTimeBlockPillar(sajuData, block);
    const elementImpact = getTimeBlockElementImpact(
      sajuData,
      timePillar.stemElement,
      timePillar.branchElement
    );
    const relationImpact = getTimeBlockRelationImpact(timePillar.branch, sajuData);
    const score = clampScore(baseScore + elementImpact.delta + relationImpact.totalDelta);
    const evidenceCard = selectTimeBlockEvidenceCard(
      report,
      score >= baseScore ? 'favorable' : 'caution',
      elementImpact.delta,
      relationImpact.totalDelta
    );
    const evidenceSnippet = evidenceCard ? toEvidenceSnippet(evidenceCard) : null;
    const hints = uniqueStrings(
      evidenceCard?.practicalActions ?? [],
      3
    );
    const fallbackHints = score >= baseScore ? actionRuleLeadHints : actionRuleCautionHints;
    const hintPool = hints.length > 0 ? hints : fallbackHints;
    const hint =
      hintPool.length > 0
        ? hintPool[(block.startHour + Math.max(0, score - 40)) % hintPool.length]
        : null;
    const actionLead = compactActionDescription(
      score >= baseScore ? report.primaryAction.description : report.cautionAction.description,
      evidenceSnippet
    );
    const supportSummary = uniqueStrings(
      [
        `${timePillar.timeGanzi}시에는 ${timePillar.branchElement} 기운이 전면에 서서 오늘 흐름의 결을 바꿉니다.`,
        ...elementImpact.supportLines,
        relationImpact.supportLabels[0]
          ? `${relationImpact.supportLabels.join(', ')}이 들어와 말이나 결정이 묶이는 힘을 더합니다.`
          : null,
      ],
      2
    ).join(' ');
    const cautionSummary = uniqueStrings(
      [
        `${timePillar.timeGanzi}시는 ${timePillar.branchElement} 기운이 튀어나와 감정이나 판단이 과해지기 쉬운 블록입니다.`,
        ...elementImpact.cautionLines,
        relationImpact.cautionLabels[0]
          ? `${relationImpact.cautionLabels.join(', ')}이 겹치면 작은 반응도 크게 받아들이기 쉽습니다.`
          : null,
      ],
      2
    ).join(' ');
    const relationSummary =
      relationImpact.supportLabels[0] || relationImpact.cautionLabels[0]
        ? uniqueStrings([
            relationImpact.supportLabels[0]
              ? `${relationImpact.supportLabels.join(', ')}이 들어와 관계가 묶이는 쪽으로 작동합니다.`
              : null,
            relationImpact.cautionLabels[0]
              ? `${relationImpact.cautionLabels.join(', ')}이 겹치면 말의 여파가 오래 남기 쉽습니다.`
              : null,
          ]).join(' ')
        : null;

    return {
      range: block.range,
      timeGanzi: timePillar.timeGanzi,
      stem: timePillar.stem,
      branch: timePillar.branch,
      stemElement: timePillar.stemElement,
      branchElement: timePillar.branchElement,
      score,
      supportiveDelta: elementImpact.delta,
      relationDelta: relationImpact.totalDelta,
      evidenceCard,
      evidenceSnippet,
      actionLead,
      hint,
      relationSummary,
      supportSummary,
      cautionSummary,
      luckFact,
      favorableTail: concernCopy.favorableTail,
      cautionTail: concernCopy.cautionTail,
    };
  });
}

export function pickTimeBlockWindows(
  evaluations: ReturnType<typeof buildTimeBlockEvaluations>,
  type: 'favorable' | 'caution'
) {
  const sorted = [...evaluations].sort((left, right) =>
    type === 'favorable' ? right.score - left.score : left.score - right.score
  );
  const selected: typeof evaluations = [];

  for (const candidate of sorted) {
    if (selected.length === 0) {
      selected.push(candidate);
      continue;
    }

    const hasDifferentEvidence = selected.every(
      (item) => item.evidenceCard?.key !== candidate.evidenceCard?.key
    );
    const hasDifferentBranch = selected.every((item) => item.branch !== candidate.branch);
    if (hasDifferentEvidence || hasDifferentBranch || selected.length >= 2) {
      selected.push(candidate);
    }
    if (selected.length >= 2) break;
  }

  return selected.slice(0, 2);
}

export function limitEasyTimeSentences(value: string, maxSentences = 3) {
  const sentences = splitSentences(simplifySajuCopy(value))
    .map((sentence) =>
      sentence
        .replace(/밀어붙이/gu, '무리하게 진행하')
        .replace(/밀기보다/gu, '무리하기보다')
        .replace(/밀어도 되는/gu, '진행하기 좋은')
        .replace(/밀어도/gu, '진행해도')
        .replace(/밀고/gu, '진행하고')
        .replace(/기운/gu, '분위기')
        .replace(/보완 힌트/gu, '도움 되는 점')
        .replace(/선택 힌트/gu, '선택할 때 볼 점')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);

  return sentences.slice(0, maxSentences).join(' ');
}

export function buildTimeWindowTitle(item: TodayTimeBlockEvaluation, type: 'favorable' | 'caution') {
  const branchCopy = TIME_BRANCH_WINDOW_COPY[item.branch];
  const suffix = type === 'favorable' ? branchCopy.favorableTitle : branchCopy.cautionTitle;
  return `${TIME_BRANCH_LABELS[item.branch]} · ${suffix}`;
}

export function buildTimeWindowBody(
  concernId: ConcernId,
  item: TodayTimeBlockEvaluation,
  type: 'favorable' | 'caution'
) {
  const branchCopy = TIME_BRANCH_WINDOW_COPY[item.branch];
  const concernCopy = CONCERN_EASY_TIME_COPY[concernId];
  const branchBody = type === 'favorable' ? branchCopy.favorableBody : branchCopy.cautionBody;
  const concernBody = type === 'favorable' ? concernCopy.favorable : concernCopy.caution;
  const scoreBody =
    type === 'favorable'
      ? item.score >= 78
        ? '중요한 일도 바로 크게 잡기보다 작게 시작하면 좋습니다.'
        : '부담 없는 일부터 하면 흐름이 편해집니다.'
      : item.score <= 58
        ? '오늘은 속도를 낮추고 확인을 하나 더 넣는 편이 안전합니다.'
        : '무리한 결론만 피하면 크게 흔들리지 않습니다.';
  const hintBody = item.hint
    ? `먼저 할 일은 "${limitEasyTimeSentences(item.hint, 1)}"입니다.`
    : null;

  return limitEasyTimeSentences(
    joinUniqueSentences([branchBody, concernBody, hintBody, scoreBody]),
    3
  );
}

export function toTodayScores(
  todayReport: SajuReport,
  loveReport: SajuReport,
  wealthReport: SajuReport,
  careerReport: SajuReport,
  relationshipReport: SajuReport,
  conditionScore: number,
  profile: PublicTodayProfile
): TodayScoreItem[] {
  const baseScores: TodayScoreItem[] = [
    getScore(todayReport, 'overall'),
    getScore(loveReport, 'love'),
    getScore(wealthReport, 'wealth'),
    getScore(careerReport, 'career'),
    getScore(relationshipReport, 'relationship'),
  ]
    .filter((score): score is ReportScore => Boolean(score))
    .map((score) => ({
      key: score.key as TodayScoreItem['key'],
      label: SCORE_LABELS[score.key],
      score: score.score,
      summary: buildAxisScoreSummary(score.key as TodayScoreItem['key'], score.score, profile),
    }));

  baseScores.push({
    key: 'condition',
    label: SCORE_LABELS.condition,
    score: conditionScore,
    summary: buildAxisScoreSummary('condition', conditionScore, profile),
  });

  return baseScores;
}

export function buildTimeWindows(
  concernId: ConcernId,
  report: SajuReport,
  sajuData: SajuDataV1,
  type: 'favorable' | 'caution'
): TodayTimeWindow[] {
  const evaluations = pickTimeBlockWindows(buildTimeBlockEvaluations(concernId, report, sajuData), type);

  return evaluations.map((item) => ({
    range: item.range,
    mood: type,
    title: buildTimeWindowTitle(item, type),
    body: buildTimeWindowBody(concernId, item, type),
  }));
}

export function buildScenarioComparison(
  concernId: ConcernId,
  report: SajuReport,
  sajuData: SajuDataV1
) {
  const concernCopy = CONCERN_WINDOW_COPY[concernId];
  const evidenceSnippet = getTodayEvidenceSnippet(report);
  const leadHints = getEvidenceActionHints(report, 'lead', 2);
  const cautionHints = getEvidenceActionHints(report, 'caution', 2);
  const leadHint = leadHints[0];
  const secondaryLeadHint = leadHints[1] ?? leadHints[0];
  const cautionHint = cautionHints[0];
  const secondaryCautionHint = cautionHints[1] ?? cautionHints[0];
  const luckFact = getLuckFactLine(sajuData);
  const primaryAction = compactActionDescription(report.primaryAction.description, evidenceSnippet);
  const cautionAction = compactActionDescription(report.cautionAction.description, evidenceSnippet);

  return [
    {
      title: concernCopy.actNowTitle,
      better: joinUniqueSentences([
        evidenceSnippet,
        primaryAction,
        leadHint ? `특히 "${leadHint}"부터 잡고 들어가면 흐름을 덜 놓칩니다.` : null,
        concernCopy.actNowTail,
      ]),
      watch: joinUniqueSentences([
        cautionAction,
        cautionHint ? `${withKoreanParticle(`"${cautionHint}"`, '을', '를')} 같이 놓치면 작은 선택도 피로로 바뀌기 쉽습니다.` : null,
        luckFact ? `특히 ${withKoreanParticle(luckFact, '이', '가')} 겹친 날이라 단기 반응을 과신하지 않는 편이 좋습니다.` : null,
      ]),
    },
    {
      title: concernCopy.waitTitle,
      better: joinUniqueSentences([
        evidenceSnippet,
        secondaryLeadHint ? `${withKoreanParticle(`"${secondaryLeadHint}"`, '을', '를')} 먼저 정리하고 움직이면 결과가 더 매끈해집니다.` : null,
        concernCopy.waitTail,
      ]),
      watch: joinUniqueSentences([
        secondaryCautionHint
          ? `${withKoreanParticle(`"${secondaryCautionHint}"`, '을', '를')} 미루기만 하면 같은 빈틈이 뒤에서 다시 커질 수 있습니다.`
          : null,
        '우선순위 없이 미루기만 하면 좋은 흐름도 손에서 미끄러질 수 있습니다.',
      ]),
    },
  ];
}

export function buildEvidenceLines(
  focusReport: SajuReport,
  todayReport: SajuReport,
  sajuData: SajuDataV1,
  unknownBirthTime: boolean
) {
  const lines = [
    `${focusReport.evidenceCards[0]?.label ?? '오늘 흐름'} · ${focusReport.evidenceCards[0]?.title ?? focusReport.summary}`,
    `큰 흐름 · ${sajuData.currentLuck?.currentMajorLuck?.ganzi ?? '정리 중'} / ${sajuData.currentLuck?.saewoon?.ganzi ?? '올해 흐름 정리 중'} / ${sajuData.currentLuck?.wolwoon?.ganzi ?? '이번 달 흐름 정리 중'}`,
    `보완 힌트 · ${sajuData.yongsin?.plainSummary ?? '부족한 부분을 차분히 채우는 편이 좋습니다.'}`,
  ];

  if (unknownBirthTime) {
    lines.push('태어난 시간이 없어 시간대별 흐름은 줄여 읽고, 전체 흐름 중심으로 정리했습니다.');
  }

  if (todayReport.evidenceCards[1]?.title) {
    lines.push(`${todayReport.evidenceCards[1].label} · ${todayReport.evidenceCards[1].title}`);
  }

  return lines;
}

export function buildRecommendedActions(
  concernId: ConcernId,
  focusReport: SajuReport,
  sajuData: SajuDataV1
) {
  const concernCopy = CONCERN_WINDOW_COPY[concernId];
  const leadHints = getEvidenceActionHints(focusReport, 'lead', 3);
  const leadEvidenceSnippet = getTodayEvidenceSnippet(focusReport);
  const primaryAction = compactActionDescription(
    focusReport.primaryAction.description,
    leadEvidenceSnippet
  );
  const actions = uniqueStrings(
    [
      primaryAction,
      ...leadHints.map((item) => `${item} 흐름부터 먼저 잡아보세요.`),
      getLuckFactLine(sajuData)
        ? `지금은 ${withKoreanParticle(getLuckFactLine(sajuData), '을', '를')} 같이 보며 ${concernCopy.favorableTail}`
        : concernCopy.favorableTail,
      `오늘 부족한 부분을 생활 루틴으로 채우면 체감 안정감이 더 큽니다.`,
    ],
    3
  );

  return actions;
}

export function buildAvoidActions(
  concernId: ConcernId,
  focusReport: SajuReport,
  input: BirthInput,
  sajuData: SajuDataV1
) {
  const concernCopy = CONCERN_WINDOW_COPY[concernId];
  const cautionHints = getEvidenceActionHints(focusReport, 'caution', 3);
  const cautionEvidenceSnippet = getTodayEvidenceSnippet(focusReport);
  const cautionAction = compactActionDescription(
    focusReport.cautionAction.description,
    cautionEvidenceSnippet
  );
  const actions = uniqueStrings(
    [
      cautionAction,
      ...cautionHints.map((item) => `${withKoreanParticle(item, '을', '를')} 놓친 채 무리하게 진행하지 않는 편이 좋습니다.`),
      input.unknownTime
        ? '태어난 시간이 없으니 세부 타이밍보다 전체 흐름을 먼저 보는 편이 안전합니다.'
        : getLuckFactLine(sajuData)
          ? `${withKoreanParticle(getLuckFactLine(sajuData), '이', '가')} 겹친 날이라 반응이 좋더라도 같은 속도로 하루 종일 밀지 않는 편이 낫습니다.`
          : concernCopy.cautionTail,
    ],
    3
  );

  return actions;
}
