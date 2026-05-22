// 2026-05-21 — 사주 점수 UI 컴포넌트 배럴(Phase 3~4).
// 2026-05-22 — 레거시 컴포넌트(SajuScoreGauge/SajuScoreBreakdown/SajuOhaengBalance/SajuOhaengChart)
//   는 Phase 2+3 스펙 모델(SajuScoreCard/ScoreBreakdownCard/OhaengChart)로 대체되어 제거.
export { SajuScoreCard } from './saju-score-card';
// 2026-05-22 Phase 2+3 스펙(LockGate per-factor 모델)
export { LockGate } from './lock-gate';
export type { LockFactorId } from './lock-gate';
export { ScoreBreakdownCard } from './score-breakdown-card';
export { OhaengChart } from './ohaeng-bar-chart';
export { LifetimeKeysCarousel } from './lifetime-keys-carousel';
export type { LifetimeKey } from './lifetime-keys-carousel';
