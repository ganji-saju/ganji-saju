// 2026-05-21 — 5단계 라벨 + 색상 토큰. phase-1-task.md §5 / naming-policy.md §11-1.
//   라벨은 모두 "사주"(naming-policy §9 — "결" 미사용). 한자 0.
//   색상은 visual-tokens.ts 단일 소스에서 파생(Phase 2).
import type { Ohaeng, ScoreLabel } from './types';
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

// naming-policy 면책 문구 — 점수/카드 어디서든 동일 노출.
export const SCORE_DISCLAIMER = '사주는 좋고 나쁨이 없습니다. 활용도가 다를 뿐이에요.';
const DISCLAIMER = SCORE_DISCLAIMER;

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

// === Phase 2+3 스펙: 점수 → Tailwind 클래스(score-* @theme 토큰) ===
export interface ScoreColorClasses {
  bg: string;
  bgSoft: string;
  text: string;
  textDark: string;
  ring: string;
  gradient: string;
  border: string;
}

// ⚠️ Tailwind JIT 는 동적 클래스(`bg-score-${level}`)를 purge 하므로 *리터럴*로 작성.
//   각 레벨의 클래스가 소스에 그대로 등장해야 5종 유틸리티가 생성됨.
const SCORE_COLOR_CLASSES: Record<ScoreLabel['level'], ScoreColorClasses> = {
  excellent: {
    bg: 'bg-score-excellent', bgSoft: 'bg-score-excellent-soft', text: 'text-score-excellent',
    textDark: 'text-white', ring: 'ring-score-excellent/30',
    gradient: 'from-score-excellent to-pink-600', border: 'border-score-excellent/20',
  },
  good: {
    bg: 'bg-score-good', bgSoft: 'bg-score-good-soft', text: 'text-score-good',
    textDark: 'text-white', ring: 'ring-score-good/30',
    gradient: 'from-score-good to-emerald-600', border: 'border-score-good/20',
  },
  neutral: {
    bg: 'bg-score-neutral', bgSoft: 'bg-score-neutral-soft', text: 'text-score-neutral',
    textDark: 'text-white', ring: 'ring-score-neutral/30',
    gradient: 'from-score-neutral to-blue-600', border: 'border-score-neutral/20',
  },
  mindful: {
    bg: 'bg-score-mindful', bgSoft: 'bg-score-mindful-soft', text: 'text-score-mindful',
    textDark: 'text-white', ring: 'ring-score-mindful/30',
    gradient: 'from-score-mindful to-amber-600', border: 'border-score-mindful/20',
  },
  potential: {
    bg: 'bg-score-potential', bgSoft: 'bg-score-potential-soft', text: 'text-score-potential',
    textDark: 'text-white', ring: 'ring-score-potential/30',
    gradient: 'from-score-potential to-purple-600', border: 'border-score-potential/20',
  },
};

export function getScoreColorClasses(level: ScoreLabel['level']): ScoreColorClasses {
  return SCORE_COLOR_CLASSES[level];
}

// === Phase 2+3 스펙: 오행 → Tailwind 클래스(ohaeng-* @theme 토큰, naming-policy "X 기운") ===
export const OHAENG_COLOR_CLASSES: Record<Ohaeng, { bg: string; soft: string; text: string }> = {
  목: { bg: 'bg-ohaeng-mok', soft: 'bg-ohaeng-mok-soft', text: 'text-ohaeng-mok' },
  화: { bg: 'bg-ohaeng-hwa', soft: 'bg-ohaeng-hwa-soft', text: 'text-ohaeng-hwa' },
  토: { bg: 'bg-ohaeng-to', soft: 'bg-ohaeng-to-soft', text: 'text-ohaeng-to' },
  금: { bg: 'bg-ohaeng-geum', soft: 'bg-ohaeng-geum-soft', text: 'text-ohaeng-geum' },
  수: { bg: 'bg-ohaeng-su', soft: 'bg-ohaeng-su-soft', text: 'text-ohaeng-su' },
};
