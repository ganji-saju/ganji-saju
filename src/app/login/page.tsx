'use client';

import { Suspense, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import LegalLinks from '@/components/legal-links';
import { ZodiacChip } from '@/components/gangi/zodiac-chip';
import {
  UnifiedBirthInfoFields,
  type BirthLocationSearchResultLike,
} from '@/components/saju/shared/unified-birth-info-fields';
import { BUSINESS_INFO } from '@/lib/business-info';
import { BIRTH_LOCATION_PRESETS, getBirthLocationPreset } from '@/lib/saju/birth-location';
import {
  resolveUnifiedBirthInput,
  type UnifiedBirthEntryDraft,
  type UnifiedTimeRule,
} from '@/lib/saju/unified-birth-entry';
import { CANONICAL_SITE_URL } from '@/lib/site';
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

const CANONICAL_SITE_ORIGIN = CANONICAL_SITE_URL;
const SUPPORT_EMAIL = BUSINESS_INFO.email || 'support@ganjisaju.kr';

type LoginMode = 'gateway' | 'signup' | 'login' | 'recover' | 'reset';
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
  birthLocationLabel: string;
  birthLatitude: string;
  birthLongitude: string;
  timeRule: UnifiedTimeRule;
};

type SignupResponse = {
  success?: boolean;
  next?: string;
  profileSaved?: boolean;
  error?: string;
};

const DEFAULT_BIRTH_LOCATION =
  getBirthLocationPreset('seoul') ?? {
    code: 'seoul',
    label: '서울',
    latitude: 37.5665,
    longitude: 126.978,
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
  birthMinute: '',
  birthLocationCode: DEFAULT_BIRTH_LOCATION.code ?? 'seoul',
  birthLocationLabel: DEFAULT_BIRTH_LOCATION.label,
  birthLatitude: String(DEFAULT_BIRTH_LOCATION.latitude),
  birthLongitude: String(DEFAULT_BIRTH_LOCATION.longitude),
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
    (url.hostname.endsWith('.vercel.app') ||
      url.hostname === 'ganji-saju.vercel.app' ||
      url.hostname === 'ganji-saju-ganji-sajus-projects.vercel.app' ||
      url.hostname === 'ganji-saju-ganji-saju.vercel.app' ||
      url.hostname === 'ganjisaju.kr' ||
      url.hostname === 'www.ganjisaju.kr') &&
    url.origin !== CANONICAL_SITE_ORIGIN
  );
}

