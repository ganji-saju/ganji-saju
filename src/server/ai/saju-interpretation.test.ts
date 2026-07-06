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

test('parseInterpretationText strips hanja leaked from LLM output (interpret has no validator)', () => {
  // LLM 이 입력의 간지(辛巳·壬寅)를 그대로 흘리는 실제 케이스. interpret 경로엔
  // 런타임 한자 validator 가 없으므로 cleanText 스트립이 유일 방어선.
  const result = parseInterpretationText(
    JSON.stringify({
      headline: '壬寅일주, 오늘은 순서로 이긴다',
      summary: '辛巳대운 1년차인 지금, 정리 습관을 들이면 흐름이 안정됩니다.',
      insights: ['용신 火가 약해 말을 삼키기 쉬우니, 짧게라도 먼저 꺼내세요.', '두 번째 통찰입니다.'],
    }),
    fallback
  );

  assert.equal(result.ok, true);
  const all = [
    result.interpretation.headline,
    result.interpretation.summary,
    ...result.interpretation.insights,
  ].join(' ');
  assert.doesNotMatch(all, /[一-鿿]/, '본문에 한자가 남아있으면 안 됩니다');
  // 스트립 후에도 한글 문장은 자연스럽게 유지된다(간지는 뒤 한글 단어에 붙어있어 깔끔히 제거).
  assert.match(result.interpretation.summary, /대운 1년차인 지금/);
  assert.equal(result.interpretation.headline, '일주, 오늘은 순서로 이긴다');
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

  assert.match(interpretation.summary, /흐름|바탕|균형|역할|보완/);
  assert.ok(interpretation.insights.some((item) => /오늘의 방향|강점|주의|흐름|균형/.test(item)));
});

test('createInterpretationPrompt sends personalization, fact, and evidence JSON without report fallback prose', () => {
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

  assert.match(prompt.instructions, /personalizationContext/);
  assert.match(prompt.instructions, /서로 다른 사주가 같은/);
  assert.match(prompt.input, /===사주 원국===/);
  assert.match(prompt.input, /일간:/);
  assert.match(prompt.input, /일주:/);
  assert.match(prompt.input, /년주:/);
  assert.match(prompt.input, /월주:/);
  assert.match(prompt.input, /시주:/);
  assert.match(prompt.input, /오행:/);
  assert.match(prompt.input, /십성:/);
  assert.match(prompt.input, /===이 사주의 고유 특성===/);
  assert.match(prompt.input, /===풀이 지시===/);
  assert.match(prompt.instructions, /factJson/);
  assert.match(prompt.input, /"personalizationContext"/);
  assert.match(prompt.input, /"dayGanziCode"/);
  assert.match(prompt.input, /"factJson"/);
  assert.match(prompt.input, /"evidenceJson"/);
  assert.doesNotMatch(prompt.input, /reportFallback/);
});

test('createInterpretationPrompt makes visibly different source prompts for different birth data', () => {
  const firstData = normalizeToSajuDataV1(birthInput, null);
  const firstReport = buildSajuReport(birthInput, firstData, 'today');
  const firstGrounding = buildSajuInterpretationGrounding(birthInput, firstData, firstReport);
  const secondBirthInput: BirthInput = {
    year: 1995,
    month: 6,
    day: 15,
    hour: 22,
    gender: 'female',
  };
  const secondData = normalizeToSajuDataV1(secondBirthInput, null);
  const secondReport = buildSajuReport(secondBirthInput, secondData, 'today');
  const secondGrounding = buildSajuInterpretationGrounding(secondBirthInput, secondData, secondReport);

  const firstPrompt = createInterpretationPrompt(
    firstGrounding,
    {
      topic: firstReport.focusTopic,
      label: firstReport.focusLabel,
      scoreKey: firstReport.focusScoreKey,
    },
    'female',
    null
  );
  const secondPrompt = createInterpretationPrompt(
    secondGrounding,
    {
      topic: secondReport.focusTopic,
      label: secondReport.focusLabel,
      scoreKey: secondReport.focusScoreKey,
    },
    'female',
    null
  );

  assert.notEqual(firstGrounding.personalizationContext.dayGanziCode, secondGrounding.personalizationContext.dayGanziCode);
  assert.notEqual(firstPrompt.input, secondPrompt.input);
  assert.match(firstPrompt.input, new RegExp(firstGrounding.personalizationContext.dayGanziCode));
  assert.match(secondPrompt.input, new RegExp(secondGrounding.personalizationContext.dayGanziCode));
});
