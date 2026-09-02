// 2026-06-28 — 관리자 콘솔 랜딩 대시보드(/admin). 관리자 콘솔 2/2.
//   기존 스냅샷(운영·결제퍼널·LLM) 통합 KPI + 대기 작업 + 최근 활동 + 기간 토글 + 날짜별 표.
//   진입점이 없던 문제(G1) 해결.
// 2026-09-01 — 카드마다 <Suspense>. 집계는 getAdminDashboardParts 가 돌려주는 '약속'을
//   그대로 받아 카드별로 기다린다(쿼리 수는 그대로, 첫 픽셀만 앞당긴다).
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import {
  getAdminDashboardParts,
  type AdminAnalyticsPart,
  type AdminDashboardParts,
} from '@/lib/admin/dashboard-summary';
import { getKakaoFriendCouponStats } from '@/lib/admin/coupon-stats';
import { getLlmQuotaAlert } from '@/lib/admin/llm-quota-alert';
import { LlmQuotaBanner } from '@/components/admin/llm-quota-banner';
import { MetricsPeriodTable } from '@/components/admin/metrics-period-table';
import { VISIT_TRACKING_START_KEY } from '@/lib/admin/analytics-rollup';
import type { DailySeries, OperationsSnapshot } from '@/lib/admin/operations-stats';
import {
  ADMIN_PERIOD_UNITS,
  type AdminPeriod,
  adminPeriodChoices,
  kstTodayKey,
  resolveAdminPeriod,
  shiftAdminPeriod,
} from '@/lib/admin/metric-periods';

export const metadata: Metadata = {
  title: '관리자 콘솔',
  robots: { index: false, follow: false },
};

const fmtNum = (n: number | null | undefined) => (n ?? 0).toLocaleString('ko-KR');
const fmtMaybeNum = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('ko-KR'));
// 2026-07-04 — 반올림 대신 소수 1자리: 0.5% 미만 전환율이 전부 '0%'로 보이던 문제.
// 2026-07-21 — 분모 없음(null)은 0%가 아니라 '—'. 시도 0건을 '전환 0.0%'로 오표시하던 문제.
const fmtPct = (rate: number | null | undefined) =>
  rate == null ? '—' : `${(rate * 100).toFixed(1)}%`;
const fmtUsd = (n: number | null | undefined) => `$${(n ?? 0).toFixed(2)}`;
function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(5, 16).replace('T', ' ');
}

// 쿠폰 상태칩 색(사용=강조 핑크, 유효=중립, 만료=흐림).
function couponStatusChip(key: 'redeemed' | 'active' | 'expired'): string {
  if (key === 'redeemed') return 'bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]';
  if (key === 'active') return 'bg-[var(--app-line)] text-[var(--app-ink)]';
  return 'bg-transparent text-[var(--app-copy-muted)] line-through';
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--app-line)] bg-white p-3">
      <p className="text-[11.5px] font-semibold text-[var(--app-copy-soft)]">{label}</p>
      <p className="mt-0.5 text-[16px] font-extrabold text-[var(--app-ink)]">{value}</p>
      {sub ? <p className="text-[11px] text-[var(--app-copy-muted)]">{sub}</p> : null}
    </div>
  );
}

function sumSeries(series: DailySeries[] | undefined): number | null {
  if (!series || series.length === 0) return null;
  return series.reduce((sum, row) => sum + row.value, 0);
}

