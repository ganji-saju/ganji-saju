import { NextRequest, NextResponse } from 'next/server';
import { hasCompatibilityAccess } from '@/lib/payments/compatibility-access';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// 2026-05-23 ① — 수동(바로 보기) 궁합은 생년월일이 클라이언트 세션에만 있어 서버 페이지가
//   per-couple 권한을 미리 알 수 없다. 클라이언트가 isomorphic 커플 키를 만들어 이 라우트로
//   접근 여부만 확인한다(coupleKey 는 해시 식별자라 PII 아님). 게이트는 grandfather 포함.
export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as { coupleKey?: unknown } | null;
  const coupleKey =
    payload && typeof payload.coupleKey === 'string' && payload.coupleKey.trim()
      ? payload.coupleKey.trim()
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: true, access: false });
  }

  const access = await hasCompatibilityAccess(user.id, coupleKey);
  return NextResponse.json({ ok: true, access });
}
