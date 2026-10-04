'use client';
import { useCallback, useEffect, useState } from 'react';
import { AdminPeriodPicker } from '@/components/admin/admin-period-picker';
import { resolveAdminPeriod } from '@/lib/admin/metric-periods';

interface Row {
  code: string;
  name: string;
  discountPercent: number;
  commissionPercent: number;
  active: boolean;
  url: string;
  visits: number;
  paidCount: number;
  paidWon: number;
  refundedCount: number;
  refundedWon: number;
  commissionWon: number;
}

const th = 'px-2.5 py-2 text-left text-[11.5px] font-bold text-[var(--app-copy-soft)] whitespace-nowrap';
const td = 'px-2.5 py-2 text-[13px] tabular-nums whitespace-nowrap';
const inputCls = 'rounded-[8px] border border-[var(--app-line)] bg-white px-2 py-1 text-[13px]';
const btn = 'rounded-[8px] px-3 py-1.5 text-[13px] font-bold disabled:opacity-40';
const btnInk = `${btn} bg-[var(--app-ink)] text-white`;
const btnLine = `${btn} border border-[var(--app-line)] bg-white text-[var(--app-ink)]`;
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export function PartnersAdminClient() {
  const [period, setPeriod] = useState(() => resolveAdminPeriod('day', undefined));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', discountPercent: '40', commissionPercent: '30' });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/partners?unit=${period.unit}&period=${encodeURIComponent(period.anchor)}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) { setRows(json.partners); setTruncated(json.truncated === true); setNotice(null); return; }
      setRows(null);
      setNotice(json.error === 'partners_table_missing' ? '인플루언서 테이블이 아직 적용되지 않았습니다.' : `불러오지 못했습니다: ${json.error}`);
    } catch {
      setNotice('불러오지 못했습니다. 잠시 후 다시 시도하세요.');
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  async function save(next: { code: string; name: string; discountPercent: number; commissionPercent: number; active: boolean }) {
    const res = await fetch('/api/admin/partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    const json = await res.json().catch(() => ({}));
    if (!json.ok) {
      setNotice(json.error === 'partners_table_missing' ? '인플루언서 테이블이 아직 적용되지 않았습니다.' : (json.error ?? '저장 실패'));
      return;
    }
    setNotice(null);
    await load();
  }

  return (
    <div className="space-y-4">
      <AdminPeriodPicker period={period} onChange={setPeriod} />
      {notice && <div className="rounded-[10px] border border-[var(--app-coral)] bg-[var(--app-coral)]/5 p-3 text-[13px] text-[var(--app-ink)]">{notice}</div>}

      {rows && truncated && <div className="text-[13px] font-bold text-[var(--app-coral)]">주문이 많아 최근 2,000건만 집계했습니다. 기간을 좁혀 주세요.</div>}
      {rows && (
        <div className="overflow-x-auto rounded-[10px] border border-[var(--app-line)] bg-white">
          <table className="w-full">
            <thead>
              <tr>
                {['이름', '코드', '주소', '방문', '결제', '환불', '수수료', '활성'].map((h) => <th key={h} className={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td className={td} colSpan={8}>등록된 인플루언서가 없습니다.</td></tr>}
              {rows.map((r) => (
                <tr key={r.code} className="border-t border-[var(--app-line)]">
                  <td className={td}>{r.name}<span className="ml-1 text-[11px] text-[var(--app-copy-soft)]">할인 {r.discountPercent}% · 수수료 {r.commissionPercent}%</span></td>
                  <td className={td}>{r.code}</td>
                  <td className={td}>
                    <button type="button" className={btnLine} onClick={() => void navigator.clipboard?.writeText(r.url)}>주소 복사</button>
                  </td>
                  <td className={td}>{r.visits.toLocaleString('ko-KR')}</td>
                  <td className={td}>{r.paidCount}건 · {won(r.paidWon)}</td>
                  <td className={td}>{r.refundedCount}건 · {won(r.refundedWon)}</td>
                  <td className={td}>{won(r.commissionWon)}</td>
                  <td className={td}>
                    <input
                      type="checkbox"
                      checked={r.active}
                      aria-label={`${r.name} 활성`}
                      onChange={(e) => void save({ code: r.code, name: r.name, discountPercent: r.discountPercent, commissionPercent: r.commissionPercent, active: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-2.5 py-2 text-[11.5px] text-[var(--app-copy-soft)]">환불은 판매한 기간의 실적에서 빼서 보여 줍니다.</p>
        </div>
      )}

      {rows && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-[10px] border border-[var(--app-line)] bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ code: form.code, name: form.name, discountPercent: Number(form.discountPercent), commissionPercent: Number(form.commissionPercent), active: true });
          }}
        >
          <label className="text-[11.5px] font-bold">코드(영문 소문자·숫자 3~20자)<br /><input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label className="text-[11.5px] font-bold">이름<br /><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="text-[11.5px] font-bold">할인 %<br /><input className={`${inputCls} w-20`} inputMode="numeric" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} /></label>
          <label className="text-[11.5px] font-bold">수수료 %<br /><input className={`${inputCls} w-20`} inputMode="numeric" value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })} /></label>
          <button type="submit" className={btnInk}>등록·수정</button>
        </form>
      )}
    </div>
  );
}
