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

export function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [snap, setSnap] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics?days=${days}`)
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((res) => {
        if (!alive) return;
        if (res.ok && res.snapshot) setSnap(res.snapshot);
        else setError(res.error ?? '불러오기 실패');
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : '네트워크 오류');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
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

          {/* 그래프 */}
          <div className="grid gap-3 lg:grid-cols-2">
            <MetricsLineChart title="방문자" points={series((d) => d.visitors)} color="var(--app-pink-strong)" />
            <MetricsLineChart title="페이지뷰(PV)" points={series((d) => d.pageViews)} color="#7C5CBF" />
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
