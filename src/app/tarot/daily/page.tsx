import Link from 'next/link';
import type { Metadata } from 'next';
import {
  GangiIntro,
  GangiPageHeader,
} from '@/components/gangi/gangi-ui';
import { TAROT_QUESTION_OPTIONS } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '타로',
  description: '질문을 고르고 카드 한 장을 뽑아 오늘 마음의 흐름을 바로 확인하세요.',
  alternates: {
    canonical: '/tarot/daily',
  },
};

export default async function DailyTarotPage() {
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
          description="궁금한 한 가지를 고르고 바로 뽑으세요."
        >
          <div className="gangi-card-stack" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((index) => (
              <span key={index} className="gangi-tarot-card" />
            ))}
          </div>
          <div className="mt-5 flex justify-center">
            <Link href="/tarot/daily/pick" className="gangi-primary-button max-w-xs">
              카드 뽑으러 가기
            </Link>
          </div>
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
              className="min-h-24 w-full resize-none rounded-[1rem] border border-[var(--app-line)] bg-white px-4 py-3 text-sm font-medium leading-6 text-[var(--app-ink)] outline-none placeholder:text-[rgba(17,17,20,0.38)] focus:border-[var(--app-pink)]"
            />
            <button type="submit" className="gangi-secondary-button">
              이 질문으로 카드 뽑기
            </button>
          </form>
        </section>
      </AppPage>
    </AppShell>
  );
}
