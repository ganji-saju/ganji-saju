'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import LegalLinks from '@/components/legal-links';

const CANONICAL_SITE_ORIGIN = 'https://ganji-saju.vercel.app';

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function isLocalOrigin(url: URL) {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

function shouldUseCanonicalOrigin(url: URL) {
  return (
    url.hostname.endsWith('.vercel.app') &&
    url.origin !== CANONICAL_SITE_ORIGIN
  );
}

function getRedirectOrigin() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (configuredUrl?.startsWith('http')) {
    try {
      const url = new URL(configuredUrl);
      if (!url.hostname.endsWith('.supabase.co')) return url.origin;
    } catch {
      // Fall back to the browser origin below.
    }
  }

  try {
    const browserUrl = new URL(location.origin);
    if (isLocalOrigin(browserUrl)) return browserUrl.origin;
    if (shouldUseCanonicalOrigin(browserUrl)) return CANONICAL_SITE_ORIGIN;
    return browserUrl.origin;
  } catch {
    return CANONICAL_SITE_ORIGIN;
  }
}

function getProviderLabel(value: string | null) {
  if (value === 'google') return 'Google';
  if (value === 'kakao') return '카카오';
  return '소셜';
}

function getOAuthLoginError(error: string | null, provider: string | null, reason: string | null) {
  const providerLabel = getProviderLabel(provider);

  if (error === 'oauth_config') {
    return '로그인 환경변수가 비어 있습니다. Supabase URL과 공개 키를 운영 환경에 설정해 주세요.';
  }

  if (error === 'oauth_provider') {
    return `${providerLabel} 로그인 제공자 설정이 아직 완료되지 않았습니다. Supabase Provider와 ${providerLabel} 개발자 콘솔의 콜백 주소를 확인해 주세요.`;
  }

  if (error === 'oauth_exchange') {
    return `${providerLabel} 로그인 세션 연결이 완료되지 않았습니다. 브라우저 쿠키 허용과 Supabase Redirect URL 설정을 확인해 주세요.${reason ? ` (${reason})` : ''}`;
  }

  if (error === 'oauth') {
    return `${providerLabel} 로그인 연결이 완료되지 않았습니다. Provider 설정과 리다이렉트 주소를 확인해 주세요.`;
  }

  return '';
}

