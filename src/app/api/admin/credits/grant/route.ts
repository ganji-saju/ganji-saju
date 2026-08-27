// 2026-06-28 — POST /api/admin/credits/grant. 어드민 수동 전 지급.
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

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);
  if (!check.ok || !check.userId || !check.role) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }
  // 전 지급은 super_admin 만(환불 승인과 동일 등급).
  if (check.role !== 'super_admin') {
    return NextResponse.json(
      { ok: false, error: "super_admin 만 전을 지급할 수 있습니다." },
      { status: 403 }
    );
  }

  // 2026-08-26 사용자 지시 — 전 sunset 가드 제거. sunset(COIN_TOPUP_ENABLED=false)은
  //   **판매 중단**이지 '지급 불가'가 아니다. 두 개를 한 플래그로 묶어 두는 바람에 운영상
  //   보상 지급(장애 사과·오지급 정정)까지 막혀 있었다.
  //   게다가 계약이 이미 어긋나 있었다: 대화상담 질문 3회(taste_dialogue_entry) 결제는
  //   fulfillment 가 addCredits(...,'purchase') 로 **전을 실제로 발행한다**. 상품은 발행하는데
  //   관리자만 못 주는 상태였다.
  //   판매 경로(prepare 의 isCreditPackage 차단)는 그대로 둔다 — 막는 건 '전 충전 상품 판매'다.

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
    const message = err instanceof Error ? err.message : '전 지급에 실패했습니다.';
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
