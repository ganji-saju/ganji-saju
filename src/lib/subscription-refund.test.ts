// 2026-09-13 — 멤버십 환불 시 구독 종료(사용자 요청). 구독은 사용자당 1행이고 결제(30일)·관리자 부여가 renews_at 끝에 누적된다.
//   "지금 종료"는 다른 기간까지 날리고, 상태만 cancelled 는 혜택이 안 끊긴다(isEntitledStatus 가 cancelled 를 권한으로 본다) →
//   **그 결제가 구독에 실제로 더한 일수(지급 기록)만 뺀다**. 결과가 지금 이전이면 즉시 만료(renews_at 도 지금으로).
//   리뷰 발견: "항상 30일"은 미지급(승인만)·지급 재시도(+60)·부분취소에서 틀린 값을 뺀다 → 지급이 주문에 일수를 기록한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { refundedMembershipRenewal, shortenMembershipForRefund } from './subscription';
import { membershipDaysToRemove, recordMembershipDaysGranted } from './payments/order-ledger';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const NOW = new Date('2026-09-13T00:00:00.000Z');

test('환불된 결제가 더한 일수만 뺀다 — 남은 기간(다른 결제·관리자 부여)은 유지', () => {
  assert.deepEqual(refundedMembershipRenewal('2026-11-12T00:00:00.000Z', NOW, 30), { status: null, renewsAt: '2026-10-13T00:00:00.000Z' });
  assert.deepEqual(refundedMembershipRenewal('2026-12-12T00:00:00.000Z', NOW, 60), { status: null, renewsAt: '2026-10-13T00:00:00.000Z' });
});

test('빼고 나면 지금 이전이면 즉시 만료 — renews_at 도 지금으로(재구매 때 옛 기간이 되살아나지 않게)', () => {
  assert.deepEqual(refundedMembershipRenewal('2026-10-01T00:00:00.000Z', NOW, 30), { status: 'expired', renewsAt: NOW.toISOString() });
  assert.deepEqual(refundedMembershipRenewal('2026-10-13T00:00:00.000Z', NOW, 30), { status: 'expired', renewsAt: NOW.toISOString() }, '딱 지금이면 만료');
});

test('renews_at 이 없는(무기한) 행은 이 결제가 만든 기간이 아니라 손대지 않는다', () => {
  assert.equal(refundedMembershipRenewal(null, NOW, 30), null);
});

test('뺄 일수는 지급 기록 그대로 — 미지급 0 · 재시도 누적 60 · 부분취소 0 · 멤버십 아님 0', () => {
  const membership = (metadata: Record<string, unknown>) => ({ packageId: 'membership_premium', metadata });
  assert.equal(membershipDaysToRemove(membership({ membershipDaysGranted: 30 }), false), 30);
  assert.equal(membershipDaysToRemove(membership({ membershipDaysGranted: 60 }), false), 60);
  assert.equal(membershipDaysToRemove(membership({}), false), 0, '승인만 되고 지급 전 실패한 주문 — 받은 적 없는 기간을 빼면 관리자 부여분이 깎인다');
  assert.equal(membershipDaysToRemove(membership({ membershipDaysGranted: 30 }), true), 0, '부분취소는 구독 유지');
  assert.equal(membershipDaysToRemove({ packageId: 'taste_today_detail', metadata: { membershipDaysGranted: 30 } }, false), 0);
});

