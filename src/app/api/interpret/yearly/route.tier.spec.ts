// 2026-09-26 — 연간 풀이 티어. 가족·학업·분기·기대/조심(newYear)은 신년운세·평생 구매자만 받는다. 서버에서 자른다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } })),
}));
vi.mock('@/lib/saju/readings', () => ({
  resolveReading: vi.fn(async () => ({ userId: 'u1', input: { year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' } })),
}));
vi.mock('@/lib/saju/pillars', () => ({ toSlug: () => 'rk1' }));
vi.mock('@/lib/report-entitlements', () => ({ getLifetimeReportEntitlement: vi.fn(async () => null) }));
vi.mock('@/lib/subscription', () => ({
  getManagedSubscription: vi.fn(async () => null),
  isEntitledStatus: (s: string) => s === 'active',
}));
vi.mock('@/lib/product-entitlements', () => ({
  hasYearCoreEntitlementForReading: vi.fn(async () => false),
  hasNewYearEntitlementForReading: vi.fn(async () => false),
}));
vi.mock('@/server/ai/saju-yearly-service', () => ({
  // 캐시는 티어와 무관하게 공유된다 — full 구매자가 먼저 만든 행은 basic 요청에도 newYear 를 달고 온다. 그래서 목도 늘 붙인다.
  generateYearlyInterpretation: vi.fn(async () => ({
    ok: true,
    interpretation: { opening: 'o', newYear: { categories: { family: 'f', study: 's' } } },
  })),
}));

import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { getManagedSubscription } from '@/lib/subscription';
import { hasNewYearEntitlementForReading, hasYearCoreEntitlementForReading } from '@/lib/product-entitlements';
import { generateYearlyInterpretation } from '@/server/ai/saju-yearly-service';
import { POST } from './route';

async function call() {
  const res = await POST(new NextRequest('https://ganjisaju.kr/api/interpret/yearly', {
    method: 'POST', body: JSON.stringify({ readingId: 'r1', targetYear: 2027 }),
  }));
  return { status: res.status, body: await res.json() };
}
const includeNewYearArg = () => vi.mocked(generateYearlyInterpretation).mock.calls[0]?.[0].includeNewYear;

describe('interpret/yearly — basic/full 티어', () => {
  beforeEach(() => vi.clearAllMocks());

  it('올해 핵심 보유만 → basic, newYear 없음', async () => {
    vi.mocked(hasYearCoreEntitlementForReading).mockResolvedValueOnce(true);
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.tier).toBe('basic');
    expect(body.interpretation.newYear).toBeUndefined();
    expect(includeNewYearArg()).toBe(false);
  });

  it('프리미엄 구독만 → basic', async () => {
    vi.mocked(getManagedSubscription).mockResolvedValueOnce({ status: 'active', plan: 'premium_monthly' } as never);
    const { body } = await call();
    expect(body.tier).toBe('basic');
    expect(body.interpretation.newYear).toBeUndefined();
  });

  it('신년운세 보유 → full, newYear 포함', async () => {
    vi.mocked(hasNewYearEntitlementForReading).mockResolvedValueOnce(true);
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.tier).toBe('full');
    expect(body.interpretation.newYear.categories.family).toBe('f');
    expect(includeNewYearArg()).toBe(true);
  });

  it('평생 보유 → full', async () => {
    vi.mocked(getLifetimeReportEntitlement).mockResolvedValueOnce({ id: 'e' } as never);
    const { body } = await call();
    expect(body.tier).toBe('full');
  });

  it('아무 권한도 없으면 403', async () => {
    const { status } = await call();
    expect(status).toBe(403);
    expect(generateYearlyInterpretation).not.toHaveBeenCalled();
  });
});
