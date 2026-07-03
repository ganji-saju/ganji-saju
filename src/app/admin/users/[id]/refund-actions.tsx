'use client';
// 2026-05-25 Phase 2 — 환불 액션(요청/승인·실행/거부). /api/admin/refund POST.
//   admin: 환불 요청만. super_admin: pending 요청 승인·실행(실제 Toss 취소, confirm) / 거부 / 재시도.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface EligibleItem {
  id: string;
  productName: string;
  amountWon: number;
  hasPaymentKey: boolean;
}
interface CreditEligibleItem {
  id: string;
  productName: string;
  packageId: string | null;
  originalAmountWon: number | null;
  refundAmountWon: number;
  coinsPurchased: number;
  coinsRemaining: number;
  coinsUsed: number;
  hasPaymentKey: boolean;
  status: 'full' | 'partial' | 'none';
  statusLabel: string;
  expiresAt: string | null;
}
interface RefundReq {
  id: string;
  refundKind: string;
  productId: string;
  paymentKey: string | null;
  amount: number | null;
  originalAmount: number | null;
  creditAmount: number | null;
  status: string;
  reason: string;
  errorMessage: string | null;
  tossResponse: unknown;
  provider: 'toss' | 'nicepay' | 'unknown';
  updatedAt: string | null;
}

// 2026-07-04 — 'unknown' = 주문 미매칭(수동 처리·구버전). 실행 시 PG 는 서버가
// getOrderProviderByPaymentKey 로 별도 판정하므로 표기만 정직하게.
const PG_LABEL: Record<'toss' | 'nicepay' | 'unknown', string> = {
  toss: 'Toss',
  nicepay: '나이스페이',
  unknown: 'PG 미상',
};

const STATUS_LABEL: Record<string, string> = {
  requested: '요청됨',
  processing: '처리중',
  completed: '완료',
  failed: '실패(재시도 가능)',
  revoke_pending: '⚠️ 환불됨·권한회수 실패',
  rejected: '거부됨',
};

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

// 2026-06-27 — PG 동적 표기. 결제 건 provider(toss/nicepay)에 따라 라벨만 분기.
//   상세 파싱(status/잔여)은 toss 응답 형태 기준 best-effort, 나이스페이는 status 그대로 노출.
function getRefundNote(request: RefundReq) {
  const pg = PG_LABEL[request.provider];
  const response = readObject(request.tossResponse);
  if (!response) return null;

  const payment = readObject(response.payment) ?? response;
  const status = typeof payment.status === 'string' ? payment.status : null;
  const balanceAmount = typeof payment.balanceAmount === 'number' ? payment.balanceAmount : null;
  const totalAmount = typeof payment.totalAmount === 'number' ? payment.totalAmount : null;
  const alreadyCanceled = response.alreadyCanceled === true;

  if (alreadyCanceled || (status === 'CANCELED' && balanceAmount === 0)) {
    return `${pg} 취소 확인됨${totalAmount ? ` · ${totalAmount.toLocaleString()}원` : ''}`;
  }
  if (status) {
    return `${pg} 상태 ${status}${balanceAmount !== null ? ` · 잔여 ${balanceAmount.toLocaleString()}원` : ''}`;
  }
  return null;
}

