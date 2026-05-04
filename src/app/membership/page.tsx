import Link from 'next/link';
import type { Metadata } from 'next';
import { SafetyNotice } from '@/components/common/safety-notice';
import { TrackedLink } from '@/components/common/tracked-link';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { ReportKeepsakeSection } from '@/components/report/report-keepsake-section';
import { AppShell } from '@/shared/layout/app-shell';
import {
  DALBIT_TEACHERS,
  INTERPRETATION_JOURNEY,
  MEMBERSHIP_REASSURANCE,
  PLAN_BLUEPRINT,
  QUESTION_ENTRY_POINTS,
  REPORT_PREVIEW_VALUE_POINTS,
  REPORT_SAMPLE_HREF,
  TASTE_PRODUCTS,
  TRUST_SIGNALS,
} from '@/content/moonlight';

const COLLECTIBLE_REPORTS = [
  {
    slug: 'life-standard',
    title: '보관형 사주 리포트',
    price: '49,000원~79,000원',
    summary: '타고난 성향·올해 흐름·선택 힌트 종합',
    recommendation: '내 사주의 바탕과 평생 흐름을 한 번의 결과물로 남기고 싶은 분',
    href: '/saju/new?product=life-standard',
    badge: '핵심',
    status: '지금 시작 가능',
  },
  {
    slug: 'yearly-2026',
    title: '2026 연간 운세 전략서',
    price: '39,000원~69,000원',
    summary: '월별 흐름·주의 달·기회 달',
    recommendation: '올해의 달별 전략과 timing을 미리 보고 싶은 분',
    href: '/saju/new?product=yearly-2026',
    badge: '시즌',
    status: '올해 흐름으로 연결',
  },
  {
    slug: 'relationship-standard',
    title: '궁합 보관 리포트',
    price: '59,000원~89,000원',
    summary: '관계 구조·갈등·보완점',
    recommendation: '두 사람의 맞물림과 부딪히는 지점을 관계 구조로 정리하고 싶은 분',
    href: '/compatibility?product=relationship-standard',
    badge: '관계',
    status: '궁합 흐름으로 연결',
  },
  {
    slug: 'family-report',
    title: '가족 명리 리포트',
    price: '99,000원~129,000원',
    summary: '부모·자녀·배우자 구조',
    recommendation: '가족 안에서 반복되는 역할과 충돌 지점을 함께 정리하고 싶은 분',
    href: '/membership?focus=family-report',
    badge: '가족',
    status: '준비 중',
  },
] as const;

const DIALOGUE_PLAN_GUIDES = {
  basic: {
    lead: '가볍게 묻고 월 2회 리포트 맛보기',
    body: '오늘의 흐름이나 지금 걸리는 질문을 부담 없이 여쭙고, 긴 사주풀이 미리보기를 조금씩 경험해보는 가장 가벼운 시작입니다.',
    cta: '라이트 멤버십 시작하기',
    href: '/membership/checkout?plan=basic&from=membership',
  },
  premium: {
    lead: '이미 본 풀이를 바탕으로 대화와 가족 해석을 넉넉하게 이어보기',
    body: '이미 읽은 풀이를 생활 질문과 가족 이야기, 궁합 해석까지 길게 붙여 쓰고 싶은 분께 맞는 중심 플랜입니다.',
    cta: '프리미엄 멤버십 시작하기',
    href: '/membership/checkout?plan=premium&from=membership',
  },
} as const;

const COMPARISON_ROWS = [
  {
    label: '출생 정보 확인',
    ai: '입력 문맥을 바탕으로 단순화될 수 있습니다.',
    moonlight: '출생 정보를 바탕으로 오늘 흐름과 사주풀이를 안정적으로 정리합니다.',
  },
  {
    label: '풀이 흐름',
    ai: '상담 흐름에 따라 해석 결이 흔들릴 수 있습니다.',
    moonlight: '전문 용어보다 사용자가 바로 읽을 수 있는 결론과 행동 힌트를 남깁니다.',
  },
  {
    label: '시간 처리',
    ai: '출생시각과 출생지의 경계 조건을 단순 처리하기 쉽습니다.',
    moonlight: '출생시각과 출생지를 확인해 시간대별 흐름을 더 조심스럽게 정리합니다.',
  },
  {
    label: '설명 방식',
    ai: '말은 자연스럽지만 왜 그렇게 보았는지가 화면에 남지 않을 수 있습니다.',
    moonlight: '판단 단서와 쉬운 설명을 나눠서 보여드립니다.',
  },
  {
    label: '보관 방식',
    ai: '대화가 끝나면 결과가 흩어지기 쉽습니다.',
    moonlight: 'PDF와 MY 보관함으로 오래 남깁니다.',
  },
  {
    label: '대화 연결',
    ai: '새 질문마다 설명 맥락이 새로 흔들릴 수 있습니다.',
    moonlight: '이미 본 풀이를 바탕으로 질문을 계속 이어갑니다.',
  },
] as const;

