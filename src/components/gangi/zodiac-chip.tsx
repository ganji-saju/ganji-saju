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

// ZODIAC 데이터는 zodiac-data.ts 로 분리(테스트 러너 .tsx 임포트 불가) — 재수출로 호환 유지.
export { ZODIAC, type ZodiacKey } from './zodiac-data';
import { ZODIAC } from './zodiac-data';
import type { ZodiacKey } from './zodiac-data';

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
