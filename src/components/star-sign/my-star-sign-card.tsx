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

  // 2026-06-28 — 핑크 톤 → 별자리(밤하늘) 인디고 테마로 재디자인.
  if (variant === 'compact') {
    return (
      <Link
        href={`/star-sign/${slug}`}
        className="flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] bg-white p-3"
      >
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[22px] text-white"
          style={{ background: `${elementHex}33` }}
          aria-hidden="true"
        >
          {meta.symbol}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.6px] font-bold" style={{ color: 'var(--app-indigo)' }}>
            MY 별자리 · {item.label}
          </div>
          <div
            className="mt-0.5 truncate text-[13.8px] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {fortune.highlight}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[20.7px] font-extrabold tabular-nums" style={{ color: 'var(--app-indigo)' }}>
            {fortune.scores.overall}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/star-sign/${slug}`}
      className="relative block overflow-hidden rounded-[18px] p-4 text-white shadow-[0_8px_24px_-12px_rgba(49,46,129,0.6)]"
      style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #4f46e5 100%)',
      }}
    >
      {/* 별 모티프 — 밤하늘 점광 오버레이 */}
      <span
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(1.5px 1.5px at 18% 28%, #fff, transparent), radial-gradient(1.5px 1.5px at 72% 18%, #fff, transparent), radial-gradient(1px 1px at 88% 62%, #fff, transparent), radial-gradient(1px 1px at 38% 78%, #fff, transparent), radial-gradient(1px 1px at 58% 44%, #fff, transparent)',
        }}
      />
      <div className="relative">
        <div className="flex items-baseline justify-between">
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.08em] text-white/90">
            ✦ MY 별자리
          </div>
          <div className="text-[12.1px] text-white/55">{fortune.dateKey}</div>
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[28px] text-white ring-1 ring-white/20"
            style={{ background: `${elementHex}40` }}
            aria-hidden="true"
          >
            {meta.symbol}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[17.3px] font-extrabold text-white">{item.label}</div>
            <div className="mt-0.5 text-[12.1px] text-white/60">
              {item.dateRange} · {content.rulingPlanetKo}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11.5px] font-bold uppercase text-white/55">오늘</div>
            <div className="text-[26px] font-extrabold tabular-nums text-white">
              {fortune.scores.overall}
            </div>
          </div>
        </div>
        <p
          className="mt-3 text-[14.4px] leading-[1.55] text-white/90"
          style={{ wordBreak: 'keep-all' }}
        >
          {fortune.highlight}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-[12px] bg-white/12 px-2.5 py-0.5 text-[12.1px] font-bold text-white/90 ring-1 ring-white/15">
            ☘ {fortune.boost.slice(0, 24)}
            {fortune.boost.length > 24 ? '…' : ''}
          </span>
        </div>
        <div className="mt-3 text-[12.1px] font-bold text-white/85">
          상세 흐름·럭키·호환 보기 →
        </div>
      </div>
    </Link>
  );
}
