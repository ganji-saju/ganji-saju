// 2026-07-07 — /admin/analytics 클라이언트 대시보드. metrics_daily 누적 시계열을
//   윈도우(30/90/365일)로 조회해 방문자·전환·유입·결제 그래프로 표시.
'use client';

import { useEffect, useState, type PointerEvent } from 'react';
import type { AnalyticsSnapshot, InflowAggEntry } from '@/lib/admin/analytics-metrics';
import { VISIT_TRACKING_START_KEY } from '@/lib/admin/analytics-rollup';
import type { ExternalAnalyticsSnapshot } from '@/lib/admin/external-analytics';
import { MetricsLineChart, type MetricPoint } from '@/components/admin/metrics-line-chart';

interface ApiResponse {
  ok: boolean;
  snapshot?: AnalyticsSnapshot;
  external?: ExternalAnalyticsSnapshot;
  error?: string;
}

const WINDOW_OPTIONS = [
  { value: 30, label: '30일' },
  { value: 90, label: '90일' },
  { value: 365, label: '365일' },
];

const AUTO_REFRESH_MS = 10 * 60 * 1000;
const formatNum = (n: number) => n.toLocaleString();
const formatMaybeNum = (n: number | null | undefined) => (n == null ? '—' : formatNum(n));
const formatPct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

function formatSignedNum(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toLocaleString()}`;
}

function formatVsInternal(source: number | null | undefined, internal: number | null | undefined): string {
  if (source == null) return '데이터 없음';
  if (internal == null) return '자체 기준 없음';
  const diff = source - internal;
  const pct = internal > 0 ? ` · ${diff > 0 ? '+' : ''}${((diff / internal) * 100).toFixed(1)}%` : '';
  return `자체 대비 ${formatSignedNum(diff)}${pct}`;
}

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
              <th className={th}>환불</th>
              <th className={th}>순매출</th>
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
                <td className={`${td} text-[var(--app-coral)]`}>
                  {d.refundedWon > 0 ? `-${fmtWon(d.refundedWon)}` : '—'}
                </td>
                <td className={`${td} font-semibold text-[var(--app-ink)]`}>
                  {d.revenueWon > 0 || d.refundedWon > 0 ? fmtWon(d.netRevenueWon) : '—'}
                </td>
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

interface ComparisonSeries {
  key: string;
  label: string;
  color: string;
  points: MetricPoint[];
}

function SourceStatus({
  label,
  status,
}: {
  label: string;
  status: ExternalAnalyticsSnapshot['sources']['googleAnalytics'];
}) {
  const text = !status.configured ? '미설정' : status.ok ? (status.warning ? '부분' : '연동됨') : '오류';
  const color = !status.configured
    ? 'border-[var(--app-line)] text-[var(--app-copy-soft)]'
    : status.ok
      ? 'border-[var(--app-jade,#3F8796)] text-[var(--app-jade,#3F8796)]'
      : 'border-[var(--app-coral)] text-[var(--app-coral)]';
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold ${color}`}
      title={status.error ?? status.warning ?? undefined}
    >
      {label} {text}
    </span>
  );
}

function SourceNotice({
  label,
  status,
}: {
  label: string;
  status: ExternalAnalyticsSnapshot['sources']['googleAnalytics'];
}) {
  const message = status.error ?? status.warning;
  if (!message) return null;
  return (
    <p className="text-[11.5px] leading-relaxed text-[var(--app-copy-soft)]">
      {label}: {message}
    </p>
  );
}

