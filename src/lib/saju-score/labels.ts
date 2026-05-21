// 2026-05-21 — 5단계 라벨 + 색상 토큰. phase-1-task.md §5 / naming-policy.md §11-1.
//   라벨은 모두 "사주"(naming-policy §9 — "결" 미사용). 한자 0.
//   색상은 visual-tokens.ts 단일 소스에서 파생(Phase 2).
import type { ScoreLabel } from './types';
import { getScoreLevelToken } from './visual-tokens';

const LABEL_TABLE: Array<{
  range: [number, number];
  level: ScoreLabel['level'];
  title: string;
  subtitle: string;
  description: string;
}> = [
  {
    range: [90, 100], level: 'excellent',
    title: '균형이 잘 잡힌 사주',
    subtitle: '자연스럽게 흐르는 사주',
    description:
      '다섯 기운과 흐름이 조화롭게 자리잡힌 사주예요. 큰 의식적 노력 없이도 본인 페이스를 유지하기 좋습니다.',
  },
  {
    range: [75, 89], level: 'good',
    title: '강점이 명확한 사주',
    subtitle: '본인 자리를 알면 빠르게 자리잡는 사주',
    description: '본인의 강점이 분명하게 드러나는 사주예요. 자기 자리를 알면 빠르게 안정됩니다.',
  },
  {
    range: [60, 74], level: 'neutral',
    title: '흐름이 무난한 사주',
    subtitle: '꾸준히 다지면 길게 가는 사주',
    description: '큰 굴곡 없이 무난하게 흐르는 사주예요. 꾸준한 루틴이 평생 큰 자산이 됩니다.',
  },
  {
    range: [45, 59], level: 'mindful',
    title: '자기 관리가 빛나는 사주',
    subtitle: '활용도가 본인 손에 달린 사주',
    description: '본인의 의식적 관리가 사주의 가치를 결정하는 사주예요. 작은 습관 하나가 큰 변화를 만듭니다.',
  },
  {
    range: [0, 44], level: 'potential',
    title: '보강의 여지가 큰 사주',
    subtitle: '의식적 관리로 가능성이 열리는 사주',
    description:
      '다양한 시도와 의식적 보강이 잘 어울리는 사주예요. 변화의 폭이 크고, 본인의 선택이 평생을 좌우합니다.',
  },
];

const DISCLAIMER = '사주는 좋고 나쁨이 없습니다. 활용도가 다를 뿐이에요.';

export function getLabel(total: number): ScoreLabel {
  const entry =
    LABEL_TABLE.find(({ range }) => total >= range[0] && total <= range[1]) ??
    LABEL_TABLE[LABEL_TABLE.length - 1];
  const { hex: _hex, ...color } = getScoreLevelToken(entry.level);
  return {
    level: entry.level,
    title: entry.title,
    subtitle: entry.subtitle,
    description: entry.description,
    disclaimer: DISCLAIMER,
    color,
  };
}
