import Link from 'next/link';
import type { Metadata } from 'next';
import { GangiStarSignIcon } from '@/components/gangi/gangi-star-sign';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
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
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-6">
        <PageHero
          badges={[
            <Badge
              key="star-sign"
              className="border-[var(--app-sky)]/25 bg-[var(--app-sky)]/10 text-[var(--app-sky-text)]"
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
          title="별자리를 골라 오늘운을 보세요"
          description="열두 별자리 중 내 별자리를 누르면 바로 오늘 흐름을 볼 수 있습니다."
        />

        <section className="gangi-card-panel p-5">
          <SectionHeader
            eyebrow="12별자리 바로 선택"
            title="내 별자리를 골라보세요"
            titleClassName="text-2xl"
          />
          <div className="gangi-star-sign-grid mt-5">
            {STAR_SIGN_FORTUNES.map((item) => {
              const meta = STAR_SIGN_META[item.slug as keyof typeof STAR_SIGN_META];

              return (
                <Link
                  key={item.slug}
                  href={`/star-sign/${item.slug}`}
                  className="gangi-star-sign-card"
                  data-active={item.slug === featured.slug ? 'true' : undefined}
                >
                  <GangiStarSignIcon slug={item.slug} symbol={meta.symbol} size="sm" />
                  <strong>{item.label}</strong>
                  <em>{item.dateRange}</em>
                </Link>
              );
            })}
          </div>
        </section>

        <SectionSurface surface="panel" size="lg" className="text-center">
            <SectionHeader
              eyebrow={hasPersonalizedProfile ? 'MY 프로필 기준 별자리' : '오늘의 별자리'}
              title={hasPersonalizedProfile ? `선생님은 ${featured.label}` : featured.label}
              titleClassName="text-3xl text-[var(--app-sky-text)]"
              description={featured.dateRange}
              descriptionClassName="mx-auto text-[var(--app-copy-muted)]"
            />
            <GangiStarSignIcon
              slug={featured.slug}
              symbol={featuredMeta.symbol}
              size="lg"
              className="mx-auto mt-6"
            />
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
      </AppPage>
    </AppShell>
  );
}
