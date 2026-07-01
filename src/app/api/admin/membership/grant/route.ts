// 2026-06-28 — POST /api/admin/membership/grant. 어드민 멤버십 권한 변경(super_admin 전용).
//   action='grant': 프리미엄 멤버십 N일(기본 30) 활성화. action='revoke': 즉시 해제(cancelled).
//   addCredits 와 달리 전은 안 줌(멤버십 상태만). 결제 재화 지급은 재화 수동지급 별도.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import {
  activateMembershipSubscription,
  getManagedSubscription,
  updateSubscriptionStatus,
} from '@/lib/subscription';
import { logAdminAccess } from '@/lib/admin/access-log';
import { refreshAdminUserSummaryForUser } from '@/lib/admin/summary-refresh';

const MAX_DAYS = 400;

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
      { ok: false, error: 'super_admin 만 멤버십을 변경할 수 있습니다.' },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  const action = body?.action;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  const daysRaw = typeof body?.days === 'number' ? body.days : Number(body?.days);

  if (!userId) {
    return NextResponse.json({ ok: false, error: '대상 사용자가 필요합니다.' }, { status: 400 });
  }
  if (action !== 'grant' && action !== 'revoke') {
    return NextResponse.json({ ok: false, error: "action 은 'grant' 또는 'revoke' 여야 합니다." }, { status: 400 });
  }
  if (reason.length < 2) {
    return NextResponse.json({ ok: false, error: '변경 사유를 2자 이상 입력하세요.' }, { status: 400 });
  }
  const days = Number.isInteger(daysRaw) ? daysRaw : 30;
  if (action === 'grant' && (days <= 0 || days > MAX_DAYS)) {
    return NextResponse.json({ ok: false, error: `이용 일수는 1~${MAX_DAYS}일이어야 합니다.` }, { status: 400 });
  }

  try {
    if (action === 'grant') {
      await activateMembershipSubscription(userId, { plan: 'premium_monthly', days });
    } else {
      await updateSubscriptionStatus(userId, 'cancelled');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '멤버십 변경에 실패했습니다.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  await logAdminAccess({
    actorId: check.userId,
    actorRole: check.role,
    action: 'grant_membership',
    targetUser: userId,
    reason,
    meta: { membershipAction: action, days: action === 'grant' ? days : null },
  });

  // 사용자조회(요약 캐시) 즉시 반영.
  await refreshAdminUserSummaryForUser(userId);

  const sub = await getManagedSubscription(userId).catch(() => null);
  return NextResponse.json({
    ok: true,
    action,
    plan: sub?.plan ?? null,
    status: sub?.status ?? null,
    renewsAt: sub?.renewsAt ?? null,
  });
}
