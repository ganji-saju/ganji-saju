// 2026-09-14 — 나이스 취소 통보 재전송 흡수 버그. 예전엔 멱등 기록이 처리보다 먼저라, 처리 전에 죽은(received)·실패한(failed) 통보도
//   재수신 때 'duplicate → OK' 로 흡수돼 영구 미처리였다(주문 조회가 try 밖 → 500 → 자동 재전송 10회 전부 흡수).
//   지키는 것: 미완 통보는 다시 처리 · 끝난(processed/ignored) 통보만 무동작 · 재처리해도 전은 주문당 1회 · 이용권은 결제키로 끝까지.
//   DB 는 가짜 — 이벤트 표·unlock_credit_feature_once(사용자·feature·metadata 중복 차단)만 흉내, 주문 원장·이용권 회수는 목.
// 2026-09-14 — 위조 가드(tid 로 주문 · 나이스 재조회 대조 · 서명) + 일부 취소(partialCancelled)는 전액 처리 금지. 재조회는 명세 모양 픽스처
//   (docs/nicepay-v2-cancel-facts.md — 샌드박스는 실거래 통보·부분취소를 안 보내 E2E 불가).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  /** 나이스 재조회 응답 — 기본은 world.order 의 전액 취소 결제 객체, 여기 값으로 덮는다. */
  lookupPatch: {} as Record<string, unknown>,
  lookupError: null as null | (Error & { resultCode?: string }),
  partials: [] as Array<Record<string, unknown>>,
  partialOutcome: 'applied' as string,
  refundPayments: [] as unknown[],
  /** 같은 tid·사유로 1시간 안에 거부한 적 있다(운영 메일 억제). */
  recentRejection: false,
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
      return world.order && world.order.orderId === orderId ? { ...world.order } : null;
    }),
    // 통보의 주문은 tid(= 결제키)로 찾는다.
    getPaymentOrderByPaymentKey: vi.fn(async (paymentKey: string) => {
      if (world.fail.lookup > 0) {
        world.fail.lookup -= 1;
        throw new Error('db_down');
      }
      return world.order && world.order.paymentKey === paymentKey ? { ...world.order } : null;
    }),
    applyPartialRefund: vi.fn(async (input: Record<string, unknown>) => {
      world.partials.push(input);
      return world.partialOutcome;
    }),
    hasRecentWebhookRejection: vi.fn(async () => world.recentRejection),
    // 전이 분기(멤버십 원장·GA 훅)는 neq('status','refunded') 로 1회 — transitions 로 센다.
    markPaymentOrderRefunded: vi.fn(async (input: { payment?: unknown }) => {
      world.refundPayments.push(input.payment);
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

vi.mock('@/lib/payments/nicepay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/payments/nicepay')>();
  return {
    ...actual, // 서명 대조·취소 건 고르기는 실제 함수
    getNicepayPayment: vi.fn(async (tid: string) => {
      if (world.lookupError) throw world.lookupError;
      const o = world.order!;
      return {
        resultCode: '0000',
        tid,
        orderId: o.orderId,
        amount: o.amount,
        status: 'cancelled',
        balanceAmt: 0,
        cancels: [{ tid: 'ctid_full', amount: o.amount, cancelledAt: '2026-09-14T10:00:00.000+0900' }],
        ...world.lookupPatch,
      };
    }),
  };
});

vi.mock('@/lib/email/ops-alert-email', () => ({ sendOpsAlertEmail: vi.fn(async () => undefined) }));

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

import { getPaymentOrderByPaymentKey, hashWebhookPayload } from '@/lib/payments/order-ledger';
import { sendOpsAlertEmail } from '@/lib/email/ops-alert-email';
import { nicepaySha256Hex } from '@/lib/payments/nicepay';
import { revokeEntitlementsOfPayment } from '@/lib/product-entitlements';
import { POST } from './route';

