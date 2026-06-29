import { describe, it, expect } from 'vitest';
import { isCreditPackage, COIN_TOPUP_ENABLED, assertCoinTopupAllowed } from '@/lib/payments/coin-sunset';
import { getPackage } from '@/lib/payments/catalog';

describe('coin sunset', () => {
  it('코인 충전은 비활성', () => {
    expect(COIN_TOPUP_ENABLED).toBe(false);
  });
  it('credit_15 는 코인팩으로 식별', () => {
    expect(isCreditPackage(getPackage('credit_15')!)).toBe(true);
  });
  it('멤버십/단건상품은 코인팩 아님', () => {
    expect(isCreditPackage(getPackage('membership_premium')!)).toBe(false);
    expect(isCreditPackage(getPackage('taste_today_detail')!)).toBe(false);
  });
  it('코인팩 결제요청은 거부(throw)', () => {
    expect(() => assertCoinTopupAllowed(getPackage('credit_15')!)).toThrow();
    expect(() => assertCoinTopupAllowed(getPackage('membership_premium')!)).not.toThrow();
  });
});
