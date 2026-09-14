// 2026-09-14 — 하루 1회에 막힌 가족 사주를 결제 경로로 사면 run 기록이 없어, 결제 후 상세 스냅샷이 폼 이름을 몰랐다
//   (계정 주인 이름으로 굳음). 상세가 넘긴 폼 이름(name)이 스냅샷 생성까지 가는지 라우트 레벨로 지킨다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
  })),
}));
vi.mock('@/lib/saju/readings', () => ({
  resolveReading: vi.fn(async () => ({
    id: 'reading-dad',
    userId: 'user-1',
    input: { year: 1962, month: 3, day: 2, unknownTime: true, gender: 'male' },
  })),
}));
vi.mock('@/lib/profile', () => ({
  getUserProfileById: vi.fn(async () => ({ preferredCounselor: null })),
}));
vi.mock('@/lib/credits/detail-report-access', () => ({
  getKoreaAccessDay: vi.fn(() => '2026-09-14'),
  hasDetailReportAccess: vi.fn(async () => false),
  hasTodayFortuneDailyAccess: vi.fn(async () => false),
  hasTodayFortunePremiumAccess: vi.fn(async () => false),
  hasTodayFortunePremiumAccessByReading: vi.fn(async () => false),
  unlockTodayFortunePremium: vi.fn(),
}));
vi.mock('@/lib/product-entitlements', () => ({
  buildTodayDetailScopeKey: (k: string) => `today:${k}`,
  hasTodayDetailEntitlementForDay: vi.fn(async () => true),
  getTasteProductEntitlement: vi.fn(async () => null),
}));
vi.mock('@/lib/today-fortune/result-snapshots', () => ({
  buildTodayFortuneResultSnapshotScopeKey: () => 'scope',
  getTodayFortuneResultSnapshotByScope: vi.fn(async () => null),
  upsertTodayFortuneResultSnapshot: vi.fn(async () => ({
    id: 'snap-1',
    occurredOn: '2026-09-14',
    freeResult: {},
    premiumResult: { ok: true },
  })),
  buildTodayFortuneSnapshotContent: vi.fn(),
}));

import { upsertTodayFortuneResultSnapshot } from '@/lib/today-fortune/result-snapshots';
import { GET, POST } from './route';

const snapshotArg = () => vi.mocked(upsertTodayFortuneResultSnapshot).mock.calls[0][0];

describe('/api/today-fortune/unlock — 폼 이름(name)을 스냅샷 이름 해석에 넘긴다', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET ?name= 이 nameHint 로 간다', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/today-fortune/unlock?sourceSessionId=reading-dad&name=%EC%95%84%EB%B2%84%EC%A7%80')
    );
    expect((await res.json()).hasAccess).toBe(true);
    expect(snapshotArg().nameHint).toBe('아버지');
  });

  it('POST body.name 도 nameHint 로 간다(멤버십 열기 경로)', async () => {
    await POST(
      new NextRequest('http://localhost/api/today-fortune/unlock', {
        method: 'POST',
        body: JSON.stringify({ sourceSessionId: 'reading-dad', name: '아버지' }),
      })
    );
    expect(snapshotArg().nameHint).toBe('아버지');
  });
});
