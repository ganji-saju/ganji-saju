// 2026-06-21 P1·A4 — 질문 시드 기반 3-card 스프레드 심화뷰.
// result 페이지의 "세 장으로 더 깊이 보기" CTA에서 진입. 같은 질문 = 같은 스프레드(재현성).
import Link from 'next/link';
import type { Metadata } from 'next';
import { RotateCcw } from 'lucide-react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { PaidFunnelGrid } from '@/components/seo/paid-funnel-grid';
import { TarotCardArtwork } from '@/components/tarot/tarot-card-artwork';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getTarotSpreadReadingForQuestion, normalizeQuestion } from '@/lib/tarot-api';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  searchParams: Promise<{ question?: string }>;
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
  const { question } = await searchParams;
  const currentQuestion = normalizeQuestion(question);
  const spread = await getTarotSpreadReadingForQuestion(currentQuestion);
  const resultHref = `/tarot/daily/result?question=${encodeURIComponent(currentQuestion)}`;
  const pickHref = `/tarot/daily/pick?question=${encodeURIComponent(currentQuestion)}`;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="세 장 풀이" backHref={resultHref} />

        <section className="space-y-5 px-1">
          {/* §1 머리말 */}
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              한 질문 · 세 자리
            </div>
            <h1 className="mt-1.5 text-[22px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
              현재 · 원인 · 조언으로
              <br />
              펼쳐보았어요
            </h1>
            <p className="mt-2 text-[13px] leading-[1.6] text-[var(--app-copy-muted)]">
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
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--app-ink)] text-[10px] font-extrabold text-white">
                        {index + 1}
                      </span>
                      <span className="text-[12px] font-extrabold text-[var(--app-pink-strong)]">
                        {entry.position}
                      </span>
                      <span className="rounded-full bg-[var(--app-pink-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--app-pink-strong)]">
                        {entry.reading.orientation === 'reversed' ? '역방향' : '정방향'}
                      </span>
                    </div>
                    <div className="mt-1 text-[14px] font-extrabold tracking-tight text-[var(--app-ink)]">
                      {entry.reading.displayName}
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-[1.6] text-[var(--app-copy)]">
                      {entry.reading.cardMeaning}
                    </p>
                  </div>
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
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              세 자리를 모아보면
            </div>
            <p className="mt-2 text-[13.5px] leading-[1.7] text-[var(--app-copy)]">
              {spread.synthesis}
            </p>
          </article>

          {/* entertainment + agency 고지 */}
          <p className="px-1 text-[11px] leading-[1.6] text-[var(--app-copy-soft)]">
            세 장 풀이는 마음을 정리하는 참고용 메시지예요. 미래를 단정하지 않으며, 오늘의 선택은 늘 당신의 몫입니다.
          </p>

          {/* §4 액션 */}
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={resultHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--app-line)] bg-white px-4 py-3 text-[13px] font-bold text-[var(--app-copy-muted)]"
            >
              한 장으로 돌아가기
            </Link>
            <Link
              href={pickHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--app-pink)] px-4 py-3 text-[13px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
            >
              <RotateCcw className="h-4 w-4" />
              다시 뽑기
            </Link>
          </div>

          <PaidFunnelGrid from="tarot" tone="light" includeMembership />
        </section>
      </AppPage>
    </AppShell>
  );
}
