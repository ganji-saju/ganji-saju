import assert from 'node:assert/strict';
import { buildCompatibilityInterpretation } from '@/lib/compatibility';
import { buildCoupleFit } from './couple-fit';

declare const test: (name: string, fn: () => void) => void;

const person = (name: string, year: number, month: number, day: number, hour: number, gender: string) =>
  ({ name, birthInput: { year, month, day, hour, minute: 0, gender } }) as never;

// 일지 형(刑)이 걸린 조합 — 실측: 동업 85 / 결혼 50 / 돈거래 45
const CLASHING = () =>
  buildCompatibilityInterpretation(
    'lover',
    person('가나', 1988, 3, 12, 9, 'female'),
    person('다라', 1985, 11, 2, 14, 'male')
  );

// 2026-08-27 — 🔴 사용자 제보: "같이 뭘 해도(결혼·사업·동업·관계유지) 되는지가 궁금한데
//   그런 설명이 하나도 없다." 총점 하나로는 "결혼엔 아닌데 동업엔 되는" 조합을 못 가른다.
test('용도별 적합성: 같은 커플이라도 용도마다 판단이 갈린다', () => {
  const items = buildCoupleFit(CLASHING(), '가나', '다라');
  assert.equal(items.length, 4);
  const spread = items[0].score - items[items.length - 1].score;
  assert.ok(spread >= 15, `용도별 점수 차가 ${spread}점뿐 — 총점 하나와 다를 게 없다`);
});

test('용도별 적합성: 점수 내림차순 — 순서 자체가 "무엇에 제일 맞나" 의 답이다', () => {
  const scores = buildCoupleFit(CLASHING(), '가나', '다라').map((i) => i.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

// 일지 형충파해는 '틀어질 때 크게 틀어진다' 는 신호라 돈 거래에서 가장 무겁게 봐야 한다.
test('용도별 적합성: 일지에 형충이 걸리면 돈 거래가 가장 낮게 나온다', () => {
  const it = CLASHING();
  assert.ok(it.signals.branch < 0, '전제: 이 커플은 일지 형이 걸려 있다');
  const items = buildCoupleFit(it, '가나', '다라');
  const money = items.find((i) => i.key === 'money');
  assert.ok(money);
  assert.equal(items[items.length - 1].key, 'money');
  assert.equal(money.grade, 'careful');
});

// 판단만 던지면 점집이고, 조건을 주면 풀이다.
test('용도별 적합성: 모든 항목이 근거와 조건을 함께 준다', () => {
  for (const item of buildCoupleFit(CLASHING(), '가나', '다라')) {
    assert.ok(item.reason.trim().length > 10, item.key);
    assert.ok(item.condition.trim().length > 10, item.key);
    // 단정 금지 — 예언이 아니라 풀이다.
    for (const forbidden of ['반드시', '틀림없', '보장']) {
      assert.ok(!item.reason.includes(forbidden), `${item.key}: ${forbidden}`);
      assert.ok(!item.condition.includes(forbidden), `${item.key}: ${forbidden}`);
    }
  }
});

// 🔴 첫 렌더에서 "해이 걸려 있어" 가 나왔다 — 합충형파해 라벨은 받침이 제각각이라
//   조사를 하드코딩하면 비문이 그대로 사용자에게 나간다.
test('용도별 적합성: 합충 라벨 뒤 조사가 받침 규칙과 맞는다(해가/형이)', () => {
  const withHarm = buildCompatibilityInterpretation(
    'lover',
    person('사아', 1972, 1, 5, 20, 'male'),
    person('자차', 1979, 9, 30, 7, 'female')
  );
  const text = buildCoupleFit(withHarm, '사아', '자차')
    .map((i) => i.reason)
    .join(' ');
  assert.ok(!/해이/.test(text), `비문: ${text}`);
  assert.ok(!/파이/.test(text), `비문: ${text}`);
  if (withHarm.signals.branchCaution === '해') assert.ok(/해가/.test(text), text);
});
