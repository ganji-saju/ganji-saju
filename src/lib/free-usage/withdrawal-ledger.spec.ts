// 2026-09-01 — 탈퇴/재가입으로 무료 하루 1회가 리셋되던 구멍의 회귀 가드.
//   여기서 지키는 건 두 가지다: ①어떤 기록을 원장에 넣는가(무료 메뉴만) ②언제 되돌리는가
//   (현재 기간만 — 어제 기록을 되돌리면 오늘 무료를 잘못 막는다).
import { describe, it, expect } from 'vitest';
import {
  LEDGERED_BENEFITS,
  currentPeriodKeys,
  isLedgeredBenefit,
} from './withdrawal-ledger';
import { kakaoUidHash, kakaoUidHashFromIdentities } from '@/lib/kakao/uid-hash';

describe('원장 대상 benefit', () => {
  it('무료 메뉴 4종만 대상 — 유료 멤버십 쿼터는 건드리지 않는다', () => {
    expect([...LEDGERED_BENEFITS].sort()).toEqual([
      'free_dialogue_daily',
      'free_dream_daily',
      'free_tarot_daily',
      'free_today_daily',
    ]);
    // 🔴 멤버십 쿼터(유료)는 탈퇴하면 구독도 끝난다 — 되돌릴 대상이 아니다.
    expect(isLedgeredBenefit('dialogue_daily')).toBe(false);
    expect(isLedgeredBenefit('compat_monthly')).toBe(false);
    expect(isLedgeredBenefit('detail_monthly')).toBe(false);
  });
});

describe('currentPeriodKeys', () => {
  it('KST 기준 일·월 키 2개를 준다(056 과 같은 규칙)', () => {
    // UTC 2026-09-01T15:00 = KST 2026-09-02 00:00
    const keys = currentPeriodKeys(new Date('2026-09-01T15:00:00Z'));
    expect(keys).toEqual(['2026-09-02', '2026-09']);
  });

  it('KST 자정 직전은 아직 전날', () => {
    const keys = currentPeriodKeys(new Date('2026-09-01T14:59:00Z'));
    expect(keys).toEqual(['2026-09-01', '2026-09']);
  });
});

describe('kakaoUidHashFromIdentities', () => {
  it('카카오 신원의 id(회원번호)로 해시한다 — 기존 원장 키(sha256(회원번호))와 같다', () => {
    expect(kakaoUidHashFromIdentities([{ provider: 'kakao', id: '1234567890' }])).toBe(kakaoUidHash('1234567890'));
  });
  it('카카오 신원이 없으면 null — user_metadata 의 값은 보지 않는다(위조 가능)', () => {
    expect(kakaoUidHashFromIdentities([{ provider: 'google', id: '999' }])).toBeNull();
    expect(kakaoUidHashFromIdentities([{ provider: 'email', id: 'x' }])).toBeNull();
    expect(kakaoUidHashFromIdentities(null)).toBeNull();
    expect(kakaoUidHashFromIdentities([{ provider: 'kakao', id: '   ' }])).toBeNull();
  });
});
