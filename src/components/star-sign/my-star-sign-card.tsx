// 2026-05-15 — MY 화면용 별자리 카드.
// 프로필 birthMonth/Day 에서 별자리 자동 매칭 → 오늘 점수 + 하이라이트 + 상세 link.
// home, /my, /my/results 등에서 재사용.
import Link from 'next/link';
import { STAR_SIGN_META } from '@/content/moonlight';
import { STAR_SIGN_FORTUNES } from '@/lib/free-content-pages';
import type { UserProfile } from '@/lib/profile';
import { buildStarSignSlugFromProfile } from '@/lib/profile-personalization';
import { getDailyFortune, toKstDateKey } from '@/lib/star-sign/daily-fortune';
import {
  ELEMENT_HEX,
  STAR_SIGN_CONTENT,
  type StarSignSlug,
} from '@/lib/star-sign/sign-content';

interface Props {
  profile: UserProfile | null | undefined;
  /** 컴팩트 (단일 줄) vs 일반. */
  variant?: 'default' | 'compact';
}

export function MyStarSignCard({ profile, variant = 'default' }: Props) {
  const slug = buildStarSignSlugFromProfile(profile);
  if (!slug) return null;
  const typedSlug = slug as StarSignSlug;
  const item = STAR_SIGN_FORTUNES.find((s) => s.slug === slug);
  if (!item) return null;
  const meta = STAR_SIGN_META[slug as keyof typeof STAR_SIGN_META];
  const content = STAR_SIGN_CONTENT[typedSlug];
  const fortune = getDailyFortune(typedSlug, toKstDateKey());
  const elementHex = ELEMENT_HEX[content.element];

  if (variant === 'compact') {
    return (
      <Link
        href={`/star-sign/${slug}`}
        className="flex items-center gap-3 rounded-[14px] border bg-white p-3"
        style={{ borderColor: 'var(--app-pink-line)' }}
      >
        <span className="text-[22px]" style={{ color: elementHex }} aria-hidden="true">
          {meta.symbol}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-[var(--app-pink-strong)]">
            MY 별자리 · {item.label}
          </div>
          <div
            className="mt-0.5 truncate text-[12px] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {fortune.highlight}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-extrabold tabular-nums text-[var(--app-pink-strong)]">
            {fortune.scores.overall}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/star-sign/${slug}`}
      className="block rounded-[16px] border p-4"
      style={{
        background: 'var(--app-pink-soft)',
        borderColor: 'var(--app-pink-line)',
      }}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          ⭐ MY 별자리
        </div>
        <div className="text-[10.5px] text-[var(--app-copy-soft)]">{fortune.dateKey}</div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-[32px]" style={{ color: elementHex }} aria-hidden="true">
          {meta.symbol}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-extrabold text-[var(--app-ink)]">
            {item.label}
          </div>
          <div className="mt-0.5 text-[10.5px] text-[var(--app-copy-soft)]">
            {item.dateRange} · {content.rulingPlanetKo}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase font-bold text-[var(--app-copy-soft)]">
            오늘
          </div>
          <div className="text-[22px] font-extrabold tabular-nums text-[var(--app-pink-strong)]">
            {fortune.scores.overall}
          </div>
        </div>
      </div>
      <p
        className="mt-2.5 text-[12.5px] leading-[1.55] text-[var(--app-ink)]"
        style={{ wordBreak: 'keep-all' }}
      >
        {fortune.highlight}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className="rounded-full border bg-white px-2 py-0.5 text-[10.5px] font-bold text-[var(--app-pink-strong)]"
          style={{ borderColor: 'var(--app-pink-line)' }}
        >
          ☘ {fortune.boost.slice(0, 24)}
          {fortune.boost.length > 24 ? '…' : ''}
        </span>
      </div>
      <div
        className="mt-2 text-[10.5px] font-bold text-[var(--app-pink-strong)]"
      >
        상세 흐름·럭키·호환 보기 →
      </div>
    </Link>
  );
}