function getRedirectOrigin() {
  try {
    const browserUrl = new URL(location.origin);
    if (isLocalOrigin(browserUrl)) return browserUrl.origin;
    if (shouldUseCanonicalOrigin(browserUrl)) return CANONICAL_SITE_ORIGIN;
    return browserUrl.origin;
  } catch {
    // Fall back to the configured origin below.
  }

  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (configuredUrl?.startsWith('http')) {
    try {
      const url = new URL(configuredUrl);
      if (
        !url.hostname.endsWith('.supabase.co') &&
        !shouldUseCanonicalOrigin(url)
      ) {
        return url.origin;
      }
    } catch {
      // Fall back to the browser origin below.
    }
  }

  return CANONICAL_SITE_ORIGIN;
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
    const normalizedReason = reason?.toLowerCase() ?? '';
    if (normalizedReason.includes('code verifier')) {
      return `${providerLabel} 로그인 세션 연결이 완료되지 않았습니다. 로그인 시작 주소와 콜백 주소가 달라졌을 수 있어요. 현재 창에서 다시 로그인해 주세요.`;
    }
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

function getInitialLoginMode(value: string | null): LoginMode {
  if (value === 'reset-password') return 'reset';
  if (value === 'recover') return 'recover';
  if (value === 'signup') return 'signup';
  if (value === 'login' || value === 'email') return 'login';
  // 리디자인 2026-05-13: 기본은 SNS gateway. ?mode=login 으로 이메일 폼 직링크도 유지.
  return 'gateway';
}

// signupForm ↔ UnifiedBirthEntryDraft 변환.
// 사주 입력폼(intake)·궁합 입력과 같은 UnifiedBirthInfoFields 를 회원가입에서도 쓰기 위해
// signupForm 의 birthYear/Month/Day/Hour 등을 draft.year/month/day/hour 로 매핑한다.
function buildSignupBirthDraft(form: SignupForm): UnifiedBirthEntryDraft {
  return {
    calendarType: form.calendarType,
    timeRule: form.timeRule,
    year: form.birthYear,
    month: form.birthMonth,
    day: form.birthDay,
    hour: form.birthHour,
    minute: form.birthMinute,
    unknownBirthTime: form.unknownBirthTime,
    gender: form.gender,
    birthLocationCode: form.birthLocationCode,
    birthLocationLabel: form.birthLocationLabel,
    birthLatitude: form.birthLatitude,
    birthLongitude: form.birthLongitude,
  };
}

// UnifiedBirthInfoFields 가 보내는 draft patch 를 signupForm 키로 되돌려 반영한다.
function applySignupBirthDraftPatch(
  current: SignupForm,
  patch: Partial<UnifiedBirthEntryDraft>
): SignupForm {
  const next: SignupForm = { ...current };

  if ('calendarType' in patch && patch.calendarType !== undefined) next.calendarType = patch.calendarType;
  if ('timeRule' in patch && patch.timeRule !== undefined) next.timeRule = patch.timeRule;
  if ('year' in patch && patch.year !== undefined) next.birthYear = patch.year;
  if ('month' in patch && patch.month !== undefined) next.birthMonth = patch.month;
  if ('day' in patch && patch.day !== undefined) next.birthDay = patch.day;
  if ('hour' in patch && patch.hour !== undefined) next.birthHour = patch.hour;
  if ('minute' in patch && patch.minute !== undefined) next.birthMinute = patch.minute;
  if ('unknownBirthTime' in patch && patch.unknownBirthTime !== undefined)
    next.unknownBirthTime = patch.unknownBirthTime;
  if ('gender' in patch && patch.gender !== undefined) next.gender = patch.gender as GenderValue;
  if ('birthLocationCode' in patch && patch.birthLocationCode !== undefined)
    next.birthLocationCode = patch.birthLocationCode;
  if ('birthLocationLabel' in patch && patch.birthLocationLabel !== undefined)
    next.birthLocationLabel = patch.birthLocationLabel;
  if ('birthLatitude' in patch && patch.birthLatitude !== undefined)
    next.birthLatitude = patch.birthLatitude;
  if ('birthLongitude' in patch && patch.birthLongitude !== undefined)
    next.birthLongitude = patch.birthLongitude;

  // 시간 모름/시 입력 동기화(사주 intake 와 동일한 규칙).
  if (patch.unknownBirthTime === true || next.birthHour === '') {
    next.birthHour = '';
    next.birthMinute = '';
    next.unknownBirthTime = true;
  }
  if (patch.hour && patch.hour !== '') {
    next.unknownBirthTime = false;
  }

  return next;
}

function buildProfilePayloadFromSignupForm(form: SignupForm) {
  const presetLocation =
    BIRTH_LOCATION_PRESETS.find((location) => location.code === form.birthLocationCode) ??
    null;

  // 프리셋이면 프리셋 좌표를, custom(주소 검색)이면 form 에 담긴 좌표를 사용한다.
  const birthLocationCode = presetLocation?.code ?? form.birthLocationCode;
  const birthLocationLabel = presetLocation?.label ?? form.birthLocationLabel;
  const birthLatitude = presetLocation ? presetLocation.latitude : Number(form.birthLatitude);
  const birthLongitude = presetLocation ? presetLocation.longitude : Number(form.birthLongitude);

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
    birthLocationCode,
    birthLocationLabel,
    birthLatitude,
    birthLongitude,
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
      className="block text-[12.5px] font-medium text-[var(--app-copy-muted)]"
    >
      {children}
    </label>
  );
}


