// 2026-08-26 — GET /api/admin/analytics/ga-health (super_admin 전용).
//
// 왜: GA4 서버 전송(Measurement Protocol)은 **성공도 실패도 204** 로 응답한다. 파라미터가
//   틀려도 조용히 삼켜지므로, 실결제로는 "왜 GA4에 안 뜨지"를 영원히 못 찾는다. GA4가 제공하는
//   /debug/mp/collect 로 같은 페이로드를 검증해 validationMessages 를 직접 본다
//   (계측 설계 문서 09번 4단계).
//
// 안전: 돈이 움직이지 않는다. debug 엔드포인트는 **실제 집계에 반영되지 않는** 검증 전용이다.
//   API 비밀번호 값은 절대 반환하지 않는다 — 설정 여부와 길이만 알린다.
import { NextResponse } from 'next/server';
import { createClient, createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { GA4_API_SECRET, GA4_MEASUREMENT_ID, hasGa4ServerEnv } from '@/lib/analytics/ga-config';
import { sendGaPurchase } from '@/lib/analytics/ga-server';

export const dynamic = 'force-dynamic';

/** 미전송 감시 — 확정됐는데 GA로 안 나간 주문. 문서 10번 '웹훅 지연 > 72시간' 대응. */
async function countPendingGaPurchases() {
  if (!hasSupabaseServiceEnv) return { available: false as const };
  try {
    const service = await createServiceClient();
    const { count, error } = await service
      .from('payment_orders')
      .select('order_id', { count: 'exact', head: true })
      .in('status', ['confirmed', 'fulfilling', 'fulfilled'])
      .is('ga_purchase_sent_at', null);
    if (error) return { available: true as const, error: error.message };
    return { available: true as const, pending: count ?? 0 };
  } catch (err) {
    return { available: true as const, error: err instanceof Error ? err.message : 'unknown' };
  }
}

export async function GET() {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);

  if (!check.ok || !check.role) {
    return NextResponse.json(
      { ok: false, error: check.reason ?? 'forbidden' },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }
  if (check.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const config = {
    measurementIdSet: Boolean(GA4_MEASUREMENT_ID),
    // 측정 ID 는 브라우저에도 노출되는 공개 값이라 그대로 보여준다(오탈자 확인용).
    measurementId: GA4_MEASUREMENT_ID,
    apiSecretSet: Boolean(GA4_API_SECRET),
    // 값이 아니라 길이만 — 복사 과정에서 잘렸는지/공백이 붙었는지 판별용.
    apiSecretLength: GA4_API_SECRET?.length ?? 0,
    ready: hasGa4ServerEnv,
  };

  if (!hasGa4ServerEnv) {
    return NextResponse.json({
      ok: false,
      config,
      hint: 'GA4_MEASUREMENT_ID / GA4_API_SECRET 을 등록하고 재배포해야 합니다(빌드 시점에 굽힘).',
    });
  }

  // 실제 전송과 **같은 빌더**를 태워 검증한다 — 검증용 페이로드를 따로 만들면
  // 진짜 페이로드의 결함을 못 잡는다.
  const validation = await sendGaPurchase(
    {
      clientId: '555555555.1700000000',
      sessionId: String(Math.floor(Date.now() / 1000)),
      userId: null,
      transactionId: 'ga-health-probe',
      value: 9900,
      paymentMethod: 'card',
      productType: 'bundle_comprehensive',
      isFirstPurchase: true,
      items: [
        {
          itemId: 'bundle_comprehensive',
          itemName: '종합 리포트',
          itemCategory: 'bundle',
          price: 9900,
          quantity: 1,
        },
      ],
    },
    { debug: true }
  );

  const messages =
    validation.sent && validation.debug && typeof validation.debug === 'object'
      ? ((validation.debug as { validationMessages?: unknown[] }).validationMessages ?? [])
      : null;

  return NextResponse.json({
    ok: Array.isArray(messages) && messages.length === 0,
    config,
    validation,
    // 합격 기준: validationMessages 가 빈 배열(문서 09번 4단계).
    verdict:
      messages == null
        ? 'debug 응답을 읽지 못했습니다(네트워크 또는 인증 실패).'
        : messages.length === 0
          ? '페이로드 정상 — 실결제 관통 테스트로 넘어가도 됩니다.'
          : '페이로드에 문제가 있습니다. validation.debug.validationMessages 참조.',
    pendingGaPurchases: await countPendingGaPurchases(),
  });
}
