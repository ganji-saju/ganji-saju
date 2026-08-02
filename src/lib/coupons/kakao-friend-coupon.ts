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