// 리디자인 2026-05-13 (Claude Design / screens-b.jsx ScreenAuth) — SNS gateway 진입 화면.
// 라우팅/이벤트는 무수정. 카카오·Google: 기존 signInWithProvider 그대로 호출,
// 이메일: 같은 페이지 내 mode 전환.
// 2026-05-14: Apple OAuth 제거 — 개발자 등록 미진행으로 표시하지 않는다.
function GatewayView({
  disabled,
  statusMessage,
  errorMessage,
  onProvider,
  onOpenEmailLogin,
  onOpenSignup,
  onOpenRecover,
}: {
  disabled: boolean;
  statusMessage: string;
  errorMessage: string;
  onProvider: (provider: 'google' | 'kakao') => void;
  onOpenEmailLogin: () => void;
  onOpenSignup: () => void;
  onOpenRecover: () => void;
}) {
  return (
    <div className="gangi-auth-gateway relative isolate w-full overflow-hidden">
      {/* Floating zodiac decorations — 시각 전용 (aria 라벨은 ZodiacChip 내부) */}
      <div className="pointer-events-none absolute -right-5 top-3 opacity-60" aria-hidden="true">
        <ZodiacChip kind="rabbit" size="xl" />
      </div>
      <div className="pointer-events-none absolute -left-3 top-32 opacity-50" aria-hidden="true">
        <ZodiacChip kind="dragon" size="lg" />
      </div>
      <div className="pointer-events-none absolute right-24 top-16 opacity-50" aria-hidden="true">
        <ZodiacChip kind="snake" size="sm" />
      </div>

      <div className="relative pt-[180px]">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] text-white"
          style={{
            background:
              'linear-gradient(135deg, var(--app-pink) 0%, var(--app-pink-strong) 100%)',
            fontFamily: 'var(--font-han)',
            fontSize: 30,
            fontWeight: 800,
            boxShadow: '0 14px 28px rgba(216,27,114,0.32)',
          }}
        >
          干
        </div>
        <h1
          className="text-[28px] font-extrabold leading-tight tracking-tight text-[var(--app-ink)]"
          style={{ fontFamily: 'var(--font-han)' }}
        >
          간지사주
        </h1>
        <div className="mt-1 text-[13px] font-bold text-[var(--app-pink-strong)]">
          간지사주는 사주, 오늘운세, 보관함과 유료 이용내역을 한 계정에서 이어 보는 서비스입니다.
        </div>

        <div className="mt-9 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => onProvider('kakao')}
            disabled={disabled}
            className="flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] text-[14.5px] font-extrabold disabled:opacity-60"
            style={{
              background: '#fee500',
              color: '#191919',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <span
              className="grid h-[22px] w-[22px] place-items-center rounded-[5px] text-[13px] font-black"
              style={{ background: '#191919', color: '#fee500' }}
            >
              K
            </span>
            카카오 로그인
          </button>

          <button
            type="button"
            onClick={() => onProvider('google')}
            disabled={disabled}
            className="flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] bg-white text-[14.5px] font-bold text-[#1f1f1f] disabled:opacity-60"
            style={{ border: '1.5px solid var(--app-line)' }}
          >
            <span
              className="grid h-[22px] w-[22px] place-items-center rounded-[5px] bg-white text-[13px] font-black"
              style={{ color: '#4285F4', border: '1px solid rgba(0,0,0,0.08)' }}
            >
              G
            </span>
            Google 로그인
          </button>

          <button
            type="button"
            onClick={onOpenEmailLogin}
            className="flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] bg-transparent text-[14.5px] font-bold text-[var(--app-ink)]"
            style={{ border: '1.5px solid var(--app-line)' }}
          >
            <span
              className="grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-black"
              style={{
                background: 'var(--app-pink-soft)',
                color: 'var(--app-pink-strong)',
              }}
            >
              @
            </span>
            이메일로 로그인
          </button>
        </div>

        {/* 2026-05-22 — 결제 직전 게이트웨이 진입자가 "왜 로그인?"을 납득하도록 신뢰 문구 한 줄.
            내 풀이·결제내역·환불이 계정에 안전 보관됨을 명시해 결제 직전 이탈을 줄인다. */}
        <p className="mt-[18px] text-center text-[11.5px] leading-relaxed text-[var(--app-copy-soft)]">
          로그인하면 <strong className="font-bold text-[var(--app-copy-muted)]">내 풀이·결제내역·환불</strong>이 한 계정에 안전하게 보관돼요.
        </p>

        <div
          className="mt-3 flex items-center gap-2.5 rounded-[14px] px-3.5 py-3.5"
          style={{
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid var(--app-line)',
          }}
        >
          <ZodiacChip kind="rooster" size="sm" />
          <div className="text-[12px] leading-relaxed text-[var(--app-copy-muted)]">
            <strong className="text-[var(--app-ink)]">로그인 없이도</strong> 오늘운세·타로는 무료로 볼 수 있어요
          </div>
        </div>

        <div className="mt-[18px] text-center text-[11px] leading-relaxed text-[var(--app-copy-soft)]">
          시작 시{' '}
          <LegalLinks className="text-[var(--app-pink-strong)]" />
          에 동의합니다.
          <br />
          로그인 실패 또는 계정 확인이 필요하면{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-bold text-[var(--app-pink-strong)] underline"
          >
            {SUPPORT_EMAIL}
          </a>
          {' '}또는{' '}
          <a href="/help" className="font-bold text-[var(--app-pink-strong)] underline">
            고객센터
          </a>
          로 문의해 주세요.
        </div>

        {/* 2026-05-15 — 회원가입/비번찾기 진입점 prominent CTA 로 강화.
            이전엔 underline 작은 글씨로 사용자가 못 찾음. */}
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={onOpenSignup}
            className="inline-flex h-11 items-center justify-center rounded-full border bg-white px-5 text-[13px] font-extrabold text-[var(--app-pink-strong)] transition-transform active:scale-95"
            style={{ borderColor: 'var(--app-pink-line)' }}
          >
            처음 오셨나요? 이메일로 회원가입 →
          </button>
          <button
            type="button"
            onClick={onOpenRecover}
            className="inline-flex h-10 items-center justify-center rounded-full border bg-white px-5 text-[12px] font-bold text-[var(--app-copy-muted)] transition-transform active:scale-95"
            style={{ borderColor: 'var(--app-line)' }}
          >
            비밀번호를 잊으셨나요?
          </button>
        </div>

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
      </div>
    </div>
  );
}

function LoginContent({
  mode,
  setMode,
}: {
  mode: LoginMode;
  setMode: (next: LoginMode) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeNext(searchParams.get('next'));
  const callbackError = searchParams.get('error');
  const callbackProvider = searchParams.get('provider');
  const callbackReason = searchParams.get('reason');
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
  // 회원가입 출생지 주소 검색 상태 — 사주 입력폼/궁합 입력과 동일한 UnifiedBirthInfoFields 배선.
  const [signupLocationStatus, setSignupLocationStatus] = useState<
    'idle' | 'loading' | 'ready' | 'empty' | 'error'
  >('idle');
  const [signupLocationMessage, setSignupLocationMessage] = useState('');
  const [signupLocationResults, setSignupLocationResults] = useState<
    BirthLocationSearchResultLike[]
  >([]);

  const afterLoginHref = useMemo(() => getAfterLoginHref(next), [next]);

  function updateSignupForm<K extends keyof SignupForm>(key: K, value: SignupForm[K]) {
    setSignupForm((current) => ({ ...current, [key]: value }));
  }

  // UnifiedBirthInfoFields → signupForm patch 반영.
  function patchSignupBirthDraft(patch: Partial<UnifiedBirthEntryDraft>) {
    setSignupForm((current) => applySignupBirthDraftPatch(current, patch));
  }

  // 출생지 프리셋 칩 선택 — 프리셋 좌표를 form 에 채우고 검색 결과를 초기화한다.
  function selectSignupBirthLocation(code: string) {
    const preset = BIRTH_LOCATION_PRESETS.find((item) => item.code === code);
    setSignupForm((current) =>
      applySignupBirthDraftPatch(current, {
        birthLocationCode: code,
        birthLocationLabel:
          code === 'custom' ? current.birthLocationLabel : preset?.label ?? '',
        birthLatitude:
          code === 'custom' ? current.birthLatitude : preset ? String(preset.latitude) : '',
        birthLongitude:
          code === 'custom' ? current.birthLongitude : preset ? String(preset.longitude) : '',
      })
    );
    setSignupLocationStatus('idle');
    setSignupLocationMessage('');
    setSignupLocationResults([]);
  }

  // 출생지 주소 검색 — /api/geo/birth-location 재사용(사주 intake 와 동일 엔드포인트).
  async function searchSignupBirthLocationCoordinates() {
    const query = signupForm.birthLocationLabel.trim();
    if (query.length < 2) {
      setSignupLocationStatus('error');
      setSignupLocationMessage('지역명을 두 글자 이상 입력해 주세요.');
      setSignupLocationResults([]);
      return;
    }

    setSignupLocationStatus('loading');
    setSignupLocationMessage('');
    setSignupLocationResults([]);

    try {
      const response = await fetch(`/api/geo/birth-location?q=${encodeURIComponent(query)}`, {
        cache: 'force-cache',
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string; items?: BirthLocationSearchResultLike[] }
        | null;

      if (!response.ok || !data?.ok) {
        setSignupLocationStatus('error');
        setSignupLocationMessage(data?.error ?? '지역 좌표를 찾지 못했습니다.');
        return;
      }

      const items = data.items ?? [];
      setSignupLocationResults(items);
      setSignupLocationStatus(items.length > 0 ? 'ready' : 'empty');
      setSignupLocationMessage(
        items.length > 0
          ? '가장 가까운 지역을 골라 위도와 경도를 적용해 주세요.'
          : '일치하는 지역을 찾지 못했습니다. 시/군/구 이름이나 영문 지명을 함께 입력해 보세요.'
      );
    } catch {
      setSignupLocationStatus('error');
      setSignupLocationMessage('지역 좌표를 찾는 중 네트워크 오류가 발생했습니다.');
    }
  }

  // 검색 결과 선택 — custom 좌표로 form 을 채운다.
  function applySignupBirthLocationSearchResult(result: BirthLocationSearchResultLike) {
    setSignupForm((current) =>
      applySignupBirthDraftPatch(current, {
        birthLocationCode: 'custom',
        birthLocationLabel: result.label,
        birthLatitude: String(result.latitude),
        birthLongitude: String(result.longitude),
      })
    );
    setSignupLocationStatus('ready');
    setSignupLocationMessage(`${result.label} 좌표를 적용했습니다.`);
    setSignupLocationResults([]);
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

    // 사주 입력폼/궁합 입력과 동일한 검증으로 생년월일·성별·출생지 입력을 사전 확인한다.
    const parsedBirth = resolveUnifiedBirthInput(buildSignupBirthDraft(signupForm), {
      requireGender: true,
    });
    if (!parsedBirth.ok) {
      setErrorMessage(parsedBirth.error);
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

  if (mode === 'gateway') {
    return (
      <GatewayView
        disabled={disabled}
        statusMessage={statusMessage}
        errorMessage={errorMessage}
        onProvider={signInWithProvider}
        onOpenEmailLogin={() => {
          setMode('login');
          setErrorMessage('');
          setStatusMessage('');
        }}
        onOpenSignup={() => {
          setMode('signup');
          setErrorMessage('');
          setStatusMessage('');
        }}
        // 2026-05-15 — 비번찾기 진입점을 gateway 에서 바로 보이게 함.
        // 이전엔 login 모드 진입 후에만 노출되어 사용자가 못 찾던 회귀.
        onOpenRecover={() => {
          setMode('recover');
          setErrorMessage('');
          setStatusMessage('');
        }}
      />
    );
  }

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
      description: '간지사주 아이디는 이메일입니다. 가입했을 가능성이 있는 이메일로 재설정 링크를 보내드립니다.',
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

      {mode === 'login' ? (
        <button
          type="button"
          onClick={() => {
            setMode('gateway');
            setErrorMessage('');
            setStatusMessage('');
          }}
          className="mb-2 inline-flex h-9 items-center justify-center rounded-full border border-[var(--app-line)] bg-white px-4 text-xs font-bold text-[var(--app-copy-muted)] transition hover:border-[var(--app-pink)]/35 hover:text-[var(--app-pink-strong)]"
        >
          ← SNS 로그인으로 돌아가기
        </button>
      ) : (
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
      )}

      {mode === 'signup' ? (
        <form className="mt-6 space-y-5 text-left" onSubmit={submitSignup}>
          <section className="rounded-[18px] border border-[var(--app-line)] bg-white p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <div className="space-y-1.5">
                <FieldLabel htmlFor="signup-name">이름 또는 별명</FieldLabel>
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  placeholder="예: 지윤"
                  value={signupForm.displayName}
                  onChange={(event) => updateSignupForm('displayName', event.target.value)}
                  className="motion-input-effect h-12 w-full rounded-[14px] border border-[var(--app-line)] bg-white px-3.5 text-[14.5px] font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="signup-email">이메일</FieldLabel>
                <input
                  id="signup-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={signupForm.email}
                  onChange={(event) => updateSignupForm('email', event.target.value)}
                  className="motion-input-effect h-12 w-full rounded-[14px] border border-[var(--app-line)] bg-white px-3.5 text-[14.5px] font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="signup-password">비밀번호</FieldLabel>
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="8자 이상"
                  value={signupForm.password}
                  onChange={(event) => updateSignupForm('password', event.target.value)}
                  className="motion-input-effect h-12 w-full rounded-[14px] border border-[var(--app-line)] bg-white px-3.5 text-[14.5px] font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="signup-password-confirm">비밀번호 확인</FieldLabel>
                <input
                  id="signup-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="한 번 더 입력"
                  value={signupForm.confirmPassword}
                  onChange={(event) => updateSignupForm('confirmPassword', event.target.value)}
                  className="motion-input-effect h-12 w-full rounded-[14px] border border-[var(--app-line)] bg-white px-3.5 text-[14.5px] font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--app-line)] bg-[var(--app-pink-soft)] p-4 sm:p-5">
            <div className="mb-4">
              <div className="text-sm font-bold text-[var(--app-ink)]">기본 사주 정보</div>
              <p className="mt-1 text-[11.5px] leading-5 text-[var(--app-copy-soft)]">
                저장 후 사주보기, 오늘운세, 궁합 입력에 같은 바탕으로 불러옵니다.
              </p>
            </div>

            {/* 사주 입력폼(intake)·궁합 입력과 동일한 UnifiedBirthInfoFields 로 통일.
                년/월/일/시/출생지/성별/양력음력/시간 설정 입력 UX 를 사주 풀이 입력과 일치시킨다. */}
            <UnifiedBirthInfoFields
              idPrefix="signup"
              draft={buildSignupBirthDraft(signupForm)}
              onChange={patchSignupBirthDraft}
              dateInputVariant="select"
              visibleSections={['date', 'gender', 'location-time']}
              locationLoading={signupLocationStatus === 'loading'}
              locationMessage={signupLocationMessage}
              locationResults={signupLocationResults}
              onLocationSearch={searchSignupBirthLocationCoordinates}
              onPresetSelect={selectSignupBirthLocation}
              onLocationResultSelect={applySignupBirthLocationSearchResult}
            />
          </section>

          <Button
            type="submit"
            disabled={disabled || isSubmittingSignup}
            size="lg"
            className="h-12 w-full rounded-[14px] text-[15px] font-extrabold"
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
              className="motion-input-effect h-12 w-full rounded-[14px] border border-[var(--app-line)] bg-white px-3.5 text-[14.5px] font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
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
              className="motion-input-effect h-12 w-full rounded-[14px] border border-[var(--app-line)] bg-white px-3.5 text-[14.5px] font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
            />
          </div>
          <Button
            type="submit"
            disabled={disabled || isSubmittingLogin}
            className="h-12 w-full rounded-[14px] text-base font-bold"
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
              간지사주의 로그인 아이디는 이메일입니다. 가입했을 가능성이 있는 이메일을 입력하면 확인 링크와 새 비밀번호 설정 링크를 보내드립니다.
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
                className="motion-input-effect h-12 w-full rounded-[14px] border border-[var(--app-line)] bg-white px-3.5 text-[14.5px] font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
              />
            </div>
          </section>
          <Button
            type="submit"
            disabled={disabled || isSubmittingRecovery}
            className="h-12 w-full rounded-[14px] text-base font-bold"
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
                  className="motion-input-effect h-12 w-full rounded-[14px] border border-[var(--app-line)] bg-white px-3.5 text-[14.5px] font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
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
                  className="motion-input-effect h-12 w-full rounded-[14px] border border-[var(--app-line)] bg-white px-3.5 text-[14.5px] font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
                />
              </div>
            </div>
          </section>
          <Button
            type="submit"
            disabled={disabled || isSubmittingReset}
            className="h-12 w-full rounded-[14px] text-base font-bold"
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
              카카오 로그인
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
              Google 로그인
            </Button>
          </div>
        </>
      ) : null}

      <p className="pt-4 text-xs leading-6 text-[var(--app-copy-soft)]">
        회원가입 또는 로그인 시 <LegalLinks className="text-[var(--app-copy-muted)]" />에 동의합니다.
      </p>
      {/* 2026-05-18 Phase 5-C: 고객센터 링크 (사용자 directive 필수) */}
      <p className="text-[11.5px] leading-6 text-[var(--app-copy-muted)]">
        로그인 실패 또는 계정 안내가 필요하시면{' '}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="font-bold text-[var(--app-pink-strong)] underline"
        >
          {SUPPORT_EMAIL}
        </a>
        {' '}또는{' '}
        <a href="/help" className="font-bold text-[var(--app-pink-strong)] underline">
          고객센터
        </a>
        로 문의해 주세요.
      </p>
    </div>
  );
}

function LoginScaffold() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<LoginMode>(() =>
    getInitialLoginMode(searchParams.get('mode'))
  );
  const isGateway = mode === 'gateway';

  // 리디자인 2026-05-13: gateway 모드는 자체 그라데이션 + 干 hero 사용.
  // 카드 모드(login/signup/recover/reset)는 기존 달 lockup + card 보존.
  return (
    <AppPage
      className={`gangi-login-subpage gangi-auth-page flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-6 py-10 text-[var(--app-ink)] ${
        isGateway ? 'gangi-auth-gateway-page' : ''
      }`}
    >
      {isGateway ? (
        <div
          className="mx-auto flex w-full max-w-[420px] flex-col items-stretch px-6 py-10"
          style={{
            background:
              'linear-gradient(180deg, #fff 0%, var(--app-pink-soft) 100%)',
            borderRadius: 28,
          }}
        >
          <LoginContent mode={mode} setMode={setMode} />
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-pink)] text-xl font-bold text-white shadow-[0_16px_32px_rgba(216,27,114,0.22)]">
              달
            </div>
            <div className=" text-lg font-semibold text-[var(--app-ink)]">간지사주</div>
            <div className="text-xs text-[var(--app-copy-muted)]">오늘운세 · 타로 · 사주</div>
          </div>
          <div className="w-full">
            <LoginContent mode={mode} setMode={setMode} />
          </div>
        </>
      )}
    </AppPage>
  );
}

export default function LoginPage() {
  return (
    <AppShell className="gangi-subpage-shell" footer={false}>
      {/* 인증 버튼 형태를 유지하는 Suspense fallback. */}
      <Suspense fallback={<LoginPageFallback />}>
        <LoginScaffold />
      </Suspense>
    </AppShell>
  );
}

function LoginPageFallback() {
  return (
    <div
      aria-label="간지사주 로그인"
      className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center gap-5 px-5 py-8"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-[18px] text-3xl font-extrabold text-white shadow-[0_14px_28px_rgba(216,27,114,0.32)]"
          style={{
            background:
              'linear-gradient(135deg, var(--app-pink) 0%, var(--app-pink-strong) 100%)',
            fontFamily: 'var(--font-han)',
          }}
        >
          干
        </div>
        <div>
          <div
            className="text-[28px] font-extrabold leading-tight text-[var(--app-ink)]"
            style={{ fontFamily: 'var(--font-han)' }}
          >
            간지사주
          </div>
          <p className="mt-2 text-[13px] font-semibold leading-6 text-[var(--app-copy-muted)]">
            간지사주는 사주, 오늘운세, 보관함과 유료 이용내역을 한 계정에서 이어 보는 서비스입니다.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <button
          type="button"
          disabled
          className="h-[52px] w-full rounded-[14px] text-[14.5px] font-extrabold opacity-80"
          style={{
            background: '#fee500',
            color: '#191919',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          카카오 로그인
        </button>
        <button
          type="button"
          disabled
          className="h-[52px] w-full rounded-[14px] bg-white text-[14.5px] font-bold text-[#1f1f1f] opacity-80"
          style={{ border: '1.5px solid var(--app-line)' }}
        >
          Google 로그인
        </button>
      </div>
      <div className="flex justify-center gap-3 text-[11.5px] text-[var(--app-copy-muted)]">
        <a href="/terms" className="underline">
          이용약관
        </a>
        <a href="/privacy" className="underline">
          개인정보처리방침
        </a>
        <a href="/help" className="underline">
          고객센터
        </a>
      </div>
      <p className="text-center text-[11.5px] leading-6 text-[var(--app-copy-muted)]">
        고객센터 이메일:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-[var(--app-pink-strong)] underline">
          {SUPPORT_EMAIL}
        </a>
        <br />
        로그인 실패 시 위 이메일 또는 고객센터로 문의해 주세요.
      </p>
    </div>
  );
}
