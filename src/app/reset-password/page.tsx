// Redesign 2026-05-13 (Claude Design / screens-g.jsx ScreenPasswordReset step 3):
// 3-bar progress + STEP 3/3 eyebrow + 새 비밀번호 폼 + sticky CTA.
// Supabase recovery 세션·인증·라우팅 흐름 무수정.
'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LegalLinks from '@/components/legal-links';
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { StickyBottomBar } from '@/components/ui/sticky-bottom-bar';

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
  if (normalized.includes('code verifier')) {
    return '재설정 링크를 확인할 수 없습니다. 링크를 요청한 브라우저와 현재 브라우저가 다르거나, 콜백 주소가 바뀐 상태입니다. 이 창에서 재설정 링크를 다시 받아 주세요.';
  }
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

function readRecoveryTokensFromHash() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');
  if (type !== 'recovery' || !accessToken || !refreshToken) return null;
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

function cleanResetPasswordUrl(next: string) {
  if (typeof window === 'undefined') return;
  const cleanedUrl =
    next === '/saju/new?autoProfile=1'
      ? '/reset-password'
      : `/reset-password?next=${encodeURIComponent(next)}`;
  window.history.replaceState(null, '', cleanedUrl);
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const tokenType = searchParams.get('type');
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

      const recoveryTokens = readRecoveryTokensFromHash();
      if (recoveryTokens) {
        const { error } = await supabase.auth.setSession(recoveryTokens);
        if (error) {
          if (!active) return;
          setResetState('missing');
          setErrorMessage(getResetError(error.message));
          return;
        }
        cleanResetPasswordUrl(next);
      } else if (tokenType === 'recovery' && tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });
        if (error) {
          if (!active) return;
          setResetState('missing');
          setErrorMessage(getResetError(error.message));
          return;
        }
        cleanResetPasswordUrl(next);
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!active) return;
          setResetState('missing');
          setErrorMessage(getResetError(error.message));
          return;
        }
        cleanResetPasswordUrl(next);
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
  }, [code, next, tokenHash, tokenType]);

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
  const isSaved = resetState === 'saved';

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-32 pt-2">
      {/* 3-bar progress — step 3 active */}
      <div className="mb-5 flex gap-1.5" role="list" aria-label="진행 단계">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-1 flex-1 rounded-full"
            style={{ background: 'var(--app-pink)' }}
            aria-current={n === 3 ? 'step' : undefined}
          />
        ))}
      </div>

      <div>
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          STEP 3 / 3
        </div>
        <h1 className="mt-1.5 text-[27.6px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
          새 비밀번호 설정
        </h1>
        <p className="mt-2 text-[15px] leading-[1.6] text-[var(--app-copy-muted)]">
          이메일에서 받은 재설정 링크가 확인되면 새 비밀번호를 바로 저장할 수 있습니다.
        </p>
      </div>

      {resetState === 'checking' ? (
        <div
          className="mt-5 rounded-[14px] border px-4 py-3 text-[14.4px] font-bold text-[var(--app-pink-strong)]"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          재설정 링크를 확인하고 있어요.
        </div>
      ) : null}

      <form id="reset-password-form" className="mt-5 space-y-4" onSubmit={submitPasswordReset}>
        <div>
          <label
            htmlFor="new-password"
            className="block text-[14.4px] font-medium text-[var(--app-copy-muted)]"
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
            className="mt-1.5 h-12 w-full rounded-[12px] border border-[var(--app-line)] bg-white px-3.5 text-[16.7px] font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)] disabled:bg-[var(--app-pink-soft)]/50 disabled:opacity-70"
          />
          <p className="mt-1.5 pl-1 text-[12.6px] text-[var(--app-copy-soft)]">
            영문 + 숫자 + 특수문자 / 8자 이상
          </p>
        </div>

        <div>
          <label
            htmlFor="new-password-confirm"
            className="block text-[14.4px] font-medium text-[var(--app-copy-muted)]"
          >
            비밀번호 확인
          </label>
          <input
            id="new-password-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="한 번 더 입력"
            value={confirmPassword}
            disabled={!isReady || isSubmitting}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-1.5 h-12 w-full rounded-[12px] border border-[var(--app-line)] bg-white px-3.5 text-[16.7px] font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)] disabled:bg-[var(--app-pink-soft)]/50 disabled:opacity-70"
          />
        </div>

        {/* Sticky CTA — body portal 로 dock 위 고정. portal 이 button 을 form DOM 밖으로
            옮기므로 form="reset-password-form" 로 명시 연결(네이티브 submit 유지). */}
        <StickyBottomBar>
          <button
            type="submit"
            form="reset-password-form"
            disabled={!isReady || isSubmitting || isSaved}
            className="inline-flex h-12 w-full items-center justify-center rounded-[12px] bg-[var(--app-pink)] px-5 text-[17.3px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)] disabled:opacity-60"
          >
            {isSubmitting ? '저장 중...' : isSaved ? '저장됨' : '비밀번호 변경 완료'}
          </button>
        </StickyBottomBar>
      </form>

      {statusMessage ? (
        <p
          className="mt-4 rounded-[12px] border px-4 py-3 text-[14.4px] leading-relaxed text-[var(--app-ink)]"
          style={{
            background: 'var(--app-jade-soft, rgba(15,159,122,0.1))',
            borderColor: 'var(--app-jade)',
          }}
        >
          {statusMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-[12px] border border-[var(--app-coral)]/30 bg-[var(--app-coral)]/10 px-4 py-3 text-[14.4px] leading-relaxed text-[var(--app-ink)]">
          {errorMessage}
        </p>
      ) : null}

      {/* 보조 액션 */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link
          href="/login?mode=recover"
          className="flex h-11 items-center justify-center rounded-full border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] text-[15px] font-extrabold text-[var(--app-pink-strong)]"
        >
          재설정 링크 다시 받기
        </Link>
        <Link
          href="/login?mode=login"
          className="flex h-11 items-center justify-center rounded-full border border-[var(--app-line)] bg-white text-[15px] font-bold text-[var(--app-copy-muted)]"
        >
          로그인으로
        </Link>
      </div>

      <p className="pt-5 text-center text-[12.6px] leading-[1.6] text-[var(--app-copy-soft)]">
        계정 이용 시 <LegalLinks className="text-[var(--app-pink-strong)]" />이 적용됩니다.
      </p>

      <div aria-hidden="true" className="app-fixed-bottom-cta-clearance" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AppShell className="gangi-subpage-shell" footer={false}>
      <AppPage className="gangi-login-subpage gangi-auth-page flex min-h-[calc(100vh-5rem)] flex-col items-center gap-4 py-6 text-[var(--app-ink)]">
        {/* 2026-05-18 Phase 5-C: "로딩중..." → 표준 skeleton. */}
        <Suspense
          fallback={
            <div role="status" aria-live="polite" className="w-full max-w-md space-y-3">
              <div className="mx-auto h-5 w-32 animate-pulse rounded bg-[var(--app-line)]" aria-hidden="true" />
              <div className="space-y-2">
                <div className="h-11 w-full animate-pulse rounded bg-[var(--app-line)]" aria-hidden="true" />
                <div className="h-11 w-full animate-pulse rounded bg-[var(--app-line)]" aria-hidden="true" />
              </div>
              <span className="sr-only">비밀번호 재설정 화면을 불러오는 중입니다.</span>
            </div>
          }
        >
          <ResetPasswordContent />
        </Suspense>
      </AppPage>
    </AppShell>
  );
}
