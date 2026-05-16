// 2026-05-16 — /my/billing 결제관리 페이지 재구성.
// 이전엔 PageHero + SectionSurface + FeatureCard + ProductGrid + SupportRail 같은
// 옛 marketing 컴포넌트로 빌드돼 /my/settings 등 자매 라우트와 시각 어긋남.
// `/my/settings` 와 동일한 compact pink-soft hero + 둥근 흰 카드 패턴으로 통일.
//
// 라우팅 / 데이터 흐름은 무수정 — getAccountDashboardData + SubscriptionManager 그대로.
import Link from 'next/link';
import SubscriptionManager from '@/components/my/subscription-manager';
import { getAccountDashboardData } from '@/lib/account';
import {
  getSubscriptionPlanLabel,
  getSubscriptionStatusLabel,
} from '@/lib/subscription';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

const TYPE_LABELS: Record<string, string> = {
  purchase: '코인 충전',
  subscription: '월간 상품 시작',
  use: '코인 사용',
  signup_bonus: '가입 보너스',
};

const FEATURE_LABELS: Record<string, string> = {
  detail_report: '분야별 깊이보기',
  calendar: '월간 달력 열기',
  lifetime_report: '보관형 사주 리포트 열람',
  yearly_report: '올해 전략서 열람',
  ai_chat: '대화 이용',
  ai_chat_bundle: '대화 묶음 사용',
};

function readMetadataString(
  transaction: Awaited<ReturnType<typeof getAccountDashboardData>>['recentTransactions'][number],
  key: string
) {
  const value = transaction.metadata?.[key];
  return typeof value === 'string' ? value : '';
}

function getTransactionFeatureLabel(
  transaction: Awaited<ReturnType<typeof getAccountDashboardData>>['recentTransactions'][number]
) {
  if (transaction.feature === 'detail_report') {
    const kind = readMetadataString(transaction, 'kind');
    if (kind === 'today_fortune_premium_access') return '오늘운세 심화풀이';
    if (kind === 'today_result_followup') return '오늘운세 후속 대화';
    if (kind === 'detail_report_access') return '분야별 깊이보기';
    if (kind === 'detail_report_daily_access') return '분야별 깊이보기';
    return '분야별 심화 이용';
  }

  if (transaction.feature === 'calendar') {
    const yearMonth = readMetadataString(transaction, 'yearMonth');
    return yearMonth ? `${yearMonth} 월간 달력` : '월간 달력 열기';
  }

  if (transaction.feature === 'ai_chat') {
    const status = readMetadataString(transaction, 'billingStatus');
    return status === 'charged_bundle' ? '대화 묶음 사용' : '대화 이용';
  }

  if (!transaction.feature) return '기본 이용 흐름';

  return FEATURE_LABELS[transaction.feature] ?? transaction.feature;
}

function getTransactionLabel(transaction: Awaited<ReturnType<typeof getAccountDashboardData>>['recentTransactions'][number]) {
  if (transaction.feature === 'lifetime_report') {
    return '보관형 리포트 권한';
  }

  if (transaction.type === 'subscription') {
    return '멤버십 시작';
  }

  if (transaction.type === 'use') {
    return getTransactionFeatureLabel(transaction);
  }

  return TYPE_LABELS[transaction.type] ?? transaction.type;
}

function getSubscriptionNotice(
  subscription: Awaited<ReturnType<typeof getAccountDashboardData>>['subscription']
) {
  if (!subscription) {
    return '아직 라이트 멤버십을 시작하지 않았습니다. 코인 센터나 멤버십 화면에서 시작하면 30일 이용 기간과 포함 혜택이 바로 반영됩니다.';
  }

  if (subscription.status === 'active') {
    return '현재 멤버십을 이용 중입니다. 해지 예약을 눌러도 이번 이용 기간이 끝날 때까지 혜택은 그대로 유지됩니다.';
  }

  if (subscription.status === 'cancelled') {
    return '해지 예약이 설정된 상태입니다. 다음 결제일 전까지는 멤버십 혜택을 그대로 쓰고, 원하면 다시 재개할 수 있습니다.';
  }

  return '멤버십 이용 기간이 만료됐습니다. 필요할 때 다시 시작해서 이어서 사용할 수 있습니다.';
}

