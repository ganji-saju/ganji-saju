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
      <span>{symbol}</span>
    </span>
  );
}
