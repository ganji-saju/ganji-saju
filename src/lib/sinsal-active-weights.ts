// 2026-05-16 PR #140 — production scoring 이 sinsal_weight_versions 의 active 버전 사용.
// PR #126 에서 admin 이 학습한 가중치를 active 로 promote 하면 detectComprehensiveSinsals
// 의 scoreHint 가 자동으로 override 됨.
//
// 패턴: stale-while-revalidate in-memory cache.
// - getActiveWeightsSync() 는 항상 sync — cached map 또는 null 반환
// - 호출 시 cache 가 비어있거나 TTL 만료면 background refresh 트리거 (fire-and-forget)
// - 다음 호출부터 새 값 노출
//
// 첫 boot 시 한두 요청은 hardcoded scoreHint 그대로 받지만, 그 후 자동 업데이트.
// admin 이 active 를 바꿔도 TTL 5분 안에 production 에 반영.

import { createServiceClient } from '@/lib/supabase/server';

const TTL_MS = 5 * 60 * 1000;

interface CacheState {
  weights: Record<string, number> | null;
  loadedAt: number;
  refreshing: boolean;
}

const state: CacheState = {
  weights: null,
  loadedAt: 0,
  refreshing: false,
};

async function fetchActiveWeights(): Promise<Record<string, number> | null> {
  try {
    const service = await createServiceClient();
    const { data, error } = await service
      .from('sinsal_weight_versions')
      .select('weights')
      .eq('status', 'active')
      .order('learned_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const weights = data.weights as Record<string, number> | null;
    if (!weights || typeof weights !== 'object') return null;
    // 유효한 숫자만 통과.
    const cleaned: Record<string, number> = {};
    for (const [name, value] of Object.entries(weights)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        cleaned[name] = value;
      }
    }
    return cleaned;
  } catch {
    return null;
  }
}

function triggerRefresh() {
  if (state.refreshing) return;
  state.refreshing = true;
  fetchActiveWeights()
    .then((weights) => {
      state.weights = weights;
      state.loadedAt = Date.now();
    })
    .catch(() => {
      // 실패 시 기존 cache 유지.
    })
    .finally(() => {
      state.refreshing = false;
    });
}

/**
 * 현재 시점에 알려진 active weights 반환. cache 가 비어있거나 stale 이면 background
 * refresh 시작하지만 즉시 sync 로 현재 값 (null 일 수 있음) 반환.
 */
export function getActiveWeightsSync(): Record<string, number> | null {
  const now = Date.now();
  const stale = now - state.loadedAt > TTL_MS;
  if (state.weights === null || stale) {
    triggerRefresh();
  }
  return state.weights;
}

/** detect 결과의 scoreHint 를 active weight 로 override. active 없으면 그대로. */
export function applyActiveSinsalWeights<T extends { name: string; scoreHint: number }>(
  hits: T[]
): T[] {
  const weights = getActiveWeightsSync();
  if (!weights) return hits;
  return hits.map((h) => {
    const override = weights[h.name];
    if (typeof override === 'number' && Number.isFinite(override)) {
      return { ...h, scoreHint: override };
    }
    return h;
  });
}

/** 테스트용 — cache 강제 주입. */
export function __setActiveWeightsForTest(weights: Record<string, number> | null) {
  state.weights = weights;
  state.loadedAt = weights ? Date.now() : 0;
  state.refreshing = false;
}