// select→update 흉내 — eq 인자까지 기록한다(엉뚱한 컬럼으로 바꾸면 프로덕션에선 0행 갱신 = 조용한 미차감).
function fakeTable(row: Record<string, unknown> | null) {
  const writes: Array<{ patch: Record<string, unknown>; where: [string, unknown] }> = [];
  const client = {
    from: () => {
      let patch: Record<string, unknown> | null = null;
      const chain = {
        select: () => chain,
        update: (p: Record<string, unknown>) => ((patch = p), chain),
        eq: (col: string, val: unknown) => (patch ? Promise.resolve((writes.push({ patch, where: [col, val] }), { error: null })) : chain),
        maybeSingle: () => Promise.resolve({ data: row, error: null }),
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, writes };
}

test('shortenMembershipForRefund — 그 사용자 행에 계산 결과를 쓰고, 만료면 status 도 바꾼다', async () => {
  const keep = fakeTable({ renews_at: '2026-11-12T00:00:00.000Z' });
  await shortenMembershipForRefund('u1', { days: 30, now: NOW, service: keep.client });
  assert.deepEqual(keep.writes, [{ patch: { renews_at: '2026-10-13T00:00:00.000Z', updated_at: NOW.toISOString() }, where: ['user_id', 'u1'] }]);

  const end = fakeTable({ renews_at: '2026-10-01T00:00:00.000Z' });
  await shortenMembershipForRefund('u1', { days: 30, now: NOW, service: end.client });
  assert.deepEqual(end.writes[0].patch, { renews_at: NOW.toISOString(), status: 'expired', updated_at: NOW.toISOString() });

  const none = fakeTable(null);
  assert.equal(await shortenMembershipForRefund('u1', { days: 30, now: NOW, service: none.client }), null);
  assert.equal(none.writes.length, 0, '구독 행이 없으면 쓰지 않는다');
});

test('recordMembershipDaysGranted — 주문 metadata 에 누적(재시도로 두 번 돌면 60), 다른 키는 보존', async () => {
  const first = fakeTable({ metadata: { origin: { env: 'production' } } });
  await recordMembershipDaysGranted('ord_m', 30, first.client);
  assert.deepEqual(first.writes, [{ patch: { metadata: { origin: { env: 'production' }, membershipDaysGranted: 30 } }, where: ['order_id', 'ord_m'] }]);
  const retry = fakeTable({ metadata: { membershipDaysGranted: 30 } });
  await recordMembershipDaysGranted('ord_m', 30, retry.client);
  assert.equal((retry.writes[0].patch.metadata as Record<string, unknown>).membershipDaysGranted, 60);
});

// 원장 함수·지급·웹훅은 DB·PG 를 직접 불러 행동 테스트가 안 된다 — 호출 위치를 소스로 고정한다.
test('구독 차감은 방금 refunded 로 바뀐 분기에서만(정확히 1회) · 실패는 주문에 흔적 · 지급이 일수를 기록 · 웹훅은 부분취소·전 회수 구분', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
  const ledger = read('payments/order-ledger.ts');
  const refunded = ledger.slice(ledger.indexOf('export async function markPaymentOrderRefunded'));
  const transitioned = refunded.slice(refunded.indexOf('if (data) {'), refunded.indexOf('// 갱신된 행이 없음'));
  const idempotent = refunded.slice(refunded.indexOf('// 갱신된 행이 없음'), refunded.indexOf('\n}\n'));
  assert.ok(/\.neq\('status', 'refunded'\)/.test(refunded), '이미 refunded 면 전이하지 않는 조건부 UPDATE 가 1회 보장의 근거다');
  assert.ok(/const membershipDays = membershipDaysToRemove\(order, input\.partial === true\);\s*if \(membershipDays > 0\) \{\s*await shortenMembershipForRefund\(order\.userId, \{ days: membershipDays \}\)\.catch\(/.test(transitioned));
  assert.ok(/membership_shorten_failed[\s\S]*\.update\(\{ last_error: message \}\)/.test(transitioned), '실패를 삼키면 영구 누락 — 주문에 흔적');
  assert.ok(!/shortenMembershipForRefund/.test(idempotent), '멱등 재호출 분기에서 또 빼면 관리자 환불·통보가 겹칠 때 두 번 빠진다');

  const fulfillment = read('payments/fulfillment.ts');
  assert.ok(/days: MEMBERSHIP_PERIOD_DAYS,\s*\}\)\s*: null;\s*[^\n]*\n\s*if \(subscription\) await recordMembershipDaysGranted\(claimed\.orderId, MEMBERSHIP_PERIOD_DAYS\);/.test(fulfillment));

  const webhook = read('../app/api/payments/webhook/nicepay/route.ts');
  assert.ok(/partial: \/partial\/i\.test\(status\),/.test(webhook), '부분취소는 구독 유지(관리자 부분환불과 같은 결과)');
  // 회수할 전은 결제가 실제로 지급한 전(creditsToRevokeOnCancel — coin-sunset.test 에서 값으로 고정).
  assert.ok(/packageCredits: creditsToRevokeOnCancel\(pkg\),/.test(webhook));
});

// 2026-09-14 — 관리자 "멤버십 해제"가 cancelled 라 renews_at 까지 혜택이 남고 사용자가 재개할 수 있었다(사용자 요청: 해제하면 종료).
test('관리자 해제는 지금 만료 — status expired + renews_at 지금(재구매 때 되살아나지 않게), 그 사용자 행만', async () => {
  const { expireMembershipNow } = await import('./subscription');
  const db = fakeTable(null);
  await expireMembershipNow('u1', { now: NOW, service: db.client });
  assert.deepEqual(db.writes, [
    { patch: { status: 'expired', renews_at: NOW.toISOString(), updated_at: NOW.toISOString() }, where: ['user_id', 'u1'] },
  ]);
  const route = fs.readFileSync(path.resolve(__dirname, '../app/api/admin/membership/grant/route.ts'), 'utf8');
  assert.ok(/\} else \{\s*await expireMembershipNow\(userId\);/.test(route));
  assert.ok(!/updateSubscriptionStatus\(userId, 'cancelled'\)/.test(route), 'cancelled 로는 혜택이 안 끊긴다');
});
