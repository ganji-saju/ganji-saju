// 2026-05-14: 통합 검색 API.
// GET /api/search?q=... → 운세 메뉴 + 관련 풀이 + 꿈해몽 + 12간지/별자리 hits.

import { NextRequest, NextResponse } from 'next/server';
import { runSearch, TRENDING_KEYWORDS } from '@/lib/search-index';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 60);
  const hits = runSearch(q);
  return NextResponse.json({
    query: q,
    total: hits.length,
    hits,
    trending: TRENDING_KEYWORDS,
  });
}
