// 2026-07-07 — /admin/analytics 클라이언트 대시보드. metrics_daily 누적 시계열을
//   윈도우(30/90/365일)로 조회해 방문자·전환·유입·결제 그래프로 표시.
'use client';

import { useEffect, useState } from 'react';
import type { AnalyticsSnapshot, InflowAggEntry } from '@/lib/admin/analytics-metrics';
import { MetricsLineChart, type MetricPoint } from '@/components/admin/metrics-line-chart';

interface ApiResponse {
  ok: boolean;
  snapshot?: AnalyticsSnapshot;
  error?: string;
}

const WINDOW_OPTIONS = [
  { value: 30, label: '30일' },
  { value: 90, label: '90일' },
  { value: 365, label: '365일' },
];

const AUTO_REFRESH_MS = 10 * 60 * 1000;
const formatNum = (n: number) => n.toLocaleString();
const formatPct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

function fmtWon(won: number): string {
  if (won >= 100_000_000) return `${(won / 100_000_000).toFixed(won % 100_000_000 === 0 ? 0 : 1)}억`;
  if (won >= 10_000) return `${(won / 10_000).toFixed(won % 10_000 === 0 ? 0 : 1)}만`;
  return `${formatNum(won)}원`;
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--app-line)] bg-white p-3.5">
      <div className="text-[11.8px] font-extrabold uppercase tracking-[0.05em] text-[var(--app-copy-soft)]">
        {label}
      </div>
      <div className="mt-1 text-[20px] font-extrabold text-[var(--app-ink)]">{value}</div>
      {sub && <div className="mt-0.5 text-[11.8px] text-[var(--app-copy-soft)]">{sub}</div>}
    </div>
  );
}

