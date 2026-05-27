// 2026-05-16 PR #139 — calculateSaju 결과 in-memory LRU 캐시.
// /star-sign/[slug]/cross 등에서 같은 profile 로 매 요청마다 calculateSaju 호출하는
// 비용을 줄이기 위한 단기 캐시. birth 파라미터 (deterministic) 가 key 라 profile 변경
// 시 자동으로 새 key — invalidation 불필요.
//
// LRU + TTL — 평균 활성 사용자 << 1000 가정, TTL 10분.

import type { BirthInput, SajuResult } from './types';
import { calculateSaju } from './pillars';

const MAX_ENTRIES = 1000;
const TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  value: SajuResult;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();
let hitCount = 0;
let missCount = 0;

function buildKey(input: BirthInput): string {
  // 같은 결과를 내는 모든 필드. BirthInput 인터페이스 값.
  const loc = input.birthLocation;
  return [
    input.year,
    input.month,
    input.day,
    input.hour ?? 'x',
    input.minute ?? 'x',
    input.unknownTime ? 'u' : '',
    input.gender ?? '',
    input.solarTimeMode ?? '',
    input.jasiMethod ?? '',
    loc?.code ?? '',
    loc?.latitude ?? '',
    loc?.longitude ?? '',
  ].join('|');
}

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
  // LRU 단순화 — Map 의 insertion order 가 LRU 역할.
  // 사이즈 초과 시 가장 오래된 항목 제거.
  while (store.size > MAX_ENTRIES) {
    const firstKey = store.keys().next().value;
    if (firstKey === undefined) break;
    store.delete(firstKey);
  }
}

/**
 * calculateSaju 의 캐시 wrapper.
 * - 같은 입력 → cached SajuResult 반환
 * - cache miss → 실제 계산 후 저장
 * - TTL 10분, 최대 1000 항목 LRU
 */
export function cachedCalculateSaju(input: BirthInput): SajuResult {
  const key = buildKey(input);
  const now = Date.now();
  const cached = store.get(key);
  if (cached && cached.expiresAt >= now) {
    // 재배치 — LRU: 다시 끝으로 옮겨 freshness 유지.
    store.delete(key);
    store.set(key, cached);
    hitCount += 1;
    return cached.value;
  }
  missCount += 1;
  const value = calculateSaju(input);
  store.set(key, { value, expiresAt: now + TTL_MS });
  evictExpired();
  return value;
}

/** 테스트/디버그용. */
export function getCacheStats() {
  return {
    size: store.size,
    hits: hitCount,
    misses: missCount,
    hitRate: hitCount + missCount > 0 ? hitCount / (hitCount + missCount) : 0,
  };
}

export function clearCalcCache() {
  store.clear();
  hitCount = 0;
  missCount = 0;
}
