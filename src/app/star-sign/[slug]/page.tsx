import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ActionCluster } from '@/components/layout/action-cluster';
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
  const personalizedSlug = buildStarSignSlugFromProfile(profile);
  const readingSlug = buildProfileReadingSlug(profile);
  const personalizedItem =
    personalizedSlug
      ? STAR_SIGN_FORTUNES.find((entry) => entry.slug === personalizedSlug) ?? null
      : null;
  const isPersonalizedMatch = personalizedSlug === item.slug;
  const meta = STAR_SIGN_META[item.slug as keyof typeof STAR_SIGN_META];
  const relatedItems = STAR_SIGN_FORTUNES.filter((entry) => entry.slug !== item.slug).slice(0, 3);

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
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
          description={`${item.summary} 달빛인생은 이 흐름을 “${meta.seniorCopy}”라는 한 문장으로 먼저 받아들인 뒤, 오늘의 감정선과 선택의 온도를 차분히 읽어드립니다.`}
        />

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionSurface surface="panel" size="lg" className="text-center">
            <SectionHeader
              eyebrow="오늘의 별자리"
              title={item.label}
              titleClassName="text-3xl text-[var(--app-sky)]"
              description={item.todayFocus}
              descriptionClassName="mx-auto max-w-xl text-[var(--app-copy)]"
            />
            <div className="mt-6 text-7xl">{meta.symbol}</div>
          </SectionSurface>

          <SupportRail
            surface="lunar"
            eyebrow="오늘 읽는 방식"
            title="별자리 흐름은 감정의 온도를 먼저 비춥니다"
            description="별자리는 빠른 감정선과 관계 온도를 읽는 데 잘 맞고, 더 깊은 반복 패턴은 사주와 함께 볼 때 훨씬 선명해집니다."
          >
            {personalizedItem ? (
              <FeatureCard
                surface="soft"
                eyebrow="MY 프로필 기준"
                description={
                  isPersonalizedMatch
                    ? `저장된 MY 프로필 기준으로 보면 선생님의 별자리는 ${personalizedItem.label}입니다. 지금 보고 계신 흐름이 바로 선생님 기준 별자리입니다.`
                    : `저장된 MY 프로필 기준으로는 ${personalizedItem.label}이 선생님의 별자리입니다. 지금은 ${item.label} 흐름을 비교해서 보고 계십니다.`
                }
              />
            ) : null}

            <FeatureCard
              className={personalizedItem ? 'mt-4' : ''}
              surface="soft"
              eyebrow="행동 제안"
              description={item.action}
            />

            <FeatureCard
              className="mt-4"
              surface="panel"
              eyebrow="별자리 × 사주 크로스"
              description={`별자리는 선생님의 감수성과 관계 온도를 빠르게 읽고, 사주는 태어난 순간의 큰 구조와 반복 패턴을 읽습니다. ${STAR_SIGN_BLUEPRINT.cross}`}
            />
          </SupportRail>
        </section>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="다음으로 이어보기"
            title="별빛 언어 다음에는 더 깊은 기준으로 넘어갈 수 있습니다"
            titleClassName="text-3xl"
            description="무료 탐색에서 프리미엄 진입으로 넘어갈 때도, 한 섹션 안에서는 주 행동과 보조 행동만 남겨 흐름을 단순하게 유지합니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            actions={
              <ActionCluster>
                <Link href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'} className="moon-cta-primary">
                  {readingSlug ? '내 사주와 함께 보기' : '사주와 함께 보기'}
                </Link>
                <Link href="/star-sign" className="moon-cta-secondary">
                  별자리 목록으로 돌아가기
                </Link>
              </ActionCluster>
            }
          />
        </SectionSurface>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="다른 별자리"
            title="이 결의 차이를 함께 비교해 보세요"
            titleClassName="text-3xl"
          />

          <ProductGrid columns={3} className="mt-6">
            {relatedItems.map((entry) => {
              const relatedMeta = STAR_SIGN_META[entry.slug as keyof typeof STAR_SIGN_META];

              return (
                <FeatureCard
                  key={entry.slug}
                  surface="soft"
                  eyebrow={`${relatedMeta.symbol} ${entry.dateRange}`}
                  title={entry.label}
                  description={entry.summary}
                  footer={
                    <Link
                      href={`/star-sign/${entry.slug}`}
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