// 대화상담(전 3개 지급)을 산 주문 — 전·이용권 둘 다 회수 대상.
const PAID_ORDER = {
  orderId: 'ord_1',
  userId: 'user-1',
  packageId: 'taste_dialogue_entry',
  status: 'fulfilled',
  paymentKey: 'tid_1',
  amount: 3300,
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
  world.lookupPatch = {};
  world.lookupError = null;
  world.partials.length = 0;
  world.partialOutcome = 'applied';
  world.refundPayments.length = 0;
  world.recentRejection = false;
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
    expect(getPaymentOrderByPaymentKey).not.toHaveBeenCalled();
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

    const unknown = { ...CANCEL, tid: 'tid_unknown', orderId: 'ord_unknown' };
    await expectOk(await deliver(unknown));
    expect(eventOf(unknown)).toEqual({ processing_status: 'ignored', error: 'order_not_found' });
    vi.clearAllMocks();
    await expectOk(await deliver(unknown));
    expect(getPaymentOrderByPaymentKey).not.toHaveBeenCalled();
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

describe('나이스 취소 통보 위조 가드 — tid 로 주문 · 재조회 대조 · 서명 (2026-09-14 사용자 결정 가)', () => {
  const prevEnv = process.env.VERCEL_ENV;
  beforeEach(() => {
    process.env.VERCEL_ENV = 'production'; // 불일치 운영 메일은 프로덕션만
    process.env.NICEPAY_SECRET_KEY = 'spec_secret';
  });
  afterEach(() => {
    process.env.VERCEL_ENV = prevEnv;
  });

  /** 아무것도 안 바뀌었다 — 원장·전·이용권·일부 환불 모두. */
  function expectUntouched() {
    expect(world.order!.status).toBe('fulfilled');
    expect(world.transitions).toBe(0);
    expect(creditRevokes()).toHaveLength(0);
    expect(world.grants.has('tid_1')).toBe(true);
    expect(world.partials).toHaveLength(0);
  }
  /** mails — tid 로 우리 주문을 찾은 뒤의 불일치만 운영 메일(진짜 취소를 잘못 거부해도 사람이 바로 안다). 그 전 단계는 무인증으로 만들 수 있어 0. */
  async function expectRejected(payload: Record<string, unknown>, reason: string, mails = 1) {
    await expectOk(await deliver(payload)); // 재전송해도 같은 판정 — 'OK'
    expect(eventOf(payload)).toEqual({ processing_status: 'ignored', error: `forgery_guard:${reason}` });
    expect(sendOpsAlertEmail).toHaveBeenCalledTimes(mails);
    expectUntouched();
  }

  it('tid 불일치 — orderId 의 주문은 있는데 결제키가 다르면 거부 · 메일 없음(무인증 요청으로 만들 수 있다)', async () => {
    await expectRejected({ ...CANCEL, tid: 'tid_forged' }, 'tid_mismatch', 0);
  });

  it('무인증 스팸 — 모르는 tid + 틀린 서명 25건은 주문 없음으로 끝나고 운영 메일 0통', async () => {
    for (let n = 0; n < 25; n += 1) await expectOk(await deliver({ status: 'cancelled', tid: 'x', signature: 'bad', n }));
    expect(sendOpsAlertEmail).not.toHaveBeenCalled();
    expect(eventOf({ status: 'cancelled', tid: 'x', signature: 'bad', n: 0 })?.error).toMatch(/^order_not_found/);
  });

  it('운영 메일은 tid·사유당 1시간 1통 — 최근 같은 거부가 있으면 억제(거부·기록은 그대로)', async () => {
    world.lookupPatch = { status: 'paid' };
    world.recentRejection = true;
    await expectRejected(CANCEL, 'lookup_status:paid', 0);
  });

  it('거부된 통보는 재수신 때 다시 검증 — 원인을 고친 뒤 콘솔 재전송이 복구 경로(ignored 흡수 안 함)', async () => {
    world.lookupPatch = { orderId: 'ord_other' };
    await expectRejected(CANCEL, 'lookup_order_mismatch');
    world.lookupPatch = {};
    await expectOk(await deliver());
    expect(eventOf()).toEqual({ processing_status: 'processed', error: null });
    expect(world.order!.status).toBe('refunded');
    expect(creditRevokes()).toHaveLength(1);
  });

  it('결제키가 없는 주문(승인 응답 유실 뒤 망취소)은 orderId 로 찾아 재조회 대조로 처리 · 재조회가 그 주문과 다르면 거부', async () => {
    world.order = { ...PAID_ORDER, status: 'payment_failed', paymentKey: null, confirmedAt: null, fulfilledAt: null };
    await expectOk(await deliver());
    expect(eventOf()?.processing_status).toBe('processed');
    expect(world.order!.status).toBe('canceled');
    expect(sendOpsAlertEmail).not.toHaveBeenCalled();

    world.order = { ...PAID_ORDER, status: 'payment_failed', paymentKey: null, confirmedAt: null, fulfilledAt: null };
    world.lookupPatch = { amount: 9900 };
    const other = { ...CANCEL, ediDate: 'k' };
    await expectOk(await deliver(other));
    expect(eventOf(other)).toEqual({ processing_status: 'ignored', error: 'forgery_guard:lookup_order_mismatch' });
    expect(world.order!.status).toBe('payment_failed');
  });

  it('통보 orderId 가 tid 의 주문과 다르면 거부 · 우리가 만든 취소 요청 번호(cxl…_원주문)는 같은 주문', async () => {
    await expectRejected({ ...CANCEL, orderId: 'ord_2' }, 'order_id_mismatch');
    const cxl = { ...CANCEL, orderId: 'cxl0123456789ab_ord_1' };
    await expectOk(await deliver(cxl));
    expect(eventOf(cxl)?.processing_status).toBe('processed');
  });

  it('재조회가 취소 상태가 아니면 거부 — 전액 통보인데 재조회 partialCancelled 도 거부', async () => {
    world.lookupPatch = { status: 'paid' };
    await expectRejected(CANCEL, 'lookup_status:paid');
    vi.clearAllMocks();
    world.lookupPatch = { status: 'partialCancelled', balanceAmt: 2300 };
    const other = { ...CANCEL, ediDate: 'x' };
    await expectRejected(other, 'lookup_status:partialCancelled');
  });

  it('재조회 orderId·amount 가 주문과 다르면 거부', async () => {
    world.lookupPatch = { orderId: 'ord_other' };
    await expectRejected(CANCEL, 'lookup_order_mismatch');
    vi.clearAllMocks();
    world.lookupPatch = { amount: 99000 };
    await expectRejected({ ...CANCEL, ediDate: 'y' }, 'lookup_order_mismatch');
  });

  // ⚠️ 서명식·키 선택이 운영 통보로 미검증 — 틀리면 진짜 취소가 전부 거부된다. 대조는 하되 흔적만, 판정은 재조회 대조.
  it('서명이 틀려도 거부하지 않는다(흔적만) — 재조회 대조가 맞으면 처리 · 맞는 서명은 흔적 없음', async () => {
    const ediDate = '2026-09-14T10:00:00.000+0900';
    const bad = { ...CANCEL, ediDate, signature: 'deadbeef' };
    await expectOk(await deliver(bad));
    expect(eventOf(bad)).toEqual({ processing_status: 'processed', error: expect.stringContaining('signature_mismatch') });
    expect(world.order!.status).toBe('refunded');
    expect(sendOpsAlertEmail).not.toHaveBeenCalled();

    world.order = { ...PAID_ORDER };
    const signed = { ...CANCEL, ediDate, signature: nicepaySha256Hex(`tid_1${3300}${ediDate}spec_secret`) };
    await expectOk(await deliver(signed));
    expect(eventOf(signed)).toEqual({ processing_status: 'processed', error: null });
  });

  it('틀린 서명 + 재조회 불일치 — 거부 사유에 서명 흔적도 같이', async () => {
    world.lookupPatch = { status: 'paid' };
    const bad = { ...CANCEL, ediDate: 'q', signature: 'deadbeef' };
    await expectOk(await deliver(bad));
    expect(eventOf(bad)).toEqual({ processing_status: 'ignored', error: expect.stringMatching(/^forgery_guard:lookup_status:paid \| signature_mismatch/) });
    expectUntouched();
  });

  it('재조회 오류는 결과 코드가 있어도(5xx 9999·401 U104·키 설정 오류) failed + non-OK → 재전송 때 처리(영구 거부하지 않는다)', async () => {
    world.lookupError = new Error('fetch failed');
    await expectRetry(await deliver());
    expect(eventOf()?.processing_status).toBe('failed');
    expectUntouched();
    expect(sendOpsAlertEmail).not.toHaveBeenCalled();

    world.lookupError = null;
    await expectOk(await deliver());
    expect(eventOf()?.processing_status).toBe('processed');
    expect(world.order!.status).toBe('refunded');

    world.order = { ...PAID_ORDER };
    world.grants.add('tid_1');
    world.transitions = 0;
    world.creditRows.length = 0;
    vi.clearAllMocks();
    const coded = { ...CANCEL, ediDate: 'z' };
    for (const code of ['9999', 'U104']) {
      world.lookupError = Object.assign(new Error('PG 오류'), { resultCode: code });
      await expectRetry(await deliver(coded));
      expect(eventOf(coded)?.processing_status).toBe('failed');
      expectUntouched();
    }
    world.lookupError = null;
    await expectOk(await deliver(coded));
    expect(eventOf(coded)?.processing_status).toBe('processed');
    expect(world.order!.status).toBe('refunded');
    expect(sendOpsAlertEmail).not.toHaveBeenCalled();
  });

  it('정상 전액 취소 — 재조회 결제 객체로 환불 기록(귀속 시각의 정본) · 전·이용권 회수', async () => {
    await expectOk(await deliver());
    expect(eventOf()?.processing_status).toBe('processed');
    expect(world.refundPayments).toEqual([expect.objectContaining({ status: 'cancelled', cancels: [expect.objectContaining({ tid: 'ctid_full' })] })]);
    expect(creditRevokes()).toHaveLength(1);
    expect(world.grants.has('tid_1')).toBe(false);
    expect(sendOpsAlertEmail).not.toHaveBeenCalled();
  });

  const PARTIAL = {
    tid: 'tid_1',
    orderId: 'ord_1',
    status: 'partialCancelled',
    amount: 3300,
    balanceAmt: 2300,
    cancelledTid: 'ctid_p1',
    cancels: [{ tid: 'ctid_p1', amount: 1000, cancelledAt: '2026-09-14T10:00:00.000+0900' }],
  };

  it('일부 취소 — 전액 처리 금지(refunded·전/이용권 회수 없음) · 재조회 cancels[] 의 그 거래 금액으로 applyPartialRefund', async () => {
    world.lookupPatch = { status: 'partialCancelled', balanceAmt: 2300, cancels: [{ tid: 'ctid_p1', amount: 1000 }] };
    await expectOk(await deliver(PARTIAL));
    expect(eventOf(PARTIAL)).toEqual({ processing_status: 'processed', error: 'partial:applied' });
    expect(world.partials).toEqual([expect.objectContaining({ orderId: 'ord_1', cancelTid: 'ctid_p1', amount: 1000, source: 'webhook' })]);
    expect(world.order!.status).toBe('fulfilled');
    expect(world.transitions).toBe(0);
    expect(creditRevokes()).toHaveLength(0);
    expect(world.grants.has('tid_1')).toBe(true);
  });

  it('일부 취소 통보가 늦게 와서 재조회는 이미 잔여 전부 취소(cancelled)여도 그 거래만 일부로 반영', async () => {
    world.lookupPatch = { status: 'cancelled', balanceAmt: 0, cancels: [{ tid: 'ctid_p1', amount: 1000 }, { tid: 'ctid_rest', amount: 2300 }] };
    await expectOk(await deliver(PARTIAL));
    expect(world.partials).toEqual([expect.objectContaining({ cancelTid: 'ctid_p1', amount: 1000 })]);
    expect(world.transitions).toBe(0); // 전액은 잔여 취소 통보(cancelled)가 따로 처리한다
  });

  it('일부 취소 원장 일시 오류(failed)는 failed + non-OK → 재전송 때 다시 적용(조각 표식으로 멱등)', async () => {
    world.lookupPatch = { status: 'partialCancelled', balanceAmt: 2300, cancels: [{ tid: 'ctid_p1', amount: 1000 }] };
    world.partialOutcome = 'failed';
    await expectRetry(await deliver(PARTIAL));
    expect(eventOf(PARTIAL)).toEqual({ processing_status: 'failed', error: 'partial:failed' });
    world.partialOutcome = 'duplicate';
    await expectOk(await deliver(PARTIAL));
    expect(eventOf(PARTIAL)).toEqual({ processing_status: 'processed', error: 'partial:duplicate' });
    expect(world.partials).toHaveLength(2);
    expect(world.transitions).toBe(0);
  });

  it('일부 취소의 거래가 재조회 cancels[] 에 없으면 거부(금액을 통보 본문에서 믿지 않는다)', async () => {
    world.lookupPatch = { status: 'partialCancelled', balanceAmt: 2300, cancels: [{ tid: 'ctid_other', amount: 1000 }] };
    await expectRejected(PARTIAL, 'cancel_not_in_lookup');
  });
});
