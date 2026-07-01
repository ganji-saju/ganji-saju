'use client';
// 2026-06-28 — 어드민 멤버십 권한 변경 폼. POST /api/admin/membership/grant (super_admin 전용).
//   부여(프리미엄 N일) / 해제(즉시 cancelled). 전은 별도(전 수동지급).
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function GrantMembershipActions({
  role,
  userId,
  currentPlan,
  currentStatus,
}: {
  role: 'admin' | 'super_admin';
  userId: string;
  currentPlan: string | null;
  currentStatus: string | null;
}) {
  const router = useRouter();
  const [days, setDays] = useState('30');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (role !== 'super_admin') {
    return <p className="text-xs text-neutral-500">멤버십 변경은 super_admin 만 가능합니다.</p>;
  }

  const isPremiumActive = currentStatus === 'active' && currentPlan === 'premium_monthly';

  async function submit(action: 'grant' | 'revoke') {
    if (reason.trim().length < 2) {
      setMsg('변경 사유를 2자 이상 입력하세요.');
      return;
    }
    const numDays = Number(days);
    if (action === 'grant' && (!Number.isInteger(numDays) || numDays <= 0)) {
      setMsg('이용 일수를 1 이상의 정수로 입력하세요.');
      return;
    }
    const label = action === 'grant' ? `프리미엄 멤버십 ${numDays}일 부여` : '멤버십 즉시 해제';
    if (!window.confirm(`이 사용자에게 "${label}" 합니다.\n사유: ${reason.trim()}`)) return;

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/membership/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, days: numDays, reason: reason.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        action?: string;
        plan?: string | null;
        status?: string | null;
        renewsAt?: string | null;
        error?: string;
      };
      if (!data.ok) {
        setMsg(`실패: ${data.error ?? '오류'}`);
      } else {
        setMsg(
          data.action === 'grant'
            ? `완료: 프리미엄 활성 (${data.status}${data.renewsAt ? ` · ~${data.renewsAt.slice(0, 10)}` : ''})`
            : `완료: 멤버십 해제 (${data.status})`
        );
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
      <p className="text-[12.1px] text-[var(--app-copy-soft)]">
        현재: {isPremiumActive ? `프리미엄 활성 (${currentStatus})` : `프리미엄 아님${currentStatus ? ` (${currentPlan ?? '—'}/${currentStatus})` : ''}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          max={400}
          step={1}
          inputMode="numeric"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="일수"
          className="w-20 rounded border border-neutral-300 px-2 py-1.5 text-sm"
          disabled={busy}
        />
        <span className="text-xs text-neutral-500">일</span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="변경 사유(감사 기록)"
          className="min-w-[10rem] flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm"
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => void submit('grant')}
          disabled={busy}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? '처리 중…' : '프리미엄 부여'}
        </button>
        <button
          type="button"
          onClick={() => void submit('revoke')}
          disabled={busy || !isPremiumActive}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-bold text-neutral-700 disabled:opacity-40"
        >
          멤버십 해제
        </button>
      </div>
      {msg ? <p className="text-xs text-neutral-700">{msg}</p> : null}
    </div>
  );
}
