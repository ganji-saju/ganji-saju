// 세그먼트 인원수 + 코호트 잔존율 데이터. service_role.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { parseListParams } from './user-list-query';
import { countAdminUsers } from './user-list';
import { SEGMENTS, type SegmentDef } from './segments';
import { buildCohortRetention, type CohortRow, type CohortMetric } from './cohort';

export interface SegmentCount {
  segment: SegmentDef;
  count: number;
}

export async function fetchSegmentCounts(): Promise<SegmentCount[]> {
  // 세그먼트별 카운트는 서로 독립이라 병렬 실행(개요 페이지 지연 최소화).
  return Promise.all(
    SEGMENTS.map(async (segment) => {
      const params = parseListParams(new URLSearchParams(segment.query));
      return { segment, count: await countAdminUsers(params) };
    })
  );
}

export async function fetchCohortRetention(nowIso: string): Promise<CohortMetric[]> {
  if (!hasSupabaseServiceEnv) return [];
  const service = await createServiceClient();
  // 2026-07-04 감사 — 무페이지네이션 전량 select 는 PostgREST 기본 1000행 캡으로
  // 가입자 1,000명 초과 시 코호트가 조용히 절단 → range 루프로 전량 수집.
  const rows: CohortRow[] = [];
  for (let page = 0; page < 100; page += 1) {
    const from = page * 1000;
    const { data, error } = await service
      .from('admin_user_summary')
      .select('signup_at, last_active_at, ltv_won')
      .order('signup_at', { ascending: true })
      .range(from, from + 999);
    if (error || !data) break;
    rows.push(...(data as unknown as CohortRow[]));
    if (data.length < 1000) break;
  }
  return buildCohortRetention(rows, nowIso);
}
