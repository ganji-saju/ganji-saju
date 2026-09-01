import { describe, it, expect } from 'vitest';
import { MEMBER_QUOTAS, computeMemberFreeEligible } from './member-benefits';

describe('확정 멤버 쿼터(premium 단일 등급)', () => {
  it('확정 멤버 쿼터', () => {
    expect(MEMBER_QUOTAS.premium).toMatchObject({ detailMonthly: null, calendarMonthly: null, dialogueDaily: 5, compatMonthly: 3 });
  });
});

describe('computeMemberFreeEligible — 단락(short-circuit) 경로 (DB 불필요)', () => {
  it('커버 안 되는 상품(love-question) + premium → false', async () => {
    expect(await computeMemberFreeEligible('uid', 'love-question', 'premium')).toBe(false);
  });

  it('커버 안 되는 상품(year-core) + premium → false', async () => {
    expect(await computeMemberFreeEligible('uid', 'year-core', 'premium')).toBe(false);
  });

  it('non-member(null) + today-detail → false', async () => {
    expect(await computeMemberFreeEligible('uid', 'today-detail', null)).toBe(false);
  });

  it('non-member(null) + monthly-calendar → false', async () => {
    expect(await computeMemberFreeEligible('uid', 'monthly-calendar', null)).toBe(false);
  });

  it('premium + today-detail → true', async () => {
    expect(await computeMemberFreeEligible('uid', 'today-detail', 'premium')).toBe(true);
  });

  it('premium + monthly-calendar → true', async () => {
    expect(await computeMemberFreeEligible('uid', 'monthly-calendar', 'premium')).toBe(true);
  });
});
