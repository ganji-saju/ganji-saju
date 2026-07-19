// 2026-07-19 — 익명으로 만든 사주를 로그인/가입 시 그 계정에 귀속시킨다.
//
// 왜 필요한가: 실유저 10명 중 8명이 가입 후 아무것도 안 하고 사라졌다. 이들의 경로는
//   "익명으로 사주를 본다 → 결과 화면의 벽(유료 언락)에서 로그인 요구 → 카카오 1클릭 가입"
//   인데, 가입해도 방금 본 사주가 계정에 붙지 않아 **로그인 직후 '내 사주'가 빈칸**이었다.
//   (기존에 익명 reading 을 계정에 붙이는 코드는 있었지만 유일한 호출처가 '결제 이행'이라
//    돈을 낸 사람만 자기 사주를 가질 수 있었다 — src/lib/payments/fulfillment.ts)
//
// 왜 쿠키인가: readings 의 익명 행은 user_id 가 NULL 이라 "누가 만들었는지"가 DB 에 없다.
//   로그인 시 아무 익명 행이나 claim 하게 두면 **남의 사주를 가져갈 수 있다**.
//   그래서 만든 그 브라우저에만 httpOnly 쿠키로 '영수증'을 남기고, 그 목록에 있는 id 만
//   claim 한다. httpOnly 라 페이지 스크립트가 위조할 수 없다.
import type { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';

const COOKIE_NAME = 'gs_anon_readings';
/** 쿠키 크기 방어 — 최근 것 위주로 이 개수까지만 들고 다닌다. */
const MAX_TICKETS = 5;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseTickets(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => UUID_RE.test(id))
    .slice(0, MAX_TICKETS);
}

export function readAnonymousReadingTickets(req: NextRequest): string[] {
  return parseTickets(req.cookies.get(COOKIE_NAME)?.value);
}

/**
 * 익명 reading 을 만든 직후 호출 — 이 브라우저에 '내가 만들었다'는 영수증을 남긴다.
 * 로그인 사용자의 reading 은 이미 user_id 가 있으므로 호출하지 않는다.
 */
export function rememberAnonymousReading(
  req: NextRequest,
  res: NextResponse,
  readingId: string
): void {
  if (!UUID_RE.test(readingId)) return;
  const next = [readingId, ...readAnonymousReadingTickets(req).filter((id) => id !== readingId)]
    .slice(0, MAX_TICKETS)
    .join(',');
  res.cookies.set(COOKIE_NAME, next, {
    httpOnly: true,
    // localhost(http) 에서도 재현·테스트가 되도록 프로덕션에서만 secure.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * 로그인/가입 성공 직후 호출 — 쿠키에 적힌 익명 reading 을 이 계정으로 귀속시킨다.
 *
 * `user_id IS NULL` 조건을 함께 걸어 **이미 주인이 있는 행은 절대 건드리지 않는다**
 * (쿠키를 탈취당해도 남의 소유 사주를 빼앗을 수 없다).
 * 실패해도 로그인 흐름을 막지 않는다.
 */
export async function claimAnonymousReadings(
  req: NextRequest,
  res: NextResponse,
  userId: string
): Promise<number> {
  const tickets = readAnonymousReadingTickets(req);
  if (tickets.length === 0 || !hasSupabaseServiceEnv) return 0;

  try {
    const service = await createServiceClient();
    const { data, error } = await service
      .from('readings')
      .update({ user_id: userId })
      .in('id', tickets)
      .is('user_id', null)
      .select('id');

    if (error) {
      console.warn('[anon-claim] 익명 사주 귀속 실패:', error.message);
      return 0;
    }

    // 성공했든(이미 주인이 있어) 못 했든 영수증은 역할을 다했다.
    res.cookies.delete(COOKIE_NAME);
    return data?.length ?? 0;
  } catch (err) {
    console.warn('[anon-claim] 익명 사주 귀속 중 예외:', err);
    return 0;
  }
}
