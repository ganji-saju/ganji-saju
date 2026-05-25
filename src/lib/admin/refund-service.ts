// 2026-05-25 Phase 2 — 환불 자동화 오케스트레이션.
//   2단계 워크플로우: admin 요청(request) → super_admin 승인·실행(approve).
//   상태머신 + Toss cancel(멱등) + revokeProductEntitlement. 진짜 원자성은 불가(Toss 외부)라
//   refund_requests 상태로 실패 안전·재시도. 결정 로직(아래 순수 함수)은 단위 테스트로 고정.
//   ※ 실제 Toss 환불 실행은 라이브 super_admin(사람). 여기 코드는 DI 로 mock 테스트.

export type RefundStatus =
  | 'requested'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'revoke_pending'
  | 'rejected';

export type RefundEvent = 'approve' | 'toss_ok' | 'toss_fail' | 'revoke_ok' | 'revoke_fail' | 'reject';

export type AdminRole = 'admin' | 'super_admin';
export type RefundAction = 'request' | 'approve' | 'reject';

// ── 순수 로직 (TDD) ──────────────────────────────────────

/** 환불 요청 입력 검증 — amount>0, paymentKey 존재, reason 비어있지 않음. */
export function validateRefundRequest(input: {
  amount: number | null;
  paymentKey: string | null;
  reason: string;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof input.amount !== 'number' || input.amount <= 0) {
    errors.push('환불 금액(amount)이 0보다 커야 합니다.');
  }
  if (!input.paymentKey) {
    errors.push('paymentKey 가 없어 Toss 취소가 불가합니다.');
  }
  if (!input.reason || !input.reason.trim()) {
    errors.push('환불 사유(reason)가 필요합니다.');
  }
  return { ok: errors.length === 0, errors };
}

const TRANSITIONS: Record<RefundStatus, Partial<Record<RefundEvent, RefundStatus>>> = {
  requested: { approve: 'processing', reject: 'rejected' },
  processing: {
    toss_ok: 'processing',
    toss_fail: 'failed',
    revoke_ok: 'completed',
    revoke_fail: 'revoke_pending',
  },
  failed: { approve: 'processing' }, // Toss 재시도(idempotency_key 동일 → 이중취소 없음)
  revoke_pending: { revoke_ok: 'completed' }, // revoke 재시도
  completed: {},
  rejected: {},
};

/** 상태 전이. 허용되지 않으면 null. */
export function nextRefundStatus(current: RefundStatus, event: RefundEvent): RefundStatus | null {
  return TRANSITIONS[current]?.[event] ?? null;
}

/** 역할 게이트 — admin 은 요청만, super_admin 은 전부. */
export function canRoleActOnRefund(role: AdminRole, action: RefundAction): boolean {
  if (role === 'super_admin') return true;
  if (role === 'admin') return action === 'request';
  return false;
}

// ── 실행 오케스트레이션 (DI) ──────────────────────────────
// DB·Toss·revoke 를 주입받아 상태머신을 실행. 라우트가 실제 구현 주입, 테스트는 mock.

export interface RefundRequestSnapshot {
  id: string;
  status: RefundStatus;
  payment_key: string | null;
  idempotency_key: string;
  user_id: string;
  product_id: string;
  scope_key: string | null;
  reason: string;
}

export interface RefundExecutionDeps {
  loadRequest(requestId: string): Promise<RefundRequestSnapshot | null>;
  setStatus(
    requestId: string,
    status: RefundStatus,
    patch?: { approvedBy?: string; tossResponse?: unknown; errorMessage?: string | null }
  ): Promise<void>;
  /** Toss 결제취소. idempotencyKey 로 재시도 이중취소 방지. */
  tossCancel(
    paymentKey: string,
    options: { cancelReason: string; idempotencyKey: string }
  ): Promise<{ ok: boolean; response?: unknown; error?: string }>;
  /** revokeProductEntitlement wrapper. */
  revoke(args: {
    userId: string;
    productId: string;
    scopeKey: string | null;
    reason: string;
    actor: string;
    paymentKey: string | null;
  }): Promise<{ revoked: boolean }>;
}

export interface RefundExecutionResult {
  status: RefundStatus;
  error?: string;
}

/**
 * 환불 실행(super_admin 승인). 상태머신(nextRefundStatus)으로 전이:
 * requested/failed → processing → Toss cancel(멱등) → revoke → completed.
 * Toss 실패=failed(재시도), Toss성공·revoke실패=revoke_pending(경보·revoke 재시도).
 * 어떤 단계도 실패해도 상태를 남겨 재시도 안전.
 */
export async function executeRefund(
  params: { requestId: string; approvedBy: string },
  deps: RefundExecutionDeps
): Promise<RefundExecutionResult> {
  const req = await deps.loadRequest(params.requestId);
  if (!req) return { status: 'failed', error: '환불 요청을 찾을 수 없습니다.' };

  // approve 전이 검증(requested/failed 에서만 processing).
  if (nextRefundStatus(req.status, 'approve') !== 'processing') {
    return { status: req.status, error: `상태 '${req.status}' 에서는 승인할 수 없습니다.` };
  }
  if (!req.payment_key) {
    await deps.setStatus(req.id, 'failed', { errorMessage: 'paymentKey 없음 — Toss 취소 불가' });
    return { status: 'failed', error: 'paymentKey 없음' };
  }

  await deps.setStatus(req.id, 'processing', { approvedBy: params.approvedBy });

  const toss = await deps.tossCancel(req.payment_key, {
    cancelReason: req.reason,
    idempotencyKey: req.idempotency_key,
  });
  if (!toss.ok) {
    const failed = nextRefundStatus('processing', 'toss_fail') ?? 'failed';
    await deps.setStatus(req.id, failed, {
      tossResponse: toss.response,
      errorMessage: toss.error ?? 'Toss 결제취소 실패',
    });
    return { status: failed, error: toss.error ?? 'Toss 결제취소 실패' };
  }

  let revoked = false;
  try {
    const r = await deps.revoke({
      userId: req.user_id,
      productId: req.product_id,
      scopeKey: req.scope_key,
      reason: req.reason,
      actor: params.approvedBy,
      paymentKey: req.payment_key,
    });
    revoked = r.revoked;
  } catch {
    revoked = false;
  }

  if (!revoked) {
    const pending = nextRefundStatus('processing', 'revoke_fail') ?? 'revoke_pending';
    await deps.setStatus(req.id, pending, {
      tossResponse: toss.response,
      errorMessage: 'Toss 환불됨 · entitlement 회수 실패 — 재시도 필요(경보)',
    });
    return { status: pending, error: 'revoke failed after toss success' };
  }

  const completed = nextRefundStatus('processing', 'revoke_ok') ?? 'completed';
  await deps.setStatus(req.id, completed, { tossResponse: toss.response, errorMessage: null });
  return { status: completed };
}
