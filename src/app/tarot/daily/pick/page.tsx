// Redesign 2026-05-17 — design system component (GangiIntro / GangiPageHeader) 기반
// 타로 카드 픽 페이지. UI 가 design system component 안에 있어 시각 일관 — sibling
// /tarot/daily / /tarot 와 통일.
import type { Metadata } from 'next';
import Link from 'next/link';
import { GangiIntro, GangiPageHeader } from '@/components/gangi/gangi-ui';
import { createClient } from '@/lib/supabase/server';
import {
  freeDailyLimitMessage,
  isFreeDailyExempt,
  isFreeDailyUsed,
} from '@/lib/free-usage/daily-limit';
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
    description: '질문을 품고 카드를 선택하는 간지사주의 타로 카드 뽑기 화면입니다.',
    alternates: {
      canonical: '/tarot/daily/pick',
    },
  };
}

export default async function TarotPickPage({ searchParams }: Props) {
  const { question } = await searchParams;
  const currentQuestion = normalizeQuestion(question);

  // 2026-07-18 — 타로 하루 1회 제한. 뽑기 화면 진입 시점에 판정한다(소비는 뽑기 확정 시
  //   /api/tarot/daily-draw 가 한다). 이미 뽑았으면 덱을 아예 렌더하지 않아
  //   "고르고 나서 막히는" 헛수고를 만들지 않는다.
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const memberExempt = await isFreeDailyExempt(user?.id ?? null);
  const alreadyDrew =
    !memberExempt && (await isFreeDailyUsed('tarot', user?.id ?? null));

  if (alreadyDrew) {
    return (
      <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
        <AppPage className="gangi-subpage space-y-5">
          <GangiPageHeader title="타로 세 장" backHref="/tarot/daily" />
          <GangiIntro
            title={
              <>
                오늘 카드는
                <br />
                이미 뽑았어요
              </>
            }
            description={freeDailyLimitMessage('tarot')}
          />
          <section className="grid gap-2.5 px-4 sm:px-0">
            <Link
              href="/saju/new?product=today-detail"
              className="flex h-[52px] items-center justify-center rounded-[14px] bg-[var(--app-pink)] text-[17px] font-extrabold text-white no-underline"
            >
              내 사주 자세히 보기
            </Link>
            <Link
              href="/"
              className="flex h-[52px] items-center justify-center rounded-[14px] border border-[var(--app-line)] bg-white text-[17px] font-bold text-[var(--app-ink)] no-underline"
            >
              홈으로
            </Link>
          </section>
        </AppPage>
      </AppShell>
    );
  }

  const pickerDeck = await getTarotPickerDeck(currentQuestion);
  const pickerCards = pickerDeck.cards.map(({ card }) => ({ cardId: card.name_short }));

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="타로 세 장" backHref="/tarot/daily" />

        <GangiIntro
          title={
            <>
              마음이 가는 카드를
              <br />
              세 장 골라요
            </>
          }
          description="78장을 한 화면에 펼쳤어요. 마음이 가는 순서대로 세 장을 톡톡 골라요."
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
