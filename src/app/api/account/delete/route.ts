// 2026-05-14: 회원탈퇴 API.
// 인증된 사용자의 auth.users 레코드를 service-role 키로 삭제한다.
// 모든 관련 테이블(user_credits/credit_transactions/subscriptions/
// notification_preferences/push_subscriptions/product_entitlements 등)은
// ON DELETE CASCADE 또는 SET NULL 로 정합성이 유지된다.
// 결제내역(readings 등)은 SET NULL 로 익명화되어 보관된다.

import { NextRequest, NextResponse } from 'next/server';
import {
  createClient,
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

const ALLOWED_REASONS = new Set([
  'not-use',
  'price',
  'accuracy',
  'ui',
  'duplicate',
  'privacy',
  'other',
]);

type DeletePayload = {
  reason?: unknown;
  otherReason?: unknown;
  confirm?: unknown;
};

export async function POST(req: NextRequest) {
  if (!hasSupabaseServiceEnv) {
    return NextResponse.json(
      { error: '탈퇴 처리에 필요한 서버 설정이 누락되었습니다.' },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as DeletePayload | null;
  if (!payload) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const reason = typeof payload.reason === 'string' ? payload.reason : '';
  const otherReason =
    typeof payload.otherReason === 'string' ? payload.otherReason.trim() : '';
  const confirm = typeof payload.confirm === 'string' ? payload.confirm : '';

  if (!ALLOWED_REASONS.has(reason)) {
    return NextResponse.json({ error: '탈퇴 사유를 선택해주세요.' }, { status: 400 });
  }
  if (reason === 'other' && otherReason.length === 0) {
    return NextResponse.json(
      { error: '기타 사유를 입력해주세요.' },
      { status: 400 }
    );
  }
  if (confirm !== '탈퇴합니다') {
    return NextResponse.json(
      { error: '확인 문구가 올바르지 않습니다.' },
      { status: 400 }
    );
  }

  const admin = await createServiceClient();
  const userId = user.id;

  // 최선의 정리: 명시적으로 비-cascade 흔적도 비활성화한 뒤 사용자 레코드 삭제.
  // 각각의 실패는 무시(테이블 존재/권한 차이에 강건)하고 핵심 삭제는 마지막 단계에서 강행한다.
  await admin
    .from('push_subscriptions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .then(undefined, () => undefined);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

  if (deleteError) {
    return NextResponse.json(
      {
        error:
          deleteError.message ||
          '계정을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.',
      },
      { status: 500 }
    );
  }

  // 사용자 쿠키 세션 해제(이미 삭제된 사용자이므로 best-effort).
  await supabase.auth.signOut().catch(() => undefined);

  return NextResponse.json({
    success: true,
    reason,
    otherReason: reason === 'other' ? otherReason : undefined,
    deletedAt: new Date().toISOString(),
  });
}
