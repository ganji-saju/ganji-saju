// 2026-05-20 — 12 서양 별자리 (Aries~Pisces) 전용 chip.
//   ZodiacChip (12간지: rat/ox/.../pig) 패턴을 그대로 따른 자매 컴포넌트.
//   메인 카드 그리드의 "별자리" 카드가 12간지 'pig/亥' 를 차용하고 있어 시각적
//   일관성 부족 (PROGRESS.md §0.4) — 별자리 카드에는 StarSignChip 사용.
//
//   사용 예:
//     <StarSignChip kind="aries" size="md" />     — 특정 별자리 (분류 페이지)
//     <StarSignChip size="md" />                  — generic 대표 chip (메인 카드 그리드)
//
//   element 분류 (전통):
//     Fire (불): aries / leo / sagittarius   → coral
//     Earth (땅): taurus / virgo / capricorn → jade / sky
//     Air (공기): gemini / libra / aquarius  → amber / sky
//     Water (물): cancer / scorpio / pisces  → indigo / plum
//
//   generic (kind 미지정): 밤하늘 인디고 + ✦ — "12별자리" 통합 대표 시각

import { cn } from '@/lib/utils';
import '@/components/motion/motion-primitives.css';

export const STAR_SIGNS = {
  aries:       { ko: '양자리',     symbol: '♈', color: 'var(--app-coral)' },
  taurus:      { ko: '황소자리',   symbol: '♉', color: 'var(--app-jade)' },
  gemini:      { ko: '쌍둥이자리', symbol: '♊', color: 'var(--app-amber)' },
  cancer:      { ko: '게자리',     symbol: '♋', color: 'var(--app-indigo)' },
  leo:         { ko: '사자자리',   symbol: '♌', color: 'var(--app-coral)' },
  virgo:       { ko: '처녀자리',   symbol: '♍', color: 'var(--app-jade)' },
  libra:       { ko: '천칭자리',   symbol: '♎', color: 'var(--app-amber)' },
  scorpio:     { ko: '전갈자리',   symbol: '♏', color: 'var(--app-plum)' },
  sagittarius: { ko: '사수자리',   symbol: '♐', color: 'var(--app-coral)' },
  capricorn:   { ko: '염소자리',   symbol: '♑', color: 'var(--app-sky)' },
  aquarius:    { ko: '물병자리',   symbol: '♒', color: 'var(--app-sky)' },
  pisces:      { ko: '물고기자리', symbol: '♓', color: 'var(--app-indigo)' },
} as const;

export type StarSignKey = keyof typeof STAR_SIGNS;

const SIZE = {
  sm: 'h-10 w-10 rounded-[13px] text-[21.8px]',
  md: 'h-14 w-14 rounded-[18px] text-[29.9px]',
  lg: 'h-[72px] w-[72px] rounded-[22px] text-[39.1px]',
  xl: 'h-24 w-24 rounded-[28px] text-[52.9px]',
};

export interface StarSignChipProps {
  /** undefined 면 generic 밤하늘 대표 chip (12별자리 통합). */
  kind?: StarSignKey;
  size?: keyof typeof SIZE;
  className?: string;
  /** 글리프 위에 살짝 반사광 효과. 기본 true (ZodiacChip 과 동일). */
  shine?: boolean;
}

const NIGHT_SKY_BG =
  'linear-gradient(135deg, #1a1a30 0%, #2d1a4a 50%, #1a1a30 100%)';

export function StarSignChip({
  kind,
  size = 'md',
  className,
  shine = true,
}: StarSignChipProps) {
  const s = kind ? STAR_SIGNS[kind] : null;
  const ariaLabel = s ? `${s.ko}(${s.symbol})` : '별자리';
  const background = s ? s.color : NIGHT_SKY_BG;
  const glyph = s ? s.symbol : '✦';

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex items-center justify-center font-bold text-white',
        shine && [
          'before:pointer-events-none before:absolute before:inset-0',
          'before:rounded-[inherit] before:bg-gradient-to-b',
          'before:from-white/20 before:to-transparent',
        ],
        SIZE[size],
        className
      )}
      style={{
        background,
        // generic 일 때 작은 별 4개 텍스처 (단일 ✦ 만으로 다소 단조 → 살짝 빛 점 추가).
        ...(kind
          ? {}
          : {
              backgroundImage:
                NIGHT_SKY_BG +
                ', radial-gradient(circle at 22% 26%, rgba(255,255,255,0.45) 1px, transparent 2px)' +
                ', radial-gradient(circle at 76% 18%, rgba(255,255,255,0.32) 1px, transparent 2px)' +
                ', radial-gradient(circle at 68% 72%, rgba(255,255,255,0.28) 1px, transparent 2px)',
            }),
        // 12별자리 symbol 은 system font 가 자연스러움. ZodiacChip 은 한자 font.
        fontFamily: 'system-ui, -apple-system, sans-serif',
        letterSpacing: '-0.01em',
      }}
    >
      {/* ZodiacChip 과 동일하게 motion-hanja-entry mount morph 재사용 (글리프 entry 효과 통일). */}
      <span className="motion-hanja-entry">{glyph}</span>
    </span>
  );
}
