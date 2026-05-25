import assert from 'node:assert/strict';
import {
  canRoleActOnRefund,
  executeRefund,
  nextRefundStatus,
  validateRefundRequest,
  type RefundExecutionDeps,
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

// ── executeRefund 오케스트레이션 (DI mock — 실 Toss 호출 없음) ──

function makeDeps(opts: {
  status?: RefundStatus;
  tossOk?: boolean;
  revokeOk?: boolean;
  revokeThrows?: boolean;
}): { deps: RefundExecutionDeps; statuses: RefundStatus[]; tossArgs: unknown[] } {
  const statuses: RefundStatus[] = [];
  const tossArgs: unknown[] = [];
  const deps: RefundExecutionDeps = {
    async loadRequest() {
      return {
        id: 'req1',
        status: opts.status ?? 'requested',
        payment_key: 'pk_1',
        idempotency_key: 'idem-1',
        user_id: 'u1',
        product_id: 'lifetime-report',
        scope_key: null,
        reason: '고객 변심',
      };
    },
    async setStatus(_id, status) {
      statuses.push(status);
    },
    async tossCancel(paymentKey, options) {
      tossArgs.push({ paymentKey, ...options });
      return opts.tossOk === false
        ? { ok: false, error: 'toss 거절' }
        : { ok: true, response: { status: 'CANCELED' } };
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

test('executeRefund: Toss 실패 → failed (재시도 가능)', async () => {
  const { deps, statuses } = makeDeps({ tossOk: false });
  const result = await executeRefund({ requestId: 'req1', approvedBy: 'super1' }, deps);
  assert.equal(result.status, 'failed');
  assert.deepEqual(statuses, ['processing', 'failed']);
});

test('executeRefund: Toss 성공·revoke 실패 → revoke_pending (경보)', async () => {
  const { deps, statuses } = makeDeps({ tossOk: true, revokeThrows: true });
  const result = await executeRefund({ requestId: 'req1', approvedBy: 'super1' }, deps);
  assert.equal(result.status, 'revoke_pending');
  assert.deepEqual(statuses, ['processing', 'revoke_pending']);
});

test('executeRefund: 이미 completed 면 승인 불가 (상태 불변)', async () => {
  const { deps, statuses } = makeDeps({ status: 'completed' });
  const result = await executeRefund({ requestId: 'req1', approvedBy: 'super1' }, deps);
  assert.equal(result.status, 'completed');
  assert.ok(result.error);
  assert.deepEqual(statuses, []); // setStatus 호출 안 됨
});
