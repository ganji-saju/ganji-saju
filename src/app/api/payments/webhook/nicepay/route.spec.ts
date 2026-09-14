// 2026-09-14 — 나이스 취소 통보 재전송 흡수 버그. 예전엔 멱등 기록이 처리보다 먼저라, 처리 전에 죽은(received)·실패한(failed) 통보도
//   재수신 때 'duplicate → OK' 로 흡수돼 영구 미처리였다(주문 조회가 try 밖 → 500 → 자동 재전송 10회 전부 흡수).
//   지키는 것: 미완 통보는 다시 처리 · 끝난(processed/ignored) 통보만 무동작 · 재처리해도 전은 주문당 1회 · 이용권은 결제키로 끝까지.
//   DB 는 가짜 — 이벤트 표·unlock_credit_feature_once(사용자·feature·metadata 중복 차단)만 흉내, 주문 원장·이용권 회수는 목.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type EventRow = { processing_status: string; error: string | null };
type CreditRow = { userId: string; feature: string; cost: number; metadata: Record<string, unknown> };

const world = vi.hoisted(() => ({
  events: new Map<string, EventRow>(),
  order: null as null | Record<string, unknown>,
  creditRows: [] as CreditRow[],
  grants: new Set<string>(),
  transitions: 0,
  fail: { lookup: 0, refund: 0, refundAfterCommit: 0, grants: 0, credits: 0 },
}));

vi.mock('@/lib/supabase/server', () => {
  const client = {
    from(table: string) {
      if (table !== 'payment_webhook_events') throw new Error(`unexpected table ${table}`);
      return {
        insert: async (row: { event_hash: string }) => {
          if (world.events.has(row.event_hash)) return { error: { code: '23505', message: 'duplicate key' } };
          world.events.set(row.event_hash, { processing_status: 'received', error: null });
          return { error: null };
        },
        select: () => ({
          eq: (_col: string, hash: string) => ({
            maybeSingle: async () => ({ data: world.events.get(hash) ?? null, error: null }),
          }),
        }),
        update: (patch: { processing_status: string; error: string | null }) => ({
          eq: async (_col: string, hash: string) => {
            const row = world.events.get(hash);
            if (row) Object.assign(row, { processing_status: patch.processing_status, error: patch.error });
            return { error: null };
          },
        }),
      };
    },
    // deduct_credits 는 멱등이 아니다(부를 때마다 행) · unlock_credit_feature_once 는 같은 metadata 행이 있으면 reused.
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (world.fail.credits > 0) {
        world.fail.credits -= 1;
        return { data: null, error: { code: '57014', message: 'statement timeout' } };
      }
      const metadata = (args.p_access_metadata ?? {}) as Record<string, unknown>;
      const row = { userId: String(args.p_user_id), feature: String(args.p_feature), cost: Number(args.p_cost), metadata };
      if (name === 'unlock_credit_feature_once') {
        const hit = world.creditRows.some(
          (r) =>
            r.userId === row.userId &&
            r.feature === row.feature &&
            Object.entries(metadata).every(([k, v]) => r.metadata[k] === v)
        );
        if (hit) return { data: { success: true, reused: true, remaining: 0 }, error: null };
      } else if (name !== 'deduct_credits') {
        throw new Error(`unexpected rpc ${name}`);
      }
      world.creditRows.push(row);
      return { data: { success: true, reused: false, remaining: 0 }, error: null };
    },
  };
  return { createServiceClient: vi.fn(async () => client) };
});

vi.mock('@/lib/payments/order-ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/payments/order-ledger')>();
  return {
    ...actual,
    getPaymentOrderByOrderId: vi.fn(async (orderId: string) => {
      if (world.fail.lookup > 0) {
        world.fail.lookup -= 1;
        throw new Error('db_down');
      }
      return world.order && world.order.orderId === orderId ? { ...world.order } : null;
    }),
    // 전이 분기(멤버십 원장·GA 훅)는 neq('status','refunded') 로 1회 — transitions 로 센다.
    markPaymentOrderRefunded: vi.fn(async () => {
      if (world.fail.refund > 0) {
        world.fail.refund -= 1;
        throw new Error('refund_write_failed');
      }
      if (world.order!.status !== 'refunded') {
        world.order!.status = 'refunded';
        world.transitions += 1;
      }
      // 전이는 커밋됐는데 응답을 잃었거나 훅 도중 죽은 경우
      if (world.fail.refundAfterCommit > 0) {
        world.fail.refundAfterCommit -= 1;
        throw new Error('response_lost_after_commit');
      }
      return { ...world.order! };
    }),
    markPaymentOrderFailed: vi.fn(async (input: { status: string }) => {
      world.order!.status = input.status;
      return { ...world.order! };
    }),
  };
});

vi.mock('@/lib/payments/nicepay', () => ({
  getNicepayPayment: vi.fn(async () => {
    throw new Error('sandbox_unreachable');
  }),
}));

