// 2026-05-23 — 궁합 깊은 풀이 캐시 키 + env 플래그(②-b). ohaeng-guidance-cache 패턴.
//   content-addressed + 순서 무관: 같은 두 명식·관계는 A↔B 무관하게 1회만 OpenAI 호출.
import { createHash } from 'node:crypto';
import type { CompatibilityInterpretationInput } from './compatibility-interpretation-types';

/** 프롬프트/스키마 버전 — 변경 시 캐시 무효화. */
export const COMPATIBILITY_INTERPRETATION_PROMPT_VERSION = 'compatibility-interpretation/v1';

export const COMPATIBILITY_INTERPRETATION_CACHE_TTL_DAYS = 30;

/** 두 명식 키를 정렬해 결합 → 순서 무관(A↔B 동일) content-addressed 캐시 키. */
export function buildCompatibilityInterpretationCacheKey(
  input: CompatibilityInterpretationInput
): string {
  const pair = [input.selfChartKey, input.partnerChartKey].sort();
  const payload = JSON.stringify({
    pair,
    relationship: input.relationship,
    promptVersion: COMPATIBILITY_INTERPRETATION_PROMPT_VERSION,
  });
  return createHash('sha256').update(payload).digest('hex');
}

/** env OPENAI_INTERPRET_COMPATIBILITY=1 일 때만 LLM 활성. 기본 OFF → 결정론 fallback. */
export function isCompatibilityInterpretationLLMEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.OPENAI_INTERPRET_COMPATIBILITY === '1';
}

/** 캐시 만료 체크(TTL 기본 30일). ohaeng-guidance-cache 와 동일 산식. */
export function isCompatibilityInterpretationCacheFresh(
  generatedAt: string,
  ttlDays: number = COMPATIBILITY_INTERPRETATION_CACHE_TTL_DAYS,
  now: Date = new Date()
): boolean {
  const generated = new Date(generatedAt);
  if (Number.isNaN(generated.getTime())) return false;
  const ageMs = now.getTime() - generated.getTime();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return ageMs >= 0 && ageMs < ttlMs;
}
