import Link from 'next/link';
import type { Metadata } from 'next';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import { Badge } from '@/components/ui/badge';
import { SAFE_REDIRECT_RESOURCES } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: 'SAFE_REDIRECT',
  description: '위기 감지 시 안전 자원으로 연결하는 전용 상태 화면입니다.',
};

export default function SafeRedirectPage() {
  const primary = SAFE_REDIRECT_RESOURCES[0];
  const primaryPhoneHref = `tel:${primary.phone.replace(/[^\d+]/g, '')}`;

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="safe"
              className="border-[var(--app-coral)]/32 bg-[var(--app-coral)]/10 text-[var(--app-coral)]"
            >
              SAFE_REDIRECT
            </Badge>,
          ]}
          title="위기 상황에서는 사주 해석보다 먼저 안전으로 연결합니다"
          description="위기·의료·법률·투자처럼 고위험 판단이 걸린 순간에는, 간지사주이 공감의 말과 함께 즉시 전문 자원으로 연결하는 전용 상태입니다."
        />

        <section className="grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="대화 예시"
              title="지금은 해석보다 연결이 먼저입니다"
              titleClassName="text-3xl"
              description="공감의 말로만 머무르지 않고, 실제로 지금 연결하실 수 있는 자원을 먼저 보여드리는 것이 이 화면의 역할입니다."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            />

            <div className="mt-6 space-y-4">
              <div className="flex justify-end">
                <div className="max-w-[18rem] rounded-[1.2rem] bg-[var(--app-surface-muted)] px-4 py-4 text-sm leading-7 text-[var(--app-ivory)]">
                  요즘 너무 힘들어서
                  <br />
                  그만 살고 싶어요
                </div>
              </div>

              <FeatureCard
                surface="soft"
                eyebrow="간지사주의 응답"
                description={
                  <>
                    지금 많이 힘드시군요. 그 마음을 혼자 짊어지지 않으셨으면 합니다.
                    <br />
                    저는 사주를 봐드리는 곳이지만, 지금 이 순간 가장 도움이 될 분들이 계십니다.
                  </>
                }
              />
            </div>
          </SectionSurface>

          <SupportRail
            surface="panel"
            eyebrow="지금 연결하실 수 있는 곳"
            title={primary.label}
            description={`${primary.detail} ${primary.note}`}
          >
            <FeatureCard
              surface="soft"
              eyebrow="전화"
              title={primary.phone}
            />
            <ActionCluster className="mt-5">
              <a href={primaryPhoneHref} className="gangi-primary-button">
                바로 전화 걸기
              </a>
              <Link href="/dialogue" className="gangi-secondary-button">
                대화 화면으로 돌아가기
              </Link>
            </ActionCluster>
          </SupportRail>
        </section>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="다른 안전 연결 예시"
            title="상황에 따라 먼저 연결할 수 있는 자원들"
            titleClassName="text-3xl"
            description="의료, 법률, 투자, 애도처럼 성격이 다른 고위험 장면도 사주 해석과 분리해 안전 자원으로 안내합니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
          />

          <ProductGrid columns={3} className="mt-6">
            {SAFE_REDIRECT_RESOURCES.slice(1).map((resource) => (
              <FeatureCard
                key={resource.category}
                surface="soft"
                eyebrow={resource.label}
                title={resource.phone}
                description={
                  <>
                    <span className="block">{resource.detail}</span>
                    <span className="mt-2 block text-[var(--app-copy-muted)]">{resource.note}</span>
                  </>
                }
              />
            ))}
          </ProductGrid>
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
