// 2026-09-01 — 탈퇴/재가입 재발급 차단의 대조 키. 이 해시가 흔들리면 이미 받은 사람이
//   다시 받거나(불일치), 안 받은 사람이 막힌다(충돌). 알고리즘을 못으로 박는다.
import { describe, it, expect } from 'vitest';
import { kakaoUidHash } from './kakao-friend-coupon';

describe('kakaoUidHash', () => {
  it('같은 카카오 회원번호는 항상 같은 키 — 탈퇴 후 재가입해도 대조된다', () => {
    expect(kakaoUidHash('1234567890')).toBe(kakaoUidHash('1234567890'));
  });

  it('다른 번호는 다른 키', () => {
    expect(kakaoUidHash('1234567890')).not.toBe(kakaoUidHash('1234567891'));
  });

  it('평문 회원번호가 키에 남지 않는다(원장은 탈퇴 후에도 보관된다)', () => {
    const uid = '1234567890';
    const hash = kakaoUidHash(uid);
    expect(hash).not.toContain(uid);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
