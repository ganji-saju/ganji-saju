// 2026-05-16 — 오늘 별자리 일진 다이제스트 카드.
// /notifications 페이지 등에서 사용 — 12 sign 의 오늘 운세 한눈 (TOP 3 + caution + 원소 흐름).
import Link from 'next/link';
import { computeStarSignDailyDigest } from '@/lib/star-sign/daily-digest';
import {
  ELEMENT_HEX,
  type SignElement,
} from '@/lib/star-sign/sign-content';

const MOOD_LABEL: Record<'warm' | 'calm' | 'dynamic' | 'sensitive', string> = {
  warm: '따뜻함',
  calm: '차분함',
  dynamic: '활기',
  sensitive: '섬세함',
};

export function StarSignDailyDigestCard() {
  const digest = computeStarSignDailyDigest();
  const bestElementHex = ELEMENT_HEX[digest.bestElement.element];

  // mood distribution 의 최다 항목.
  const sortedMoods = (
    Object.entries(digest.moodDistribution) as Array<[
      'warm' | 'calm' | 'dynamic' | 'sensitive',
      number,
    ]>
  ).sort((a, b) => b[1] - a[1]);
  const dominantMood = sortedMoods[0]!;

  return (
    <article
      className="rounded-[18px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
    >
      {/* §header */}
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          ⭐ 오늘 별자리 일진
        </div>
        <div className="text-[10.5px] text-[var(--app-copy-soft)]">{digest.dateKey}</div>
      </div>
      <p className="mt-1 text-[11.5px] text-[var(--app-copy-muted)]">
        12 별자리 평균 {digest.globalAverage}점 · 최다 분위기 {MOOD_LABEL[dominantMood[0]]}
      </p>

      {/* §element of the day */}
      <div
        className="mt-3 rounded-[12px] border p-3"
        style={{
          background: 'rgba(0,0,0,0.025)',
          borderColor: 'var(--app-line)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-extrabold text-white"
            style={{ background: bestElementHex }}
            aria-hidden="true"
          >
            {digest.bestElement.label[0]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              오늘 흐름 좋은 원소
            </div>
            <div className="text-[13px] font-extrabold text-[var(--app-ink)]">
              {digest.bestElement.label}자리 평균{' '}
              <span style={{ color: bestElementHex }}>
                {digest.bestElement.averageScore}
              </span>점
            </div>
          </div>
        </div>
      </div>

      {/* §top 3 */}
      <div className="mt-3">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
          TOP 3
        </div>
        <div className="mt-1.5 grid gap-1.5">
          {digest.topThree.map((entry, idx) => {
            const elementHex = ELEMENT_HEX[entry.element as SignElement];
            const rankColor =
              idx === 0
                ? 'var(--app-pink-strong)'
                : idx === 1
                  ? 'var(--app-amber)'
                  : 'var(--app-jade)';
            return (
              <Link
                key={entry.slug}
                href={`/star-sign/${entry.slug}`}
                className="flex items-center gap-2 rounded-[10px] border bg-white px-2.5 py-2"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
                  style={{ background: rankColor }}
                >
                  {idx + 1}
                </span>
                <span className="text-[18px]" style={{ color: elementHex }} aria-hidden="true">
                  {entry.symbol}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-extrabold text-[var(--app-ink)]">
                    {entry.label}
                  </div>
                  <div
                    className="truncate text-[10.5px] text-[var(--app-copy-soft)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {entry.highlight}
                  </div>
                </div>
                <div
                  className="text-[15px] font-extrabold tabular-nums"
                  style={{ color: rankColor }}
                >
                  {entry.overall}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* §caution */}
      <Link
        href={`/star-sign/${digest.caution.slug}`}
        className="mt-3 flex items-center gap-2 rounded-[10px] border px-3 py-2"
        style={{
          background: 'rgba(212,148,38,0.04)',
          borderColor: 'rgba(212,148,38,0.22)',
        }}
      >
        <span className="text-[16px]" style={{ color: 'var(--app-amber)' }} aria-hidden="true">
          ⚠
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-extrabold text-[var(--app-amber)]">
            살짝 주의 · {digest.caution.label}
          </div>
          <div
            className="truncate text-[10.5px] text-[var(--app-copy-soft)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {digest.caution.highlight}
          </div>
        </div>
        <div className="text-[14px] font-extrabold tabular-nums text-[var(--app-amber)]">
          {digest.caution.overall}
        </div>
      </Link>

      {/* §cta */}
      <Link
        href="/star-sign"
        className="mt-3 block rounded-full border bg-white py-2 text-center text-[12px] font-bold text-[var(--app-pink-strong)]"
        style={{ borderColor: 'var(--app-pink-line)' }}
      >
        12 별자리 전체 보기 →
      </Link>
    </article>
  );
}
