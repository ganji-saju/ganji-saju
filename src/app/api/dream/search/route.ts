// 2026-05-14: 꿈해몽 검색 API.
// GET /api/dream/search?q=... → dream-dictionary 에서 매칭.

import { NextRequest, NextResponse } from 'next/server';
import {
  listDreamCategories,
  searchDream,
} from '@/lib/dream-dictionary';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 60);
  const result = searchDream(q);
  return NextResponse.json({
    query: q,
    match: result.match,
    suggestions: result.suggestions,
    exact: result.exact,
    categories: listDreamCategories(),
  });
}
