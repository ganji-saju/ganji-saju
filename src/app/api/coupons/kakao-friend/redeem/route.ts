// 카카오 친구추가 무료쿠폰 — 오늘 자세히보기(today-detail) 0원 직접 지급.
// 결제원장(payment_orders)·PG·전(크레딧) 차감을 전혀 경유하지 않는다. 지급 프리미티브는
// 멤버십 무료 언락과 동일한 recordTodayFortunePremiumAccess(amount:0 credit_transactions 기록).
// reading 해석(인증·소유검증·readingKey/todayKey 도출)은 오늘 자세히보기 unlock route
// (src/app/api/today-fortune/unlock/route.ts) 와 동일 패턴을 미러링한다.
import { NextRequest, NextResponse } from 'next/server';
import { resolveReading } from '@/lib/saju/readings';
import { toSlug } from '@/lib/saju/pillars';
import { createClient } from '@/lib/supabase/server';
import { getKoreaAccessDay, recordTodayFortunePremiumAccess } from '@/lib/credits/detail-report-access';
import { buildPurchasedProductHref } from '@/lib/payments/product-scope';
import {
  couponAvailability,
  getUserCoupon,
  isKakaoFriendCouponEnabled,
  markCouponRedeemed,
  redeemPreconditions,
} from '@/lib/coupons/kakao-friend-coupon';

export const runtime = 'nodejs';

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest) {
  // 1) env off → 404 (다른 어떤 조회보다 먼저 — 휴면 배포는 완전 무동작).
  const enabled = isKakaoFriendCouponEnabled();
  if (!enabled) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // 2) 인증 유저 확인.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // 3) body { slug, scope } → reading 로드/소유검증 → readingKey/sourceSessionId/todayKey.
  //    unlock route 와 동일하게 slug 를 sourceSessionId 로 취급한다
  //    (payments/product-scope.ts 의 today-detail scope 도 동일 관례).
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const slug = payload ? readString(payload, 'slug') : '';
  const scope = payload ? readString(payload, 'scope') : '';

  if (!slug) {
    return NextResponse.json({ error: '열어볼 오늘 결과가 필요합니다.' }, { status: 400 });
  }

  const sourceSessionId = slug;
  const reading = await resolveReading(sourceSessionId);
  if (!reading) {
    return NextResponse.json({ error: '오늘 결과를 다시 불러오지 못했습니다.' }, { status: 404 });
  }

  if (reading.userId && reading.userId !== user.id) {
    return NextResponse.json({ error: '본인의 결과만 열 수 있습니다.' }, { status: 403 });
  }

  const readingKey = toSlug(reading.input);
  const todayKey = getKoreaAccessDay();

  // 4) 쿠폰 가용성 게이트 — 마킹(markCouponRedeemed) 이전에 반드시 통과해야 한다.
  //    만료/이미사용 차단 책임은 여기(couponAvailability)에 있다.
  const row = await getUserCoupon(user.id);
  const availability = couponAvailability(row);
  const pre = redeemPreconditions(enabled, true, availability);
  if (!pre.ok) {
    return NextResponse.json({ error: pre.error }, { status: pre.status });
  }

  // 5) 0원 지급 — payment_orders/PG/전차감 전부 미경유. amount:0 credit_transactions 기록만.
  await recordTodayFortunePremiumAccess(user.id, readingKey, sourceSessionId, todayKey);

  // 6) 원자적 redeemed 마킹. 경쟁으로 이미 사용된 경우(false) 방금의 access 기록은
  //    무해(같은 reading 재기록 = 중복 0원 use 행, 접근 판정은 ≥1행이면 참)하므로 200 유지.
  const marked = await markCouponRedeemed(user.id, { readingKey, entitlementId: null });
  if (!marked) {
    console.warn('[kakao-friend-coupon] markCouponRedeemed race — already redeemed', {
      userId: user.id,
      readingKey,
    });
  }

  return NextResponse.json({
    ok: true,
    redirect: buildPurchasedProductHref('today-detail', slug, { scope: scope || null }),
  });
}
