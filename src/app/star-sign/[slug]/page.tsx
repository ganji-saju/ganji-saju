import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiStarSignIcon } from '@/components/gangi/gangi-star-sign';
import { FlowEntryList } from '@/components/moonlight/FlowEntryList';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { ResultShell } from '@/components/moonlight/ResultShell';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import {
  STAR_SIGN_META,
} from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { STAR_SIGN_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

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
        <PageIntro
          eyebrow="오늘의 결 · 별자리"
          title={`${item.label}에게 오늘 별빛이 전하는 말`}
          description={item.summary}
        />

        <ResultShell
          title={`${meta.symbol} ${item.label}`}
          summary={item.todayFocus}
          keywords={[item.dateRange, '무료 별자리', '오늘의 결']}
        >
          <LightSection eyebrow="오늘의 별자리" title={item.label} className="text-center" surface="soft">
            <GangiStarSignIcon
              slug={item.slug}
              symbol={meta.symbol}
              size="lg"
              className="mx-auto mt-6"
            />

            <p className="mx-auto mt-6 max-w-2xl text-left text-sm leading-7 text-[var(--gyeol-muted)]">
              <strong className="mb-1 block text-[var(--gyeol-text)]">행동 제안</strong>
              {item.action}
            </p>
          </LightSection>

          <LightSection
            eyebrow="다음으로 이어보기"
            title="별빛 언어 다음에는 더 깊은 기준으로 넘어갈 수 있습니다"
            description="별자리는 오늘을 짧게 보는 입구입니다. 내 사주, 성향사주, 12간지 대화로 필요한 만큼만 이어보세요."
          >
            <FlowEntryList
              items={[
                {
                  id: 'saju',
                  href: readingSlug ? `/saju/${readingSlug}` : '/saju/new',
                  title: readingSlug ? '내 사주와 함께 보기' : '사주와 함께 보기',
                  description: '별빛 흐름을 내 사주의 큰 결로 이어봅니다.',
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
                {
                  id: 'star-list',
                  href: '/star-sign',
                  title: '별자리 목록으로 돌아가기',
                  description: '다른 별자리의 흐름도 가볍게 봅니다.',
                  meta: '목록',
                },
              ]}
            />
          </LightSection>

          <LightSection
            eyebrow="다른 별자리"
            title="다른 별자리도 바로 볼 수 있어요"
            surface="soft"
          >

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
          </LightSection>
          <SafetyNotice />
        </ResultShell>
      </AppPage>
    </AppShell>
  );
}
