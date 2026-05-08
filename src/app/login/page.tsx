'use client';

import { Suspense, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import LegalLinks from '@/components/legal-links';
import { BIRTH_LOCATION_PRESETS } from '@/lib/saju/birth-location';
import { CANONICAL_SITE_URL } from '@/lib/site';
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

const CANONICAL_SITE_ORIGIN = CANONICAL_SITE_URL;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, index) => CURRENT_YEAR - index);
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);

type LoginMode = 'signup' | 'login' | 'recover' | 'reset';
type GenderValue = 'male' | 'female' | '';

type SignupForm = {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  calendarType: 'solar' | 'lunar';
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  gender: GenderValue;
  unknownBirthTime: boolean;
  birthHour: string;
  birthMinute: string;
  birthLocationCode: string;
  timeRule: 'standard' | 'trueSolarTime';
};

type SignupResponse = {
  success?: boolean;
  next?: string;
  profileSaved?: boolean;
  error?: string;
};

const DEFAULT_SIGNUP_FORM: SignupForm = {
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
  calendarType: 'solar',
  birthYear: '',
  birthMonth: '',
  birthDay: '',
  gender: '',
  unknownBirthTime: false,
  birthHour: '',
  birthMinute: '0',
  birthLocationCode: 'seoul',
  timeRule: 'standard',
};

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

function getPasswordLoginError(message?: string) {
  const normalized = message?.toLowerCase() ?? '';
  if (!message) return '로그인을 완료하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
  if (normalized.includes('invalid') || normalized.includes('credential')) {
    return '이메일 또는 비밀번호가 맞지 않습니다.';
  }
  if (normalized.includes('confirm')) {
    return '이메일 로그인 상태를 정리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
  }
  return message;
}

function isEmailNotConfirmedError(message?: string) {
  const normalized = message?.toLowerCase() ?? '';
  return normalized.includes('confirm');
}

function getRecoveryError(message?: string) {
  const normalized = message?.toLowerCase() ?? '';
  if (!message) return '이메일 확인 링크를 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
  if (
    normalized.includes('rate') ||
    normalized.includes('too many') ||
    normalized.includes('over_email_send_rate_limit')
  ) {
    return '재설정 메일 요청이 너무 잦아 잠시 제한됐습니다. 이미 도착한 최신 메일을 확인하거나, 잠시 후 다시 시도해 주세요.';
  }
  if (normalized.includes('invalid') || normalized.includes('email')) {
    return '이메일 형식을 확인해 주세요.';
  }
  return message;
}

function getAfterLoginHref(next: string) {
  if (next === '/' || next === '/login') return '/saju/new?autoProfile=1';
  if (!next.startsWith('/saju/new')) return next;

  const [path, query = ''] = next.split('?');
  const params = new URLSearchParams(query);
  params.set('autoProfile', '1');
  return `${path}?${params.toString()}`;
}

function formatOptionNumber(value: number) {
  return String(value).padStart(2, '0');
}

function getInitialLoginMode(value: string | null): LoginMode {
  if (value === 'reset-password') return 'reset';
  if (value === 'recover') return 'recover';
  if (value === 'signup') return 'signup';
  return 'login';
}

function buildProfilePayloadFromSignupForm(form: SignupForm) {
  const birthLocation =
    BIRTH_LOCATION_PRESETS.find((location) => location.code === form.birthLocationCode) ??
    BIRTH_LOCATION_PRESETS[0];

  return {
    displayName: form.displayName,
    calendarType: form.calendarType,
    timeRule: form.timeRule,
    birthYear: form.birthYear,
    birthMonth: form.birthMonth,
    birthDay: form.birthDay,
    gender: form.gender,
    unknownBirthTime: form.unknownBirthTime,
    birthHour: form.birthHour,
    birthMinute: form.birthMinute,
    birthLocationCode: birthLocation.code,
    birthLocationLabel: birthLocation.label,
    birthLatitude: birthLocation.latitude,
    birthLongitude: birthLocation.longitude,
    solarTimeMode: form.timeRule === 'trueSolarTime' ? 'longitude' : 'standard',
    note: '',
  };
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-xs font-medium text-[var(--app-copy-muted)]"
    >
      {children}
    </label>
  );
}

