import assert from 'node:assert/strict';
import { consumeLots, deduct, nonExpiredBalance, type CreditLot } from './lot-math';

declare const test: (name: string, fn: () => void) => void;

const NOW = new Date('2026-05-25T00:00:00.000Z');

function lot(id: string, amount: number, expiresAt: string, createdAt?: string): CreditLot {
  return {
    id,
    amountRemaining: amount,
    expiresAt: new Date(expiresAt),
    createdAt: createdAt ? new Date(createdAt) : undefined,
  };
}

// ── grandfather lot 생성 시맨틱 ──────────────────────────────────────────
test('grandfather lot: 시행일+1년 만료 lot 이 balance 전액을 그대로 보유한다', () => {
  // 마이그레이션은 balance>0 유저마다 amount_remaining=balance, expires_at=now()+1년 lot 1개 생성.
  const grandfatherExpiry = '2027-05-25T00:00:00.000Z';
  const lots = [lot('gf', 5, grandfatherExpiry)];

  // 시행 직후: 전액 비만료(즉시 소실 없음).
  assert.equal(nonExpiredBalance(lots, NOW), 5);
  // 시행 후 11개월: 여전히 유효.
  assert.equal(nonExpiredBalance(lots, new Date('2027-04-25T00:00:00.000Z')), 5);
  // 시행 후 13개월: 만료 → 잔액 0.
  assert.equal(nonExpiredBalance(lots, new Date('2027-06-25T00:00:00.000Z')), 0);
});

// ── 비만료 잔액 계산: 만료분 제외 ────────────────────────────────────────
test('nonExpiredBalance 는 만료된 lot 을 합산에서 제외한다', () => {
  const lots = [
    lot('expired', 3, '2026-05-24T23:59:59.000Z'), // 이미 만료
    lot('live', 4, '2026-12-31T00:00:00.000Z'),
  ];
  assert.equal(nonExpiredBalance(lots, NOW), 4);
});

test('만료 경계: expires_at 이 now 와 같으면 만료로 간주(> 비교)', () => {
  const lots = [lot('edge', 2, NOW.toISOString())];
  assert.equal(nonExpiredBalance(lots, NOW), 0);
});

// ── FIFO 차감: 가장 먼저 만료되는 lot 우선 ───────────────────────────────
test('consumeLots 는 만료가 임박한 lot 부터 차감한다(FIFO by expiry)', () => {
  const lots = [
    lot('later', 5, '2027-01-01T00:00:00.000Z'),
    lot('sooner', 5, '2026-07-01T00:00:00.000Z'),
  ];

  const result = consumeLots(lots, 3, NOW);

  assert.equal(result.success, true);
  const sooner = result.lots.find((l) => l.id === 'sooner');
  const later = result.lots.find((l) => l.id === 'later');
  // 먼저 만료되는 sooner 에서 3 차감, later 는 그대로.
  assert.equal(sooner?.amountRemaining, 2);
  assert.equal(later?.amountRemaining, 5);
  assert.equal(result.remaining, 7);
});

test('consumeLots 는 한 lot 을 비우고 다음 lot 으로 넘어간다', () => {
  const lots = [
    lot('a', 2, '2026-07-01T00:00:00.000Z'),
    lot('b', 5, '2026-08-01T00:00:00.000Z'),
  ];

  const result = consumeLots(lots, 4, NOW);

  assert.equal(result.success, true);
  assert.equal(result.lots.find((l) => l.id === 'a')?.amountRemaining, 0);
  assert.equal(result.lots.find((l) => l.id === 'b')?.amountRemaining, 3);
  assert.equal(result.remaining, 3);
});

