// 2026-05-16 — 결제 funnel 클라이언트 대시보드 (B1).
// /api/admin/payment-funnel 에서 데이터 fetch + 단계 시각화.
'use client';

import { useEffect, useState } from 'react';
import type {
  PaymentFunnelDailyPoint,
  PaymentFunnelSnapshot,
} from '@/lib/admin/payment-funnel-stats';

interface ApiResponse {
  ok: boolean;
  snapshot?: PaymentFunnelSnapshot;
  error?: string;
}

const WINDOW_OPTIONS = [
  { value: 7, label: '7일' },
  { value: 14, label: '14일' },
  { value: 30, label: '30일' },
  { value: 60, label: '60일' },
];

const STAGE_LABEL = {
  prepare_attempt: 'prepare 진입',
  prepare_blocked: 'prepare 차단',
  prepare_ready: 'prepare 준비 완료',
  confirm_attempt: 'confirm 진입',
  confirm_success: '결제 성공',
  confirm_failed: '결제 실패',
} as const;

const BLOCK_REASON_LABEL: Record<string, string> = {
  unauthenticated: '미로그인',
  active_subscription: '이미 활성 멤버십',
  existing_entitlement: '이미 권한 보유',
  existing_credit_unlock: '이미 코인 잠금 해제',
};

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

