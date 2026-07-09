// 2026-05-14: 통합 검색 API.
// GET /api/search?q=... → 운세 메뉴 + 관련 풀이 + 꿈해몽 + 12간지/별자리 hits.

import { NextRequest, NextResponse } from 'next/server';
import { runSearch, TRENDING_KEYWORDS } from '@/lib/search-index';
import { getPriceDisplayMap } from '@/lib/payments/price-display';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 60);
  // 2026-07-07 Phase 2 — 검색 결과 설명의 가격 토큰을 리졸버 값으로 채운다.
  const priceMap = await getPriceDisplayMap();
  const hits = runSearch(q, priceMap);
  return NextResponse.json({
    query: q,
    total: hits.length,
    hits,
    trending: TRENDING_KEYWORDS,
  });
}
