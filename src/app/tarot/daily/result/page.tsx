import Link from 'next/link';
import type { Metadata } from 'next';
import { TarotCardArtwork } from '@/components/tarot/tarot-card-artwork';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import { Badge } from '@/components/ui/badge';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import {
  getTarotReadingForQuestion,
  getTarotSpreadForQuestion,
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
  const premiumSpread = await getTarotSpreadForQuestion(currentQuestion);
  const sourceLabel = reading.source === 'api' ? '78장 덱 기준' : '로컬 덱 기준';

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="result"
              className="border-[var(--app-plum)]/25 bg-[var(--app-plum)]/10 text-[var(--app-plum)]"
            >
              타로 결과
            </Badge>,
            <Badge
              key="source"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              {sourceLabel}
            </Badge>,
          ]}
          title={currentQuestion}
          description="지금 마음에 가장 가까운 한 줄부터 확인하세요."
        />

        <section className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <SectionSurface surface="panel" size="lg" className="text-center">
            <SectionHeader
              eyebrow="오늘 뽑으신 카드"
              title={reading.displayName}
              titleClassName="text-3xl"
              description={`${reading.arcanaLabel} · ${reading.subtitle}`}
              descriptionClassName="mx-auto max-w-xl text-[var(--app-copy-muted)]"
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
              eyebrow="카드 한마디"
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
              eyebrow="이번 주 마음에 두실 한 가지"
              description={reading.action}
            />
            <FeatureCard
              className="mt-4"
              surface="soft"
              eyebrow="카드가 건네는 말"
              description={reading.guidance}
            />
            <FeatureCard
              className="mt-4"
              surface="panel"
              eyebrow="사주와 같이 보면"
              description={reading.sajuBlend}
            />
          </SupportRail>
        </section>

        <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="더 자세히 보기"
              title="한 장이 마음에 남으면 더 이어볼 수 있습니다"
              titleClassName="text-3xl"
            />

            <ProductGrid columns={3} className="mt-6">
              {premiumSpread.map(({ position, reading: spreadReading }) => (
                <FeatureCard
                  key={position}
                  surface="soft"
                  eyebrow={position}
                  title={spreadReading.displayName}
                  description={spreadReading.answer}
                />
              ))}
            </ProductGrid>

            <ActionCluster className="mt-6">
              <Link href="/pricing" className="gangi-secondary-button">
                990원 소액 풀이 보기
              </Link>
            </ActionCluster>
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
