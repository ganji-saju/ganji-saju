import { NextResponse } from 'next/server';
import { createClient, hasSupabaseServerEnv } from '@/lib/supabase/server';

type VerificationAccessStatus = 'allowed' | 'unauthenticated' | 'forbidden';

function getAllowedVerificationEmails() {
  const raw = process.env.INTERNAL_VERIFICATION_EMAILS ?? '';

  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

// 2026-06-21 보안(P1) — fail-open 제거. 허용목록/Supabase env 누락 시 프로덕션은
// default-deny. dev/preview 는 로컬 검증 페이지 편의를 위해 허용 유지.
function isProductionDeploy(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

/**
 * 순수 판정(테스트 대상). 허용목록이 비어 있으면 프로덕션은 차단(fail-closed),
 * 비프로덕션은 허용. 허용목록이 있으면 email 일치 여부로 판정.
 */
export function isVerificationEmailAllowed(
  email: string | null | undefined,
  opts: { allowlist: readonly string[]; isProduction: boolean }
): boolean {
  if (opts.allowlist.length === 0) {
    return !opts.isProduction;
  }

  return email ? opts.allowlist.includes(email.toLowerCase()) : false;
}

function isAllowedVerificationEmail(email: string | null | undefined) {
  return isVerificationEmailAllowed(email, {
    allowlist: getAllowedVerificationEmails(),
    isProduction: isProductionDeploy(),
  });
}

export async function getVerificationAccessStatus(): Promise<{
  status: VerificationAccessStatus;
  email: string | null;
}> {
  if (!hasSupabaseServerEnv) {
    // Supabase env 부재는 정상 프로덕션에선 발생하지 않음 — 발생 시 fail-closed.
    return {
      status: isProductionDeploy() ? 'forbidden' : 'allowed',
      email: null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: 'unauthenticated',
      email: null,
    };
  }

  if (!isAllowedVerificationEmail(user.email)) {
    return {
      status: 'forbidden',
      email: user.email ?? null,
    };
  }

  return {
    status: 'allowed',
    email: user.email ?? null,
  };
}

export async function requireVerificationApiAccess() {
  const access = await getVerificationAccessStatus();

  if (access.status === 'allowed') {
    return null;
  }

  if (access.status === 'unauthenticated') {
    return NextResponse.json(
      {
        error: '로그인 후 내부 검증 데이터를 확인해 주세요.',
      },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      error: '이 검증 데이터는 내부 계정으로만 확인할 수 있습니다.',
    },
    { status: 404 }
  );
}
