import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuInterpretationGrounding, buildSajuReport } from '@/domain/saju/report';
import type { BirthInput } from '@/lib/saju/types';
import {
  buildFallbackInterpretation,
  createInterpretationPrompt,
  parseInterpretationText,
  type SajuAiInterpretation,
} from './saju-interpretation';
import type { SajuReport } from '@/domain/saju/report/types';

declare const test: (name: string, fn: () => void) => void;

const fallback: SajuAiInterpretation = {
  headline: '기본 제목',
  summary: '기본 요약입니다.',
  insights: ['기본 통찰'],
};

const birthInput: BirthInput = {
  year: 1982,
  month: 1,
  day: 29,
  hour: 8,
  gender: 'male',
};

test('parseInterpretationText accepts fenced JSON and normalizes fields', () => {
  const result = parseInterpretationText(
    '```json\n{"headline":"  새 제목  ","summary":"첫 문장.\\n둘째 문장.","insights":[" 하나 ","둘","셋","넷","다섯"]}\n```',
    fallback
  );

  assert.equal(result.ok, true);
  assert.equal(result.interpretation.headline, '새 제목');
  assert.equal(result.interpretation.summary, '첫 문장. 둘째 문장.');
  assert.deepEqual(result.interpretation.insights, ['하나', '둘', '셋', '넷']);
});

test('parseInterpretationText falls back when JSON is malformed', () => {
  const result = parseInterpretationText('not json', fallback);

  assert.equal(result.ok, false);
  assert.deepEqual(result.interpretation, fallback);
  assert.ok(result.errorMessage);
});

test('buildFallbackInterpretation derives compact insight copy from report', () => {
  const report = {
    headline: '오늘은 균형을 잡는 날',
    summary: '요약 문장입니다.',
    summaryHighlights: ['요약 1', '요약 2'],
    insights: [
      { title: '강점', eyebrow: '근거', body: '목 기운을 먼저 활용합니다.' },
      { title: '주의', eyebrow: '근거', body: '급한 결정은 줄입니다.' },
    ],
  } as SajuReport;

  const interpretation = buildFallbackInterpretation(report, 'male');
  const alternate = buildFallbackInterpretation(report, 'female');

  assert.equal(interpretation.headline, report.headline);
  assert.equal(interpretation.summary, `핵심부터 보면, ${report.summary}`);
  assert.equal(alternate.summary, `흐름을 차분히 읽어보면, ${report.summary}`);
  assert.deepEqual(interpretation.insights, [
    '강점: 목 기운을 먼저 활용합니다.',
    '주의: 급한 결정은 줄입니다.',
  ]);
});

test('buildFallbackInterpretation can derive summary and insights from grounding evidence', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, data, 'today');
  const grounding = buildSajuInterpretationGrounding(birthInput, data, report);

  const interpretation = buildFallbackInterpretation(report, 'female', grounding);

  assert.match(interpretation.summary, /흐름|균형|역할|보완/);
  assert.ok(interpretation.insights.some((item) => /흐름|균형|역할|관계|보완/.test(item)));
});

test('createInterpretationPrompt now sends fact and evidence JSON without report fallback prose', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, data, 'today');
  const grounding = buildSajuInterpretationGrounding(birthInput, data, report);

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

  assert.match(prompt.instructions, /factJson과 evidenceJson/);
  assert.match(prompt.input, /"factJson"/);
  assert.match(prompt.input, /"evidenceJson"/);
  assert.doesNotMatch(prompt.input, /reportFallback/);
});
