// 2026-08-26 — 수호신 초상 아바타(원형 크롭). 스펙 §2 2차분 '표정 변형'의 배선 지점.
//
//   ZodiacChip(인장)과 역할이 다르다: 인장은 **표식**(카드·라벨·배정 낙관), 초상은 **말하는 주체**다.
//   대화방처럼 상대가 말을 거는 자리에는 도장이 아니라 얼굴이 맞다.
//
//   원본이 4:5 전신이라 `object-top` 으로 위쪽(얼굴+인장 현판)만 잘라 쓴다.

import { guardianForZodiac } from '@/lib/guardians';
import type { ZodiacKey } from '@/components/gangi/zodiac-data';

export type GuardianMood = 'serious' | 'smile' | 'default';

const SIZE_PX: Record<'sm' | 'md' | 'lg', number> = {
  sm: 36,
  md: 48,
  lg: 64,
};

export function GuardianAvatar({
  zodiac,
  mood = 'default',
  size = 'md',
  className = '',
}: {
  zodiac: ZodiacKey;
  /** serious = 풀이·집중하는 자리 · smile = 맞이·배정하는 자리 · default = 기본 전신. */
  mood?: GuardianMood;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const guardian = guardianForZodiac(zodiac);
  const px = SIZE_PX[size];
  const src = mood === 'default' ? guardian.image : guardian.moods[mood];
  const shape =
    `shrink-0 rounded-full border border-[rgba(28,26,23,0.14)] bg-white object-cover object-top ${className}`.trim();

  return (
    <img
      src={src}
      alt={`${guardian.animalKo} 수호신`}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      className={shape}
      style={{ width: px, height: px }}
    />
  );
}
