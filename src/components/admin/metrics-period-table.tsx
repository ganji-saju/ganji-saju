'use client';
// 2026-08-27 — 지표 표(일 / 주). 사용자 지시: "일단위로 매일매일 날짜로 표시 ·
//   주단위도 월요일부터 일요일까지". /admin 과 /admin/analytics 가 **같은 컴포넌트**를 쓴다 —
//   따로 만들면 두 화면의 주 경계나 비율 계산이 갈라진다(예전 유입 카드에서 겪은 문제).
import { useEffect, useMemo, useState } from 'react';
import type { DailyMetricPoint } from '@/lib/admin/analytics-metrics';
import { aggregateWeekly, sumDaily, weekdayLabel } from '@/lib/admin/period-buckets';

type Unit = 'day' | 'week';

const DAY_PAGE_SIZE = 15;
const PAGE_WINDOW = 5;

function fmtNum(n: number): string {
  return n.toLocaleString('ko-KR');
}
function fmtWon(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}
// 분모 0(null)은 0% 가 아니라 '—'.
function fmtPct(v: number | null): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`;
}

interface Row {
  key: string;
  /** 왼쪽 첫 칸에 그대로 찍히는 기간 표기. */
  label: string;
  /** 주 단위에서 7일이 안 찬 구간 — 온전한 주와 나란히 비교하면 안 된다. */
  partial?: boolean;
  visitors: number;
  pageViews: number;
  newSignups: number;
  paidOrders: number;
  revenueWon: number;
  refundedWon: number;
  netRevenueWon: number;
  visitorToPaidRate: number | null;
}

export function MetricsPeriodTable({
  rows,
  title = '기간별 상세',
  defaultUnit = 'day',
}: {
  /** 오름차순·내림차순 무관. 화면은 항상 최신이 위. */
  rows: readonly DailyMetricPoint[];
  title?: string;
  defaultUnit?: Unit;
}) {
  const [unit, setUnit] = useState<Unit>(defaultUnit);
  const [page, setPage] = useState(0);

  // 윈도우(30/90/365) 전환이나 단위 전환 시 첫 페이지로.
  useEffect(() => {
    setPage(0);
  }, [rows, unit]);

  const dayRows: Row[] = useMemo(
    () =>
      [...rows]
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((d) => ({
          key: d.date,
          label: `${d.date} (${weekdayLabel(d.date)})`,
          visitors: d.visitors,
          pageViews: d.pageViews,
          newSignups: d.newSignups,
          paidOrders: d.paidOrders,
          revenueWon: d.revenueWon,
          refundedWon: d.refundedWon,
          netRevenueWon: d.netRevenueWon,
          visitorToPaidRate: d.visitorToPaidRate,
        })),
    [rows]
  );

  const weekRows: Row[] = useMemo(
    () =>
      aggregateWeekly(rows)
        .slice()
        .reverse()
        .map((w) => ({
          key: w.weekStart,
          label: w.label,
          partial: w.partial,
          visitors: w.visitors,
          pageViews: w.pageViews,
          newSignups: w.newSignups,
          paidOrders: w.paidOrders,
          revenueWon: w.revenueWon,
          refundedWon: w.refundedWon,
          netRevenueWon: w.netRevenueWon,
          visitorToPaidRate: w.visitorToPaidRate,
        })),
    [rows]
  );

  const total = useMemo(() => sumDaily(rows), [rows]);

  const all = unit === 'day' ? dayRows : weekRows;
  // 주는 최대 53줄이라 통째로 보여준다. 페이지가 필요한 건 일 단위뿐.
  const paged = unit === 'day';
  const totalPages = paged ? Math.max(1, Math.ceil(all.length / DAY_PAGE_SIZE)) : 1;
  const current = Math.min(page, totalPages - 1);
  const visible = paged ? all.slice(current * DAY_PAGE_SIZE, current * DAY_PAGE_SIZE + DAY_PAGE_SIZE) : all;

  let winStart = Math.max(0, current - Math.floor(PAGE_WINDOW / 2));
  winStart = Math.min(winStart, Math.max(0, totalPages - PAGE_WINDOW));
  const pageNumbers: number[] = [];
  for (let i = winStart; i < Math.min(totalPages, winStart + PAGE_WINDOW); i += 1) pageNumbers.push(i);

  const th = 'h-7 px-3 text-right text-[11px] font-semibold uppercase tracking-[.05em] whitespace-nowrap';
  const td = 'h-[29px] px-3 text-right whitespace-nowrap';
  const unitBtn = 'h-7 px-3 text-[11px] font-semibold transition-colors';

  return (
    <section className="rounded-[8px] border border-[var(--app-line)] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--app-line)] px-4 py-2.5">
        <h2 className="text-[14px] font-semibold tracking-[-.01em] text-[var(--app-ink)]">{title}</h2>
        <div className="flex overflow-hidden rounded-[6px] border border-[var(--app-line)]">
          <button
            type="button"
            onClick={() => setUnit('day')}
            aria-pressed={unit === 'day'}
            className={`${unitBtn} ${unit === 'day' ? 'bg-[var(--app-surface-muted)] text-[var(--app-ink)]' : 'text-[var(--app-copy-muted)]'}`}
          >
            일별
          </button>
          <button
            type="button"
            onClick={() => setUnit('week')}
            aria-pressed={unit === 'week'}
            title="달력 주(월요일~일요일)"
            className={`${unitBtn} border-l border-[var(--app-line)] ${unit === 'week' ? 'bg-[var(--app-surface-muted)] text-[var(--app-ink)]' : 'text-[var(--app-copy-muted)]'}`}
          >
            주별
          </button>
        </div>
        <span className="ml-auto text-[11.5px] text-[var(--app-copy-muted)]">
          {unit === 'day' ? `${fmtNum(all.length)}일` : `${fmtNum(all.length)}주 · 월~일 기준`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${th} text-left`}>{unit === 'day' ? '날짜' : '주 (월~일)'}</th>
              <th className={th}>방문자</th>
              <th className={th}>PV</th>
              <th className={th}>신규가입</th>
              <th className={th}>결제</th>
              <th className={th}>매출</th>
              <th className={th}>환불</th>
              <th className={th}>순매출</th>
              <th className={th}>결제/방문</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.key}>
                <td className={`${td} text-left font-semibold text-[var(--app-ink)]`}>
                  {r.label}
                  {r.partial ? (
                    <span
                      title="이 주는 조회 기간에 잘렸거나 아직 진행 중입니다 — 온전한 주와 나란히 비교하지 마세요"
                      className="ml-1.5 rounded-[4px] bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--app-copy-muted)]"
                    >
                      부분
                    </span>
                  ) : null}
                </td>
                <td className={td}>{fmtNum(r.visitors)}</td>
                <td className={`${td} text-[var(--app-copy-muted)]`}>{fmtNum(r.pageViews)}</td>
                <td className={td}>{fmtNum(r.newSignups)}</td>
                <td className={td}>{fmtNum(r.paidOrders)}</td>
                <td className={td}>{r.revenueWon > 0 ? fmtWon(r.revenueWon) : '—'}</td>
                <td className={`${td} text-[var(--app-coral)]`}>
                  {r.refundedWon > 0 ? `-${fmtWon(r.refundedWon)}` : '—'}
                </td>
                {/* 순매출 음수는 대개 '예전에 판 걸 이 기간에 환불'이다 — 색만 바꾸고
                    이유는 환불 내역이 건별 원 결제일로 답한다. */}
                <td
                  className={`${td} font-semibold`}
                  style={{ color: r.netRevenueWon < 0 ? 'var(--app-coral)' : 'var(--app-ink)' }}
                  title={r.netRevenueWon < 0 ? '과거 결제분 환불이 이 기간에 계상됨' : undefined}
                >
                  {r.revenueWon > 0 || r.refundedWon > 0 ? fmtWon(r.netRevenueWon) : '—'}
                </td>
                <td className={`${td} text-[var(--app-copy-muted)]`}>{fmtPct(r.visitorToPaidRate)}</td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-[13px] text-[var(--app-copy-muted)]">
                  이 기간에는 집계된 날이 없습니다.
                </td>
              </tr>
            ) : null}
            {/* 합계는 **보이는 페이지가 아니라 기간 전체** — 페이지를 넘겨도 값이 안 변한다. */}
            <tr className="border-t-2 border-[var(--app-ink)]">
              <td className={`${td} text-left font-bold text-[var(--app-ink)]`}>
                합계 <span className="font-medium text-[var(--app-copy-muted)]">기간 전체 {fmtNum(total.days)}일</span>
              </td>
              <td className={`${td} font-semibold`}>{fmtNum(total.visitors)}</td>
              <td className={`${td} font-semibold text-[var(--app-copy-muted)]`}>{fmtNum(total.pageViews)}</td>
              <td className={`${td} font-semibold`}>{fmtNum(total.newSignups)}</td>
              <td className={`${td} font-semibold`}>{fmtNum(total.paidOrders)}</td>
              <td className={`${td} font-semibold`}>{total.revenueWon > 0 ? fmtWon(total.revenueWon) : '—'}</td>
              <td className={`${td} font-semibold text-[var(--app-coral)]`}>
                {total.refundedWon > 0 ? `-${fmtWon(total.refundedWon)}` : '—'}
              </td>
              <td
                className={`${td} font-bold`}
                style={{ color: total.netRevenueWon < 0 ? 'var(--app-coral)' : 'var(--app-ink)' }}
              >
                {total.revenueWon > 0 || total.refundedWon > 0 ? fmtWon(total.netRevenueWon) : '—'}
              </td>
              <td className={`${td} font-semibold text-[var(--app-copy-muted)]`}>
                {fmtPct(total.visitorToPaidRate)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {paged && totalPages > 1 ? (
        <div className="flex items-center justify-center gap-1.5 border-t border-[var(--app-line)] px-4 py-2.5">
          <button
            type="button"
            onClick={() => setPage(Math.max(0, current - 1))}
            disabled={current === 0}
            aria-label="이전 페이지"
            className="flex h-7 min-w-7 items-center justify-center rounded-[6px] border border-[var(--app-line)] px-2 text-[11.5px] font-semibold text-[var(--app-ink)] disabled:opacity-40"
          >
            ‹
          </button>
          {pageNumbers.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              aria-current={p === current ? 'page' : undefined}
              className={`flex h-7 min-w-7 items-center justify-center rounded-[6px] border px-2 text-[11.5px] font-semibold ${
                p === current
                  ? 'border-[var(--app-pink)] bg-[var(--app-pink-soft)] text-[var(--app-pink)]'
                  : 'border-[var(--app-line)] text-[var(--app-ink)]'
              }`}
            >
              {p + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages - 1, current + 1))}
            disabled={current >= totalPages - 1}
            aria-label="다음 페이지"
            className="flex h-7 min-w-7 items-center justify-center rounded-[6px] border border-[var(--app-line)] px-2 text-[11.5px] font-semibold text-[var(--app-ink)] disabled:opacity-40"
          >
            ›
          </button>
        </div>
      ) : null}
    </section>
  );
}
