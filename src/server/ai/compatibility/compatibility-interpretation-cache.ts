// 2026-05-23 — 궁합 깊은 풀이 캐시 키 + env 플래그(②-b). ohaeng-guidance-cache 패턴.
//   content-addressed + 순서 무관: 같은 두 명식·관계는 A↔B 무관하게 1회만 OpenAI 호출.
import { createHash } from 'node:crypto';
import type { CompatibilityInterpretationInput } from './compatibility-interpretation-types';

/** 프롬프트/스키마 버전 — 변경 시 캐시 무효화. */
export const COMPATIBILITY_INTERPRETATION_PROMPT_VERSION = 'compatibility-interpretation/v1';

export const COMPATIBILITY_INTERPRETATION_CACHE_TTL_DAYS = 30;

function normalizeName(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

/**
 * 두 명식 키를 정렬해 결합 → 순서 무관(A↔B 동일) content-addressed 캐시 키.
 *
 * 2026-08-31 — **이름을 키에 넣는다.** 프롬프트가 "{selfName}님과 {partnerName}님을 위한" 으로
 *   본문에 이름을 박아 넣는데 키는 명식만 봤다. 같은 두 명식의 다른 커플(또는 같은 사용자가
 *   가족 라벨을 바꾼 뒤)이 **앞 사람 이름이 들어간 본문**을 캐시로 받을 수 있었다.
 *   이름은 명식과 **짝으로** 정렬해야 A↔B 순서 무관이 유지된다(이름만 따로 정렬하면
 *   [A/가영,B/나준] 과 [A/나준,B/가영] 이 같은 키가 되어 버그가 그대로 남는다).
 *   사용자 간 공유는 사실상 사라지지만(같은 8기둥+같은 두 이름), 원래도 거의 없던 경우다.
 */
export function buildCompatibilityInterpretationCacheKey(
  input: CompatibilityInterpretationInput
): string {
  const pair = [
    [input.selfChartKey, normalizeName(input.selfName)],
    [input.partnerChartKey, normalizeName(input.partnerName)],
  ].sort((a, b) => (a[0] !== b[0] ? (a[0]! < b[0]! ? -1 : 1) : a[1]! < b[1]! ? -1 : a[1]! > b[1]! ? 1 : 0));
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
