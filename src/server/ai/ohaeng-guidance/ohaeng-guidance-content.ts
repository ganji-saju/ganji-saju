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

  if (input.lack.length > 0) {
    const lacking = input.lack.map((el) => input.labels[el]).join(', ');
    return (
      `제공된 글자에서는 ${strong}이 상대적으로 많고 ${lacking}이 적게 나타나요. ` +
      '개수만으로 능력의 부족이나 보완 방향을 정하지는 않아요. 익숙한 방식이 도움이 된 상황과 부담이 된 상황을 하나씩 비교해보세요.'
    );
  }

  if (input.balanceLevel === 'high') {
    return (
      '제공된 글자의 개수는 비교적 고르게 분포해요. ' +
      '이 분포만으로 사주 전체의 균형이나 좋은 운을 확정하지는 않아요. 힘을 쓰기 편한 환경과 쉽게 지치는 환경의 차이를 확인해보세요.'
    );
  }

  return (
    `제공된 글자에서는 ${strong}의 비중이 상대적으로 커요. ` +
    '많다고 모두 강점이거나 적다고 모두 채워야 하는 것은 아니에요. 같은 방식을 반복할 때 편해지는 일과 선택이 좁아지는 일을 나눠보세요.'
  );
}
