// 2026-09-01 — "쿠폰이 발송 안 된다" 컴플레인의 회귀 가드. 검증 결과가 **화면에 말이 되어
//   나타나는지**를 고정한다. 전엔 성공/실패 모두 조용해서 사용자가 알 방법이 없었다.
import { describe, it, expect } from 'vitest';
import { readCouponVerifyResult } from './coupon-verify-result';

describe('readCouponVerifyResult', () => {
  it('쿼리가 없으면 아무것도 띄우지 않는다', () => {
    expect(readCouponVerifyResult('')).toBeNull();
    expect(readCouponVerifyResult('?foo=1')).toBeNull();
  });

  it('발급 성공은 성공 톤으로 알린다(전에는 조용했다)', () => {
    const r = readCouponVerifyResult('?kakaoCoupon=issued');
    expect(r?.tone).toBe('success');
    expect(r?.action).toBe('none');
  });

  it('not_friend 는 채널 추가 경로를 준다 — 재시도 버튼만 주면 같은 실패를 반복한다', () => {
    const r = readCouponVerifyResult('?kakaoCoupon=error&reason=not_friend');
    expect(r?.action).toBe('add-channel');
    expect(r?.tone).toBe('notice');
  });

  it('동의 취소·로그인 필요는 각각 다른 말로 안내한다', () => {
    expect(readCouponVerifyResult('?kakaoCoupon=error&reason=access_denied')?.title).toContain(
      '취소'
    );
    expect(readCouponVerifyResult('?kakaoCoupon=error&reason=unauthorized')?.title).toContain(
      '로그인'
    );
  });

  it('이미 받은 카카오 계정은 재시도 버튼을 주지 않는다 — 눌러도 결과가 같다', () => {
    const r = readCouponVerifyResult('?kakaoCoupon=error&reason=already_issued_for_kakao_account');
    expect(r?.action).toBe('none');
    expect(r?.title).toContain('이미');
  });

  it('모르는 사유도 빈 화면 대신 재시도 안내로 떨어진다', () => {
    const r = readCouponVerifyResult('?kakaoCoupon=error&reason=channels_fetch');
    expect(r?.action).toBe('retry');
    expect(r?.title.length).toBeGreaterThan(0);
  });

  it('?(물음표) 유무와 무관하게 파싱한다', () => {
    expect(readCouponVerifyResult('kakaoCoupon=issued')?.tone).toBe('success');
  });
});
