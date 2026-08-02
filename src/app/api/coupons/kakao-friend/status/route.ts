// 카카오 친구추가 무료쿠폰 상태 조회 — 발급·사용 여부 및 만료일 반환.
// 환경변수 OFF → { enabled: false }.
// ON+미인증 → { enabled: true, state: 'issuable' } (발급 유도).
// ON+인증 → getUserCoupon+couponAvailability → { enabled: true, state, expiresAt }.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  couponAvailability,
  getUserCoupon,
  isKakaoFriendCouponEnabled,
} from '@/lib/coupons/kakao-friend-coupon';

export const runtime = 'nodejs';

export async function GET() {
  // 1) env off → { enabled: false }
  const enabled = isKakaoFriendCouponEnabled();
  if (!enabled) {
    return NextResponse.json({ enabled: false });
  }

  // 2) 인증 유저 확인
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 3) 미인증 → issuable 상태
  if (!user) {
    return NextResponse.json({
      enabled: true,
      state: 'issuable',
      expiresAt: null,
    });
  }

  // 4) 인증됨 → 쿠폰 조회 + 가용성 판정
  const row = await getUserCoupon(user.id);
  const state = couponAvailability(row);

  return NextResponse.json({
    enabled: true,
    state,
    expiresAt: row?.expires_at ?? null,
  });
}
