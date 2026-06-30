// 2026-06-30 — POST /api/admin/lifetime-report/grant
// super_admin이 특정 유저의 사주 결과에 평생리포트 권한을 수동 부여.
// 결제 없음(amount:0). 멱등(이미 보유 시 ok:true 그대로 반환).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { getReadingById } from '@/lib/saju/readings';
import { toSlug } from '@/lib/saju/pillars';
import { grantLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { logAdminAccess } from '@/lib/admin/access-log';
import { refreshAdminUserSummaryForUser } from '@/lib/admin/summary-refresh';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);

  if (!check.ok || !check.userId || !check.role) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  if (check.role !== 'super_admin') {
    return NextResponse.json(
      { ok: false, error: 'super_admin 만 평생 리포트 권한을 부여할 수 있습니다.' },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  const readingId = typeof body?.readingId === 'string' ? body.readingId.trim() : '';
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

  if (!userId || !readingId) {
    return NextResponse.json(
      { ok: false, error: 'userId 와 readingId 가 필요합니다.' },
      { status: 400 }
    );
  }

  // reading 조회
  const reading = await getReadingById(readingId);
  if (!reading) {
    return NextResponse.json(
      { ok: false, error: '사주 결과를 찾지 못했습니다.' },
      { status: 404 }
    );
  }

  // 소유자 검증 — 타인 결과에 부여 차단
  if (reading.userId !== userId) {
    return NextResponse.json(
      { ok: false, error: '해당 유저의 결과가 아닙니다.' },
      { status: 403 }
    );
  }

  const readingKey = toSlug(reading.input);

  let ent: Awaited<ReturnType<typeof grantLifetimeReportEntitlement>>;
  try {
    ent = await grantLifetimeReportEntitlement(userId, readingKey, { amount: 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '평생 리포트 권한 부여에 실패했습니다.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  await logAdminAccess({
    actorId: check.userId,
    actorRole: check.role,
    action: 'grant_lifetime_report',
    targetUser: userId,
    reason: reason || null,
    meta: {
      readingId,
      readingKey,
      entitlementId: ent?.id ?? null,
    },
  });

  // 사용자조회(요약 캐시) 즉시 반영 — 실패해도 무시.
  await refreshAdminUserSummaryForUser(userId).catch(() => {});

  return NextResponse.json({
    ok: true,
    readingKey,
    entitlementId: ent?.id ?? null,
  });
}
