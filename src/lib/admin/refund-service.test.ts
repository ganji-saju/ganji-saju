import assert from 'node:assert/strict';
import {
  canRoleActOnRefund,
  executeRefund,
  isAlreadyCanceledTossError,
  isCanceledForRefundRequest,
  isFullyCanceledTossPayment,
  nextRefundStatus,
  validateRefundRequest,
  type RefundExecutionDeps,
  type RefundKind,
  type RefundStatus,
} from './refund-service';

// 2026-05-25 Phase 2 — 환불 상태머신·검증·역할게이트 순수 로직.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('validateRefundRequest: 정상 → ok', () => {
  const r = validateRefundRequest({ amount: 49000, paymentKey: 'pk_1', reason: '고객 변심' });
  assert.equal(r.ok, true);
  assert.equal(r.errors.length, 0);
});

test('validateRefundRequest: amount 0/null·paymentKey 없음·reason 공백 → 오류', () => {
  assert.equal(validateRefundRequest({ amount: 0, paymentKey: 'pk', reason: 'x' }).ok, false);
  assert.equal(validateRefundRequest({ amount: null, paymentKey: 'pk', reason: 'x' }).ok, false);
  assert.equal(validateRefundRequest({ amount: 100, paymentKey: null, reason: 'x' }).ok, false);
  assert.equal(validateRefundRequest({ amount: 100, paymentKey: 'pk', reason: '  ' }).ok, false);
});

test('nextRefundStatus: 정상 흐름 전이', () => {
  assert.equal(nextRefundStatus('requested', 'approve'), 'processing');
  assert.equal(nextRefundStatus('processing', 'toss_ok'), 'processing');
  assert.equal(nextRefundStatus('processing', 'toss_fail'), 'failed');
  assert.equal(nextRefundStatus('processing', 'revoke_ok'), 'completed');
  assert.equal(nextRefundStatus('processing', 'revoke_fail'), 'revoke_pending');
  assert.equal(nextRefundStatus('requested', 'reject'), 'rejected');
});

test('nextRefundStatus: 재시도 — failed/revoke_pending 에서 복구', () => {
  assert.equal(nextRefundStatus('failed', 'approve'), 'processing'); // Toss 재시도(멱등)
  assert.equal(nextRefundStatus('revoke_pending', 'revoke_ok'), 'completed'); // revoke 재시도
});

test('nextRefundStatus: 잘못된 전이 → null', () => {
  assert.equal(nextRefundStatus('completed', 'approve'), null);
  assert.equal(nextRefundStatus('rejected', 'approve'), null);
  assert.equal(nextRefundStatus('requested', 'toss_ok'), null);
});

test('canRoleActOnRefund: admin=요청만, super_admin=전부', () => {
  assert.equal(canRoleActOnRefund('admin', 'request'), true);
  assert.equal(canRoleActOnRefund('admin', 'approve'), false);
  assert.equal(canRoleActOnRefund('admin', 'reject'), false);
  assert.equal(canRoleActOnRefund('super_admin', 'request'), true);
  assert.equal(canRoleActOnRefund('super_admin', 'approve'), true);
  assert.equal(canRoleActOnRefund('super_admin', 'reject'), true);
});

test('이미 취소된 Toss 응답 판정', () => {
  assert.equal(isAlreadyCanceledTossError('이미 취소된 결제 입니다.'), true);
  assert.equal(isAlreadyCanceledTossError('temporary failure'), false);
  assert.equal(isFullyCanceledTossPayment({ status: 'CANCELED', balanceAmount: 0 }), true);
  assert.equal(isFullyCanceledTossPayment({ status: 'CANCELED', balanceAmount: 550 }), false);
  assert.equal(isFullyCanceledTossPayment({ status: 'DONE', balanceAmount: 0 }), false);
  assert.equal(
    isCanceledForRefundRequest({ status: 'PARTIAL_CANCELED', totalAmount: 2000, balanceAmount: 1429 }, 571),
    true
  );
  assert.equal(
    isCanceledForRefundRequest({ status: 'PARTIAL_CANCELED', totalAmount: 2000, balanceAmount: 1800 }, 571),
    false
  );
});

// ── executeRefund 오케스트레이션 (DI mock — 실 Toss 호출 없음) ──

function makeDeps(opts: {
  status?: RefundStatus;
  refundKind?: RefundKind;
  amount?: number | null;
  tossOk?: boolean;
  tossError?: string;
  revokeOk?: boolean;
  revokeThrows?: boolean;
  lookupPayment?: { status?: string | null; balanceAmount?: number | null; totalAmount?: number | null };
}): { deps: RefundExecutionDeps; statuses: RefundStatus[]; tossArgs: unknown[] } {
  const statuses: RefundStatus[] = [];
  const tossArgs: unknown[] = [];
  const deps: RefundExecutionDeps = {
    async loadRequest() {
      return {
        id: 'req1',
        status: opts.status ?? 'requested',
        refund_kind: opts.refundKind ?? 'product',
        payment_key: 'pk_1',
        idempotency_key: 'idem-1',
        user_id: 'u1',
        product_id: 'lifetime-report',
        scope_key: null,
        amount: opts.amount ?? 49000,
        original_amount: opts.amount ?? 49000,
        credit_amount: opts.refundKind === 'credit_purchase' ? 2 : null,
        credit_transaction_id: opts.refundKind === 'credit_purchase' ? 'tx1' : null,
        reason: '고객 변심',
      };
    },
    async setStatus(_id, status) {
      statuses.push(status);
    },
    async tossCancel(paymentKey, options) {
      tossArgs.push({ paymentKey, ...options });
      return opts.tossOk === false
        ? { ok: false, error: opts.tossError ?? 'toss 거절' }
        : { ok: true, response: { status: 'CANCELED' } };
    },
    async loadTossPayment() {
      return {
        ok: true,
        payment: opts.lookupPayment ?? { status: 'DONE', balanceAmount: 49000, totalAmount: 49000 },
      };
    },
    async revoke() {
      if (opts.revokeThrows) throw new Error('db error');
      return { revoked: opts.revokeOk !== false };
    },
  };
  return { deps, statuses, tossArgs };
}

