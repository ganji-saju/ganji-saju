// 2026-09-13 — 멤버십 환불 시 구독 종료(사용자 요청). 구독은 사용자당 1행이고 결제(30일)·관리자 부여가 renews_at 끝에 누적된다.
//   "지금 종료"는 다른 기간까지 날리고, 상태만 cancelled 는 혜택이 안 끊긴다(isEntitledStatus 가 cancelled 를 권한으로 본다) →
//   **환불된 결제가 늘린 30일만 뺀다**. 결과가 지금 이전이면 즉시 만료(renews_at 도 지금으로 — 남기면 재구매 때 base 로 되살아난다).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { refundedMembershipRenewal, shortenMembershipForRefund } from './subscription';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const NOW = new Date('2026-09-13T00:00:00.000Z');

test('환불된 결제 1건의 30일만 뺀다 — 남은 기간(다른 결제·관리자 부여)은 유지', () => {
  assert.deepEqual(refundedMembershipRenewal('2026-11-12T00:00:00.000Z', NOW), { status: null, renewsAt: '2026-10-13T00:00:00.000Z' });
});

test('빼고 나면 지금 이전이면 즉시 만료 — renews_at 도 지금으로(재구매 때 옛 기간이 되살아나지 않게)', () => {
  assert.deepEqual(refundedMembershipRenewal('2026-10-01T00:00:00.000Z', NOW), { status: 'expired', renewsAt: NOW.toISOString() });
  assert.deepEqual(refundedMembershipRenewal('2026-10-13T00:00:00.000Z', NOW), { status: 'expired', renewsAt: NOW.toISOString() }, '딱 지금이면 만료');
});

test('renews_at 이 없는(무기한) 행은 이 결제가 만든 기간이 아니라 손대지 않는다', () => {
  assert.equal(refundedMembershipRenewal(null, NOW), null);
});

function fakeSubscriptions(row: Record<string, unknown> | null) {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from: () => {
      let patch: Record<string, unknown> | null = null;
      const chain = {
        select: () => chain,
        update: (p: Record<string, unknown>) => ((patch = p), chain),
        eq: () => (patch ? Promise.resolve((updates.push(patch), { error: null })) : chain),
        maybeSingle: () => Promise.resolve({ data: row, error: null }),
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, updates };
}

test('shortenMembershipForRefund — 계산 결과를 그대로 쓰고, 만료면 status 도 바꾼다', async () => {
  const keep = fakeSubscriptions({ renews_at: '2026-11-12T00:00:00.000Z' });
  await shortenMembershipForRefund('u1', { now: NOW, service: keep.client });
  assert.deepEqual(keep.updates, [{ renews_at: '2026-10-13T00:00:00.000Z', updated_at: NOW.toISOString() }]);

  const end = fakeSubscriptions({ renews_at: '2026-10-01T00:00:00.000Z' });
  await shortenMembershipForRefund('u1', { now: NOW, service: end.client });
  assert.deepEqual(end.updates, [{ renews_at: NOW.toISOString(), status: 'expired', updated_at: NOW.toISOString() }]);

  const none = fakeSubscriptions(null);
  assert.equal(await shortenMembershipForRefund('u1', { now: NOW, service: none.client }), null);
  assert.equal(none.updates.length, 0, '구독 행이 없으면 쓰지 않는다');
});

// 원장 함수(markPaymentOrderRefunded)·웹훅은 DB·PG 를 직접 불러 행동 테스트가 안 된다 — 호출 위치를 소스로 고정한다.
test('구독 차감은 환불 표기가 **방금** 일어난 분기에서만(관리자·웹훅·정산 공통, 정확히 1회) · 웹훅은 지급한 전만 회수', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
  const ledger = read('payments/order-ledger.ts');
  const refunded = ledger.slice(ledger.indexOf('export async function markPaymentOrderRefunded'));
  const transitioned = refunded.slice(refunded.indexOf('if (data) {'), refunded.indexOf('// 갱신된 행이 없음'));
  assert.ok(/\.neq\('status', 'refunded'\)/.test(refunded), '이미 refunded 면 전이하지 않는 조건부 UPDATE 가 1회 보장의 근거다');
  assert.ok(/if \(getPackage\(order\.packageId\)\?\.kind === 'subscription'\) \{\s*await shortenMembershipForRefund\(order\.userId\);/.test(transitioned));
  const webhook = read('../app/api/payments/webhook/nicepay/route.ts');
  // 코인 sunset 뒤 멤버십은 전을 지급하지 않는다(카탈로그 credits=90) — 카탈로그 값으로 회수하면 레거시 잔액을 잘못 깎는다.
  assert.ok(/packageCredits: pkg && shouldGrantCredits\(pkg\) \? pkg\.credits : 0,/.test(webhook));
});
