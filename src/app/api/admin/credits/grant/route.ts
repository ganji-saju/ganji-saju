// 2026-06-28 — POST /api/admin/credits/grant. 어드민 수동 코인 지급.
//   super_admin 전용(금전가치 부여 = 환불 승인급 민감 작업).
//   addCredits RPC 호출(purchase=1년 만료 lot / subscription=무만료) + admin_access_log 기록.
//   회수/차감은 이 라우트가 아니라 deduct_credits(revokeCredits) 경로.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { addCredits, getCredits } from '@/lib/credits/deduct';
import { logAdminAccess } from '@/lib/admin/access-log';
import { validateGrantCredits } from '@/lib/admin/grant-credits';
import { refreshAdminUserSummaryForUser } from '@/lib/admin/summary-refresh';
import { COIN_TOPUP_ENABLED } from '@/lib/payments/coin-sunset';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);
  if (!check.ok || !check.userId || !check.role) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }
  // 코인 지급은 super_admin 만(환불 승인과 동일 등급).
  if (check.role !== 'super_admin') {
    return NextResponse.json(
      { ok: false, error: "super_admin 만 코인을 지급할 수 있습니다." },
      { status: 403 }
    );
  }

  // 코인 sunset 가드: 신규 코인 발행이 전면 중단된 상태에서는 수동 지급도 불가.
  if (!COIN_TOPUP_ENABLED) {
    return NextResponse.json(
      { ok: false, error: '코인 발행이 중단되어 수동 코인 지급을 사용할 수 없습니다.' },
      { status: 410 }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const v = validateGrantCredits({
    userId: body?.userId,
    amount: body?.amount,
    type: body?.type,
    reason: body?.reason,
  });
  if (!v.ok || !v.value) {
    return NextResponse.json({ ok: false, error: v.errors.join(' / ') }, { status: 400 });
  }

  const { userId, amount, type, reason } = v.value;

  try {
    // ⚠️ paymentKey 는 절대 넣지 않는다 — 넣으면 멱등 가드로 조용히 스킵될 수 있음.
    await addCredits(userId, amount, type, {
      source: 'admin_manual_grant',
      reason,
      grantedBy: check.userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '코인 지급에 실패했습니다.';
    console.error('[admin-credit-grant] addCredits 실패', { userId, amount, type, message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  await logAdminAccess({
    actorId: check.userId,
    actorRole: check.role,
    action: 'grant_credit',
    targetUser: userId,
    reason,
    meta: { amount, type },
  });

  // 사용자조회(요약 캐시) 즉시 반영.
  await refreshAdminUserSummaryForUser(userId);

  // 지급 후 잔액 회신(만료 보정된 표시 잔액 + 구독 잔액).
  const credits = await getCredits(userId).catch(() => null);
  return NextResponse.json({
    ok: true,
    granted: amount,
    type,
    balance: credits ? credits.balance + credits.subscription_balance : null,
  });
}
