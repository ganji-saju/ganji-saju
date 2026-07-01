// 2026-05-15 — 운영 모니터링 클라이언트 컴포넌트.
'use client';

import { useEffect, useState } from 'react';
import type { DailySeries, OperationsSnapshot } from '@/lib/admin/operations-stats';

interface ApiResponse {
  ok: boolean;
  snapshot?: OperationsSnapshot;
  error?: string;
}

const WINDOW_OPTIONS = [
  { value: 7, label: '7일' },
  { value: 14, label: '14일' },
  { value: 30, label: '30일' },
  { value: 60, label: '60일' },
];

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNum(n: number): string {
  return n.toLocaleString();
}

function formatRating(n: number): string {
  if (n > 0) return `+${n.toFixed(3)}`;
  return n.toFixed(3);
}

/** 작은 인라인 SVG 스파크라인 (간단한 추세선). */
function Sparkline({
  series,
  color,
  height = 36,
}: {
  series: DailySeries[];
  color: string;
  height?: number;
}) {
  if (series.length === 0) return null;
  const values = series.map((s) => s.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  // 2026-06-28 — 풀폭 반응형: viewBox 좌표(0~100)만 쓰고 svg 는 컨테이너 폭에 맞춰 늘어남.
  //   preserveAspectRatio="none" 로 가로 stretch, stroke 는 non-scaling 으로 크기 유지.
  const vbWidth = 100;
  const stepX = series.length > 1 ? vbWidth / (series.length - 1) : vbWidth;
  const points = series
    .map((s, i) => {
      const x = i * stepX;
      const y = height - ((s.value - min) / range) * (height - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastVal = values[values.length - 1] ?? 0;
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox={`0 0 ${vbWidth} ${height}`}
        height={height}
        preserveAspectRatio="none"
        className="h-9 flex-1"
        aria-hidden="true"
      >
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          points={points}
        />
      </svg>
      <div className="flex shrink-0 flex-col text-[10.9px] leading-tight text-[var(--app-copy-soft)]">
        <span>오늘 {formatNum(lastVal)}</span>
        <span>평균 {avg.toFixed(1)}</span>
      </div>
    </div>
  );
}

/**
 * 만족도 분포(맞춤/부분/빗나감)를 단일 stacked horizontal bar 로 시각화.
 * 2026-05-16 PR E1+E4: 이전엔 3 컬럼 grid 의 단순 수치였음 — 비율이 한눈에 안 들어옴.
 * 1개의 가로 bar 가 (jade/amber/coral) 3 색으로 분절 + 각 segment 안에 퍼센트 inline 표시.
 */
function StackedRateBar({
  correctRate,
  partialRate,
  missRate,
}: {
  correctRate: number;
  partialRate: number;
  missRate: number;
}) {
  const total = correctRate + partialRate + missRate;
  // 데이터가 비어있을 때 (sample=0) 0%/0%/0% — 표시할 게 없으니 placeholder bar.
  if (total === 0) {
    return (
      <div
        className="mt-2.5 grid h-7 place-items-center rounded-[10px] border text-[12.1px] text-[var(--app-copy-soft)]"
        style={{ borderColor: 'var(--app-line)', background: 'rgba(0,0,0,0.025)' }}
      >
        표본 없음
      </div>
    );
  }
  const SEGMENTS = [
    { key: 'correct', label: '맞춤', value: correctRate, color: 'var(--app-jade)', textOn: '#fff' },
    { key: 'partial', label: '부분', value: partialRate, color: 'var(--app-amber)', textOn: '#1f1d1c' },
    { key: 'miss', label: '빗나감', value: missRate, color: 'var(--app-coral)', textOn: '#fff' },
  ] as const;
  return (
    <div
      className="mt-2.5 flex h-7 overflow-hidden rounded-[10px] border"
      style={{ borderColor: 'var(--app-line)' }}
      role="img"
      aria-label={`만족도 분포 — 맞춤 ${formatPct(correctRate)}, 부분 ${formatPct(partialRate)}, 빗나감 ${formatPct(missRate)}`}
    >
      {SEGMENTS.map((seg) => {
        const pct = (seg.value / total) * 100;
        if (pct <= 0) return null;
        // segment 안에 텍스트를 넣되, 너무 좁으면(< 12%) 숨겨서 시각 노이즈 방지.
        const showText = pct >= 12;
        return (
          <div
            key={seg.key}
            className="flex h-full items-center justify-center text-[12.1px] font-extrabold tabular-nums"
            style={{
              width: `${pct}%`,
              background: seg.color,
              color: seg.textOn,
              transition: 'width 200ms ease',
            }}
            title={`${seg.label} ${formatPct(seg.value)}`}
          >
            {showText ? formatPct(seg.value) : null}
          </div>
        );
      })}
    </div>
  );
}

const AREA_LABEL: Record<keyof OperationsSnapshot['satisfaction']['areaAverages'], string> = {
  wealth: '💰 재물',
  love: '💖 애정',
  career: '💼 직장',
  health: '🩺 건강',
  relationship: '👥 인간관계',
};

export function OperationsDashboard() {
  const [windowDays, setWindowDays] = useState(14);
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetch(`/api/admin/operations?days=${windowDays}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          setState('error');
          setData({ ok: false, error: '로그인이 필요합니다.' });
          return null;
        }
        return response.ok ? response.json() : null;
      })
      .then((payload: ApiResponse | null) => {
        if (payload === null) {
          setState('error');
          return;
        }
        setData(payload);
        setState(payload.ok ? 'success' : 'error');
      })
      .catch((err: unknown) => {
        if ((err as { name?: string } | null)?.name === 'AbortError') return;
        setState('error');
      });
    return () => controller.abort();
  }, [windowDays]);

  const snap = data?.snapshot;

  // 결제 전환율 = 결제 건수 / DAU.
  const todayConversionRate =
    snap && snap.today.activeUsers > 0
      ? snap.today.purchaseCount / snap.today.activeUsers
      : 0;

  return (
    <section className="space-y-5 px-1">
      {/* §Hero */}
      <article
        className="rounded-[18px] border p-5"
        style={{
          background: 'var(--app-pink-soft)',
          borderColor: 'var(--app-pink-line)',
        }}
      >
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          📊 운영 모니터링
        </div>
        <h1 className="mt-1.5 text-[25.3px] font-extrabold leading-snug text-[var(--app-ink)]">
          핵심 지표 한눈에
        </h1>
        <p
          className="mt-2 text-[13.8px] leading-[1.6] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          오늘 신규/DAU/결제·만족도 평균과 14일 추이를 한 화면에서 점검. KST 자정 단위.
        </p>
      </article>

      {/* §Window selector */}
      <div className="flex flex-wrap gap-1.5">
        {WINDOW_OPTIONS.map((opt) => {
          const isActive = opt.value === windowDays;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWindowDays(opt.value)}
              className="rounded-full border px-3 py-1.5 text-[13.8px] font-bold transition-transform active:scale-95"
              style={{
                background: isActive ? 'var(--app-pink)' : 'white',
                color: isActive ? 'white' : 'var(--app-copy-muted)',
                borderColor: isActive ? 'var(--app-pink)' : 'var(--app-line)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {state === 'loading' ? (
        <article
          className="rounded-[16px] border bg-white p-8 text-center"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="motion-spinner-inline mx-auto" aria-hidden="true" />
          <p className="mt-3 text-[15px] text-[var(--app-copy-muted)]">집계 중...</p>
        </article>
      ) : state === 'error' ? (
        <article
          className="rounded-[16px] border p-5"
          style={{
            background: 'rgba(220,79,79,0.05)',
            borderColor: 'rgba(220,79,79,0.28)',
          }}
        >
          <p className="text-[15px] text-[var(--app-coral)]">
            {data?.error ?? '데이터를 불러오지 못했습니다.'}
          </p>
        </article>
      ) : snap ? (
        <>
          {/* §오늘 (4 카드) */}
          <section className="grid gap-2.5">
            <h2 className="px-1 text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
              오늘 ({snap.generatedAt.slice(0, 10)} · KST 시간대)
            </h2>

            <article
              className="rounded-[16px] border bg-white p-4"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[12.6px] font-bold text-[var(--app-copy-soft)]">
                  🆕 신규 가입
                </div>
                <div className="text-[25.3px] font-extrabold tabular-nums text-[var(--app-pink-strong)]">
                  {formatNum(snap.today.newSignups)}
                </div>
              </div>
              <div className="mt-2.5">
                <Sparkline series={snap.trends.newSignups} color="var(--app-pink)" />
              </div>
            </article>

            <article
              className="rounded-[16px] border bg-white p-4"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[12.6px] font-bold text-[var(--app-copy-soft)]">
                  👥 DAU (활성 사용자)
                </div>
                <div className="text-[25.3px] font-extrabold tabular-nums text-[var(--app-jade)]">
                  {formatNum(snap.today.activeUsers)}
                </div>
              </div>
              <div className="mt-2.5">
                <Sparkline series={snap.trends.activeUsers} color="var(--app-jade)" />
              </div>
              <div className="mt-2 text-[12.1px] text-[var(--app-copy-soft)]">
                readings / 피드백 / 대화 중 1+ 활동 distinct user
              </div>
            </article>

            <article
              className="rounded-[16px] border bg-white p-4"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[12.6px] font-bold text-[var(--app-copy-soft)]">
                  💳 결제 (건수)
                </div>
                <div className="text-[25.3px] font-extrabold tabular-nums text-[var(--app-amber)]">
                  {formatNum(snap.today.purchaseCount)}
                </div>
              </div>
              <div className="mt-2.5">
                <Sparkline series={snap.trends.purchaseCount} color="var(--app-amber)" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[12.1px] text-[var(--app-copy-soft)]">
                <span>
                  결제 재화 합계{' '}
                  <strong className="tabular-nums text-[var(--app-ink)]">
                    {formatNum(snap.today.purchasedCredits)}
                  </strong>
                </span>
                <span>
                  결제 전환율{' '}
                  <strong className="tabular-nums text-[var(--app-ink)]">
                    {formatPct(todayConversionRate)}
                  </strong>
                </span>
              </div>
            </article>

            <article
              className="rounded-[16px] border bg-white p-4"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[12.6px] font-bold text-[var(--app-copy-soft)]">
                  📝 사주 풀이 작성
                </div>
                <div className="text-[25.3px] font-extrabold tabular-nums text-[var(--app-ink)]">
                  {formatNum(snap.today.readingsCreated)}
                </div>
              </div>
              <div className="mt-2.5">
                <Sparkline series={snap.trends.readingsCreated} color="var(--app-ink)" />
              </div>
              <div className="mt-2 text-[12.1px] text-[var(--app-copy-soft)]">
                피드백 수집 {formatNum(snap.today.feedbackCount)}건
              </div>
            </article>
          </section>

          {/* §만족도 ({windowDays}일) */}
          <section
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <h2 className="text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
              😊 만족도 ({snap.windowDays}일 윈도우 · 표본 {formatNum(snap.satisfaction.sampleSize)}건)
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div
                className="rounded-[12px] border p-3"
                style={{
                  background: 'rgba(45,135,88,0.06)',
                  borderColor: 'rgba(45,135,88,0.2)',
                }}
              >
                <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-jade)]">
                  평균 (-1~+1)
                </div>
                <div className="mt-1 text-[23px] font-extrabold tabular-nums text-[var(--app-ink)]">
                  {formatRating(snap.satisfaction.averageRating)}
                </div>
              </div>
              <div
                className="rounded-[12px] border p-3"
                style={{
                  background: 'var(--app-pink-soft)',
                  borderColor: 'var(--app-pink-line)',
                }}
              >
                <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  맞춤 비율
                </div>
                <div className="mt-1 text-[23px] font-extrabold tabular-nums text-[var(--app-ink)]">
                  {formatPct(snap.satisfaction.correctRate)}
                </div>
              </div>
            </div>
            {/* 2026-05-16 E4 — 3 cell grid → stacked horizontal bar.
                각 segment 자체가 비율 폭을 그대로 가져 한 줄에서 분포 직관 파악. */}
            <StackedRateBar
              correctRate={snap.satisfaction.correctRate}
              partialRate={snap.satisfaction.partialRate}
              missRate={snap.satisfaction.missRate}
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.1px] text-[var(--app-copy-soft)]">
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: 'var(--app-jade)' }}
                  aria-hidden="true"
                />
                <span>맞춤 ✓ {formatPct(snap.satisfaction.correctRate)}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: 'var(--app-amber)' }}
                  aria-hidden="true"
                />
                <span>부분 △ {formatPct(snap.satisfaction.partialRate)}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: 'var(--app-coral)' }}
                  aria-hidden="true"
                />
                <span>빗나감 ✗ {formatPct(snap.satisfaction.missRate)}</span>
              </span>
            </div>

            {/* 영역별 별점 평균 */}
            <div className="mt-3 grid gap-1.5">
              <div className="text-[12.1px] font-bold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
                영역별 별점 (1~5)
              </div>
              {(Object.keys(AREA_LABEL) as Array<keyof typeof AREA_LABEL>).map((key) => {
                const value = snap.satisfaction.areaAverages[key];
                const pct = value === null ? 0 : ((value - 1) / 4) * 100;
                return (
                  <div key={key} className="grid grid-cols-[80px_1fr_44px] items-center gap-2">
                    <span className="text-[12.6px] font-bold text-[var(--app-copy-muted)]">
                      {AREA_LABEL[key]}
                    </span>
                    <div
                      className="relative h-2 overflow-hidden rounded-full"
                      style={{ background: 'rgba(0,0,0,0.06)' }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${pct}%`,
                          background:
                            value === null
                              ? 'transparent'
                              : value >= 4
                                ? 'var(--app-jade)'
                                : value >= 3
                                  ? 'var(--app-amber)'
                                  : 'var(--app-coral)',
                        }}
                      />
                    </div>
                    <span className="text-right text-[12.6px] font-extrabold tabular-nums text-[var(--app-ink)]">
                      {value === null ? '—' : value.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* §누적 */}
          <section
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <h2 className="text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
              📈 누적 (Lifetime)
            </h2>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[12.6px] text-[var(--app-copy-soft)]">총 가입자</div>
                <div className="mt-0.5 text-[20.7px] font-extrabold tabular-nums text-[var(--app-ink)]">
                  {formatNum(snap.lifetime.totalUsers)}
                </div>
              </div>
              <div>
                <div className="text-[12.6px] text-[var(--app-copy-soft)]">활성 구독자</div>
                <div className="mt-0.5 text-[20.7px] font-extrabold tabular-nums text-[var(--app-pink-strong)]">
                  {formatNum(snap.lifetime.activeSubscribers)}
                </div>
              </div>
              <div>
                <div className="text-[12.6px] text-[var(--app-copy-soft)]">누적 사주 풀이</div>
                <div className="mt-0.5 text-[20.7px] font-extrabold tabular-nums text-[var(--app-jade)]">
                  {formatNum(snap.lifetime.totalReadings)}
                </div>
              </div>
              <div>
                <div className="text-[12.6px] text-[var(--app-copy-soft)]">누적 결제 건수</div>
                <div className="mt-0.5 text-[20.7px] font-extrabold tabular-nums text-[var(--app-amber)]">
                  {formatNum(snap.lifetime.totalPurchases)}
                </div>
              </div>
            </div>
            <div
              className="mt-3 rounded-[10px] px-3 py-2 text-[12.6px] text-[var(--app-copy)]"
              style={{ background: 'rgba(0,0,0,0.025)' }}
            >
              누적 충전 재화 합계{' '}
              <strong className="tabular-nums text-[var(--app-ink)]">
                {formatNum(snap.lifetime.totalPurchasedCredits)}
              </strong>{' '}
              · 풀이당 결제 전환{' '}
              <strong className="tabular-nums text-[var(--app-ink)]">
                {snap.lifetime.totalReadings > 0
                  ? formatPct(snap.lifetime.totalPurchases / snap.lifetime.totalReadings)
                  : '—'}
              </strong>
            </div>
          </section>

          {/* §Methodology */}
          <article
            className="rounded-[14px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              📚 산출 방식
            </div>
            <ul
              className="mt-1.5 grid gap-1 text-[12.6px] leading-[1.65] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              <li>• 신규: credit_transactions.type=&apos;signup_bonus&apos; 일별 count</li>
              <li>• DAU: readings + today_fortune_feedback + dialogue_messages 의 distinct user</li>
              <li>• 결제: credit_transactions.type=&apos;purchase&apos; AND amount &gt; 0</li>
              <li>• 만족도: overall_rating ∈ {'{-1, 0, +1}'}, area_rating ∈ [1, 5]</li>
              <li>• 결제 전환율 = 오늘 결제 건수 ÷ 오늘 DAU</li>
              <li>• KST(UTC+9) 자정 단위 일별 집계</li>
            </ul>
          </article>
        </>
      ) : null}
    </section>
  );
}
