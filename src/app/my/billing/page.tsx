import Link from 'next/link';
import SubscriptionManager from '@/components/my/subscription-manager';
import { Badge } from '@/components/ui/badge';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import { getAccountDashboardData } from '@/lib/account';
import {
  getSubscriptionPlanLabel,
  getSubscriptionStatusLabel,
} from '@/lib/subscription';
import { PageHero } from '@/shared/layout/app-shell';

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
    <div className="space-y-6">
      <PageHero
        badges={[
          <Badge
            key="billing"
            className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]"
          >
            결제와 이용
          </Badge>,
          <Badge
            key="status"
            className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
          >
            코인 · 멤버십 · 환불 안내
          </Badge>,
        ]}
        title="결제와 이용 상태를 한눈에 살펴보세요"
        description="지금 남은 코인, 멤버십 상태, 다음 결제일, 최근 이용 내역을 한곳에 모았습니다. 필요한 정보만 같은 문법으로 차분히 읽을 수 있게 정리했습니다."
      />

      <SectionSurface surface="panel" size="lg">
        <SectionHeader
          eyebrow="남은 잔액"
          title="코인과 멤버십 코인을 함께 관리합니다"
          titleClassName="text-3xl"
        />
        <ProductGrid columns={3} className="mt-6">
          <FeatureCard surface="soft" eyebrow="전체 코인" title={dashboard.credits.total} />
          <FeatureCard surface="soft" eyebrow="일반 코인" title={dashboard.credits.balance} />
          <FeatureCard surface="soft" eyebrow="월간 플랜 코인" title={dashboard.credits.subscriptionBalance} />
        </ProductGrid>
      </SectionSurface>

      <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="멤버십 상태"
            title={subscriptionStatusLabel}
            titleClassName="text-3xl"
            description={getSubscriptionNotice(dashboard.subscription)}
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
          />

          {dashboard.subscription ? (
            <ProductGrid columns={2} className="mt-6">
              <FeatureCard
                surface="soft"
                eyebrow="플랜"
                title={getSubscriptionPlanLabel(dashboard.subscription.plan)}
              />
              <FeatureCard
                surface="soft"
                eyebrow="다음 결제일"
                title={
                  dashboard.subscription.renewsAt
                    ? formatDate(dashboard.subscription.renewsAt)
                    : '미정'
                }
              />
            </ProductGrid>
          ) : (
            <FeatureCard className="mt-6" surface="soft" eyebrow="현재 상태" description={getSubscriptionNotice(null)} />
          )}

          <div className="mt-6">
            <SubscriptionManager subscription={dashboard.subscription} />
          </div>
        </SectionSurface>

        <SupportRail
          surface="lunar"
          eyebrow="정책 안내"
          title="결제와 환불은 이 기준으로 움직입니다"
          description="복잡한 정책을 길게 늘어놓기보다, 실제로 확인할 가능성이 높은 기준만 짧게 남겨두었습니다."
        >
          <BulletList
            items={[
              '정기 이용 상품은 가격과 갱신 시점, 열리는 혜택을 같은 화면에서 다시 확인하실 수 있습니다.',
              '해지 예약을 하셔도 이번 이용 기간이 끝날 때까지 혜택은 그대로 유지됩니다.',
              '디지털 해석은 열람 여부에 따라 환불 기준이 달라질 수 있어, 결제 전 안내를 먼저 보여드립니다.',
              '궁금한 점이 생기면 멤버십 페이지와 코인 센터에서 바로 이어서 살펴보실 수 있습니다.',
            ]}
          />
          <FeatureCard
            className="mt-5"
            surface="soft"
            eyebrow="바로 가기"
            description={
              <>
                멤버십 구성과 이용 혜택은{' '}
                <Link
                  href="/membership"
                  className="text-[var(--app-gold-soft)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                >
                  멤버십 페이지
                </Link>
                에서, 코인 충전과 재시작은{' '}
                <Link
                  href="/credits"
                  className="text-[var(--app-gold-soft)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                >
                  코인 센터
                </Link>
                에서 바로 이어집니다.
              </>
            }
          />
        </SupportRail>
      </section>

      <SectionSurface surface="panel" size="lg">
        <SectionHeader
          eyebrow="최근 결제 및 코인 이력"
          title={`최근 ${dashboard.recentTransactions.length}건`}
          titleClassName="text-3xl"
        />
        <ProductGrid columns={2} className="mt-6">
          {dashboard.recentTransactions.length > 0 ? (
            dashboard.recentTransactions.map((transaction) => (
              <FeatureCard
                key={transaction.id}
                surface="soft"
                eyebrow={formatDate(transaction.createdAt)}
                title={getTransactionLabel(transaction)}
                description={
                  <>
                    <span className="block text-[var(--app-copy-muted)]">
                      {getTransactionFeatureLabel(transaction)}
                    </span>
                    <span
                      className={`mt-2 block font-semibold ${
                        transaction.amount >= 0 ? 'text-emerald-200' : 'text-rose-200'
                      }`}
                    >
                      {transaction.amount >= 0 ? '+' : ''}
                      {transaction.amount} 코인
                    </span>
                  </>
                }
              />
            ))
          ) : (
            <FeatureCard
              surface="soft"
              eyebrow="아직 기록 없음"
              description="표시할 결제 또는 코인 사용 이력이 아직 없습니다."
            />
          )}
        </ProductGrid>
      </SectionSurface>
    </div>
  );
}
