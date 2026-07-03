// 2026-07-04 — 자체 방문(유입) 핑. 클라이언트(VisitPing)가 KST 일 1회 호출.
// 익명 vid 를 서버에서 sha256 해시해 (date_key, visitor_hash) upsert — 일별 순방문.
// PII 없음(원시 vid 미저장), 실패해도 200(사용자 경험 무영향·best-effort).
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  createClient,
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function kstDateKey(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// vid: 클라 localStorage 의 익명 랜덤 id. 형식만 느슨히 검증(8~64자 영숫자·하이픈).
const VID_RE = /^[a-zA-Z0-9-]{8,64}$/;

export async function POST(req: NextRequest) {
  if (!hasSupabaseServiceEnv) return NextResponse.json({ ok: true, skipped: 'no_service_env' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, skipped: 'bad_body' });
  }
  const data = (body ?? {}) as Record<string, unknown>;
  const vid = typeof data.vid === 'string' ? data.vid.trim() : '';
  if (!VID_RE.test(vid)) return NextResponse.json({ ok: true, skipped: 'bad_vid' });

  const path = typeof data.path === 'string' ? data.path.slice(0, 200) : null;
  const refHost = (() => {
    const ref = typeof data.ref === 'string' ? data.ref : '';
    if (!ref) return null;
    try {
      return new URL(ref).hostname.slice(0, 120);
    } catch {
      return null;
    }
  })();

  // 로그인 사용자면 user_id 참조(선택 — 활동 지표와 교차분석용).
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  const visitorHash = crypto.createHash('sha256').update(vid).digest('hex');
  const dateKey = kstDateKey();

  try {
    const service = await createServiceClient();
    // 같은 날 재핑(다중 탭·localStorage 유실)은 PV 만 +1 — 순방문은 PK 로 자연 dedupe.
    const { error } = await service.from('site_visits').upsert(
      {
        date_key: dateKey,
        visitor_hash: visitorHash,
        user_id: userId,
        first_path: path,
        referrer_host: refHost,
      },
      { onConflict: 'date_key,visitor_hash', ignoreDuplicates: true }
    );
    if (error) console.error('[visit] upsert failed:', error.message);
  } catch (err) {
    console.error('[visit] unexpected failure:', err);
  }

  return NextResponse.json({ ok: true });
}
