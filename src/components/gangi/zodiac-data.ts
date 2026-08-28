// 2026-08-25 — ZodiacChip 의 데이터부를 .ts 로 분리. node 테스트 러너가 .tsx 임포트를
//   못 읽어 guardians.ts(테스트 대상)가 이 데이터를 쓰려면 .ts 여야 한다
//   (comprehensive-toc-items.ts 와 같은 전례). 렌더 컴포넌트는 zodiac-chip.tsx 그대로.

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
