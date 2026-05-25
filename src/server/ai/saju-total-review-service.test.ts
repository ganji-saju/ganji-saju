import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuPersonalizationContext } from '@/domain/saju/report/personalization-context';
import { generateTotalReview } from './saju-total-review-service';
import type { ChapterLLMClient } from './chapters/generate-chapter';
import { createInMemoryTotalReviewCacheStore } from './total-review/total-review-cache-store';

// 2026-05-21 — 총평 서비스 오케스트레이션 검증 (mock client, 플래그 주입).

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const ENV_ON = { OPENAI_INTERPRET_TOTAL_REVIEW: '1' } as unknown as NodeJS.ProcessEnv;
const ENV_OFF = {} as NodeJS.ProcessEnv;

function fixture() {
  const sajuData = calculateSajuDataV1({ year: 1999, month: 4, day: 1, hour: 14, gender: 'female' });
  const personalizationContext = buildSajuPersonalizationContext(sajuData, {
    relationshipStatus: 'married',
    occupation: 'employee',
    currentConcern: 'wealth',
    concernNote: null,
  });
  return { sajuData, personalizationContext };
}

const SECTIONS_GOOD = {
  oneLine: JSON.stringify({ one_line_summary: '조용히 살피고 흐르는 사주, 단단한 기준 하나가 평생을 받쳐줍니다' }),
  main: JSON.stringify({
    // 본문 25~35문장 enforce(validateTotalReviewSection)에 맞춘 28문장 모범 답안.
    main_narrative: {
      paragraph_1_who_you_are:
        '부드럽게 흐르는 성향이에요. 주변을 먼저 잘 살핍니다. 큰 소리보다 조용한 관찰이 익숙해요. 사람들의 분위기를 빠르게 읽어냅니다. 급하게 단정하기보다 한 박자 두고 봅니다. 그 신중함이 신뢰를 만들어요. 다만 속도가 느리다는 말도 듣습니다.',
      paragraph_2_strong_environment:
        '살피는 자리에서 강점이 드러나요. 조율하고 정리하는 역할이 잘 맞습니다. 직장에서도 중간에서 흐름을 잡아줍니다. 사람 사이의 거리감을 잘 맞춰요. 꾸준히 쌓는 일에서 인정을 받습니다. 갑작스러운 경쟁보다 안정된 환경이 편해요. 그런 곳에서 오래 빛납니다.',
      paragraph_3_weak_zone:
        '단호함이 흐려질 때 약합니다. 거절을 미루다 일을 떠안기 쉬워요. 마음에 담아두고 표현을 아낍니다. 그러다 서운함이 늦게 터지기도 해요. 기준을 또렷이 세우면 한결 편해집니다. 작은 거절을 연습으로 삼아보세요. 끊고 맺는 힘이 보강 포인트예요.',
      paragraph_4_now:
        '지금 10년은 드러나는 시기예요. 안에 있던 강점이 밖으로 나옵니다. 재물과 투자는 작은 선택을 쌓으세요. 한 번에 큰 결정보다 단계가 안전합니다. 가까운 사람과의 약속을 먼저 챙기세요. 기록하고 점검하는 습관이 힘이 됩니다. 무리하지 않는 선에서 한 걸음씩 나아가세요.',
    },
  }),
  keys: JSON.stringify({
    lifetime_keys: [
      { title: '관찰하는 자리', subtitle: '흐름을 보는 역할', body: '전체를 살피는 영역에서 강점이 드러나요.' },
      { title: '단호함', subtitle: '거절의 기준', body: '받지 않을 일의 기준을 적어두세요.' },
      { title: '구조 들이기', subtitle: '손에 잡히는 도구', body: '체크리스트와 예산표가 보강이 됩니다.' },
    ],
  }),
};

function sectionAwareClient(map: { oneLine: string; main: string; keys: string }): ChapterLLMClient {
  return {
    async generate(_systemPrompt: string, userMessage: string) {
      if (userMessage.includes('단락 1')) return map.main;
      if (userMessage.includes('카드 1')) return map.keys;
      return map.oneLine;
    },
  };
}

