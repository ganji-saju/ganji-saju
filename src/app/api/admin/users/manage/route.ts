// 2026-07-04 — 관리자 계정 관리: 이용정지/해제 · 정보수정(이름/전화번호) · 계정 삭제.
// 전부 super_admin 전용 + logAdminAccess 감사 + 요약 즉시 갱신.
// 삭제는 확인 문구(대상 이메일) 일치 필수 + 본인 계정 삭제/정지 금지.
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { logAdminAccess } from '@/lib/admin/access-log';
import { refreshAdminUserSummaryForUser } from '@/lib/admin/summary-refresh';
import { normalizeKoreanMobile } from '@/lib/kakao/phone';

export const dynamic = 'force-dynamic';

// 사실상 무기한 정지(10년). Supabase ban 은 신규 토큰 발급 차단 — 기존 액세스 토큰은
// 만료(기본 1시간)까지 유효할 수 있음.
const BAN_DURATION = '87600h';

type ManageAction = 'ban' | 'unban' | 'update_info' | 'delete';

interface ManagePayload {
  action?: ManageAction;
  userId?: string;
  displayName?: string;
  phone?: string;
  confirmEmail?: string;
  reason?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);
  if (!check.ok) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }
  if (check.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'super_admin 전용 기능입니다.' }, { status: 403 });
  }
  if (!hasSupabaseServiceEnv) {
    return NextResponse.json({ ok: false, error: 'service env missing' }, { status: 500 });
  }

  const payload = ((await req.json().catch(() => null)) ?? {}) as ManagePayload;
  const action = payload.action;
  const userId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
  const reason = typeof payload.reason === 'string' ? payload.reason.trim().slice(0, 300) : '';

  if (!userId || !action) {
    return NextResponse.json({ ok: false, error: 'userId/action 이 필요합니다.' }, { status: 400 });
  }
  // 실수로 관리자 본인 계정을 정지/삭제하는 사고 방지.
  if ((action === 'ban' || action === 'delete') && check.userId === userId) {
    return NextResponse.json(
      { ok: false, error: '본인 계정에는 실행할 수 없습니다.' },
      { status: 400 }
    );
  }

  const service = await createServiceClient();
  const { data: targetData, error: targetError } = await service.auth.admin.getUserById(userId);
  if (targetError || !targetData.user) {
    return NextResponse.json({ ok: false, error: '대상 사용자를 찾지 못했습니다.' }, { status: 404 });
  }
  const target = targetData.user;

  const audit = async (adminAction: 'ban_user' | 'unban_user' | 'update_user_info' | 'delete_user', meta?: Record<string, unknown>) => {
    if (!check.userId) return;
    await logAdminAccess({
      actorId: check.userId,
      actorRole: check.role ?? 'admin',
      action: adminAction,
      targetUser: userId,
      reason: reason || null,
      meta,
    }).catch(() => undefined);
  };

  if (action === 'ban' || action === 'unban') {
    const { error } = await service.auth.admin.updateUserById(userId, {
      ban_duration: action === 'ban' ? BAN_DURATION : 'none',
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    await audit(action === 'ban' ? 'ban_user' : 'unban_user');
    await refreshAdminUserSummaryForUser(userId).catch(() => undefined);
    return NextResponse.json({ ok: true, action });
  }

  if (action === 'update_info') {
    const updates: string[] = [];

    const displayName =
      typeof payload.displayName === 'string' ? payload.displayName.trim().slice(0, 40) : null;
    if (displayName) {
      // 프로필 행이 있을 때만 갱신(행 자체는 온보딩 산출물 — 없는데 만들면 생년 not-null 등과 충돌).
      const { data: profileRow } = await service
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (!profileRow) {
        return NextResponse.json(
          { ok: false, error: '프로필이 아직 없어 이름을 수정할 수 없습니다(사용자가 기본정보 저장 후 가능).' },
          { status: 400 }
        );
      }
      const { error } = await service
        .from('profiles')
        .update({ display_name: displayName })
        .eq('user_id', userId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      updates.push('displayName');
    }

    if (typeof payload.phone === 'string') {
      const raw = payload.phone.trim();
      if (raw === '') {
        // 빈 문자열 = 번호 삭제 요청.
        const { error } = await service
          .from('user_contact')
          .update({ phone: null })
          .eq('user_id', userId);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        updates.push('phone:cleared');
      } else {
        const phone = normalizeKoreanMobile(raw);
        if (!phone) {
          return NextResponse.json(
            { ok: false, error: '휴대폰 번호 형식을 확인해 주세요 (010-0000-0000).' },
            { status: 400 }
          );
        }
        // ad_consent 는 사용자 본인 동의 값 — 관리자 수정으로 건드리지 않음(신규 행만 false).
        const { data: existing } = await service
          .from('user_contact')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();
        const { error } = existing
          ? await service.from('user_contact').update({ phone }).eq('user_id', userId)
          : await service
              .from('user_contact')
              .insert({ user_id: userId, phone, ad_consent: false });
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        updates.push('phone');
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ ok: false, error: '수정할 항목이 없습니다.' }, { status: 400 });
    }
    await audit('update_user_info', { updates });
    await refreshAdminUserSummaryForUser(userId).catch(() => undefined);
    return NextResponse.json({ ok: true, action, updates });
  }

  if (action === 'delete') {
    // 확인 문구 = 대상 이메일 정확 일치(이메일 없으면 사용자 UUID).
    const expected = target.email ?? userId;
    if ((payload.confirmEmail ?? '').trim() !== expected) {
      return NextResponse.json(
        { ok: false, error: '확인 문구가 일치하지 않습니다(대상 이메일을 정확히 입력).' },
        { status: 400 }
      );
    }
    // 계정 자가삭제(/api/account/delete)와 동일 절차: 비-cascade 흔적 정리 후 auth 삭제.
    await service
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .then(undefined, () => undefined);
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    // 요약 행 즉시 제거(다음 배치까지 유령 행 방지).
    await service
      .from('admin_user_summary')
      .delete()
      .eq('user_id', userId)
      .then(undefined, () => undefined);
    await audit('delete_user', { email: target.email ?? null });
    return NextResponse.json({ ok: true, action });
  }

  return NextResponse.json({ ok: false, error: '알 수 없는 action 입니다.' }, { status: 400 });
}
