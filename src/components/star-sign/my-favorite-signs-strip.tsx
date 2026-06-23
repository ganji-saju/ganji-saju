// 2026-05-16 PR #138 — MY 화면용 즐겨찾는 별자리 strip.
// 사용자가 follow 한 별자리들의 오늘 운세 미니카드 (가로 스크롤).
import Link from 'next/link';
import { STAR_SIGN_META } from '@/content/moonlight';
import { STAR_SIGN_FORTUNES } from '@/lib/free-content-pages';
import { getDailyFortune, toKstDateKey } from '@/lib/star-sign/daily-fortune';
import {
  ELEMENT_HEX,
  STAR_SIGN_CONTENT,
  type StarSignSlug,
} from '@/lib/star-sign/sign-content';

interface Props {
  favorites: StarSignSlug[];
}

export function MyFavoriteSignsStrip({ favorites }: Props) {
  if (favorites.length === 0) return null;
  const dateKey = toKstDateKey();

  return (
    <article
      className="rounded-[16px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          ♥ 즐겨찾는 별자리
        </div>
        <Link
          href="/star-sign"
          className="text-[12.6px] font-bold text-[var(--app-copy-soft)]"
        >
          더보기 →
        </Link>
      </div>
      <div className="-mx-2 mt-3 flex gap-2 overflow-x-auto px-2 pb-1">
        {favorites.map((slug) => {
          const item = STAR_SIGN_FORTUNES.find((s) => s.slug === slug);
          const meta = STAR_SIGN_META[slug as keyof typeof STAR_SIGN_META];
          const content = STAR_SIGN_CONTENT[slug];
          const fortune = getDailyFortune(slug, dateKey);
          const elementHex = ELEMENT_HEX[content.element];
          return (
            <Link
              key={slug}
              href={`/star-sign/${slug}`}
              className="shrink-0 rounded-[12px] border bg-white px-3 py-2 text-center"
              style={{ borderColor: 'var(--app-line)', minWidth: '96px' }}
            >
              <span
                className="text-[25.3px]"
                style={{ color: elementHex }}
                aria-hidden="true"
              >
                {meta?.symbol ?? ''}
              </span>
              <div className="mt-0.5 text-[12.6px] font-extrabold text-[var(--app-ink)]">
                {item?.label.replace('자리', '') ?? slug}
              </div>
              <div
                className="text-[16.1px] font-extrabold tabular-nums"
                style={{
                  color:
                    fortune.scores.overall >= 80
                      ? 'var(--app-jade)'
                      : fortune.scores.overall >= 65
                        ? 'var(--app-ink)'
                        : 'var(--app-amber)',
                }}
              >
                {fortune.scores.overall}
              </div>
            </Link>
          );
        })}
      </div>
    </article>
  );
}
