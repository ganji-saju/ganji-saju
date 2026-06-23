// Redesign 2026-05-13 (Claude Design / screens-a.jsx ScreenTarot):
// 타로 진입 화면 — 다크 카드 stage + 질문 list + 직접 입력 + 무료 안내.
// 라우팅·이벤트 무수정.
import Link from 'next/link';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { TAROT_QUESTION_OPTIONS } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '타로',
  description: '질문을 고르고 카드 세 장을 뽑아 현재·원인·조언으로 오늘의 흐름을 읽어보세요.',
  alternates: {
    canonical: '/tarot/daily',
  },
};

const CARD_FAN_INDICES = [0, 1, 2, 3, 4] as const;

export default async function DailyTarotPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="오늘의 타로" backHref="/free" />

        <section className="space-y-5 px-1">
          {/* §1 Eyebrow + headline */}
          <div>
            <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              세 장 타로 · 무료
            </div>
            <h1 className="mt-1.5 text-[27.6px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
              마음에 떠오르는
              <br />
              세 장을 골라보세요
            </h1>
            <p className="mt-2 text-[15px] leading-[1.6] text-[var(--app-copy-muted)]">
              궁금한 한 가지를 고르고 카드 세 장을 뽑으세요. 현재·원인·조언으로 오늘의 흐름을 보여줍니다.
            </p>
          </div>

          {/* §2 Dark card stage — mockup의 5-card fan */}
          <Link
            href="/tarot/daily/pick"
            className="relative block overflow-hidden rounded-[22px] px-4 py-7"
            style={{
              background: 'linear-gradient(180deg, #1a0a1f 0%, #2a0d2f 100%)',
            }}
            aria-label="카드 뽑으러 가기"
          >
            {/* 별빛 배경 */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 30%, #fff 0.5px, transparent 1px), radial-gradient(circle at 80% 70%, #fff 0.5px, transparent 1px), radial-gradient(circle at 50% 50%, #fff 0.5px, transparent 1px)',
                backgroundSize: '60px 60px, 80px 80px, 40px 40px',
              }}
            />
            <div className="relative flex justify-center gap-2.5">
              {CARD_FAN_INDICES.map((i) => {
                const isCenter = i === 2;
                const offset = i - 2;
                return (
                  <div
                    key={i}
                    className="grid h-[92px] w-[56px] place-items-center rounded-[10px] border text-[27.6px] font-bold"
                    style={{
                      background: isCenter
                        ? 'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))'
                        : 'linear-gradient(135deg, #4a1538, #2a0d2f)',
                      borderColor: 'rgba(255,255,255,0.16)',
                      transform: `rotate(${offset * 6}deg) translateY(${Math.abs(offset) * 4}px)`,
                      color: isCenter ? '#fff' : 'rgba(255,255,255,0.32)',
                      fontFamily: 'var(--font-han)',
                      boxShadow: isCenter ? '0 8px 20px rgba(255,79,154,0.45)' : 'none',
                    }}
                    aria-hidden="true"
                  >
                    {isCenter ? '♥' : '☾'}
                  </div>
                );
              })}
            </div>
            <p className="relative mt-3.5 text-center text-[13.8px] text-white/70">
              세 장을 골라 탭하세요
            </p>
            <div className="relative mt-4 flex justify-center">
              <span className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-2.5 text-[15px] font-extrabold text-white shadow-[0_8px_20px_rgba(255,79,154,0.45)]">
                카드 뽑으러 가기 →
              </span>
            </div>
          </Link>

          {/* §3 질문별 타로 */}
          <section>
            <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">
              질문별 타로
            </h2>
            <p className="mt-1 text-[13.8px] text-[var(--app-copy-muted)]">
              궁금한 주제를 먼저 골라보세요
            </p>
            <div className="mt-3 grid gap-2.5">
              {TAROT_QUESTION_OPTIONS.slice(0, 6).map((question) => (
                <Link
                  key={question.label}
                  href={{ pathname: '/tarot/daily/pick', query: { question: question.label } }}
                  className="flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
                >
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-[20.7px]"
                    style={{
                      background: '#2a0d2f',
                      color: '#fff',
                    }}
                  >
                    {question.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[16.1px] font-extrabold tracking-tight text-[var(--app-ink)]">
                      {question.label}
                    </div>
                    <p className="mt-0.5 text-[13.2px] text-[var(--app-copy-soft)]">
                      {question.description}
                    </p>
                  </div>
                  <span className="text-[var(--app-copy-soft)]" aria-hidden="true">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* §4 직접 질문 작성 */}
          <section>
            <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">
              직접 질문 쓰기
            </h2>
            <p className="mt-1 text-[13.8px] text-[var(--app-copy-muted)]">
              내 마음에 떠오른 그대로 물어보세요
            </p>
            <form
              action="/tarot/daily/pick"
              className="mt-3 grid gap-2.5 rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
            >
              <textarea
                name="question"
                rows={3}
                placeholder="예: 지금 마음을 전해도 괜찮을까요"
                className="min-h-[88px] w-full resize-none rounded-[12px] border border-[var(--app-line)] bg-white px-3.5 py-3 text-[16.1px] font-medium leading-6 text-[var(--app-ink)] outline-none placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
              />
              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] text-[16.1px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
              >
                이 질문으로 카드 뽑기 →
              </button>
            </form>
          </section>
        </section>
      </AppPage>
    </AppShell>
  );
}
