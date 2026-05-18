import type { Stem } from '@/lib/saju/types';
import type { TenGodCode } from '@/domain/saju/engine/saju-data-v1';
import { getTenGodHangul } from '@/domain/saju/engine/orrery-adapter';

const STEM_HANJA_TO_KEY: Record<string, Stem> = {
  甲: '甲', 乙: '乙', 丙: '丙', 丁: '丁', 戊: '戊',
  己: '己', 庚: '庚', 辛: '辛', 壬: '壬', 癸: '癸',
};

export function getCycleSipsin(
  dayMasterStem: Stem,
  cycleGanzi: string,
): TenGodCode | null {
  if (!cycleGanzi) return null;
  const stemChar = cycleGanzi.charAt(0);
  const stem = STEM_HANJA_TO_KEY[stemChar];
  if (!stem) return null;
  try {
    return getTenGodHangul(dayMasterStem, stem);
  } catch {
    return null;
  }
}
