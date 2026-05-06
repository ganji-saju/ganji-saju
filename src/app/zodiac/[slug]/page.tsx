import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
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
          ]}
          title={`${item.label} 오늘 흐름`}
        />

        <section className="grid gap-6">
          <SectionSurface surface="panel" size="lg" className="text-center">
            <SectionHeader
              eyebrow="오늘"
              title={item.label}
              titleClassName="text-3xl text-[var(--app-ink)]"
              description={meta.yearlyMessage}
              descriptionClassName="mx-auto max-w-xl text-[var(--app-copy)]"
            />
            <div className="mt-6 text-7xl">{meta.symbol}</div>
          </SectionSurface>

          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="오늘 포인트"
              title="이것만 기억하세요"
              titleClassName="text-2xl"
            />
            {personalizedItem ? (
              <FeatureCard
                className="mt-5"
                surface="soft"
                eyebrow="내 띠"
                description={
                  isPersonalizedMatch
                    ? `${personalizedItem.label}로 맞춰 보여드립니다.`
                    : `${personalizedItem.label} 화면으로 다시 맞춥니다.`
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
          </SectionSurface>
        </section>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="다음으로 이어보기"
            title="더 자세히 보고 싶을 때만 사주로 이어갑니다"
            titleClassName="text-3xl"
            actions={
              <ActionCluster>
                <Link href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'} className="gangi-primary-button">
                  {readingSlug ? '내 사주로 이어보기' : '맞춤 사주로 이어보기'}
                </Link>
                <Link href="/zodiac" className="gangi-secondary-button">
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
