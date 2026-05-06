import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { Badge } from '@/components/ui/badge';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '명리',
  description: '타고난 기질, 다섯 기운, 반복되는 관계 패턴을 쉬운 말로 확인하는 달빛인생 명리 화면입니다.',
  alternates: {
    canonical: '/myeongri',
  },
};

const EXPLORATIONS = [
  {
    title: '타고난 기질',
    body: '내가 어떤 상황에서 편해지고, 어떤 장면에서 예민해지는지 기본 결을 살펴봅니다.',
    hook: '나는 어떤 결의 사람인가',
    href: '/saju/new',
    badge: '기질',
  },
  {
    title: '다섯 기운의 균형',
    body: '무엇이 넘치고 무엇이 부족한지, 일상에서 어떤 방식으로 힘이 붙거나 빠지는지 살펴봅니다.',
    hook: '내 안의 다섯 기운은 어디서 흔들리는가',
    href: '/saju/new',
    badge: '균형',
  },
  {
    title: '반복되는 관계 패턴',
    body: '돈, 일, 사람, 책임이 내 삶에서 어떤 모습으로 반복되는지 쉽게 풀어봅니다.',
    hook: '왜 늘 비슷한 관계와 역할이 반복되는가',
    href: '/myeongri/ten-gods',
    badge: '패턴',
  },
] as const;

export default async function MyeongriPage() {
  const profile = await getOptionalSignedInProfile();
  const readingSlug = buildProfileReadingSlug(profile);

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="myeongri"
              className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]"
            >
              명리 쉽게 보기
            </Badge>,
            <Badge
              key="scope"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              일간 · 오행 · 십신
            </Badge>,
          ]}
          title="내 안에서 반복되는 패턴을 바로 봅니다"
          description="긴 개념 설명 대신, 내 결과로 이어지는 입구만 남겼습니다."
        />

        <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="내 패턴의 바탕"
              title="반복되는 장면의 이유를 내 사주 위에서 확인합니다"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
            />

            <ProductGrid columns={3} className="mt-6">
              {EXPLORATIONS.map((item) => (
                <FeatureCard
                  key={item.title}
                  surface="soft"
                  eyebrow={item.badge}
                  title={item.title}
                  description={item.hook}
                />
              ))}
            </ProductGrid>
        </SectionSurface>

        {readingSlug ? (
          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="내 사주로 이어보기"
              title="내 사주 위에서 바로 확인할 수 있습니다"
              titleClassName="text-3xl"
              actions={
                <ActionCluster>
                  <Link
                    href={`/saju/${readingSlug}`}
                    className="gangi-primary-button"
                  >
                    내 통합 결과 보기
                  </Link>
                  <Link
                    href={`/saju/${readingSlug}/elements`}
                    className="gangi-secondary-button"
                  >
                    내 오행 바로 보기
                  </Link>
                </ActionCluster>
              }
            />
          </SectionSurface>
        ) : null}

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="탐구 주제"
            title="명리 안에서 가장 자주 다시 보게 되는 세 가지"
            titleClassName="text-3xl"
          />

          <ProductGrid columns={3} className="mt-6">
            {EXPLORATIONS.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[22px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-5 transition-colors hover:bg-[rgba(255,255,255,0.05)]"
              >
                <div className="app-caption text-[var(--app-gold-soft)]">{item.badge}</div>
                <div className="mt-3 text-xl font-semibold text-[var(--app-ivory)]">{item.title}</div>
                <div className="mt-4 text-sm font-medium text-[var(--app-gold-text)] transition-transform group-hover:translate-x-1">
                  {item.hook} →
                </div>
              </Link>
            ))}
          </ProductGrid>
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
