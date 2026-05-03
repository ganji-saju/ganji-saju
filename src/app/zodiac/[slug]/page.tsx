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
  ZODIAC_BLUEPRINT,
  ZODIAC_META,
} from '@/content/moonlight';
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

  if (!item) return { title: '띠별 운세' };

  return {
    title: `${item.label} 운세`,
    description: `${item.label}의 연운 메시지와 오늘의 포인트를 함께 보는 달빛인생의 띠별 상세 화면입니다.`,
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
  const isPersonalizedMatch = personalizedSlug === item.slug;
  const meta = ZODIAC_META[item.slug as keyof typeof ZODIAC_META];
  const relatedItems = ZODIAC_FORTUNES.filter((entry) => entry.slug !== item.slug).slice(0, 3);

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
              연주 기준
            </Badge>,
          ]}
          title={`${item.label}의 ${ZODIAC_BLUEPRINT.yearlyLabel}`}
          description={`${meta.yearlyMessage}. 오늘의 포인트와 올해의 기조를 함께 놓고 보면, 급한 판단보다 생활의 리듬을 더 편안하게 가다듬으실 수 있습니다.`}
        />

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionSurface surface="panel" size="lg" className="text-center">
            <SectionHeader
              eyebrow="올해 먼저 읽는 기조"
              title={item.label}
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description={meta.yearlyMessage}
              descriptionClassName="mx-auto max-w-xl text-[var(--app-copy)]"
            />
            <div className="mt-6 text-7xl">{meta.symbol}</div>
          </SectionSurface>

          <SupportRail
            surface="lunar"
            eyebrow="오늘 붙잡을 포인트"
            title="연운과 오늘의 결을 같이 읽습니다"
            description="띠운세는 크게 좋은지 나쁜지보다, 올해의 기조 위에서 오늘 어떤 리듬을 조절하면 좋은지 읽는 데 초점을 둡니다."
          >
            {personalizedItem ? (
              <FeatureCard
                surface="soft"
                eyebrow="MY 프로필 기준"
                description={
                  isPersonalizedMatch
                    ? `저장된 MY 프로필 기준으로 선생님의 띠는 ${personalizedItem.label}입니다. 지금 보고 계신 흐름이 바로 선생님 기준 연운입니다.`
                    : `저장된 MY 프로필 기준으로는 ${personalizedItem.label}가 선생님의 띠입니다. 지금은 ${item.label} 흐름을 비교해서 보고 계십니다.`
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
              eyebrow="연운과 월운 흐름"
              description="띠별 운세는 연운으로 큰 방향을 보고, 월운으로 당장 조정할 생활 리듬을 읽는 데 잘 어울립니다. 큰 결정보다 관계, 일정, 소비의 우선순위를 고를 때 특히 더 도움이 됩니다."
            />
          </SupportRail>
        </section>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="다음으로 이어보기"
            title="더 깊은 기준이 필요하면 사주 흐름으로 넘어갑니다"
            titleClassName="text-3xl"
            description="무료 탐색에서 프리미엄 진입으로 넘어갈 때도 주 행동과 보조 행동만 남겨, 화면 안에서 선택지가 과밀해지지 않도록 정리했습니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            actions={
              <ActionCluster>
                <Link href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'} className="moon-cta-primary">
                  {readingSlug ? '내 사주로 이어보기' : '맞춤 사주로 이어보기'}
                </Link>
                <Link href="/zodiac" className="moon-cta-secondary">
                  띠별 목록으로 돌아가기
                </Link>
              </ActionCluster>
            }
          />
        </SectionSurface>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="다른 띠도 보기"
            title="비슷한 해의 결을 함께 비교해 보세요"
            titleClassName="text-3xl"
          />

          <ProductGrid columns={3} className="mt-6">
            {relatedItems.map((entry) => {
              const relatedMeta = ZODIAC_META[entry.slug as keyof typeof ZODIAC_META];

              return (
                <FeatureCard
                  key={entry.slug}
                  surface="soft"
                  eyebrow={`${relatedMeta.symbol} 연주 흐름`}
                  title={entry.label}
                  description={relatedMeta.yearlyMessage}
                  footer={
                    <Link
                      href={`/zodiac/${entry.slug}`}
                      className="inline-flex items-center gap-2 text-sm text-[var(--app-gold-soft)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                    >
                      이 띠 흐름 읽기
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
