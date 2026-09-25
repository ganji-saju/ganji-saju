// 2026-09-26 — 신년운세 열람 판정: 로그인 + 본인 사주 + (신년운세 이용권 || 평생 이용권).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const user = { id: 'u1' };
vi.mock('@/lib/supabase/server', () => ({
  hasSupabaseServerEnv: true,
  hasSupabaseServiceEnv: true,
  createClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user } }) } })),
}));
vi.mock('@/lib/saju/readings', () => ({ resolveReading: vi.fn(async () => ({ userId: 'u1', input: {} })) }));
vi.mock('@/lib/saju/pillars', () => ({ toSlug: () => 'rk1' }));
vi.mock('@/lib/report-entitlements', () => ({ getLifetimeReportEntitlement: vi.fn(async () => null) }));
vi.mock('@/lib/product-entitlements', () => ({ hasNewYearEntitlementForReading: vi.fn(async () => false) }));

import { resolveReading } from '@/lib/saju/readings';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { hasNewYearEntitlementForReading } from '@/lib/product-entitlements';
import { resolveNewYearAccess } from './new-year-access';

describe('resolveNewYearAccess', () => {
  beforeEach(() => vi.clearAllMocks());

  it('이용권 없으면 hasAccess=false(사주는 돌려준다 — 미리보기용)', async () => {
    const r = await resolveNewYearAccess('s1', 2027);
    expect(r.reading).toBeTruthy();
    expect(r.hasAccess).toBe(false);
  });

  it('신년운세 이용권이면 열린다(해당 연도로 조회)', async () => {
    vi.mocked(hasNewYearEntitlementForReading).mockResolvedValueOnce(true);
    const r = await resolveNewYearAccess('s1', 2027);
    expect(r.hasAccess).toBe(true);
    expect(hasNewYearEntitlementForReading).toHaveBeenCalledWith('u1', 'rk1', 2027);
  });

  it('평생 이용권이면 열린다', async () => {
    vi.mocked(getLifetimeReportEntitlement).mockResolvedValueOnce({ id: 'e' } as never);
    expect((await resolveNewYearAccess('s1', 2027)).hasAccess).toBe(true);
  });

  it('남의 사주는 이용권이 있어도 닫힌다', async () => {
    vi.mocked(resolveReading).mockResolvedValueOnce({ userId: 'other', input: {} } as never);
    vi.mocked(hasNewYearEntitlementForReading).mockResolvedValueOnce(true);
    expect((await resolveNewYearAccess('s1', 2027)).hasAccess).toBe(false);
  });
});
