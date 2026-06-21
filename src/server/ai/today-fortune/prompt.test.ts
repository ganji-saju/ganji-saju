import assert from 'node:assert/strict';
import { createTodayFortunePrompt, buildTodayFortuneFallbackText } from './prompt';
import type { TodayFortuneGrounding } from './grounding';

declare const test: (name: string, fn: () => void) => void;

function makeGrounding(overrides: Partial<TodayFortuneGrounding> = {}): TodayFortuneGrounding {
  return {
    name: '홍길동',
    todayGanzi: '갑자',
    iljinScore: 72,
    iljinGrade: '좋음',
    weakElement: '금 기운',
    strongElement: '목 기운',
    topAreas: [
      { key: 'love', label: '연애', score: 85 },
      { key: 'work', label: '일', score: 70 },
    ],
    triggeredCaseSummaries: ['오늘 좋은 흐름이 발동됩니다'],
    concernLabel: '일반',
    situation: '취업 준비 중',
    ...overrides,
  };
}

test('instructions 에 금지 규칙(단정/한자) 명시', () => {
  const { instructions } = createTodayFortunePrompt(makeGrounding());
  assert.match(instructions, /반드시|단정|한자/);
});

test('input 에 오늘 일진과 관심사가 포함된다', () => {
  const { input } = createTodayFortunePrompt(makeGrounding({ todayGanzi: '갑자', concernLabel: '연애' }));
  assert.ok(input.includes('갑자') && input.includes('연애'));
});

test('instructions 에 doom/공포 금지 규칙이 포함된다', () => {
  const { instructions } = createTodayFortunePrompt(makeGrounding());
  assert.match(instructions, /doom|공포|불안|무조건|절대|100%/);
});

test('instructions 에 JSON 출력 형식(headline, body) 명시', () => {
  const { instructions } = createTodayFortunePrompt(makeGrounding());
  assert.ok(instructions.includes('headline') && instructions.includes('body'));
});

test('input 에 약한 오행 포함', () => {
  const { input } = createTodayFortunePrompt(makeGrounding({ weakElement: '금 기운' }));
  assert.ok(input.includes('금 기운'));
});

test('input 에 발동 케이스 요약 포함', () => {
  const g = makeGrounding({ triggeredCaseSummaries: ['특별한 흐름이 발동됩니다'] });
  const { input } = createTodayFortunePrompt(g);
  assert.ok(input.includes('특별한 흐름이 발동됩니다'));
});

test('buildTodayFortuneFallbackText 는 JSON.stringify({headline, body})', () => {
  const result = buildTodayFortuneFallbackText('오늘은 좋은 날', '흐름이 순탄합니다.');
  assert.equal(result, JSON.stringify({ headline: '오늘은 좋은 날', body: '흐름이 순탄합니다.' }));
});

test('TODAY_FORTUNE_PROMPT_VERSION 은 tf-v1', () => {
  const { TODAY_FORTUNE_PROMPT_VERSION } = require('./prompt');
  assert.equal(TODAY_FORTUNE_PROMPT_VERSION, 'tf-v1');
});
