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
  const out: SegmentCount[] = [];
  for (const segment of SEGMENTS) {
    const params = parseListParams(new URLSearchParams(segment.query));
    out.push({ segment, count: await countAdminUsers(params) });
  }
  return out;
}

export async function fetchCohortRetention(nowIso: string): Promise<CohortMetric[]> {
  if (!hasSupabaseServiceEnv) return [];
  const service = await createServiceClient();
  const { data, error } = await service
    .from('admin_user_summary')
    .select('signup_at, last_active_at, ltv_won');
  if (error || !data) return [];
  return buildCohortRetention(data as unknown as CohortRow[], nowIso);
}
