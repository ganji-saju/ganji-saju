// 2026-07-04 — 자체 방문(유입) 핑.
// 2026-07-10 — 라우트별 page_view 를 받아 (date_key, visitor_hash)는 일별 순방문으로 유지하고
//   page_views 는 매 페이지뷰마다 증가. preview/admin/internal 트래픽은 제외.
// 익명 vid 를 서버에서 sha256 해시해 저장한다.
// PII 없음(원시 vid 미저장), 실패해도 200(사용자 경험 무영향·best-effort).
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/admin-auth';
import {
  clientIpFromHeaders,
  shouldSkipVisitAnalytics,
} from '@/lib/analytics/visit-filters';
import { sanitizePath, sanitizeQuery } from '@/components/analytics/ga-sanitize';
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

function normalizeVisitPath(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().slice(0, 240) : '/';
  try {
    const url = new URL(raw || '/', 'https://ganjisaju.kr');
    return sanitizePath(url.pathname) + sanitizeQuery(url.search);
  } catch {
    const [pathname = '/'] = (raw || '/').split('?');
    return sanitizePath(pathname || '/');
  }
}

function isMissingRpc(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === 'PGRST202' || /function .*track_site_visit_pageview/i.test(message);
}

interface ExistingVisitRow {
  page_views: number | string | null;
  user_id: string | null;
  first_path: string | null;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

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

  const path = normalizeVisitPath(data.path);
  const skipReason = shouldSkipVisitAnalytics({
    path,
    host: req.headers.get('host'),
    deploymentEnv: process.env.VERCEL_ENV,
    clientIp: clientIpFromHeaders(req.headers),
    excludedIps: process.env.ANALYTICS_EXCLUDED_IPS,
    // 2026-07-10 — JS 를 실행해 비콘까지 쏘는 크롤러가 방문 지표를 오염시켰다.
    //   UA 는 서버만 볼 수 있으므로 여기서만 검사한다.
    userAgent: req.headers.get('user-agent'),
  });
  if (skipReason) return NextResponse.json({ ok: true, skipped: skipReason });

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

  // 로그인 사용자면 user_id 참조(선택 — 활동 지표와 교차분석용).
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    if (userId && (await isAdminUser(userId))) {
      return NextResponse.json({ ok: true, skipped: 'admin_user' });
    }
  } catch {
    userId = null;
  }

  const visitorHash = crypto.createHash('sha256').update(vid).digest('hex');
  const dateKey = kstDateKey();

  try {
    const service = await createServiceClient();
    const { error } = await service.rpc('track_site_visit_pageview', {
      p_date_key: dateKey,
      p_visitor_hash: visitorHash,
      p_user_id: userId,
      p_first_path: path,
      p_referrer_host: refHost,
      p_utm_source: utmSource,
      p_utm_medium: utmMedium,
      p_utm_campaign: utmCampaign,
    });
    if (!error) return NextResponse.json({ ok: true });
    if (!isMissingRpc(error)) {
      console.error('[visit] rpc failed:', error.message);
      return NextResponse.json({ ok: true, skipped: 'rpc_failed' });
    }

    // DB migration(068) 적용 전 배포 안전장치: service-role read/update 로 page_views 증가.
    // 동시성은 RPC보다 약하지만, migration 전에도 운영 지표가 멈추지 않게 한다.
    const { data: existing, error: selectErr } = await service
      .from('site_visits')
      .select('page_views, user_id, first_path, referrer_host, utm_source, utm_medium, utm_campaign')
      .eq('date_key', dateKey)
      .eq('visitor_hash', visitorHash)
      .maybeSingle<ExistingVisitRow>();

    if (selectErr) {
      console.error('[visit] fallback select failed:', selectErr.message);
      return NextResponse.json({ ok: true, skipped: 'fallback_select_failed' });
    }

    if (existing) {
      const currentPageViews = Number(existing.page_views ?? 0);
      const { error: updateErr } = await service
        .from('site_visits')
        .update({
          page_views: (Number.isFinite(currentPageViews) ? Math.max(1, currentPageViews) : 1) + 1,
          user_id: existing.user_id ?? userId,
          first_path: existing.first_path ?? path,
          referrer_host: existing.referrer_host ?? refHost,
          utm_source: existing.utm_source ?? utmSource,
          utm_medium: existing.utm_medium ?? utmMedium,
          utm_campaign: existing.utm_campaign ?? utmCampaign,
        })
        .eq('date_key', dateKey)
        .eq('visitor_hash', visitorHash);
      if (updateErr) console.error('[visit] fallback update failed:', updateErr.message);
    } else {
      const { error: insertErr } = await service.from('site_visits').insert({
        date_key: dateKey,
        visitor_hash: visitorHash,
        user_id: userId,
        first_path: path,
        referrer_host: refHost,
        page_views: 1,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
      });
      if (insertErr) console.error('[visit] fallback insert failed:', insertErr.message);
    }
  } catch (err) {
    console.error('[visit] unexpected failure:', err);
  }

  return NextResponse.json({ ok: true });
}
