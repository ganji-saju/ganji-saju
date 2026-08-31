import type { CSSProperties } from 'react';

const STAR_SIGN_ICON_THEMES: Record<string, { from: string; to: string }> = {
  aries: { from: '#f06a6a', to: '#ff9a6c' },
  taurus: { from: '#9f7a45', to: '#e2bd72' },
  gemini: { from: '#f0b84a', to: '#f56aa2' },
  cancer: { from: '#7192c7', to: '#c9d8f3' },
  leo: { from: '#ef8a32', to: '#ffd167' },
  virgo: { from: '#5f9c74', to: '#a8d39e' },
  libra: { from: '#d48cc5', to: '#a986d8' },
  scorpio: { from: '#8f4d70', to: '#d85f89' },
  sagittarius: { from: '#8b6be8', to: '#ca8cf0' },
  capricorn: { from: '#7f6a58', to: '#c2a586' },
  aquarius: { from: '#4c93b8', to: '#87d5e7' },
  pisces: { from: '#62a7b5', to: '#d4a9d8' },
};

export function GangiStarSignIcon({
  slug,
  symbol,
  size = 'md',
  className = '',
}: {
  slug: string;
  symbol: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const theme = STAR_SIGN_ICON_THEMES[slug] ?? STAR_SIGN_ICON_THEMES.pisces;

  return (
    <span
      className={`gangi-star-sign-icon ${className}`}
      data-size={size}
      style={
        {
          '--star-sign-from': theme.from,
          '--star-sign-to': theme.to,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {/* 2026-09-01 — ♈ 유니코드 기호 → 민화 별자리 그림(한지·먹·인주·금박, 별자리 별 장식).
          자산: public/images/gangi/icons/star-sign/{slug}.webp (256², 장당 ~8KB).
          symbol 은 이미지 실패 시 폴백으로 남긴다(계약·호출부 42곳 불변). */}
      <img
        src={`/images/gangi/icons/star-sign/${slug}.webp`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        draggable={false}
        className="gangi-star-sign-art"
      />
      <span className="gangi-star-sign-fallback">{symbol}</span>
    </span>
  );
}

/**
 * 2026-09-01 — 별자리 히어로용 민화 그림(부모 원형 칩을 꽉 채운다).
 *   ⚠️40px 이상에서만 쓴다 — 그 아래는 민화 디테일이 뭉개져 원소색 기호가 더 잘 읽힌다.
 */
export function StarSignArt({ slug, className = '' }: { slug: string; className?: string }) {
  return (
    <img
      src={`/images/gangi/icons/star-sign/${slug}.webp`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`h-full w-full rounded-full object-cover ${className}`}
    />
  );
}

/**
 * 2026-09-01 — 인라인 기호(♈) 자리를 대체하는 **크기 지정형** 민화 별자리 칩.
 *   ⚠️최소 40px — 그 아래로 줄이면 민화 디테일이 뭉개져 색 덩어리가 된다(대표 지시로 확대 통일).
 *   ring 은 기호가 색으로 전달하던 원소(불·흙·바람·물) 정보를 대신 담는다 — 그림으로 바꾸면서
 *   그 단서를 잃지 않도록 테두리로 보존한다.
 */
export function StarSignArtChip({
  slug,
  size = 44,
  ring,
  className = '',
}: {
  slug: string;
  size?: number;
  ring?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: ring ? `inset 0 0 0 2px ${ring}` : 'inset 0 0 0 1px var(--app-line)',
      }}
      aria-hidden="true"
    >
      <img
        src={`/images/gangi/icons/star-sign/${slug}.webp`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-full w-full rounded-full object-cover"
      />
    </span>
  );
}

/** 띠(12지) 그림 칩 — 별자리와 같은 규격. */
export function ZodiacArtChip({
  zodiac,
  size = 44,
  ring,
  className = '',
}: {
  zodiac: string;
  size?: number;
  ring?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: ring ? `inset 0 0 0 2px ${ring}` : 'inset 0 0 0 1px var(--app-line)',
      }}
      aria-hidden="true"
    >
      <img
        src={`/images/gangi/icons/zodiac/${zodiac}.webp`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-full w-full rounded-full object-cover"
      />
    </span>
  );
}
