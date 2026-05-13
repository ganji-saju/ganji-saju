import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { FlowEntryList } from '@/components/moonlight/FlowEntryList';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { ResultShell } from '@/components/moonlight/ResultShell';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import { ZODIAC_META } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ZODIAC_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug, buildZodiacSlugFromProfile } from '@/lib/profile-personalization';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

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
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-6">
        <PageIntro
          eyebrow="오늘의 결 · 띠운세"
          title={`${item.label} 오늘 흐름`}
          description="오늘의 띠 흐름은 짧게 보고, 더 남는 질문만 사주나 12간지 대화로 이어가면 됩니다."
        />

        <ResultShell
          title={`${meta.symbol} ${item.label}`}
          summary={meta.yearlyMessage}
          keywords={[item.todayFocus, '무료 띠운세', '오늘의 결']}
        >
          <LightSection eyebrow="오늘 포인트" title="이것만 기억하세요" surface="soft">
            {personalizedItem ? (
              <p className="mb-4 rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] px-4 py-3 text-sm leading-6 text-[var(--gyeol-muted)]">
                <strong className="block text-[var(--gyeol-text)]">내 띠</strong>
                {
                  isPersonalizedMatch
                    ? `${personalizedItem.label}로 맞춰 보여드립니다.`
                    : `${personalizedItem.label} 화면으로 다시 맞춥니다.`
                }
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] px-4 py-3">
                <strong className="text-sm text-[var(--gyeol-text)]">오늘 집중 포인트</strong>
                <p className="mt-2 text-sm leading-6 text-[var(--gyeol-muted)]">{item.todayFocus}</p>
              </div>
              <div className="rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] px-4 py-3">
                <strong className="text-sm text-[var(--gyeol-text)]">행동 제안</strong>
                <p className="mt-2 text-sm leading-6 text-[var(--gyeol-muted)]">{item.action}</p>
              </div>
            </div>
          </LightSection>

          <LightSection
            eyebrow="다음으로 이어보기"
            title="더 자세히 보고 싶을 때만 이어갑니다"
            description="띠운세는 무료 입구입니다. 큰 흐름은 사주, 선택 습관은 성향사주, 남은 질문은 12간지 대화로 이어보세요."
          >
            <FlowEntryList
              items={[
                {
                  id: 'saju',
                  href: readingSlug ? `/saju/${readingSlug}` : '/saju/new',
                  title: readingSlug ? '내 사주로 이어보기' : '맞춤 사주로 이어보기',
                  description: '오늘 흐름을 내 사주의 큰 결로 이어봅니다.',
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
                  description: '오늘의 띠 흐름에서 남은 질문을 대화로 이어갑니다.',
                  meta: '대화',
                },
                {
                  id: 'zodiac-list',
                  href: '/zodiac',
                  title: '내 띠 다시 확인',
                  description: '다른 띠 흐름도 가볍게 둘러봅니다.',
                  meta: '목록',
                },
              ]}
            />
          </LightSection>
          <SafetyNotice />
        </ResultShell>
      </AppPage>
    </AppShell>
  );
}
