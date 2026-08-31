'use client';
// 2026-08-31 — 수동 부여 이용권 목록 + 회수. POST /api/admin/product-entitlement/revoke.
//   결제분은 목록에 아예 안 나온다(서버가 order_id·payment_key null 만 내려준다) —
//   결제분 회수는 환불 카드에서만.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminGrantedEntitlement } from '@/lib/admin/granted-entitlements';

function fmtDateTime(iso: string): string {
  return new Date(iso)
    .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false })
    .slice(0, 16);
}

export function RevokeProductActions({
  role,
  userId,
  items,
}: {
  role: 'admin' | 'super_admin';
  userId: string;
  items: AdminGrantedEntitlement[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (items.length === 0) {
    return <p className="text-xs text-neutral-500">수동 부여한 이용권이 없습니다.</p>;
  }

  async function revoke(item: AdminGrantedEntitlement) {
    if (role !== 'super_admin') return;
    const reason = window.prompt(
      `[${item.productName}] 이용권을 회수합니다.\nscope: ${item.scopeKey}\n\n회수 사유(2자 이상, 감사 기록):`
    );
    if (reason == null) return;
    if (reason.trim().length < 2) {
      setMsg('회수 사유를 2자 이상 입력하세요.');
      return;
    }

    setBusyId(item.id);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/product-entitlement/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, entitlementId: item.id, reason: reason.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        revoked?: boolean;
        productTableDeleted?: number;
        legacyDeleted?: number;
        error?: string;
      };
      if (!data.ok) {
        setMsg(`실패: ${data.error ?? '오류'}`);
      } else if (!data.revoked) {
        // 행이 이미 없었다 — 다른 창에서 지웠거나 새로고침 전 상태. 실패는 아니다.
        setMsg('이미 회수된 이용권입니다. 목록을 갱신합니다.');
        router.refresh();
      } else {
        setMsg(
          `회수 완료: ${item.productName} (이용권 ${data.productTableDeleted ?? 0}건 · 감사행 ${data.legacyDeleted ?? 0}건 삭제)`
        );
        router.refresh();
      }
    } catch {
      setMsg('네트워크 오류');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-[var(--app-ink)]">{item.productName}</div>
              <div className="break-all font-mono text-[11px] text-[var(--app-copy-soft)]">
                {item.scopeKey} · {fmtDateTime(item.createdAt)}
              </div>
            </div>
            {role === 'super_admin' ? (
              <button
                type="button"
                onClick={() => void revoke(item)}
                disabled={busyId !== null}
                className="rounded border border-[var(--app-coral)] px-2.5 py-1 text-[13px] font-bold text-[var(--app-coral)] disabled:opacity-50"
              >
                {busyId === item.id ? '회수 중…' : '회수'}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {msg ? <p className="break-all text-xs text-neutral-700">{msg}</p> : null}
    </div>
  );
}
