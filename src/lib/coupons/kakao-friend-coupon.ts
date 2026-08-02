import { createServiceClient } from '@/lib/supabase/server';

export const KAKAO_FRIEND_COUPON_TYPE = 'kakao_friend_today_detail';
export const COUPON_EXPIRY_DAYS = 7;

export type CouponStatus = 'issued' | 'redeemed';

export interface UserCouponRow {
  id: string;
  user_id: string;
  type: string;
  status: CouponStatus;
  issued_at: string;
  expires_at: string;
  redeemed_at: string | null;
  redemption_reading_key: string | null;
  entitlement_id: string | null;
  verified_kakao_uid: string | null;
}

// 휴면 게이트. 미설정/'0' → OFF. '1' → ON. (isTodayFortuneLlmEnabled 컨벤션)
export function isKakaoFriendCouponEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.KAKAO_FRIEND_COUPON_ENABLED?.trim() === '1';
}

// 순수 판정 — row 상태 + 만료시각을 now 기준으로 4상태 중 하나로 분류.
//   null(미발급)=issuable, issued+미만료=redeemable, issued+만료=expired, redeemed=redeemed.
// redeem API(Task 3)가 이 판정으로 사용 가능 여부를 먼저 게이트한다.
export function couponAvailability(
  row: UserCouponRow | null,
  now: Date = new Date()
): 'issuable' | 'redeemable' | 'redeemed' | 'expired' {
  if (!row) return 'issuable';
  if (row.status === 'redeemed') return 'redeemed';
  if (now.getTime() >= new Date(row.expires_at).getTime()) return 'expired';
  return 'redeemable';
}

// 사용자의 카카오 친구추가 쿠폰 행 조회(없으면 null). type 은 고정(KAKAO_FRIEND_COUPON_TYPE).
export async function getUserCoupon(userId: string): Promise<UserCouponRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .from('user_coupons')
    .select('*')
    .eq('user_id', userId)
    .eq('type', KAKAO_FRIEND_COUPON_TYPE)
    .maybeSingle();
  return (data as UserCouponRow) ?? null;
}

// 카카오 친구추가 검증 후 쿠폰 발급. UNIQUE(user_id,type) 위반 시 멱등하게 기존행을 반환한다
// (동시 요청/재클릭 대비 — 신규 발급처럼 실패시키지 않음).
export async function issueKakaoFriendCoupon(
  userId: string,
  verifiedKakaoUid: string
): Promise<{ ok: true; row: UserCouponRow } | { ok: false; reason: string }> {
  const svc = await createServiceClient();
  const expiresAt = new Date(Date.now() + COUPON_EXPIRY_DAYS * 864e5).toISOString();
  const { data, error } = await svc
    .from('user_coupons')
    .insert({
      user_id: userId,
      type: KAKAO_FRIEND_COUPON_TYPE,
      status: 'issued',
      expires_at: expiresAt,
      verified_kakao_uid: verifiedKakaoUid,
    })
    .select('*')
    .single();

  if (error) {
    // UNIQUE 위반(23505) = 이미 발급 → 멱등하게 기존행 반환
    const existing = await getUserCoupon(userId);
    if (existing) return { ok: true as const, row: existing };
    return { ok: false as const, reason: 'insert_failed' };
  }
  return { ok: true as const, row: data as UserCouponRow };
}

// 원자적 사용 마킹: status='issued' 인 행만 redeemed 로 전이(동시성/중복사용 방어).
// 0행 update = 이미 사용됨/만료행이 아님(조건 불일치) = 중복 → false.
// 만료 자체는 redeem API(Task 3)가 couponAvailability 로 사전 차단한다.
export async function markCouponRedeemed(
  userId: string,
  meta: { readingKey: string; entitlementId: string | null }
): Promise<boolean> {
  const svc = await createServiceClient();
  const { data } = await svc
    .from('user_coupons')
    .update({
      status: 'redeemed',
      redeemed_at: new Date().toISOString(),
      redemption_reading_key: meta.readingKey,
      entitlement_id: meta.entitlementId,
    })
    .eq('user_id', userId)
    .eq('type', KAKAO_FRIEND_COUPON_TYPE)
    .eq('status', 'issued')
    .select('id');
  return Array.isArray(data) && data.length > 0;
}
