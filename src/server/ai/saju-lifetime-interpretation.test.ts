import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import {
  buildLifetimeReport,
  buildSajuInterpretationGrounding,
  buildSajuReport,
} from '@/domain/saju/report';
import { buildPersistedSajuReadingMetadata } from '@/lib/saju/report-metadata';
import type { ReadingRecord } from '@/lib/saju/readings';
import type { BirthInput } from '@/lib/saju/types';
import {
  buildFallbackLifetimeInterpretation,
  createLifetimeInterpretationPrompt,
  getLifetimeInterpretationPromptVersion,
  parseLifetimeInterpretationText,
  renderLifetimeInterpretationReport,
} from './saju-lifetime-interpretation';

declare const test: (name: string, fn: () => void) => void;

const birthInput: BirthInput = {
  year: 1982,
  month: 1,
  day: 29,
  hour: 8,
  minute: 45,
  gender: 'male',
};

function createReadingRecord(): ReadingRecord {
  const sajuData = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, sajuData, 'today');
  const grounding = buildSajuInterpretationGrounding(birthInput, sajuData, report);

  return {
    id: 'lifetime-test-reading',
    userId: null,
    input: birthInput,
    sajuData,
    result: {} as ReadingRecord['result'],
    grounding,
    kasiComparison: null,
    metadata: buildPersistedSajuReadingMetadata(birthInput, sajuData, grounding, null),
  };
}

test('buildFallbackLifetimeInterpretation renders a structured lifetime report with yearly appendix', () => {
  const record = createReadingRecord();
  const lifetimeReport = buildLifetimeReport(record.input, record.sajuData, 2026);
  const interpretation = buildFallbackLifetimeInterpretation(lifetimeReport, 'female');
  const rendered = renderLifetimeInterpretationReport(interpretation, lifetimeReport);

  assert.ok(interpretation.keywords.length >= 3);
  assert.equal(interpretation.rememberRules.length, 5);
  assert.ok(rendered.includes('## 타고난 성향'));
  assert.ok(rendered.includes('## 역할과 보완 힌트'));
  assert.ok(rendered.includes('## 부록: 올해 요약'));
  assert.ok(rendered.length >= 2500);
});

test('parseLifetimeInterpretationText accepts fenced JSON with all lifetime sections', () => {
  const record = createReadingRecord();
  const lifetimeReport = buildLifetimeReport(record.input, record.sajuData, 2026);
  const fallback = buildFallbackLifetimeInterpretation(lifetimeReport, 'male');
  const result = parseLifetimeInterpretationText(
    `\`\`\`json\n${JSON.stringify(fallback)}\n\`\`\``,
    fallback
  );

  assert.equal(result.ok, true);
  assert.equal(result.interpretation.keywords.length >= 3, true);
  assert.equal(result.interpretation.rememberRules.length, 5);
  assert.ok(result.interpretation.sections.majorLuckTimeline.length > 0);
});

test('createLifetimeInterpretationPrompt keeps lifetime report prompt separate from yearly flow', () => {
  const record = createReadingRecord();
  const lifetimeReport = buildLifetimeReport(record.input, record.sajuData, 2026);
  const prompt = createLifetimeInterpretationPrompt(record, lifetimeReport, 'male');
  const grounding = JSON.parse(prompt.input) as Record<string, unknown>;

  assert.equal(getLifetimeInterpretationPromptVersion('male'), 'saju-lifetime-interpret-v1-male');
  assert.match(prompt.instructions, /평생 사주풀이/);
  assert.match(prompt.instructions, /사주 공부 자료가 아니라/);
  assert.match(prompt.instructions, /달빛 남선생/);
  assert.equal('factJson' in grounding, true);
  assert.equal('evidenceJson' in grounding, true);
  assert.equal('kasiComparison' in grounding, true);
  assert.equal(
    'yearlyAppendix' in (grounding.lifetimeEvidence as Record<string, unknown>),
    true
  );
});
