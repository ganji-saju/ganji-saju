'use client';
// 2026-06-28 — 어드민 수동 코인 지급 폼. POST /api/admin/credits/grant (super_admin 전용).
//   purchase=1년 만료 lot / subscription=무만료. 회수는 환불(별도)로.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAX_GRANT_AMOUNT, type GrantCreditType } from '@/lib/admin/grant-credits';

export function GrantCreditsActions({
  role,
  userId,
}: {
  role: 'admin' | 'super_admin';
  userId: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<GrantCreditType>('purchase');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 코인 지급은 super_admin 만. admin 에게는 비활성 안내만.
  if (role !== 'super_admin') {
    return (
      <p className="text-xs text-neutral-500">코인 지급은 super_admin 만 가능합니다.</p>
    );
  }

  async function submit() {
    const coins = Number(amount);
    if (!Number.isInteger(coins) || coins <= 0) {
      setMsg('지급 코인 수를 1 이상의 정수로 입력하세요.');
      return;
    }
    if (reason.trim().length < 2) {
      setMsg('지급 사유를 2자 이상 입력하세요.');
      return;
    }
    const typeLabel = type === 'purchase' ? '결제 코인(1년 만료)' : '구독 코인(무만료)';
    if (!window.confirm(`이 사용자에게 ${coins}코인(${typeLabel})을 지급합니다.\n사유: ${reason.trim()}`)) {
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount: coins, type, reason: reason.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        granted?: number;
        balance?: number | null;
        error?: string;
      };
      if (!data.ok) {
        setMsg(`실패: ${data.error ?? '오류'}`);
      } else {
        setMsg(
          `완료: ${data.granted}코인 지급${
            data.balance != null ? ` · 현재 잔액 ${data.balance}코인` : ''
          }`
        );
        setAmount('');
        setReason('');
        router.refresh();
      }
    } catch {
      setMsg('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          max={MAX_GRANT_AMOUNT}
          step={1}
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="코인 수"
          className="w-24 rounded border border-neutral-300 px-2 py-1.5 text-sm"
          disabled={busy}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as GrantCreditType)}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          disabled={busy}
        >
          <option value="purchase">결제 코인(1년 만료)</option>
          <option value="subscription">구독 코인(무만료)</option>
        </select>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="지급 사유(감사 기록)"
          className="min-w-[10rem] flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm"
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? '지급 중…' : '코인 지급'}
        </button>
      </div>
      {msg ? <p className="text-xs text-neutral-700">{msg}</p> : null}
    </div>
  );
}
