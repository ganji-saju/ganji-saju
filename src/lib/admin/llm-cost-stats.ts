// 2026-05-25 Phase 3 — LLM 비용 대시보드 집계. 기존 ai_llm_runs(0b) 재활용(신규 테이블 없음).
//   service_role 로 최근 N일 rows fetch 후 JS 집계. 순수 집계는 단위 테스트로 고정.
//
// 2026-07-04 admin 지표 전수감사 반영(operations-stats.ts 와 동일 결함 잔존분):
//   - .limit(50000) 단일 fetch → PostgREST 기본 max-rows(1000)가 limit 을 클램프해
//     최신 1000행만 집계되던 문제 → range 페이지네이션으로 전량 수집.
//   - 일별 버킷을 UTC 날짜 → KST 날짜로 교체(KST 00~09시 호출이 전날로 집계되던 문제).
//   - 윈도우 시작을 KST (오늘-N+1일) 자정으로 스냅(첫 날 부분일 과소집계 방지).
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { estimateLlmCostUsd } from '@/server/ai/llm-telemetry';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** timestamptz(UTC ISO) → KST 날짜키(YYYY-MM-DD). 날짜축=KST 정합 공통 규칙. */
function toKstDateKey(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export interface LlmRunRow {
  created_at: string;
  feature: string;
  source: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  /** 2026-08-11 — 단가 재계산용. 없으면 저장값(cost_usd)으로 폴백. */
  model?: string | null;
  /** 2026-08-31 — source='fallback' 일 때의 사유. 한도 초과 감지에 쓴다. */
  fallback_reason?: string | null;
  user_id_hash: string | null;
}

/**
 * 행 1건의 비용 — **현재 단가표로 다시 계산한다.**
 *
 * 2026-08-11 — 기존에는 저장된 cost_usd 를 그대로 합산했다. cost_usd 는 *기록 시점* 에
 *   계산돼 박히므로, 단가표를 고쳐도 대시보드 숫자가 따라오지 않았다. 실제로 모델을
 *   gpt-5.6-luna 로 바꾼 직후 행들이 옛 default 단가(1.25/10)로 박혀 약 8배 과대집계됐다.
 *   행마다 model 이 남아 있어 model 기준 재계산이 시기 구분까지 정확하다.
 *   토큰이 없는 행(cache·fallback)은 재계산 대상이 아니라 저장값(0)을 그대로 쓴다.
 */
export function rowCostUsd(r: LlmRunRow): number {
  if (typeof r.input_tokens === 'number' && typeof r.output_tokens === 'number') {
    return estimateLlmCostUsd(r.model, r.input_tokens, r.output_tokens);
  }
  return r.cost_usd ?? 0;
}

/** 한도 초과로 실패한 행인가. openai-text 가 fallback_reason='quota_exceeded' 로 기록한다. */
export function isQuotaFallbackRow(r: LlmRunRow): boolean {
  return r.source === 'fallback' && r.fallback_reason === 'quota_exceeded';
}

export interface DayStat {
  date: string;
  calls: number;
  costUsd: number;
  distinctUsers: number;
  /**
   * 2026-08-31 — 그날 **한도 초과로 실패한** 호출 수.
   *   8/31 장애는 사용자가 제보할 때까지 아무도 몰랐다. 이 숫자가 0 이 아니면
   *   그 시점에 이미 사용자가 답변을 못 받고 있었다는 뜻이다(llm-quota-alert 가 읽는다).
   */
  quotaFallbacks: number;
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
  const map = new Map<
    string,
    { calls: number; costUsd: number; users: Set<string>; quotaFallbacks: number }
  >();
  for (const r of rows) {
    const date = toKstDateKey(r.created_at);
    let d = map.get(date);
    if (!d) {
      d = { calls: 0, costUsd: 0, users: new Set(), quotaFallbacks: 0 };
      map.set(date, d);
    }
    d.calls += 1;
    d.costUsd += rowCostUsd(r);
    if (isQuotaFallbackRow(r)) d.quotaFallbacks += 1;
    if (r.user_id_hash) d.users.add(r.user_id_hash);
  }
  return [...map.entries()]
    .map(([date, d]) => ({
      date,
      calls: d.calls,
      costUsd: round6(d.costUsd),
      distinctUsers: d.users.size,
      quotaFallbacks: d.quotaFallbacks,
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
    f.costUsd += rowCostUsd(r);
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
    totalCost += rowCostUsd(r);
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
    // 윈도우 시작 = KST (오늘 - windowDays + 1)일의 자정.
    const todayKey = toKstDateKey(new Date().toISOString());
    const startKey = new Date(
      Date.parse(`${todayKey}T00:00:00Z`) - (windowDays - 1) * 86_400_000
    )
      .toISOString()
      .slice(0, 10);
    const since = new Date(Date.parse(`${startKey}T00:00:00+09:00`)).toISOString();

    // PostgREST 기본 max-rows(1000)가 .limit 을 클램프 — range 페이지네이션으로 전량 수집.
    // 정렬 tiebreak(id)로 페이지 경계 중복/누락 방지.
    const PAGE_SIZE = 1000;
    const MAX_PAGES = 50;
    const rows: LlmRunRow[] = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from('ai_llm_runs')
        .select(
          'created_at, feature, source, input_tokens, output_tokens, cost_usd, model, fallback_reason, user_id_hash'
        )
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) return empty;
      const pageRows = (data ?? []) as unknown as LlmRunRow[];
      rows.push(...pageRows);
      if (pageRows.length < PAGE_SIZE) break;
      if (page === MAX_PAGES - 1) {
        console.error(`[llm-cost-stats] exceeded ${MAX_PAGES * PAGE_SIZE} rows — truncated`);
      }
    }
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
