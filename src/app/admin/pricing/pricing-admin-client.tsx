'use client';

import { useState } from 'react';

interface Item {
  packageId: string;
  name: string;
  price: number;
  previousPrice: number | null;
  isOverridden: boolean;
  updatedAt: string | null;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export function PricingAdminClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [drafts, setDrafts] = useState<Record<string, { previous: string; next: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draftFor = (id: string) => drafts[id] ?? { previous: '', next: '' };
  const setDraft = (id: string, patch: Partial<{ previous: string; next: string }>) =>
    setDrafts((d) => ({ ...d, [id]: { ...draftFor(id), ...patch } }));

  async function submit(item: Item) {
    setError(null);
    const draft = draftFor(item.packageId);
    const next = Number(draft.next);
    if (!Number.isInteger(next) || next <= 0) {
      setError(`${item.name}: 변경가격은 1 이상의 정수여야 합니다.`);
      return;
    }
    const previous = draft.previous.trim() === '' ? null : Number(draft.previous);
    if (previous !== null && (!Number.isInteger(previous) || previous <= 0)) {
      setError(`${item.name}: 과거가격은 비우거나 1 이상의 정수여야 합니다.`);
      return;
    }
    const ok = window.confirm(
      `${item.name}\n현재 ${won(item.price)} → 변경 ${won(next)}\n\n한 번 변경하면 되돌릴 수 없습니다. 실서비스 청구액에 즉시 반영됩니다. 계속할까요?`
    );
    if (!ok) return;

    setBusy(item.packageId);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packageId: item.packageId, price: next, previousPrice: previous }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? '저장 실패');
        return;
      }
      setItems(json.items as Item[]);
      setDraft(item.packageId, { previous: '', next: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류');
    } finally {
      setBusy(null);
    }
  }

  const th = 'px-3 py-2 text-left text-[12px] font-bold text-[var(--app-copy-soft)]';
  const td = 'px-3 py-2 text-[13px]';
  const input =
    'w-24 rounded-[8px] border border-[var(--app-line)] px-2 py-1 text-right text-[13px] tabular-nums';

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[12px] border border-[var(--app-gold,#D59B2E)] bg-[var(--app-gold,#D59B2E)]/10 p-3 text-[12.5px] leading-relaxed text-[var(--app-ink)]">
        ⚠️ 표시 단일화(Phase 2) 적용 전에는 가격 변경 시 <b>화면 표시가</b>가 실제 청구액과 다를 수
        있습니다(페이월 카드·마케팅 문구는 추후 자동 반영). 실제 운영 가격 변경은 Phase 2 완료 후
        권장합니다.
      </div>

      {error && (
        <div className="rounded-[10px] border border-[var(--app-coral)] bg-[var(--app-coral)]/5 p-3 text-[13px] text-[var(--app-ink)]">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-[12px] border border-[var(--app-line)] bg-white">
        <table className="w-full border-collapse">
          <thead className="border-b border-[var(--app-line)] bg-[var(--app-pink-soft)]">
            <tr>
              <th className={th}>상품</th>
              <th className={`${th} text-right`}>현재가격</th>
              <th className={`${th} text-right`}>과거가격(취소선용)</th>
              <th className={`${th} text-right`}>변경가격</th>
              <th className={`${th} text-right`}>적용</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const draft = draftFor(item.packageId);
              return (
                <tr key={item.packageId} className="border-t border-[var(--app-line)]">
                  <td className={`${td} font-semibold text-[var(--app-ink)]`}>
                    {item.name}
                    <span className="ml-1 text-[11px] text-[var(--app-copy-soft)]">
                      {item.packageId}
                      {item.isOverridden ? ' · 편집됨' : ''}
                    </span>
                  </td>
                  <td className={`${td} text-right tabular-nums font-bold`}>{won(item.price)}</td>
                  <td className={`${td} text-right`}>
                    <input
                      className={input}
                      inputMode="numeric"
                      placeholder={item.previousPrice != null ? String(item.previousPrice) : '없음'}
                      value={draft.previous}
                      onChange={(e) => setDraft(item.packageId, { previous: e.target.value })}
                    />
                  </td>
                  <td className={`${td} text-right`}>
                    <input
                      className={input}
                      inputMode="numeric"
                      placeholder="원 단위"
                      value={draft.next}
                      onChange={(e) => setDraft(item.packageId, { next: e.target.value })}
                    />
                  </td>
                  <td className={`${td} text-right`}>
                    <button
                      type="button"
                      disabled={busy === item.packageId || draft.next.trim() === ''}
                      onClick={() => submit(item)}
                      className="rounded-[8px] bg-[var(--app-ink)] px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40"
                    >
                      {busy === item.packageId ? '저장 중…' : '수정'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
