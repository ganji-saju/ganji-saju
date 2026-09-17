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
  // All four absolute tokens must be present individually (AND — not OR).
  assert.ok(instructions.includes('반드시'), 'instructions must contain 반드시');
  assert.ok(instructions.includes('절대'), 'instructions must contain 절대');
  assert.ok(instructions.includes('100%'), 'instructions must contain 100%');
  assert.ok(instructions.includes('무조건'), 'instructions must contain 무조건');
  // Hanja rule must appear.
  assert.ok(instructions.includes('한자'), 'instructions must contain 한자 rule');
  assert.match(instructions, /한글 원어를 유지/);
  assert.match(instructions, /처음 등장할 때 짧게 설명/);
});

test('input 에 오늘 일진과 관심사가 포함된다', () => {
  const { input } = createTodayFortunePrompt(makeGrounding({ todayGanzi: '갑자', concernLabel: '연애' }));
  assert.ok(input.includes('갑자') && input.includes('연애'));
});

test('instructions 에 doom/공포 금지 규칙이 포함된다', () => {
  const { instructions } = createTodayFortunePrompt(makeGrounding());
  assert.ok(instructions.includes('doom') || instructions.includes('공포') || instructions.includes('불안'), 'instructions must contain doom/공포/불안 rule');
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

test('TODAY_FORTUNE_PROMPT_VERSION 은 tf-v2', () => {
  const { TODAY_FORTUNE_PROMPT_VERSION } = require('./prompt');
  assert.equal(TODAY_FORTUNE_PROMPT_VERSION, 'tf-v2');
});


test('today prompt keeps answers grounded and treats missing personal situations conditionally', () => {
  const prompt = createTodayFortunePrompt(makeGrounding({
    readingDate: '2026-09-18', reasoning: '확인된 당일 관계', choice: '확인한 조건으로 선택',
    answer: '범위를 정해보세요', example: '요청이 겹친다면', lifeStage: 'teen', unknownBirthTime: true,
  }));
  assert.match(prompt.instructions, /질문에 먼저 답/);
  assert.match(prompt.instructions, /입력에 없는 사실은 지어내지/);
  assert.match(prompt.instructions, /점수는 성공.*확률이 아닙니다/);
  for (const text of ['2026-09-18', '확인된 당일 관계', '확인한 조건으로 선택', '범위를 정해보세요', '요청이 겹친다면', '미성년자', '태어난 시간 미상']) assert.ok(prompt.input.includes(text));
});
