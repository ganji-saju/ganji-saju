import Link from 'next/link';
import type { Metadata } from 'next';
import { FlowEntryList } from '@/components/moonlight/FlowEntryList';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import { ZODIAC_META } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ZODIAC_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug, buildZodiacSlugFromProfile } from '@/lib/profile-personalization';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GANGI_ZODIAC } from '@/components/gangi/gangi-ui';

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
        <PageIntro
          eyebrow="오늘의 결 · 띠운세"
          title="내 띠 하나로 오늘 흐름을 가볍게 봅니다"
          description="12간지 중 내 띠를 고르면 오늘의 포인트와 바로 할 행동을 짧게 확인할 수 있어요."
        />

        <LightSection
            eyebrow="12띠 바로 선택"
            title="띠를 골라 오늘운을 보세요"
            description="작은 카드 격자 대신 누르기 쉬운 row로 정리했습니다."
            surface="soft"
        >
          <FlowEntryList
            className="sm:grid-cols-2"
            items={GANGI_ZODIAC.map((zodiac, index) => ({
              id: zodiac.key,
              href: `/zodiac/${zodiac.key}`,
              title: zodiac.name,
              description: `${index + 1}번째 12간지 흐름`,
              badge: String(index + 1).padStart(2, '0'),
              meta: '보기',
            }))}
          />
        </LightSection>

        <section className="grid gap-6">
          <LightSection
              eyebrow={hasPersonalizedProfile ? '내 띠' : '생년월일로 확인'}
              title={hasPersonalizedProfile && featured ? `내 띠는 ${featured.label}` : '내 띠를 자동으로 맞춰볼까요?'}
              description={
                featured && featuredMeta
                  ? `${featuredMeta.yearlyMessage}. ${featured.todayFocus}`
                  : '생년월일을 입력하면 입춘 기준으로 내 띠를 더 정확히 이어볼 수 있습니다.'
              }
          >
            {featured && featuredMeta ? (
              <p className="text-5xl" aria-hidden="true">{featuredMeta.symbol}</p>
            ) : (
              <Link href="/saju/new" className="gangi-primary-button">
                생년월일로 내 띠 확인
              </Link>
            )}
          </LightSection>

          <LightSection
            eyebrow="다음 흐름"
            title="짧게 본 뒤 필요한 풀이로 이어가기"
            description="띠운세는 무료 입구입니다. 더 깊은 자기이해나 질문은 성향사주와 12간지 대화로 이어보세요."
          >
            <FlowEntryList
              items={[
                ...(featured
                  ? [{
                      id: 'featured-zodiac',
                      href: `/zodiac/${featured.slug}`,
                      title: '내 띠 바로 보기',
                      description: `${featured.label}의 오늘 포인트를 확인합니다.`,
                      meta: '무료',
                    }]
                  : []),
                {
                  id: 'saju',
                  href: readingSlug ? `/saju/${readingSlug}` : '/saju/new',
                  title: readingSlug ? '내 사주로 이어보기' : '생년월일로 확인',
                  description: '오늘 흐름을 내 사주의 큰 결로 이어봅니다.',
                  meta: '이어보기',
                },
                {
                  id: 'saju-personality',
                  href: '/saju/personality',
                  title: '성향사주로 이어보기',
                  description: '사주 네 기둥과 16유형 성향으로 선택 습관을 봅니다.',
                  meta: '깊이보기',
                },
                {
                  id: 'dialogue',
                  href: '/dialogue',
                  title: '12간지 캐릭터에게 이어 묻기',
                  description: '오늘의 띠 흐름에서 남은 질문을 대화로 이어갑니다.',
                  meta: '대화',
                },
              ]}
            />
          </LightSection>
          <SafetyNotice />
        </section>
      </AppPage>
    </AppShell>
  );
}
