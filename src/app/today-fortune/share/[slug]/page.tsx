// 2026-07-03 — 오늘운세 공개 공유 티저 (docs/superpowers/specs/2026-07-03-share-snapshot-design.md).
// slug(생년 toSlug 산출물)+날짜(?d)+걱정(?c)로 발신자가 본 "무료 결과"를 로그인 없이
// 결정론 재계산해 티저(한 줄 + 점수)만 보여준다. 유료(상세/프리미엄) 콘텐츠 미포함.
// 날짜를 URL 에 고정해 다음 날 열어도 발신자가 본 그 날의 결과가 재현된다.
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteHeader from '@/features/shared-navigation/site-header';
import { fromSlug } from '@/lib/saju/pillars';
import { loadSajuDataV2 } from '@/domain/saju/engine';
import { buildTodayFortuneFreeResult } from '@/server/today-fortune/build-today-fortune';
import { parseShareDateKey } from '@/lib/today-fortune/share-date';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { ShareActions } from '@/features/saju-detail/share-actions';
import { buildKakaoShare } from '@/lib/kakao/share';
import { getCanonicalUrl } from '@/lib/site';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ d?: string; n?: string; c?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '오늘운세 공유',
    description: '친구가 공유한 오늘의 운세 점수와 한 줄 흐름입니다.',
    // 생년 정보가 URL 에 담기므로 검색 비노출(사주·궁합 공유와 동일 정책).
    robots: { index: false, follow: false },
  };
}

function cleanName(raw: string | undefined): string {
  const name = (raw ?? '').trim().slice(0, 20);
  return name || '친구';
}

function formatDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

export default async function TodayFortuneSharePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { d, n, c } = await searchParams;
  const input = fromSlug(decodeURIComponent(slug));
  if (!input) notFound();

  const name = cleanName(n);
  const concernId = normalizeConcernId(c);
  const pinnedDate = parseShareDateKey(d);

  const sajuData = loadSajuDataV2(input, null);
  const free = buildTodayFortuneFreeResult(input, sajuData, {
    concernId,
    sourceSessionId: 'shared-teaser',
    calendarType: 'solar',
    timeRule: 'standard',
    ...(pinnedDate ? { now: pinnedDate } : {}),
  });

  const dateLabel = formatDateLabel(free.dateKey);
  const overall = free.scores.find((item) => item.key === 'overall');
  const restScores = free.scores.filter((item) => item.key !== 'overall');

  // 재공유 — 날짜·이름·걱정 유지(수신자가 다시 공유해도 같은 날 결과).
  const sharePath = `/today-fortune/share/${slug}?${new URLSearchParams({
    d: free.dateKey,
    n: name,
    ...(concernId !== 'general' ? { c: concernId } : {}),
  }).toString()}`;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <section className="space-y-5 px-1">
          {/* 공유 유입 배너 */}
          <article
            className="rounded-[14px] border px-4 py-3 text-[13.8px] leading-[1.55]"
            style={{ background: 'var(--app-pink-soft)', borderColor: 'var(--app-pink-line)' }}
          >
            <span className="font-extrabold text-[var(--app-pink-strong)]">공유받은 오늘운세</span>
            <span className="text-[var(--app-copy-muted)]">
              {' '}
              — {name}님의 {dateLabel} 운세예요. 아래에서 내 운세도 바로 볼 수 있어요.
            </span>
          </article>

          {/* 한 줄 히어로 */}
          <article
            className="rounded-[18px] border bg-white p-5"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              {dateLabel} · {name}님의 오늘
            </div>
            <h1
              className="mt-1.5 text-[20.7px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {free.oneLine.headline}
            </h1>
            <p
              className="mt-2 text-[14.4px] leading-[1.65] text-[var(--app-copy-muted)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {free.oneLine.body}
            </p>
          </article>

          {/* 점수 — 총운 크게 + 나머지 그리드 */}
          {overall ? (
            <article
              className="rounded-[18px] border bg-white p-5"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
                    {overall.label}
                  </div>
                  <div className="mt-1 text-[41px] font-extrabold leading-none tracking-tight text-[var(--app-pink-strong)]">
                    {overall.score}
                  </div>
                </div>
                <p
                  className="max-w-[60%] text-right text-[13.2px] leading-[1.55] text-[var(--app-copy-muted)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {overall.summary}
                </p>
              </div>
            </article>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            {restScores.map((item) => (
              <article
                key={item.key}
                className="rounded-[14px] border bg-white p-3.5"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[13.2px] font-extrabold text-[var(--app-ink)]">
                    {item.label}
                  </span>
                  <span className="text-[18.4px] font-extrabold text-[var(--app-pink-strong)]">
                    {item.score}
                  </span>
                </div>
                <p
                  className="mt-1 text-[12.6px] leading-[1.5] text-[var(--app-copy-muted)] line-clamp-2"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {item.summary}
                </p>
              </article>
            ))}
          </div>

          {/* 내 운세 CTA */}
          <Link
            href="/today-fortune"
            className="inline-flex w-full items-center justify-center rounded-[12px] bg-[var(--app-pink)] px-4 py-3 text-[15px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
          >
            내 오늘운세 보러가기 →
          </Link>

          {/* 재공유 */}
          <section>
            <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">친구에게 공유</h2>
            <ShareActions
              text={`${name}님의 ${dateLabel} 운세 — ${free.oneLine.headline}`}
              url={getCanonicalUrl(sharePath)}
              className="mt-2.5"
              kakao={buildKakaoShare({
                title: `${name}님의 ${dateLabel} 운세`,
                description: free.oneLine.headline,
                path: sharePath,
                buttonTitle: '운세 보기',
              })}
            />
          </section>
        </section>
      </AppPage>
    </AppShell>
  );
}
