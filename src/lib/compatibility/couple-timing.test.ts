import assert from 'node:assert/strict';
import { loadSajuDataV2 } from '@/domain/saju/engine';
import { buildCoupleTimingReport } from './couple-timing';

declare const test: (name: string, fn: () => void) => void;

const A = { year: 1988, month: 3, day: 12, hour: 9, minute: 0, gender: 'female' } as never;
const B = { year: 1985, month: 11, day: 2, hour: 14, minute: 0, gender: 'male' } as never;
const NOW = new Date('2026-08-27T00:00:00+09:00');

function report() {
  return buildCoupleTimingReport({
    self: { name: '가나', birthInput: A, data: loadSajuDataV2(A, null, {}) },
    partner: { name: '다라', birthInput: B, data: loadSajuDataV2(B, null, {}) },
    now: NOW,
  });
}

// 2026-08-27 — 🔴 사용자 제보: "언제 어떻게 하면 좋을지, 좋은 해·달과 안 좋은 해·달이
//   실질적으로 궁금한 내용인데 그런 설명은 하나도 없다."
test('커플 시간축: 12개월 전부를 판정한다', () => {
  const r = report();
  assert.equal(r.months.length, 12);
  assert.deepEqual(r.months.map((m) => m.month), Array.from({ length: 12 }, (_, i) => i + 1));
});

// 🔴 첫 구현은 momentum(rise/steady/caution) 교집합으로 판정했는데 12개월 중
//   both_good 이 **8개** 나왔다. "언제가 좋냐"에 여덟 달을 답하면 답이 아니다.
//   그래서 절대 임계값이 아니라 그 커플 안에서의 **순위**로 고른다.
test('커플 시간축: 좋은 달은 3개, 조심할 달은 2개 — 변별력이 보장된다', () => {
  const r = report();
  assert.equal(r.bestMonths.length, 3, '좋은 달이 늘어나면 답이 아니라 목록이 된다');
  assert.equal(r.cautionMonths.length, 2);
  assert.ok(r.mixedMonths.length <= 2);
});

test('커플 시간축: 한 달이 두 판정에 동시에 들어가지 않는다', () => {
  const r = report();
  const picked = [...r.bestMonths, ...r.cautionMonths, ...r.mixedMonths].map((m) => m.month);
  assert.equal(new Set(picked).size, picked.length);
});

test('커플 시간축: 좋은 달 점수가 조심할 달보다 항상 높다', () => {
  const r = report();
  const worstGood = Math.min(...r.bestMonths.map((m) => m.score));
  const bestCaution = Math.max(...r.cautionMonths.map((m) => m.score));
  assert.ok(worstGood > bestCaution, `${worstGood} vs ${bestCaution}`);
});

// 격차가 0 이면 "엇갈린다" 는 말 자체가 거짓이 된다.
test('커플 시간축: 엇갈리는 달은 실제로 두 사람 점수 차가 있을 때만', () => {
  for (const m of report().mixedMonths) {
    assert.ok(m.gap > 0, `${m.label} 격차 0인데 엇갈린다고 말한다`);
    assert.ok(m.favors === 'self' || m.favors === 'partner');
  }
});

test('커플 시간축: 연 전망은 올해부터 연속 3개년', () => {
  const r = report();
  assert.equal(r.year, 2026);
  assert.deepEqual(r.years.map((y) => y.year), [2026, 2027, 2028]);
});

// naming-policy §5 — 본문 한자 0개. 세운 간지를 그대로 쓰면 '丙午' 가 새어 나간다.
test('커플 시간축: 본문에 한자가 없다(세운 간지는 한글로)', () => {
  const r = report();
  const text = [
    ...r.months.map((m) => `${m.title} ${m.body}`),
    ...r.years.map((y) => `${y.label} ${y.verdict} ${y.body}`),
  ].join(' ');
  assert.ok(!/[一-鿿]/.test(text), `한자 노출: ${text.match(/[一-鿿]+/g)?.join(',')}`);
});

// 정직성 — 타이밍은 예언이 아니다.
test('커플 시간축: 단정·보장 표현을 쓰지 않는다', () => {
  const r = report();
  const text = [...r.months.map((m) => m.body), ...r.years.map((y) => y.body)].join(' ');
  for (const forbidden of ['반드시', '틀림없', '보장', '성공합니다', '실패합니다']) {
    assert.ok(!text.includes(forbidden), forbidden);
  }
});
