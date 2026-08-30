'use client';
// 2026-08-31 — 유료상품 이용권 수동 부여 폼. POST /api/admin/product-entitlement/grant.
//   상품마다 **열리는 범위가 다르다**(영구 / 그 달만 / 오늘만 / 모든 커플).
//   그래서 선택하면 곧바로 범위 설명을 띄운다 — 이걸 안 보여주면
//   "당일권을 줘 놓고 왜 내일 안 열리냐" 는 문의가 관리자에게서 나온다.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ADMIN_GRANT_PRODUCTS, type AdminGrantProduct } from '@/lib/admin/product-grant';

interface ReadingOption {
  id: string;
  label: string;
}

/** KST 기준 오늘의 'YYYY-MM' / 'YYYY'. 서버(product-scope)도 KST 를 쓴다. */
function kstToday() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { yearMonth: kst.slice(0, 7), year: kst.slice(0, 4) };
}

export function GrantProductActions({
  role,
  userId,
  readings,
}: {
  role: 'admin' | 'super_admin';
  userId: string;
  readings: ReadingOption[];
}) {
  const router = useRouter();
  const today = useMemo(kstToday, []);
  const [packageId, setPackageId] = useState<string>(ADMIN_GRANT_PRODUCTS[0]!.packageId);
  const [readingId, setReadingId] = useState<string>(readings[0]?.id ?? '');
  const [scope, setScope] = useState<string>(today.yearMonth);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const product = ADMIN_GRANT_PRODUCTS.find((p) => p.packageId === packageId) as AdminGrantProduct;
  const needsReading = product.need !== 'none';
  const needsMonth = product.need === 'reading-month';
  const needsYear = product.need === 'reading-year';

  function onProductChange(next: string) {
    setPackageId(next);
    setMsg(null);
    const def = ADMIN_GRANT_PRODUCTS.find((p) => p.packageId === next);
    // 월/연 입력의 기본값을 상품에 맞춰 갈아끼운다 — 'YYYY-MM' 이 연도 칸에 남아 있으면 400.
    if (def?.need === 'reading-month') setScope(today.yearMonth);
    if (def?.need === 'reading-year') setScope(today.year);
  }

  if (role !== 'super_admin') {
    return <p className="text-xs text-neutral-500">유료상품 권한 부여는 super_admin 만 가능합니다.</p>;
  }

  async function submit() {
    if (needsReading && !readingId) {
      setMsg('사주 결과를 선택하세요.');
      return;
    }
    if (
      !window.confirm(
        `[${product.label}] 권한을 무료로 부여합니다.\n\n${product.note}\n\n사유: ${reason.trim() || '(없음)'}`
      )
    ) {
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/product-entitlement/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          packageId,
          readingId: needsReading ? readingId : undefined,
          scope: needsMonth || needsYear ? scope.trim() : undefined,
          reason: reason.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        granted?: Array<{ productId: string; scopeKey: string | null }>;
        error?: string;
      };
      if (!data.ok) {
        setMsg(`실패: ${data.error ?? '오류'}`);
      } else {
        const items = data.granted ?? [];
        // 부여된 scope 를 그대로 보여준다 — "성공" 만 띄우면 잘못된 범위로 준 걸 못 잡는다.
        setMsg(
          items.length === 0
            ? '부여된 항목이 없습니다. 입력을 확인하세요.'
            : `부여 완료 (${items.length}건): ${items
                .map((i) => `${i.productId}${i.scopeKey ? ` @ ${i.scopeKey}` : ' @ global'}`)
                .join(', ')}`
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
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={packageId}
          onChange={(e) => onProductChange(e.target.value)}
          disabled={busy}
          className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          {ADMIN_GRANT_PRODUCTS.map((p) => (
            <option key={p.packageId} value={p.packageId}>
              {p.label}
              {p.retired ? ' (판매중단)' : ''}
            </option>
          ))}
        </select>
        {needsMonth || needsYear ? (
          <input
            type="text"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder={needsMonth ? 'YYYY-MM' : 'YYYY'}
            aria-label={needsMonth ? '대상 월' : '대상 연도'}
            disabled={busy}
            className="w-[100px] rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        ) : null}
      </div>

      <p className="text-[11.5px] leading-relaxed text-neutral-600">{product.note}</p>

      {needsReading ? (
        readings.length === 0 ? (
          <p className="text-xs text-neutral-500">
            이 회원에게 저장된 사주 결과가 없어 부여할 수 없습니다.
          </p>
        ) : (
          <select
            value={readingId}
            onChange={(e) => setReadingId(e.target.value)}
            disabled={busy}
            aria-label="대상 사주 결과"
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {readings.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        )
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
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
          disabled={busy || (needsReading && readings.length === 0)}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? '처리 중…' : '권한 부여'}
        </button>
      </div>
      {msg ? <p className="break-all text-xs text-neutral-700">{msg}</p> : null}
    </div>
  );
}
