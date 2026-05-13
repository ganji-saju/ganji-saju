import Link from 'next/link';
import SubscriptionManager from '@/components/my/subscription-manager';
import { FlowEntryList } from '@/components/moonlight/FlowEntryList';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
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
    <div className="space-y-5">
      <PageIntro
        eyebrow="결제와 이용"
        title="결제와 이용 상태를 한눈에 살펴보세요"
        description="지금 남은 코인, 멤버십 상태, 다음 결제일, 최근 이용 내역을 한곳에 모았습니다. 필요한 정보만 같은 문법으로 차분히 읽을 수 있게 정리했습니다."
        actions={
          <>
            <Link href="/membership" className="gangi-primary-button">
              멤버십 보기
            </Link>
            <Link href="/credits" className="gangi-secondary-button">
              코인 충전
            </Link>
          </>
        }
      />

      <LightSection
        eyebrow="남은 잔액"
        title="코인과 멤버십 코인을 함께 관리합니다"
        description="결제 상세 정보 대신 이용에 필요한 잔액만 요약합니다."
        surface="soft"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ['전체 코인', dashboard.credits.total],
            ['일반 코인', dashboard.credits.balance],
            ['월간 플랜 코인', dashboard.credits.subscriptionBalance],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] p-4"
            >
              <p className="text-xs font-bold text-[var(--gyeol-muted)]">{label}</p>
              <strong className="mt-1 block text-xl text-[var(--gyeol-text)]">{value}</strong>
            </div>
          ))}
        </div>
      </LightSection>

      <section className="grid gap-5 lg:grid-cols-[1.02fr_0.98fr]">
        <LightSection
          eyebrow="멤버십 상태"
          title={subscriptionStatusLabel}
          description={getSubscriptionNotice(dashboard.subscription)}
        >

          {dashboard.subscription ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['플랜', getSubscriptionPlanLabel(dashboard.subscription.plan)],
                [
                  '다음 결제일',
                  dashboard.subscription.renewsAt
                    ? formatDate(dashboard.subscription.renewsAt)
                    : '미정',
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] p-4"
                >
                  <p className="text-xs font-bold text-[var(--gyeol-muted)]">{label}</p>
                  <strong className="mt-1 block text-base text-[var(--gyeol-text)]">{value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] px-4 py-3 text-sm leading-6 text-[var(--gyeol-muted)]">
              {getSubscriptionNotice(null)}
            </div>
          )}

          <div className="mt-5">
            <SubscriptionManager subscription={dashboard.subscription} />
          </div>
        </LightSection>

        <LightSection
          eyebrow="정책 안내"
          title="결제와 환불은 이 기준으로 움직입니다"
          description="복잡한 정책을 길게 늘어놓기보다, 실제로 확인할 가능성이 높은 기준만 짧게 남겨두었습니다."
        >
          <ul className="grid gap-2 text-sm leading-6 text-[var(--gyeol-muted)]">
            {[
              '정기 이용 상품은 가격과 갱신 시점, 열리는 혜택을 같은 화면에서 다시 확인하실 수 있습니다.',
              '해지 예약을 하셔도 이번 이용 기간이 끝날 때까지 혜택은 그대로 유지됩니다.',
              '디지털 해석은 열람 여부에 따라 환불 기준이 달라질 수 있어, 결제 전 안내를 먼저 보여드립니다.',
              '궁금한 점이 생기면 멤버십 페이지와 코인 센터에서 바로 이어서 살펴보실 수 있습니다.',
            ].map((item) => (
              <li key={item} className="rounded-[0.9rem] bg-[var(--gyeol-surface)] px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
          <FlowEntryList
            className="mt-4"
            items={[
              {
                id: 'membership',
                title: '멤버십 페이지',
                description: '구성과 이용 혜택을 다시 확인합니다.',
                href: '/membership',
                meta: '보기',
              },
              {
                id: 'credits',
                title: '코인 센터',
                description: '코인 충전과 재시작 흐름으로 이동합니다.',
                href: '/credits',
                meta: '충전',
              },
            ]}
          />
        </LightSection>
      </section>

      <LightSection
        eyebrow="최근 결제 및 코인 이력"
        title={`최근 ${dashboard.recentTransactions.length}건`}
        description="금액과 결제 상세값 대신 이용 내역과 코인 증감을 중심으로 표시합니다."
      >
        <div className="grid gap-2">
          {dashboard.recentTransactions.length > 0 ? (
            dashboard.recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex min-h-16 items-center justify-between gap-3 rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="text-xs font-bold text-[var(--gyeol-muted)]">
                    {formatDate(transaction.createdAt)}
                  </span>
                  <strong className="mt-1 block text-base text-[var(--gyeol-text)]">
                    {getTransactionLabel(transaction)}
                  </strong>
                  <span className="mt-1 block text-sm text-[var(--gyeol-muted)]">
                    {getTransactionFeatureLabel(transaction)}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-sm font-bold ${
                    transaction.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {transaction.amount >= 0 ? '+' : ''}
                  {transaction.amount} 코인
                </span>
              </div>
            ))
          ) : (
            <div className="rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] px-4 py-4 text-sm leading-6 text-[var(--gyeol-muted)]">
              표시할 결제 또는 코인 사용 이력이 아직 없습니다.
            </div>
          )}
        </div>
      </LightSection>
    </div>
  );
}
