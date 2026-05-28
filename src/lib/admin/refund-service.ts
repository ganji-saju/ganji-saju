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
export type RefundKind = 'product' | 'credit_purchase';

export const REFUND_DEDUPE_STATUSES = [
  'requested',
  'processing',
  'completed',
  'failed',
  'revoke_pending',
] satisfies RefundStatus[];

export interface TossRefundPaymentSnapshot {
  status?: string | null;
  balanceAmount?: number | null;
  totalAmount?: number | null;
  cancels?: unknown[] | null;
  [key: string]: unknown;
}

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

export function isAlreadyCanceledTossError(error: string | undefined | null): boolean {
  if (!error) return false;
  return error.includes('이미 취소된 결제') || /already\s+cancell?ed/i.test(error);
}

export function isFullyCanceledTossPayment(payment: TossRefundPaymentSnapshot | null): boolean {
  return payment?.status === 'CANCELED' && payment.balanceAmount === 0;
}

function getTossCanceledAmount(payment: TossRefundPaymentSnapshot | null): number | null {
  if (!payment) return null;
  if (Array.isArray(payment.cancels)) {
    return payment.cancels.reduce<number>((sum, cancel) => {
      const payload = cancel && typeof cancel === 'object' ? (cancel as Record<string, unknown>) : {};
      const amount = payload.cancelAmount;
      return sum + (typeof amount === 'number' && Number.isFinite(amount) ? amount : 0);
    }, 0);
  }
  if (
    typeof payment.totalAmount === 'number' &&
    Number.isFinite(payment.totalAmount) &&
    typeof payment.balanceAmount === 'number' &&
    Number.isFinite(payment.balanceAmount)
  ) {
    return Math.max(0, payment.totalAmount - payment.balanceAmount);
  }
  return null;
}

export function isCanceledForRefundRequest(
  payment: TossRefundPaymentSnapshot | null,
  requestedAmount: number | null | undefined
): boolean {
  if (!requestedAmount) return isFullyCanceledTossPayment(payment);
  const canceledAmount = getTossCanceledAmount(payment);
  return canceledAmount !== null && canceledAmount >= requestedAmount;
}

// ── 실행 오케스트레이션 (DI) ──────────────────────────────
// DB·Toss·revoke 를 주입받아 상태머신을 실행. 라우트가 실제 구현 주입, 테스트는 mock.

export interface RefundRequestSnapshot {
  id: string;
  status: RefundStatus;
  refund_kind: RefundKind;
  payment_key: string | null;
  idempotency_key: string;
  user_id: string;
  product_id: string;
  scope_key: string | null;
  amount: number | null;
  original_amount: number | null;
  credit_amount: number | null;
  credit_transaction_id: string | null;
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
    options: { cancelReason: string; idempotencyKey: string; cancelAmount?: number }
  ): Promise<{ ok: boolean; response?: unknown; error?: string }>;
  /** Toss 결제 조회. 이미 취소된 결제인지 확인할 때 사용한다. */
  loadTossPayment?(
    paymentKey: string
  ): Promise<{ ok: true; payment: TossRefundPaymentSnapshot } | { ok: false; error?: string }>;
  /** revokeProductEntitlement wrapper. */
  revoke(args: {
    userId: string;
    productId: string;
    scopeKey: string | null;
    reason: string;
    actor: string;
    paymentKey: string | null;
    refundKind: RefundKind;
    refundRequestId: string;
    amount: number | null;
    originalAmount: number | null;
    creditAmount: number | null;
    creditTransactionId: string | null;
  }): Promise<{ revoked: boolean }>;
}

export interface RefundExecutionResult {
  status: RefundStatus;
  error?: string;
}

async function finishRefundWithRevoke(
  req: RefundRequestSnapshot,
  params: { approvedBy: string },
  deps: RefundExecutionDeps,
  tossResponse: unknown,
  alreadyCanceled: boolean
): Promise<RefundExecutionResult> {
  let revoked = false;
  try {
    const r = await deps.revoke({
      userId: req.user_id,
      productId: req.product_id,
      scopeKey: req.scope_key,
      reason: req.reason,
      actor: params.approvedBy,
      paymentKey: req.payment_key,
      refundKind: req.refund_kind,
      refundRequestId: req.id,
      amount: req.amount,
      originalAmount: req.original_amount,
      creditAmount: req.credit_amount,
      creditTransactionId: req.credit_transaction_id,
    });
    revoked = r.revoked;
  } catch {
    revoked = false;
  }

  if (!revoked) {
    const pending = nextRefundStatus('processing', 'revoke_fail') ?? 'revoke_pending';
    await deps.setStatus(req.id, pending, {
      tossResponse,
      errorMessage: alreadyCanceled
        ? 'Toss는 이미 취소됨 · 권한/코인 회수 실패 — 재시도 필요(경보)'
        : 'Toss 환불됨 · 권한/코인 회수 실패 — 재시도 필요(경보)',
    });
    return { status: pending, error: 'revoke failed after toss success' };
  }

  const completed = nextRefundStatus('processing', 'revoke_ok') ?? 'completed';
  await deps.setStatus(req.id, completed, { tossResponse, errorMessage: null });
  return { status: completed };
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

  if (req.status === 'revoke_pending') {
    await deps.setStatus(req.id, 'processing', { approvedBy: params.approvedBy });
    return finishRefundWithRevoke(req, params, deps, undefined, false);
  }

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
    ...(req.refund_kind === 'credit_purchase' && req.amount ? { cancelAmount: req.amount } : {}),
  });
  if (!toss.ok) {
    if (isAlreadyCanceledTossError(toss.error) && deps.loadTossPayment) {
      const lookup = await deps.loadTossPayment(req.payment_key);
      if (
        lookup.ok &&
        isCanceledForRefundRequest(
          lookup.payment,
          req.refund_kind === 'credit_purchase' ? req.amount : null
        )
      ) {
        return finishRefundWithRevoke(
          req,
          params,
          deps,
          {
            alreadyCanceled: true,
            verifiedAt: new Date().toISOString(),
            payment: lookup.payment,
          },
          true
        );
      }
    }

    const failed = nextRefundStatus('processing', 'toss_fail') ?? 'failed';
    await deps.setStatus(req.id, failed, {
      tossResponse: toss.response,
      errorMessage: toss.error ?? 'Toss 결제취소 실패',
    });
    return { status: failed, error: toss.error ?? 'Toss 결제취소 실패' };
  }

  return finishRefundWithRevoke(req, params, deps, toss.response, false);
}
