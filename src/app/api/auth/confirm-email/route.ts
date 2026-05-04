import { NextRequest, NextResponse } from 'next/server';
import {
  createServiceClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

function readEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isEmailConfirmed(user: { email_confirmed_at?: string | null; confirmed_at?: string | null }) {
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = readEmail(payload?.email);

  if (!email.includes('@')) {
    return NextResponse.json({ error: '이메일 주소를 확인해 주세요.' }, { status: 400 });
  }

  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) {
    return NextResponse.json(
      { error: '이메일 로그인 상태를 정리할 Supabase 서비스 키가 없습니다.' },
      { status: 500 }
    );
  }

  const service = await createServiceClient();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      return NextResponse.json(
        { error: `이메일 로그인 상태를 확인하지 못했습니다. ${error.message}` },
        { status: 500 }
      );
    }

    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) {
      if (isEmailConfirmed(user)) {
        return NextResponse.json({ success: true, alreadyConfirmed: true });
      }

      const { error: updateError } = await service.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });

      if (updateError) {
        return NextResponse.json(
          { error: `이메일 로그인 상태를 정리하지 못했습니다. ${updateError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, alreadyConfirmed: false });
    }

    if (data.users.length < 100) break;
    page += 1;
  }

  return NextResponse.json(
    { error: '가입된 이메일을 찾지 못했습니다. 이메일 주소를 다시 확인해 주세요.' },
    { status: 404 }
  );
}
