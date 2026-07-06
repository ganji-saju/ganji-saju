// 2026-07-07 — metrics_daily 롤업. Vercel Cron(매시, CRON_SECRET)은 최근 3일 재집계
//   (오늘 신선·어제 확정). super_admin 수동 호출은 ?backfill=N 또는 ?from=&to= 로 과거
//   구간을 백필(최초 1회). 집계는 service 클라이언트(대상 테이블 RLS deny-all).
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createClient, createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import {
  runDailyMetricsRollup,
  recentKstDateKeys,
  dateAxis,
  shiftDateKey,
} from '@/lib/admin/analytics-rollup';

export const runtime = 'nodejs';
export const maxDuration = 300;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? null;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  if (!header) return false;
  return safeEqual(header, `Bearer ${secret}`);
}

/** 호출 파라미터 → 집계 대상 KST 날짜키. 기본은 최근 3일(크론). */
function resolveDateKeys(req: NextRequest): string[] {
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  if (from && to && DATE_RE.test(from) && DATE_RE.test(to) && from <= to) {
    // 최대 400일로 캡(폭주 방지). from 을 to-399 이상으로 당겨 dateAxis 내부 상한(1830일)에
    //   초장기 span 이 걸려 to 근처가 아닌 엉뚱한 구간을 반환하는 것을 방지.
    const floor = shiftDateKey(to, -399);
    const clampedFrom = from < floor ? floor : from;
    return dateAxis(clampedFrom, to);
  }
  const backfill = parseInt(sp.get('backfill') ?? '', 10);
  if (Number.isFinite(backfill) && backfill > 0) {
    return recentKstDateKeys(Math.min(400, backfill));
  }
  return recentKstDateKeys(3);
}

async function handle(req: NextRequest) {
  const cron = isCronAuthorized(req);

  if (!cron) {
    // 수동 호출은 super_admin 만.
    const supabase = await createClient();
    const check = await getCurrentAdminRole(supabase);
    if (!check.ok) {
      return NextResponse.json(
        { ok: false, error: check.reason },
        { status: check.reason === 'unauthenticated' ? 401 : 403 }
      );
    }
    if (check.role !== 'super_admin') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
  }

  if (!hasSupabaseServiceEnv) {
    return NextResponse.json(
      { ok: false, error: 'service env missing (SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 500 }
    );
  }

  // 크론은 항상 최근 3일(파라미터 무시), 수동은 파라미터 허용.
  const now = new Date();
  const dateKeys = cron
    ? recentKstDateKeys(3, now)
    : resolveDateKeys(req);

  try {
    const service = await createServiceClient();
    const result = await runDailyMetricsRollup(service, { dateKeys, now });
    return NextResponse.json({ ok: true, trigger: cron ? 'cron' : 'manual', ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'rollup failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
