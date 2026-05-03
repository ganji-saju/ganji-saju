import Link from 'next/link';
import type { Metadata } from 'next';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  ACTIVE_DALBIT_TEACHERS,
  DALBIT_TEACHERS,
  PLAN_BLUEPRINT,
  TASTE_PRODUCTS,
} from '@/content/moonlight';
import { PRODUCT_REPORT_CATALOG } from '@/content/report-catalog';
import { PAYMENT_PACKAGES } from '@/lib/payments/catalog';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '가격 한눈보기',
  description: '달빛인생의 550원/990원 소액 풀이, 코인팩, 대화 멤버십을 한 화면에서 비교합니다.',
  alternates: {
    canonical: '/pricing',
  },
};

const REPORT_PRICE_BY_SLUG: Record<string, string> = {
  'life-standard': '49,000원~79,000원',
  'yearly-2026': '39,000원~69,000원',
  'career-money': '49,000원~79,000원',
  'relationship-standard': '59,000원~89,000원',
  'family-report': '99,000원~129,000원',
  decision: '39,000원~69,000원',
  monthly: '1,900원부터',
  dialogue: '월 4,900원부터',
};

const CREDIT_PACKAGES = PAYMENT_PACKAGES.filter((item) => item.kind === 'credits' || item.id === 'subscription_30');
const DIALOGUE_PLANS = PLAN_BLUEPRINT.filter((plan) => plan.slug !== 'lifetime');
const ACTIVE_TEACHERS = ACTIVE_DALBIT_TEACHERS;
const TEACHER_BY_SLUG = new Map(DALBIT_TEACHERS.map((teacher) => [teacher.slug, teacher]));

