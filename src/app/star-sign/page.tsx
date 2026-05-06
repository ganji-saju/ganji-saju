import Link from 'next/link';
import type { Metadata } from 'next';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { Badge } from '@/components/ui/badge';
import {
  STAR_SIGN_BLUEPRINT,
  STAR_SIGN_META,
} from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { STAR_SIGN_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug, buildStarSignSlugFromProfile } from '@/lib/profile-personalization';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '별자리',
  description:
    '별자리 메인 화면에서 오늘의 별자리와 사주 크로스 관점을 함께 읽어보세요.',
  alternates: {
    canonical: '/star-sign',
  },
};

export default async function StarSignPage() {
  const profile = await getOptionalSignedInProfile();
  const personalizedSlug = buildStarSignSlugFromProfile(profile);
  const readingSlug = buildProfileReadingSlug(profile);
  const featured =
    STAR_SIGN_FORTUNES.find(
      (item) => item.slug === (personalizedSlug ?? STAR_SIGN_BLUEPRINT.featuredSlug)
    ) ??
    STAR_SIGN_FORTUNES[0];

  const featuredMeta = STAR_SIGN_META[featured.slug as keyof typeof STAR_SIGN_META];
  const hasPersonalizedProfile = Boolean(profile && personalizedSlug);

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="star-sign"
              className="border-[var(--app-sky)]/25 bg-[var(--app-sky)]/10 text-[var(--app-sky)]"
            >
              별자리
            </Badge>,
            <Badge
              key="free"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              빠른 무료 탐색
            </Badge>,
          ]}
          title="별빛 언어로 오늘의 감정선을 먼저 읽습니다"
          description="오늘 마음에 닿는 별자리 흐름을 바로 확인하세요."
        />

        <SectionSurface surface="panel" size="lg" className="text-center">
            <SectionHeader
              eyebrow={hasPersonalizedProfile ? 'MY 프로필 기준 별자리' : '오늘의 별자리'}
              title={hasPersonalizedProfile ? `선생님은 ${featured.label}` : featured.label}
              titleClassName="text-3xl text-[var(--app-sky)]"
              description={featured.dateRange}
              descriptionClassName="mx-auto text-[var(--app-copy-muted)]"
            />
            <div className="mt-6 text-6xl">{featuredMeta.symbol}</div>
            <FeatureCard
              className="mt-6 text-left"
              surface="soft"
              eyebrow="오늘 먼저 닿는 흐름"
              title={featured.summary}
              description={featured.action}
            />
            <ActionCluster className="mt-5">
              <Link href={`/star-sign/${featured.slug}`} className="gangi-primary-button">
                {hasPersonalizedProfile ? '내 별자리 바로 보기' : '별자리 흐름 자세히 보기'}
              </Link>
              <Link href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'} className="gangi-secondary-button">
                {readingSlug ? '내 사주와 함께 보기' : '사주와 함께 보기'}
              </Link>
            </ActionCluster>
        </SectionSurface>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="12별자리"
            title="각 별자리의 한 줄 인상"
            titleClassName="text-3xl"
          />

          <ProductGrid columns={3} className="mt-6">
            {STAR_SIGN_FORTUNES.map((item) => {
              const meta = STAR_SIGN_META[item.slug as keyof typeof STAR_SIGN_META];

              return (
                <FeatureCard
                  key={item.slug}
                  surface="soft"
                  eyebrow={`${meta.symbol} ${item.dateRange}`}
                  title={item.label}
                  description={
                    <>
                      <span className="block">{meta.seniorCopy}</span>
                      <span className="mt-2 block text-[var(--app-copy-muted)]">{item.todayFocus}</span>
                    </>
                  }
                  footer={
                    <Link
                      href={`/star-sign/${item.slug}`}
                      className="inline-flex items-center gap-2 text-sm text-[var(--app-sky)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                    >
                      이 별자리 읽기
                    </Link>
                  }
                />
              );
            })}
          </ProductGrid>
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
