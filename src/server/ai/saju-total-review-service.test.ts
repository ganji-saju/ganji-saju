import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuPersonalizationContext } from '@/domain/saju/report/personalization-context';
import { generateTotalReview } from './saju-total-review-service';
import type { ChapterLLMClient } from './chapters/generate-chapter';

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
    main_narrative: {
      paragraph_1_who_you_are: '부드럽게 흐르는 성향이에요. 주변을 먼저 잘 살핍니다.',
      paragraph_2_strong_environment: '살피는 자리에서 강점이 드러나요. 직장에서도 잘 맞아요.',
      paragraph_3_weak_zone: '단호함이 흐려질 때 약합니다. 거절을 미루기 쉬워요.',
      paragraph_4_now: '지금 10년은 드러나는 시기예요. 재물과 투자는 작은 선택을 쌓으세요.',
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
  });
  assert.equal(result.source, 'fallback');
  assert.equal(result.output.lifetime_keys.length, 0);
  assert.ok(!/[一-鿿]/.test(result.output.one_line_summary), '폴백 출력에 한자 없음');
});
