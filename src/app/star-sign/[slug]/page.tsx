import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiStarSignIcon } from '@/components/gangi/gangi-star-sign';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { Badge } from '@/components/ui/badge';
import {
  STAR_SIGN_META,
} from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { STAR_SIGN_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
}

function getStarSign(slug: string) {
  return STAR_SIGN_FORTUNES.find((item) => item.slug === slug);
}

export async function generateStaticParams() {
  return STAR_SIGN_FORTUNES.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = getStarSign(slug);

  if (!item) {
    return { title: '별자리' };
  }

  return {
    title: `${item.label} 별자리`,
    description: `${item.label}의 오늘 흐름과 사주 크로스 관점을 함께 보는 달빛인생의 별자리 상세 화면입니다.`,
    alternates: {
      canonical: `/star-sign/${item.slug}`,
    },
  };
}

export default async function StarSignDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = getStarSign(slug);

  if (!item) notFound();

  const profile = await getOptionalSignedInProfile();
  const readingSlug = buildProfileReadingSlug(profile);
  const meta = STAR_SIGN_META[item.slug as keyof typeof STAR_SIGN_META];
  const relatedItems = STAR_SIGN_FORTUNES.filter((entry) => entry.slug !== item.slug);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-6">
        <PageHero
          badges={[
            <Badge
              key="sign"
              className="border-[var(--app-sky)]/25 bg-[var(--app-sky)]/10 text-[var(--app-sky)]"
            >
              {meta.symbol} {item.label}
            </Badge>,
            <Badge
              key="range"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              {item.dateRange}
            </Badge>,
          ]}
          title={`${item.label}에게 오늘 별빛이 전하는 말`}
          description={item.summary}
        />

        <SectionSurface surface="panel" size="lg" className="text-center">
            <SectionHeader
              eyebrow="오늘의 별자리"
              title={item.label}
              titleClassName="text-3xl text-[var(--app-sky)]"
              description={item.todayFocus}
              descriptionClassName="mx-auto max-w-xl text-[var(--app-copy)]"
            />
            <GangiStarSignIcon
              slug={item.slug}
              symbol={meta.symbol}
              size="lg"
              className="mx-auto mt-6"
            />

            <FeatureCard
              className="mt-6 text-left"
              surface="soft"
              eyebrow="행동 제안"
              description={item.action}
            />
        </SectionSurface>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="다음으로 이어보기"
            title="별빛 언어 다음에는 더 깊은 기준으로 넘어갈 수 있습니다"
            titleClassName="text-3xl"
            actions={
              <ActionCluster>
                <Link href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'} className="gangi-primary-button">
                  {readingSlug ? '내 사주와 함께 보기' : '사주와 함께 보기'}
                </Link>
                <Link href="/star-sign" className="gangi-secondary-button">
                  별자리 목록으로 돌아가기
                </Link>
              </ActionCluster>
            }
          />
        </SectionSurface>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="다른 별자리"
            title="다른 별자리도 바로 볼 수 있어요"
            titleClassName="text-2xl"
          />

          <div className="gangi-star-sign-grid mt-5">
            {relatedItems.map((entry) => {
              const relatedMeta = STAR_SIGN_META[entry.slug as keyof typeof STAR_SIGN_META];

              return (
                <Link
                  key={entry.slug}
                  href={`/star-sign/${entry.slug}`}
                  className="gangi-star-sign-card"
                >
                  <GangiStarSignIcon slug={entry.slug} symbol={relatedMeta.symbol} size="sm" />
                  <strong>{entry.label}</strong>
                  <em>{entry.dateRange}</em>
                </Link>
              );
            })}
          </div>
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
