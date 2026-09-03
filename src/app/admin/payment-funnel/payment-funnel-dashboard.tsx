// 2026-05-16 — 결제 funnel 클라이언트 대시보드 (B1).
// /api/admin/payment-funnel 에서 데이터 fetch + 단계 시각화.
'use client';

import { useEffect, useState } from 'react';
import type {
  PaymentFunnelDailyPoint,
  PaymentFunnelSnapshot,
} from '@/lib/admin/payment-funnel-stats';
import { AdminPeriodPicker } from '@/components/admin/admin-period-picker';
import { resolveAdminPeriod } from '@/lib/admin/metric-periods';
import { getPackage } from '@/lib/payments/catalog';

interface ApiResponse {
  ok: boolean;
  snapshot?: PaymentFunnelSnapshot;
  error?: string;
}

const STAGE_LABEL = {
  paywall_viewed: '페이월 노출',
  checkout_viewed: '결제화면 도달',
  login_required: '로그인 벽',
  login_returned: '로그인 후 복귀',
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
  existing_credit_unlock: '이미 전 잠금 해제',
};

// 분모 없음(null)은 0%가 아니라 '—' — 시도 0건을 '전환 0.0%'로 오표시하지 않는다.
function fmtPct(value: number | null): string {
  return value == null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function fmtWon(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

/** 일별 trend 막대 그래프 (stage 별 1줄). 인라인 SVG. */
function Sparkline({ daily, stage, color }: { daily: PaymentFunnelDailyPoint[]; stage: keyof typeof STAGE_LABEL; color: string }) {
  if (daily.length === 0) return null;
  const values = daily.map((d) => d.counts[stage]);
  const max = Math.max(...values, 1);
  // 2026-06-28 — 풀폭 반응형(viewBox 0~100 + preserveAspectRatio="none" + non-scaling stroke).
  const vbWidth = 100;
  const height = 36;
  const stepX = daily.length > 1 ? vbWidth / (daily.length - 1) : vbWidth;
  const points = daily
    .map((d, i) => {
      const x = i * stepX;
      const y = height - (d.counts[stage] / max) * (height - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastVal = values[values.length - 1] ?? 0;
  const total = values.reduce((a, b) => a + b, 0);
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
      <div className="flex shrink-0 flex-col text-[11px] leading-tight text-[var(--app-copy-soft)]">
        <span>오늘 {fmtNum(lastVal)}</span>
        <span>합 {fmtNum(total)}</span>
      </div>
    </div>
  );
}

const STAGE_COLOR: Record<keyof typeof STAGE_LABEL, string> = {
  paywall_viewed: 'var(--app-copy-muted)',
  checkout_viewed: 'var(--app-gold)',
  login_required: 'var(--app-coral)',
  login_returned: 'var(--app-jade)',
  prepare_attempt: 'var(--app-pink)',
  prepare_blocked: 'var(--app-copy-soft)',
  prepare_ready: 'var(--app-indigo)',
  confirm_attempt: 'var(--app-amber)',
  confirm_success: 'var(--app-jade)',
  confirm_failed: 'var(--app-coral)',
};

// 사용자가 실제로 지나가는 순서. 이 순서가 곧 "어디서 죽는지"를 읽는 순서다.
const STAGE_ORDER: Array<keyof typeof STAGE_LABEL> = [
  'paywall_viewed',
  'checkout_viewed',
  'login_required',
  'login_returned',
  'prepare_attempt',
  'prepare_blocked',
  'prepare_ready',
  'confirm_attempt',
  'confirm_success',
  'confirm_failed',
];


/**
 * 2026-08-26 — 유입 채널 × 상품 결제 교차표(사용자 지시: "GA4 말고 자체 퍼널 강화").
 * 정확한 값을 읽는 표라 차트가 아니라 표로 둔다. 크기는 셀 농담으로 거들되,
 * 숫자를 항상 같이 적어 색만으로 정보를 전달하지 않는다.
 */
/**
 * 2026-08-27 사용자 지시 — "결제된 것만 보여주면 안 될 것 같다".
 *   이 화면의 돈은 여태 payment_funnel_events(confirm_success)만 봤다. 환불은 그 테이블에
 *   **아예 없다**(payment_orders.status='refunded') — 그래서 판 돈만 보이고 돌려준 돈은
 *   어디에도 안 나왔다. 아래 '유입 채널 × 상품 결제' 합계도 같은 이유로 gross 다.
 *
 *   ⚠️ 두 숫자의 귀속일이 다르다 — 결제는 **판 날**, 환불은 **환불한 날**(#641 설계).
 *      예전에 판 것을 오늘 환불하면 이 기간 순액이 그만큼 더 깎여 보인다. 귀속을 원 결제일로
 *      바꾸면 이미 마감된 과거 매출이 사후에 변하므로, 숫자를 고치지 않고 그 금액을 따로
 *      적어 **화면이 그 사실을 말하게** 한다(refund-breakdown.ts 와 같은 규칙).
 */
function MoneySection({ snap }: { snap: PaymentFunnelSnapshot }) {
  const gross = snap.grossAmountWon;
  const refunded = snap.refunds.totalWon;
  const net = gross - refunded;
  const outside = snap.refunds.outsideWindowWon;
  const items = snap.refunds.items;
  const SHOWN = 8;

  // 2026-08-27 — 카드 3장을 띄우면 셋이 남남으로 보인다. 결제액·환불액·순액은
  //   **같은 계산의 항들**이라 한 덩어리를 선으로 나눈다. 결론 칸(순액)에만 인주 바.
  const card = 'flex-1 p-3';
  const cardStyle = { borderColor: 'var(--app-line)' } as const;
  const label = 'text-[11px] font-semibold text-[var(--app-copy-soft)]';
  const value = 'mt-0.5 text-[22px] font-extrabold tabular-nums';

  return (
    <section>
      <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
        결제액 · 환불액
      </h2>
      <div
        className="mt-2 flex flex-col overflow-hidden rounded-[10px] border bg-white sm:flex-row"
        style={cardStyle}
      >
        <article className={`${card} border-b sm:border-b-0 sm:border-r`} style={cardStyle}>
          <p className={label}>결제액 (기간)</p>
          <p className={`${value} text-[var(--app-ink)]`}>{fmtWon(gross)}</p>
          <p className="text-[11px] text-[var(--app-copy-muted)]">
            결제 성공 {fmtNum(snap.totals.counts.confirm_success)}건 · 나중에 환불된 주문도 포함
          </p>
        </article>
        <article className={`${card} border-b sm:border-b-0 sm:border-r`} style={cardStyle}>
          <p className={label}>환불액 (기간)</p>
          <p className={`${value} ${refunded > 0 ? 'text-[var(--app-coral)]' : 'text-[var(--app-ink)]'}`}>
            {refunded > 0 ? `-${fmtWon(refunded)}` : fmtWon(0)}
          </p>
          <p className="text-[11px] text-[var(--app-copy-muted)]">
            {fmtNum(items.length + snap.refunds.truncated)}건 · 환불한 날 기준
          </p>
        </article>
        <article
          className={card}
          style={{ ...cardStyle, background: 'var(--app-pink-soft)', boxShadow: 'inset 2px 0 0 var(--app-pink)' }}
        >
          <p className={label}>순액</p>
          <p className={`${value} ${net < 0 ? 'text-[var(--app-coral)]' : 'text-[var(--app-ink)]'}`}>
            {fmtWon(net)}
          </p>
          <p className="text-[11px] text-[var(--app-copy-muted)]">결제액 − 환불액</p>
        </article>
      </div>

      {outside > 0 ? (
        <p
          className="mt-1.5 px-1 text-[11.5px] leading-[1.6] text-[var(--app-copy-soft)]"
          style={{ wordBreak: 'keep-all' }}
        >
          이 중 <strong className="font-extrabold text-[var(--app-coral)]">{fmtWon(outside)}</strong>{' '}
          은 원 결제가 이 기간 <strong className="font-extrabold text-[var(--app-ink)]">밖</strong>인
          환불입니다 — 위 결제액에 대응 금액이 없어 순액만 그만큼 눌립니다(기간을 넓히면 짝이
          맞습니다).
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-2 overflow-hidden rounded-[12px] border" style={cardStyle}>
          {items.slice(0, SHOWN).map((item, i) => (
            <div
              key={`${item.orderId}-${i}`}
              className={`flex items-baseline justify-between gap-3 bg-white px-3 py-2 text-[13px] ${
                i > 0 ? 'border-t border-[var(--app-line)]' : ''
              }`}
            >
              <span className="min-w-0 truncate font-semibold text-[var(--app-ink)]">
                {item.productName}
              </span>
              <span className="shrink-0 tabular-nums text-[var(--app-copy-muted)]">
                {item.refundedOn}
                {item.paidInWindow ? '' : ` · 원 결제 ${item.paidOn ?? '미상'}`}
                <strong className="ml-2 font-extrabold text-[var(--app-coral)]">
                  -{fmtWon(item.amountWon)}
                </strong>
              </span>
            </div>
          ))}
          {items.length > SHOWN || snap.refunds.truncated > 0 ? (
            <div className="border-t border-[var(--app-line)] bg-white px-3 py-2 text-[11.5px] text-[var(--app-copy-muted)]">
              외 {fmtNum(items.length - SHOWN + snap.refunds.truncated)}건 — 전체 내역은{' '}
              <a className="font-bold underline" href="/admin/analytics">
                /admin/analytics
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ChannelProductTable({ matrix }: { matrix: PaymentFunnelSnapshot['channelProduct'] }) {
  if (!matrix || matrix.totalOrders === 0) return null;

  const cellMap = new Map(matrix.cells.map((c) => [`${c.channel} ${c.packageId}`, c]));
  const maxOrders = Math.max(...matrix.cells.map((c) => c.orders), 1);
  const th = 'px-2.5 py-2 text-right font-bold whitespace-nowrap';
  const td = 'px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap';
  const productName = (id: string) => getPackage(id)?.name ?? id;

  return (
    <section>
      <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
        유입 채널 × 상품 결제
      </h2>
      <p
        className="mt-1 px-1 text-[11px] leading-[1.6] text-[var(--app-copy-soft)]"
        style={{ wordBreak: 'keep-all' }}
      >
        어느 경로로 들어온 사람이 무엇을 샀는지. 채널은 결제자의{' '}
        <strong className="font-extrabold text-[var(--app-ink)]">최초 방문</strong> 기준이며, 링크에
        utm 을 붙인 만큼만 갈립니다(안 붙이면 인포크링크·직접 유입으로 뭉칩니다).
        {matrix.foldedChannels > 0 || matrix.foldedPackages > 0 ? (
          <>
            {' '}
            상위 항목만 표시 — 채널 {matrix.foldedChannels}개 · 상품 {matrix.foldedPackages}개는
            &lsquo;기타&rsquo;로 접혔습니다(합계는 그대로).
          </>
        ) : null}
      </p>
      <div className="mt-2 overflow-x-auto rounded-[12px] border border-[var(--app-line)] bg-white">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-[var(--app-pink-soft)] text-[var(--app-ink)]">
            <tr>
              <th className={`${th} text-left`}>채널</th>
              {matrix.packages.map((pkg) => (
                <th key={pkg} className={th} title={pkg}>
                  {productName(pkg)}
                </th>
              ))}
              <th className={th}>합계</th>
            </tr>
          </thead>
          <tbody>
            {matrix.channels.map((channel, rowIndex) => {
              const rowTotal = matrix.channelTotals[rowIndex];
              return (
                <tr key={channel} className="border-t border-[var(--app-line)]">
                  <td className={`${td} text-left font-semibold text-[var(--app-ink)]`}>{channel}</td>
                  {matrix.packages.map((pkg) => {
                    const cell = cellMap.get(`${channel} ${pkg}`);
                    const orders = cell?.orders ?? 0;
                    return (
                      <td
                        key={pkg}
                        className={td}
                        title={orders > 0 ? `${productName(pkg)} · ${fmtWon(cell?.amountWon ?? 0)}` : undefined}
                        style={{
                          background:
                            orders > 0
                              ? `rgba(179,55,42,${(0.06 + 0.34 * (orders / maxOrders)).toFixed(3)})`
                              : undefined,
                        }}
                      >
                        {orders > 0 ? fmtNum(orders) : '—'}
                      </td>
                    );
                  })}
                  <td className={`${td} font-extrabold text-[var(--app-ink)]`}>
                    {fmtNum(rowTotal?.orders ?? 0)}
                    <span className="ml-1 font-semibold text-[var(--app-copy-soft)]">
                      {fmtWon(rowTotal?.amountWon ?? 0)}
                    </span>
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-[var(--app-ink)]">
              <td className={`${td} text-left font-extrabold text-[var(--app-ink)]`}>합계</td>
              {matrix.packages.map((pkg, colIndex) => {
                const colTotal = matrix.packageTotals[colIndex];
                return (
                  <td key={pkg} className={`${td} font-bold text-[var(--app-ink)]`}>
                    {fmtNum(colTotal?.orders ?? 0)}
                  </td>
                );
              })}
              <td className={`${td} font-extrabold text-[var(--app-ink)]`}>
                {fmtNum(matrix.totalOrders)}
                <span className="ml-1 font-semibold text-[var(--app-copy-soft)]">
                  {fmtWon(matrix.totalAmountWon)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PaymentFunnelDashboard() {
  // 2026-09-01 — 롤링 일수 → 달력 기간. 기본은 오늘 하루(/admin 과 같은 기본값).
  const [period, setPeriod] = useState(() => resolveAdminPeriod('day', undefined));
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetch(
      `/api/admin/payment-funnel?unit=${period.unit}&period=${encodeURIComponent(period.anchor)}`,
      { signal: controller.signal }
    )
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
  }, [period]);

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
        {/* 2026-07-04 — 코인충전(/credits) 표기는 폐지된 상품 기준이라 현행(멤버십·단건)으로 정정. */}
        <h1 className="mt-1.5 text-[20px] font-extrabold leading-snug text-[var(--app-ink)]">
          상품 결제 prepare → confirm
        </h1>
        <p
          className="mt-2 text-[13px] leading-[1.6] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          단계별 진입·차단·전환·실패 추세와 reason / 패키지 별 전환율을 봅니다. KST 시간대.
        </p>
      </article>

      {/* §Window selector — 2026-09-01 달력 기간(일·주(월~일)·월·분기·년) 공용 정본. */}
      <AdminPeriodPicker period={period} onChange={setPeriod} />

      {state === 'loading' ? (
        <article
          className="rounded-[16px] border bg-white p-8 text-center"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="motion-spinner-inline mx-auto" aria-hidden="true" />
          <p className="mt-3 text-[14px] text-[var(--app-copy-muted)]">집계 중...</p>
        </article>
      ) : state === 'error' ? (
        <article
          className="rounded-[16px] border p-5"
          style={{
            background: 'rgba(220,79,79,0.05)',
            borderColor: 'rgba(220,79,79,0.28)',
          }}
        >
          <p className="text-[14px] text-[var(--app-coral)]">
            {data?.error ?? '데이터를 불러오지 못했습니다.'}
          </p>
        </article>
      ) : snap ? (
        <>
          {/* 2026-08-26 사용자 지시 — '결제자 유입 채널'을 최상단으로. 돈이 어디서
              들어오는지가 이 화면에서 가장 먼저 봐야 할 숫자다. */}
          {snap.payerChannelCoverage.total > 0 ? (
            <section>
              <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
                결제자 유입 채널 (사이트 밖)
              </h2>
              <p className="mt-1 px-1 text-[11px] leading-[1.6] text-[var(--app-copy-soft)]">
                결제자 {fmtNum(snap.payerChannelCoverage.total)}명 중{' '}
                {fmtNum(snap.payerChannelCoverage.matched)}명만 채널이 확인됩니다 — 첫 방문이
                비로그인이면 그 방문 기록에 계정이 안 붙어 조인되지 않습니다.
              </p>
              <div className="mt-2 grid gap-1.5">
                {snap.payerChannels.length > 0 ? (
                  snap.payerChannels.map((c) => (
                    <article
                      key={c.channel}
                      className="rounded-[12px] border bg-white p-3 text-[13px]"
                      style={{ borderColor: 'var(--app-line)' }}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-extrabold text-[var(--app-ink)]">{c.channel}</span>
                        <span className="tabular-nums text-[var(--app-copy-muted)]">
                          결제자 {fmtNum(c.payers)}명
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="px-1 text-[13px] text-[var(--app-copy-muted)]">
                    조인된 방문 기록이 없습니다.
                  </p>
                )}
              </div>
            </section>
          ) : null}

          <MoneySection snap={snap} />

          <ChannelProductTable matrix={snap.channelProduct} />

          {/* §전환율 4 카드 */}
          <section>
            <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
              전환율 ({period.label})
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <article
                className="rounded-[14px] border bg-white p-3.5"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
                  전체 전환
                </div>
                <div className="mt-1 text-[22px] font-extrabold tabular-nums leading-none text-[var(--app-jade)]">
                  {fmtPct(snap.totals.overallConversionRate)}
                </div>
                <div className="mt-1 text-[11.5px] text-[var(--app-copy-soft)]">
                  prepare → 결제 성공
                </div>
              </article>
              <article
                className="rounded-[14px] border bg-white p-3.5"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
                  confirm 성공률
                </div>
                <div className="mt-1 text-[22px] font-extrabold tabular-nums leading-none text-[var(--app-ink)]">
                  {fmtPct(snap.totals.confirmSuccessRate)}
                </div>
                <div className="mt-1 text-[11.5px] text-[var(--app-copy-soft)]">
                  confirm 진입 중 성공
                </div>
              </article>
              <article
                className="rounded-[14px] border bg-white p-3.5"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
                  prepare 차단율
                </div>
                <div className="mt-1 text-[22px] font-extrabold tabular-nums leading-none text-[var(--app-copy-muted)]">
                  {fmtPct(snap.totals.prepareBlockRate)}
                </div>
                <div className="mt-1 text-[11.5px] text-[var(--app-copy-soft)]">
                  미로그인·중복 구매 등
                </div>
              </article>
              <article
                className="rounded-[14px] border bg-white p-3.5"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
                  confirm 실패율
                </div>
                <div className="mt-1 text-[22px] font-extrabold tabular-nums leading-none text-[var(--app-coral)]">
                  {fmtPct(snap.totals.confirmFailRate)}
                </div>
                <div className="mt-1 text-[11.5px] text-[var(--app-copy-soft)]">
                  결제 승인 또는 후속 실패
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
                    <div className="text-[13px] font-bold text-[var(--app-copy)]">
                      {STAGE_LABEL[stage]}
                    </div>
                    <div
                      className="text-[22px] font-extrabold tabular-nums"
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
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
                    prepare 차단 사유
                  </div>
                  <ul className="mt-2 grid gap-1.5">
                    {snap.blockedReasons.map((r) => (
                      <li
                        key={r.reason}
                        className="flex items-center justify-between text-[13px]"
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
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
                    confirm 실패 사유
                  </div>
                  <ul className="mt-2 grid gap-1.5">
                    {snap.failedReasons.map((r) => (
                      <li
                        key={r.reason}
                        className="flex items-center justify-between text-[13px]"
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
                    className="rounded-[12px] border bg-white p-3 text-[13px]"
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

          {/* 2026-08-26 — '어디서 들어와 뭘 보고 결제했나'. 계측은 2026-05-16 부터 metadata 에
              쌓이고 있었는데 집계기가 metadata 를 아예 안 읽어 화면이 없었다. */}
          {snap.byEntry.length > 0 ? (
            <section>
              <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
                진입점 별 전환 (사이트 안)
              </h2>
              <p className="mt-1 px-1 text-[11px] leading-[1.6] text-[var(--app-copy-soft)]">
                결제창으로 넘어온 화면. `(미지정)` = 결제 요청에 진입점이 없었고 주문 원장에도
                안 남은 건(구 링크·수동 정산분).
              </p>
              <div className="mt-2 grid gap-1.5">
                {snap.byEntry.map((e) => (
                  <article
                    key={e.entry}
                    className="rounded-[12px] border bg-white p-3 text-[13px]"
                    style={{ borderColor: 'var(--app-line)' }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-extrabold text-[var(--app-ink)]">{e.entry}</span>
                      <span className="tabular-nums text-[var(--app-copy-muted)]">
                        {fmtNum(e.prepareAttempt)} → {fmtNum(e.confirmSuccess)}
                      </span>
                      <span
                        className="tabular-nums font-extrabold"
                        style={{ color: 'var(--app-jade)' }}
                      >
                        {fmtPct(e.conversionRate)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {snap.paywallSurfaces.length > 0 ? (
            <section>
              <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
                뭘 보고 결제했나 — 페이월 노출 화면
              </h2>
              <div className="mt-2 grid gap-1.5">
                {snap.paywallSurfaces.map((s) => (
                  <article
                    key={s.surface}
                    className="rounded-[12px] border bg-white p-3 text-[13px]"
                    style={{ borderColor: 'var(--app-line)' }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-extrabold text-[var(--app-ink)]">{s.surface}</span>
                      <span className="tabular-nums text-[var(--app-copy-muted)]">
                        노출 {fmtNum(s.views)}
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
            <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              📚 산출 방식
            </div>
            <ul
              className="mt-1.5 grid gap-1 text-[11px] leading-[1.65] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              <li>• 데이터: `payment_funnel_events` 테이블 (PR B1 신설)</li>
              {/* audit-mockup: intentional — 퍼널 **단계 이름**이지 사용자 안내 문구가 아니다.
                  감사 스크립트가 "로그인 후"로 시작하는 하드코딩 안내를 찾는데, 여기 셋은
                  payment_funnel_events 의 stage 라벨(migration 077)이라 분기 대상이 아니다. */}
              <li>
                • 2026-09-03 앞 칸 추가: 페이월 노출 → <b>결제화면 도달</b> → <b>로그인 벽</b> →{' '}
                {/* audit-mockup: intentional */}
                <b>로그인 후 복귀</b> → prepare. 그전엔 prepare 부터라 &ldquo;결제화면까지 왔나&rdquo;와
                &ldquo;로그인에서 튕겼나&rdquo;를 구분할 수 없었다
              </li>
              <li>
                • <b>로그인 벽 손실 = 로그인 벽 − 로그인 후 복귀.</b> 결제 의사를 밝히고 로그인
                화면으로 갔다가 돌아오지 않은 사람 수다
              </li>
              <li>
                • 결제화면 도달은 <b>사람 수가 아니라 렌더 수</b>다(새로고침·뒤로가기·결제 실패
                복귀가 각각 1행). 게이트 화면으로 도달한 경우는 `metadata.blocked` 에 사유가 남는다
              </li>
              <li>• prepare 단계: POST /api/payments/prepare 진입 / 차단 / 준비 완료</li>
              <li>• confirm 단계: POST /api/payments/confirm 진입 / 성공 / 실패</li>
              <li>• 전체 전환 = confirm_success / prepare_attempt</li>
              <li>
                • 진입점 = `metadata.from`, 없으면 `payment_orders.entry_source` 를 `order_id` 로
                조인해 보강 (confirm 계열 3경로는 from 을 안 싣는다)
              </li>
              <li>• 페이월 노출 화면 = `paywall_viewed.metadata.surface`</li>
              <li>• 유입 채널 = `site_visits` 를 `user_id` 로 조인, 사용자별 최초 방문 행의
                utm_source → referrer_host → &lsquo;직접 유입&rsquo; 순</li>
              <li>• KST(UTC+9) 자정 단위 일별 집계 · best-effort 로깅</li>
            </ul>
          </article>
        </>
      ) : null}
    </section>
  );
}
