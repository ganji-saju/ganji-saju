'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import LegalLinks from '@/components/legal-links';
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';

type ResetState = 'checking' | 'ready' | 'missing' | 'saved';

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/saju/new?autoProfile=1';
  }
  if (value.startsWith('/login')) return '/saju/new?autoProfile=1';
  return value;
}

function getResetError(message?: string) {
  const normalized = message?.toLowerCase() ?? '';
  if (!message) return '비밀번호를 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
  if (normalized.includes('session') || normalized.includes('expired')) {
    return '재설정 링크가 만료됐습니다. 아이디/비밀번호 찾기에서 링크를 다시 받아 주세요.';
  }
  if (normalized.includes('weak') || normalized.includes('password')) {
    return '새 비밀번호는 8자 이상으로 다시 입력해 주세요.';
  }
  return message;
}

async function waitForRecoverySession(supabase: ReturnType<typeof createClient>) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  return null;
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const next = useMemo(() => getSafeNext(searchParams.get('next')), [searchParams]);
  const [resetState, setResetState] = useState<ResetState>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!hasSupabaseBrowserEnv) {
      setResetState('missing');
      setErrorMessage('Supabase 환경변수가 없어 로컬에서는 비밀번호 재설정을 사용할 수 없습니다.');
      return;
    }

    let active = true;
    const supabase = createClient();

    async function prepareRecoverySession() {
      setResetState('checking');
      setErrorMessage('');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!active) return;
          setResetState('missing');
          setErrorMessage(getResetError(error.message));
          return;
        }

        if (typeof window !== 'undefined') {
          const cleanedUrl = next === '/saju/new?autoProfile=1'
            ? '/reset-password'
            : `/reset-password?next=${encodeURIComponent(next)}`;
          window.history.replaceState(null, '', cleanedUrl);
        }
      }

      const session = await waitForRecoverySession(supabase);
      if (!active) return;

      if (session) {
        setResetState('ready');
        setErrorMessage('');
        return;
      }

      setResetState('missing');
      setErrorMessage('재설정 링크를 확인하지 못했습니다. 이메일에서 받은 링크를 다시 열어 주세요.');
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || session) {
        setResetState('ready');
        setErrorMessage('');
      }
    });

    void prepareRecoverySession();

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [code, next]);

  async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseBrowserEnv) {
      setErrorMessage('Supabase 환경변수가 없어 비밀번호 재설정을 사용할 수 없습니다.');
      setStatusMessage('');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('새 비밀번호는 8자 이상으로 입력해 주세요.');
      setStatusMessage('');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('새 비밀번호 확인이 서로 다릅니다.');
      setStatusMessage('');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(getResetError(error.message));
      return;
    }

    setResetState('saved');
    setStatusMessage('새 비밀번호가 저장됐습니다. 잠시 후 내 사주 입력 화면으로 이동합니다.');
    setTimeout(() => {
      router.replace(next);
      router.refresh();
    }, 900);
  }

  const isReady = resetState === 'ready';

  return (
    <div className="app-panel w-full max-w-xl p-5 text-center sm:p-8">
      <div className="mb-5">
        <div className="app-caption mb-3">계정 보안</div>
        <h1 className=" text-3xl font-bold tracking-tight text-[var(--app-ink)] sm:text-4xl">
          새 비밀번호 설정
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--app-copy-muted)]">
          이메일에서 받은 재설정 링크가 확인되면 새 비밀번호를 바로 저장할 수 있습니다.
        </p>
      </div>

      <form className="space-y-4 text-left" onSubmit={submitPasswordReset}>
        <section className="rounded-3xl border border-[var(--app-line)] bg-white p-4">
          {resetState === 'checking' ? (
            <div className="rounded-2xl bg-[var(--app-pink-soft)] px-4 py-4 text-sm font-medium text-[var(--app-pink-strong)]">
              재설정 링크를 확인하고 있어요.
            </div>
          ) : null}

          <div className="space-y-2">
            <label
              htmlFor="new-password"
              className="text-xs font-medium text-[var(--app-copy-muted)]"
            >
              새 비밀번호
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="8자 이상"
              value={password}
              disabled={!isReady || isSubmitting}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-2xl border border-[var(--app-line)] bg-white px-4 text-sm font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)] disabled:bg-[var(--app-surface-muted)]"
            />
          </div>

          <div className="mt-4 space-y-2">
            <label
              htmlFor="new-password-confirm"
              className="text-xs font-medium text-[var(--app-copy-muted)]"
            >
              새 비밀번호 확인
            </label>
            <input
              id="new-password-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="한 번 더 입력"
              value={confirmPassword}
              disabled={!isReady || isSubmitting}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-12 w-full rounded-2xl border border-[var(--app-line)] bg-white px-4 text-sm font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)] disabled:bg-[var(--app-surface-muted)]"
            />
          </div>
        </section>

        <Button
          type="submit"
          disabled={!isReady || isSubmitting}
          className="h-12 w-full rounded-2xl text-base font-bold"
        >
          {isSubmitting ? '저장 중...' : '새 비밀번호 저장하기'}
        </Button>
      </form>

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

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Link
          href="/login?mode=recover"
          className="flex h-11 items-center justify-center rounded-2xl border border-[var(--app-line)] bg-[var(--app-pink-soft)] text-sm font-bold text-[var(--app-pink-strong)] transition hover:border-[var(--app-pink)]/50 hover:bg-white"
        >
          재설정 링크 다시 받기
        </Link>
        <Link
          href="/login?mode=login"
          className="flex h-11 items-center justify-center rounded-2xl border border-[var(--app-line)] bg-white text-sm font-bold text-[var(--app-copy-muted)] transition hover:border-[var(--app-pink)]/50 hover:text-[var(--app-ink)]"
        >
          로그인으로 돌아가기
        </Link>
      </div>

      <p className="pt-5 text-xs leading-6 text-[var(--app-copy-soft)]">
        계정 이용 시 <LegalLinks className="text-[var(--app-copy-muted)]" />이 적용됩니다.
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="app-shell flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10 text-[var(--app-ink)]">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-pink)] text-xl font-bold text-white shadow-[0_16px_32px_rgba(216,27,114,0.22)]">
          달
        </div>
        <div className=" text-lg font-semibold text-[var(--app-ink)]">달빛인생</div>
        <div className="text-xs text-[var(--app-copy-muted)]">비밀번호 재설정</div>
      </div>
      <Suspense fallback={<div className="text-[var(--app-copy-muted)]">로딩중...</div>}>
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}
