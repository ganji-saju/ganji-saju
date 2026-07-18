// 2026-07-18 — 타로 하루 1회 제한(20260718 PPTX slide3 "딱 3장 타로 / 다 하루 1번으로 제한").
//
//   타로는 서버 API 없이 클라이언트에서 덱을 섞고 뽑아 result 로 넘어가는 구조라,
//   "오늘 뽑았다"를 서버가 알 방법이 없었다. 이 엔드포인트가 **뽑기 확정 시점**의
//   기록 전용 훅이다 — 카드 내용은 받지 않고(결과는 여전히 URL 로 재현) 소비만 남긴다.
//
//   판정(차단)은 /tarot/daily/pick 서버 컴포넌트가 렌더 시점에 하고, 여기서는 소비만 한다.
//   실패해도 사용자의 뽑기를 막지 않는다(비차단) — 기록 실패로 결과를 못 보게 하는 건 과하다.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { consumeFreeDaily, isFreeDailyExempt } from '@/lib/free-usage/daily-limit';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ ok: true });

  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();

    if (await isFreeDailyExempt(user?.id ?? null)) return response;

    const spent = await consumeFreeDaily('tarot', user?.id ?? null);
    response.cookies.set(spent.cookie.name, spent.cookie.value, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: spent.cookie.maxAge,
      secure: process.env.NODE_ENV === 'production',
    });
  } catch {
    // 비차단 — 기록 실패가 뽑기를 막지 않는다.
  }

  return response;
}
