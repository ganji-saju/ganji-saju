// Redesign 2026-05-13 (Claude Design / screens-a.jsx ScreenTarot):
// 타로 진입 화면 — 다크 카드 stage + 질문 list + 직접 입력.
// 2026-08-31 — 8/28 유료 전환(당일권 3,300) 뒤에도 남아 있던 "무료" 카피 제거 +
//   멤버십·당일권 통과 시 "왜 열려 있는지" 한 줄 고지(택일 사건에서 확립한 원칙:
//   통과 화면과 고장 화면이 똑같으면 정상 동작이 버그로 신고된다).
// 라우팅·이벤트 무수정.
import { guardMenuPassEntry, viewerHasMenuPass } from '@/lib/payments/menu-pass.server';
import { getPriceDisplayMap } from '@/lib/payments/price-display';
import { priceLabelFromMap } from '@/lib/payments/price-display-shared';
import Link from 'next/link';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { TAROT_QUESTION_OPTIONS } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { InkIcon } from '@/components/gangi/ink-icons';

export const metadata: Metadata = {
  title: '오늘의 타로 — 타로 카드 3장 뽑기',
  description:
    '질문을 고르고 타로 카드 세 장을 뽑아 현재·원인·조언으로 오늘의 흐름을 읽어보세요.',
  alternates: {
    canonical: '/tarot/daily',
  },
};

const CARD_FAN_INDICES = [0, 1, 2, 3, 4] as const;

export default async function DailyTarotPage() {
  // 2026-08-25 — 라이트 언락(타로, 2026-08-28 3,300원). 멤버십·이용권 없으면 체크아웃으로.
  await guardMenuPassEntry('tarot', 'tarot-daily');
  // 가드를 통과했다면 멤버십 or 오늘 당일권 보유(또는 supabase env 부재 로컬).
  //   가격은 리졸버가 렌더한다 — 프로즈에 금액 리터럴 금지(가격 변경 시 stale 방지).
  const hasPass = await viewerHasMenuPass('tarot');
  const passLabel = hasPass
    ? '멤버십·당일권으로 이용 중'
    : `당일권 ${priceLabelFromMap(await getPriceDisplayMap(), 'taste_tarot_daily')}`;
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="오늘의 타로" backHref="/free" />

        <section className="space-y-5 px-1">
          {/* §1 Eyebrow + headline */}
          <div>
            <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              세 장 타로 · {passLabel}
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
              // 2026-08-31 민화 덱 리브랜드 — 퍼플 밤하늘 → 따뜻한 먹 바탕 + 금박 별빛
              background: 'linear-gradient(180deg, #26211b 0%, #17140f 100%)',
            }}
            aria-label="카드 뽑으러 가기"
          >
            {/* 금박 별빛 배경 */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 30%, #dcc79a 0.5px, transparent 1px), radial-gradient(circle at 80% 70%, #dcc79a 0.5px, transparent 1px), radial-gradient(circle at 50% 50%, #dcc79a 0.5px, transparent 1px)',
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
                        : 'linear-gradient(135deg, #3a332a, #221d17)',
                      borderColor: 'rgba(220,199,154,0.28)',
                      transform: `rotate(${offset * 6}deg) translateY(${Math.abs(offset) * 4}px)`,
                      color: isCenter ? '#fff' : 'rgba(220,199,154,0.45)',
                      fontFamily: 'var(--font-han)',
                      boxShadow: isCenter ? '0 8px 20px rgba(179,55,42,0.45)' : 'none',
                    }}
                    aria-hidden="true"
                  >
                    {isCenter ? <InkIcon name="love" size={16} /> : <InkIcon name="moon" size={16} />}
                  </div>
                );
              })}
            </div>
            <p className="relative mt-3.5 text-center text-[13.8px] text-white/70">
              세 장을 골라 탭하세요
            </p>
            <div className="relative mt-4 flex justify-center">
              <span className="inline-flex items-center justify-center rounded-[12px] bg-[var(--app-pink)] px-5 py-2.5 text-[15px] font-extrabold text-white shadow-[0_8px_20px_rgba(179,55,42,0.45)]">
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
                      background: 'var(--app-ink)',
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
                className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] text-[16.1px] font-extrabold text-white shadow-[0_12px_28px_rgba(142,42,32,0.32)]"
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
