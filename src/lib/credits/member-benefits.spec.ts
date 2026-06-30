import { describe, it, expect } from 'vitest';
import { MEMBER_QUOTAS } from './member-benefits';

describe('확정 멤버 쿼터', () => {
  it('확정 멤버 쿼터', () => {
    expect(MEMBER_QUOTAS.premium).toMatchObject({ detailMonthly: null, calendarMonthly: null, dialogueDaily: 5, compatMonthly: 3 });
    expect(MEMBER_QUOTAS.plus).toMatchObject({ detailMonthly: 3, calendarMonthly: 1, dialogueDaily: 2, compatMonthly: 1 });
  });
});
