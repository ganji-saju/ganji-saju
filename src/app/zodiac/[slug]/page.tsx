import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ActionCluster } from '@/components/layout/action-cluster';
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

interface Props {
  params: Promise<{ slug: string }>;
}

function getZodiac(slug: string) {
  return ZODIAC_FORTUNES.find((item) => item.slug === slug);
}

export async function generateStaticParams() {
  return ZODIAC_FORTUNES.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = getZodiac(slug);

  if (!item) return { title: '내 띠 운세' };

  return {
    title: `${item.label} 운세`,
    description: `${item.label}의 오늘 포인트와 가볍게 실천할 행동을 확인하는 달빛인생 띠운세입니다.`,
    alternates: {
      canonical: `/zodiac/${item.slug}`,
    },
  };
}

export default async function ZodiacDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = getZodiac(slug);

  if (!item) notFound();

  const profile = await getOptionalSignedInProfile();
  const personalizedSlug = buildZodiacSlugFromProfile(profile);
  const readingSlug = buildProfileReadingSlug(profile);
  const personalizedItem =
    personalizedSlug ? ZODIAC_FORTUNES.find((entry) => entry.slug === personalizedSlug) ?? null : null;

  if (personalizedItem && personalizedItem.slug !== item.slug) {
    redirect(`/zodiac/${personalizedItem.slug}`);
  }

  const isPersonalizedMatch = personalizedSlug === item.slug;
  const meta = ZODIAC_META[item.slug as keyof typeof ZODIAC_META];

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="zodiac"
              className="border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]"
            >
              {meta.symbol} {item.label}
            </Badge>,
            <Badge
              key="basis"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              입춘 기준
            </Badge>,
          ]}
          title={`${item.label} 오늘 흐름`}
          description={`${meta.yearlyMessage}. 길게 비교하기보다 오늘 붙잡을 포인트와 행동 하나만 먼저 정리해드립니다.`}
        />

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionSurface surface="panel" size="lg" className="text-center">
            <SectionHeader
              eyebrow="올해 먼저 읽는 기조"
              title={item.label}
              titleClassName="text-3xl text-[var(--app-ink)]"
              description={meta.yearlyMessage}
              descriptionClassName="mx-auto max-w-xl text-[var(--app-copy)]"
            />
            <div className="mt-6 text-7xl">{meta.symbol}</div>
          </SectionSurface>

          <SupportRail
            surface="lunar"
            eyebrow="오늘 붙잡을 포인트"
            title="오늘 바로 참고할 것만 남깁니다"
            description="띠운세는 12띠를 비교하는 화면보다 내 띠의 오늘 포인트를 빠르게 확인할 때 가장 편합니다."
          >
            {personalizedItem ? (
              <FeatureCard
                surface="soft"
                eyebrow="MY 프로필 기준"
                description={
                  isPersonalizedMatch
                    ? `저장된 생년월일을 입춘 기준으로 계산해 ${personalizedItem.label}로 맞췄습니다.`
                    : `저장된 생년월일 기준으로는 ${personalizedItem.label}입니다. 내 띠 화면으로 다시 맞춥니다.`
                }
              />
            ) : null}
            <FeatureCard
              className={personalizedItem ? 'mt-4' : ''}
              surface="soft"
              eyebrow="오늘 집중 포인트"
              description={item.todayFocus}
            />
            <FeatureCard
              className="mt-4"
              surface="soft"
              eyebrow="행동 제안"
              description={item.action}
            />
            <FeatureCard
              className="mt-4"
              surface="panel"
              eyebrow="사주와 기준 맞춤"
              description="입춘 전후 생일은 단순 연도표와 다를 수 있습니다. 더 정확한 흐름은 생년월일 전체를 넣은 사주 결과에서 이어서 볼 수 있습니다."
            />
          </SupportRail>
        </section>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="다음으로 이어보기"
            title="더 자세히 보고 싶을 때만 사주로 이어갑니다"
            titleClassName="text-3xl"
            description="띠운세는 가볍게 오늘 방향을 보는 입구입니다. 내 생년월일 전체 흐름이 궁금할 때만 사주풀이로 넘어가면 됩니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            actions={
              <ActionCluster>
                <Link href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'} className="moon-cta-primary">
                  {readingSlug ? '내 사주로 이어보기' : '맞춤 사주로 이어보기'}
                </Link>
                <Link href="/zodiac" className="moon-cta-secondary">
                  내 띠 다시 확인
                </Link>
              </ActionCluster>
            }
          />
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
