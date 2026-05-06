import Link from 'next/link';
import type { Metadata } from 'next';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { Badge } from '@/components/ui/badge';
import { ZODIAC_META } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ZODIAC_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug, buildZodiacSlugFromProfile } from '@/lib/profile-personalization';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';
import { GANGI_ZODIAC, GangiCharacter } from '@/components/gangi/gangi-ui';

export const metadata: Metadata = {
  title: '내 띠 운세',
  description:
    '생년월일과 입춘 기준으로 내 띠를 먼저 확인하고 오늘의 흐름을 가볍게 살펴보세요.',
  alternates: {
    canonical: '/zodiac',
  },
};

export default async function ZodiacPage() {
  const profile = await getOptionalSignedInProfile();
  const personalizedSlug = buildZodiacSlugFromProfile(profile);
  const readingSlug = buildProfileReadingSlug(profile);
  const featured =
    personalizedSlug ? ZODIAC_FORTUNES.find((item) => item.slug === personalizedSlug) ?? null : null;
  const featuredMeta = featured ? ZODIAC_META[featured.slug as keyof typeof ZODIAC_META] : null;
  const hasPersonalizedProfile = Boolean(profile && personalizedSlug);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-6">
        <PageHero
          badges={[
            <Badge
              key="zodiac"
              className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]"
            >
              띠운세
            </Badge>,
            <Badge
              key="free"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              빠른 무료 탐색
            </Badge>,
          ]}
          title="내 띠 하나를 먼저 봅니다"
        />

        <section className="gangi-card-panel p-5">
          <SectionHeader
            eyebrow="12띠 바로 선택"
            title="띠를 골라 오늘운을 보세요"
            titleClassName="text-2xl"
          />
          <div className="mt-5 grid grid-cols-4 gap-2">
            {GANGI_ZODIAC.map((zodiac) => (
              <Link
                key={zodiac.key}
                href={`/zodiac/${zodiac.key}`}
                className="rounded-[0.9rem] border border-[var(--app-line)] bg-white px-2 py-3 text-center"
              >
                <GangiCharacter zodiac={zodiac.key} size="sm" className="mx-auto" />
                <span className="mt-1.5 block text-[11px] font-black text-[var(--app-ink)]">{zodiac.name}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-6">
          <SectionSurface surface="panel" size="lg" className="text-center">
            <SectionHeader
              eyebrow={hasPersonalizedProfile ? '내 띠' : '생년월일로 확인'}
              title={hasPersonalizedProfile && featured ? `내 띠는 ${featured.label}` : '내 띠를 자동으로 맞춰볼까요?'}
              titleClassName="text-3xl text-[var(--app-ink)]"
            />
            <div className="mt-6 text-6xl">{featuredMeta?.symbol ?? '🎂'}</div>
            {featured && featuredMeta ? (
              <FeatureCard
                className="mt-6 text-left"
                surface="soft"
                eyebrow={`${featured.label}의 2026년`}
                description={`${featuredMeta.yearlyMessage}. ${featured.todayFocus}`}
              />
            ) : (
              <ActionCluster className="mt-6">
                <Link href="/saju/new" className="gangi-primary-button">
                  생년월일로 내 띠 확인
                </Link>
              </ActionCluster>
            )}
          </SectionSurface>

          <ActionCluster>
            {featured ? (
              <Link href={`/zodiac/${featured.slug}`} className="gangi-primary-button">
                내 띠 바로 보기
              </Link>
            ) : null}
            <Link href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'} className="gangi-secondary-button">
              {readingSlug ? '내 사주로 이어보기' : '생년월일로 확인'}
            </Link>
          </ActionCluster>
        </section>
      </AppPage>
    </AppShell>
  );
}
