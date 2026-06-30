'use client';
// 2026-06-30 — 어드민 평생 리포트 권한 부여 폼. POST /api/admin/lifetime-report/grant (super_admin 전용).
//   사주 결과(reading) 단위로 lifetime-report entitlement를 수동 부여.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function GrantLifetimeReportActions({
  role,
  userId,
  readings,
}: {
  role: 'admin' | 'super_admin';
  userId: string;
  readings: Array<{ id: string; label: string; hasLifetime: boolean }>;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(readings[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (role !== 'super_admin') {
    return <p className="text-xs text-neutral-500">평생 리포트 권한 부여는 super_admin 만 가능합니다.</p>;
  }

  if (readings.length === 0) {
    return <p className="text-xs text-neutral-500">부여할 사주 결과가 없습니다.</p>;
  }

  async function submit() {
    if (!selectedId) {
      setMsg('사주 결과를 선택하세요.');
      return;
    }
    if (!window.confirm(`이 사용자의 선택한 사주 결과에 평생 리포트 권한을 부여합니다.\n사유: ${reason.trim() || '(없음)'}`)) return;

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/lifetime-report/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, readingId: selectedId, reason: reason.trim() || undefined }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        readingKey?: string;
        entitlementId?: string;
        error?: string;
      };
      if (!data.ok) {
        setMsg(`실패: ${data.error ?? '오류'}`);
      } else {
        setMsg(`권한을 부여했습니다. (${data.readingKey ?? ''})`);
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
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={busy}
          className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          {readings.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}{r.hasLifetime ? ' · ✓ 보유 중' : ''}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="부여 사유(선택, 감사 기록)"
          className="min-w-[10rem] flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm"
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? '처리 중…' : '권한 부여'}
        </button>
      </div>
      {msg ? <p className="text-xs text-neutral-700">{msg}</p> : null}
    </div>
  );
}
