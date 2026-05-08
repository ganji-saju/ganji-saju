import { buildSajuInterpretationGrounding, buildSajuReport, normalizeFocusTopic } from '@/domain/saju/report';
import type { FocusTopic } from '@/domain/saju/report/types';
import { resolveReading } from '@/lib/saju/readings';
import { createInterpretationPrompt } from '@/server/ai/saju-interpretation';

export interface SajuOutputSimilaritySample {
  slug: string;
  readingId: string;
  input: {
    year: number;
    month: number;
    day: number;
    hour: number | null;
    minute: number | null;
    gender: string | null;
  };
  dayGanziCode: string;
  dayGanziHanja: string;
  hourGanzi: string | null;
  fiveElementRatio: Record<string, number>;
  tenGodDistribution: Record<string, number>;
  strength: string | null;
  yongsin: string | null;
  currentLuck: string | null;
  reportTextLength: number;
  promptTextLength: number;
}

export interface SajuOutputSimilarityAudit {
  topic: FocusTopic;
  samples: [SajuOutputSimilaritySample, SajuOutputSimilaritySample];
  metrics: {
    reportTextSimilarity: number;
    promptInputSimilarity: number;
    personalizationSimilarity: number;
  };
  differences: string[];
  checks: {
    promptDiverges: boolean;
    reportDiverges: boolean;
    personalizationDiverges: boolean;
  };
  threshold: {
    promptMaxSimilarity: number;
    reportMaxSimilarity: number;
    personalizationMaxSimilarity: number;
  };
}

const PROMPT_MAX_SIMILARITY = 0.985;
const REPORT_MAX_SIMILARITY = 0.98;
const PERSONALIZATION_MAX_SIMILARITY = 0.95;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCharacterNgrams(value: string, size = 3) {
  const normalized = normalizeText(value).replace(/\s+/g, '');
  if (!normalized) return new Set<string>();
  if (normalized.length <= size) return new Set([normalized]);

  const grams = new Set<string>();
  for (let index = 0; index <= normalized.length - size; index += 1) {
    grams.add(normalized.slice(index, index + size));
  }
  return grams;
}

function jaccardSimilarity(first: Set<string>, second: Set<string>) {
  if (first.size === 0 && second.size === 0) return 1;
  const intersection = [...first].filter((item) => second.has(item)).length;
  const union = new Set([...first, ...second]).size;
  return union === 0 ? 1 : Math.round((intersection / union) * 1000) / 1000;
}

function textSimilarity(first: string, second: string) {
  return jaccardSimilarity(buildCharacterNgrams(first), buildCharacterNgrams(second));
}

function buildReportSurfaceText(report: ReturnType<typeof buildSajuReport>) {
  return [
    report.headline,
    report.summary,
    ...report.summaryHighlights,
    ...report.scores.map((score) => `${score.key} ${score.label} ${score.score} ${score.summary}`),
    ...report.insights.map((insight) => `${insight.title} ${insight.eyebrow} ${insight.body}`),
    ...report.evidenceCards.map((card) =>
      [
        card.key,
        card.label,
        card.title,
        card.body,
        card.plainSummary,
        ...card.details,
        ...(card.practicalActions ?? []),
      ].filter(Boolean).join(' ')
    ),
    report.primaryAction.title,
    report.primaryAction.description,
    report.cautionAction.title,
    report.cautionAction.description,
  ].filter(Boolean).join('\n');
}

function buildPersonalizationText(grounding: ReturnType<typeof buildSajuInterpretationGrounding>) {
  const context = grounding.personalizationContext;
  return [
    context.dayGanziCode,
    context.dayGanziHanja,
    context.sixtyGapja?.title,
    context.sixtyGapja?.core,
    JSON.stringify(context.fiveElementRatio),
    JSON.stringify(context.tenGodDistribution),
    JSON.stringify(context.strengthJudgement),
    JSON.stringify(context.yongsinKiyshin),
    JSON.stringify(context.currentLuck),
    ...context.promptFacts,
  ].filter(Boolean).join('\n');
}

function roundMetric(value: number) {
  return Math.round(value * 1000) / 1000;
}

function countRatioDifferences(first: Record<string, number>, second: Record<string, number>, minDelta: number) {
  return Object.keys({ ...first, ...second }).filter((key) => {
    return Math.abs((first[key] ?? 0) - (second[key] ?? 0)) >= minDelta;
  });
}

