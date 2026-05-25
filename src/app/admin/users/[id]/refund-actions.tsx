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
interface RefundReq {
  id: string;
  productId: string;
  amount: number | null;
  status: string;
  reason: string;
}

const STATUS_LABEL: Record<string, string> = {
  requested: '요청됨',
  processing: '처리중',
  completed: '완료',
  failed: '실패(재시도 가능)',
  revoke_pending: '⚠️ 환불됨·권한회수 실패',
  rejected: '거부됨',
};

export function RefundActions({
  role,
  items,
  requests,
}: {
  role: 'admin' | 'super_admin';
  items: EligibleItem[];
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
    void post({ action: 'request', entitlementId: item.id, reason: reason.trim() }, `req-${item.id}`);
  }

  function approve(r: RefundReq) {
    if (
      !window.confirm(
        `실제 환불을 실행합니다 — Toss 결제취소 + 권한 회수.\n${r.productId} · ${r.amount?.toLocaleString() ?? '—'}원\n계속할까요?`
      )
    ) {
      return;
    }
    void post({ action: 'approve', requestId: r.id }, `app-${r.id}`);
  }

  return (
    <div className="mt-3 space-y-2">
      {/* 환불 요청 버튼 (대상 entitlement) */}
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-2 rounded-[10px] border border-dashed border-[var(--app-line)] px-3 py-2"
        >
          <span className="text-[11.5px] text-[var(--app-copy-soft)]">
            {item.productName} · {item.amountWon.toLocaleString()}원
          </span>
          <button
            type="button"
            disabled={!item.hasPaymentKey || busy !== null}
            onClick={() => requestRefund(item)}
            className="rounded-[8px] border border-[var(--app-line)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--app-ink)] disabled:opacity-40"
          >
            환불 요청
          </button>
        </div>
      ))}

      {/* 환불 요청 목록 + super_admin 승인/거부/재시도 */}
      {requests.length > 0 && (
        <ul className="space-y-1.5">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--app-line)] px-3 py-2"
            >
              <span className="text-[11px] text-[var(--app-ink)]">
                <b>{STATUS_LABEL[r.status] ?? r.status}</b> · {r.amount?.toLocaleString() ?? '—'}원 ·{' '}
                {r.reason}
              </span>
              {role === 'super_admin' && r.status === 'requested' && (
                <span className="flex gap-1">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => approve(r)}
                    className="rounded-[8px] bg-[var(--app-pink-strong)] px-2.5 py-1 text-[11px] font-extrabold text-white disabled:opacity-40"
                  >
                    승인·실행
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void post({ action: 'reject', requestId: r.id }, `rej-${r.id}`)}
                    className="rounded-[8px] border border-[var(--app-line)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--app-ink)] disabled:opacity-40"
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
                  className="rounded-[8px] border border-[var(--app-line)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--app-ink)] disabled:opacity-40"
                >
                  재시도
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {role === 'admin' && (
        <p className="text-[10.5px] text-[var(--app-copy-soft)]">
          ※ admin 은 환불 *요청*만 가능 — 실제 환불은 super_admin 승인.
        </p>
      )}
      {msg && <p className="text-[11px] font-semibold text-[var(--app-ink)]">{msg}</p>}
    </div>
  );
}
