// 2026-09-03 — 자체 경로별 방문 집계(migration 078).
//
// 왜 GA4 가 아니라 자체 집계인가: 2026-09-03 실측에서 GA4 는 /guide 를 614세션 1위 유입으로
//   보고했지만 체류시간이 0.46초(정상 페이지는 270~380초)인 **봇**이었고, 자체 집계로는
//   첫 진입 0명이었다. GA4 는 봇 필터가 없고 동의(Consent Mode 기본 denied)로 실제의
//   1/45만 잡는다. 자체 집계는 봇·내부·프리뷰를 이미 걸러낸다(visit-filters).
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PagePathEntry {
  path: string;
  /** 그 경로를 본 순방문자(distinct visitor_hash). */
  visitors: number;
  /** 페이지뷰(같은 사람의 재방문 포함). */
  views: number;
  /** 1인당 평균 조회 수 — 1에 가까우면 한 번 보고 떠난 화면이다. */
  viewsPerVisitor: number;
}

/**
 * 기간 내 경로별 순방문자·PV 상위.
 * ⚠️ client 는 service-role 이어야 한다(site_visit_pages 는 RLS deny-all).
 * migration 078 미적용이면 함수가 없어 **빈 배열**을 준다(화면만 비고 나머지는 산다).
 */
export async function getPagePathStats(
  client: SupabaseClient,
  fromKey: string,
  toKey: string,
  limit = 20
): Promise<PagePathEntry[]> {
  const { data, error } = await client.rpc('site_visit_page_counts', {
    from_key: fromKey,
    to_key: toKey,
  });
  if (error) {
    console.error('[page-path-stats] rpc failed:', error.message);
    return [];
  }
  const rows = (data ?? []) as Array<{ path: string; visitors: number | string; views: number | string }>;
  return rows.slice(0, limit).map((row) => {
    const visitors = Number(row.visitors) || 0;
    const views = Number(row.views) || 0;
    return {
      path: row.path,
      visitors,
      views,
      // 분모 0 이면 0 으로 두지 않고 0 을 반환 — 방문자 없는 행은 애초에 나오지 않는다.
      viewsPerVisitor: visitors > 0 ? Number((views / visitors).toFixed(2)) : 0,
    };
  });
}
