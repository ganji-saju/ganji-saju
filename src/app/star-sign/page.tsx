import Link from 'next/link';
import type { Metadata } from 'next';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
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

const STAR_SIGN_POINTS = [
  '별자리는 오늘 감정의 결과 관계 온도를 빠르게 읽는 데 잘 맞습니다.',
  '더 깊은 반복 패턴과 시기 흐름은 사주 결과와 함께 볼 때 훨씬 또렷해집니다.',
  '무료 탐색은 가볍게, 맞춤 해석은 프리미엄 흐름으로 분리합니다.',
] as const;

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
          description="별자리는 오늘 마음의 결과 관계 온도를 가볍게 읽는 입구입니다. 익숙한 언어로 먼저 흐름을 보고, 더 깊은 바탕은 사주 해석으로 이어가실 수 있습니다."
        />

        <section className="grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
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
          </SectionSurface>

          <SupportRail
            surface="panel"
            eyebrow="별자리 × 사주"
            title="빠른 탐색과 깊은 해석의 역할을 분명히 나눕니다"
            description="별자리 흐름은 가볍게 먼저 보고, 더 깊은 반복 패턴은 사주와 겹쳐 읽는 쪽이 가장 자연스럽습니다."
          >
            {hasPersonalizedProfile ? (
              <FeatureCard
                surface="soft"
                eyebrow="약한 개인화 연결"
                description="저장된 MY 프로필 생일 기준으로 선생님의 별자리를 먼저 보여드렸습니다. 이 흐름은 감정의 입구이고, 더 깊은 기준은 사주 결과로 이어집니다."
              />
            ) : null}
            <BulletList className={hasPersonalizedProfile ? 'mt-5' : ''} items={STAR_SIGN_POINTS} />
            <ActionCluster className="mt-5">
              <Link href={`/star-sign/${featured.slug}`} className="gangi-primary-button">
                {hasPersonalizedProfile ? '내 별자리 바로 보기' : '별자리 흐름 자세히 보기'}
              </Link>
              <Link href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'} className="gangi-secondary-button">
                {readingSlug ? '내 사주와 함께 보기' : '사주와 함께 보기'}
              </Link>
            </ActionCluster>
          </SupportRail>
        </section>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="12별자리"
            title="각 별자리의 한 줄 인상"
            titleClassName="text-3xl"
            description="무료 탐색군에서도 카드 밀도를 통일해, 어떤 별자리를 열어도 같은 문법으로 읽히게 정리했습니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
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
