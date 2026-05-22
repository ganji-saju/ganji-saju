// 2026-05-21 — 오행 도미넌트/균형 순수 로직(Phase 4 — 오행 차트 UI).
//   getDominantOhaeng(최다 오행) · getOhaengBalanceLevel(F4 0~20 → 균형 레벨/라벨).
//   UI/SVG 의존 없는 순수 계산이라 단위 테스트로 검증.
//   2026-05-22 — 레거시 레이더 컴포넌트 제거로 computeOhaengRadarPoints/Radar* 좌표 로직 제거.
import type { Ohaeng } from './types';

export const OHAENG_RADAR_ORDER: Ohaeng[] = ['목', '화', '토', '금', '수'];

/** 최다 count 오행(동점이면 목화토금수 순서 우선). */
export function getDominantOhaeng(counts: Record<Ohaeng, number>): Ohaeng {
  return OHAENG_RADAR_ORDER.reduce(
    (best, el) => ((counts[el] ?? 0) > (counts[best] ?? 0) ? el : best),
    OHAENG_RADAR_ORDER[0]
  );
}

export type OhaengBalanceLevel = 'high' | 'mid' | 'low';

/** F4(오행 균형, 0~20) → 균형 레벨 + 일상어 라벨(한자 0). */
export function getOhaengBalanceLevel(
  balanceScore: number
): { level: OhaengBalanceLevel; label: string } {
  if (balanceScore >= 15) return { level: 'high', label: '다섯 기운이 고른 편이에요' };
  if (balanceScore >= 9) return { level: 'mid', label: '비교적 균형 잡힌 편이에요' };
  return { level: 'low', label: '기운이 한쪽으로 치우친 편이에요' };
}
