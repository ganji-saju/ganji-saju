// 2026-05-25 Phase 2 — 환불 자동화 오케스트레이션.
//   2단계 워크플로우: admin 요청(request) → super_admin 승인·실행(approve).
//   상태머신 + Toss cancel(멱등) + 권한 회수(결제키 기준). 진짜 원자성은 불가(Toss 외부)라
//   refund_requests 상태로 실패 안전·재시도. 결정 로직(아래 순수 함수)은 단위 테스트로 고정.
//   ※ 실제 Toss 환불 실행은 라이브 super_admin(사람). 여기 코드는 DI 로 mock 테스트.

// 전액/부분 판정은 결제 취소 도메인의 isFullRefund 하나만 쓴다 — 주문을 refunded 로 표기하는
//   판정(admin refund 라우트)과 같은 함수여야 'PG 엔 전액취소, 장부엔 부분' 같은 어긋남이 없다.
import { isFullRefund } from '@/lib/payments/cancellation';

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

/**
 * "이미 취소된 결제" 응답인지 — PG 별 문구가 다르다.
 *
 * 2026-07-19 — 나이스페이 문구를 못 알아봐서 **돈은 환불됐는데 기록은 실패**로 남았다.
 *   실제 응답: "해당거래 취소실패(기취소성공) : 전화 문의(1661-0808)"
 *   기존 패턴('이미 취소된 결제' / already cancelled)은 토스 문구만 알았다.
 *   이 백스톱이 안 걸리면 executeRefund 가 하드 실패로 끝나 revoke·refunded 표기를 건너뛴다
 *   → 주문이 refunded 가 아닌 상태로 남아 매출/환불 집계가 어긋난다.
 */
export function isAlreadyCanceledTossError(error: string | undefined | null): boolean {
  if (!error) return false;
  return (
    error.includes('이미 취소된 결제') ||
    // 나이스페이: 기취소(=이미 취소) 성공/거래 문구 계열
    error.includes('기취소') ||
    error.includes('이미 취소') ||
    /already\s+cancell?ed/i.test(error)
  );
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

/**
 * 일부 환불 재승인 전 — 요청 생성(sinceIso) 뒤에 생긴 같은 금액의 PG 취소 건. 첫 승인에서 PG 는 처리했는데 응답을 잃으면(네트워크·비JSON 5xx·
 *   타임아웃) 요청은 failed 로 남고, 재승인은 새 취소 번호로 cancelAmt 를 다시 보낸다 — 잔액이 남아 PG 가 받아 **이중 환불**이 된다
 *   (전액은 '기취소' 거절이 막지만 일부는 아니다). 나이스 cancels[{tid, amount, cancelledAt}] · 토스 cancels[{cancelAmount, canceledAt}].
 */
export function findPartialCancelSince(
  payment: TossRefundPaymentSnapshot | null,
  amount: number,
  sinceIso: string
): Record<string, unknown> | null {
  const since = Date.parse(sinceIso);
  const cancels = Array.isArray(payment?.cancels) ? payment.cancels : [];
  for (const c of cancels) {
    if (!c || typeof c !== 'object') continue;
    const entry = c as Record<string, unknown>;
    const at = Date.parse(String(entry.cancelledAt ?? entry.canceledAt ?? ''));
    if (Number(entry.amount ?? entry.cancelAmount) === amount && at >= since) return entry;
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
  /** 요청 생성 시각 — 일부 환불 재승인 때 "이 요청 뒤에 생긴 PG 취소"를 가른다. */
  created_at?: string | null;
}

export interface RefundExecutionDeps {
  loadRequest(requestId: string): Promise<RefundRequestSnapshot | null>;
  /** `from` 이 있으면 선점 — 그 상태일 때만 바꾸고, 바뀐 행이 없거나 오류면 false. 없으면 결과를 보지 않는다(true). */
  setStatus(
    requestId: string,
    status: RefundStatus,
    patch?: { approvedBy?: string; tossResponse?: unknown; errorMessage?: string | null; from?: RefundStatus }
  ): Promise<boolean>;
  /** Toss 결제취소. idempotencyKey 로 재시도 이중취소 방지. */
  tossCancel(
    paymentKey: string,
    options: { cancelReason: string; idempotencyKey: string; cancelAmount?: number }
  ): Promise<{ ok: boolean; response?: unknown; error?: string }>;
  /** Toss 결제 조회. 이미 취소된 결제인지 확인할 때 사용한다. */
  loadTossPayment?(
    paymentKey: string
  ): Promise<{ ok: true; payment: TossRefundPaymentSnapshot } | { ok: false; error?: string }>;
  /** 권한 회수. 이용권(product)은 결제키로 그 결제의 권한 전부(revokeEntitlementsOfPayment), 전 결제는 lot 회수. */
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
  }): Promise<{ revoked: boolean; nothingToRevoke?: boolean }>;
}

