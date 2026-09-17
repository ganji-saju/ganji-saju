import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { logAdminAccess } from '@/lib/admin/access-log';
import { generateExternalReport, parseExternalReportRequest } from '@/lib/admin/external-report';

export const runtime = 'nodejs';
export const maxDuration = 300;

// 같은 서버 인스턴스에서 중복 클릭·동시 생성을 막는다. 분산 전역 쿼터를 보장하지는 않는다.
const running = new Map<string, { token: symbol; expiresAt: number }>();
const MAX_BODY_BYTES = 8_192;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function hasSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin || req.headers.get('sec-fetch-site') === 'cross-site') return false;
  try { return new URL(origin).origin === new URL(req.url).origin; } catch { return false; }
}

export async function POST(req: NextRequest) {
  const check = await getCurrentAdminRole(await createClient());
  if (!check.ok || !check.userId || check.role !== 'super_admin') {
    return json({ ok: false, error: check.reason === 'unauthenticated' ? '로그인이 필요합니다.' : '최고 관리자 권한이 필요합니다.' },
      check.reason === 'unauthenticated' ? 401 : 403);
  }
  if (!hasSameOrigin(req)) return json({ ok: false, error: '관리자 화면에서 다시 요청해 주세요.' }, 403);
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ ok: false, error: 'JSON 형식의 입력이 필요합니다.' }, 400);
  }
  if (Number(req.headers.get('content-length')) > MAX_BODY_BYTES) {
    return json({ ok: false, error: '입력 내용이 너무 깁니다.' }, 400);
  }
  let payload: unknown;
  try {
    const text = await req.text();
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) return json({ ok: false, error: '입력 내용이 너무 깁니다.' }, 400);
    payload = JSON.parse(text);
  } catch { return json({ ok: false, error: '입력 내용을 읽을 수 없습니다.' }, 400); }
  const parsed = parseExternalReportRequest(payload);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);

  const existing = running.get(check.userId);
  if (existing && existing.expiresAt > Date.now()) {
    return json({ ok: false, error: '이 계정에서 리포트를 생성 중입니다. 완료될 때까지 기다려 주세요.' }, 429, { 'Retry-After': '15' });
  }
  const token = Symbol();
  running.set(check.userId, { token, expiresAt: Date.now() + maxDuration * 1000 });
  try {
    const result = await generateExternalReport(parsed.input, { signal: req.signal });
    req.signal.throwIfAborted();
    await logAdminAccess({
      actorId: check.userId,
      actorRole: check.role,
      action: 'generate_external_report',
      targetUser: null,
      meta: { reportNo: result.data.reportNo, generationSource: result.generationSource },
    });
    return json({ ok: true, ...result });
  } catch {
    // 원문 입력·AI 오류 원문에는 구매자의 개인정보가 들어갈 수 있어 출력하지 않는다.
    if (req.signal.aborted) return json({ ok: false, error: '리포트 생성을 취소했습니다.' }, 499);
    return json({ ok: false, error: '리포트를 생성하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }, 500);
  } finally {
    if (running.get(check.userId)?.token === token) running.delete(check.userId);
  }
}
