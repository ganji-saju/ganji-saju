// 2026-06-28 — 관리자 콘솔 랜딩 대시보드(/admin). 관리자 콘솔 2/2.
//   기존 스냅샷(운영·결제퍼널·LLM) 통합 KPI + 대기 작업 + 최근 활동 + 기간 토글 + 바로가기.
//   진입점이 없던 문제(G1) 해결. 데이터는 getAdminDashboardSummary 1회 호출.
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import {
  getAdminDashboardSummary,
  normalizeDashboardWindow,
} from '@/lib/admin/dashboard-summary';
import { getVisibleNavGroups } from '@/lib/admin/nav';
import type { DailySeries } from '@/lib/admin/operations-stats';

export const metadata: Metadata = {
  title: '관리자 콘솔',
  robots: { index: false, follow: false },
};

const fmtNum = (n: number | null | undefined) => (n ?? 0).toLocaleString('ko-KR');
// 2026-07-04 — 반올림 대신 소수 1자리: 0.5% 미만 전환율이 전부 '0%'로 보이던 문제.
const fmtPct = (rate: number | null | undefined) => `${((rate ?? 0) * 100).toFixed(1)}%`;
const fmtUsd = (n: number | null | undefined) => `$${(n ?? 0).toFixed(2)}`;
function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(5, 16).replace('T', ' ');
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--app-line)] bg-white p-3">
      <p className="text-[11.5px] font-semibold text-[var(--app-copy-soft)]">{label}</p>
      <p className="mt-0.5 text-[20px] font-extrabold text-[var(--app-ink)]">{value}</p>
      {sub ? <p className="text-[11px] text-[var(--app-copy-muted)]">{sub}</p> : null}
    </div>
  );
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

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const windowDays = normalizeDashboardWindow(params.days);

  const supabase = await createClient();
  const [roleCheck, summary] = await Promise.all([
    getCurrentAdminRole(supabase),
    getAdminDashboardSummary(windowDays),
  ]);
  const role = roleCheck.role ?? 'admin';

  const ops = summary.operations;
  const navGroups = getVisibleNavGroups(role).filter((g) => g.title !== '개요');

  return (
    <main className="w-full space-y-5 px-4 py-5 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[var(--app-ink)]">관리자 콘솔</h1>
          <p className="text-[12.5px] text-[var(--app-copy-soft)]">
            기준 {windowDays}일 · {role === 'super_admin' ? 'super_admin' : 'admin'}
            {ops ? ` · 생성 ${fmtDateTime(ops.generatedAt)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {[7, 14, 30].map((d) => (
            <Link
              key={d}
              href={`/admin?days=${d}`}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold ${
                d === windowDays
                  ? 'bg-[var(--app-pink-strong)] text-white'
                  : 'border border-[var(--app-line)] text-[var(--app-ink)]'
              }`}
            >
              {d}일
            </Link>
          ))}
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
        <div className="flex gap-2">
          <Link
            href="/admin/reviews?status=pending"
            className="flex items-center gap-2 rounded-[10px] border border-[var(--app-line)] bg-white px-3 py-2.5"
          >
            <span className="text-[12px] text-[var(--app-copy-soft)]">후기 대기</span>
            <span className="text-[16px] font-extrabold text-[var(--app-pink-strong)]">
              {fmtNum(summary.pending.reviewPending)}
            </span>
          </Link>
          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--app-line)] bg-white px-3 py-2.5">
            <span className="text-[12px] text-[var(--app-copy-soft)]">환불 대기</span>
            <span className="text-[16px] font-extrabold text-[var(--app-pink-strong)]">
              {fmtNum(summary.pending.refundRequested)}
            </span>
          </div>
        </div>
      </div>

      {/* 오늘 KPI */}
      <Card
        title="오늘"
        action={<Link href="/admin/operations" className="text-[12.5px] font-bold text-[var(--app-pink-strong)]">운영 지표 →</Link>}
      >
        {ops ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="신규 가입" value={fmtNum(ops.today.newSignups)} />
            {/* 2026-07-04 — 라벨 정정: 페이지 방문이 아니라 풀이·피드백·대화 활동 기준. */}
            <Stat label="활동 사용자" value={fmtNum(ops.today.activeUsers)} />
            <Stat label="결제 건수" value={fmtNum(ops.today.purchaseCount)} />
            <Stat label="결제 금액" value={`${fmtNum(ops.today.purchaseAmountWon)}원`} />
            <Stat label="풀이 작성" value={fmtNum(ops.today.readingsCreated)} />
            <Stat label="피드백" value={fmtNum(ops.today.feedbackCount)} />
          </div>
        ) : (
          <p className="text-[13px] text-[var(--app-copy-soft)]">데이터를 불러오지 못했습니다(service env 확인).</p>
        )}
      </Card>

      {/* 누적 + 결제/LLM 요약 */}
      <div className="grid gap-3 lg:grid-cols-2">
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
        <Card title="결제 · LLM 요약">
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="결제 전환율"
              value={fmtPct(summary.funnel?.totals.overallConversionRate)}
              sub={`승인 성공률 ${fmtPct(summary.funnel?.totals.confirmSuccessRate)}`}
            />
            <Stat
              label={`LLM 비용 (${windowDays}일)`}
              value={fmtUsd(summary.llm?.summary.totalCostUsd)}
              sub={`호출 ${fmtNum(summary.llm?.summary.totalCalls)} · 캐시 ${fmtPct(summary.llm?.summary.cacheHitRate)}`}
            />
          </div>
          <div className="mt-3 flex gap-3 text-[12.5px] font-bold">
            <Link href="/admin/payment-funnel" className="text-[var(--app-pink-strong)]">결제 퍼널 →</Link>
            <Link href="/admin/llm-cost" className="text-[var(--app-pink-strong)]">LLM 비용 →</Link>
          </div>
        </Card>
      </div>

      {/* 만족도 + 추이 */}
      <div className="grid gap-3 lg:grid-cols-2">
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
        <Card title={`추이 (${windowDays}일)`}>
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
      </div>

      {/* 최근 어드민 활동 */}
      <Card title="최근 관리 활동">
        {summary.recentActivity.length === 0 ? (
          <p className="text-[13px] text-[var(--app-copy-soft)]">기록된 활동이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-[var(--app-line)]">
            {summary.recentActivity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
                <span className="font-semibold text-[var(--app-ink)]">{a.actionLabel}</span>
                <span className="text-[var(--app-copy-soft)]">
                  {a.actorRole} · {fmtDateTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 섹션 바로가기 */}
      <Card title="바로가기">
        <div className="space-y-3">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="text-[11.5px] font-extrabold uppercase tracking-wide text-[var(--app-copy-muted)]">
                {group.title}
              </p>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex flex-col gap-0.5 rounded-[12px] border border-[var(--app-line)] bg-white p-3 transition-colors hover:bg-[var(--app-pink-soft)]"
                  >
                    <span className="text-[14px] font-extrabold text-[var(--app-ink)]">{item.label}</span>
                    {item.description ? (
                      <span className="text-[12px] text-[var(--app-copy-soft)]">{item.description}</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
