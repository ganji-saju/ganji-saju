import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import {
  buildSajuInterpretationGrounding,
  buildSajuReport,
  buildYearlyReport,
} from '@/domain/saju/report';
import { buildPersistedSajuReadingMetadata } from '@/lib/saju/report-metadata';
import type { ReadingRecord } from '@/lib/saju/readings';
import type { BirthInput } from '@/lib/saju/types';
import {
  buildFallbackYearlyInterpretation,
  buildFallbackYearlyNarrativeInterpretation,
  createYearlyInterpretationPrompt,
  getYearlyInterpretationPromptVersion,
  mergeYearlyInterpretationSections,
  parseYearlyMonthlyFlowsText,
  parseYearlyNarrativeInterpretationText,
  parseYearlyInterpretationText,
  renderYearlyInterpretationReport,
  type SajuYearlyAiInterpretation,
} from './saju-yearly-interpretation';

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
    id: 'yearly-test-reading',
    userId: null,
    input: birthInput,
    sajuData,
    result: {} as ReadingRecord['result'],
    grounding,
    kasiComparison: null,
    metadata: buildPersistedSajuReadingMetadata(birthInput, sajuData, grounding, null),
  };
}

test('parseYearlyInterpretationText accepts fenced JSON and keeps all required long-form sections', () => {
  const sample: SajuYearlyAiInterpretation = {
    opening:
      '2026년은 정리와 확장의 순서를 다시 세우게 되는 해입니다. 서두를수록 흔들리고, 기준을 세울수록 흐름이 길게 붙습니다.',
    keywords: [
      '기준 재정비: 속도보다 방향을 먼저 바로잡는 해입니다.',
      '관계 조율: 가까운 사람과의 말 순서가 성패를 가릅니다.',
      '재물 구조: 수입 확대보다 지출 구조를 점검해야 합니다.',
    ],
    firstHalf:
      '상반기에는 준비해 온 것을 꺼내되, 모든 것을 한꺼번에 벌리기보다 핵심 한두 가지를 확실히 잡는 편이 좋습니다.',
    secondHalf:
      '하반기에는 상반기에 정리한 기준이 실제 생활과 일의 구조로 굳어집니다. 타이밍을 앞당기기보다 유지 가능한 선택을 고르는 편이 안정적입니다.',
    categories: {
      work: '일과 직업에서는 맡을 역할의 선명도가 중요합니다. 해야 할 일과 하지 않을 일을 분명히 가를수록 성과가 또렷해집니다.',
      wealth: '재물에서는 큰돈의 환상보다 지출 구조와 약속된 금액을 먼저 점검하는 쪽이 훨씬 실속 있습니다.',
      love: '연애와 결혼운은 감정의 확신을 강요하기보다, 말의 온도와 거리감 조절이 관계의 질을 결정하는 흐름입니다.',
      relationship: '인간관계는 짧은 말 한마디의 순서가 중요합니다. 서운함을 결론처럼 말하지 않는 태도가 관계를 지킵니다.',
      health: '건강운은 체력보다 리듬입니다. 수면과 식사, 회복 루틴이 흐트러지면 작은 피로가 오래 갑니다.',
      move: '이동과 변화운은 충동보다 설계가 우선입니다. 자리를 바꾸기 전 이유와 순서를 먼저 점검하는 편이 좋습니다.',
    },
    monthlyFlows: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      summary: `${index + 1}월은 해당 달의 흐름을 현실적인 선택과 관계 조정으로 읽어야 하는 시기입니다.`,
    })),
    goodPeriods: ['2월, 3월: 계획을 세우고 시작한 일이 자리를 잡기 쉽습니다.'],
    cautionPeriods: ['10월, 11월: 피로와 관계 오해가 겹치기 쉬워 속도를 늦출 필요가 있습니다.'],
    actionAdvice: [
      '기준이 흔들리는 날일수록 결정을 미루기보다 메모로 정리하세요.',
      '관계의 온도는 긴 대화보다 짧고 분명한 확인으로 지키는 편이 좋습니다.',
      '지출은 감정이 올라온 날보다 하루 지난 뒤 다시 보는 습관이 유리합니다.',
    ],
    oneLineSummary: '2026년은 빨리 가는 해가 아니라, 기준을 세운 사람이 끝내 앞서는 해입니다.',
  };

  const result = parseYearlyInterpretationText(
    `\`\`\`json\n${JSON.stringify(sample)}\n\`\`\``,
    sample
  );

  assert.equal(result.ok, true);
  assert.equal(result.interpretation.monthlyFlows.length, 12);
  assert.equal(result.interpretation.monthlyFlows[0]?.month, 1);
  assert.equal(result.interpretation.monthlyFlows[11]?.month, 12);
  assert.equal(result.interpretation.keywords.length, 3);
});