function NativeSelect({
  id,
  value,
  onChange,
  children,
  disabled,
  className = '',
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={`h-12 w-full rounded-2xl border border-[var(--app-line)] bg-white px-3 text-sm font-semibold text-[var(--app-ink)] outline-none transition focus:border-[var(--app-pink)] ${className}`}
    >
      {children}
    </select>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeNext(searchParams.get('next'));
  const callbackError = searchParams.get('error');
  const callbackProvider = searchParams.get('provider');
  const callbackReason = searchParams.get('reason');
  const [mode, setMode] = useState<LoginMode>(() => getInitialLoginMode(searchParams.get('mode')));
  const [signupForm, setSignupForm] = useState<SignupForm>(DEFAULT_SIGNUP_FORM);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resetPasswordForm, setResetPasswordForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState(
    getOAuthLoginError(callbackError, callbackProvider, callbackReason)
  );
  const [isSubmittingSignup, setIsSubmittingSignup] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isSubmittingRecovery, setIsSubmittingRecovery] = useState(false);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  const afterLoginHref = useMemo(() => getAfterLoginHref(next), [next]);

  function updateSignupForm<K extends keyof SignupForm>(key: K, value: SignupForm[K]) {
    setSignupForm((current) => ({ ...current, [key]: value }));
  }

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
        redirectTo: `${getRedirectOrigin()}/api/auth/callback?provider=${provider}&next=${encodeURIComponent(afterLoginHref)}`,
      },
    });

    if (error) {
      setErrorMessage(`${providerLabel} 로그인 설정을 확인해 주세요. ${error.message}`);
    }
  }

  async function signInWithPassword(
    email: string,
    password: string,
    options: { redirect?: boolean; allowConfirmRetry?: boolean } = {}
  ) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      if (options.allowConfirmRetry !== false && isEmailNotConfirmedError(error.message)) {
        setStatusMessage('이메일 로그인 상태를 정리한 뒤 다시 로그인하고 있어요.');

        const response = await fetch('/api/auth/confirm-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = (await response.json().catch(() => null)) as
          | { success?: boolean; error?: string }
          | null;

        if (response.ok && data?.success) {
          return signInWithPassword(email, password, {
            ...options,
            allowConfirmRetry: false,
          });
        }

        setErrorMessage(data?.error ?? getPasswordLoginError(error.message));
        return false;
      }

      setErrorMessage(getPasswordLoginError(error.message));
      return false;
    }

    if (options.redirect !== false) {
      router.replace(afterLoginHref);
      router.refresh();
    }
    return true;
  }

  async function saveProfileAfterSignup() {
    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildProfilePayloadFromSignupForm(signupForm)),
    });

    const data = (await response.json().catch(() => null)) as
      | { success?: boolean; error?: string }
      | null;

    if (!response.ok || !data?.success) {
      throw new Error(data?.error ?? '사주 기본정보를 저장하지 못했습니다.');
    }
  }

  async function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseBrowserEnv) {
      setErrorMessage('Supabase 환경변수가 없어 로컬에서는 회원가입을 사용할 수 없습니다.');
      setStatusMessage('');
      return;
    }

    if (signupForm.password !== signupForm.confirmPassword) {
      setErrorMessage('비밀번호 확인이 서로 다릅니다.');
      setStatusMessage('');
      return;
    }

    setIsSubmittingSignup(true);
    setErrorMessage('');
    setStatusMessage('');

    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: signupForm.displayName,
        email: signupForm.email,
        password: signupForm.password,
        calendarType: signupForm.calendarType,
        birthYear: signupForm.birthYear,
        birthMonth: signupForm.birthMonth,
        birthDay: signupForm.birthDay,
        gender: signupForm.gender,
        unknownBirthTime: signupForm.unknownBirthTime,
        birthHour: signupForm.birthHour,
        birthMinute: signupForm.birthMinute,
        birthLocationCode: signupForm.birthLocationCode,
        timeRule: signupForm.timeRule,
      }),
    });

    const data = (await response.json().catch(() => null)) as SignupResponse | null;

    if (!response.ok || !data?.success) {
      setIsSubmittingSignup(false);
      setErrorMessage(data?.error ?? '회원가입을 완료하지 못했습니다.');
      return;
    }

    setStatusMessage('회원가입이 완료됐습니다. 사주 기본정보를 저장하는 중입니다.');
    const signedIn = await signInWithPassword(signupForm.email, signupForm.password, {
      redirect: false,
      allowConfirmRetry: true,
    });
    if (!signedIn) {
      setStatusMessage('회원가입은 완료됐습니다. 로그인 탭에서 비밀번호로 다시 로그인해 주세요.');
      setIsSubmittingSignup(false);
      return;
    }

    if (!data.profileSaved) {
      try {
        await saveProfileAfterSignup();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : '사주 기본정보를 저장하지 못했습니다.'
        );
        setStatusMessage('회원가입과 로그인은 완료됐지만 사주 기본정보 저장을 확인해 주세요.');
        setIsSubmittingSignup(false);
        return;
      }
    }

    router.replace(data.next ?? afterLoginHref);
    router.refresh();
    setIsSubmittingSignup(false);
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseBrowserEnv) {
      setErrorMessage('Supabase 환경변수가 없어 로컬에서는 로그인을 사용할 수 없습니다.');
      setStatusMessage('');
      return;
    }

    if (!loginForm.email.includes('@') || loginForm.password.length < 1) {
      setErrorMessage('이메일과 비밀번호를 입력해 주세요.');
      setStatusMessage('');
      return;
    }

    setIsSubmittingLogin(true);
    setErrorMessage('');
    setStatusMessage('');
    await signInWithPassword(loginForm.email, loginForm.password, {
      allowConfirmRetry: true,
    });
    setIsSubmittingLogin(false);
  }

  async function submitRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseBrowserEnv) {
      setErrorMessage('Supabase 환경변수가 없어 로컬에서는 이메일 확인을 사용할 수 없습니다.');
      setStatusMessage('');
      return;
    }

    const email = recoveryEmail.trim().toLowerCase();
    if (!email.includes('@')) {
      setErrorMessage('가입에 사용했을 가능성이 있는 이메일을 입력해 주세요.');
      setStatusMessage('');
      return;
    }

    setIsSubmittingRecovery(true);
    setErrorMessage('');
    setStatusMessage('');

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getRedirectOrigin()}/reset-password?next=${encodeURIComponent(afterLoginHref)}`,
    });

    setIsSubmittingRecovery(false);

    if (error) {
      setErrorMessage(getRecoveryError(error.message));
      return;
    }

    setStatusMessage(
      '입력한 이메일로 아이디 확인 및 비밀번호 재설정 링크를 보냈습니다. 가입된 이메일이면 메일함에서 링크를 열어 새 비밀번호를 설정할 수 있습니다.'
    );
  }

  async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseBrowserEnv) {
      setErrorMessage('Supabase 환경변수가 없어 로컬에서는 비밀번호 재설정을 사용할 수 없습니다.');
      setStatusMessage('');
      return;
    }

    if (resetPasswordForm.password.length < 8) {
      setErrorMessage('새 비밀번호는 8자 이상으로 입력해 주세요.');
      setStatusMessage('');
      return;
    }

    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      setErrorMessage('새 비밀번호 확인이 서로 다릅니다.');
      setStatusMessage('');
      return;
    }

    setIsSubmittingReset(true);
    setErrorMessage('');
    setStatusMessage('');

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: resetPasswordForm.password,
    });

    setIsSubmittingReset(false);

    if (error) {
      setErrorMessage(
        error.message.toLowerCase().includes('session')
          ? '재설정 링크가 만료됐습니다. 아이디/비밀번호 찾기에서 링크를 다시 받아 주세요.'
          : error.message
      );
      return;
    }

    setStatusMessage('새 비밀번호가 저장됐습니다. 바로 내 사주 입력 화면으로 이동합니다.');
    router.replace(afterLoginHref);
    router.refresh();
  }

  const disabled = !hasSupabaseBrowserEnv;
  const modeCopy = {
    login: {
      eyebrow: '로그인',
      title: '다시 들어오기',
      description: '가입한 이메일과 비밀번호로 로그인하면 저장된 사주정보를 바로 불러옵니다.',
    },
    signup: {
      eyebrow: '회원가입',
      title: '처음 시작하기',
      description: '이메일과 비밀번호를 만들고, 사주 기본정보를 한 번 저장해 두세요.',
    },
    recover: {
      eyebrow: '아이디 · 비밀번호 찾기',
      title: '이메일로 확인하기',
      description: '달빛인생 아이디는 이메일입니다. 가입했을 가능성이 있는 이메일로 재설정 링크를 보내드립니다.',
    },
    reset: {
      eyebrow: '비밀번호 재설정',
      title: '새 비밀번호 만들기',
      description: '이메일 인증 링크로 확인된 상태에서 새 비밀번호를 저장합니다.',
    },
  }[mode];

  return (
    <div
      className={`app-panel gangi-login-card mx-auto w-full p-5 text-center sm:p-8 ${
        mode === 'signup' ? 'max-w-3xl' : 'max-w-md'
      }`}
    >
      <div className="mb-5">
        <div className="app-caption mb-3">{modeCopy.eyebrow}</div>
        <h1 className=" text-3xl font-bold tracking-tight text-[var(--app-ink)] sm:text-4xl">
          {modeCopy.title}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--app-copy-muted)]">
          {modeCopy.description}
        </p>
      </div>

      {mode !== 'login' ? (
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setErrorMessage('');
            setStatusMessage('');
          }}
          className="mb-2 inline-flex h-9 items-center justify-center rounded-full border border-[var(--app-line)] bg-white px-4 text-xs font-bold text-[var(--app-copy-muted)] transition hover:border-[var(--app-pink)]/35 hover:text-[var(--app-pink-strong)]"
        >
          로그인 화면으로 돌아가기
        </button>
      ) : null}

      {mode === 'signup' ? (
        <form className="mt-6 space-y-5 text-left" onSubmit={submitSignup}>
          <section className="rounded-3xl border border-[var(--app-line)] bg-white p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="signup-name">이름 또는 별명</FieldLabel>
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  placeholder="예: 지윤"
                  value={signupForm.displayName}
                  onChange={(event) => updateSignupForm('displayName', event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[var(--app-line)] bg-white px-4 text-sm font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="signup-email">이메일</FieldLabel>
                <input
                  id="signup-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={signupForm.email}
                  onChange={(event) => updateSignupForm('email', event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[var(--app-line)] bg-white px-4 text-sm font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="signup-password">비밀번호</FieldLabel>
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="8자 이상"
                  value={signupForm.password}
                  onChange={(event) => updateSignupForm('password', event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[var(--app-line)] bg-white px-4 text-sm font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="signup-password-confirm">비밀번호 확인</FieldLabel>
                <input
                  id="signup-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="한 번 더 입력"
                  value={signupForm.confirmPassword}
                  onChange={(event) => updateSignupForm('confirmPassword', event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[var(--app-line)] bg-white px-4 text-sm font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--app-line)] bg-[var(--app-pink-soft)] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-[var(--app-ink)]">기본 사주 정보</div>
                <p className="mt-1 text-xs leading-5 text-[var(--app-copy-muted)]">
                  저장 후 사주보기, 오늘운세, 궁합 입력에 같은 기준으로 불러옵니다.
                </p>
              </div>
              <NativeSelect
                value={signupForm.calendarType}
                onChange={(value) => updateSignupForm('calendarType', value as SignupForm['calendarType'])}
                className="max-w-[112px]"
              >
                <option value="solar">양력</option>
                <option value="lunar">음력</option>
              </NativeSelect>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <NativeSelect
                id="birth-year"
                value={signupForm.birthYear}
                onChange={(value) => updateSignupForm('birthYear', value)}
              >
                <option value="">년</option>
                {YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                value={signupForm.birthMonth}
                onChange={(value) => updateSignupForm('birthMonth', value)}
              >
                <option value="">월</option>
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {formatOptionNumber(month)}월
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                value={signupForm.birthDay}
                onChange={(value) => updateSignupForm('birthDay', value)}
              >
                <option value="">일</option>
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {formatOptionNumber(day)}일
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>성별</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['male', '남성'],
                    ['female', '여성'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateSignupForm('gender', value as GenderValue)}
                      className={`h-12 rounded-2xl border text-sm font-bold transition ${
                        signupForm.gender === value
                          ? 'border-[var(--app-pink)] bg-[var(--app-pink)] text-white'
                          : 'border-[var(--app-line)] bg-white text-[var(--app-copy-muted)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <FieldLabel>출생 시간</FieldLabel>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <NativeSelect
                    value={signupForm.birthHour}
                    disabled={signupForm.unknownBirthTime}
                    onChange={(value) => updateSignupForm('birthHour', value)}
                  >
                    <option value="">시</option>
                    {HOURS.map((hour) => (
                      <option key={hour} value={hour}>
                        {formatOptionNumber(hour)}시
                      </option>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    value={signupForm.birthMinute}
                    disabled={signupForm.unknownBirthTime}
                    onChange={(value) => updateSignupForm('birthMinute', value)}
                  >
                    {MINUTES.map((minute) => (
                      <option key={minute} value={minute}>
                        {formatOptionNumber(minute)}분
                      </option>
                    ))}
                  </NativeSelect>
                  <label className="flex h-12 items-center gap-2 rounded-2xl border border-[var(--app-line)] bg-white px-3 text-xs font-medium text-[var(--app-copy-muted)]">
                    <input
                      type="checkbox"
                      checked={signupForm.unknownBirthTime}
                      onChange={(event) =>
                        updateSignupForm('unknownBirthTime', event.target.checked)
                      }
                      className="accent-[var(--app-pink)]"
                    />
                    모름
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="birth-location">출생지</FieldLabel>
                <NativeSelect
                  id="birth-location"
                  value={signupForm.birthLocationCode}
                  onChange={(value) => updateSignupForm('birthLocationCode', value)}
                >
                  {BIRTH_LOCATION_PRESETS.map((location) => (
                    <option key={location.code} value={location.code}>
                      {location.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="time-rule">시간 기준</FieldLabel>
                <NativeSelect
                  id="time-rule"
                  value={signupForm.timeRule}
                  onChange={(value) => updateSignupForm('timeRule', value as SignupForm['timeRule'])}
                >
                  <option value="standard">표준시</option>
                  <option value="trueSolarTime">진태양시</option>
                </NativeSelect>
              </div>
            </div>
          </section>

          <Button
            type="submit"
            disabled={disabled || isSubmittingSignup}
            className="h-12 w-full rounded-2xl text-base font-bold"
          >
            {isSubmittingSignup ? '회원가입 중...' : '회원가입하고 사주정보 불러오기'}
          </Button>
        </form>
      ) : mode === 'login' ? (
        <form className="mt-6 space-y-4 text-left" onSubmit={submitLogin}>
          <div className="space-y-2">
            <FieldLabel htmlFor="login-email">이메일</FieldLabel>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm((current) => ({ ...current, email: event.target.value }))
              }
              className="h-12 w-full rounded-2xl border border-[var(--app-line)] bg-white px-4 text-sm font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="login-password">비밀번호</FieldLabel>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="가입할 때 만든 비밀번호"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((current) => ({ ...current, password: event.target.value }))
              }
              className="h-12 w-full rounded-2xl border border-[var(--app-line)] bg-white px-4 text-sm font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
            />
          </div>
          <Button
            type="submit"
            disabled={disabled || isSubmittingLogin}
            className="h-12 w-full rounded-2xl text-base font-bold"
          >
            {isSubmittingLogin ? '로그인 중...' : '로그인하고 내 정보 불러오기'}
          </Button>
          <div className="gangi-login-sub-actions">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage('');
                setStatusMessage('');
              }}
            >
              회원가입
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                setMode('recover');
                setErrorMessage('');
                setStatusMessage('');
              }}
            >
              아이디 / 비밀번호 찾기
            </button>
          </div>
        </form>
      ) : mode === 'recover' ? (
        <form className="mt-6 space-y-4 text-left" onSubmit={submitRecovery}>
          <section className="rounded-3xl border border-[var(--app-line)] bg-white p-4">
            <div className="text-sm font-bold text-[var(--app-ink)]">
              이메일로 아이디 확인/비밀번호 재설정
            </div>
            <p className="mt-2 text-xs leading-6 text-[var(--app-copy-muted)]">
              달빛인생의 로그인 아이디는 이메일입니다. 가입했을 가능성이 있는 이메일을 입력하면 확인 링크와 새 비밀번호 설정 링크를 보내드립니다.
            </p>
            <div className="mt-4 space-y-2">
              <FieldLabel htmlFor="recovery-email">가입 이메일</FieldLabel>
              <input
                id="recovery-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[var(--app-line)] bg-white px-4 text-sm font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
              />
            </div>
          </section>
          <Button
            type="submit"
            disabled={disabled || isSubmittingRecovery}
            className="h-12 w-full rounded-2xl text-base font-bold"
          >
            {isSubmittingRecovery ? '메일 보내는 중...' : '이메일 인증 링크 받기'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage('');
              setStatusMessage('');
            }}
            className="w-full text-center text-xs font-medium text-[var(--app-copy-muted)] underline underline-offset-4"
          >
            로그인으로 돌아가기
          </button>
        </form>
      ) : (
        <form className="mt-6 space-y-4 text-left" onSubmit={submitPasswordReset}>
          <section className="rounded-3xl border border-[var(--app-line)] bg-white p-4">
            <div className="text-sm font-bold text-[var(--app-ink)]">
              새 비밀번호를 설정해 주세요
            </div>
            <p className="mt-2 text-xs leading-6 text-[var(--app-copy-muted)]">
              이메일 인증 링크로 확인된 세션에서만 변경됩니다. 링크가 만료됐다면 다시 아이디/비밀번호 찾기를 진행해 주세요.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="reset-password">새 비밀번호</FieldLabel>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="8자 이상"
                  value={resetPasswordForm.password}
                  onChange={(event) =>
                    setResetPasswordForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-2xl border border-[var(--app-line)] bg-white px-4 text-sm font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="reset-password-confirm">새 비밀번호 확인</FieldLabel>
                <input
                  id="reset-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="한 번 더 입력"
                  value={resetPasswordForm.confirmPassword}
                  onChange={(event) =>
                    setResetPasswordForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-2xl border border-[var(--app-line)] bg-white px-4 text-sm font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
                />
              </div>
            </div>
          </section>
          <Button
            type="submit"
            disabled={disabled || isSubmittingReset}
            className="h-12 w-full rounded-2xl text-base font-bold"
          >
            {isSubmittingReset ? '저장 중...' : '새 비밀번호 저장하기'}
          </Button>
        </form>
      )}

      {!hasSupabaseBrowserEnv ? (
        <p className="mt-4 rounded-2xl border border-[var(--app-coral)]/30 bg-[var(--app-coral)]/10 px-4 py-3 text-left text-xs leading-6 text-[var(--app-ink)]">
          로컬 환경에서는 Supabase URL과 공개 키를 설정해야 회원가입과 로그인을 사용할 수 있습니다.
        </p>
      ) : null}

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

      {mode === 'login' || mode === 'signup' ? (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-[var(--app-copy-soft)]">
            <span className="h-px flex-1 bg-[var(--app-line)]" />
            간편 로그인
            <span className="h-px flex-1 bg-[var(--app-line)]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              onClick={() => signInWithProvider('kakao')}
              disabled={disabled}
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
              disabled={disabled}
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
        </>
      ) : null}

      <p className="pt-4 text-xs leading-6 text-[var(--app-copy-soft)]">
        회원가입 또는 로그인 시 <LegalLinks className="text-[var(--app-copy-muted)]" />에 동의합니다.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AppShell className="gangi-subpage-shell" footer={false}>
      <AppPage className="gangi-login-subpage gangi-auth-page flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-6 py-10 text-[var(--app-ink)]">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-pink)] text-xl font-bold text-white shadow-[0_16px_32px_rgba(216,27,114,0.22)]">
            달
          </div>
          <div className=" text-lg font-semibold text-[var(--app-ink)]">달빛인생</div>
          <div className="text-xs text-[var(--app-copy-muted)]">오늘운세 · 타로 · 사주</div>
        </div>
        <div className="w-full">
          <Suspense fallback={<div className="text-[var(--app-copy-muted)]">로딩중...</div>}>
            <LoginContent />
          </Suspense>
        </div>
      </AppPage>
    </AppShell>
  );
}