/** 일별 trend 막대 그래프 (stage 별 1줄). 인라인 SVG. */
function Sparkline({ daily, stage, color }: { daily: PaymentFunnelDailyPoint[]; stage: keyof typeof STAGE_LABEL; color: string }) {
  if (daily.length === 0) return null;
  const values = daily.map((d) => d.counts[stage]);
  const max = Math.max(...values, 1);
  const width = 160;
  const height = 36;
  const stepX = daily.length > 1 ? width / (daily.length - 1) : width;
  const points = daily
    .map((d, i) => {
      const x = i * stepX;
      const y = height - (d.counts[stage] / max) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastVal = values[values.length - 1] ?? 0;
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div className="flex items-end gap-2">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        aria-hidden="true"
      >
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
      <div className="flex flex-col text-[9.5px] leading-tight text-[var(--app-copy-soft)]">
        <span>오늘 {fmtNum(lastVal)}</span>
        <span>합 {fmtNum(total)}</span>
      </div>
    </div>
  );
}

const STAGE_COLOR: Record<keyof typeof STAGE_LABEL, string> = {
  prepare_attempt: 'var(--app-pink)',
  prepare_blocked: 'var(--app-copy-soft)',
  prepare_ready: 'var(--app-indigo)',
  confirm_attempt: 'var(--app-amber)',
  confirm_success: 'var(--app-jade)',
  confirm_failed: 'var(--app-coral)',
};

const STAGE_ORDER: Array<keyof typeof STAGE_LABEL> = [
  'prepare_attempt',
  'prepare_blocked',
  'prepare_ready',
  'confirm_attempt',
  'confirm_success',
  'confirm_failed',
];

export function PaymentFunnelDashboard() {
  const [windowDays, setWindowDays] = useState(14);
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetch(`/api/admin/payment-funnel?days=${windowDays}`, { signal: controller.signal })
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
        <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          💳 결제 Funnel
        </div>
        <h1 className="mt-1.5 text-[22px] font-extrabold leading-snug text-[var(--app-ink)]">
          /credits → prepare → confirm
        </h1>
        <p
          className="mt-2 text-[12px] leading-[1.6] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          단계별 진입·차단·전환·실패 추세와 reason / 패키지 별 전환율을 봅니다. KST 기준.
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
              className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-transform active:scale-95"
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
          <p className="mt-3 text-[13px] text-[var(--app-copy-muted)]">집계 중...</p>
        </article>
      ) : state === 'error' ? (
        <article
          className="rounded-[16px] border p-5"
          style={{
            background: 'rgba(220,79,79,0.05)',
            borderColor: 'rgba(220,79,79,0.28)',
          }}
        >
          <p className="text-[13px] text-[var(--app-coral)]">
            {data?.error ?? '데이터를 불러오지 못했습니다.'}
          </p>
        </article>
      ) : snap ? (
        <>
          {/* §전환율 4 카드 */}
          <section>
            <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
              전환율 ({snap.windowDays}일)
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <article
                className="rounded-[14px] border bg-white p-3.5"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
                  전체 전환
                </div>
                <div className="mt-1 text-[20px] font-extrabold tabular-nums leading-none text-[var(--app-jade)]">
                  {fmtPct(snap.totals.overallConversionRate)}
                </div>
                <div className="mt-1 text-[10.5px] text-[var(--app-copy-soft)]">
                  prepare → 결제 성공
                </div>
              </article>
              <article
                className="rounded-[14px] border bg-white p-3.5"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
                  confirm 성공률
                </div>
                <div className="mt-1 text-[20px] font-extrabold tabular-nums leading-none text-[var(--app-ink)]">
                  {fmtPct(snap.totals.confirmSuccessRate)}
                </div>
                <div className="mt-1 text-[10.5px] text-[var(--app-copy-soft)]">
                  confirm 진입 중 성공
                </div>
              </article>
              <article
                className="rounded-[14px] border bg-white p-3.5"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
                  prepare 차단율
                </div>
                <div className="mt-1 text-[20px] font-extrabold tabular-nums leading-none text-[var(--app-copy-muted)]">
                  {fmtPct(snap.totals.prepareBlockRate)}
                </div>
                <div className="mt-1 text-[10.5px] text-[var(--app-copy-soft)]">
                  미로그인·중복 구매 등
                </div>
              </article>
              <article
                className="rounded-[14px] border bg-white p-3.5"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
                  confirm 실패율
                </div>
                <div className="mt-1 text-[20px] font-extrabold tabular-nums leading-none text-[var(--app-coral)]">
                  {fmtPct(snap.totals.confirmFailRate)}
                </div>
                <div className="mt-1 text-[10.5px] text-[var(--app-copy-soft)]">
                  토스 승인 또는 후속 실패
                </div>
              </article>
            </div>
          </section>

          {/* §단계별 카드 + sparkline */}
          <section>
            <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
              단계별 추세
            </h2>
            <div className="mt-2 grid gap-2">
              {STAGE_ORDER.map((stage) => (
                <article
                  key={stage}
                  className="rounded-[14px] border bg-white p-3.5"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[12px] font-bold text-[var(--app-copy)]">
                      {STAGE_LABEL[stage]}
                    </div>
                    <div
                      className="text-[18px] font-extrabold tabular-nums"
                      style={{ color: STAGE_COLOR[stage] }}
                    >
                      {fmtNum(snap.totals.counts[stage])}
                    </div>
                  </div>
                  <div className="mt-2">
                    <Sparkline daily={snap.daily} stage={stage} color={STAGE_COLOR[stage]} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* §차단/실패 사유 breakdown */}
          {(snap.blockedReasons.length > 0 || snap.failedReasons.length > 0) ? (
            <section className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {snap.blockedReasons.length > 0 ? (
                <article
                  className="rounded-[14px] border bg-white p-4"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
                    prepare 차단 사유
                  </div>
                  <ul className="mt-2 grid gap-1.5">
                    {snap.blockedReasons.map((r) => (
                      <li
                        key={r.reason}
                        className="flex items-center justify-between text-[12px]"
                      >
                        <span className="text-[var(--app-copy)]">
                          {BLOCK_REASON_LABEL[r.reason] ?? r.reason}
                        </span>
                        <span className="font-extrabold tabular-nums text-[var(--app-ink)]">
                          {fmtNum(r.count)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              ) : null}
              {snap.failedReasons.length > 0 ? (
                <article
                  className="rounded-[14px] border bg-white p-4"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
                    confirm 실패 사유
                  </div>
                  <ul className="mt-2 grid gap-1.5">
                    {snap.failedReasons.map((r) => (
                      <li
                        key={r.reason}
                        className="flex items-center justify-between text-[12px]"
                      >
                        <span className="text-[var(--app-copy)]">{r.reason}</span>
                        <span className="font-extrabold tabular-nums text-[var(--app-coral)]">
                          {fmtNum(r.count)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              ) : null}
            </section>
          ) : null}

          {/* §패키지 별 전환 */}
          {snap.byPackage.length > 0 ? (
            <section>
              <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
                패키지 별 전환
              </h2>
              <div className="mt-2 grid gap-1.5">
                {snap.byPackage.map((p) => (
                  <article
                    key={p.packageId}
                    className="rounded-[12px] border bg-white p-3 text-[12px]"
                    style={{ borderColor: 'var(--app-line)' }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-extrabold text-[var(--app-ink)]">{p.packageId}</span>
                      <span className="tabular-nums text-[var(--app-copy-muted)]">
                        {fmtNum(p.prepareAttempt)} → {fmtNum(p.confirmSuccess)}
                      </span>
                      <span
                        className="tabular-nums font-extrabold"
                        style={{ color: 'var(--app-jade)' }}
                      >
                        {fmtPct(p.conversionRate)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <article
            className="rounded-[14px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              📚 산출 방식
            </div>
            <ul
              className="mt-1.5 grid gap-1 text-[11px] leading-[1.65] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              <li>• 데이터: `payment_funnel_events` 테이블 (PR B1 신설)</li>
              <li>• prepare 단계: POST /api/payments/prepare 진입 / 차단 / 준비 완료</li>
              <li>• confirm 단계: POST /api/payments/confirm 진입 / 성공 / 실패</li>
              <li>• 전체 전환 = confirm_success / prepare_attempt</li>
              <li>• KST(UTC+9) 자정 기준 일별 집계 · best-effort 로깅</li>
            </ul>
          </article>
        </>
      ) : null}
    </section>
  );
}
