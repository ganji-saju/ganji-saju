import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/admin-auth', () => ({ getCurrentAdminRole: vi.fn(async () => ({ ok: false, reason: 'unauthenticated' })) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock('@/lib/report-orders/report-order-store', () => ({ purgeExpiredReportOrders: vi.fn(async () => ({ orders: 2, reports: 1 })) }));

import { purgeExpiredReportOrders } from '@/lib/report-orders/report-order-store';
import { GET } from './route';

const req = (auth?: string) => new NextRequest('https://ganjisaju.kr/api/admin/report-orders/purge', { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', 'sekret');
});

describe('보관 기간 삭제 크론', () => {
  it('크론 비밀값·관리자 로그인 둘 다 없으면 401, 삭제 안 함', async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('Bearer wrong'))).status).toBe(401);
    expect(purgeExpiredReportOrders).not.toHaveBeenCalled();
  });

  it('크론이면 삭제하고 건수만 돌려준다', async () => {
    const res = await GET(req('Bearer sekret'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, orders: 2, reports: 1 });
  });
});
