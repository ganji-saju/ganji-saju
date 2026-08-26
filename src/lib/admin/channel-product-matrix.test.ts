// 2026-08-26 회귀 가드 — 유입 채널 × 상품 교차표.
//   계약의 핵심은 "표의 합이 총계와 항상 맞는다" 와 "못 이은 결제자를 버리지 않는다" 둘이다.
import assert from 'node:assert/strict';
import {
  buildChannelProductMatrix,
  MATRIX_TOP_N,
  OTHER_LABEL,
  UNKNOWN_CHANNEL,
} from './channel-product-matrix';

declare const test: (name: string, fn: () => void) => void;

const CH = new Map([
  ['u1', '페이스북'],
  ['u2', '페이스북'],
  ['u3', '인포크링크'],
]);

test('교차표: 채널×상품 셀과 합계', () => {
  const m = buildChannelProductMatrix(
    [
      { userId: 'u1', packageId: 'bundle_comprehensive', amountWon: 9900 },
      { userId: 'u2', packageId: 'bundle_comprehensive', amountWon: 9900 },
      { userId: 'u3', packageId: 'taste_dialogue_entry', amountWon: 990 },
    ],
    CH
  );

  assert.deepEqual(m.channels, ['페이스북', '인포크링크']);
  assert.deepEqual(m.packages, ['bundle_comprehensive', 'taste_dialogue_entry']);
  const fb = m.cells.find((c) => c.channel === '페이스북' && c.packageId === 'bundle_comprehensive');
  assert.equal(fb?.orders, 2);
  assert.equal(fb?.amountWon, 19800);
  assert.equal(m.totalOrders, 3);
  assert.equal(m.totalAmountWon, 20790);
});

test('교차표: 채널을 못 이은 결제도 버리지 않고 (채널 미상) 으로 남긴다', () => {
  const m = buildChannelProductMatrix(
    [
      { userId: 'u1', packageId: 'p1', amountWon: 1000 },
      { userId: 'ghost', packageId: 'p1', amountWon: 2000 },
      { userId: null, packageId: 'p1', amountWon: 3000 },
    ],
    CH
  );

  const unknown = m.channelTotals.find((t) => t.key === UNKNOWN_CHANNEL);
  assert.equal(unknown?.orders, 2, '미매칭 결제자와 user_id 없는 결제 둘 다 미상으로');
  assert.equal(unknown?.amountWon, 5000);
  assert.equal(m.totalOrders, 3, '버려진 행이 없어야 총계가 맞는다');
});

test('교차표: (채널 미상)·기타는 항상 맨 끝 — 상위 채널 읽기를 방해하지 않는다', () => {
  const m = buildChannelProductMatrix(
    [
      { userId: 'ghost1', packageId: 'p1', amountWon: 100 },
      { userId: 'ghost2', packageId: 'p1', amountWon: 100 },
      { userId: 'ghost3', packageId: 'p1', amountWon: 100 },
      { userId: 'u1', packageId: 'p1', amountWon: 100 },
    ],
    CH
  );
  assert.equal(m.channels[m.channels.length - 1], UNKNOWN_CHANNEL, '건수가 많아도 맨 끝');
  assert.equal(m.channels[0], '페이스북');
});

test('교차표: 상한 초과분은 기타로 접고 접힌 개수를 알린다 — 조용한 절단 금지', () => {
  const payments = [];
  const channels = new Map<string, string>();
  for (let i = 0; i < MATRIX_TOP_N + 3; i += 1) {
    const uid = `user${i}`;
    channels.set(uid, `채널${i}`);
    // 뒤 채널일수록 건수가 적게 — 상위 N 이 앞쪽이 되도록.
    for (let n = 0; n < MATRIX_TOP_N + 3 - i; n += 1) {
      payments.push({ userId: uid, packageId: 'p1', amountWon: 10 });
    }
  }
  const m = buildChannelProductMatrix(payments, channels);

  assert.equal(m.foldedChannels, 3);
  assert.ok(m.channels.includes(OTHER_LABEL));
  assert.equal(m.channels.length, MATRIX_TOP_N + 1, '상위 N + 기타');
  const sum = m.channelTotals.reduce((acc, t) => acc + t.orders, 0);
  assert.equal(sum, m.totalOrders, '접어도 합계는 총계와 일치해야 한다');
});

test('교차표: 상품 미상·금액 결측을 0 으로 흡수하고 행은 유지', () => {
  const m = buildChannelProductMatrix(
    [{ userId: 'u1', packageId: null, amountWon: null }],
    CH
  );
  assert.deepEqual(m.packages, ['(상품 미상)']);
  assert.equal(m.totalOrders, 1);
  assert.equal(m.totalAmountWon, 0);
});

test('교차표: 결제가 없으면 빈 표', () => {
  const m = buildChannelProductMatrix([], CH);
  assert.deepEqual(m.channels, []);
  assert.equal(m.totalOrders, 0);
  assert.equal(m.foldedChannels, 0);
});