function Sparkline({ series }: { series: DailySeries[] }) {
  const max = Math.max(1, ...series.map((s) => s.value));
  return (
    <div className="flex h-10 items-end gap-0.5">
      {series.map((s) => (
        <div
          key={s.date}
          title={`${s.date}: ${s.value}`}
          className="flex-1 rounded-sm bg-[var(--app-pink-strong)]"
          style={{ height: `${Math.max(4, (s.value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/**
 * 요약용 유입 상위 미니 목록(상위 4개).
 * referrer 와 UTM 이 같은 모양이라 한 컴포넌트로 쓴다 — 따로 두면 한쪽만 고쳐져 어긋난다.
 */
function InflowMini({
  title,
  entries,
  emptyHint = '아직 데이터가 없어요',
}: {
  title: string;
  entries: Array<{ key: string; label: string; visitors: number }>;
  emptyHint?: string;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--app-line)] bg-white p-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
        {title}
      </div>
      {entries.length === 0 ? (
        <p className="mt-1 text-[11px] text-[var(--app-copy-soft)]">{emptyHint}</p>
      ) : (
        <ol className="mt-1 space-y-0.5">
          {entries.slice(0, 4).map((entry, i) => (
            <li key={entry.key} className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="min-w-0 truncate text-[var(--app-copy)]">
                {i + 1}. {entry.label}
              </span>
              <span className="shrink-0 font-bold text-[var(--app-ink)]">{fmtNum(entry.visitors)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-extrabold text-[var(--app-ink)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// 2026-09-01 — 카드별 스트리밍. 종전엔 무거운 집계 4종을 한 번에 await 해서
//   **가장 느린 하나가 끝날 때까지 화면이 백지**였다(첫 픽셀 = 마지막 쿼리).
//   아래 컴포넌트들은 각자 필요한 약속 하나만 기다리고, 페이지는 <Suspense> 로 감싼다.
//   쿼리 수·DB 부하는 종전과 같다 — 바뀌는 건 순서와 체감뿐이다.
function CardSkeleton({ title, lines = 1 }: { title: string; lines?: number }) {
  return (
    <Card title={title}>
      <div className="space-y-2" aria-hidden>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-[10px] bg-[var(--app-line)]" />
        ))}
      </div>
      <span className="sr-only">불러오는 중</span>
    </Card>
  );
}

async function QuotaBanner() {
  // 2026-08-31 — LLM 한도 경보. 조회 실패가 콘솔 전체를 깨뜨리면 안 되니 삼킨다(배너만 사라진다).
  const alert = await getLlmQuotaAlert().catch(() => null);
  return alert ? <LlmQuotaBanner alert={alert} /> : null;
}

async function GeneratedAt({ operations }: { operations: Promise<OperationsSnapshot | null> }) {
  const ops = await operations;
  return <>{ops ? ` · 생성 ${fmtDateTime(ops.generatedAt)}` : ''}</>;
}

async function PendingChips({ pending }: { pending: AdminDashboardParts['pending'] }) {
  const counts = await pending;
  return (
    <div className="flex gap-2">
      <Link
        href="/admin/reviews?status=pending"
        className="flex items-center gap-2 rounded-[10px] border border-[var(--app-line)] bg-white px-3 py-2.5"
      >
        <span className="text-[11.5px] text-[var(--app-copy-soft)]">후기 대기</span>
        <span className="text-[14px] font-extrabold text-[var(--app-pink-strong)]">
          {fmtNum(counts.reviewPending)}
        </span>
      </Link>
      <div className="flex items-center gap-2 rounded-[10px] border border-[var(--app-line)] bg-white px-3 py-2.5">
        <span className="text-[11.5px] text-[var(--app-copy-soft)]">환불 대기</span>
        <span className="text-[14px] font-extrabold text-[var(--app-pink-strong)]">
          {fmtNum(counts.refundRequested)}
        </span>
      </div>
    </div>
  );
}


async function TodayKpiCard({
  operations,
  period,
  todayKey,
}: {
  operations: Promise<OperationsSnapshot | null>;
  period: AdminPeriod;
  todayKey: string;
}) {
  const ops = await operations;
  return (
        <Card
      title={period.endKey === todayKey ? '오늘' : `${period.endKey} (기간 마지막 날)`}
      action={<Link href="/admin/operations" className="text-[13px] font-bold text-[var(--app-pink-strong)]">운영 지표 →</Link>}
    >
      {ops ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {/* 2026-07-10 — 자체 순방문. 내부/admin/preview 제외 + page_view 별도 집계. */}
          <Stat
            label="자체 순방문"
            value={ops.today.visitors == null ? '—' : fmtNum(ops.today.visitors)}
          />
          <Stat label="신규 가입" value={fmtNum(ops.today.newSignups)} />
          {/* 2026-07-04 — 라벨 정정: 페이지 방문이 아니라 풀이·피드백·대화 활동 기준. */}
          <Stat label="활동 사용자" value={fmtNum(ops.today.activeUsers)} />
          <Stat label="결제 건수" value={fmtNum(ops.today.purchaseCount)} />
          <Stat label="결제 금액" value={`${fmtNum(ops.today.purchaseAmountWon)}원`} />
          <Stat label="풀이 작성" value={fmtNum(ops.today.readingsCreated)} />
          <Stat label="피드백" value={fmtNum(ops.today.feedbackCount)} />
        </div>
      ) : (
        <p className="text-[13px] text-[var(--app-copy-soft)]">
          운영지표 스냅샷 생성 실패 — 서버 로그의 [admin-dashboard] 항목 확인 (service env
          부재 또는 집계 쿼리 오류).
        </p>
      )}
    </Card>
  );
}

async function VisitCard({
  operations,
  analytics,
  period,
}: {
  operations: Promise<OperationsSnapshot | null>;
  analytics: Promise<AdminAnalyticsPart | null>;
  period: AdminPeriod;
}) {
  const [ops, inflow] = await Promise.all([operations, analytics]);
  const periodVisitors = sumSeries(ops?.trends.visitors);
  return (
    <Card
      title={`방문 (${period.label})`}
      action={<Link href="/admin/analytics" className="text-[13px] font-bold text-[var(--app-pink-strong)]">누적 지표 분석 →</Link>}
    >
      {/* 2026-07-20 — 방문 지표를 **자체 순방문 하나**로 정리(사용자 요청).
          원래 자체순방문·GA4 활성사용자·GA4 PV·Vercel PV 4개를 나란히 놨는데,
          넷이 서로 다른 것을 세는 탓에 "어느 게 맞는 값이냐"만 유발했다:
            자체 순방문 = 하루 1인 1회(**사람**), 봇·admin·프리뷰·내부IP 제외
            GA4 활성 사용자 = 동의를 누른 사람 **중** 유의미하게 머문 사람(이중 필터)
            GA4 PV / Vercel PV = 사람이 아니라 **열람 횟수**(1인 3~4회라 배수로 벌어짐)

          자체 순방문을 기준으로 삼은 이유:
            ① 동의와 무관하게 전원 집계(GA4 는 Consent Mode 기본 denied 라 구조적으로 적다)
            ② 봇·내부 트래픽 제외(Vercel 은 미제외)
            ③ 결제·가입과 **같은 DB** 라 퍼널을 이어서 볼 수 있다 — 이게 결정적이다.

          ⚠️ GA4·Vercel 수집은 그대로 살아 있다. 화면에서만 내렸고 원본은 /admin/analytics.
          ⚠️ GA4 절대값을 자체 집계와 맞추려고 동의 기본값을 granted 로 바꾸지 말 것. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="자체 순방문"
          value={fmtMaybeNum(periodVisitors)}
          sub={`오늘 ${fmtMaybeNum(ops?.today.visitors)} · 봇·내부 제외 순방문`}
        />
        {/* 2026-07-20 — 유입 상위(사용자 요청). "몇 명 왔나" 바로 옆에 "어디서 왔나"를 둔다.
            집계는 /admin/analytics 와 **같은 함수**(getDailyMetrics)를 재사용한다 —
            따로 구현하면 두 화면 숫자가 갈라진다.
            2026-08-27 — UTM 캠페인 추가(사용자 요청). referrer 는 **직전 한 단계**만 보여
            링크인바이오(인포크링크 등)를 거친 유입의 원래 채널을 알 수 없다. 둘을 나란히 둔다. */}
        <InflowMini title="유입 상위 (referrer)" entries={inflow?.topReferrers ?? []} />
        <InflowMini
          title="유입 상위 (UTM)"
          entries={inflow?.topUtm ?? []}
          emptyHint="UTM 태그 유입이 아직 없어요"
        />
      </div>
    </Card>
  );
}

async function LifetimeCard({ operations }: { operations: Promise<OperationsSnapshot | null> }) {
  const ops = await operations;
  return (
    <Card title="누적">
        {ops ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="총 가입자" value={fmtNum(ops.lifetime.totalUsers)} />
            <Stat label="활성 구독" value={fmtNum(ops.lifetime.activeSubscribers)} />
            <Stat label="총 풀이" value={fmtNum(ops.lifetime.totalReadings)} />
            <Stat label="총 결제" value={fmtNum(ops.lifetime.totalPurchases)} />
            <Stat label="총 결제 금액" value={`${fmtNum(ops.lifetime.totalPurchaseAmountWon)}원`} />
          </div>
        ) : (
          <p className="text-[13px] text-[var(--app-copy-soft)]">—</p>
        )}
      </Card>
  );
}

async function PaymentLlmCard({
  funnel,
  llm,
  period,
}: {
  funnel: AdminDashboardParts['funnel'];
  llm: AdminDashboardParts['llm'];
  period: AdminPeriod;
}) {
  const [funnelSnap, llmSnap] = await Promise.all([funnel, llm]);
  return (
    <Card title="결제 · LLM 요약">
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="결제 전환율"
            value={fmtPct(funnelSnap?.totals.overallConversionRate)}
            sub={`승인 성공률 ${fmtPct(funnelSnap?.totals.confirmSuccessRate)}`}
          />
          <Stat
            label={`LLM 비용 (${period.label})`}
            value={fmtUsd(llmSnap?.summary.totalCostUsd)}
            sub={`호출 ${fmtNum(llmSnap?.summary.totalCalls)} · 캐시 ${fmtPct(llmSnap?.summary.cacheHitRate)}`}
          />
        </div>
        <div className="mt-3 flex gap-3 text-[13px] font-bold">
          <Link href="/admin/payment-funnel" className="text-[var(--app-pink-strong)]">결제 퍼널 →</Link>
          <Link href="/admin/llm-cost" className="text-[var(--app-pink-strong)]">LLM 비용 →</Link>
        </div>
      </Card>
  );
}

async function SatisfactionCard({ operations }: { operations: Promise<OperationsSnapshot | null> }) {
  const ops = await operations;
  return (
    <Card title="만족도">
        {ops ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="표본" value={fmtNum(ops.satisfaction.sampleSize)} />
            <Stat label="적중" value={fmtPct(ops.satisfaction.correctRate)} />
            <Stat label="부분" value={fmtPct(ops.satisfaction.partialRate)} />
            <Stat label="빗나감" value={fmtPct(ops.satisfaction.missRate)} />
          </div>
        ) : (
          <p className="text-[13px] text-[var(--app-copy-soft)]">—</p>
        )}
      </Card>
  );
}

async function TrendCard({
  operations,
  period,
}: {
  operations: Promise<OperationsSnapshot | null>;
  period: AdminPeriod;
}) {
  const ops = await operations;
  return (
    <Card title={`추이 (${period.label})`}>
        {ops ? (
          <div className="space-y-2">
            <div>
              <p className="text-[11.5px] font-semibold text-[var(--app-copy-soft)]">신규 가입</p>
              <Sparkline series={ops.trends.newSignups} />
            </div>
            <div>
              <p className="text-[11.5px] font-semibold text-[var(--app-copy-soft)]">결제 건수</p>
              <Sparkline series={ops.trends.purchaseCount} />
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--app-copy-soft)]">—</p>
        )}
      </Card>
  );
}

// 쿠폰 현황은 super_admin 전용이라 화면에서 게이트하고, 조회도 이 안에서만 한다
// (발급/사용 목록에 user_id 가 실린다 — 불필요한 조회·노출 방지).
async function CouponCard() {
  const couponStats = await getKakaoFriendCouponStats().catch(() => null);
  return (
    <Card
        title="카카오 친구추가 무료쿠폰"
        action={
          <span className="text-[11.5px] text-[var(--app-copy-muted)]">
            오늘 자세히보기 0원 · 계정당 1회
          </span>
        }
      >
        {couponStats ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Stat label="발급" value={fmtNum(couponStats.total)} />
              <Stat
                label="사용"
                value={fmtNum(couponStats.redeemed)}
                sub={`사용률 ${fmtPct(couponStats.redeemRate)}`}
              />
              <Stat label="미사용·유효" value={fmtNum(couponStats.active)} />
              <Stat label="만료" value={fmtNum(couponStats.expired)} />
            </div>

            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
                최근 발급/사용
              </p>
              {couponStats.recent.length === 0 ? (
                <p className="text-[11px] text-[var(--app-copy-soft)]">아직 발급된 쿠폰이 없어요</p>
              ) : (
                <ul className="divide-y divide-[var(--app-line)]">
                  {couponStats.recent.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${couponStatusChip(c.statusKey)}`}>
                          {c.statusLabel}
                        </span>
                        <Link
                          href={`/admin/users/${c.userId}`}
                          className="truncate font-mono text-[11.5px] text-[var(--app-copy)] underline decoration-dotted underline-offset-2"
                          title={c.userId}
                        >
                          {c.userId.slice(0, 8)}
                        </Link>
                      </span>
                      <span className="shrink-0 text-right text-[var(--app-copy-soft)]">
                        발급 {fmtDateTime(c.issuedAt)}
                        {c.redeemedAt ? ` · 사용 ${fmtDateTime(c.redeemedAt)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--app-copy-soft)]">
            쿠폰 현황 집계 실패 — 서버 로그의 [admin-coupon-stats] 항목 확인 (service env 부재
            또는 집계 쿼리 오류).
          </p>
        )}
      </Card>
  );
}

async function ActivityCard({
  recentActivity,
}: {
  recentActivity: AdminDashboardParts['recentActivity'];
}) {
  const activity = await recentActivity;
  return (
    <Card title="최근 관리 활동">
      {activity.length === 0 ? (
        <p className="text-[13px] text-[var(--app-copy-soft)]">기록된 활동이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-[var(--app-line)]">
          {activity.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
              <span className="font-semibold text-[var(--app-ink)]">{a.actionLabel}</span>
              <span className="text-[var(--app-copy-soft)]">
                {a.actorRole} · {fmtDateTime(a.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function DailyTableSection({ analytics }: { analytics: Promise<AdminAnalyticsPart | null> }) {
  const inflow = await analytics;
  // 실측 시작일 이전(집계가 사람을 못 세던 구간)은 /admin/analytics 와 같은 규칙으로 자른다.
  const visibleDaily = (inflow?.daily ?? []).filter((d) => d.date >= VISIT_TRACKING_START_KEY);
  return <MetricsPeriodTable rows={visibleDaily} title="날짜별 · 주별 상세" />;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; period?: string }>;
}) {
  const params = await searchParams;
  // 2026-09-01 사용자 지시 — 기본은 **오늘 하루**. 종전 기본이 '30일(월)'이라
  //   대시보드를 열 때마다 한 달 뭉갠 숫자부터 보였다.
  const period = resolveAdminPeriod(params.unit, params.period);
  const windowDays = period.days;
  const todayKey = kstTodayKey();
  const prevAnchor = shiftAdminPeriod(period, -1);
  const nextAnchor = shiftAdminPeriod(period, 1);
  const periodChoices = adminPeriodChoices(period.unit);
  const periodHref = (unit: string, anchor?: string) =>
    `/admin?unit=${unit}${anchor ? `&period=${encodeURIComponent(anchor)}` : ''}`;

  // 2026-09-01 — 집계는 **await 하지 않는다**. 약속만 만들어 카드로 넘기고, 화면은
  //   <Suspense> 로 카드마다 따로 기다린다(첫 픽셀이 마지막 쿼리를 기다리지 않게).
  //   role 만 여기서 기다린다 — super_admin 전용 카드의 렌더 여부를 가르기 때문이다.
  const supabase = await createClient();
  const parts = getAdminDashboardParts(period);
  const roleCheck = await getCurrentAdminRole(supabase);
  const role = roleCheck.role ?? 'admin';

  return (
    <main className="w-full space-y-5 px-4 py-5 md:px-6">
      {/* 2026-08-31 — 한도 경보는 접히지 않는 맨 위. 'ok' 일 때도 남겨 둔다:
          배너가 사라지면 "경보 기능이 있는지" 자체를 잊는다.
          2026-09-01 — 조회는 별도 Suspense: 경보 한 건이 대시보드 전체를 붙잡지 않는다. */}
      <Suspense fallback={null}>
        <QuotaBanner />
      </Suspense>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-extrabold text-[var(--app-ink)]">관리자 콘솔</h1>
          <p className="text-[13px] text-[var(--app-copy-soft)]">
            기준 {period.label}
            {period.days > 1 ? ` (${period.startKey}~${period.endKey}, ${period.days}일)` : ''} ·{' '}
            {role === 'super_admin' ? 'super_admin' : 'admin'}
            <Suspense fallback={null}>
              <GeneratedAt operations={parts.operations} />
            </Suspense>
          </p>
        </div>
        {/* 2026-09-01 사용자 지시 — 롤링 N일이 아니라 **달력 기간을 지정**한다:
            일=날짜 선택 · 주=월~일 · 월=1~12월 · 분기=1~3/4~6/7~9/10~12 · 년=연도.
            서버 컴포넌트라 단위는 링크, 기간 선택은 JS 없는 GET 폼(네이티브 date/select). */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="집계 단위">
            {ADMIN_PERIOD_UNITS.map((opt) => (
              <Link
                key={opt.unit}
                href={periodHref(opt.unit)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-bold ${
                  opt.unit === period.unit
                    ? 'bg-[var(--app-pink-strong)] text-white'
                    : 'border border-[var(--app-line)] text-[var(--app-ink)]'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {prevAnchor ? (
              <Link
                href={periodHref(period.unit, prevAnchor)}
                aria-label="이전 기간"
                className="rounded-[10px] border border-[var(--app-line)] px-2.5 py-1.5 text-[13px] font-bold text-[var(--app-ink)]"
              >
                ←
              </Link>
            ) : null}
            <form action="/admin" method="get" className="flex items-center gap-1">
              <input type="hidden" name="unit" value={period.unit} />
              {period.unit === 'day' ? (
                <input
                  type="date"
                  name="period"
                  defaultValue={period.anchor}
                  max={todayKey}
                  className="rounded-[10px] border border-[var(--app-line)] px-2.5 py-1.5 text-[13px]"
                />
              ) : (
                <select
                  name="period"
                  defaultValue={period.anchor}
                  className="rounded-[10px] border border-[var(--app-line)] px-2.5 py-1.5 text-[13px]"
                >
                  {periodChoices.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                className="rounded-[10px] bg-[var(--app-ink)] px-3 py-1.5 text-[13px] font-bold text-white"
              >
                조회
              </button>
            </form>
            {nextAnchor ? (
              <Link
                href={periodHref(period.unit, nextAnchor)}
                aria-label="다음 기간"
                className="rounded-[10px] border border-[var(--app-line)] px-2.5 py-1.5 text-[13px] font-bold text-[var(--app-ink)]"
              >
                →
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {/* 사용자 검색 + 대기 작업 */}
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <form action="/admin/users" method="get" className="flex gap-2">
          <input
            type="text"
            name="q"
            placeholder="이메일 · UUID 로 사용자 검색"
            className="min-w-0 flex-1 rounded-[10px] border border-[var(--app-line)] px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-[10px] bg-[var(--app-ink)] px-4 py-2.5 text-sm font-bold text-white"
          >
            검색
          </button>
        </form>
        <Suspense
          fallback={<div className="h-[42px] w-[220px] animate-pulse rounded-[10px] bg-[var(--app-line)]" />}
        >
          <PendingChips pending={parts.pending} />
        </Suspense>
      </div>

      <Suspense fallback={<CardSkeleton title="오늘" lines={2} />}>
        <TodayKpiCard operations={parts.operations} period={period} todayKey={todayKey} />
      </Suspense>

      <Suspense fallback={<CardSkeleton title="방문" lines={3} />}>
        <VisitCard
          operations={parts.operations}
          analytics={parts.analytics}
          period={period}
        />
      </Suspense>

      <div className="grid gap-3 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton title="누적" lines={2} />}>
          <LifetimeCard operations={parts.operations} />
        </Suspense>
        <Suspense fallback={<CardSkeleton title="결제 · LLM 요약" lines={2} />}>
          <PaymentLlmCard funnel={parts.funnel} llm={parts.llm} period={period} />
        </Suspense>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton title="만족도" lines={2} />}>
          <SatisfactionCard operations={parts.operations} />
        </Suspense>
        <Suspense fallback={<CardSkeleton title={`추이 (${period.label})`} lines={3} />}>
          <TrendCard operations={parts.operations} period={period} />
        </Suspense>
      </div>

      {role === 'super_admin' && (
        <Suspense fallback={<CardSkeleton title="카카오 친구추가 무료쿠폰" lines={2} />}>
          <CouponCard />
        </Suspense>
      )}

      <Suspense fallback={<CardSkeleton title="최근 관리 활동" lines={3} />}>
        <ActivityCard recentActivity={parts.recentActivity} />
      </Suspense>

      {/* 2026-08-27 사용자 지시 — 하단 '바로가기' 자리에 날짜별 데이터.
          일별은 날짜+요일, 주별은 달력 주(월~일)로 묶는다. 표 컴포넌트는
          /admin/analytics 와 **같은 것**을 쓴다 — 주 경계와 비율 계산이 갈라지면 안 된다. */}
      <Suspense fallback={<CardSkeleton title="날짜별 · 주별 상세" lines={4} />}>
        <DailyTableSection analytics={parts.analytics} />
      </Suspense>
    </main>
  );
}
