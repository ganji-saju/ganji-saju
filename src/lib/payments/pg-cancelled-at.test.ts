// 2026-08-26 회귀 가드 — 환불 귀속일(refunded_at)은 PG 가 **실제로 취소한 시각**이어야 한다.
//   항상 now() 를 쓰면 정산 크론·웹훅 재시도가 예전 취소를 뒤늦게 감지했을 때 그 환불이
//   '오늘'로 잡혀, 결제 없던 날에 환불만 꽂히고 순매출이 마이너스가 된다.
import assert from 'node:assert/strict';
import { resolvePgCancelledAt } from './order-ledger';

declare const test: (name: string, fn: () => void) => void;

const NOW = new Date('2026-08-26T03:00:00.000Z');

test('취소 시각: Toss cancels[].canceledAt 을 읽는다', () => {
  const out = resolvePgCancelledAt(
    { status: 'CANCELED', cancels: [{ cancelAmount: 9900, canceledAt: '2026-07-10T05:00:00+09:00' }] },
    NOW
  );
  assert.equal(out, new Date('2026-07-10T05:00:00+09:00').toISOString());
});

test('취소 시각: 나이스페이 cancelledTimestamp 도 읽는다', () => {
  const out = resolvePgCancelledAt(
    { status: 'cancelled', cancels: [{ cancelledTimestamp: '2026-08-01T14:30:00.000+09:00' }] },
    NOW
  );
  assert.equal(out, new Date('2026-08-01T14:30:00.000+09:00').toISOString());
});

test('취소 시각: 부분취소가 누적되면 마지막 취소 시각 — 주문이 refunded 로 넘어간 순간', () => {
  const out = resolvePgCancelledAt(
    {
      cancels: [
        { canceledAt: '2026-08-01T10:00:00+09:00' },
        { canceledAt: '2026-08-05T10:00:00+09:00' },
        { canceledAt: '2026-08-03T10:00:00+09:00' },
      ],
    },
    NOW
  );
  assert.equal(out, new Date('2026-08-05T10:00:00+09:00').toISOString());
});

test('취소 시각: 최상위 필드도 폴백으로 읽는다', () => {
  const out = resolvePgCancelledAt({ cancelledAt: '2026-08-02T09:00:00+09:00' }, NOW);
  assert.equal(out, new Date('2026-08-02T09:00:00+09:00').toISOString());
});

test('취소 시각: 미래 값은 거부 — 오염된 응답이 지표를 미래로 밀지 않게', () => {
  const out = resolvePgCancelledAt({ cancels: [{ canceledAt: '2027-01-01T00:00:00+09:00' }] }, NOW);
  assert.equal(out, null);
});

test('취소 시각: 시계 오차 60초 이내의 미래는 허용', () => {
  const nearFuture = new Date(NOW.getTime() + 30_000).toISOString();
  assert.equal(resolvePgCancelledAt({ cancelledAt: nearFuture }, NOW), nearFuture);
});

test('취소 시각: ISO 가 아닌 압축 표기는 거부 — 엔진마다 다르게 해석된다', () => {
  assert.equal(resolvePgCancelledAt({ cancelledAt: '20260810123000' }, NOW), null);
  assert.equal(resolvePgCancelledAt({ cancelledAt: '2026/08/10 12:30' }, NOW), null);
});

test('취소 시각: 없거나 못 읽으면 null → 호출부가 now() 로 폴백', () => {
  assert.equal(resolvePgCancelledAt(null, NOW), null);
  assert.equal(resolvePgCancelledAt({}, NOW), null);
  assert.equal(resolvePgCancelledAt({ status: 'DONE', approvedAt: '2026-08-01T10:00:00+09:00' }, NOW), null);
  assert.equal(resolvePgCancelledAt({ cancels: [] }, NOW), null);
  assert.equal(resolvePgCancelledAt({ cancels: [{ cancelAmount: 990 }] }, NOW), null);
});
