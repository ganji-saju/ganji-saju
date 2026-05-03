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
  ZODIAC_BLUEPRINT,
  ZODIAC_META,
} from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ZODIAC_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug, buildZodiacSlugFromProfile } from '@/lib/profile-personalization';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

const ZODIAC_POINTS = [
  '띠운세는 익숙한 언어로 올해의 큰 방향과 오늘의 포인트를 먼저 읽는 데 잘 맞습니다.',
  '큰 결정보다 생활 리듬, 관계, 소비의 우선순위를 고를 때 더 부드럽게 참고하실 수 있습니다.',
  '더 깊은 개인 기준은 사주 결과와 풀이 흐름으로 이어집니다.',
] as const;

export const metadata: Metadata = {
  title: '띠별 운세',
  description:
    '12띠 전체의 흐름과 연운 메시지를 한 화면에서 차분히 살펴보세요.',
  alternates: {
    canonical: '/zodiac',
  },
};

export default async function ZodiacPage() {
  const profile = await getOptionalSignedInProfile();
  const personalizedSlug = buildZodiacSlugFromProfile(profile);
  const readingSlug = buildProfileReadingSlug(profile);
  const featured =
    ZODIAC_FORTUNES.find(
      (item) => item.slug === (personalizedSlug ?? ZODIAC_BLUEPRINT.highlightedSlug)
    ) ??
    ZODIAC_FORTUNES[0];
  const featuredMeta = ZODIAC_META[featured.slug as keyof typeof ZODIAC_META];
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
          title="익숙한 띠의 언어로 올해의 흐름을 먼저 읽습니다"
          description="띠운세는 큰 방향과 오늘의 포인트를 익숙한 언어로 먼저 보여주는 입구입니다. 생활 리듬을 부드럽게 참고하고, 더 깊은 개인 기준은 사주 해석으로 이어가실 수 있습니다."
        />

        <section className="grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
          <SectionSurface surface="panel" size="lg" className="text-center">
            <SectionHeader
              eyebrow={hasPersonalizedProfile ? 'MY 프로필 기준 띠' : '오늘 먼저 보는 띠'}
              title={hasPersonalizedProfile ? `선생님은 ${featured.label}` : featured.label}
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description={
                hasPersonalizedProfile
                  ? '저장된 생년월일 기준으로 계산한 연주 흐름입니다.'
                  : '12지지의 흐름 중 오늘 먼저 읽기 좋은 띠를 골랐습니다.'
              }
              descriptionClassName="mx-auto text-[var(--app-copy-muted)]"
            />
            <div className="mt-6 text-6xl">{featuredMeta.symbol}</div>
            <FeatureCard
              className="mt-6 text-left"
              surface="soft"
              eyebrow={`${featured.label}의 2026년`}
              description={`${featuredMeta.yearlyMessage}. ${featured.todayFocus}`}
            />
          </SectionSurface>

          <SupportRail
            surface="lunar"
            eyebrow="띠운세 읽는 방식"
            title="큰 방향은 가볍게, 깊은 기준은 사주로 분리합니다"
            description="띠운세는 연운과 생활 리듬을 익숙한 말로 먼저 보는 입구 역할에 두고, 더 깊은 질문은 사주 결과로 이어집니다."
          >
            {hasPersonalizedProfile ? (
              <FeatureCard
                surface="soft"
                eyebrow="약한 개인화 연결"
                description="저장된 MY 프로필 생년 기준으로 선생님의 띠를 먼저 보여드렸습니다. 이 흐름은 빠른 탐색이고, 더 깊은 기준은 사주 결과로 이어집니다."
              />
            ) : null}
            <BulletList className={hasPersonalizedProfile ? 'mt-5' : ''} items={ZODIAC_POINTS} />
            <ActionCluster className="mt-5">
              <Link href={`/zodiac/${featured.slug}`} className="moon-cta-primary">
                {hasPersonalizedProfile ? '내 띠 바로 보기' : `${featured.label} 자세히 보기`}
              </Link>
              <Link href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'} className="moon-cta-secondary">
                {readingSlug ? '내 사주로 이어보기' : '맞춤 사주 보기'}
              </Link>
            </ActionCluster>
          </SupportRail>
        </section>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="12띠"
            title="각 띠의 연운 한 줄"
            titleClassName="text-3xl"
            description="무료 탐색군 내부에서도 같은 카드 폭과 문장 밀도를 유지해, 어떤 띠를 눌러도 같은 리듬으로 읽히게 정리했습니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
          />

          <ProductGrid columns={3} className="mt-6">
            {ZODIAC_FORTUNES.map((item) => {
              const meta = ZODIAC_META[item.slug as keyof typeof ZODIAC_META];
              return (
                <FeatureCard
                  key={item.slug}
                  surface="soft"
                  eyebrow={`${meta.symbol} 연주 흐름`}
                  title={item.label}
                  description={meta.yearlyMessage}
                  footer={
                    <Link
                      href={`/zodiac/${item.slug}`}
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
