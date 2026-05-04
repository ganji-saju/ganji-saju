import Link from 'next/link';
import type { Metadata } from 'next';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import { Badge } from '@/components/ui/badge';
import { ZODIAC_META } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ZODIAC_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug, buildZodiacSlugFromProfile } from '@/lib/profile-personalization';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

const ZODIAC_POINTS = [
  '달빛인생의 띠는 사주 결과와 같은 입춘 기준으로 맞춥니다.',
  '1982년 1월 29일처럼 입춘 전 생일은 단순 연도표와 다르게 닭띠로 읽을 수 있습니다.',
  '띠운세는 내 띠 하나만 먼저 보고, 더 깊은 기준은 사주 결과로 이어집니다.',
] as const;

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
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
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
          title="내 띠 하나만 먼저 봅니다"
          description="띠운세는 12개를 모두 펼쳐 비교하는 화면보다, 저장된 생년월일로 계산한 내 띠를 먼저 보여주는 편이 더 정확하고 덜 헷갈립니다."
        />

        <section className="grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
          <SectionSurface surface="panel" size="lg" className="text-center">
            <SectionHeader
              eyebrow={hasPersonalizedProfile ? 'MY 프로필 기준' : '먼저 내 띠 확인'}
              title={hasPersonalizedProfile && featured ? `내 띠는 ${featured.label}` : '생년월일을 넣으면 내 띠만 보여드립니다'}
              titleClassName="text-3xl text-[var(--app-ink)]"
              description={
                hasPersonalizedProfile && featured
                  ? '사주 결과와 같은 입춘 기준으로 계산했습니다.'
                  : '연도만 보는 표가 아니라 생년월일을 함께 봐야 입춘 전후가 정확히 맞습니다.'
              }
              descriptionClassName="mx-auto text-[var(--app-copy-muted)]"
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
              <FeatureCard
                className="mt-6 text-left"
                surface="soft"
                eyebrow="입춘 전후 보정"
                description="예를 들어 1982년 1월 29일은 단순 연도표로는 개띠처럼 보일 수 있지만, 사주 기준으로는 입춘 전이라 닭띠로 읽는 흐름이 맞습니다."
              />
            )}
          </SectionSurface>

          <SupportRail
            surface="lunar"
            eyebrow="띠운세 기준"
            title="연도표가 아니라 생년월일 기준으로 맞춥니다"
            description="같은 1982년생이라도 입춘 전후에 따라 띠가 달라질 수 있습니다. 그래서 달빛인생은 사주 결과와 같은 기준으로 띠를 맞춥니다."
          >
            {hasPersonalizedProfile ? (
              <FeatureCard
                surface="soft"
                eyebrow="내 띠만 먼저"
                description="저장된 생년월일로 내 띠를 먼저 보여드립니다. 다른 띠는 기본 화면에서 펼치지 않습니다."
              />
            ) : null}
            <BulletList className={hasPersonalizedProfile ? 'mt-5' : ''} items={ZODIAC_POINTS} />
            <ActionCluster className="mt-5">
              {featured ? (
                <Link href={`/zodiac/${featured.slug}`} className="moon-cta-primary">
                  내 띠 바로 보기
                </Link>
              ) : null}
              <Link href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'} className="moon-cta-secondary">
                {readingSlug ? '내 사주로 이어보기' : '생년월일로 내 띠 확인'}
              </Link>
            </ActionCluster>
          </SupportRail>
        </section>

        <SectionSurface surface="panel" size="md">
          <SectionHeader
            eyebrow="헷갈릴 때"
            title="띠가 다르게 보이면 생년월일로 다시 맞춰보세요"
            titleClassName="text-2xl"
            description="띠운세는 다른 띠를 나열하기보다 내 생년월일 기준으로 하나만 보는 편이 더 편합니다. 특히 1월, 2월 초 출생은 입춘 전후를 함께 확인해야 합니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            actions={
              <ActionCluster>
                <Link href="/saju/new" className="moon-cta-primary">
                  생년월일로 다시 확인
                </Link>
              </ActionCluster>
            }
          />
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