function getEmailLoginError(message?: string) {
  if (!message) return '로그인 링크를 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.';

  if (message.toLowerCase().includes('email')) {
    return '이메일 형식이나 Supabase Email Auth 설정을 확인해 주세요.';
  }

  if (message.toLowerCase().includes('rate')) {
    return '로그인 링크 요청이 너무 잦습니다. 잠시 뒤 다시 시도해 주세요.';
  }

  return message;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const next = getSafeNext(searchParams.get('next'));
  const callbackError = searchParams.get('error');
  const callbackProvider = searchParams.get('provider');
  const callbackReason = searchParams.get('reason');
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState(
    getOAuthLoginError(callbackError, callbackProvider, callbackReason)
  );
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

  async function signInWithProvider(provider: 'google' | 'kakao') {
    if (!hasSupabaseBrowserEnv) {
      setErrorMessage('Supabase 환경변수가 없어 로컬에서는 로그인을 사용할 수 없습니다.');
      setStatusMessage('');
      return;
    }

    setErrorMessage('');
    setStatusMessage('');
    const supabase = createClient();
    const providerLabel = provider === 'google' ? 'Google' : '카카오';

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${getRedirectOrigin()}/api/auth/callback?provider=${provider}&next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setErrorMessage(`${providerLabel} 로그인 설정을 확인해 주세요. ${error.message}`);
    }
  }

  async function requestEmailLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseBrowserEnv) {
      setErrorMessage('Supabase 환경변수가 없어 로컬에서는 로그인 링크를 보낼 수 없습니다.');
      setStatusMessage('');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail.includes('@')) {
      setErrorMessage('로그인에 사용할 이메일 주소를 입력해 주세요.');
      setStatusMessage('');
      return;
    }

    setIsSubmittingEmail(true);
    setErrorMessage('');
    setStatusMessage('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: `${getRedirectOrigin()}/api/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: true,
      },
    });

    setIsSubmittingEmail(false);

    if (error) {
      setErrorMessage(getEmailLoginError(error.message));
      return;
    }

    setStatusMessage('가입/로그인 링크를 보냈습니다. 메일함에서 달빛인생 링크를 열어 주세요.');
  }

  return (
    <div className="app-panel w-full max-w-md p-7 text-center sm:p-8">
      <div className="mb-2">
        <div className="app-caption mb-3">연락처로 간편 로그인</div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--app-ink)]">
          달빛인생 로그인
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--app-copy-muted)]">
          {hasSupabaseBrowserEnv
            ? '무료 운세를 보고, 마음에 드는 풀이를 저장하려면 로그인하세요.'
            : '로컬 환경에서는 Supabase 설정 후 로그인을 사용할 수 있습니다.'}
        </p>
      </div>

      <form className="mt-6 space-y-3 text-left" onSubmit={requestEmailLink}>
        <label
          className="text-xs font-medium text-[var(--app-copy-muted)]"
          htmlFor="login-email"
        >
          이메일 주소
        </label>
        <div className="flex gap-2 rounded-2xl border border-[var(--app-line-strong)] bg-[var(--app-pink-soft)] p-2 focus-within:border-[var(--app-pink)]/70">
          <span className="inline-flex h-11 items-center rounded-xl bg-white px-3 text-sm text-[var(--app-pink-strong)]">
            MAIL
          </span>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-base text-[var(--app-ink)] outline-none placeholder:text-[var(--app-copy-soft)]"
          />
        </div>
        <Button
          type="submit"
          disabled={isSubmittingEmail || !hasSupabaseBrowserEnv}
          className="h-11 w-full rounded-2xl"
        >
          {isSubmittingEmail ? '링크 보내는 중...' : '가입/로그인 링크 받기'}
        </Button>
      </form>

      <section className="mt-4 rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4 text-left">
        <div className="text-sm font-medium text-[var(--app-ink)]">휴대폰 인증은 준비 중입니다</div>
        <p className="mt-2 text-xs leading-6 text-[var(--app-copy-muted)]">
          SMS provider 연동 전까지는 이메일 링크로 가입/로그인을 진행합니다.
        </p>
        {/*
          TODO(phone-auth): Supabase Auth Phone provider와 SMS provider가 준비되면
          이 안내 영역을 실제 휴대폰 OTP 폼으로 교체합니다.

          구현 시 필요한 흐름:
          1. 입력값을 E.164 형식으로 정규화합니다. 예: 010-1234-5678 -> +821012345678
          2. supabase.auth.signInWithOtp({
               phone: normalizedPhone,
               options: { channel: 'sms', shouldCreateUser: true },
             })
          3. 사용자가 받은 인증번호로 supabase.auth.verifyOtp({
               phone: normalizedPhone,
               token,
               type: 'sms',
             })
          4. 성공 후 router.replace(next) 또는 router.refresh()로 보호 페이지를 갱신합니다.
        */}
      </section>

      {statusMessage ? (
        <p className="mt-4 rounded-2xl border border-[var(--app-jade)]/30 bg-[var(--app-jade)]/10 px-4 py-3 text-left text-xs leading-6 text-[var(--app-ink)]">
          {statusMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-2xl border border-[var(--app-coral)]/30 bg-[var(--app-coral)]/10 px-4 py-3 text-left text-xs leading-6 text-[var(--app-ink)]">
          {errorMessage}
        </p>
      ) : null}

      <div className="my-6 flex items-center gap-3 text-xs text-[var(--app-copy-soft)]">
        <span className="h-px flex-1 bg-[var(--app-line)]" />
        다른 방식으로 계속하기
        <span className="h-px flex-1 bg-[var(--app-line)]" />
      </div>

      <div className="space-y-3">
        <Button
          onClick={() => signInWithProvider('kakao')}
          disabled={!hasSupabaseBrowserEnv}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-2xl font-medium"
          style={{ backgroundColor: '#FEE500', color: '#191919' }}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#191919">
            <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.709 1.6 5.09 4.008 6.535l-.96 3.584a.3.3 0 0 0 .448.328L9.74 19.05A11.6 11.6 0 0 0 12 19.2c5.523 0 10-3.358 10-7.5S17.523 3 12 3z" />
          </svg>
          카카오로 계속하기
        </Button>

        <Button
          onClick={() => signInWithProvider('google')}
          disabled={!hasSupabaseBrowserEnv}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-2xl border border-[var(--app-line)] bg-white text-slate-900 hover:bg-[var(--app-pink-soft)]"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google로 계속하기
        </Button>
      </div>

      <p className="pt-4 text-xs leading-6 text-[var(--app-copy-soft)]">
        로그인 시 <LegalLinks className="text-[var(--app-copy-muted)]" />에 동의합니다.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="app-shell flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10 text-[var(--app-ink)]">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-pink)] text-xl font-black text-white shadow-[0_16px_32px_rgba(216,27,114,0.22)]">
          달
        </div>
        <div className="font-[var(--font-heading)] text-lg font-semibold text-[var(--app-ink)]">달빛인생</div>
        <div className="text-xs text-[var(--app-copy-muted)]">오늘운세 · 타로 · 사주</div>
      </div>
      <Suspense fallback={<div className="text-[var(--app-copy-muted)]">로딩중...</div>}>
        <LoginContent />
      </Suspense>
    </main>
  );
}