test('동일 만료 시각이면 created_at 오래된 lot 우선 차감', () => {
  const lots = [
    lot('newer', 3, '2026-07-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
    lot('older', 3, '2026-07-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ];

  const result = consumeLots(lots, 2, NOW);

  assert.equal(result.lots.find((l) => l.id === 'older')?.amountRemaining, 1);
  assert.equal(result.lots.find((l) => l.id === 'newer')?.amountRemaining, 3);
});

// ── 만료 lot 은 차감 불가 ────────────────────────────────────────────────
test('consumeLots 는 만료된 lot 을 차감 대상에서 제외한다', () => {
  const lots = [
    lot('expired', 10, '2026-05-24T00:00:00.000Z'), // 만료 — 사용 불가
    lot('live', 2, '2026-12-01T00:00:00.000Z'),
  ];

  // 비만료 합(2) < 비용(3) → 전체 거부, 만료분으로 메우지 않음.
  const result = consumeLots(lots, 3, NOW);
  assert.equal(result.success, false);
  // 부분 차감 없음 — 입력 그대로.
  assert.equal(result.lots.find((l) => l.id === 'expired')?.amountRemaining, 10);
  assert.equal(result.lots.find((l) => l.id === 'live')?.amountRemaining, 2);
  assert.equal(result.remaining, 2);
});

test('consumeLots 는 비만료 합 부족 시 부분 차감하지 않는다', () => {
  const lots = [lot('a', 2, '2026-07-01T00:00:00.000Z')];
  const result = consumeLots(lots, 5, NOW);
  assert.equal(result.success, false);
  assert.equal(result.lots[0].amountRemaining, 2); // 손대지 않음
});

// ── 정확히 잔액만큼 차감 ─────────────────────────────────────────────────
test('consumeLots 는 정확히 잔액만큼이면 전부 비운다', () => {
  const lots = [
    lot('a', 2, '2026-07-01T00:00:00.000Z'),
    lot('b', 3, '2026-08-01T00:00:00.000Z'),
  ];
  const result = consumeLots(lots, 5, NOW);
  assert.equal(result.success, true);
  assert.equal(result.remaining, 0);
  assert.equal(result.lots.find((l) => l.id === 'a')?.amountRemaining, 0);
  assert.equal(result.lots.find((l) => l.id === 'b')?.amountRemaining, 0);
});

// ── deduct: 구독 잔액 먼저, 그 다음 lot ─────────────────────────────────
test('deduct 는 구독 잔액을 lot 보다 먼저 차감한다', () => {
  const lots = [lot('a', 5, '2026-12-01T00:00:00.000Z')];

  const result = deduct(3, lots, 2, NOW);

  assert.equal(result.success, true);
  assert.equal(result.subscriptionBalance, 1); // 3 - 2
  assert.equal(result.lots[0].amountRemaining, 5); // lot 손대지 않음
  assert.equal(result.remaining, 6); // 1 + 5
});

test('deduct 는 구독 잔액이 부족하면 lot 으로 충당한다(혼용 안 함)', () => {
  const lots = [lot('a', 5, '2026-12-01T00:00:00.000Z')];

  // 구독 2 < 비용 3 → 구독은 건드리지 않고 lot 에서 3 차감.
  const result = deduct(2, lots, 3, NOW);

  assert.equal(result.success, true);
  assert.equal(result.subscriptionBalance, 2); // 그대로
  assert.equal(result.lots[0].amountRemaining, 2); // 5 - 3
  // 주의: lot 차감 분기의 remaining 은 lot 합만 반환한다(원본 002 deduct_credits 의
  //   balance 분기와 동일 — 잔존 구독 잔액은 합산하지 않음). 행동 보존을 위해 그대로 둔다.
  assert.equal(result.remaining, 2);
});

test('deduct 는 구독+lot 모두 부족하면 실패하고 아무것도 차감하지 않는다', () => {
  const lots = [lot('a', 1, '2026-12-01T00:00:00.000Z')];

  const result = deduct(1, lots, 3, NOW);

  assert.equal(result.success, false);
  assert.equal(result.subscriptionBalance, 1);
  assert.equal(result.lots[0].amountRemaining, 1);
  assert.equal(result.remaining, 2); // 1 + 1, 비만료 기준
});

test('deduct 는 만료된 lot 을 구독 차감 후 잔여 계산에서 제외한다', () => {
  const lots = [
    lot('expired', 10, '2026-05-24T00:00:00.000Z'),
    lot('live', 4, '2026-12-01T00:00:00.000Z'),
  ];

  // 구독에서 차감 성공, 잔여에는 만료 lot(10) 미포함.
  const result = deduct(5, lots, 2, NOW);
  assert.equal(result.success, true);
  assert.equal(result.subscriptionBalance, 3);
  assert.equal(result.remaining, 7); // 3(구독) + 4(비만료 lot), 만료 10 제외
});

test('deduct 는 만료 lot 때문에 lot 차감이 거부되면 실패한다', () => {
  const lots = [
    lot('expired', 10, '2026-05-24T00:00:00.000Z'),
    lot('live', 1, '2026-12-01T00:00:00.000Z'),
  ];

  // 구독 0, 비만료 합 1 < 비용 2 → 실패(만료분 10 사용 불가).
  const result = deduct(0, lots, 2, NOW);
  assert.equal(result.success, false);
  assert.equal(result.lots.find((l) => l.id === 'live')?.amountRemaining, 1);
});