export function RefundActions({
  role,
  items,
  creditItems,
  requests,
}: {
  role: 'admin' | 'super_admin';
  items: EligibleItem[];
  creditItems: CreditEligibleItem[];
  requests: RefundReq[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function post(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; status?: string; error?: string };
      if (!data.ok) {
        setMsg(`실패: ${data.error ?? data.status ?? '오류'}`);
      } else {
        setMsg(`완료: ${data.status}`);
        router.refresh();
      }
    } catch {
      setMsg('네트워크 오류');
    } finally {
      setBusy(null);
    }
  }

  function requestRefund(item: EligibleItem) {
    const reason = window.prompt(`"${item.productName}" 환불 사유`, '고객 요청');
    if (!reason || !reason.trim()) return;
    void post(
      { action: 'request', kind: 'product', entitlementId: item.id, reason: reason.trim() },
      `req-${item.id}`
    );
  }

  function requestCreditRefund(item: CreditEligibleItem) {
    const mode = item.status === 'partial' ? '부분 환불' : '전액 환불';
    const reason = window.prompt(`"${item.productName}" ${mode} 사유`, '고객 요청');
    if (!reason || !reason.trim()) return;
    void post(
      {
        action: 'request',
        kind: 'credit_purchase',
        creditTransactionId: item.id,
        reason: reason.trim(),
      },
      `credit-req-${item.id}`
    );
  }

  function approve(r: RefundReq) {
    const target =
      r.refundKind === 'credit_purchase'
        ? `${r.productId} · ${r.amount?.toLocaleString() ?? '—'}원 · ${r.creditAmount ?? 0}전 회수`
        : `${r.productId} · ${r.amount?.toLocaleString() ?? '—'}원`;
    if (
      !window.confirm(
        `실제 환불을 실행합니다 — ${PG_LABEL[r.provider]} 결제취소 + 권한/전 회수.\n${target}\n계속할까요?`
      )
    ) {
      return;
    }
    void post({ action: 'approve', requestId: r.id }, `app-${r.id}`);
  }

  return (
    <div className="mt-3 space-y-2">
      {/* 환불 요청 버튼 (대상 entitlement) */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12.1px] font-extrabold text-[var(--app-copy-soft)]">상품 환불</p>
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-[10px] border border-dashed border-[var(--app-line)] px-3 py-2"
            >
              <span className="text-[13.2px] text-[var(--app-copy-soft)]">
                {item.productName} · {item.amountWon.toLocaleString()}원
              </span>
              <button
                type="button"
                disabled={!item.hasPaymentKey || busy !== null}
                onClick={() => requestRefund(item)}
                className="rounded-[8px] border border-[var(--app-line)] px-2.5 py-1 text-[12.6px] font-extrabold text-[var(--app-ink)] disabled:opacity-40"
              >
                환불 요청
              </button>
            </div>
          ))}
        </div>
      )}

      {creditItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12.1px] font-extrabold text-[var(--app-copy-soft)]">전 환불</p>
          {creditItems.map((item) => {
            const requestable = item.status !== 'none' && item.refundAmountWon > 0 && item.hasPaymentKey;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-[10px] border border-dashed border-[var(--app-line)] px-3 py-2"
              >
                <span className="min-w-0 text-[13.2px] text-[var(--app-copy-soft)]">
                  <span className="block font-semibold text-[var(--app-ink)]">
                    {item.productName} · 환불 {item.refundAmountWon.toLocaleString()}원
                  </span>
                  <span className="block">
                    {item.statusLabel} · 남은 {item.coinsRemaining}/{item.coinsPurchased}전
                    {item.expiresAt ? ` · 만료 ${item.expiresAt.slice(0, 10)}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={!requestable || busy !== null}
                  onClick={() => requestCreditRefund(item)}
                  className="rounded-[8px] border border-[var(--app-line)] px-2.5 py-1 text-[12.6px] font-extrabold text-[var(--app-ink)] disabled:opacity-40"
                >
                  {item.status === 'partial' ? '부분 환불' : '환불 요청'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 환불 요청 목록 + super_admin 승인/거부/재시도 */}
      {requests.length > 0 && (
        <ul className="space-y-1.5">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--app-line)] px-3 py-2"
            >
              <span className="min-w-0 text-[12.6px] text-[var(--app-ink)]">
                <span className="block">
                  <b>{STATUS_LABEL[r.status] ?? r.status}</b> · {r.amount?.toLocaleString() ?? '—'}원 ·{' '}
                  {r.reason}
                  {r.refundKind === 'credit_purchase' && r.creditAmount != null
                    ? ` · 전 ${r.creditAmount}개`
                    : ''}
                </span>
                {(r.errorMessage || getRefundNote(r)) && (
                  <span className="mt-0.5 block break-words text-[12.1px] text-[var(--app-copy-soft)]">
                    {r.errorMessage ? `사유: ${r.errorMessage}` : null}
                    {r.errorMessage && getRefundNote(r) ? ' · ' : null}
                    {getRefundNote(r)}
                  </span>
                )}
                {r.paymentKey && (
                  <span className="mt-0.5 block truncate text-[11.5px] text-[var(--app-copy-soft)]">
                    {r.paymentKey}
                  </span>
                )}
              </span>
              {role === 'super_admin' && r.status === 'requested' && (
                <span className="flex gap-1">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => approve(r)}
                    className="rounded-[8px] bg-[var(--app-pink-strong)] px-2.5 py-1 text-[12.6px] font-extrabold text-white disabled:opacity-40"
                  >
                    승인·실행
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void post({ action: 'reject', requestId: r.id }, `rej-${r.id}`)}
                    className="rounded-[8px] border border-[var(--app-line)] px-2.5 py-1 text-[12.6px] font-extrabold text-[var(--app-ink)] disabled:opacity-40"
                  >
                    거부
                  </button>
                </span>
              )}
              {role === 'super_admin' && (r.status === 'failed' || r.status === 'revoke_pending') && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => approve(r)}
                  className="rounded-[8px] border border-[var(--app-line)] px-2.5 py-1 text-[12.6px] font-extrabold text-[var(--app-ink)] disabled:opacity-40"
                >
                  재시도
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {role === 'admin' && (
        <p className="text-[12.1px] text-[var(--app-copy-soft)]">
          ※ admin 은 환불 *요청*만 가능 — 실제 환불은 super_admin 승인.
        </p>
      )}
      {msg && <p className="text-[12.6px] font-semibold text-[var(--app-ink)]">{msg}</p>}
    </div>
  );
}
