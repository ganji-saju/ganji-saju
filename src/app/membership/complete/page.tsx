import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
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

const COMPLETE_FLOW_POINTS = [
  '먼저 열린 결과나 멤버십 화면에서 오늘 바로 해보실 한 가지를 고릅니다.',
  '보관형 리포트는 PDF와 보관함, 대화로 이어지고 멤버십은 질문을 계속 이어가는 데 맞춰집니다.',
  '결제가 끝난 뒤에도 같은 흐름 위에서 다시 펼쳐볼 수 있도록 연결해 둡니다.',
] as const;

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
              className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]"
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
            <div className="app-starfield" />
            <SectionHeader
              eyebrow="이제 열리는 것"
              title="결제 직후 가장 먼저 가져가실 흐름"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description="한 번에 많은 기능을 나열하기보다, 지금 바로 해보시면 좋은 순서를 먼저 보여드립니다."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
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
              titleClassName="text-2xl text-[var(--app-ivory)]"
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

          <SupportRail
            surface="panel"
            eyebrow="이용 방식"
            title="결제는 끝났고, 이제 같은 흐름으로 이어집니다"
            description="리포트, 보관함, 대화가 서로 따로 노는 것이 아니라 한 흐름으로 이어진다는 점을 먼저 보여드립니다."
          >
            <BulletList items={COMPLETE_FLOW_POINTS} />
            <FeatureCard
              className="mt-5"
              surface="soft"
              eyebrow="열린 화면"
              description={slug && planSlug === 'lifetime' ? '선택하신 사주 결과에 연결된 보관형 리포트를 바로 열 수 있습니다.' : '지금 선택하신 상품에 맞는 다음 화면으로 자연스럽게 이어집니다.'}
            />
          </SupportRail>
        </section>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="다음으로 이동"
            title="이제 한 가지를 골라 바로 이어가시면 됩니다"
            titleClassName="text-3xl"
            description="주 행동 하나와 보조 행동 하나만 남겨, 완료 화면에서 다시 길을 잃지 않도록 정리했습니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
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
