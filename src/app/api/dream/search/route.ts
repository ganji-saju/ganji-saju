// 2026-05-14: 꿈해몽 검색 API.
// GET /api/dream/search?q=... → dream-dictionary 에서 매칭.
// 2026-06-22: 무결과(fallback) 검색어 수요 로깅 추가 — 사전 키워드 커버리지 확장
//   우선순위 신호(dream_search_misses, 마이그레이션 054). 미스일 때만, 비차단.

import { NextRequest, NextResponse } from 'next/server';
import {
  listDreamCategories,
  searchDream,
} from '@/lib/dream-dictionary';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 60);
  const result = searchDream(q);

  // 진짜 무결과(fallback=true)만 빈도 누적 기록 → '검색해도 없는 꿈' Top-N 확보.
  const trimmed = q.trim();
  if (result.fallback && trimmed.length >= 1 && hasSupabaseServiceEnv) {
    try {
      const service = await createServiceClient();
      await service.rpc('record_dream_search_miss', {
        p_normalized: trimmed.toLowerCase().slice(0, 60),
        p_raw: trimmed,
      });
    } catch {
      // 수요 로깅 실패는 검색 응답을 막지 않는다(비차단).
    }
  }

  return NextResponse.json({
    query: q,
    match: result.match,
    suggestions: result.suggestions,
    exact: result.exact,
    categories: listDreamCategories(),
  });
}