vi.mock('@/lib/product-entitlements', () => ({
  revokeEntitlementsOfPayment: vi.fn(async (_userId: string, paymentKey: string | null) => {
    if (!paymentKey) throw new Error('결제키 없이 이용권을 회수하지 않는다');
    if (world.fail.grants > 0) {
      world.fail.grants -= 1;
      throw new Error('grant_delete_failed');
    }
    const revoked = world.grants.delete(paymentKey);
    return { revoked, productTableDeleted: revoked ? 1 : 0, legacyDeleted: 0 };
  }),
}));

import { getPaymentOrderByOrderId, hashWebhookPayload } from '@/lib/payments/order-ledger';
import { revokeEntitlementsOfPayment } from '@/lib/product-entitlements';
import { POST } from './route';

// 대화상담(전 3개 지급)을 산 주문 — 전·이용권 둘 다 회수 대상.
const PAID_ORDER = {
  orderId: 'ord_1',
  userId: 'user-1',
  packageId: 'taste_dialogue_entry',
  status: 'fulfilled',
  paymentKey: 'tid_1',
  confirmedAt: '2026-09-14T00:00:00.000Z',
  fulfilledAt: '2026-09-14T00:00:01.000Z',
};
const CANCEL = { tid: 'tid_1', orderId: 'ord_1', status: 'cancelled', amount: 3300, balanceAmt: 0 };

