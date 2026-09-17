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
import { koreanizeGanzi } from '@/lib/saju/terminology';
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
    chaptersEnvelope: null,
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

  assert.equal(getLifetimeInterpretationPromptVersion('male'), 'saju-lifetime-interpret-v2-questions-male');
  assert.match(prompt.instructions, /평생 사주풀이/);
  assert.match(prompt.instructions, /사주 공부 자료가 아니라/);
  assert.match(prompt.instructions, /남선생/);
  assert.match(prompt.instructions, /핵심 장에 우선 배정/);
  assert.match(prompt.instructions, /월별 풀이를 추가하지 않는다/);
  assert.match(prompt.instructions, /연도 나이를 사용한다/);
  assert.match(prompt.instructions, /cycles가 비어 있거나 현재 대운이 없으면/);
  assert.equal('factJson' in grounding, true);
  assert.equal('evidenceJson' in grounding, true);
  assert.equal('kasiComparison' in grounding, true);
  assert.equal(
    'yearlyAppendix' in (grounding.lifetimeEvidence as Record<string, unknown>),
    true
  );
});

test('lifetime prompt uses calendar ages throughout duplicate luck grounding without mutating the reading', () => {
  const record = createReadingRecord();
  const before = structuredClone(record);
  const report = buildLifetimeReport(record.input, record.sajuData, 2026);
  const prompt = createLifetimeInterpretationPrompt(record, report, 'male');
  const grounding = JSON.parse(prompt.input);
  assert.equal(grounding.readingContext.calendarAge, 44);
  assert.equal(grounding.currentLuck.currentMajorLuck.startAge, 37);
  assert.equal(grounding.currentLuck.currentMajorLuck.endAge, 46);
  assert.deepEqual(grounding.factJson.luckCycles.majorLuck, grounding.majorLuck);
  assert.deepEqual(grounding.factJson.luckCycles.currentLuck, grounding.currentLuck);
  assert.deepEqual(grounding.evidenceJson.luckFlow.currentMajorLuckNotes, grounding.currentLuck.currentMajorLuck.notes);
  assert.doesNotMatch(grounding.evidenceJson.luckFlow.saewoonNotes.join(' '), /현재 대운 정보 나이는/);
  assert.match(grounding.evidenceJson.luckFlow.currentMajorLuckNotes.join(' '), /연도 나이 37세부터 46세/);
  assert.deepEqual(record, before);
});

test('lifetime final refuses thin or daily-only core sections while retaining grounded fallback', () => {
  const record = createReadingRecord();
  const report = buildLifetimeReport(record.input, record.sajuData, 2026);
  const fallback = buildFallbackLifetimeInterpretation(report);
  for (const key of ['wealthStyle', 'careerDirection', 'relationshipPattern'] as const) {
    for (const replacement of ['생활의 리듬을 잘 유지하세요.', `오늘은 고정비부터 확인하세요. ${fallback.sections[key]}`]) {
      const result = parseLifetimeInterpretationText(JSON.stringify({ ...fallback, sections: { ...fallback.sections, [key]: replacement } }), fallback);
      assert.equal(result.ok, false);
      assert.equal(result.interpretation, fallback);
    }
    assert.ok(fallback.sections[key].length >= 500);
  }
  assert.ok(fallback.sections.wealthStyle.includes(report.wealthStyle.keepingStyle));
  assert.ok(fallback.sections.careerDirection.includes(report.careerDirection.recognitionStyle));
  assert.ok(fallback.sections.relationshipPattern.includes(report.relationshipPattern.longevityGuide));
});

test('lifetime normalization retains original ten-god and strength explanations', () => {
  const record = createReadingRecord();
  const report = buildLifetimeReport(record.input, record.sajuData, 2026);
  const explanation = '정관에서는 합의된 기준을, 편관에서는 도전과 부담의 조절을 살펴봅니다. 신강은 자기 기준을 유지하는 힘을 읽는 말입니다. 壬子 일주만으로 성격을 확정하지 않습니다.';
  report.coreIdentity.reactionStyle = explanation;
  const fallback = buildFallbackLifetimeInterpretation(report);
  const normalized = parseLifetimeInterpretationText(JSON.stringify(fallback), fallback);
  assert.equal(normalized.ok, true);
  assert.ok(normalized.interpretation.sections.coreIdentity.includes(koreanizeGanzi(explanation)));
  assert.match(normalized.interpretation.sections.coreIdentity, /정관.*편관.*신강은.*임자/);
  assert.doesNotMatch(normalized.interpretation.sections.coreIdentity, /責|壬|子|책임·도전 역할/);
});
