import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } })) }));
vi.mock('@/lib/saju/readings', () => ({ resolveReading: vi.fn(async () => ({ input: {} })) }));
vi.mock('@/lib/saju/pillars', () => ({ toSlug: () => 'rk1' }));
vi.mock('@/lib/report-entitlements', () => ({ getLifetimeReportEntitlement: vi.fn(async () => ({ id: 'e1' })) }));
vi.mock('@/server/ai/saju-lifetime-service', () => ({ generateLifetimeInterpretation: vi.fn() }));
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { generateLifetimeInterpretation } from '@/server/ai/saju-lifetime-service';
import { POST } from './route';
const request = (stream = true) => new NextRequest('https://ganjisaju.kr/api/interpret/lifetime', {
  method: 'POST', headers: { Accept: stream ? 'application/x-ndjson' : 'application/json' }, body: JSON.stringify({ readingId: 'r1' }),
});
beforeEach(() => vi.clearAllMocks());
it('streams completed stages before the final result; ordinary JSON remains compatible', async () => {
  let finish!: () => void;
  vi.mocked(generateLifetimeInterpretation).mockImplementationOnce(async ({ onProgress }) => {
    onProgress?.(30, '기운의 균형 정리 완료');
    await new Promise<void>(resolve => { finish = resolve; });
    return { ok: true, interpretation: { opening: '완료' } } as never;
  });
  const response = await POST(request());
  expect(response.headers.get('content-type')).toContain('application/x-ndjson');
  const reader = response.body!.getReader();
  const decode = (value: Uint8Array | undefined) => JSON.parse(new TextDecoder().decode(value));
  expect(decode((await reader.read()).value).percent).toBe(0);
  expect(decode((await reader.read()).value).percent).toBe(30);
  finish();
  expect(decode((await reader.read()).value)).toMatchObject({ type: 'result', payload: { ok: true } });
  expect((await reader.read()).done).toBe(true);
  vi.mocked(generateLifetimeInterpretation).mockResolvedValueOnce({ ok: true, interpretation: {} } as never);
  expect(await (await POST(request(false))).json()).toMatchObject({ ok: true });
});
it('denies unauthorized entitlement before opening the stream', async () => {
  vi.mocked(getLifetimeReportEntitlement).mockResolvedValueOnce(null);
  expect((await POST(request())).status).toBe(403);
  expect(generateLifetimeInterpretation).not.toHaveBeenCalled();
});
it('reports generation errors without leaking server details or a success event', async () => {
  vi.mocked(generateLifetimeInterpretation).mockRejectedValueOnce(new Error('private server detail'));
  const text = await (await POST(request())).text();
  expect(text).toContain('"type":"error"');
  expect(text).not.toContain('private server detail');
  expect(text).not.toContain('"type":"result"');
});
it('cancelling the reader aborts generation', async () => {
  let signal!: AbortSignal;
  vi.mocked(generateLifetimeInterpretation).mockImplementationOnce(async request => {
    signal = request.signal!;
    await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    return null;
  });
  const response = await POST(request());
  await response.body!.cancel();
  expect(signal.aborted).toBe(true);
});