function deliver(payload: Record<string, unknown> = CANCEL) {
  return POST(
    new NextRequest('https://ganjisaju.kr/api/payments/webhook/nicepay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  );
}

const eventOf = (payload: Record<string, unknown> = CANCEL) => world.events.get(hashWebhookPayload(payload));
const creditRevokes = () => world.creditRows.filter((r) => r.feature === 'nicepay-cancel');

async function expectOk(res: Response) {
  expect(res.status).toBe(200);
  expect(await res.text()).toBe('OK');
}
async function expectRetry(res: Response) {
  expect(await res.text()).not.toBe('OK'); // 나이스는 'OK' 가 아니면 재전송한다
}

beforeEach(() => {
  world.events.clear();
  world.order = { ...PAID_ORDER };
  world.creditRows.length = 0;
  world.grants = new Set(['tid_1']);
  world.transitions = 0;
  world.fail = { lookup: 0, refund: 0, refundAfterCommit: 0, grants: 0, credits: 0 };
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('나이스 취소 통보 재전송', () => {
  it('주문 조회가 던지면 이벤트는 미처리(failed)로 남고 non-OK → 재수신 때 다시 처리되어 processed', async () => {
    world.fail.lookup = 1;
    await expectRetry(await deliver());
    expect(eventOf()?.processing_status).toBe('failed');
    expect(world.order!.status).toBe('fulfilled');
    expect(creditRevokes()).toHaveLength(0);

    await expectOk(await deliver());
    expect(eventOf()?.processing_status).toBe('processed');
    expect(world.order!.status).toBe('refunded');
    expect(world.transitions).toBe(1);
    expect(creditRevokes()).toEqual([expect.objectContaining({ userId: 'user-1', cost: 3 })]);
    expect(world.grants.has('tid_1')).toBe(false);
  });

  it('처리 중 죽어 received 로 남은 통보도 재수신 때 처리한다', async () => {
    world.events.set(hashWebhookPayload(CANCEL), { processing_status: 'received', error: null });
    await expectOk(await deliver());
    expect(eventOf()?.processing_status).toBe('processed');
    expect(creditRevokes()).toHaveLength(1);
    expect(world.grants.has('tid_1')).toBe(false);
  });

  it('processed 중복은 무동작(조회·회수 없음)', async () => {
    await expectOk(await deliver());
    vi.clearAllMocks();
    world.grants.add('tid_1'); // 다시 돌면 지워질 표식

    await expectOk(await deliver());
    expect(getPaymentOrderByOrderId).not.toHaveBeenCalled();
    expect(revokeEntitlementsOfPayment).not.toHaveBeenCalled();
    expect(creditRevokes()).toHaveLength(1);
    expect(world.transitions).toBe(1);
    expect(world.grants.has('tid_1')).toBe(true);
  });

  it('ignored 중복은 무동작 — 비취소 통보·주문 없는 통보', async () => {
    const paid = { ...CANCEL, status: 'paid' };
    await expectOk(await deliver(paid));
    expect(eventOf(paid)?.processing_status).toBe('ignored');
    await expectOk(await deliver(paid));
    expect(eventOf(paid)?.processing_status).toBe('ignored');

    const unknown = { ...CANCEL, orderId: 'ord_unknown' };
    await expectOk(await deliver(unknown));
    expect(eventOf(unknown)).toEqual({ processing_status: 'ignored', error: 'order_not_found' });
    vi.clearAllMocks();
    await expectOk(await deliver(unknown));
    expect(getPaymentOrderByOrderId).not.toHaveBeenCalled();
    expect(creditRevokes()).toHaveLength(0);
  });

  it('failed 이벤트 재수신 — 첫 시도의 이용권 회수 실패를 전 이중 회수 없이 끝낸다', async () => {
    world.fail.grants = 1;
    await expectRetry(await deliver());
    expect(eventOf()?.processing_status).toBe('failed');
    expect(world.order!.status).toBe('refunded');
    expect(creditRevokes()).toHaveLength(1);
    expect(world.grants.has('tid_1')).toBe(true);

    await expectOk(await deliver());
    expect(eventOf()).toEqual({ processing_status: 'processed', error: null }); // 구독 상품이 아니라 후처리 흔적 없음
    expect(world.grants.has('tid_1')).toBe(false);
    expect(creditRevokes()).toHaveLength(1);
    expect(world.transitions).toBe(1); // 멤버십 원장·GA 훅은 전이 1회
  });

  it('전 회수 중복 차단은 주문 단위 — 같은 사용자의 두 주문 취소면 주문마다 1회씩, 첫 주문 재처리는 다시 빼지 않는다', async () => {
    // 첫 주문: 전 회수 뒤 원장 전이 실패 → fulfilled 로 남아 재처리 때 전 회수를 다시 부른다.
    world.fail.refund = 1;
    await expectRetry(await deliver());
    const ord1 = world.order!;

    const CANCEL_2 = { ...CANCEL, tid: 'tid_2', orderId: 'ord_2' };
    world.order = { ...PAID_ORDER, orderId: 'ord_2', paymentKey: 'tid_2' };
    world.grants.add('tid_2');
    await expectOk(await deliver(CANCEL_2));
    expect(creditRevokes().map((r) => r.metadata.orderId)).toEqual(['ord_1', 'ord_2']);

    world.order = ord1;
    await expectOk(await deliver());
    expect(eventOf()?.processing_status).toBe('processed');
    expect(creditRevokes().map((r) => r.metadata.orderId)).toEqual(['ord_1', 'ord_2']);
  });

  it('첫 시도가 전이를 커밋한 뒤 죽었으면(응답 유실·타임아웃) 재처리는 processed 로 끝내되 멤버십 후처리 확인 흔적을 남긴다', async () => {
    world.order = { ...PAID_ORDER, packageId: 'membership_premium' };
    world.fail.refundAfterCommit = 1;
    await expectRetry(await deliver());
    expect(world.order!.status).toBe('refunded');
    expect(eventOf()?.processing_status).toBe('failed');

    await expectOk(await deliver());
    expect(eventOf()).toEqual({ processing_status: 'processed', error: expect.stringContaining('reprocessed_after_transition') });
    expect(world.transitions).toBe(1); // 훅은 전이 때 1회 그대로 — 재처리가 다시 돌리지 않는다
    expect(world.grants.has('tid_1')).toBe(false);
  });

  it('부분 실패 후 재처리 — 전 회수 뒤 원장 전이가 실패해도 재처리가 전을 다시 빼지 않는다', async () => {
    world.fail.refund = 1;
    await expectRetry(await deliver());
    expect(eventOf()?.processing_status).toBe('failed');
    expect(world.order!.status).toBe('fulfilled'); // 전이 전 — 재처리의 계획도 fulfilled 로 선다
    expect(creditRevokes()).toHaveLength(1);

    await expectOk(await deliver());
    expect(eventOf()?.processing_status).toBe('processed');
    expect(world.order!.status).toBe('refunded');
    expect(world.transitions).toBe(1);
    expect(creditRevokes()).toHaveLength(1);
    expect(world.grants.has('tid_1')).toBe(false);
  });

  it('전 회수 RPC 가 일시 오류면 원장 전이 전에 멈추고, 재처리가 전을 회수한다(전이 뒤에 두면 refunded 를 보고 영구 누락)', async () => {
    world.fail.credits = 1;
    await expectRetry(await deliver());
    expect(eventOf()?.processing_status).toBe('failed');
    expect(world.order!.status).toBe('fulfilled');
    expect(creditRevokes()).toHaveLength(0);

    await expectOk(await deliver());
    expect(eventOf()?.processing_status).toBe('processed');
    expect(creditRevokes()).toHaveLength(1);
    expect(world.transitions).toBe(1);
    expect(world.grants.has('tid_1')).toBe(false);
  });

  it('첫 시도가 canceled 로 바꾼 뒤 이용권 회수가 실패해도 재처리가 결제키로 거둔다', async () => {
    // 지급 도중 실패했는데 승인 시각이 없는 주문 → 종료 상태 canceled(결제 전 취소로 판정).
    world.order = { ...PAID_ORDER, status: 'fulfillment_failed', confirmedAt: null, fulfilledAt: null };
    world.fail.grants = 1;
    await expectRetry(await deliver());
    expect(world.order!.status).toBe('canceled');
    expect(world.grants.has('tid_1')).toBe(true);

    await expectOk(await deliver());
    expect(eventOf()?.processing_status).toBe('processed');
    expect(world.grants.has('tid_1')).toBe(false);
  });
});
