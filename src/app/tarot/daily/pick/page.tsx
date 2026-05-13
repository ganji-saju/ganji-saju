import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
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

        <PageIntro
          eyebrow="오늘의 결"
          title="마음이 가는 카드를 한 장 골라요"
          description="질문을 품고 천천히 넘겨보세요. 결과는 짧게 보고 필요할 때만 사주나 대화로 이어갑니다."
        />

        <LightSection
          eyebrow="카드 선택"
          title="옆으로 넘기며 한 장만 선택하기"
          description="구형 모바일에서도 부담을 줄이기 위해 한 화면에는 일부 카드 묶음만 보여줍니다."
          surface="soft"
        >
          <TarotCardPicker
            cards={pickerCards}
            question={currentQuestion}
          />
        </LightSection>
        <SafetyNotice />
      </AppPage>
    </AppShell>
  );
}
