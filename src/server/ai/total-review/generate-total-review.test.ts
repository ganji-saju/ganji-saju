import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuPersonalizationContext } from '@/domain/saju/report/personalization-context';
import { buildTotalReviewInput } from './build-total-review-input';
import { generateTotalReviewSection } from './generate-total-review';
import type { ChapterLLMClient } from '../chapters/generate-chapter';

// 2026-05-21 — 섹션 생성 오케스트레이터 검증 (mock client, 실제 LLM 호출 없음).

declare const test: (name: string, fn: () => void | Promise<void>) => void;

function clientReturning(...responses: string[]): ChapterLLMClient {
  let i = 0;
  return {
    async generate() {
      const idx = Math.min(i, responses.length - 1);
      i += 1;
      return responses[idx] ?? '';
    },
  };
}

function fixtureInput() {
  const data = calculateSajuDataV1({ year: 1999, month: 4, day: 1, hour: 14, gender: 'female' });
  const ctx = buildSajuPersonalizationContext(data, {
    relationshipStatus: 'married',
    occupation: 'employee',
    currentConcern: 'wealth',
    concernNote: null,
  });
  return buildTotalReviewInput(data, ctx, { userName: '테스트', gender: 'F' });
}

const GOOD_ONE_LINE = JSON.stringify({
  one_line_summary: '조용히 살피고 흐르는 사주, 단단한 기준 하나가 평생을 받쳐줍니다',
});
const GOOD_MAIN = JSON.stringify({
  // 본문 25~35문장 enforce(validateTotalReviewSection)에 맞춘 28문장.
  main_narrative: {
    paragraph_1_who_you_are:
      '부드럽게 흐르는 성향이에요. 주변을 먼저 잘 살핍니다. 큰 소리보다 조용한 관찰이 익숙해요. 사람들의 분위기를 빠르게 읽어냅니다. 급하게 단정하기보다 한 박자 두고 봅니다. 그 신중함이 신뢰를 만들어요. 다만 속도가 느리다는 말도 듣습니다.',
    paragraph_2_strong_environment:
      '살피는 자리에서 강점이 드러나요. 조율하고 정리하는 역할이 잘 맞습니다. 직장에서도 중간에서 흐름을 잡아줍니다. 사람 사이의 거리감을 잘 맞춰요. 꾸준히 쌓는 일에서 인정을 받습니다. 갑작스러운 경쟁보다 안정된 환경이 편해요. 그런 곳에서 오래 빛납니다.',
    paragraph_3_weak_zone:
      '단호함이 흐려질 때 약합니다. 거절을 미루다 일을 떠안기 쉬워요. 마음에 담아두고 표현을 아낍니다. 그러다 서운함이 늦게 터지기도 해요. 기준을 또렷이 세우면 한결 편해집니다. 작은 거절을 연습으로 삼아보세요. 끊고 맺는 힘이 보강 포인트예요.',
    paragraph_4_now:
      '지금 10년은 드러나는 시기예요. 안에 있던 강점이 밖으로 나옵니다. 작은 선택을 꾸준히 쌓으세요. 한 번에 큰 결정보다 단계가 안전합니다. 가까운 사람과의 약속을 먼저 챙기세요. 기록하고 점검하는 습관이 힘이 됩니다. 무리하지 않는 선에서 한 걸음씩 나아가세요.',
  },
});
const GOOD_KEYS = JSON.stringify({
  lifetime_keys: [
    { title: '관찰하는 자리', subtitle: '흐름을 보는 역할', body: '전체를 살피는 영역에서 강점이 드러나요.' },
    { title: '단호함', subtitle: '거절의 기준', body: '받지 않을 일의 기준을 적어두세요.' },
    { title: '구조 들이기', subtitle: '손에 잡히는 도구', body: '체크리스트와 예산표가 보강이 됩니다.' },
  ],
});

const FB_ONE_LINE = { one_line_summary: '차분히 흐르는 사주, 작은 기준 하나가 평생을 받쳐줍니다' };

test('generateTotalReviewSection: 유효 JSON + 검증 통과 시 LLM 결과 반환', async () => {
  const r = await generateTotalReviewSection('one_line_summary', fixtureInput(), clientReturning(GOOD_ONE_LINE), {
    fallback: FB_ONE_LINE,
  });
  assert.equal(r.source, 'llm');
  assert.equal(r.retries, 0);
  assert.ok(r.value.one_line_summary.length > 0);
});

test('generateTotalReviewSection: 한자 누출 반복 시 maxRetries 후 fallback', async () => {
  const bad = JSON.stringify({ one_line_summary: '癸未 일주의 흐름을 가진 사주예요' });
  const r = await generateTotalReviewSection('one_line_summary', fixtureInput(), clientReturning(bad), {
    maxRetries: 1,
    fallback: FB_ONE_LINE,
  });
  assert.equal(r.source, 'fallback');
  assert.deepEqual(r.value, FB_ONE_LINE);
  assert.ok(r.reasons.some((x) => x.includes('한자')));
});

test('generateTotalReviewSection: 첫 시도 파싱 실패 후 재시도 성공', async () => {
  const r = await generateTotalReviewSection('main_narrative', fixtureInput(), clientReturning('이건 JSON 이 아니에요', GOOD_MAIN), {
    maxRetries: 2,
    fallback: { main_narrative: { paragraph_1_who_you_are: 'a', paragraph_2_strong_environment: 'b', paragraph_3_weak_zone: 'c', paragraph_4_now: 'd' } },
  });
  assert.equal(r.source, 'llm');
  assert.equal(r.retries, 1);
  assert.ok(r.value.main_narrative.paragraph_1_who_you_are.length > 0);
});

test('generateTotalReviewSection: lifetime_keys 3카드 정상 생성', async () => {
  const r = await generateTotalReviewSection('lifetime_keys', fixtureInput(), clientReturning(GOOD_KEYS), {
    fallback: { lifetime_keys: [] },
  });
  assert.equal(r.source, 'llm');
  assert.equal(r.value.lifetime_keys.length, 3);
});

test('generateTotalReviewSection: LLM 호출 throw 시 fallback', async () => {
  const throwingClient: ChapterLLMClient = {
    async generate() {
      throw new Error('API down');
    },
  };
  const r = await generateTotalReviewSection('one_line_summary', fixtureInput(), throwingClient, {
    maxRetries: 1,
    fallback: FB_ONE_LINE,
  });
  assert.equal(r.source, 'fallback');
  assert.ok(r.reasons.some((x) => x.includes('호출 실패')));
});
