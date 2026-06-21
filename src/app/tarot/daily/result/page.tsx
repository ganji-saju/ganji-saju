// Redesign 2026-05-13 (Claude Design / screens-a.jsx ScreenTarot §3):
// 카드 + 메타 side-by-side hero · 조언 카드 · 풀이 stack · 액션 row.
// 라우팅·데이터·이벤트 무수정.
import Link from 'next/link';
import type { Metadata } from 'next';
import { Bookmark, RotateCcw } from 'lucide-react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { PaidFunnelGrid } from '@/components/seo/paid-funnel-grid';
import { TarotCardArtwork } from '@/components/tarot/tarot-card-artwork';
// 2026-05-15 handoff PR-E: 53 m-tarot — 결과 페이지 진입 시 카드 flip reveal.
import { TarotCardFlipReveal } from '@/components/tarot/tarot-card-flip-reveal';
import '@/components/motion/motion-primitives.css';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import {
  getTarotReadingForQuestion,
  normalizeQuestion,
} from '@/lib/tarot-api';
import { TarotSnapshotSaver } from '@/components/tarot/tarot-snapshot-saver';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

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
    description: '카드 의미와 사주 연결 해석을 함께 보여주는 간지사주의 타로 결과 화면입니다.',
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
  const pickHref = `/tarot/daily/pick?question=${encodeURIComponent(currentQuestion)}`;
  const spreadHref = `/tarot/daily/spread?question=${encodeURIComponent(currentQuestion)}`;
  const sajuHref = readingSlug ? `/saju/${readingSlug}` : '/saju/new';

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="오늘의 타로" backHref={pickHref} />

        {/* 로그인 사용자의 타로 결과를 보관함에 저장(카드 선택된 경우만, 마운트 시 1회). */}
        {cardId ? (
          <TarotSnapshotSaver
            question={currentQuestion}
            cardId={cardId}
            orientation={reading.orientation}
          />
        ) : null}

        <section className="space-y-5 px-1">
          {/* §1 Drawn card + 메타 — mockup §3 side-by-side */}
          <article className="rounded-[18px] border border-[var(--app-line)] bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--app-ink)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.04em] text-white">
                DRAWN
              </span>
              <span className="text-[12px] text-[var(--app-copy-soft)]">
                방금 뽑은 카드
              </span>
            </div>
            <div className="mt-3.5 flex gap-3.5">
              <div className="shrink-0" style={{ width: 92, height: 132 }}>
                {/* 2026-05-15 handoff 53 m-tarot — 결과 페이지 진입 시 카드 뒷면 → 앞면 3D flip */}
                <TarotCardFlipReveal delayMs={600}>
                  <TarotCardArtwork
                    cardId={reading.card.name_short}
                    shortName={reading.shortName}
                    displayName={reading.displayName}
                    cardMarker={reading.cardMarker}
                    arcanaLabel={reading.arcanaLabel}
                    className="h-[132px] w-[92px]"
                    priority
                  />
                </TarotCardFlipReveal>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  {reading.arcanaLabel}
                </div>
                <h1 className="mt-0.5 text-[20px] font-extrabold leading-tight tracking-tight text-[var(--app-ink)]">
                  {reading.displayName}
                </h1>
                <div className="mt-1 text-[12.5px] text-[var(--app-copy-soft)]">
                  {reading.shortName}
                </div>
                <p className="mt-2.5 text-[12.5px] leading-[1.55] text-[var(--app-copy)]">
                  {reading.answer}
                </p>
              </div>
            </div>
          </article>

          {/* §2 오늘의 조언 */}
          <article
            className="rounded-[18px] border p-5"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              오늘의 조언
            </div>
            <h2 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
              {reading.answer}
            </h2>
            <p className="mt-2 text-[13px] leading-[1.65] text-[var(--app-copy)]">
              {reading.action}
            </p>
          </article>

          {/* §3 풀이 stack */}
          <section className="space-y-2.5">
            {/* 이 카드 자체의 의미(RWS 충실 한글) — 정/역 반영. 56 마이너 카드 차별화. */}
            <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                이 카드가 말하는 것
                <span className="rounded-full bg-[var(--app-pink-soft)] px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-[var(--app-pink-strong)]">
                  {reading.orientation === 'reversed' ? '역방향' : '정방향'}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.65] text-[var(--app-copy)]">
                {reading.cardMeaning}
              </p>
            </article>
            <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                마음에 둘 말
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.65] text-[var(--app-copy)]">
                {reading.guidance}
              </p>
            </article>
            <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                사주와 이어보면
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.65] text-[var(--app-copy)]">
                {reading.sajuBlend}
              </p>
            </article>
          </section>

          {/* entertainment + agency 고지 — 예측 적중이 아니라 참고용 성찰 메시지임을 명시.
              결정은 사용자에게 돌려준다(deterministic-doom 방지·정직성). */}
          <p className="px-1 text-[11px] leading-[1.6] text-[var(--app-copy-soft)]">
            오늘의 타로는 마음을 정리하는 참고용 메시지예요. 미래를 단정하지 않으며,
            오늘의 선택은 늘 당신의 몫입니다.
          </p>

          {/* P1·A4 — 같은 질문을 현재·원인·조언 세 자리로 펼치는 심화뷰(질문 시드 결정론). */}
          <Link
            href={spreadHref}
            className="flex items-center justify-between rounded-[16px] border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] px-4 py-3.5"
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-extrabold tracking-tight text-[var(--app-ink)]">
                세 장으로 더 깊이 보기
              </span>
              <span className="mt-0.5 block text-[11.5px] text-[var(--app-copy-soft)]">
                현재 · 원인 · 조언 세 자리로 펼쳐 흐름을 이어 읽어요
              </span>
            </span>
            <span className="ml-3 shrink-0 text-[var(--app-pink-strong)]" aria-hidden="true">
              →
            </span>
          </Link>

          {/* §4 액션 — 다시 뽑기 + 사주로 이어보기 */}
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={pickHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--app-line)] bg-white px-4 py-3 text-[13px] font-bold text-[var(--app-copy-muted)]"
            >
              <RotateCcw className="h-4 w-4" />
              다시 뽑기
            </Link>
            <Link
              href={sajuHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--app-pink)] px-4 py-3 text-[13px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
            >
              <Bookmark className="h-4 w-4" />
              사주로 이어보기
            </Link>
          </div>

          {/* 2026-05-20 Phase 8-E — 무료 → 유료 funnel (사주 + 궁합 + 멤버십). */}
          <PaidFunnelGrid from="tarot" tone="light" includeMembership />
        </section>
      </AppPage>
    </AppShell>
  );
}
