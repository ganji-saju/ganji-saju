'use client';

// /start 허브의 '오늘의 운세' 제출 헬퍼.
// today-fortune-experience.tsx handleSubmit() (today-fortune-experience.tsx:151-217) 를
// UnifiedBirthProfile 입력 버전으로 이식한 것 — 동일 요청 계약(POST /api/today-fortune 바디,
// 결과 캐시 저장 키, 결과 페이지 href)을 유지한다.
import {
  DEFAULT_MOONLIGHT_COUNSELOR,
  MOONLIGHT_COUNSELOR_STORAGE_KEY,
  normalizeMoonlightCounselor,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import { fetchProfileCounselorPreference } from '@/features/counselor/use-preferred-counselor';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import type { TodayFortuneBirthPayload, TodayFortuneFreeResult } from '@/lib/today-fortune/types';
import { applyProfileToTodayPayload, type UnifiedBirthProfile } from './birth-profile-store';
import { trackMoonlightEvent } from '@/lib/analytics';

const INITIAL_TODAY_PAYLOAD: TodayFortuneBirthPayload = {
  concernId: 'general',
  calendarType: 'solar',
  timeRule: 'standard',
  year: '',
  month: '',
  day: '',
  hour: '',
  minute: '',
  unknownBirthTime: false,
  gender: '',
  birthLocationCode: '',
  birthLocationLabel: '',
  birthLatitude: '',
  birthLongitude: '',
};

// usePreferredCounselor() 훅(use-preferred-counselor.ts:82-113)의 우선순위를 이식.
// 이 헬퍼는 훅이 아니라 일반 async 함수라 훅을 직접 쓸 수 없어, 훅과 동일한 순서로 해석한다:
//   (1) localStorage 값이 있으면 그대로 사용,
//   (2) 없으면 /api/profile GET 으로 저장된 preferredCounselor 조회(다른 기기 설정/로컬 초기화 대응),
//   (3) 둘 다 없을 때만 DEFAULT 로 폴백.
// (2)는 훅의 fetchProfileCounselorPreference 를 그대로 재사용 — 인증 안 됐거나 없으면 null 반환.
async function resolveCounselorPreference(): Promise<MoonlightCounselorId> {
  if (typeof window !== 'undefined') {
    const stored = normalizeMoonlightCounselor(
      window.localStorage.getItem(MOONLIGHT_COUNSELOR_STORAGE_KEY)
    );
    if (stored) return stored;
  }

  const profileCounselor = await fetchProfileCounselorPreference();
  return profileCounselor ?? DEFAULT_MOONLIGHT_COUNSELOR;
}

interface TodayFortuneApiResponse {
  ok?: boolean;
  result?: TodayFortuneFreeResult;
  error?: string;
}

const TODAY_RESULT_STORAGE_PREFIX = 'moonlight:today-fortune:result:v3:';

function buildResultStorageKey(sourceSessionId: string, dateKey: string) {
  return `${TODAY_RESULT_STORAGE_PREFIX}${sourceSessionId}:${dateKey}`;
}

export async function submitTodayFromProfile(
  profile: UnifiedBirthProfile,
  opts?: { concernId?: string; from?: string }
): Promise<string> {
  const concernId = normalizeConcernId(opts?.concernId ?? 'general');
  // from 기본값 'today-fortune' — 기존 today-fortune-experience 호출부 귀속 보존.
  // /start 딥링크(?next=today)는 from='start' 를 넘겨 인입 출처를 구분한다.
  const from = opts?.from ?? 'today-fortune';
  const payload = applyProfileToTodayPayload(INITIAL_TODAY_PAYLOAD, profile);
  const counselorId = await resolveCounselorPreference();

  const response = await fetch('/api/today-fortune', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      concernId,
      counselorId,
      // UnifiedIntake 이름 입력을 API 로 전달 — /api/today-fortune 이 rawPayload.name 을
      // resolveTodayDisplayName 의 clientName 으로 사용(우선순위: 프로필 display_name → 소셜 → 클라이언트입력).
      // 없으면 hero 가 '달빛이' fallback 으로 표시되던 문제(UnifiedIntake 이름 필드 유실) 수정.
      name: profile.name,
    }),
  });
  const data = (await response.json().catch(() => null)) as TodayFortuneApiResponse | null;

  if (!response.ok || !data?.ok || !data.result) {
    throw new Error(data?.error ?? '무료 결과를 만드는 중 오류가 있었습니다.');
  }

  // Task6b — 인입 퍼널 회귀 수정: 제출 성공 시 birth_form_completed + today_free_result_viewed 복원.
  trackMoonlightEvent('birth_form_completed', {
    from,
    concern: concernId,
  });
  trackMoonlightEvent('today_free_result_viewed', {
    from,
    concern: data.result.concernId,
    sourceSessionId: data.result.sourceSessionId,
  });

  try {
    window.localStorage.setItem('moonlight:fortune-session:last', data.result.sourceSessionId);
    window.sessionStorage.setItem(
      buildResultStorageKey(data.result.sourceSessionId, data.result.dateKey),
      JSON.stringify(data.result)
    );
  } catch {
    // Private browsing can block storage; navigation still continues.
  }

  return `/today-fortune/result?sourceSessionId=${encodeURIComponent(data.result.sourceSessionId)}&concern=${encodeURIComponent(data.result.concernId)}`;
}
