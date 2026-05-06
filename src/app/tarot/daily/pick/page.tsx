import type { Metadata } from 'next';
import { GangiIntro, GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  getTarotPickerDeck,
  normalizeQuestion,
} from '@/lib/tarot-api';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { TarotCardPicker } from './tarot-card-picker';

interface Props {
  searchParams: Promise<{ question?: string }>;
}

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
  const pickerCards = pickerDeck.cards.map(({ card }) => ({ cardId: card.name_short }));

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="타로 한 장" backHref="/tarot/daily" />

        <GangiIntro
          title={
            <>
              마음이 가는 카드를
              <br />
              한 장 골라요
            </>
          }
          description="18장씩 부채꼴로 펼쳐진 카드를 옆으로 넘기며 골라보세요."
        />

        <section className="px-4 sm:px-0">
          <TarotCardPicker
            cards={pickerCards}
            question={currentQuestion}
          />
        </section>
      </AppPage>
    </AppShell>
  );
}
