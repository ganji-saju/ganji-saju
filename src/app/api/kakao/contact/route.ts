// 카카오 알림톡용 전화번호 + 광고 수신동의 저장/조회 (본인만).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserContact, upsertUserContact, normalizeKoreanMobile } from '@/lib/kakao/contact';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const contact = await getUserContact(user.id);
  return NextResponse.json({
    ok: true,
    phone: contact?.phone ?? null,
    adConsent: contact?.adConsent ?? false,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  const data = (body ?? {}) as Record<string, unknown>;
  const rawPhone = typeof data.phone === 'string' ? data.phone : '';
  const wantsAdConsent = data.adConsent === true;

  // 빈 값이면 번호 삭제(null), 있으면 국내 휴대폰 정규화 검증.
  let phone: string | null = null;
  if (rawPhone.trim()) {
    phone = normalizeKoreanMobile(rawPhone);
    if (!phone) {
      return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
    }
  }

  // 광고 수신동의는 전화번호가 있어야 의미가 있으므로 번호 없으면 강제 false.
  const adConsent = phone ? wantsAdConsent : false;
  const result = await upsertUserContact(user.id, { phone, adConsent });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, phone, adConsent });
}