export interface RefundExecutionResult {
  status: RefundStatus;
  error?: string;
  /** 완료 시 PG 응답 — 일부 취소 뒤 멤버십 연산이 cancels[] 의 새 취소 거래를 읽는다. */
  response?: unknown;
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
    // 🔴 2026-08-27 — 회수할 게 **없는 것**과 회수에 **실패한 것**은 다르다.
    //   회수 함수(revokeEntitlementsOfPayment)는 DB 오류면 throw 하고, 지울 행이 없으면 revoked:false 를
    //   돌려준다. 고아 주문(이용권이 이미 사라진 결제)은 후자인데 실패로 처리돼
    //   "revoke failed after toss success" 로 막혔다 — **돈은 이미 나간 뒤**라 장부만
    //   revoke_pending 에 갇힌다. 호출부가 '없음'을 명시하면 완료로 넘긴다.
    revoked = r.revoked || r.nothingToRevoke === true;
  } catch {
    revoked = false;
  }

  if (!revoked) {
    const pending = nextRefundStatus('processing', 'revoke_fail') ?? 'revoke_pending';
    await deps.setStatus(req.id, pending, {
      tossResponse,
      errorMessage: alreadyCanceled
        ? 'Toss는 이미 취소됨 · 권한/전 회수 실패 — 재시도 필요(경보)'
        : 'Toss 환불됨 · 권한/전 회수 실패 — 재시도 필요(경보)',
    });
    return { status: pending, error: 'revoke failed after toss success' };
  }

  const completed = nextRefundStatus('processing', 'revoke_ok') ?? 'completed';
  await deps.setStatus(req.id, completed, { tossResponse, errorMessage: null });
  return { status: completed, response: tossResponse };
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

  // 🔴 2026-09-15 — 전이는 **선점**(읽어 둔 상태일 때만 processing). 두 탭·두 관리자가 동시에 승인하면 둘 다 requested 를 읽고
  //   PG 취소를 한 번씩 보냈다 — 나이스 취소는 호출마다 새 orderId 라 일부 취소는 두 번째도 수락된다(이중 환불).
  const claimed = () => deps.setStatus(req.id, 'processing', { approvedBy: params.approvedBy, from: req.status });
  const lost = { status: req.status, error: '다른 승인이 이미 처리 중입니다. 새로고침해 상태를 확인하세요.' };

  if (req.status === 'revoke_pending') {
    if (!(await claimed())) return lost;
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

  if (!(await claimed())) return lost;

  // 🔴 2026-08-27 — cancelAmt 를 실으면 나이스페이는 그 요청을 **부분취소**로 처리한다.
  //   전액 환불(990원 환불 ↔ 원결제 990원)에도 실어 보내고 있었고, 샌드박스는 부분취소를
  //   제공하지 않아 "부분취소는 운영 환경에서 이용 가능" 으로 거부됐다. 운영에서도 가맹점에
  //   부분취소가 열려 있지 않으면 같은 벽이다.
  //   같은 계정의 product 환불 4건(번들·점수·궁합)이 전부 성공한 건 cancelAmt 를 안 보냈기 때문.
  //
  //   ⚠️ 규칙은 **금액 하나로만** 갈린다 — refund_kind 로 나누지 않는다. 종류로 나누면
  //      product 가 부분환불을 도입하는 순간 cancelAmt 없이 나가 **전액취소 = 과다환불**이 된다
  //      (방어가 "오늘 product 는 항상 전액"이라는 사실에 기대게 된다).
  //      product 실동작은 지금과 같다 — 전액이라 그대로 생략된다.
  //
  //   ⚠️ 위험 방향이 비대칭이다(과다환불 ≫ 환불실패). isFullRefund 는 원결제액을 모르면
  //      false 를 돌려주므로, 모를 땐 부분취소로 나간다. 실패는 되돌릴 수 있지만 더 나간 돈은 아니다.
  const fullRefund = isFullRefund({ amount: req.amount, originalAmount: req.original_amount });

  // 2026-09-14 — 일부 환불 재승인(failed → 다시 승인)은 취소를 보내기 전에 PG 를 재조회한다. 이 요청 뒤에 같은 금액 취소가 있으면
  //   첫 승인이 PG 에선 성공한 것 → 새 취소 없이 완료. 확인할 수 없으면(조회 실패·생성 시각 없음) 막는다 — 과다환불 ≫ 환불 지연.
  if (req.status === 'failed' && req.amount && !fullRefund) {
    const lookup = deps.loadTossPayment && req.created_at ? await deps.loadTossPayment(req.payment_key) : null;
    if (!lookup?.ok) {
      const error = `일부 환불 재승인 전 PG 조회로 앞선 취소 여부를 확인하지 못해 막았습니다(이중 환불 방지) — PG 콘솔에서 확인하세요${lookup?.error ? `: ${lookup.error}` : ''}`;
      await deps.setStatus(req.id, 'failed', { errorMessage: error });
      return { status: 'failed', error };
    }
    const prior = findPartialCancelSince(lookup.payment, req.amount, req.created_at!);
    if (prior) {
      const payment = typeof prior.tid === 'string' ? { ...lookup.payment, cancelledTid: prior.tid } : lookup.payment;
      return finishRefundWithRevoke(req, params, deps, { alreadyCanceled: true, verifiedAt: new Date().toISOString(), payment }, true);
    }
  }

  const toss = await deps.tossCancel(req.payment_key, {
    cancelReason: req.reason,
    idempotencyKey: req.idempotency_key,
    ...(req.amount && !fullRefund ? { cancelAmount: req.amount } : {}),
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
