// 2026-05-21 — 오행 가이드 캐시 키 + env 플래그(Phase 5). total-review-cache 패턴.
//   영속 캐시 스토어/마이그레이션은 후속 PR(플래그 ON 직전). 본 PR 은 키만 meta 노출.
import { createHash } from 'node:crypto';
import type { Ohaeng } from '@/lib/saju-score';
import type { OhaengGuidanceInput } from './ohaeng-guidance-types';

/** 프롬프트/스키마 버전 — 변경 시 캐시 무효화. */
export const OHAENG_GUIDANCE_PROMPT_VERSION = 'ohaeng-guidance/v1';

const ORDER: Ohaeng[] = ['목', '화', '토', '금', '수'];

/** 같은 오행 분포(+균형 레벨) → 같은 가이드 재사용. 사용자 무관 content-addressed. */
export function buildOhaengGuidanceCacheKey(input: OhaengGuidanceInput): string {
  const payload = JSON.stringify({
    counts: ORDER.map((e) => input.counts[e] ?? 0),
    dominant: input.dominant,
    lack: [...input.lack].sort(),
    excess: [...input.excess].sort(),
    balanceLevel: input.balanceLevel,
    promptVersion: OHAENG_GUIDANCE_PROMPT_VERSION,
  });
  return createHash('sha256').update(payload).digest('hex');
}

/** env OPENAI_INTERPRET_OHAENG_GUIDANCE=1 일 때만 LLM 가이드 활성. 기본 OFF → 결정론 fallback. */
export function isOhaengGuidanceLLMEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OPENAI_INTERPRET_OHAENG_GUIDANCE === '1';
}
