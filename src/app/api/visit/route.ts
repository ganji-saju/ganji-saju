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

  // 2026-07-07 — 유입 캠페인 분석용 UTM(선택). 랜딩 URL 의 utm_* 를 그대로 수집(≤120자).
  const utm = (key: string): string | null => {
    const raw = data[key];
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim().slice(0, 120);
    return trimmed || null;
  };
  const utmSource = utm('utm_source');
  const utmMedium = utm('utm_medium');
  const utmCampaign = utm('utm_campaign');
  const hasUtm = Boolean(utmSource || utmMedium || utmCampaign);

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
    // 같은 날 재핑(다중 탭·localStorage 유실)은 순방문 PK 로 자연 dedupe(첫 진입 first-touch 유지).
    const { error } = await service.from('site_visits').upsert(
      {
        date_key: dateKey,
        visitor_hash: visitorHash,
        user_id: userId,
        first_path: path,
        referrer_host: refHost,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
      },
      { onConflict: 'date_key,visitor_hash', ignoreDuplicates: true }
    );
    if (error) console.error('[visit] upsert failed:', error.message);

    // 2026-07-07 — 같은 날 direct 방문(utm 없음) 후 광고 클릭(utm 있음) 순서라면 위 insert 는
    //   ignoreDuplicates 로 무시된다. utm 이 있으면 기존 행의 비어있는 utm/referrer 만 채운다
    //   (당일 first-touch UTM). 이미 값이 있으면 덮지 않음.
    if (hasUtm) {
      const { error: fillErr } = await service
        .from('site_visits')
        .update({
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
        })
        .eq('date_key', dateKey)
        .eq('visitor_hash', visitorHash)
        .is('utm_source', null);
      if (fillErr) console.error('[visit] utm fill failed:', fillErr.message);
    }
  } catch (err) {
    console.error('[visit] unexpected failure:', err);
  }

  return NextResponse.json({ ok: true });
}
