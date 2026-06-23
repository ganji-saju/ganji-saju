// 2026-06-21 P1·A4 — 3-card 스프레드. 피커에서 직접 고른 3장(URL cards/orientations)으로
// 렌더하며, 그 3장이 결과를 결정하므로 같은 URL = 같은 스프레드(URL로 replay·공유 가능).
// cards 파라미터가 없으면(레거시 진입) 질문 시드 스프레드로 폴백.
import Link from 'next/link';
import type { Metadata } from 'next';
import { Bookmark, RotateCcw } from 'lucide-react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { PaidFunnelGrid } from '@/components/seo/paid-funnel-grid';
import { TarotCardArtwork } from '@/components/tarot/tarot-card-artwork';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  getTarotSpreadReadingForCards,
  getTarotSpreadReadingForQuestion,
  normalizeQuestion,
  type TarotOrientation,
  type TarotSpreadPick,
} from '@/lib/tarot-api';
import { TarotSpreadSnapshotSaver } from '@/components/tarot/tarot-spread-snapshot-saver';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  searchParams: Promise<{ question?: string; cards?: string; orientations?: string }>;
}

// URL의 cards/orientations(쉼표 구분) → 사용자가 고른 픽 배열. 중복 제거 + 최대 3장
// 정규화(변조·중복·초과 URL 방어 — render/save/replay 가 항상 같은 3장에 합의).
function parseSpreadPicks(cards?: string, orientations?: string): TarotSpreadPick[] {
  if (!cards) return [];
  const ids = cards.split(',').map((value) => value.trim()).filter(Boolean);
  const oris = (orientations ?? '').split(',').map((value) => value.trim());
  const seen = new Set<string>();
  const picks: TarotSpreadPick[] = [];
  ids.forEach((cardId, index) => {
    if (seen.has(cardId) || picks.length >= 3) return;
    seen.add(cardId);
    const orientation: TarotOrientation = oris[index] === 'r' ? 'reversed' : 'upright';
    picks.push({ cardId, orientation });
  });
  return picks;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '타로 세 장 풀이',
    description: '하나의 질문을 현재·원인·조언 세 자리로 펼쳐, 흐름을 잇는 종합 해석을 보여주는 간지사주의 타로 스프레드 화면입니다.',
    alternates: {
      canonical: '/tarot/daily/spread',
    },
  };
}

