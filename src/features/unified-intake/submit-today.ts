'use client';

// /start 허브의 '오늘의 운세' 제출 헬퍼.
// today-fortune-experience.tsx handleSubmit() (today-fortune-experience.tsx:151-217) 를
// UnifiedBirthProfile 입력 버전으로 이식한 것 — 동일 요청 계약(POST /api/today-fortune 바디,
// 결과 캐시 저장 키, 결과 페이지 href)을 유지한다.
import {
  DEFAULT_MOONLIGHT_COUNSELOR,
  MOONLIGHT_COUNSELOR_STORAGE_KEY,
  normalizeMoonlightCounselor,
} from '@/lib/counselors';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import type { TodayFortuneBirthPayload, TodayFortuneFreeResult } from '@/lib/today-fortune/types';
import { applyProfileToTodayPayload, type UnifiedBirthProfile } from './birth-profile-store';

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

// use-preferred-counselor.ts readStoredCounselorPreference 이식.
// 이 헬퍼는 훅이 아니라 일반 함수라 usePreferredCounselor() 훅을 그대로 쓸 수 없어,
// 훅이 읽는 것과 동일한 localStorage 키를 직접 읽는다(요청 바디 계약 동일 유지).
function readStoredCounselorPreference() {
  if (typeof window === 'undefined') return DEFAULT_MOONLIGHT_COUNSELOR;
  return (
    normalizeMoonlightCounselor(window.localStorage.getItem(MOONLIGHT_COUNSELOR_STORAGE_KEY)) ??
    DEFAULT_MOONLIGHT_COUNSELOR
  );
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
  opts?: { concernId?: string }
): Promise<string> {
  const concernId = normalizeConcernId(opts?.concernId ?? 'general');
  const payload = applyProfileToTodayPayload(INITIAL_TODAY_PAYLOAD, profile);
  const counselorId = readStoredCounselorPreference();

  const response = await fetch('/api/today-fortune', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      concernId,
      counselorId,
    }),
  });
  const data = (await response.json().catch(() => null)) as TodayFortuneApiResponse | null;

  if (!response.ok || !data?.ok || !data.result) {
    throw new Error(data?.error ?? '무료 결과를 만드는 중 오류가 있었습니다.');
  }

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
