// POST /api/admin/lifetime-report/grant — 라우트 단위 테스트 (vitest)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ── 모듈 목(mock) ─────────────────────────────────────────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
  hasSupabaseServiceEnv: true,
}));

vi.mock('@/lib/admin-auth', () => ({
  getCurrentAdminRole: vi.fn(),
}));

vi.mock('@/lib/saju/readings', () => ({
  getReadingById: vi.fn(),
  isReadingId: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/report-entitlements', () => ({
  grantLifetimeReportEntitlement: vi.fn(),
}));

vi.mock('@/lib/admin/access-log', () => ({
  logAdminAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/admin/summary-refresh', () => ({
  refreshAdminUserSummaryForUser: vi.fn().mockResolvedValue(true),
}));

// ── 목 가져오기 ───────────────────────────────────────────────────────────
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { getReadingById } from '@/lib/saju/readings';
import { grantLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { logAdminAccess } from '@/lib/admin/access-log';
import { refreshAdminUserSummaryForUser } from '@/lib/admin/summary-refresh';

// ── 라우트 가져오기 ───────────────────────────────────────────────────────
import { POST } from './route';

// ── 헬퍼 ─────────────────────────────────────────────────────────────────
const ADMIN_ID = 'admin-uuid-0001';
const USER_ID  = 'user-uuid-1111';
const READING_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = 'user-uuid-9999';

const FAKE_READING = {
  id: READING_ID,
  userId: USER_ID,
  input: { year: 2000, month: 1, day: 15, hour: 19, gender: 'male' as const },
  result: null,
  sajuData: null,
  grounding: null,
  kasiComparison: null,
  metadata: null,
  chaptersEnvelope: null,
};

const FAKE_ENT = { id: 'ent-uuid-0001', userId: USER_ID, readingKey: '', orderId: null, paymentKey: null, amount: 0, createdAt: '' };

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/lifetime-report/grant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function mockSuperAdmin() {
  vi.mocked(getCurrentAdminRole).mockResolvedValue({
    ok: true,
    userId: ADMIN_ID,
    role: 'super_admin',
    reason: 'ok',
  });
}

function mockAdminOnly() {
  vi.mocked(getCurrentAdminRole).mockResolvedValue({
    ok: true,
    userId: ADMIN_ID,
    role: 'admin',
    reason: 'ok',
  });
}

function mockUnauthenticated() {
  vi.mocked(getCurrentAdminRole).mockResolvedValue({
    ok: false,
    userId: null,
    role: null,
    reason: 'unauthenticated',
  });
}

// ── 테스트 ───────────────────────────────────────────────────────────────
describe('POST /api/admin/lifetime-report/grant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getReadingById).mockResolvedValue(FAKE_READING as any);
    vi.mocked(grantLifetimeReportEntitlement).mockResolvedValue(FAKE_ENT as any);
  });

  it('미인증 → 401', async () => {
    mockUnauthenticated();
    const res = await POST(makeRequest({ userId: USER_ID, readingId: READING_ID }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('admin(비-super_admin) → 403 + 한국어 메시지', async () => {
    mockAdminOnly();
    const res = await POST(makeRequest({ userId: USER_ID, readingId: READING_ID }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('super_admin');
  });

  it('readingId 가 다른 유저 소유 → 403', async () => {
    mockSuperAdmin();
    vi.mocked(getReadingById).mockResolvedValue({ ...FAKE_READING, userId: OTHER_USER_ID } as any);
    const res = await POST(makeRequest({ userId: USER_ID, readingId: READING_ID }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('해당 유저의 결과가 아닙니다');
  });

  it('readingId 없음(null) → 404', async () => {
    mockSuperAdmin();
    vi.mocked(getReadingById).mockResolvedValue(null);
    const res = await POST(makeRequest({ userId: USER_ID, readingId: READING_ID }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('사주 결과를 찾지 못했습니다');
  });

  it('body에 userId 누락 → 400', async () => {
    mockSuperAdmin();
    const res = await POST(makeRequest({ readingId: READING_ID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('정상 부여 → ok:true + readingKey + entitlementId + 감사로그 호출', async () => {
    mockSuperAdmin();
    const res = await POST(makeRequest({ userId: USER_ID, readingId: READING_ID, reason: '운영 보상' }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(typeof body.readingKey).toBe('string');
    expect(body.readingKey.length).toBeGreaterThan(0);
    expect(body.entitlementId).toBe(FAKE_ENT.id);

    // grantLifetimeReportEntitlement 호출 검증
    expect(vi.mocked(grantLifetimeReportEntitlement)).toHaveBeenCalledOnce();
    const [grantUserId, grantReadingKey, grantOpts] =
      vi.mocked(grantLifetimeReportEntitlement).mock.calls[0];
    expect(grantUserId).toBe(USER_ID);
    expect(grantReadingKey).toBe(body.readingKey); // 서버 도출 readingKey 일치
    expect(grantOpts).toEqual({ amount: 0 });

    // logAdminAccess 호출 검증
    expect(vi.mocked(logAdminAccess)).toHaveBeenCalledOnce();
    const logCall = vi.mocked(logAdminAccess).mock.calls[0][0];
    expect(logCall.action).toBe('grant_lifetime_report');
    expect(logCall.actorId).toBe(ADMIN_ID);
    expect(logCall.actorRole).toBe('super_admin');
    expect(logCall.targetUser).toBe(USER_ID);
    expect(logCall.reason).toBe('운영 보상');
    expect(logCall.meta?.readingId).toBe(READING_ID);
    expect(logCall.meta?.readingKey).toBe(body.readingKey);
    expect(logCall.meta?.entitlementId).toBe(FAKE_ENT.id);

    // refreshAdminUserSummaryForUser 호출 검증
    expect(vi.mocked(refreshAdminUserSummaryForUser)).toHaveBeenCalledWith(USER_ID);
  });

  it('멱등: 이미 보유 시에도 ok:true (grantLifetimeReportEntitlement 자체가 멱등)', async () => {
    mockSuperAdmin();
    // grantLifetimeReportEntitlement는 멱등 — 기존 ent 반환
    vi.mocked(grantLifetimeReportEntitlement).mockResolvedValue(FAKE_ENT as any);
    const res = await POST(makeRequest({ userId: USER_ID, readingId: READING_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