function InflowTable({
  title,
  entries,
  emptyHint,
}: {
  title: string;
  entries: InflowAggEntry[];
  emptyHint: string;
}) {
  const max = Math.max(...entries.map((e) => e.visitors), 1);
  return (
    <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
      <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">{title}</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-[13px] text-[var(--app-copy-soft)]">{emptyHint}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {entries.map((e) => (
            <li key={e.key} className="flex items-center gap-3">
              <span className="w-[42%] shrink-0 truncate text-[12.5px] text-[var(--app-ink)]" title={e.label}>
                {e.label}
              </span>
              <span className="relative h-[18px] flex-1 overflow-hidden rounded-[6px] bg-[var(--app-line)]/40">
                <span
                  className="absolute inset-y-0 left-0 rounded-[6px] bg-[var(--app-pink-strong)]"
                  style={{ width: `${Math.max(4, (e.visitors / max) * 100)}%` }}
                />
              </span>
              <span className="w-14 shrink-0 text-right text-[12.5px] font-bold text-[var(--app-ink)]">
                {formatNum(e.visitors)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const DAILY_PAGE_SIZE = 15; // 한 페이지 15일.
const DAILY_PAGE_WINDOW = 5; // 숫자 버튼 최대 노출 개수(1,2,3,4,5 …).

function DailyTable({ rows }: { rows: AnalyticsSnapshot['daily'] }) {
  const [page, setPage] = useState(0);
  // 윈도우(30/90/365) 전환 등 rows 갱신 시 첫 페이지로.
  useEffect(() => {
    setPage(0);
  }, [rows]);

  const ordered = [...rows].reverse(); // 최신 날짜 먼저.
  const totalPages = Math.max(1, Math.ceil(ordered.length / DAILY_PAGE_SIZE));
  const current = Math.min(page, totalPages - 1); // 방어적 clamp.
  const start = current * DAILY_PAGE_SIZE;
  const pageRows = ordered.slice(start, start + DAILY_PAGE_SIZE);

  // 현재 페이지를 가운데 두는 슬라이딩 숫자 윈도우.
  let winStart = Math.max(0, current - Math.floor(DAILY_PAGE_WINDOW / 2));
  winStart = Math.min(winStart, Math.max(0, totalPages - DAILY_PAGE_WINDOW));
  const winEnd = Math.min(totalPages, winStart + DAILY_PAGE_WINDOW);
  const pageNumbers: number[] = [];
  for (let i = winStart; i < winEnd; i += 1) pageNumbers.push(i);

  const th = 'px-2.5 py-2 text-right font-bold whitespace-nowrap';
  const td = 'px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap';
  const navBtn =
    'flex h-8 min-w-8 items-center justify-center rounded-[9px] border px-2.5 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">날짜별 상세</h2>
        <span className="text-[11.5px] text-[var(--app-copy-soft)]">총 {ordered.length}일</span>
      </div>
      <div className="mt-3 overflow-x-auto rounded-[10px] border border-[var(--app-line)]">
        <table className="w-full border-collapse text-[12.5px]">
          <thead className="bg-[var(--app-pink-soft)] text-[var(--app-ink)]">
            <tr>
              <th className={`${th} text-left`}>날짜</th>
              <th className={th}>방문자</th>
              <th className={th}>PV</th>
              <th className={th}>신규가입</th>
              <th className={th}>결제</th>
              <th className={th}>매출</th>
              <th className={th}>결제/방문</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((d) => (
              <tr key={d.date} className="border-t border-[var(--app-line)]">
                <td className={`${td} text-left font-semibold text-[var(--app-ink)]`}>{d.date}</td>
                <td className={td}>{formatNum(d.visitors)}</td>
                <td className={`${td} text-[var(--app-copy-soft)]`}>{formatNum(d.pageViews)}</td>
                <td className={td}>{formatNum(d.newSignups)}</td>
                <td className={td}>{formatNum(d.paidOrders)}</td>
                <td className={td}>{d.revenueWon > 0 ? fmtWon(d.revenueWon) : '—'}</td>
                <td className={`${td} text-[var(--app-copy-soft)]`}>{formatPct(d.visitorToPaidRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage(Math.max(0, current - 1))}
            disabled={current === 0}
            aria-label="이전 페이지"
            className={`${navBtn} border-[var(--app-line)] text-[var(--app-ink)]`}
          >
            ‹
          </button>
          {pageNumbers.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              aria-current={p === current ? 'page' : undefined}
              className={`${navBtn} ${
                p === current
                  ? 'border-[var(--app-ink)] bg-[var(--app-ink)] text-white'
                  : 'border-[var(--app-line)] text-[var(--app-copy-soft)]'
              }`}
            >
              {p + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages - 1, current + 1))}
            disabled={current === totalPages - 1}
            aria-label="다음 페이지"
            className={`${navBtn} border-[var(--app-line)] text-[var(--app-ink)]`}
          >
            ›
          </button>
        </div>
      )}
    </section>
  );
}

export function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [snap, setSnap] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let loadedOnce = false;

    const load = async (initial: boolean) => {
      if (initial) {
        setLoading(true);
        setError(null);
      }

      try {
        const res = (await fetch(`/api/admin/analytics?days=${days}`, {
          cache: 'no-store',
        }).then((r) => r.json())) as ApiResponse;
        if (!alive) return;
        if (res.ok && res.snapshot) {
          loadedOnce = true;
          setSnap(res.snapshot);
          setError(null);
        } else if (initial || !loadedOnce) {
          setError(res.error ?? '불러오기 실패');
        }
      } catch (e) {
        if (alive && (initial || !loadedOnce)) {
          setError(e instanceof Error ? e.message : '네트워크 오류');
        }
      } finally {
        if (alive && initial) setLoading(false);
      }
    };

    void load(true);
    const timer = window.setInterval(() => {
      void load(false);
    }, AUTO_REFRESH_MS);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [days]);

  const series = (
    pick: (d: AnalyticsSnapshot['daily'][number]) => number | null
  ): MetricPoint[] => (snap?.daily ?? []).map((d) => ({ date: d.date, value: pick(d) }));

  return (
    <div className="flex flex-col gap-5">
      {/* 윈도우 선택 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDays(opt.value)}
              className={`rounded-[10px] border px-3 py-1.5 text-[13px] font-bold ${
                days === opt.value
                  ? 'border-[var(--app-ink)] bg-[var(--app-ink)] text-white'
                  : 'border-[var(--app-line)] text-[var(--app-copy-soft)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {snap?.refreshedAt && (
          <div className="text-[11.5px] text-[var(--app-copy-soft)]">
            {new Date(snap.refreshedAt).toLocaleString('ko-KR')} 기준
          </div>
        )}
      </div>

      {loading && <div className="text-[13px] text-[var(--app-copy-soft)]">불러오는 중…</div>}
      {error && (
        <div className="rounded-[12px] border border-[var(--app-coral)] bg-[var(--app-coral)]/5 p-3 text-[13px] text-[var(--app-ink)]">
          불러오기 실패: {error}
        </div>
      )}

      {snap && !loading && !error && (
        <>
          {!snap.hasData && (
            <div className="rounded-[12px] border border-[var(--app-line)] bg-white p-4 text-[13px] text-[var(--app-copy-soft)]">
              아직 누적된 데이터가 없습니다. metrics_daily 마이그레이션(066) 적용 및 롤업 크론/백필
              (<code>/api/admin/metrics/rollup?backfill=90</code>) 실행 여부를 확인하세요.
            </div>
          )}

          {/* 요약 */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryCard label="방문자" value={formatNum(snap.totals.visitors)} sub={`PV ${formatNum(snap.totals.pageViews)}`} />
            <SummaryCard label="신규가입" value={formatNum(snap.totals.newSignups)} />
            <SummaryCard label="결제 건수" value={formatNum(snap.totals.paidOrders)} />
            <SummaryCard label="매출" value={fmtWon(snap.totals.revenueWon)} />
            <SummaryCard label="결제/방문(참고)" value={formatPct(snap.totals.visitorToPaidRate)} sub="결제건÷방문자" />
            <SummaryCard label="결제창 전환" value={formatPct(snap.totals.checkoutConversionRate)} sub="성공÷시도" />
          </div>

          {/* 방문자·PV 그래프 */}
          <div className="grid gap-3 lg:grid-cols-2">
            <MetricsLineChart title="방문자" points={series((d) => d.visitors)} color="var(--app-pink-strong)" />
            <MetricsLineChart title="페이지뷰(PV)" points={series((d) => d.pageViews)} color="#7C5CBF" />
          </div>

          {/* 날짜별 상세 테이블 — 방문자·PV 바로 아래 */}
          <DailyTable rows={snap.daily} />

          {/* 나머지 그래프 */}
          <div className="grid gap-3 lg:grid-cols-2">
            <MetricsLineChart title="신규가입" points={series((d) => d.newSignups)} color="var(--app-jade,#3F8796)" />
            <MetricsLineChart
              title="매출(원)"
              points={series((d) => d.revenueWon)}
              color="#D59B2E"
              format={fmtWon}
            />
            <MetricsLineChart title="결제 건수" points={series((d) => d.paidOrders)} color="#C6537B" />
            <MetricsLineChart
              title="결제건 ÷ 방문자 (참고)"
              subtitle="방문자는 하한 집계라 100% 초과 가능 · 무트래픽일은 선 끊김"
              points={series((d) => (d.visitorToPaidRate == null ? null : d.visitorToPaidRate * 100))}
              color="#3F8796"
              format={(v) => `${v.toFixed(1)}%`}
            />
            <MetricsLineChart
              title="결제창 전환율 (성공/시도)"
              subtitle="confirm 성공 ÷ 결제 시도 · 시도 없는 날은 선 끊김"
              points={series((d) =>
                d.checkoutConversionRate == null ? null : d.checkoutConversionRate * 100
              )}
              color="#8A6D3B"
              format={(v) => `${v.toFixed(1)}%`}
            />
          </div>

          {/* 유입 */}
          <div className="grid gap-3 lg:grid-cols-2">
            <InflowTable
              title="유입 상위 (referrer)"
              entries={snap.topReferrers}
              emptyHint="referrer 데이터가 아직 없습니다."
            />
            <InflowTable
              title="유입 상위 (UTM 캠페인)"
              entries={snap.topUtm}
              emptyHint="UTM 태그 유입이 아직 없습니다(배포 후부터 수집)."
            />
          </div>

          <p className="text-[11.5px] leading-relaxed text-[var(--app-copy-soft)]">
            ※ 방문자는 자체 집계(1일 1기기 익명 핑) — 광고차단·JS 미실행은 미포함 하한치입니다.
            매출·전환은 payment_orders(완료 상태) 원장 기준. KST 일 단위.
          </p>
        </>
      )}
    </div>
  );
}