export default async function MyBillingPage() {
  const dashboard = await getAccountDashboardData('/my/billing', {
    readingLimit: 3,
    transactionLimit: 20,
  });

  const subscriptionStatusLabel = dashboard.subscription
    ? getSubscriptionStatusLabel(dashboard.subscription.status)
    : '미가입';

  return (
    <div className="space-y-5 px-1">
      {/* §Hero — pink-soft, compact (settings 와 동일 패턴) */}
      <article
        className="rounded-[18px] border p-5"
        style={{
          background: 'var(--app-pink-soft)',
          borderColor: 'var(--app-pink-line)',
        }}
      >
        <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          결제 관리
        </div>
        <h1
          className="mt-1.5 text-[22px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          코인 · 멤버십 · 이용 내역을
          <br />
          한 화면에서 살펴보세요
        </h1>
        <p
          className="mt-2 text-[12.5px] leading-[1.6] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          지금 남은 코인, 멤버십 상태, 다음 결제일, 최근 이용 내역을 한곳에 모았습니다.
        </p>
      </article>

      {/* §남은 잔액 — 3 칸 */}
      <section>
        <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
          남은 잔액
        </h2>
        <div className="mt-2 grid grid-cols-3 gap-2.5">
          <article
            className="rounded-[14px] border bg-white p-3.5"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
              전체 코인
            </div>
            <div className="mt-1 text-[20px] font-extrabold tabular-nums leading-none text-[var(--app-pink-strong)]">
              {dashboard.credits.total}
            </div>
          </article>
          <article
            className="rounded-[14px] border bg-white p-3.5"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
              일반 코인
            </div>
            <div className="mt-1 text-[20px] font-extrabold tabular-nums leading-none text-[var(--app-ink)]">
              {dashboard.credits.balance}
            </div>
          </article>
          <article
            className="rounded-[14px] border bg-white p-3.5"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
              월간 플랜
            </div>
            <div className="mt-1 text-[20px] font-extrabold tabular-nums leading-none text-[var(--app-ink)]">
              {dashboard.credits.subscriptionBalance}
            </div>
          </article>
        </div>
      </section>

      {/* §멤버십 상태 */}
      <section>
        <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
          멤버십 상태
        </h2>
        <article
          className="mt-2 rounded-[14px] border bg-white p-4"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
              상태
            </div>
            <div className="text-[15px] font-extrabold text-[var(--app-ink)]">
              {subscriptionStatusLabel}
            </div>
          </div>
          {dashboard.subscription ? (
            <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3" style={{ borderColor: 'var(--app-line)' }}>
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
                  플랜
                </div>
                <div className="mt-0.5 text-[13.5px] font-extrabold text-[var(--app-ink)]">
                  {getSubscriptionPlanLabel(dashboard.subscription.plan)}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
                  다음 결제일
                </div>
                <div className="mt-0.5 text-[13.5px] font-extrabold text-[var(--app-ink)]">
                  {dashboard.subscription.renewsAt
                    ? formatDate(dashboard.subscription.renewsAt)
                    : '미정'}
                </div>
              </div>
            </div>
          ) : null}
          <p
            className="mt-3 text-[12px] leading-[1.65] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {getSubscriptionNotice(dashboard.subscription)}
          </p>
          <div className="mt-3">
            <SubscriptionManager subscription={dashboard.subscription} />
          </div>
        </article>
      </section>

      {/* §바로가기 */}
      <section>
        <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
          바로가기
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link
            href="/credits"
            className="flex items-center justify-between rounded-[14px] border bg-white p-3.5"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="min-w-0">
              <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
                코인 센터
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--app-copy-soft)]">
                충전 · 재시작
              </div>
            </div>
            <span className="text-[var(--app-copy-soft)]" aria-hidden="true">
              ›
            </span>
          </Link>
          <Link
            href="/membership"
            className="flex items-center justify-between rounded-[14px] border bg-white p-3.5"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="min-w-0">
              <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
                멤버십
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--app-copy-soft)]">
                플랜 · 혜택 안내
              </div>
            </div>
            <span className="text-[var(--app-copy-soft)]" aria-hidden="true">
              ›
            </span>
          </Link>
        </div>
      </section>

      {/* §최근 이용 이력 */}
      <section>
        <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
          최근 결제 · 이용 이력
        </h2>
        <div className="mt-2 grid gap-2">
          {dashboard.recentTransactions.length > 0 ? (
            dashboard.recentTransactions.map((transaction) => {
              const positive = transaction.amount >= 0;
              return (
                <article
                  key={transaction.id}
                  className="rounded-[14px] border bg-white p-3.5"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] text-[var(--app-copy-soft)]">
                        {formatDate(transaction.createdAt)}
                      </div>
                      <div
                        className="mt-0.5 text-[13.5px] font-extrabold text-[var(--app-ink)]"
                        style={{ wordBreak: 'keep-all' }}
                      >
                        {getTransactionLabel(transaction)}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-[var(--app-copy-muted)]">
                        {getTransactionFeatureLabel(transaction)}
                      </div>
                    </div>
                    <div
                      className="shrink-0 text-[14px] font-extrabold tabular-nums"
                      style={{
                        color: positive ? 'var(--app-jade)' : 'var(--app-coral)',
                      }}
                    >
                      {positive ? '+' : ''}
                      {transaction.amount}
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <article
              className="rounded-[14px] border bg-white p-4"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="text-[11px] font-bold text-[var(--app-pink-strong)]">
                아직 기록 없음
              </div>
              <p
                className="mt-1 text-[13px] leading-[1.55] text-[var(--app-copy)]"
                style={{ wordBreak: 'keep-all' }}
              >
                표시할 결제 또는 코인 사용 이력이 아직 없습니다.
              </p>
            </article>
          )}
        </div>
      </section>

      {/* §정책 안내 (compact) */}
      <article
        className="rounded-[14px] border bg-white p-4"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
          📚 결제·환불 기준
        </div>
        <ul
          className="mt-1.5 grid gap-1 text-[11.5px] leading-[1.65] text-[var(--app-copy)]"
          style={{ wordBreak: 'keep-all' }}
        >
          <li>• 정기 이용 상품은 가격과 갱신 시점, 열리는 혜택을 같은 화면에서 다시 확인하실 수 있습니다.</li>
          <li>• 해지 예약을 하셔도 이번 이용 기간이 끝날 때까지 혜택은 그대로 유지됩니다.</li>
          <li>• 디지털 해석은 열람 여부에 따라 환불 기준이 달라질 수 있어, 결제 전 안내를 먼저 보여드립니다.</li>
        </ul>
      </article>
    </div>
  );
}