test('buildFallbackYearlyInterpretation renders a premium-length yearly report from evidence JSON alone', () => {
  const record = createReadingRecord();
  const yearlyReport = buildYearlyReport(record.input, record.sajuData, 2026);
  const interpretation = buildFallbackYearlyInterpretation(yearlyReport, 'female');
  const rendered = renderYearlyInterpretationReport(interpretation);

  assert.ok(interpretation.keywords.length >= 3);
  assert.equal(interpretation.monthlyFlows.length, 12);
  assert.ok(rendered.startsWith(interpretation.opening));
  assert.ok(rendered.includes('## 올해 핵심 키워드'));
  assert.ok(rendered.includes('## 일·직업운'));
  assert.ok(rendered.includes('### 12월'));
  assert.ok(rendered.includes('## 올해의 한 줄 요약'));
  assert.ok(rendered.length >= 3000);
});

test('yearly narrative and monthly parsers can be merged back into one report', () => {
  const record = createReadingRecord();
  const yearlyReport = buildYearlyReport(record.input, record.sajuData, 2026);
  const fallback = buildFallbackYearlyInterpretation(yearlyReport, 'female');
  const narrative = buildFallbackYearlyNarrativeInterpretation(fallback);
  const parsedNarrative = parseYearlyNarrativeInterpretationText(
    JSON.stringify(narrative),
    narrative
  );
  const parsedMonthly = parseYearlyMonthlyFlowsText(
    JSON.stringify({ monthlyFlows: fallback.monthlyFlows }),
    fallback.monthlyFlows
  );

  assert.equal(parsedNarrative.ok, true);
  assert.equal(parsedMonthly.ok, true);
  assert.equal(parsedMonthly.monthlyFlows.length, 12);

  const merged = mergeYearlyInterpretationSections(
    parsedNarrative.interpretation,
    parsedMonthly.monthlyFlows
  );

  assert.equal(merged.keywords.length >= 3, true);
  assert.equal(merged.monthlyFlows[11]?.month, 12);
});

test('createYearlyInterpretationPrompt grounds narrative and monthly passes on yearly evidence and counselor voice', () => {
  const record = createReadingRecord();
  const yearlyReport = buildYearlyReport(record.input, record.sajuData, 2026);
  const narrativePrompt = createYearlyInterpretationPrompt(record, yearlyReport, 'male', 'narrative');
  const monthlyPrompt = createYearlyInterpretationPrompt(record, yearlyReport, 'male', 'monthly');
  const narrativeGrounding = JSON.parse(narrativePrompt.input) as Record<string, unknown>;
  const monthlyGrounding = JSON.parse(monthlyPrompt.input) as Record<string, unknown>;

  assert.equal(getYearlyInterpretationPromptVersion('male'), 'saju-yearly-interpret-v7-male');
  assert.match(narrativePrompt.instructions, /한 해 흐름을 쉽게 이해하도록 정리하는 생활 조언 에디터/);
  assert.match(narrativePrompt.instructions, /남선생/);
  assert.match(monthlyPrompt.instructions, /monthlyFlows만 작성/);
  assert.equal(narrativeGrounding.targetYear, 2026);
  assert.equal(
    (monthlyGrounding.yearlyEvidence as { monthlyFlows: unknown[] }).monthlyFlows.length,
    12
  );
  assert.equal('factJson' in narrativeGrounding, true);
  assert.equal('evidenceJson' in narrativeGrounding, true);
  assert.equal('kasiComparison' in narrativeGrounding, true);
  assert.equal(
    'monthlyFlows' in (narrativeGrounding.yearlyEvidence as Record<string, unknown>),
    false
  );
});