const CATALOG_PROOF_GROUPS = [
  {
    eyebrow: '입력 확인',
    title: '출생 정보를 먼저 확인하는 구조',
    points: [
      COMPARISON_ROWS[0].moonlight,
      COMPARISON_ROWS[1].moonlight,
      COMPARISON_ROWS[2].moonlight,
    ],
  },
  {
    eyebrow: '보관과 재확인',
    title: '읽고 끝나지 않는 보관형 리포트',
    points: [
      COMPARISON_ROWS[3].moonlight,
      COMPARISON_ROWS[4].moonlight,
    ],
  },
  {
    eyebrow: '대화 연결',
    title: '질문은 이미 본 풀이에서 이어집니다',
    points: [
      COMPARISON_ROWS[5].moonlight,
      '샘플 풀이를 먼저 보고 결정하셔도 됩니다.',
    ],
  },
] as const;

const TEACHER_BY_SLUG = new Map(DALBIT_TEACHERS.map((teacher) => [teacher.slug, teacher]));

const PRE_PURCHASE_LINKS = [
  {
    title: '샘플 풀이 보기',
    body: '결제 전에 결과물의 구조와 깊이를 먼저 확인합니다.',
    href: REPORT_SAMPLE_HREF,
  },
  {
    title: '풀이 안내 보기',
    body: '달빛인생이 결과를 어떻게 쉽게 정리하는지 모아둔 안내입니다.',
    href: '/about-engine',
  },
  {
    title: '풀이 예시 보기',
    body: '어려운 말보다 핵심 요약과 행동 힌트가 어떻게 보이는지 먼저 확인합니다.',
    href: '/about-engine#decision-trace',
  },
] as const;

export const metadata: Metadata = {
  title: '멤버십',
  description: '대화 멤버십과 소장형 사주 리포트를 나누어, 달빛인생의 플랜과 보관형 리포트를 함께 살펴보세요.',
  alternates: {
    canonical: '/membership',
  },
};

