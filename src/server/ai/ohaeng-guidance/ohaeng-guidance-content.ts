// 2026-05-21 — 오행 가이드 입력 빌더 + 결정론 fallback(Phase 5).
//   fallback 은 라벨("X 기운")/의미(일상어)만 사용 — 한자/명리어/자극/"결"/"X의 기운" 무발생.
//   플래그 OFF 기본이라 평소엔 이 fallback 이 guidanceText 로 노출된다.
import type { OhaengChartData } from '@/lib/saju-score';
import { getDominantOhaeng, getOhaengBalanceLevel } from '@/lib/saju-score';
import type { OhaengGuidanceInput } from './ohaeng-guidance-types';

export function buildOhaengGuidanceInput(chart: OhaengChartData): OhaengGuidanceInput {
  return {
    counts: chart.counts,
    dominant: getDominantOhaeng(chart.counts),
    lack: chart.lack,
    excess: chart.excess,
    balanceScore: chart.balanceScore,
    balanceLevel: getOhaengBalanceLevel(chart.balanceScore).level,
    labels: chart.labels,
    meanings: chart.meanings,
  };
}

export function buildDeterministicOhaengGuidance(input: OhaengGuidanceInput): string {
  const strong = input.labels[input.dominant]; // "토 기운"
  const strongMeaning = input.meanings[input.dominant]; // "담아냄과 안정"

  if (input.lack.length > 0) {
    const lacking = input.lack.map((el) => input.labels[el]).join(', ');
    return (
      `${strong}이 도드라지는 사주예요. ${strongMeaning}의 힘이 강점으로 잘 작동합니다. ` +
      `다만 ${lacking}이 부족한 편이라, 이 기운을 의식적으로 채워 주는 작은 습관을 더하면 흐름이 한결 부드러워집니다.`
    );
  }

  if (input.balanceLevel === 'high') {
    return (
      `다섯 기운이 비교적 고르게 자리잡은 사주예요. ${strong}을 중심으로 균형이 잘 잡혀 있어, ` +
      `지금의 리듬을 꾸준히 유지하는 것 자체가 강점이 됩니다.`
    );
  }

  return (
    `${strong}이 중심이 되는 사주예요. ${strongMeaning}의 힘을 살리되, ` +
    `나머지 기운도 조금씩 함께 써 주면 더 안정적인 흐름을 만들 수 있어요.`
  );
}
