// 2026-05-25 Phase 3 — LLM 비용 대시보드 집계. 기존 ai_llm_runs(0b) 재활용(신규 테이블 없음).
//   service_role 로 최근 N일 rows fetch 후 JS 집계. 순수 집계는 단위 테스트로 고정.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';

export interface LlmRunRow {
  created_at: string;
  feature: string;
  source: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  user_id_hash: string | null;
}

export interface DayStat {
  date: string;
  calls: number;
  costUsd: number;
  distinctUsers: number;
}

export interface FeatureStat {
  feature: string;
  calls: number;
  openai: number;
  cache: number;
  fallback: number;
  cacheHitRate: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface LlmCostSummary {
  totalCalls: number;
  totalCostUsd: number;
  distinctUsers: number;
  cacheHitRate: number;
}

const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** 일별 비용·호출·LLM 활성 사용자(고유 user_id_hash). 날짜 오름차순. */
export function aggregateByDay(rows: ReadonlyArray<LlmRunRow>): DayStat[] {
  const map = new Map<string, { calls: number; costUsd: number; users: Set<string> }>();
  for (const r of rows) {
    const date = r.created_at.slice(0, 10);
    let d = map.get(date);
    if (!d) {
      d = { calls: 0, costUsd: 0, users: new Set() };
      map.set(date, d);
    }
    d.calls += 1;
    d.costUsd += r.cost_usd ?? 0;
    if (r.user_id_hash) d.users.add(r.user_id_hash);
  }
  return [...map.entries()]
    .map(([date, d]) => ({
      date,
      calls: d.calls,
      costUsd: round6(d.costUsd),
      distinctUsers: d.users.size,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** 영역(feature)별 source 카운트·캐시 hit률·토큰·비용. 비용 내림차순. */
export function aggregateByFeature(rows: ReadonlyArray<LlmRunRow>): FeatureStat[] {
  const map = new Map<string, FeatureStat>();
  for (const r of rows) {
    let f = map.get(r.feature);
    if (!f) {
      f = {
        feature: r.feature,
        calls: 0,
        openai: 0,
        cache: 0,
        fallback: 0,
        cacheHitRate: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      };
      map.set(r.feature, f);
    }
    f.calls += 1;
    if (r.source === 'openai') f.openai += 1;
    else if (r.source === 'cache') f.cache += 1;
    else if (r.source === 'fallback') f.fallback += 1;
    f.inputTokens += r.input_tokens ?? 0;
    f.outputTokens += r.output_tokens ?? 0;
    f.costUsd += r.cost_usd ?? 0;
  }
  for (const f of map.values()) {
    f.cacheHitRate = f.calls > 0 ? round3(f.cache / f.calls) : 0;
    f.costUsd = round6(f.costUsd);
  }
  return [...map.values()].sort(
    (a, b) => b.costUsd - a.costUsd || a.feature.localeCompare(b.feature)
  );
}

/** 전체 요약 — 총 호출·비용·LLM 활성 사용자·전체 hit률. */
export function overallSummary(rows: ReadonlyArray<LlmRunRow>): LlmCostSummary {
  let totalCalls = 0;
  let totalCost = 0;
  let cacheCount = 0;
  const users = new Set<string>();
  for (const r of rows) {
    totalCalls += 1;
    totalCost += r.cost_usd ?? 0;
    if (r.source === 'cache') cacheCount += 1;
    if (r.user_id_hash) users.add(r.user_id_hash);
  }
  return {
    totalCalls,
    totalCostUsd: round6(totalCost),
    distinctUsers: users.size,
    cacheHitRate: totalCalls > 0 ? round3(cacheCount / totalCalls) : 0,
  };
}

export interface LlmCostStats {
  daily: DayStat[];
  byFeature: FeatureStat[];
  summary: LlmCostSummary;
  windowDays: number;
}

/** 최근 windowDays 일 ai_llm_runs 집계. service env 없으면 빈 결과(방어적). */
export async function getLlmCostStats(windowDays = 30): Promise<LlmCostStats> {
  const empty: LlmCostStats = {
    daily: [],
    byFeature: [],
    summary: { totalCalls: 0, totalCostUsd: 0, distinctUsers: 0, cacheHitRate: 0 },
    windowDays,
  };
  if (!hasSupabaseServiceEnv) return empty;
  try {
    const supabase = await createServiceClient();
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('ai_llm_runs')
      .select('created_at, feature, source, input_tokens, output_tokens, cost_usd, user_id_hash')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50000);
    if (error || !data) return empty;
    const rows = data as unknown as LlmRunRow[];
    return {
      daily: aggregateByDay(rows),
      byFeature: aggregateByFeature(rows),
      summary: overallSummary(rows),
      windowDays,
    };
  } catch {
    return empty;
  }
}
