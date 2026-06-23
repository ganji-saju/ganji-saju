// Redesign 2026-05-13 (Claude Design / 적용 가이드.md §2):
// 십이간지 한자 인장 칩. 라우팅·이벤트는 일절 없는 순수 시각 컴포넌트.
// 기존 GANGI_ZODIAC 키와 호환되며 (rat, ox, ..., pig) 어디서나 drop-in.
//
// 사용 예:
//   <ZodiacChip kind="dragon" size="lg" />
//   <ZodiacChip kind="rabbit" size="sm" className="shrink-0" />

import { cn } from '@/lib/utils';
// 2026-05-15 handoff PR-G1: 59 m-hanja — ZodiacChip 한자 mount 시 entry morph.
import '@/components/motion/motion-primitives.css';

export const ZODIAC = {
  rat:     { ko: '쥐',    han: '子', color: 'var(--app-indigo)' },
  ox:      { ko: '소',    han: '丑', color: 'var(--app-jade)' },
  tiger:   { ko: '범',    han: '寅', color: 'var(--app-coral)' },
  rabbit:  { ko: '토끼',  han: '卯', color: 'var(--app-pink)' },
  dragon:  { ko: '용',    han: '辰', color: 'var(--app-plum)' },
  snake:   { ko: '뱀',    han: '巳', color: 'var(--app-amber)' },
  horse:   { ko: '말',    han: '午', color: 'var(--app-coral)' },
  sheep:   { ko: '양',    han: '未', color: 'var(--app-jade)' },
  monkey:  { ko: '원숭이', han: '申', color: 'var(--app-amber)' },
  rooster: { ko: '닭',    han: '酉', color: 'var(--app-pink-strong)' },
  dog:     { ko: '개',    han: '戌', color: 'var(--app-sky)' },
  pig:     { ko: '돼지',  han: '亥', color: 'var(--app-indigo)' },
} as const;

export type ZodiacKey = keyof typeof ZODIAC;

const SIZE = {
  sm: 'h-10 w-10 rounded-[13px] text-[21.8px]',
  md: 'h-14 w-14 rounded-[18px] text-[29.9px]',
  lg: 'h-[72px] w-[72px] rounded-[22px] text-[39.1px]',
  xl: 'h-24 w-24 rounded-[28px] text-[52.9px]',
};

export interface ZodiacChipProps {
  kind?: ZodiacKey;
  size?: keyof typeof SIZE;
  className?: string;
  /** 한자 위에 살짝 반사광 효과를 줄지. 기본 true. */
  shine?: boolean;
}

export function ZodiacChip({
  kind = 'rat',
  size = 'md',
  className,
  shine = true,
}: ZodiacChipProps) {
  const z = ZODIAC[kind] ?? ZODIAC.rat;
  return (
    <span
      role="img"
      aria-label={`${z.ko}(${z.han})`}
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
        background: z.color,
        fontFamily: 'var(--font-han)',
        letterSpacing: '-0.02em',
      }}
    >
      {/* 2026-05-15 handoff 59 m-hanja — 한자 글자에 mount 시 entry morph 적용. */}
      <span className="motion-hanja-entry">{z.han}</span>
    </span>
  );
}
