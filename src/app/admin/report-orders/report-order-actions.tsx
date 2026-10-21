'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReportOrderStatus, ReportPayMethod } from '@/lib/report-orders/report-order';

type Action = 'confirm_deposit' | 'confirm_card' | 'generate' | 'send' | 'resend' | 'cancel' | 'refund_card' | 'mark_refunded';
const LABEL: Record<Action, string> = {
  confirm_deposit: '입금 확인',
  confirm_card: '결제 확인',
  generate: '풀이 만들기',
  send: '확인 완료·발송',
  resend: '다시 보내기',
  cancel: '주문 취소',
  refund_card: '결제 취소(환불)',
  mark_refunded: '환불 완료 표시',
};
const NEEDS_NOTE = new Set<Action>(['refund_card', 'mark_refunded']);

function actionsFor(status: ReportOrderStatus, payMethod: ReportPayMethod): Action[] {
  const refund: Action = payMethod === 'card' ? 'refund_card' : 'mark_refunded';
  switch (status) {
    case 'awaiting_deposit': return ['confirm_deposit', 'cancel'];
    case 'pending_payment': return payMethod === 'card' ? ['confirm_card'] : ['cancel'];
    case 'paid': return ['generate', refund];
    case 'generated': return ['send', 'generate', refund];
    case 'sent': return ['resend', refund];
    default: return [];
  }
}

export function ReportOrderActions({ id, status, payMethod, reportId = null }: { id: string; status: ReportOrderStatus; payMethod: ReportPayMethod; reportId?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const actions = actionsFor(status, payMethod);

  async function run(action: Action) {
    if (NEEDS_NOTE.has(action) && !note.trim()) {
      setMessage('환불 사유를 적어 주세요.');
      return;
    }
    setBusy(action);
    setMessage(action === 'generate' ? '풀이를 만드는 중입니다(1~4분).' : '');
    try {
      const res = await fetch(`/api/admin/report-orders/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'send' ? { action, note: note.trim(), reportId } : { action, note: note.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; generationWarning?: string | null } | null;
      if (!res.ok || !data?.ok) {
        setMessage(data?.error ?? '처리하지 못했습니다.');
        return;
      }
      setMessage(data.generationWarning ? `완료 — 주의: ${data.generationWarning}` : '완료했습니다.');
      router.refresh();
    } catch {
      setMessage('요청을 보내지 못했습니다.');
    } finally {
      setBusy(null);
    }
  }

  if (actions.length === 0) return null;
  const hasRefund = actions.some((a) => NEEDS_NOTE.has(a));
  return (
    <div className="flex flex-col gap-2">
      {hasRefund ? (
        <input
          aria-label="환불·취소 사유"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="환불 사유 / 이체 일시(환불할 때만)"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={busy !== null}
            onClick={() => run(action)}
            className={action === 'send' || action === 'confirm_deposit' || (action === 'generate' && status === 'paid')
              ? 'rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'
              : 'rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50'}
          >
            {action === 'generate' && status === 'generated' ? '다시 만들기' : LABEL[action]}
          </button>
        ))}
      </div>
      {message ? <p role="status" className="text-sm text-gray-700">{message}</p> : null}
    </div>
  );
}
