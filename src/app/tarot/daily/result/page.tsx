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
import { TAROT_CARD_KEYWORDS, TAROT_SAJU_BRIDGE_DETAILS } from '@/content/moonlight';
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
          description="먼저 지금 마음에 가장 가까운 한 줄을 보여드리고, 더 궁금할 때만 사주나 대화로 이어갑니다."
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
              eyebrow="원문 카드 의미"
              description={reading.meaningExcerpt}
            />
          </SectionSurface>

          <SupportRail
            surface="lunar"
            eyebrow="먼저 짚어드리는 핵심"
            title={reading.answer}
            description="긴 설명보다 먼저, 지금 질문에 가장 가까운 한 줄과 오늘 바로 붙잡을 포인트를 먼저 드립니다."
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
            eyebrow="질문을 읽는 두 층"
            title="마음의 표면과 속뜻을 함께 봅니다"
            titleClassName="text-3xl"
            description="타로는 단답으로 끝내기보다, 질문의 속뜻과 지금 움직이는 감정선을 함께 읽을 때 더 또렷해집니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
          />

          <ProductGrid columns={2} className="mt-6">
            <FeatureCard
              surface="soft"
              eyebrow="질문의 속뜻"
              description={reading.questionInsight}
            />
            <FeatureCard
              surface="soft"
              eyebrow={reading.psychologyLabel}
              description={reading.psychology}
            />
          </ProductGrid>
        </SectionSurface>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="타로 뒤에 사주를 붙이면"
              title="카드 한 장에서 끝내지 않고, 사주 흐름으로 이어봅니다"
              titleClassName="text-3xl"
              description="타로는 오늘의 감정과 장면을 보여주고, 사주는 그 장면이 내 성향과 운의 흐름에서 왜 자주 반복되는지 설명합니다."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            />
            <ProductGrid columns={3} className="mt-6">
              {TAROT_SAJU_BRIDGE_DETAILS.map((item, index) => (
                <FeatureCard
                  key={item.title}
                  surface="soft"
                  eyebrow={String(index + 1).padStart(2, '0')}
                  title={item.title}
                  titleClassName="text-xl"
                  description={item.body}
                />
              ))}
            </ProductGrid>
            <ActionCluster className="mt-6">
              <Link
                href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'}
                className="moon-cta-primary"
              >
                {readingSlug ? '내 사주 흐름과 함께 보기' : '내 사주와 겹쳐 읽기'}
              </Link>
              <Link
                href={{
                  pathname: '/dialogue',
                  query: {
                    from: 'tarot',
                    question: '방금 본 타로 결과를 제 사주 흐름까지 함께 놓고 보면 어떻게 읽어야 하나요?',
                  },
                }}
                className="moon-cta-secondary"
              >
                달빛인생에 이어 묻기
              </Link>
            </ActionCluster>
          </SectionSurface>

          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="더 자세히 보기"
              title="한 장이 마음에 남으면 더 이어볼 수 있습니다"
              titleClassName="text-3xl"
              description="현재 흐름, 숨은 마음, 오늘의 조언을 더 짧고 분명하게 이어보는 확장 리딩입니다."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
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
              <Link href="/pricing" className="moon-cta-secondary">
                990원 소액 풀이 보기
              </Link>
            </ActionCluster>
          </SectionSurface>
        </section>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="카드 키워드"
            title="강한 단어는 생활 언어로 다시 풀어 읽습니다"
            titleClassName="text-3xl"
            description="무료 탐색에서도 공포를 부추기지 않고, 오래 남는 문장으로 다시 풀어 읽는 원칙을 유지합니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
          />

          <ProductGrid columns={3} className="mt-6">
            {TAROT_CARD_KEYWORDS.map(([name, copy]) => (
              <FeatureCard
                key={name}
                surface="soft"
                eyebrow={name}
                description={copy}
              />
            ))}
          </ProductGrid>
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
