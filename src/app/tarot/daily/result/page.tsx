import Link from 'next/link';
import type { Metadata } from 'next';
import { TarotCardArtwork } from '@/components/tarot/tarot-card-artwork';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import {
  getTarotReadingForQuestion,
  normalizeQuestion,
} from '@/lib/tarot-api';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

interface Props {
  searchParams: Promise<{
    question?: string;
    cardId?: string;
    orientation?: string;
  }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '타로 결과',
    description: '카드 의미와 사주 연결 해석을 함께 보여주는 달빛인생의 타로 결과 화면입니다.',
    alternates: {
      canonical: '/tarot/daily/result',
    },
  };
}

export default async function TarotResultPage({ searchParams }: Props) {
  const { question, cardId, orientation } = await searchParams;
  const profile = await getOptionalSignedInProfile();
  const readingSlug = buildProfileReadingSlug(profile);
  const currentQuestion = normalizeQuestion(question);
  const reading = await getTarotReadingForQuestion({
    question: currentQuestion,
    cardId,
    orientation,
  });

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          title={currentQuestion}
        />

        <section className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <SectionSurface surface="panel" size="lg" className="text-center">
            <SectionHeader
              eyebrow="오늘 뽑으신 카드"
              title={reading.displayName}
              titleClassName="text-3xl"
            />
            <div className="mt-6">
              <TarotCardArtwork
                cardId={reading.card.name_short}
                shortName={reading.shortName}
                displayName={reading.displayName}
                cardMarker={reading.cardMarker}
                arcanaLabel={reading.arcanaLabel}
                className="mx-auto"
                priority
              />
            </div>
            <FeatureCard
              className="mt-6 text-left"
              surface="soft"
              eyebrow="한마디"
              description={reading.meaningExcerpt}
            />
          </SectionSurface>

          <SupportRail
            surface="panel"
            eyebrow="먼저 짚어드리는 핵심"
            title={reading.answer}
          >
            <FeatureCard
              surface="soft"
              eyebrow="오늘 해볼 것"
              description={reading.action}
            />
            <FeatureCard
              className="mt-4"
              surface="soft"
              eyebrow="마음에 둘 말"
              description={reading.guidance}
            />
            <FeatureCard
              className="mt-4"
              surface="panel"
              eyebrow="더 깊게 보면"
              description={reading.sajuBlend}
            />
          </SupportRail>
        </section>

        <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="다음"
              title="더 보고 싶을 때만 이어보세요"
              titleClassName="text-2xl"
            />

            <ActionCluster className="mt-6">
              <Link href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'} className="gangi-primary-button">
                내 사주로 이어보기
              </Link>
              <Link href="/pricing" className="gangi-secondary-button">
                990원 소액 풀이 보기
              </Link>
            </ActionCluster>
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
