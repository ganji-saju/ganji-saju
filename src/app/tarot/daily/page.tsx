import Link from 'next/link';
import type { Metadata } from 'next';
import {
  GangiIntro,
  GangiMiniCard,
  GangiPageHeader,
} from '@/components/gangi/gangi-ui';
import { TarotCardArtwork } from '@/components/tarot/tarot-card-artwork';
import { TAROT_QUESTION_OPTIONS } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getTodayTarotPreview } from '@/lib/tarot-api';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '타로',
  description: '질문을 고르고 카드 한 장을 뽑아 오늘 마음의 흐름을 바로 확인하세요.',
  alternates: {
    canonical: '/tarot/daily',
  },
};

export default async function DailyTarotPage() {
  const featuredReading = await getTodayTarotPreview();
  const sourceLabel = featuredReading.source === 'api' ? '78장 덱 기준' : '오늘의 카드 기준';

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="타로 한 장" backHref="/free" />

        <GangiIntro
          eyebrow="무료 타로"
          title={
            <>
              오늘 마음에
              <br />
              한 장만 뽑아볼까요?
            </>
          }
          description="지금 가장 궁금한 한 가지를 떠올리고, 마음이 가는 카드로 바로 이어가세요."
        >
          <div className="gangi-card-stack" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((index) => (
              <span key={index} className="gangi-tarot-card" />
            ))}
          </div>
          <Link href="/tarot/daily/pick" className="gangi-primary-button mx-auto mt-5 max-w-xs">
            카드 뽑으러 가기
          </Link>
        </GangiIntro>

        <section className="gangi-topic-grid" aria-label="타로 질문 선택">
          {TAROT_QUESTION_OPTIONS.slice(0, 6).map((question) => (
            <Link
              key={question.label}
              href={{ pathname: '/tarot/daily/pick', query: { question: question.label } }}
              className="gangi-topic-card"
            >
              <span className="gangi-topic-icon">{question.emoji}</span>
              <h2>{question.label}</h2>
              <p>{question.description}</p>
            </Link>
          ))}
        </section>

        <section className="gangi-card-panel mx-4 p-4">
          <p className="gangi-sub-eyebrow mb-3">직접 질문 쓰기</p>
          <form action="/tarot/daily/pick" className="grid gap-3">
            <textarea
              name="question"
              rows={3}
              placeholder="예: 지금 마음을 전해도 괜찮을까요"
              className="min-h-24 w-full resize-none rounded-[1rem] border border-[var(--app-line)] bg-white px-4 py-3 text-sm font-bold leading-6 text-[var(--app-ink)] outline-none placeholder:text-[rgba(17,17,20,0.38)] focus:border-[var(--app-pink)]"
            />
            <button type="submit" className="gangi-secondary-button">
              이 질문으로 카드 뽑기
            </button>
          </form>
        </section>

        <section className="gangi-pink-panel mx-4 p-5 text-center">
          <p className="gangi-sub-eyebrow mb-3">오늘의 카드 미리보기</p>
          <TarotCardArtwork
            cardId={featuredReading.card.name_short}
            shortName={featuredReading.shortName}
            displayName={featuredReading.displayName}
            cardMarker={featuredReading.cardMarker}
            arcanaLabel={featuredReading.arcanaLabel}
            className="mx-auto w-[min(13rem,70vw)]"
            priority
          />
          <h2 className="mt-4 text-2xl font-black text-[var(--app-ink)]">
            {featuredReading.displayName}
          </h2>
          <p className="mt-2 text-xs font-bold text-[rgba(17,17,20,0.54)]">{sourceLabel}</p>
          <p className="mt-4 text-sm font-bold leading-7 text-[var(--app-copy)]">
            {featuredReading.answer}
          </p>
        </section>

        <section className="gangi-card-panel mx-4 p-4">
          <p className="gangi-sub-eyebrow mb-3">결과는 이렇게 보여드려요</p>
          <div className="gangi-mini-grid">
            <GangiMiniCard label="01" title="핵심 한 줄" desc="먼저 지금 마음의 방향을 짧게 봅니다." />
            <GangiMiniCard label="02" title="조심할 것" desc="오늘 흔들리기 쉬운 지점을 알려드립니다." />
            <GangiMiniCard label="03" title="해볼 행동" desc="읽고 바로 해볼 작은 행동으로 마무리합니다." />
          </div>
        </section>
      </AppPage>
    </AppShell>
  );
}