export default async function MembershipPage({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const focus = resolvedSearchParams.focus;
  const subscriptionPlans = PLAN_BLUEPRINT.filter((plan) => plan.slug !== 'lifetime');

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <SectionSurface surface="lunar" size="lg" className="app-mobile-safe-section">
          <div className="app-starfield" />
          <div className="grid gap-6 lg:grid-cols-[1fr_16rem] lg:items-center">
            <div>
              <SectionHeader
                eyebrow="소장형 리포트 · 대화형 멤버십"
                title="질문은 쉽게 고르고, 필요한 만큼만 이어봅니다"
                titleClassName="text-4xl leading-[1.3] sm:text-5xl"
                description="연애, 돈, 일, 가족, 올해 흐름처럼 실제 고민에서 시작하고, 필요할 때만 소액 풀이와 보관형 리포트로 이어집니다. 월간 플랜은 질문을 이어가는 대화용으로 보시면 됩니다."
                descriptionClassName="max-w-3xl text-[var(--app-copy)]"
                actions={
                  <ActionCluster>
                    <Link
                      href="/saju/new"
                      className="moon-cta-primary"
                    >
                      내 사주풀이 시작하기
                    </Link>
                    <Link href={REPORT_SAMPLE_HREF} className="app-top-action-link">
                      샘플 리포트 보기
                    </Link>
                  </ActionCluster>
                }
              />
            </div>
            <div className="hidden justify-self-end lg:block">
              <div className="app-moon-orb h-28 w-28" />
              <div className="mt-4 rounded-full border border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 px-4 py-2 text-center text-xs text-[var(--app-gold-text)]">
                소장형 리포트 · 대화 멤버십
              </div>
            </div>
          </div>
        </SectionSurface>

        <section className="mt-8">
          <SectionHeader
            eyebrow="질문형 상품 입구"
            title="어떤 상품인지보다, 어떤 질문에 답하는지 먼저 보이게 정리했습니다"
            titleClassName="text-3xl"
            description="사용자는 연애, 돈, 일, 가족, 올해 흐름처럼 자기 문제의 이름으로 들어올 때 훨씬 빠르게 이해합니다."
            descriptionClassName="max-w-3xl"
          />
          <ProductGrid columns={3} className="mt-6">
            {QUESTION_ENTRY_POINTS.map((entry) => (
              <FeatureCard
                key={entry.slug}
                surface="soft"
                eyebrow={entry.label}
                title={entry.question}
                titleClassName="text-xl"
                description={entry.reportAnswer}
                footer={
                  <Link
                    href={entry.href}
                    className="text-sm font-medium text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                  >
                    {entry.productName}
                  </Link>
                }
              />
            ))}
          </ProductGrid>
        </section>

        <section className="mt-8">
          <SectionHeader
            eyebrow="1. 소장형 리포트"
            title="먼저, 어떤 보관형 리포트를 남길지 고르실 수 있습니다"
            titleClassName="text-3xl"
            description="기본 리포트는 바탕을, 연간 전략서는 올해의 흐름을, 궁합과 가족 리포트는 관계 구조를 중심으로 정리합니다."
            descriptionClassName="max-w-3xl"
          />
          <ProductGrid columns={2}>
            {COLLECTIBLE_REPORTS.map((report) => {
              const isFocused = focus === report.slug;
              const isReady = report.slug !== 'family-report';

              return (
                <SectionSurface
                  as="article"
                  key={report.slug}
                  surface="panel"
                  className={`moon-plan-card ${isFocused ? 'moon-glow-border' : ''}`}
                  data-featured={isFocused ? 'true' : 'false'}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="app-caption">{report.badge}</div>
                      <div className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs text-[var(--app-copy-muted)]">
                        {isReady ? '지금 흐름 보기' : '준비 중'}
                      </div>
                    </div>
                    <div className="rounded-full border border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 px-3 py-1 text-xs text-[var(--app-gold-text)]">
                      {report.price}
                    </div>
                  </div>
                  <h2 className="mt-4 font-display text-3xl text-[var(--app-gold-text)]">{report.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{report.summary}</p>
                  <FeatureCard
                    className="mt-5"
                    surface="soft"
                    eyebrow="추천 대상"
                    description={report.recommendation}
                  />
                  <FeatureCard
                    className="mt-5"
                    surface="soft"
                    eyebrow="확인 내용"
                    description={report.status}
                  />
                  <ActionCluster className="mt-6">
                    <TrackedLink
                      href={report.href}
                      eventName="membership_report_card_click"
                      eventParams={{
                        reportSlug: report.slug,
                        href: report.href,
                        status: report.status,
                      }}
                      className="moon-action-primary"
                    >
                      {isReady ? '이 리포트 흐름 보기' : '준비 중인 흐름 보기'}
                    </TrackedLink>
                  </ActionCluster>
                </SectionSurface>
              );
            })}
          </ProductGrid>
        </section>

        <section className="mt-8">
          <SectionSurface surface="panel">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
              <div>
                <SectionHeader
                  eyebrow="결제 전 미리보기"
                  title="긴 설명보다 네 가지만 먼저 확인합니다"
                  titleClassName="text-3xl"
                  description="결과 예시 1장, 답하는 질문, 소장하면 남는 것, 대화 연결. 이 네 가지가 긴 풀이 구매 전에 보여야 할 핵심입니다."
                  descriptionClassName="max-w-2xl"
                />
                <ActionCluster className="mt-6">
                  <Link href={REPORT_SAMPLE_HREF} className="moon-action-primary">
                    샘플 리포트 보기
                  </Link>
                  <Link href="/saju/new" className="moon-action-secondary">
                    질문으로 시작하기
                  </Link>
                </ActionCluster>
              </div>
              <ProductGrid columns={2} className="gap-3">
                {REPORT_PREVIEW_VALUE_POINTS.map((item) => (
                  <FeatureCard
                    key={item.title}
                    surface="soft"
                    title={item.title}
                    titleClassName="text-xl"
                    description={item.body}
                  />
                ))}
              </ProductGrid>
            </div>
          </SectionSurface>
        </section>

        <section className="mt-8">
          <SectionHeader
            eyebrow="소액 맛보기"
            title="처음 결제는 작게, 담당 선생을 보고 고릅니다"
            titleClassName="text-3xl"
            description="소액 풀이는 어려운 상품명보다 오늘의 질문과 담당 선생이 먼저 보이도록 정리합니다."
            descriptionClassName="max-w-3xl"
          />
          <ProductGrid columns={4} className="mt-6">
            {TASTE_PRODUCTS.map((product) => {
              const teacher = TEACHER_BY_SLUG.get(product.teacherSlug);

              return (
                <FeatureCard
                  key={product.slug}
                  surface="soft"
                  eyebrow={teacher ? `${product.price} · ${teacher.teacherName}` : product.price}
                  title={product.title}
                  titleClassName="text-xl"
                  description={product.result}
                  footer={
                    <Link
                      href={product.href}
                      className="text-sm font-medium text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                    >
                      {product.question}
                    </Link>
                  }
                />
              );
            })}
          </ProductGrid>
        </section>

        <section className="mt-8">
          <SectionHeader
            eyebrow="2. 대화형 멤버십"
            title="풀이를 생활 질문으로 이어가고 싶을 때 월간 대화 플랜을 고르시면 됩니다"
            titleClassName="text-3xl"
            description="멤버십은 결과물을 대신하는 상품이 아니라, 이미 읽은 풀이와 오늘의 질문을 계속 이어가는 보조 레이어입니다."
            descriptionClassName="max-w-3xl"
          />
          <ProductGrid columns={2} className="lg:items-start">
            {subscriptionPlans.map((plan, index) => {
              const guide = DIALOGUE_PLAN_GUIDES[plan.slug];

              return (
                <SectionSurface
                  as="article"
                  key={plan.title}
                  surface="panel"
                  className={`moon-plan-card ${index === 1 ? 'lg:-translate-y-3 moon-glow-border' : ''}`}
                  data-featured={index === 1 ? 'true' : 'false'}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="app-caption">{plan.badge}</div>
                    <div className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs text-[var(--app-copy-muted)]">
                      {plan.price}
                    </div>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold text-[var(--app-ivory)]">
                    {plan.title}
                  </h2>
                  <div className="mt-4 rounded-[1.15rem] border border-[var(--app-gold)]/18 bg-[var(--app-surface-muted)] px-4 py-4">
                    <div className="app-caption">이 플랜이 맞는 순간</div>
                    <div className="mt-2 text-sm font-semibold text-[var(--app-gold-text)]">{guide.lead}</div>
                    <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{guide.body}</p>
                  </div>
                  <p className="mt-4 max-w-sm text-sm leading-7 text-[var(--app-copy)]">{plan.summary}</p>
                  <p className="mt-3 text-sm text-[var(--app-copy-muted)]">{plan.fit}</p>

                  <BulletList className="mt-5 text-sm text-[var(--app-copy)]" items={[...plan.features]} />

                  <FeatureCard
                    className="mt-5"
                    surface="soft"
                    eyebrow="리포트와 이어지는 방식"
                    children={
                      <BulletList
                        className="text-sm text-[var(--app-copy-muted)]"
                        markerClassName="text-[var(--app-gold)]/62"
                        items={[...plan.opens]}
                      />
                    }
                  />

                  <ActionCluster className="mt-6">
                    <Link
                      href={guide.href}
                      className={
                        index === 1
                          ? 'moon-action-primary'
                          : 'moon-action-muted'
                      }
                    >
                      {guide.cta}
                    </Link>
                  </ActionCluster>
                </SectionSurface>
              );
            })}
          </ProductGrid>
        </section>

        <section className="mt-8">
          <SectionSurface surface="panel" size="lg">
            <div className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr] lg:items-start">
              <div>
                <SectionHeader
                  eyebrow="3. 결정 전에 확인할 것"
                  title="비교와 도움말도 상품 결정에 필요한 만큼만 남겼습니다"
                  titleClassName="text-3xl"
                  description="결제 전에 먼저 봐도 좋은 샘플 풀이와 내 질문에 맞는 상품을 한곳에 모았습니다."
                  descriptionClassName="max-w-3xl"
                />

                <ProductGrid columns={3} className="mt-6">
                  {CATALOG_PROOF_GROUPS.map((group) => (
                    <FeatureCard
                      key={group.title}
                      surface="soft"
                      eyebrow={group.eyebrow}
                      title={group.title}
                      titleClassName="text-2xl"
                      children={<BulletList className="text-sm text-[var(--app-copy)]" items={group.points} />}
                    />
                  ))}
                </ProductGrid>

                <FeatureCard
                  className="mt-6"
                  surface="soft"
                  eyebrow="플랜 선택"
                  children={
                    <div className="grid gap-3">
                      {INTERPRETATION_JOURNEY.map((step) => (
                        <div
                          key={step.title}
                          className="rounded-[1rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.02)] px-4 py-4"
                        >
                          <div className="text-sm font-medium text-[var(--app-ivory)]">{step.title}</div>
                          <p className="mt-2 text-sm leading-7 text-[var(--app-copy-muted)]">{step.body}</p>
                        </div>
                      ))}
                    </div>
                  }
                />
              </div>

              <div className="space-y-4">
                <SectionSurface surface="lunar">
                  <div className="app-starfield" />
                  <SectionHeader
                    eyebrow="결제 전 확인"
                    title="샘플 풀이를 먼저 보셔도 괜찮습니다"
                    titleClassName="text-3xl text-[var(--app-gold-text)]"
                    description="리포트를 먼저 만들면 무엇이 내 바탕인지가 남고, 이후의 대화는 그 흐름 위에서 훨씬 덜 흔들립니다. 아직 망설이신다면 아래 세 가지부터 보셔도 좋습니다."
                    descriptionClassName="text-[var(--app-copy)]"
                  />
                  <div className="mt-6 grid gap-3">
                    {PRE_PURCHASE_LINKS.map((item) => (
                      <FeatureCard
                        key={item.title}
                        surface="soft"
                        title={item.title}
                        titleClassName="text-xl"
                        description={item.body}
                        footer={
                          <Link
                            href={item.href}
                            className="text-sm text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                          >
                            바로 보기
                          </Link>
                        }
                      />
                    ))}
                  </div>
                  <ActionCluster className="mt-6">
                    <Link
                      href="/saju/new"
                      className="moon-cta-primary"
                    >
                      내 사주풀이 시작하기
                    </Link>
                    <Link
                      href={REPORT_SAMPLE_HREF}
                      className="moon-action-secondary"
                    >
                      샘플 리포트 보기
                    </Link>
                  </ActionCluster>
                </SectionSurface>

                <ProductGrid columns={2}>
                  {MEMBERSHIP_REASSURANCE.map((item) => (
                    <FeatureCard
                      key={item}
                      surface="soft"
                      description={item}
                    />
                  ))}
                </ProductGrid>
              </div>
            </div>
          </SectionSurface>

          <ReportKeepsakeSection className="mt-8" />
        </section>

        <section className="mt-8">
          <SectionSurface surface="panel">
            <SectionHeader
              eyebrow="구매 전 확인"
              title="무리한 공포 표현보다, 다시 확인 가능한 풀이를 앞에 둡니다"
              titleClassName="text-3xl"
              description="달빛인생의 전환 장치는 과장된 적중률이 아니라 저장, 재열람, 출생 정보 확인, 안전한 표현입니다."
              descriptionClassName="max-w-3xl"
            />
            <ProductGrid columns={3} className="mt-6">
              {TRUST_SIGNALS.map((signal) => (
                <FeatureCard
                  key={signal.title}
                  surface="soft"
                  title={signal.title}
                  titleClassName="text-xl"
                  description={signal.body}
                />
              ))}
            </ProductGrid>
          </SectionSurface>
        </section>

        <section className="mt-8">
          <SafetyNotice variant="finance" />
        </section>
      </div>
    </AppShell>
  );
}
