// 2026-05-21 — 오행 레이더(펜타곤) 차트 순수 로직(Phase 4 — 오행 차트 UI).
//   computeOhaengRadarPoints: 5축 좌표(목 top, 시계방향 72°) + count 비례 데이터 폴리곤.
//   UI/SVG 의존 없는 순수 계산이라 단위 테스트로 검증. (레거시 레이더 컴포넌트는 제거됨 — 순수 로직만 유지.)
import type { Ohaeng } from './types';

export const OHAENG_RADAR_ORDER: Ohaeng[] = ['목', '화', '토', '금', '수'];

export interface RadarPoint {
  element: Ohaeng;
  x: number;
  y: number;
}

export interface OhaengRadarGeometry {
  axes: RadarPoint[]; // 각 축 끝점(full radius) — 그리드/스포크/라벨 배치용
  data: RadarPoint[]; // count 비례 데이터 꼭짓점
  polygonPoints: string; // data 를 "x,y x,y ..." 로 (svg <polygon points>)
}

export interface RadarOptions {
  cx?: number;
  cy?: number;
  radius?: number;
  maxScale?: number; // 이 count 가 full radius. 기본: 최다 count(동적, 최소 1)
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeOhaengRadarPoints(
  counts: Record<Ohaeng, number>,
  opts: RadarOptions = {}
): OhaengRadarGeometry {
  const cx = opts.cx ?? 100;
  const cy = opts.cy ?? 100;
  const radius = opts.radius ?? 80;
  const maxScale =
    opts.maxScale ?? Math.max(1, ...OHAENG_RADAR_ORDER.map((e) => counts[e] ?? 0));

  const axes: RadarPoint[] = [];
  const data: RadarPoint[] = [];

  OHAENG_RADAR_ORDER.forEach((element, i) => {
    const angle = ((-90 + i * 72) * Math.PI) / 180; // 목 top, 시계방향
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    axes.push({ element, x: cx + radius * cos, y: cy + radius * sin });

    const ratio = Math.max(0, Math.min(1, (counts[element] ?? 0) / maxScale));
    data.push({ element, x: cx + radius * ratio * cos, y: cy + radius * ratio * sin });
  });

  const polygonPoints = data.map((p) => `${round2(p.x)},${round2(p.y)}`).join(' ');
  return { axes, data, polygonPoints };
}

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
