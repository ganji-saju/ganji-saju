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
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  getTarotPickerDeck,
  getTarotSpreadForQuestion,
  normalizeQuestion,
} from '@/lib/tarot-api';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';
import { TarotCardPicker } from './tarot-card-picker';

interface Props {
  searchParams: Promise<{ question?: string }>;
}

const PICKER_POINTS = [
  '질문을 한 번만 천천히 읽고, 한 사람 또는 한 사건만 떠올려 주세요.',
  '눈이 먼저 머무는 카드가 있으면 직접 고르고, 잘 모르겠으면 랜덤 뽑기를 누르셔도 좋습니다.',
  '결과 화면에서는 카드의 말, 질문의 속뜻, 사주 흐름과 이어지는 지점을 순서대로 보여드립니다.',
] as const;

const PICKER_MIND_CUES = [
  {
    title: '상대 마음이 궁금하다면',
    body: '그 사람이 한 말보다, 내가 계속 붙들고 있는 장면 하나를 떠올립니다.',
  },
  {
    title: '선택이 고민이라면',
    body: '가장 두려운 선택과 가장 끌리는 선택 중 어느 쪽이 더 큰지 먼저 느껴봅니다.',
  },
  {
    title: '오늘 흐름이 궁금하다면',
    body: '오늘 꼭 조심하고 싶은 말, 돈, 관계 중 하나만 마음에 올려둡니다.',
  },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '타로 카드 뽑기',
    description: '질문을 품고 카드를 선택하는 달빛인생의 타로 카드 뽑기 화면입니다.',
    alternates: {
      canonical: '/tarot/daily/pick',
    },
  };
}

export default async function TarotPickPage({ searchParams }: Props) {
  const { question } = await searchParams;
  const currentQuestion = normalizeQuestion(question);
  const pickerDeck = await getTarotPickerDeck(currentQuestion);
  const premiumSpread = await getTarotSpreadForQuestion(currentQuestion);
  const sourceLabel = pickerDeck.source === 'api' ? '외부 78장 덱' : '로컬 78장 덱';
  const pickerCards = pickerDeck.cards.map(({ card }) => ({ cardId: card.name_short }));

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="pick"
              className="border-[var(--app-plum)]/25 bg-[var(--app-plum)]/10 text-[var(--app-plum)]"
            >
              카드 뽑기
            </Badge>,
            <Badge
              key="source"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              {sourceLabel}
            </Badge>,
          ]}
          title="질문을 떠올리고, 끌리는 한 장을 고르세요"
          description={
            <>
              지금 들고 오신 질문은 <span className="text-[var(--app-plum)]">“{currentQuestion}”</span>
              입니다. 정답을 맞히려 하기보다, 지금 마음이 먼저 닿는 카드를 골라보세요.
            </>
          }
        />

        <section className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr]">
          <SupportRail
            surface="panel"
            eyebrow="카드를 고르기 전에"
            title="생각을 길게 하지 않아도 괜찮습니다"
            description="한 사람, 한 사건, 한 마음만 떠올리고 고르세요. 잘 모르겠으면 랜덤 뽑기를 눌러도 됩니다."
          >
            <BulletList items={PICKER_POINTS} />

            <FeatureCard
              className="mt-5"
              surface="soft"
              eyebrow="질문"
              title={currentQuestion}
              description="이 질문을 바꾸지 말고, 같은 마음으로 한 장을 골라 주세요."
            />

            <div className="mt-4 grid gap-3">
              {PICKER_MIND_CUES.map((cue) => (
                <FeatureCard
                  key={cue.title}
                  surface="soft"
                  eyebrow={cue.title}
                  description={cue.body}
                />
              ))}
            </div>

            <SectionHeader
              className="mt-6"
              eyebrow="더 자세히 보기"
              title="한 장이 마음에 남으면 더 이어볼 수 있습니다"
              titleClassName="text-2xl"
            />
            <ProductGrid columns={3} className="mt-4">
              {premiumSpread.map(({ position }) => (
                <FeatureCard key={position} surface="soft" eyebrow={position} />
              ))}
            </ProductGrid>

            <ActionCluster className="mt-5">
              <Link href="/tarot/daily" className="moon-cta-secondary">
                질문 다시 고르기
              </Link>
            </ActionCluster>
          </SupportRail>

          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="펼쳐진 덱"
              title="이제 한 장을 골라 주세요"
              titleClassName="text-3xl"
              description="직접 한 장을 고르거나 랜덤으로 맡기면 결과 화면으로 바로 이어집니다."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            />
            <div className="mt-6">
              <TarotCardPicker
                cards={pickerCards}
                question={currentQuestion}
                sourceLabel={sourceLabel}
              />
            </div>
          </SectionSurface>
        </section>
      </AppPage>
    </AppShell>
  );
}
