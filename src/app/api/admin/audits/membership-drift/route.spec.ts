// GET /api/admin/audits/membership-drift — 인증(크론 CRON_SECRET · super_admin 수동)·운영 메일 게이트.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({}), createServiceClient: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ getCurrentAdminRole: vi.fn() }));
vi.mock('@/lib/email/ops-alert-email', () => ({ sendOpsAlertEmail: vi.fn() }));
vi.mock('@/lib/membership-drift', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/membership-drift')>()),
  runMembershipDriftAudit: vi.fn(),
}));

import { getCurrentAdminRole } from '@/lib/admin-auth';
import { sendOpsAlertEmail } from '@/lib/email/ops-alert-email';
import { runMembershipDriftAudit } from '@/lib/membership-drift';
import { GET } from './route';

const NO_DRIFT = { chainVsRenews: [], entitledWithoutEnd: [], users: [] };
const DRIFT = {
  chainVsRenews: ['u1'],
  entitledWithoutEnd: [],
  users: [{ userId: 'u1', checks: ['chain_vs_renews' as const], renewsAt: null, chainEnd: '2026-10-01T00:00:00.000Z' }],
};

function req(authorization?: string) {
  return new Request('http://localhost/api/admin/audits/membership-drift', {
    headers: authorization ? { authorization } : {},
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', 'cron-secret');
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.mocked(runMembershipDriftAudit).mockResolvedValue(NO_DRIFT);
});
afterEach(() => vi.unstubAllEnvs());

describe('인증', () => {
  it('크론(Bearer CRON_SECRET)은 세션 없이 통과', async () => {
    const res = await GET(req('Bearer cron-secret'));
    expect(res.status).toBe(200);
    expect(getCurrentAdminRole).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ ok: true, chainVsRenews: 0, entitledWithoutEnd: 0, users: [], alerted: false });
  });

  it('틀린 시크릿·헤더 없음은 세션 판정으로 — 비로그인 401', async () => {
    vi.mocked(getCurrentAdminRole).mockResolvedValue({ ok: false, reason: 'unauthenticated' } as never);
    expect((await GET(req('Bearer wrong'))).status).toBe(401);
    expect((await GET(req())).status).toBe(401);
    expect(runMembershipDriftAudit).not.toHaveBeenCalled();
  });

  it('CRON_SECRET 미설정이면 헤더가 있어도 크론으로 인정하지 않는다', async () => {
    vi.stubEnv('CRON_SECRET', '');
    vi.mocked(getCurrentAdminRole).mockResolvedValue({ ok: false, reason: 'unauthenticated' } as never);
    expect((await GET(req('Bearer '))).status).toBe(401);
  });

  it('super_admin 이 아닌 관리자는 403', async () => {
    vi.mocked(getCurrentAdminRole).mockResolvedValue({ ok: true, role: 'admin' } as never);
    expect((await GET(req())).status).toBe(403);
    expect(runMembershipDriftAudit).not.toHaveBeenCalled();
  });

  it('super_admin 수동 호출은 200', async () => {
    vi.mocked(getCurrentAdminRole).mockResolvedValue({ ok: true, role: 'super_admin' } as never);
    expect((await GET(req())).status).toBe(200);
  });
});

describe('운영 메일', () => {
  it('어긋남 0 이면 메일 없음', async () => {
    await GET(req('Bearer cron-secret'));
    expect(sendOpsAlertEmail).not.toHaveBeenCalled();
  });

  it('어긋남 있으면 프로덕션에서 메일(uuid·관리자 링크) + alerted true', async () => {
    vi.mocked(runMembershipDriftAudit).mockResolvedValue(DRIFT);
    vi.mocked(sendOpsAlertEmail).mockResolvedValue({ id: 'm1', to: ['ops@example.com'] });
    const res = await GET(req('Bearer cron-secret'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, chainVsRenews: 1, entitledWithoutEnd: 0, users: DRIFT.users, alerted: true });
    const [input] = vi.mocked(sendOpsAlertEmail).mock.calls[0];
    expect(input.lines.join('\n')).toContain('https://ganjisaju.kr/admin/users/u1');
  });

  it('프로덕션이 아니면 메일 안 보냄(alerted false)', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.mocked(runMembershipDriftAudit).mockResolvedValue(DRIFT);
    const res = await GET(req('Bearer cron-secret'));
    expect((await res.json()).alerted).toBe(false);
    expect(sendOpsAlertEmail).not.toHaveBeenCalled();
  });

  it('메일 실패는 삼키지 않는다 — 500 + alertError', async () => {
    vi.mocked(runMembershipDriftAudit).mockResolvedValue(DRIFT);
    vi.mocked(sendOpsAlertEmail).mockRejectedValue(new Error('경보 수신자가 없습니다(ADMIN_ALERT_EMAILS).'));
    const res = await GET(req('Bearer cron-secret'));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, alerted: false, alertError: '경보 수신자가 없습니다(ADMIN_ALERT_EMAILS).' });
  });

  it('조회 실패는 500', async () => {
    vi.mocked(runMembershipDriftAudit).mockRejectedValue(new Error('db down'));
    const res = await GET(req('Bearer cron-secret'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'db down' });
  });
});
