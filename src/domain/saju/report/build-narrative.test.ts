import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuPersonalizationContext } from './personalization-context';
import { buildSajuNarrative } from './build-narrative';

declare const test: (name: string, fn: () => void) => void;

test('buildSajuNarrative produces single-paragraph narrative with day pillar + pattern + yongsin', () => {
  // 2026-05-15 P2: 5명 부정 피드백 진단상 한국 사주 사이트와의 큰 갭은 결과 페이지가
  // 일주·격국·용신을 독립 카드로 흩어 보여줘 인과 narrative 가 없는 점. 본 빌더가
  // 한 단락으로 엮어주는지 회귀 가드.
  const data = calculateSajuDataV1({
    year: 1982,
    month: 1,
    day: 29,
    hour: 8,
    gender: 'male',
  });
  const context = buildSajuPersonalizationContext(data);

  const narrative = buildSajuNarrative(data, context);

  // 1) headline: 일주 라벨이 들어가야 함.
  assert.ok(narrative.headline.length > 0);
  assert.ok(
    /일주/.test(narrative.headline),
    `headline 에 "일주" 라벨이 들어가야 합니다: ${narrative.headline}`
  );

  // 2) body: 본문이 최소 30자 이상 그리고 격국 / 용신 / 대운 / 세운 중 하나는 인용.
  assert.ok(narrative.body.length >= 30, `body 가 너무 짧습니다: ${narrative.body}`);
  assert.ok(
    /격|용신|보완|대운|세운|월운/.test(narrative.body),
    `body 에 격국/용신/대운 중 하나는 인용되어야 합니다: ${narrative.body}`
  );

  // 3) chips: 최소 일주 + 1개는 더 있어야 함.
  assert.ok(narrative.chips.length >= 2, `chips 가 최소 2개 이상이어야 합니다: ${narrative.chips.length}`);
  assert.ok(
    narrative.chips.some((chip) => chip.label === '일주'),
    'chips 에 일주 라벨이 반드시 포함'
  );
});

test('buildSajuNarrative is deterministic for the same input', () => {
  const data = calculateSajuDataV1({
    year: 1990,
    month: 6,
    day: 15,
    hour: 14,
    gender: 'female',
  });
  const context = buildSajuPersonalizationContext(data);

  const a = buildSajuNarrative(data, context);
  const b = buildSajuNarrative(data, context);

  assert.equal(a.headline, b.headline);
  assert.equal(a.body, b.body);
  assert.deepEqual(a.chips, b.chips);
});

test('buildSajuNarrative gracefully handles missing personalization context', () => {
  // unknownTime / 출생 정보 일부 누락 등으로 sixtyGapja 가 없는 경우에도 narrative 가 빌더.
  const data = calculateSajuDataV1({
    year: 1985,
    month: 12,
    day: 7,
    gender: 'male',
  });

  const narrative = buildSajuNarrative(data, null);

  assert.ok(narrative.headline.length > 0);
  // body 는 비어 있을 수도 있지만 headline 은 항상 있어야 함.
  assert.ok(Array.isArray(narrative.chips));
});

test('buildSajuNarrative differs across different birth inputs', () => {
  // 다른 사주는 다른 narrative 가 나와야 함.
  const dataA = calculateSajuDataV1({ year: 1982, month: 1, day: 29, hour: 8, gender: 'male' });
  const dataB = calculateSajuDataV1({ year: 1995, month: 7, day: 14, hour: 22, gender: 'female' });
  const contextA = buildSajuPersonalizationContext(dataA);
  const contextB = buildSajuPersonalizationContext(dataB);

  const narrativeA = buildSajuNarrative(dataA, contextA);
  const narrativeB = buildSajuNarrative(dataB, contextB);

  assert.notEqual(narrativeA.headline, narrativeB.headline);
});
