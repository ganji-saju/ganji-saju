// 2026-05-21 — 오행 LLM 가이드(Phase 5) 타입. OhaengChartData.guidanceText 를 채우는 파이프라인.
import type { Ohaeng } from '@/lib/saju-score';
import type { OhaengBalanceLevel } from '@/lib/saju-score';

/** LLM/fallback 입력 — 오행 분포 요약(자체 완결, 사주 원본 비의존). */
export interface OhaengGuidanceInput {
  counts: Record<Ohaeng, number>;
  dominant: Ohaeng;
  lack: Ohaeng[];
  excess: Ohaeng[];
  balanceScore: number; // F4 0~20
  balanceLevel: OhaengBalanceLevel;
  labels: Record<Ohaeng, string>; // "목 기운"
  meanings: Record<Ohaeng, string>; // "담아냄과 안정"
}

export interface OhaengGuidanceResult {
  /** llm = 신규 생성 / cache = 캐시 hit(후속 PR) / fallback = 플래그 OFF·검증 실패 */
  source: 'llm' | 'cache' | 'fallback';
  guidanceText: string;
  reasons: string[];
  meta: { generatedAt: string; cacheKey: string; promptVersion: string };
}