export default async function TarotSpreadPage({ searchParams }: Props) {
  const { question, cards, orientations } = await searchParams;
  const currentQuestion = normalizeQuestion(question);
  const picks = parseSpreadPicks(cards, orientations);
  // 사용자가 직접 고른 3장이 있으면 그 카드로, 없으면 질문 시드 스프레드로.
  const spread =
    picks.length >= 3
      ? await getTarotSpreadReadingForCards(currentQuestion, picks)
      : await getTarotSpreadReadingForQuestion(currentQuestion);
  const isUserPicked = picks.length >= 3;
  const pickHref = `/tarot/daily/pick?question=${encodeURIComponent(currentQuestion)}`;
  const profile = await getOptionalSignedInProfile();
  const readingSlug = buildProfileReadingSlug(profile);
  const sajuHref = readingSlug ? `/saju/${readingSlug}` : '/saju/new';

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="세 장 풀이" backHref={pickHref} />

        {/* 로그인 사용자의 스프레드 결과를 보관함에 저장(사용자가 직접 고른 3장일 때만). */}
        {isUserPicked ? (
          <TarotSpreadSnapshotSaver
            question={currentQuestion}
            picks={picks}
          />
        ) : null}

        <section className="space-y-5 px-1">
          {/* §1 머리말 */}
          <div>
            <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              한 질문 · 세 자리
            </div>
            <h1 className="mt-1.5 text-[25.3px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
              현재 · 원인 · 조언으로
              <br />
              펼쳐보았어요
            </h1>
            <p className="mt-2 text-[15px] leading-[1.6] text-[var(--app-copy-muted)]">
              “{currentQuestion}”
            </p>
          </div>

          {/* §2 세 장 — 포지션별 카드 + 의미 */}
          <section className="space-y-2.5">
            {spread.positions.map((entry, index) => (
              <article
                key={`${entry.position}-${entry.reading.card.name_short}`}
                className="rounded-[16px] border border-[var(--app-line)] bg-white p-4"
              >
                <div className="flex gap-3.5">
                  <div className="shrink-0" style={{ width: 76, height: 109 }}>
                    <TarotCardArtwork
                      cardId={entry.reading.card.name_short}
                      shortName={entry.reading.shortName}
                      displayName={entry.reading.displayName}
                      cardMarker={entry.reading.cardMarker}
                      arcanaLabel={entry.reading.arcanaLabel}
                      className="h-[109px] w-[76px]"
                      priority={index === 0}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--app-ink)] text-[11.5px] font-extrabold text-white">
                        {index + 1}
                      </span>
                      <span className="text-[13.8px] font-extrabold text-[var(--app-pink-strong)]">
                        {entry.position}
                      </span>
                      <span className="rounded-full bg-[var(--app-pink-soft)] px-1.5 py-0.5 text-[10.4px] font-bold text-[var(--app-pink-strong)]">
                        {entry.reading.orientation === 'reversed' ? '역방향' : '정방향'}
                      </span>
                    </div>
                    <div className="mt-1 text-[16.1px] font-extrabold tracking-tight text-[var(--app-ink)]">
                      {entry.reading.displayName}
                    </div>
                    <p className="mt-1.5 text-[14.4px] leading-[1.65] text-[var(--app-copy)]">
                      {entry.insight}
                    </p>
                  </div>
                </div>
                {/* 카드 자체의 의미 — 풍부한 한글 풀이 */}
                <div className="mt-3 rounded-[12px] bg-[var(--app-pink-soft)]/60 p-3">
                  <div className="text-[11.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                    카드의 메시지
                  </div>
                  <p className="mt-1 text-[14.4px] leading-[1.7] text-[var(--app-copy)]">
                    {entry.reading.cardMeaning}
                  </p>
                </div>
              </article>
            ))}
          </section>

          {/* §3 종합 — 세 자리를 잇는 서사 */}
          <article
            className="rounded-[18px] border p-5"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              세 자리를 모아보면
            </div>
            <p className="mt-2 text-[15.5px] leading-[1.75] text-[var(--app-copy)]">
              {spread.synthesis}
            </p>
          </article>

          {/* §3.5 오늘 마음에 둘 한 가지 — 조언 자리 카드의 구체적 행동 */}
          {spread.closing ? (
            <article className="rounded-[16px] border border-[var(--app-line)] bg-white p-4">
              <div className="flex items-center gap-1.5 text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                <span aria-hidden="true">🌙</span>
                오늘 마음에 둘 한 가지
              </div>
              <p className="mt-1.5 text-[15.5px] font-semibold leading-[1.7] text-[var(--app-ink)]">
                {spread.closing}
              </p>
            </article>
          ) : null}

          {/* entertainment + agency 고지 */}
          <p className="px-1 text-[12.6px] leading-[1.6] text-[var(--app-copy-soft)]">
            세 장 풀이는 마음을 정리하는 참고용 메시지예요. 미래를 단정하지 않으며, 오늘의 선택은 늘 당신의 몫입니다.
          </p>

          {/* §4 액션 */}
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={pickHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--app-line)] bg-white px-4 py-3 text-[15px] font-bold text-[var(--app-copy-muted)]"
            >
              <RotateCcw className="h-4 w-4" />
              다시 뽑기
            </Link>
            <Link
              href={sajuHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--app-pink)] px-4 py-3 text-[15px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
            >
              <Bookmark className="h-4 w-4" />
              사주로 이어보기
            </Link>
          </div>

          <PaidFunnelGrid from="tarot" tone="light" includeMembership />
        </section>
      </AppPage>
    </AppShell>
  );
}