function formatWon(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

export default function PricingPage() {
  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-8">
        <PageHero
          title="달빛인생 가격 한눈보기"
          description="처음부터 큰 결제를 고르지 않아도 됩니다. 무료 오늘운세와 타로를 본 뒤, 지금 궁금한 질문만 550원/990원으로 가볍게 이어보세요."
        />

        <SectionSurface surface="lunar" size="lg">
          <div className="app-starfield" />
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <SectionHeader
              eyebrow="무료 먼저, 결제는 나중에"
              title="오늘 궁금한 것만 작게 열어보는 구조입니다"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description="결제 화면은 압박용이 아니라 비교용입니다. 무료 결과가 마음에 남을 때만 오늘 자세히 보기, 연애 마음 확인, 돈이 새는 패턴 같은 작은 질문으로 이어집니다."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            />
            <ActionCluster className="lg:justify-end">
              <Link href="/saju/new" className="moon-cta-primary">
                무료 사주 먼저 보기
              </Link>
              <Link href="/today-fortune?concern=general" className="moon-action-secondary">
                무료 오늘운세 보기
              </Link>
            </ActionCluster>
          </div>
        </SectionSurface>

        <section>
          <SectionHeader
            eyebrow="작게 열어보기"
            title="550원/990원으로 지금 질문만 짧게 확인합니다"
            titleClassName="text-3xl"
            description="상품명은 전문용어가 아니라 사용자가 실제로 묻는 말로 보여줍니다."
            descriptionClassName="max-w-3xl"
          />
          <ProductGrid columns={4} className="mt-6">
            {TASTE_PRODUCTS.map((product) => {
              const teacher = TEACHER_BY_SLUG.get(product.teacherSlug);

              return (
                <Link
                  key={product.slug}
                  href={product.href}
                  className="group app-feature-card-soft min-h-[15rem] transition-colors hover:border-[var(--app-gold)]/36 hover:bg-[var(--app-gold)]/8"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="app-caption">{product.price}</div>
                    {teacher ? (
                      <div className="dalbit-product-teacher">
                        <span>{teacher.zodiac}</span>
                        {teacher.teacherName}
                      </div>
                    ) : null}
                  </div>
                  <h2 className="mt-3 font-display text-xl leading-7 text-[var(--app-ivory)]">
                    {product.title}
                  </h2>
                  <p className="mt-3 text-sm font-medium leading-6 text-[var(--app-gold-text)]">
                    {product.question}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--app-copy-muted)]">
                    {product.result}
                  </p>
                  <div className="mt-4 text-xs text-[var(--app-copy-soft)]">{product.status}</div>
                </Link>
              );
            })}
          </ProductGrid>
        </section>

        <section>
          <SectionHeader
            eyebrow="담당 선생"
            title="메뉴와 상품은 선생님 캐릭터 기준으로 확장합니다"
            titleClassName="text-3xl"
            description="지금은 사주, 타로, 궁합, 명리 선생을 먼저 연결하고, MBTI·손금·관상 선생은 다음 확장 메뉴로 남겨둡니다."
            descriptionClassName="max-w-3xl"
          />
          <ProductGrid columns={4} className="mt-6">
            {ACTIVE_TEACHERS.map((teacher) => (
              <FeatureCard
                key={teacher.slug}
                surface="soft"
                eyebrow={`${teacher.zodiac} · ${teacher.animal}`}
                title={teacher.teacherName}
                titleClassName="text-xl"
                description={teacher.productPosition}
                footer={
                  <Link
                    href={teacher.href}
                    className="text-sm font-medium text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                  >
                    {teacher.serviceTitle} 보기
                  </Link>
                }
              />
            ))}
          </ProductGrid>
        </section>

        <section>
          <SectionHeader
            eyebrow="길게 남겨둘 풀이"
            title="오래 다시 볼 내용은 뒤쪽에서 천천히 고릅니다"
            titleClassName="text-3xl"
            description="오늘운세와 타로보다 더 긴 사주풀이가 필요할 때만 선택합니다. 첫 화면에서는 소액 풀이보다 낮은 우선순위로 둡니다."
            descriptionClassName="max-w-3xl"
          />
          <ProductGrid columns={2} className="mt-6">
            {PRODUCT_REPORT_CATALOG.slice(0, 6).map((report) => (
              <FeatureCard
                key={report.slug}
                surface="soft"
                eyebrow={REPORT_PRICE_BY_SLUG[report.slug] ?? '가격 확인'}
                title={report.title}
                titleClassName="text-2xl"
                description={report.summary}
                footer={
                  <div className="space-y-3">
                    <p className="text-sm leading-7 text-[var(--app-copy-muted)]">{report.recommendation}</p>
                    <Link
                      href={report.href}
                      className="inline-flex text-sm font-medium text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                    >
                      {report.whatToCheck}
                    </Link>
                  </div>
                }
              />
            ))}
          </ProductGrid>
        </section>

        <section>
          <SectionHeader
            eyebrow="대화형 멤버십"
            title="풀이를 본 뒤 질문을 계속 이어가고 싶을 때"
            titleClassName="text-3xl"
            description="멤버십은 결과물을 대신하는 상품이 아니라, 이미 본 풀이를 생활 질문으로 이어가는 대화용 선택지입니다."
            descriptionClassName="max-w-3xl"
          />
          <ProductGrid columns={2} className="mt-6">
            {DIALOGUE_PLANS.map((plan) => (
              <FeatureCard
                key={plan.slug}
                surface="soft"
                eyebrow={plan.price}
                title={plan.title}
                titleClassName="text-2xl"
                description={plan.summary}
                footer={
                  <ActionCluster>
                    <Link
                      href={`/membership/checkout?plan=${plan.slug}&from=pricing`}
                      className={plan.slug === 'premium' ? 'moon-action-primary' : 'moon-action-secondary'}
                    >
                      {plan.slug === 'premium' ? '프리미엄 보기' : '라이트 보기'}
                    </Link>
                  </ActionCluster>
                }
              />
            ))}
          </ProductGrid>
        </section>

        <section>
          <SectionHeader
            eyebrow="코인팩"
            title="필요한 기능만 열어볼 때 쓰는 충전권"
            titleClassName="text-3xl"
            description="코인은 분야별 깊이보기, 달력, 일부 기능을 작게 열어볼 때 사용합니다. 이미 해금한 항목은 재열람 기준을 먼저 확인하도록 설계되어 있습니다."
            descriptionClassName="max-w-3xl"
          />
          <ProductGrid columns={4} className="mt-6">
            {CREDIT_PACKAGES.map((pack) => (
              <FeatureCard
                key={pack.id}
                surface="soft"
                eyebrow={formatWon(pack.price)}
                title={pack.name}
                titleClassName="text-xl"
                description={`${pack.credits}코인`}
                footer={
                  <Link
                    href="/credits"
                    className="text-sm font-medium text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                  >
                    코인 충전 화면으로 이동
                  </Link>
                }
              />
            ))}
          </ProductGrid>
        </section>
      </AppPage>
    </AppShell>
  );
}