test('generateTotalReview: 플래그 OFF → deterministic fallback', async () => {
  const { sajuData, personalizationContext } = fixture();
  const result = await generateTotalReview({
    sajuData,
    personalizationContext,
    userName: '테스트',
    env: ENV_OFF,
  });
  assert.equal(result.source, 'fallback');
  assert.ok(result.output.one_line_summary.length > 0);
  assert.equal(result.output.lifetime_keys.length, 0);
  assert.ok(result.meta.cacheKey.length === 64); // sha256 hex
});

test('generateTotalReview: 플래그 ON + 정상 LLM → source llm + 3섹션 조립', async () => {
  const { sajuData, personalizationContext } = fixture();
  const result = await generateTotalReview({
    sajuData,
    personalizationContext,
    userName: '테스트',
    gender: 'F',
    env: ENV_ON,
    client: sectionAwareClient(SECTIONS_GOOD),
    cacheStore: createInMemoryTotalReviewCacheStore(),
  });
  assert.equal(result.source, 'llm');
  assert.ok(result.output.main_narrative.paragraph_1_who_you_are.includes('부드럽게'));
  assert.equal(result.output.lifetime_keys.length, 3);
});

test('generateTotalReview: 플래그 ON + 한자 누출 → hard 위반 deterministic fallback', async () => {
  const { sajuData, personalizationContext } = fixture();
  const result = await generateTotalReview({
    sajuData,
    personalizationContext,
    userName: '테스트',
    env: ENV_ON,
    maxRetries: 1,
    client: sectionAwareClient({
      ...SECTIONS_GOOD,
      oneLine: JSON.stringify({ one_line_summary: '癸未 일주의 사주예요' }),
    }),
    cacheStore: createInMemoryTotalReviewCacheStore(),
  });
  assert.equal(result.source, 'fallback');
  assert.equal(result.output.lifetime_keys.length, 0);
  assert.ok(!/[一-鿿]/.test(result.output.one_line_summary), '폴백 출력에 한자 없음');
});

function countingClient(map: { oneLine: string; main: string; keys: string }) {
  const client = {
    calls: 0,
    async generate(_systemPrompt: string, userMessage: string) {
      client.calls += 1;
      if (userMessage.includes('단락 1')) return map.main;
      if (userMessage.includes('카드 1')) return map.keys;
      return map.oneLine;
    },
  };
  return client;
}

test('generateTotalReview: 캐시 hit — 2번째 호출은 OpenAI 미호출 + source cache', async () => {
  const { sajuData, personalizationContext } = fixture();
  const cacheStore = createInMemoryTotalReviewCacheStore();
  const client = countingClient(SECTIONS_GOOD);
  const common = {
    sajuData,
    personalizationContext,
    userName: '테스트',
    gender: 'F' as const,
    env: ENV_ON,
    client,
    cacheStore,
  };

  const r1 = await generateTotalReview(common);
  assert.equal(r1.source, 'llm');
  const callsAfterFirst = client.calls;
  assert.ok(callsAfterFirst >= 3, `첫 호출은 3섹션 생성: ${callsAfterFirst}`);

  const r2 = await generateTotalReview(common);
  assert.equal(r2.source, 'cache');
  assert.equal(client.calls, callsAfterFirst, '캐시 hit 시 추가 OpenAI 호출 없어야 함');
  assert.deepEqual(r2.output, r1.output);
});

test('generateTotalReview: fallback 결과는 캐시하지 않는다 (다음 호출 재생성)', async () => {
  const { sajuData, personalizationContext } = fixture();
  const cacheStore = createInMemoryTotalReviewCacheStore();
  const client = countingClient({
    ...SECTIONS_GOOD,
    oneLine: JSON.stringify({ one_line_summary: '癸未 사주' }),
  });
  const common = {
    sajuData,
    personalizationContext,
    userName: '테스트',
    env: ENV_ON,
    maxRetries: 1,
    client,
    cacheStore,
  };

  const r1 = await generateTotalReview(common);
  assert.equal(r1.source, 'fallback');
  const callsAfterFirst = client.calls;

  const r2 = await generateTotalReview(common);
  assert.equal(r2.source, 'fallback');
  assert.ok(client.calls > callsAfterFirst, '캐시되지 않아 재호출이 발생해야 함');
});