test('executeRefund: Toss 성공 + revoke 성공 → completed, 멱등키 전달', async () => {
  const { deps, statuses, tossArgs } = makeDeps({ tossOk: true, revokeOk: true });
  const result = await executeRefund({ requestId: 'req1', approvedBy: 'super1' }, deps);
  assert.equal(result.status, 'completed');
  assert.deepEqual(statuses, ['processing', 'completed']);
  assert.equal((tossArgs[0] as { idempotencyKey: string }).idempotencyKey, 'idem-1');
});

test('executeRefund: 전 부분환불은 Toss cancelAmount 를 전달', async () => {
  const { deps, statuses, tossArgs } = makeDeps({
    refundKind: 'credit_purchase',
    amount: 571,
    tossOk: true,
    revokeOk: true,
  });
  const result = await executeRefund({ requestId: 'req1', approvedBy: 'super1' }, deps);
  assert.equal(result.status, 'completed');
  assert.deepEqual(statuses, ['processing', 'completed']);
  assert.equal((tossArgs[0] as { cancelAmount: number }).cancelAmount, 571);
});

test('executeRefund: Toss 실패 → failed (재시도 가능)', async () => {
  const { deps, statuses } = makeDeps({ tossOk: false });
  const result = await executeRefund({ requestId: 'req1', approvedBy: 'super1' }, deps);
  assert.equal(result.status, 'failed');
  assert.deepEqual(statuses, ['processing', 'failed']);
});

test('executeRefund: Toss가 이미 취소된 결제라고 하면 조회 검증 후 회수하고 completed', async () => {
  const { deps, statuses } = makeDeps({
    tossOk: false,
    tossError: '이미 취소된 결제 입니다.',
    lookupPayment: { status: 'CANCELED', balanceAmount: 0, totalAmount: 49000 },
  });
  const result = await executeRefund({ requestId: 'req1', approvedBy: 'super1' }, deps);
  assert.equal(result.status, 'completed');
  assert.deepEqual(statuses, ['processing', 'completed']);
});

test('executeRefund: 전 부분환불이 이미 Toss에 반영됐으면 조회 검증 후 회수하고 completed', async () => {
  const { deps, statuses } = makeDeps({
    refundKind: 'credit_purchase',
    amount: 571,
    tossOk: false,
    tossError: '이미 취소된 결제 입니다.',
    lookupPayment: { status: 'PARTIAL_CANCELED', balanceAmount: 1429, totalAmount: 2000 },
  });
  const result = await executeRefund({ requestId: 'req1', approvedBy: 'super1' }, deps);
  assert.equal(result.status, 'completed');
  assert.deepEqual(statuses, ['processing', 'completed']);
});

test('executeRefund: 이미 취소된 결제지만 권한 회수 실패면 revoke_pending', async () => {
  const { deps, statuses } = makeDeps({
    tossOk: false,
    tossError: '이미 취소된 결제 입니다.',
    lookupPayment: { status: 'CANCELED', balanceAmount: 0, totalAmount: 49000 },
    revokeThrows: true,
  });
  const result = await executeRefund({ requestId: 'req1', approvedBy: 'super1' }, deps);
  assert.equal(result.status, 'revoke_pending');
  assert.deepEqual(statuses, ['processing', 'revoke_pending']);
});

test('executeRefund: Toss 성공·revoke 실패 → revoke_pending (경보)', async () => {
  const { deps, statuses } = makeDeps({ tossOk: true, revokeThrows: true });
  const result = await executeRefund({ requestId: 'req1', approvedBy: 'super1' }, deps);
  assert.equal(result.status, 'revoke_pending');
  assert.deepEqual(statuses, ['processing', 'revoke_pending']);
});

test('executeRefund: revoke_pending 재시도는 Toss 취소 없이 권한 회수만 재시도', async () => {
  const { deps, statuses, tossArgs } = makeDeps({ status: 'revoke_pending', revokeOk: true });
  const result = await executeRefund({ requestId: 'req1', approvedBy: 'super1' }, deps);
  assert.equal(result.status, 'completed');
  assert.deepEqual(statuses, ['processing', 'completed']);
  assert.equal(tossArgs.length, 0);
});

test('executeRefund: 이미 completed 면 승인 불가 (상태 불변)', async () => {
  const { deps, statuses } = makeDeps({ status: 'completed' });
  const result = await executeRefund({ requestId: 'req1', approvedBy: 'super1' }, deps);
  assert.equal(result.status, 'completed');
  assert.ok(result.error);
  assert.deepEqual(statuses, []); // setStatus 호출 안 됨
});
