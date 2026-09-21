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

test('질문 풀이: 같은 일간이어도 원국에 따라 근거와 선택 기준이 달라진다', () => {
  const a = calculateSajuDataV1({ year: 1982, month: 1, day: 29, hour: 8, gender: 'male' }, { calculatedAt: '2026-09-18T00:00:00Z' });
  const b = calculateSajuDataV1({ year: 1982, month: 2, day: 8, hour: 8, gender: 'male' }, { calculatedAt: '2026-09-18T00:00:00Z' });
  assert.equal(a.dayMaster.stem, b.dayMaster.stem);
  const read = (data: typeof a) => buildSajuNarrative(data, buildSajuPersonalizationContext(data));
  const first = read(a);
  const second = read(b);
  assert.equal(first.questions.length, 4);
  for (const item of first.questions) {
    for (const key of ['answer', 'evidence', 'example', 'choice'] as const) assert.ok(item[key].length > 15);
  }
  assert.notDeepEqual(first.questions.map((q) => q.evidence), second.questions.map((q) => q.evidence));
  assert.notDeepEqual(first.questions.map((q) => q.choice), second.questions.map((q) => q.choice));
  assert.ok(!/[\u3400-\u9fff]/u.test(first.body));
  assert.ok(!/계미 일간|갑자 일간/u.test(first.body));
  assert.doesNotMatch(first.body, /오늘은|중화은/);
});

test('질문 풀이: 생시·성별·현재 상황 미입력의 어린이에게 가짜 대운과 성인 상황을 만들지 않는다', () => {
  const data = calculateSajuDataV1({ year: 2020, month: 2, day: 29 }, { calculatedAt: '2026-09-18T00:00:00Z' });
  const result = buildSajuNarrative(data, null);
  assert.match(result.body, /보호자/);
  assert.match(result.body, /대운은 미산정/);
  assert.match(result.body, /태어난 시간이 없어/);
  assert.doesNotMatch(result.body, /직장 생활|자영업|기혼|연애 관계|투자|사업|승진/);
  assert.equal(result.chips.some((chip) => chip.label === '대운'), false);
});
