// 2026-09-01 — 탈퇴/재가입으로 무료 하루 1회가 리셋되던 구멍의 회귀 가드.
//   여기서 지키는 건 두 가지다: ①어떤 기록을 원장에 넣는가(무료 메뉴만) ②언제 되돌리는가
//   (현재 기간만 — 어제 기록을 되돌리면 오늘 무료를 잘못 막는다).
import { describe, it, expect } from 'vitest';
import {
  LEDGERED_BENEFITS,
  currentPeriodKeys,
  isLedgeredBenefit,
} from './withdrawal-ledger';
import { kakaoUidHashFromUserMetadata } from '@/lib/kakao/uid-hash';

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

describe('kakaoUidHashFromUserMetadata', () => {
  it('provider_id / sub 어느 쪽이든 카카오 회원번호를 읽는다(실측: 둘 다 존재)', () => {
    const a = kakaoUidHashFromUserMetadata({ provider_id: '1234567890' });
    const b = kakaoUidHashFromUserMetadata({ sub: '1234567890' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('카카오가 아닌 계정(식별자 없음)은 null — 보호가 걸리지 않는다', () => {
    expect(kakaoUidHashFromUserMetadata({ email: 'a@b.c' })).toBeNull();
    expect(kakaoUidHashFromUserMetadata(null)).toBeNull();
    expect(kakaoUidHashFromUserMetadata({ provider_id: '   ' })).toBeNull();
  });

  it('숫자로 와도 같은 키가 나온다', () => {
    expect(kakaoUidHashFromUserMetadata({ provider_id: 1234567890 })).toBe(
      kakaoUidHashFromUserMetadata({ provider_id: '1234567890' })
    );
  });
});
