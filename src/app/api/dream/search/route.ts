// 2026-05-14: 꿈해몽 검색 API.
// GET /api/dream/search?q=... → dream-dictionary 에서 매칭.
// 2026-06-22: 무결과(fallback) 검색어 수요 로깅 추가 — 사전 키워드 커버리지 확장
//   우선순위 신호(dream_search_misses, 마이그레이션 054). 미스일 때만, 비차단.

import { NextRequest, NextResponse } from 'next/server';
import {
  listDreamCategories,
  searchDream,
} from '@/lib/dream-dictionary';
import {
  createClient,
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import {
  consumeFreeDaily,
  freeDailyLimitMessage,
  isFreeDailyExempt,
  isFreeDailyUsed,
} from '@/lib/free-usage/daily-limit';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 60);

  // 2026-07-18 — 하루 1회 제한. /dream 이 명시적 제출로 바뀌어 이 호출 = 사용자의 조회 1건.
  //   (자동/디바운스 검색이 남아 있으면 페이지 진입만으로 소진되므로 페이지 개편과 한 세트다.)
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const memberExempt = await isFreeDailyExempt(user?.id ?? null);
  if (!memberExempt && (await isFreeDailyUsed('dream', user?.id ?? null))) {
    return NextResponse.json(
      { error: freeDailyLimitMessage('dream'), code: 'free_daily_limit' },
      { status: 429 }
    );
  }

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

  const response = NextResponse.json({
    query: q,
    match: result.match,
    suggestions: result.suggestions,
    exact: result.exact,
    categories: listDreamCategories(),
  });

  // 조회가 성립한 뒤에 소비. 빈 검색어는 소비하지 않는다(오탈자로 기회를 잃지 않게).
  if (!memberExempt && q.trim().length >= 1) {
    const spent = await consumeFreeDaily('dream', user?.id ?? null);
    response.cookies.set(spent.cookie.name, spent.cookie.value, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: spent.cookie.maxAge,
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return response;
}
