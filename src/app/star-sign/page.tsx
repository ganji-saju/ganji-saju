import Link from 'next/link';
import type { Metadata } from 'next';
import { GangiStarSignIcon } from '@/components/gangi/gangi-star-sign';
import { FlowEntryList } from '@/components/moonlight/FlowEntryList';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import {
  STAR_SIGN_BLUEPRINT,
  STAR_SIGN_META,
} from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { STAR_SIGN_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug, buildStarSignSlugFromProfile } from '@/lib/profile-personalization';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

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
        <PageIntro
          eyebrow="오늘의 결 · 별자리"
          title="별자리를 골라 오늘 흐름을 보세요"
          description="열두 별자리 중 내 별자리를 누르면 오늘의 포인트와 바로 할 행동을 짧게 확인할 수 있습니다."
        />

        <LightSection
            eyebrow="12별자리 바로 선택"
            title="내 별자리를 골라보세요"
            description="모바일에서 누르기 쉽게 compact list로 정리했습니다."
            surface="soft"
        >
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
        </LightSection>

        <LightSection
              eyebrow={hasPersonalizedProfile ? 'MY 프로필 기준 별자리' : '오늘의 별자리'}
              title={hasPersonalizedProfile ? `내 별자리는 ${featured.label}` : featured.label}
              description={featured.dateRange}
              className="text-center"
        >
            <GangiStarSignIcon
              slug={featured.slug}
              symbol={featuredMeta.symbol}
              size="lg"
              className="mx-auto mt-6"
            />
            <p className="mx-auto mt-5 max-w-2xl text-left text-sm leading-7 text-[var(--gyeol-muted)]">
              <strong className="mb-1 block text-[var(--gyeol-text)]">오늘 먼저 닿는 흐름</strong>
              {featured.summary} {featured.action}
            </p>
        </LightSection>

        <LightSection
          eyebrow="다음 흐름"
          title="별빛을 본 뒤 필요한 풀이로 이어가기"
          description="별자리는 오늘을 가볍게 보는 입구입니다. 더 깊은 기준은 사주와 성향사주, 남은 질문은 12간지 대화로 이어보세요."
        >
          <FlowEntryList
            items={[
              {
                id: 'featured-star',
                href: `/star-sign/${featured.slug}`,
                title: hasPersonalizedProfile ? '내 별자리 바로 보기' : '별자리 흐름 자세히 보기',
                description: `${featured.label}의 오늘 포인트를 확인합니다.`,
                meta: '무료',
              },
              {
                id: 'saju',
                href: readingSlug ? `/saju/${readingSlug}` : '/saju/new',
                title: readingSlug ? '내 사주와 함께 보기' : '사주와 함께 보기',
                description: '별빛 언어를 내 사주의 큰 흐름으로 이어봅니다.',
                meta: '이어보기',
              },
              {
                id: 'saju-personality',
                href: '/saju/personality',
                title: '성향사주로 이어보기',
                description: '사주 네 기둥과 16유형 성향으로 내 선택 습관을 봅니다.',
                meta: '깊이보기',
              },
              {
                id: 'dialogue',
                href: '/dialogue',
                title: '12간지 캐릭터에게 이어 묻기',
                description: '오늘 남은 질문을 대화방에서 바로 이어갑니다.',
                meta: '대화',
              },
            ]}
          />
        </LightSection>
        <SafetyNotice />
      </AppPage>
    </AppShell>
  );
}
