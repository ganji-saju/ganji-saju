// 2026-07-10 — GET /api/admin/payments/nicepay-health (super_admin 전용).
//
// 왜: 2026-06-27 승인 4건이 나이스페이 "사용자 정보가 존재하지 않습니다." 로 실패했고,
//   그 뒤 12일간 승인 시도가 0건이라 현재 결제가 정상인지 알 수 없다. 실결제 없이
//   (1) 키 짝 정합성과 (2) 실제 Basic 인가 유효성을 확인한다.
//
// 안전: 돈이 움직이지 않는다(존재하지 않는 tid 조회 1회). secretKey 값은 반환하지 않는다.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { auditNicepayKeyPair } from '@/lib/payments/nicepay-config-audit';
import { probeNicepayCredentials } from '@/lib/payments/nicepay';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);

  if (!check.ok || !check.role) {
    return NextResponse.json(
      { ok: false, error: check.reason ?? 'forbidden' },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }
  // 자격증명 진단은 super_admin 만. admin 도 보면 안 되는 정보(키 출처·길이)가 섞인다.
  if (check.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const audit = auditNicepayKeyPair();
  const probe = await probeNicepayCredentials();

  // resultCode 해석은 콘솔 코드표로 확정할 것(⚠️ 검증필요). 여기서는 원문을 그대로 보여준다.
  // 판별 요령: "사용자 정보가 존재하지 않습니다." 류 → 인가 실패(키 짝 문제).
  //           "거래 정보 없음" 류 → 인가는 통과, tid 만 없는 정상 응답.
  return NextResponse.json({
    ok: true,
    audit,
    probe,
    hint:
      probe.resultMsg?.includes('사용자 정보') === true
        ? '인가 실패로 보입니다 — clientKey/secretKey 가 같은 가맹점 키인지 확인하세요.'
        : '인가는 통과한 것으로 보입니다(존재하지 않는 tid 에 대한 응답).',
  });
}