function ComparisonLineChart({
  title,
  subtitle,
  series,
  format = formatMaybeNum,
}: {
  title: string;
  subtitle?: string;
  series: ComparisonSeries[];
  format?: (v: number | null | undefined) => string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dates = series[0]?.points.map((p) => p.date) ?? [];
  const numeric = series
    .flatMap((s) => s.points.map((p) => p.value))
    .filter((v): v is number => typeof v === 'number');
  const hasData = numeric.some((v) => v > 0);

  const height = 116;
  const vbWidth = 100;
  const pad = 5;
  const usableH = height - pad * 2;
  const max = Math.max(...numeric, 1);
  const min = Math.min(...numeric, 0);
  const range = max - min || 1;
  const stepX = dates.length > 1 ? vbWidth / (dates.length - 1) : vbWidth;

  const coordinates = series.map((s) =>
    s.points.map((p, i) =>
      p.value == null
        ? null
        : { x: i * stepX, y: pad + usableH - ((p.value - min) / range) * usableH }
    )
  );

  const activeX =
    activeIndex == null
      ? 0
      : dates.length > 1
        ? (activeIndex / (dates.length - 1)) * 100
        : 50;
  const tooltipLeft =
    activeX > 72
      ? `calc(${activeX}% - 8px)`
      : activeX < 28
        ? `calc(${activeX}% + 8px)`
        : `${activeX}%`;
  const tooltipTransform =
    activeX > 72 ? 'translateX(-100%)' : activeX < 28 ? 'translateX(0)' : 'translateX(-50%)';

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dates.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    setActiveIndex(Math.min(dates.length - 1, Math.max(0, Math.round(ratio * (dates.length - 1)))));
  };

  return (
    <article className="rounded-[12px] border border-[var(--app-line)] bg-white p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[13px] font-extrabold text-[var(--app-ink)]">{title}</div>
          {subtitle && <div className="mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]">{subtitle}</div>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--app-copy-soft)]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {hasData ? (
        <div className="relative mt-2" style={{ height }}>
          <svg
            viewBox={`0 0 ${vbWidth} ${height}`}
            height={height}
            preserveAspectRatio="none"
            aria-label={`${title} 일별 비교 그래프`}
            className="block h-full w-full"
          >
            {series.map((s, si) => {
              const coords = coordinates[si] ?? [];
              const segments: Array<Array<{ x: number; y: number }>> = [];
              let run: Array<{ x: number; y: number }> = [];
              for (const coord of coords) {
                if (coord) {
                  run.push(coord);
                } else if (run.length) {
                  segments.push(run);
                  run = [];
                }
              }
              if (run.length) segments.push(run);

              return (
                <g key={s.key}>
                  {segments.map((seg, segIndex) => {
                    const line = seg.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(1)}`).join(' ');
                    return seg.length > 1 ? (
                      <polyline
                        key={segIndex}
                        points={line}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : (
                      <circle key={segIndex} cx={seg[0]!.x} cy={seg[0]!.y} r={1.4} fill={s.color} />
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {activeIndex != null && dates[activeIndex] && (
            <div className="pointer-events-none absolute inset-0 z-10">
              <div className="absolute bottom-0 top-0 w-px bg-[var(--app-ink)]/20" style={{ left: `${activeX}%` }} />
              <div
                className="absolute top-1 min-w-[178px] rounded-[8px] border border-[var(--app-line)] bg-white/95 px-2.5 py-2 text-[11.5px] shadow-[0_8px_24px_rgba(30,22,20,0.14)]"
                style={{ left: tooltipLeft, transform: tooltipTransform }}
              >
                <div className="font-bold text-[var(--app-ink)]">{dates[activeIndex]}</div>
                <div className="mt-1 space-y-0.5">
                  {series.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-3 tabular-nums">
                      <span className="inline-flex items-center gap-1.5 text-[var(--app-copy-soft)]">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </span>
                      <span className="font-bold text-[var(--app-ink)]">{format(s.points[activeIndex]?.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div
            className="absolute inset-0 z-20 cursor-crosshair"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setActiveIndex(null)}
          />
        </div>
      ) : (
        <div className="mt-2 grid h-20 place-items-center text-[12px] text-[var(--app-copy-soft)]">
          비교 데이터 없음
        </div>
      )}
      <div className="mt-1 flex justify-between text-[10.9px] text-[var(--app-copy-soft)]">
        <span>{dates[0]}</span>
        <span>{dates[dates.length - 1]}</span>
      </div>
    </article>
  );
}

function ExternalComparison({
  snap,
  external,
}: {
  snap: AnalyticsSnapshot;
  external: ExternalAnalyticsSnapshot;
}) {
  // 2026-07-20 — 방문 집계가 실제로 사람을 세기 시작한 날 이전은 화면에서 자른다(사용자 요청).
  //   그 이전 visitors 는 "0명"이 아니라 **"세지 못함"**(호스트 판정 버그로 실사용자 전량 폐기,
  //   커밋 5a06e9c3). 0 을 길게 그리면 "예전엔 잘 됐는데 지금 죽었다"는 정반대 착시를 만든다.
  //   ⚠️ 자르는 건 **표시**뿐이다 — getDailyMetrics 는 순수하게 두어(전체 축 유지)
  //   날짜에 종속되지 않게 한다. 데이터 함수에 넣었더니 고정 NOW 를 쓰는 테스트 4건이 깨졌다.
  const snapDaily = snap.daily.filter((d) => d.date >= VISIT_TRACKING_START_KEY);
  const externalByDate = new Map(external.daily.map((d) => [d.date, d]));
  const latestRows = [...snapDaily]
    .reverse()
    .slice(0, 12)
    .map((internal) => ({ internal, external: externalByDate.get(internal.date) }));

  const visitorSeries: ComparisonSeries[] = [
    {
      key: 'internal',
      label: '자체',
      color: 'var(--app-pink-strong)',
      points: snapDaily.map((d) => ({ date: d.date, value: d.visitors })),
    },
    {
      key: 'ga',
      label: 'GA4',
      color: 'var(--app-jade,#3F8796)',
      points: external.daily.map((d) => ({ date: d.date, value: d.gaActiveUsers })),
    },
  ];
  if (external.totals.vercelVisitors != null) {
    visitorSeries.push({
      key: 'vercel',
      label: 'Vercel',
      color: '#7C5CBF',
      points: external.daily.map((d) => ({ date: d.date, value: d.vercelVisitors })),
    });
  }

  const pageViewSeries: ComparisonSeries[] = [
    {
      key: 'internal',
      label: '자체',
      color: 'var(--app-pink-strong)',
      points: snapDaily.map((d) => ({ date: d.date, value: d.pageViews })),
    },
    {
      key: 'ga',
      label: 'GA4',
      color: 'var(--app-jade,#3F8796)',
      points: external.daily.map((d) => ({ date: d.date, value: d.gaPageViews })),
    },
    {
      key: 'vercel',
      label: 'Vercel',
      color: '#7C5CBF',
      points: external.daily.map((d) => ({ date: d.date, value: d.vercelPageViews })),
    },
  ];

  const th = 'px-2.5 py-2 text-right font-bold whitespace-nowrap';
  const td = 'px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">외부 분석 비교</h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]">
            자체 순방문/PV · GA4 Data API · Vercel Web Analytics를 같은 KST 날짜축으로 비교
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <SourceStatus label="GA4" status={external.sources.googleAnalytics} />
          <SourceStatus label="Vercel" status={external.sources.vercel} />
        </div>
      </div>
      <div className="space-y-0.5">
        <SourceNotice label="GA4" status={external.sources.googleAnalytics} />
        <SourceNotice label="Vercel" status={external.sources.vercel} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <SummaryCard
          label="자체 순방문"
          value={formatNum(snap.totals.visitors)}
          sub={`자체 PV ${formatNum(snap.totals.pageViews)}`}
        />
        <SummaryCard
          label="GA4 활성 사용자"
          value={formatMaybeNum(external.totals.gaActiveUsers)}
          sub={formatVsInternal(external.totals.gaActiveUsers, snap.totals.visitors)}
        />
        <SummaryCard
          label="GA4 화면 PV"
          value={formatMaybeNum(external.totals.gaPageViews)}
          sub={formatVsInternal(external.totals.gaPageViews, snap.totals.pageViews)}
        />
        <SummaryCard
          label="Vercel PV"
          value={formatMaybeNum(external.totals.vercelPageViews)}
          sub={formatVsInternal(external.totals.vercelPageViews, snap.totals.pageViews)}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ComparisonLineChart
          title="방문자 비교"
          subtitle="자체 순방문 vs GA4 activeUsers"
          series={visitorSeries}
        />
        <ComparisonLineChart
          title="PV 비교"
          subtitle="자체 PV vs GA4 screenPageViews vs Vercel PV"
          series={pageViewSeries}
        />
      </div>

      <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">최근 일별 비교</h2>
          <span className="text-[11.5px] text-[var(--app-copy-soft)]">최신 12일</span>
        </div>
        <div className="mt-3 overflow-x-auto rounded-[10px] border border-[var(--app-line)]">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="bg-[var(--app-pink-soft)] text-[var(--app-ink)]">
              <tr>
                <th className={`${th} text-left`}>날짜</th>
                <th className={th}>자체 순방문</th>
                <th className={th}>GA4 사용자</th>
                <th className={th}>자체 PV</th>
                <th className={th}>GA4 PV</th>
                <th className={th}>Vercel PV</th>
              </tr>
            </thead>
            <tbody>
              {latestRows.map(({ internal, external: ext }) => (
                <tr key={internal.date} className="border-t border-[var(--app-line)]">
                  <td className={`${td} text-left font-semibold text-[var(--app-ink)]`}>{internal.date}</td>
                  <td className={td}>{formatNum(internal.visitors)}</td>
                  <td className={td}>{formatMaybeNum(ext?.gaActiveUsers)}</td>
                  <td className={`${td} text-[var(--app-copy-soft)]`}>{formatNum(internal.pageViews)}</td>
                  <td className={`${td} text-[var(--app-copy-soft)]`}>{formatMaybeNum(ext?.gaPageViews)}</td>
                  <td className={`${td} text-[var(--app-copy-soft)]`}>{formatMaybeNum(ext?.vercelPageViews)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [snap, setSnap] = useState<AnalyticsSnapshot | null>(null);
  // 2026-07-20 — 실측 시작일 이전(집계가 사람을 못 세던 구간)은 표에서 제외.
  //   상세 근거는 VISIT_TRACKING_START_KEY 주석 참조.
  const visibleDaily = (snap?.daily ?? []).filter((d) => d.date >= VISIT_TRACKING_START_KEY);
  const [external, setExternal] = useState<ExternalAnalyticsSnapshot | null>(null);
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
          setExternal(res.external ?? null);
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
            <SummaryCard label="자체 순방문" value={formatNum(snap.totals.visitors)} sub={`자체 PV ${formatNum(snap.totals.pageViews)}`} />
            <SummaryCard label="신규가입" value={formatNum(snap.totals.newSignups)} />
            <SummaryCard label="결제 건수" value={formatNum(snap.totals.paidOrders)} />
            {/* 2026-07-21 — 매출 → **순매출**(매출 − 환불). 환불은 sub 로 부기.
                metrics_daily 가 refunded_won 을 별도로 기록하는데 조회가 revenue_won 만
                읽어 환불이 화면에 안 잡히던 버그(사용자 제보: 환불했는데 매출에 그대로). */}
            <SummaryCard
              label="순매출"
              value={fmtWon(snap.totals.netRevenueWon)}
              sub={
                snap.totals.refundedWon > 0
                  ? `매출 ${fmtWon(snap.totals.revenueWon)} · 환불 -${fmtWon(snap.totals.refundedWon)}`
                  : undefined
              }
            />
            <SummaryCard label="결제/방문(참고)" value={formatPct(snap.totals.visitorToPaidRate)} sub="결제건÷방문자" />
            <SummaryCard label="결제창 전환" value={formatPct(snap.totals.checkoutConversionRate)} sub="성공÷시도" />
          </div>

          {external && <ExternalComparison snap={snap} external={external} />}

          {/* 방문자·PV 그래프 */}
          <div className="grid gap-3 lg:grid-cols-2">
            <MetricsLineChart title="자체 순방문" points={series((d) => d.visitors)} color="var(--app-pink-strong)" />
            <MetricsLineChart title="자체 페이지뷰(PV)" points={series((d) => d.pageViews)} color="#7C5CBF" />
          </div>

          {/* 날짜별 상세 테이블 — 방문자·PV 바로 아래 */}
          <DailyTable rows={visibleDaily} />

          {/* 나머지 그래프 */}
          <div className="grid gap-3 lg:grid-cols-2">
            <MetricsLineChart title="신규가입" points={series((d) => d.newSignups)} color="var(--app-jade,#3F8796)" />
            <MetricsLineChart
              title="순매출(원)"
              points={series((d) => d.netRevenueWon)}
              color="#D59B2E"
              format={fmtWon}
            />
            <MetricsLineChart title="결제 건수" points={series((d) => d.paidOrders)} color="#C6537B" />
            <MetricsLineChart
              title="결제건 ÷ 방문자 (참고)"
              subtitle="방문자는 자체 순방문 기준 · 무트래픽일은 선 끊김"
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
            ※ 자체 순방문은 KST 일별 익명 visitor 기준, 자체 PV는 라우트별 page_view 기준입니다.
            admin·preview·내부 IP 트래픽은 제외합니다.
            매출·전환은 payment_orders(완료 상태) 원장 기준. KST 일 단위.
          </p>
        </>
      )}
    </div>
  );
}
