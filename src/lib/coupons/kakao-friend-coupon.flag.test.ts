import assert from 'node:assert/strict';
import { isKakaoFriendCouponEnabled, KAKAO_FRIEND_COUPON_TYPE, COUPON_EXPIRY_DAYS } from '@/lib/coupons/kakao-friend-coupon';
declare const test: (name: string, fn: () => void) => void;
test('kakao coupon: env 게이트 기본 OFF, "1" 에서만 ON', () => {
  assert.equal(isKakaoFriendCouponEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(isKakaoFriendCouponEnabled({ KAKAO_FRIEND_COUPON_ENABLED: '0' } as never), false);
  assert.equal(isKakaoFriendCouponEnabled({ KAKAO_FRIEND_COUPON_ENABLED: '1' } as never), true);
});
test('kakao coupon: 상수', () => {
  assert.equal(KAKAO_FRIEND_COUPON_TYPE, 'kakao_friend_today_detail');
  assert.equal(COUPON_EXPIRY_DAYS, 7);
});