function buildDifferences(first: SajuOutputSimilaritySample, second: SajuOutputSimilaritySample) {
  const differences: string[] = [];

  if (first.dayGanziCode !== second.dayGanziCode) {
    differences.push(`일주 ${first.dayGanziCode} → ${second.dayGanziCode}`);
  }

  if (first.hourGanzi !== second.hourGanzi) {
    differences.push(`시주 ${first.hourGanzi ?? '없음'} → ${second.hourGanzi ?? '없음'}`);
  }

  const elementDiffs = countRatioDifferences(first.fiveElementRatio, second.fiveElementRatio, 5);
  if (elementDiffs.length > 0) {
    differences.push(`오행 차이 ${elementDiffs.join(', ')}`);
  }

  const tenGodDiffs = countRatioDifferences(first.tenGodDistribution, second.tenGodDistribution, 1);
  if (tenGodDiffs.length > 0) {
    differences.push(`십성 차이 ${tenGodDiffs.join(', ')}`);
  }

  if (first.strength !== second.strength) {
    differences.push(`강약 ${first.strength ?? '없음'} → ${second.strength ?? '없음'}`);
  }

  if (first.yongsin !== second.yongsin) {
    differences.push(`용신 ${first.yongsin ?? '없음'} → ${second.yongsin ?? '없음'}`);
  }

  return differences;
}

async function buildSample(slug: string, topic: FocusTopic) {
  const reading = await resolveReading(slug);
  if (!reading) return null;

  const report = buildSajuReport(reading.input, reading.sajuData, topic);
  const grounding = buildSajuInterpretationGrounding(reading.input, reading.sajuData, report);
  const prompt = createInterpretationPrompt(
    grounding,
    {
      topic: report.focusTopic,
      label: report.focusLabel,
      scoreKey: report.focusScoreKey,
    },
    'female',
    null
  );
  const reportText = buildReportSurfaceText(report);
  const personalizationText = buildPersonalizationText(grounding);

  return {
    sample: {
      slug,
      readingId: reading.id,
      input: {
        year: reading.input.year,
        month: reading.input.month,
        day: reading.input.day,
        hour: reading.input.hour ?? null,
        minute: reading.input.minute ?? null,
        gender: reading.input.gender ?? null,
      },
      dayGanziCode: grounding.personalizationContext.dayGanziCode,
      dayGanziHanja: grounding.personalizationContext.dayGanziHanja,
      hourGanzi: reading.sajuData.pillars.hour?.ganzi ?? null,
      fiveElementRatio: grounding.personalizationContext.fiveElementRatio,
      tenGodDistribution: grounding.personalizationContext.tenGodDistribution,
      strength: grounding.personalizationContext.strengthJudgement.일간강약,
      yongsin: grounding.personalizationContext.yongsinKiyshin.용신,
      currentLuck: grounding.personalizationContext.currentLuck.현재대운,
      reportTextLength: reportText.length,
      promptTextLength: prompt.input.length,
    } satisfies SajuOutputSimilaritySample,
    reportText,
    promptText: prompt.input,
    personalizationText,
  };
}

export async function buildSajuOutputSimilarityAudit({
  slugA,
  slugB,
  topic,
}: {
  slugA: string;
  slugB: string;
  topic?: string;
}): Promise<SajuOutputSimilarityAudit | null> {
  const normalizedTopic = normalizeFocusTopic(topic);
  const first = await buildSample(slugA, normalizedTopic);
  const second = await buildSample(slugB, normalizedTopic);

  if (!first || !second) return null;

  const reportTextSimilarity = roundMetric(textSimilarity(first.reportText, second.reportText));
  const promptInputSimilarity = roundMetric(textSimilarity(first.promptText, second.promptText));
  const personalizationSimilarity = roundMetric(
    textSimilarity(first.personalizationText, second.personalizationText)
  );
  const differences = buildDifferences(first.sample, second.sample);

  return {
    topic: normalizedTopic,
    samples: [first.sample, second.sample],
    metrics: {
      reportTextSimilarity,
      promptInputSimilarity,
      personalizationSimilarity,
    },
    differences,
    checks: {
      promptDiverges: promptInputSimilarity <= PROMPT_MAX_SIMILARITY,
      reportDiverges: reportTextSimilarity <= REPORT_MAX_SIMILARITY,
      personalizationDiverges:
        personalizationSimilarity <= PERSONALIZATION_MAX_SIMILARITY && differences.length >= 2,
    },
    threshold: {
      promptMaxSimilarity: PROMPT_MAX_SIMILARITY,
      reportMaxSimilarity: REPORT_MAX_SIMILARITY,
      personalizationMaxSimilarity: PERSONALIZATION_MAX_SIMILARITY,
    },
  };
}
