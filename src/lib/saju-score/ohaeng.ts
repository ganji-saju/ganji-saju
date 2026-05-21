// 2026-05-21 — 오행 차트 데이터. phase-1-task.md §6 / naming-policy.md §2 ("X 기운").
//   라벨/색상은 visual-tokens.ts 단일 소스에서 파생(Phase 2). 의미만 여기서 관리.
import type { Ohaeng, OhaengChartData, SajuData } from './types';
import { countOhaeng } from './helpers';
import { calculateF4 } from './formulas';
import { OHAENG_TOKENS } from './visual-tokens';

const ELEMENTS: Ohaeng[] = ['목', '화', '토', '금', '수'];

const OHAENG_LABELS = Object.fromEntries(
  ELEMENTS.map((e) => [e, OHAENG_TOKENS[e].label])
) as Record<Ohaeng, string>;

const OHAENG_COLORS = Object.fromEntries(
  ELEMENTS.map((e) => [e, OHAENG_TOKENS[e].hex])
) as Record<Ohaeng, string>;

const OHAENG_MEANINGS: Record<Ohaeng, string> = {
  목: '자라남과 추진', 화: '표현과 열정', 토: '담아냄과 안정',
  금: '단단함과 결단', 수: '흐름과 깊이',
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
