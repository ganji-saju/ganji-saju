import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})), hasSupabaseServiceEnv: false }));
vi.mock('@/lib/admin-auth', () => ({ getCurrentAdminRole: vi.fn() }));
vi.mock('@/lib/admin/access-log', () => ({ logAdminAccess: vi.fn(async () => undefined) }));
vi.mock('@/lib/admin/external-report', async (original) => ({
  ...await original<typeof import('@/lib/admin/external-report')>(),
  generateExternalReport: vi.fn(),
}));

import { getCurrentAdminRole } from '@/lib/admin-auth';
import { logAdminAccess } from '@/lib/admin/access-log';
import { generateExternalReport, type ExternalReportResult } from '@/lib/admin/external-report';
import { POST } from './route';

const valid = {
  name: '구매자', calendarType: 'solar', timeRule: 'standard', year: '1982', month: '1', day: '29',
  hour: '8', minute: '45', unknownBirthTime: false, gender: 'male',
  birthLocationCode: '', birthLocationLabel: '', birthLatitude: '', birthLongitude: '',
};
const generated = { data: { reportNo: 'GS-EXT-TEST' }, issuedAt: '2026.09.17', generationSource: 'fallback', generationWarning: '기본 계산 풀이' } as ExternalReportResult;
function request(body: unknown = valid, extraHeaders: Record<string, string> = {}, signal?: AbortSignal) {
  return new NextRequest('https://ganjisaju.kr/api/admin/external-report', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://ganjisaju.kr', ...extraHeaders },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal,
  });
}

describe('POST /api/admin/external-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentAdminRole).mockResolvedValue({ ok: true, userId: 'admin', role: 'super_admin', reason: 'ok' });
    vi.mocked(generateExternalReport).mockResolvedValue(generated);
  });

  it.each([
    [{ ok: false, userId: null, role: null, reason: 'unauthenticated' }, 401],
    [{ ok: false, userId: 'buyer', role: null, reason: 'forbidden' }, 403],
    [{ ok: true, userId: 'staff', role: 'admin', reason: 'ok' }, 403],
  ] as const)('rejects unauthorized roles before generating', async (guard, status) => {
    vi.mocked(getCurrentAdminRole).mockResolvedValue(guard);
    expect((await POST(request())).status).toBe(status);
    expect(generateExternalReport).not.toHaveBeenCalled();
    expect(logAdminAccess).not.toHaveBeenCalled();
  });

  it.each(['https://attacker.example', 'https://staging.ganjisaju.kr', '', 'null'])('rejects wrong or absent Origin: %s', async (origin) => {
    expect((await POST(request(valid, { origin }))).status).toBe(403);
    expect(generateExternalReport).not.toHaveBeenCalled();
  });

  it.each(['{bad', {}, { ...valid, name: '' }, { ...valid, gender: '' }, { ...valid, month: '2', day: '31' }, { ...valid, calendarType: 'lunar', month: '99' }])('rejects invalid JSON/input with 400', async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(generateExternalReport).not.toHaveBeenCalled();
  });

  it('returns a no-store report and audit data without buyer details', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: true, ...generated });
    expect(generateExternalReport).toHaveBeenCalledWith(expect.objectContaining({ name: '구매자', year: 1982, gender: 'male' }), { signal: expect.any(AbortSignal) });
    expect(logAdminAccess).toHaveBeenCalledWith({ actorId: 'admin', actorRole: 'super_admin', action: 'generate_external_report', targetUser: null, meta: { reportNo: 'GS-EXT-TEST', generationSource: 'fallback' } });
  });

  it('rejects a simultaneous second generation and releases its guard afterwards', async () => {
    let finish!: (value: ExternalReportResult) => void;
    vi.mocked(generateExternalReport).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const first = POST(request());
    await vi.waitFor(() => expect(generateExternalReport).toHaveBeenCalledOnce());
    const second = await POST(request());
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).toBe('15');
    finish(generated);
    expect((await first).status).toBe(200);
    expect((await POST(request())).status).toBe(200);
  });

  it('does not leak upstream errors and releases the guard on failure', async () => {
    vi.mocked(generateExternalReport).mockRejectedValueOnce(new Error('private buyer 1982-01-29'));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('1982');
    expect(logAdminAccess).not.toHaveBeenCalled();
    expect((await POST(request())).status).toBe(200);
  });

  it('passes cancellation to generation, skips audit and releases the guard', async () => {
    const controller = new AbortController();
    vi.mocked(generateExternalReport).mockImplementationOnce((_input, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true });
    }));
    const first = POST(request(valid, {}, controller.signal));
    await vi.waitFor(() => expect(generateExternalReport).toHaveBeenCalledOnce());
    controller.abort();
    expect((await first).status).toBe(499);
    expect(logAdminAccess).not.toHaveBeenCalled();
    expect((await POST(request())).status).toBe(200);
  });
});
