// 2026-05-21 — 오행 차트 데이터. phase-1-task.md §6 / naming-policy.md §2 ("X 기운").
import type { Ohaeng, OhaengChartData, SajuData } from './types';
import { countOhaeng } from './helpers';
import { calculateF4 } from './formulas';

const OHAENG_LABELS: Record<Ohaeng, string> = {
  목: '목 기운', 화: '화 기운', 토: '토 기운', 금: '금 기운', 수: '수 기운',
};

const OHAENG_MEANINGS: Record<Ohaeng, string> = {
  목: '자라남과 추진', 화: '표현과 열정', 토: '담아냄과 안정',
  금: '단단함과 결단', 수: '흐름과 깊이',
};

const OHAENG_COLORS: Record<Ohaeng, string> = {
  목: '#10b981', 화: '#f43f5e', 토: '#f59e0b', 금: '#6b7280', 수: '#3b82f6',
};

export function computeOhaengChart(saju: SajuData): OhaengChartData {
  const counts = countOhaeng(saju.allEightChars);
  const balanceScore = calculateF4(saju);

  const lack = (Object.keys(counts) as Ohaeng[]).filter((k) => counts[k] === 0);
  const excess = (Object.keys(counts) as Ohaeng[]).filter((k) => counts[k] >= 4);

  return {
    counts,
    total: 8,
    labels: OHAENG_LABELS,
    meanings: OHAENG_MEANINGS,
    colors: OHAENG_COLORS,
    lack,
    excess,
    balanceScore,
  };
}
