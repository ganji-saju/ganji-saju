import Link from 'next/link';
import type { Metadata } from 'next';
import { GangiIntro, GangiMiniCard, GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  getTarotPickerDeck,
  getTarotSpreadForQuestion,
  normalizeQuestion,
} from '@/lib/tarot-api';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { TarotCardPicker } from './tarot-card-picker';

interface Props {
  searchParams: Promise<{ question?: string }>;
}

const PICKER_MIND_CUES = [
  {
    title: '상대 마음',
    body: '계속 떠오르는 장면 하나만 생각해요.',
  },
  {
    title: '선택 고민',
    body: '끌리는 쪽과 불안한 쪽을 같이 떠올려요.',
  },
  {
    title: '오늘 흐름',
    body: '말, 돈, 관계 중 하나만 골라 생각해요.',
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
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="타로" backHref="/tarot/daily" />

        <GangiIntro
          eyebrow="무료 타로"
          title={
            <>
              질문을 떠올리고
              <br />
              한 장만 골라요
            </>
          }
          description={
            <>
              지금 질문은 <strong>“{currentQuestion}”</strong> 입니다.
              정답을 맞히기보다 마음이 먼저 닿는 카드를 고르면 됩니다.
            </>
          }
        />

        <section className="px-4 sm:px-0">
          <div className="gangi-pink-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="gangi-sub-eyebrow mb-2">뽑기 전 마음 정리</p>
                <h2 className="text-lg font-black leading-7 text-[var(--app-ink)]">
                  오래 생각하지 말고, 먼저 끌리는 카드를 보세요
                </h2>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--app-pink-strong)]">
                {sourceLabel}
              </span>
            </div>
            <div className="gangi-mini-grid">
              {PICKER_MIND_CUES.map((cue) => (
                <GangiMiniCard key={cue.title} label={cue.title} desc={cue.body} />
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-0">
          <TarotCardPicker
            cards={pickerCards}
            question={currentQuestion}
            sourceLabel={sourceLabel}
          />
        </section>

        <section className="px-4 pb-8 sm:px-0">
          <div className="gangi-card-panel p-4">
            <p className="gangi-sub-eyebrow mb-2">다음에 더 볼 수 있는 것</p>
            <div className="grid gap-2">
              {premiumSpread.slice(0, 3).map(({ position }) => (
                <GangiMiniCard key={position} label={position} desc="결과 화면에서 이어서 확인" />
              ))}
            </div>
            <Link href="/tarot/daily" className="gangi-secondary-button mt-4">
              질문 다시 고르기
            </Link>
          </div>
        </section>
      </AppPage>
    </AppShell>
  );
}
