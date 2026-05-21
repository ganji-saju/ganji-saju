// 2026-05-21 — 점수 시각 토큰 단일 소스(Phase 2 — 라벨/색상 시스템).
//   등급(5단계) · 오행(5) · 내역지표(F1~F5) 의 색상·라벨·max·fill% 를 한 곳에서 관리.
//   labels.ts / ohaeng.ts 는 여기서 파생(REFACTOR). 컴포넌트(Phase 3)가 소비.
//   naming-policy: 라벨/설명 한자 0, 오행 "X 기운".
import type { Ohaeng, ScoreLabel } from './types';

export type ScoreLevel = ScoreLabel['level'];
export type BreakdownKey = 'F1' | 'F2' | 'F3' | 'F4' | 'F5';

export interface ScoreLevelToken {
  bg: string;
  bgSoft: string;
  text: string;
  textOnDark: string;
  ring: string;
  gradient: string;
  hex: string; // SVG 게이지 stroke / 동적 fill 용
}

// 등급별 색상 — labels.ts LABEL_COLORS 와 동일 클래스 + bg-500 대응 hex.
export const SCORE_LEVEL_TOKENS: Record<ScoreLevel, ScoreLevelToken> = {
  excellent: {
    bg: 'bg-pink-500', bgSoft: 'bg-pink-50', text: 'text-pink-600',
    textOnDark: 'text-pink-100', ring: 'ring-pink-300',
    gradient: 'from-pink-400 to-pink-600', hex: '#ec4899',
  },
  good: {
    bg: 'bg-emerald-500', bgSoft: 'bg-emerald-50', text: 'text-emerald-700',
    textOnDark: 'text-emerald-100', ring: 'ring-emerald-300',
    gradient: 'from-emerald-400 to-emerald-600', hex: '#10b981',
  },
  neutral: {
    bg: 'bg-blue-500', bgSoft: 'bg-blue-50', text: 'text-blue-700',
    textOnDark: 'text-blue-100', ring: 'ring-blue-300',
    gradient: 'from-blue-400 to-blue-600', hex: '#3b82f6',
  },
  mindful: {
    bg: 'bg-amber-500', bgSoft: 'bg-amber-50', text: 'text-amber-700',
    textOnDark: 'text-amber-100', ring: 'ring-amber-300',
    gradient: 'from-amber-400 to-amber-600', hex: '#f59e0b',
  },
  potential: {
    bg: 'bg-purple-500', bgSoft: 'bg-purple-50', text: 'text-purple-700',
    textOnDark: 'text-purple-100', ring: 'ring-purple-300',
    gradient: 'from-purple-400 to-purple-600', hex: '#a855f7',
  },
};

const LEVEL_THRESHOLDS: Array<{ min: number; level: ScoreLevel }> = [
  { min: 90, level: 'excellent' },
  { min: 75, level: 'good' },
  { min: 60, level: 'neutral' },
  { min: 45, level: 'mindful' },
  { min: 0, level: 'potential' },
];

export function getScoreLevelToken(level: ScoreLevel): ScoreLevelToken {
  return SCORE_LEVEL_TOKENS[level];
}

export function getScoreLevelTokenByTotal(total: number): ScoreLevelToken {
  const entry = LEVEL_THRESHOLDS.find(({ min }) => total >= min) ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return SCORE_LEVEL_TOKENS[entry.level];
}

export interface OhaengToken {
  hex: string;
  label: string; // "X 기운"
}

// 오행별 색상 — ohaeng.ts OHAENG_COLORS 와 동일 hex.
export const OHAENG_TOKENS: Record<Ohaeng, OhaengToken> = {
  목: { hex: '#10b981', label: '목 기운' },
  화: { hex: '#f43f5e', label: '화 기운' },
  토: { hex: '#f59e0b', label: '토 기운' },
  금: { hex: '#6b7280', label: '금 기운' },
  수: { hex: '#3b82f6', label: '수 기운' },
};

export function getOhaengToken(ohaeng: Ohaeng): OhaengToken {
  return OHAENG_TOKENS[ohaeng];
}

export interface BreakdownFactorMeta {
  key: BreakdownKey;
  label: string;
  description: string;
  max: number;
  hex: string;
}

export const BREAKDOWN_ORDER: BreakdownKey[] = ['F1', 'F2', 'F3', 'F4', 'F5'];

// 내역지표 — 일상어 라벨(한자 0). hex 는 app 팔레트(tokens.css) 정렬.
export const BREAKDOWN_FACTOR_META: Record<BreakdownKey, BreakdownFactorMeta> = {
  F1: { key: 'F1', label: '타고난 본질', description: '일주가 만드는 기본 성향과 힘', max: 20, hex: '#ff4f9a' },
  F2: { key: 'F2', label: '강점 구조', description: '타고난 강점이 또렷하게 작동하는 정도', max: 20, hex: '#5b58d6' },
  F3: { key: 'F3', label: '균형 보강', description: '부족한 기운을 채워 주는 힘', max: 20, hex: '#0f9f7a' },
  F4: { key: 'F4', label: '오행 균형', description: '다섯 기운이 고르게 분포한 정도', max: 20, hex: '#d99020' },
  F5: { key: 'F5', label: '관계와 흐름', description: '글자 사이 관계와 변화의 흐름', max: 20, hex: '#368ee8' },
};

export function getBreakdownFactorMeta(key: BreakdownKey): BreakdownFactorMeta {
  return BREAKDOWN_FACTOR_META[key];
}

/** value/max 비율을 0~100 정수 퍼센트로. max<=0 이면 0. */
export function getBarFillPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  const pct = Math.round((value / max) * 100);
  return Math.max(0, Math.min(100, pct));
}
