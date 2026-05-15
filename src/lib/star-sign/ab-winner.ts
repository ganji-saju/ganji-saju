// 2026-05-16 PR #145 — A/B variant winner 자동 선택 (ε-greedy).
// notification_delivery_logs 의 today-star-sign 슬롯 클릭률 데이터로 winner 결정.
// 충분한 표본 (per variant >= 50) + 최고 CTR 변형이 있으면 그쪽으로 가중,
// 그렇지 않으면 균등 분배 유지.
//
// ε-greedy: 90% winner 사용, 10% explore (3 variant 균등) — winner 가 stale 되거나
// 실제 우열이 바뀌어도 일정 비율 탐색해서 추후 갱신될 수 있게.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import type { PushVariant } from './daily-digest';
import { chooseVariantFor } from './daily-digest';

const TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_SAMPLE_PER_VARIANT = 50;
const EXPLORATION_RATE = 0.1; // 10% explore, 90% exploit

export interface VariantStats {
  variant: PushVariant;
  sent: number;
  clicked: number;
  ctr: number;
}

export interface WinnerSelection {
  winner: PushVariant | null;
  stats: VariantStats[];
  /** 충분한 표본인지. winner 가 있어도 sampleEnough=false 면 사용 안 함. */
  sampleEnough: boolean;
  /** winner 와 2등의 CTR 차이 (절대값) — 너무 작으면 winner 무의미. */
  marginPp: number;
  computedAt: string;
}

interface CacheState {
  selection: WinnerSelection | null;
  loadedAt: number;
  refreshing: boolean;
}

const state: CacheState = {
  selection: null,
  loadedAt: 0,
  refreshing: false,
};

/** notification_delivery_logs 에서 variant 별 CTR 계산 (지난 30일). */
export async function computeWinner(
  service: SupabaseClient,
  windowDays = 30
): Promise<WinnerSelection> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const { data } = await service
    .from('notification_delivery_logs')
    .select('variant, status, clicked_at')
    .eq('slot_key', 'today-star-sign')
    .eq('status', 'sent')
    .not('variant', 'is', null)
    .gte('created_at', cutoff.toISOString())
    .limit(50_000);

  const buckets: Record<PushVariant, { sent: number; clicked: number }> = {
    A: { sent: 0, clicked: 0 },
    B: { sent: 0, clicked: 0 },
    C: { sent: 0, clicked: 0 },
  };

  for (const row of (data ?? []) as Array<{
    variant: PushVariant;
    clicked_at: string | null;
  }>) {
    if (row.variant !== 'A' && row.variant !== 'B' && row.variant !== 'C') continue;
    buckets[row.variant].sent += 1;
    if (row.clicked_at) buckets[row.variant].clicked += 1;
  }

  const stats: VariantStats[] = (['A', 'B', 'C'] as PushVariant[]).map((v) => ({
    variant: v,
    sent: buckets[v].sent,
    clicked: buckets[v].clicked,
    ctr: buckets[v].sent > 0 ? buckets[v].clicked / buckets[v].sent : 0,
  }));

  const sampleEnough = stats.every((s) => s.sent >= MIN_SAMPLE_PER_VARIANT);
  const sorted = [...stats].sort((a, b) => b.ctr - a.ctr);
  const winnerStat = sorted[0]!;
  const runnerUp = sorted[1]!;
  const marginPp = Number(((winnerStat.ctr - runnerUp.ctr) * 100).toFixed(2));
  const winner = sampleEnough && marginPp >= 1.0 ? winnerStat.variant : null;

  return {
    winner,
    stats,
    sampleEnough,
    marginPp,
    computedAt: new Date().toISOString(),
  };
}

function triggerRefresh() {
  if (state.refreshing) return;
  state.refreshing = true;
  createServiceClient()
    .then((service) => computeWinner(service))
    .then((selection) => {
      state.selection = selection;
      state.loadedAt = Date.now();
    })
    .catch(() => {
      // 실패 시 기존 cache 유지.
    })
    .finally(() => {
      state.refreshing = false;
    });
}

/** stale-while-revalidate cache. cache 없으면 background fetch 트리거 + null 반환. */
export function getWinnerCached(): WinnerSelection | null {
  const now = Date.now();
  if (state.selection === null || now - state.loadedAt > TTL_MS) {
    triggerRefresh();
  }
  return state.selection;
}

/**
 * variant 선택 — winner 가 정해져 있으면 ε-greedy.
 * - 90% winner 사용
 * - 10% explore (균등 분배 = 기존 chooseVariantFor)
 * - winner 없거나 sample 부족 → 기존 균등 분배.
 *
 * userId+dateKey 결정성은 유지 — 같은 사용자/날짜는 같은 variant.
 */
export function chooseVariantWithExploration(
  userId: string,
  dateKey: string
): { variant: PushVariant; usedWinner: boolean } {
  const selection = getWinnerCached();
  if (!selection || !selection.winner) {
    return { variant: chooseVariantFor(userId, dateKey), usedWinner: false };
  }

  // userId+dateKey hash → [0, 1) 에서 결정적으로 explore vs exploit.
  let h = 2166136261;
  const input = `${userId}|${dateKey}|explore`;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  const roll = (h >>> 0) / 4294967296; // 0..1

  if (roll < EXPLORATION_RATE) {
    // explore — 균등 분배.
    return { variant: chooseVariantFor(userId, dateKey), usedWinner: false };
  }
  // exploit — winner.
  return { variant: selection.winner, usedWinner: true };
}

/** 테스트용 — selection 강제 주입. */
export function __setWinnerSelectionForTest(selection: WinnerSelection | null) {
  state.selection = selection;
  state.loadedAt = selection ? Date.now() : 0;
  state.refreshing = false;
}
