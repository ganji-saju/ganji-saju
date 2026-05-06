import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { Badge } from '@/components/ui/badge';
import { COMPLETE_PLAN_GUIDE, type PlanSlug } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

interface Props {
  searchParams: Promise<{ plan?: string; slug?: string; payment?: string }>;
}

const PLAN_LABELS = {
  basic: '라이트 대화 멤버십',
  premium: '프리미엄 대화 멤버십',
  lifetime: '보관형 사주 리포트',
} as const;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '결제 완료',
    description: '결제가 완료된 뒤 첫 이용 흐름을 안내하는 화면입니다.',
  };
}

export default async function MembershipCompletePage({ searchParams }: Props) {
  const { plan, slug, payment } = await searchParams;
  const planSlug = ((plan as PlanSlug | undefined) ?? 'premium') as PlanSlug;
  const planLabel = PLAN_LABELS[planSlug] ?? PLAN_LABELS.premium;
  const completeGuide = COMPLETE_PLAN_GUIDE[planSlug] ?? COMPLETE_PLAN_GUIDE.premium;
  const shouldOpenPremiumResult =
    payment === 'confirmed' && slug && (planSlug === 'lifetime' || planSlug === 'premium');

  if (shouldOpenPremiumResult) {
    redirect(`/saju/${encodeURIComponent(slug)}/premium?payment=confirmed&plan=${planSlug}`);
  }

  const primaryHref =
    slug && (planSlug === 'lifetime' || planSlug === 'premium')
      ? `/saju/${slug}/premium`
      : completeGuide.primaryHref;

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="status"
              className="border-[var(--app-pink)]/25 bg-[var(--app-pink)]/10 text-[var(--app-pink-strong)]"
            >
              {payment === 'confirmed' ? '결제 완료' : '이용 시작'}
            </Badge>,
            <Badge
              key="plan"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              {planLabel}
            </Badge>,
          ]}
          title="이제 달빛인생에서 바로 이어가실 수 있습니다"
          description={`${planLabel} 이용이 시작되었습니다. ${completeGuide.welcome}`}
        />

        <section className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="이제 열리는 것"
              title="결제 직후 가장 먼저 가져가실 흐름"
              titleClassName="text-3xl text-[var(--app-pink-strong)]"
            />

            <FeatureCard
              className="mt-6"
              surface="soft"
              eyebrow="환영 선물"
              title={completeGuide.giftTitle}
              description={completeGuide.giftBody}
            />

            <SectionHeader
              className="mt-8"
              eyebrow="지금 바로 해보시면 좋은 것"
              title="다음 한 걸음을 이렇게 권합니다"
              titleClassName="text-2xl text-[var(--app-ink)]"
            />

            <ProductGrid columns={3} className="mt-5">
              {completeGuide.nextSteps.map((item, index) => (
                <FeatureCard
                  key={item}
                  surface="soft"
                  eyebrow={String(index + 1).padStart(2, '0')}
                  description={item}
                />
              ))}
            </ProductGrid>
          </SectionSurface>

        </section>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="다음으로 이동"
            title="이제 한 가지를 골라 바로 이어가시면 됩니다"
            titleClassName="text-3xl"
            actions={
              <ActionCluster>
                <Link
                  href={primaryHref}
                  className="gangi-primary-button"
                >
                  {slug && planSlug === 'lifetime' ? '열린 보관형 리포트 보기' : completeGuide.primaryLabel}
                </Link>
                <Link
                  href="/"
                  className="gangi-secondary-button"
                >
                  홈으로 돌아가기
                </Link>
              </ActionCluster>
            }
          />
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
