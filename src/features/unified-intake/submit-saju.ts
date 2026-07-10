'use client';

// /start 허브의 '내 사주' 제출 헬퍼.
// saju-intake-page.tsx submit() (saju-intake-page.tsx:793-954) 를
// UnifiedBirthProfile 입력 버전으로 이식한 것 — 동일 요청 계약(POST /api/readings 바디,
// 성공/실패 href 규칙, 로그인 프로필 자동저장)을 유지한다. from 파라미터만 'start' 로 교체.
import type { TasteProductId } from '@/lib/payments/catalog';
import { toSlug } from '@/lib/saju/pillars';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';
import { trackMoonlightEvent } from '@/lib/analytics';
import {
  createInitialOnboardingDraft,
  shouldAutoSavePersonalProfile,
  toUserSituation,
} from '@/features/saju-intake/onboarding-storage';
import { applyProfileToSajuDraft, saveBirthProfile, type UnifiedBirthProfile } from './birth-profile-store';
import { buildSajuPostSubmitHref } from './saju-post-submit-href';

export interface SubmitSajuOptions {
  product?: TasteProductId | null;
  plan?: 'lifetime' | null;
  from?: string;
}

export async function submitSajuFromProfile(
  profile: UnifiedBirthProfile,
  opts?: SubmitSajuOptions
): Promise<string> {
  // from 기본값 'start' — /start 허브 기존 동작 보존. /saju/new 는 from='saju-new' 를 넘긴다.
  const product = opts?.product ?? null;
  const plan = opts?.plan ?? null;
  const from = opts?.from ?? 'start';
  // 제출 시점 재확정 — UnifiedIntake 가 이미 저장했지만 여기서도 공용 키를 갱신한다.
  saveBirthProfile(profile);

  const draft = applyProfileToSajuDraft(createInitialOnboardingDraft(), profile);

  const parsed = resolveUnifiedBirthInput(
    {
      calendarType: draft.calendarType,
      timeRule: draft.timeRule,
      year: draft.year,
      month: draft.month,
      day: draft.day,
      hour: draft.hour,
      minute: draft.minute,
      unknownBirthTime: draft.hour === '',
      gender: draft.gender,
      birthLocationCode: draft.birthLocationCode,
      birthLocationLabel: draft.birthLocationLabel,
      birthLatitude: draft.birthLatitude,
      birthLongitude: draft.birthLongitude,
    },
    { requireGender: true }
  );

  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const readingInput = {
    ...parsed.input,
    name: draft.nickname.trim() || undefined,
  };
  const userSituation = toUserSituation(draft);

  // 원본(saju-intake-page.tsx submit())은 fetch 자체가 실패(catch)한 경우에만
  // toSlug fallback href 로 넘어간다. 응답은 왔지만 !ok/!id 인 명시적 API 실패는
  // 원본에서 폼에 머무르며 에러만 노출하므로, 여기서는 그 경우를 그대로 throw 해
  // 상위(페이지)가 네비게이션하지 않고 에러를 보여줄 수 있게 한다.
  let response: Response;
  try {
    response = await fetch('/api/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...readingInput, userSituation }),
    });
  } catch {
    const fallbackId = toSlug(readingInput);
    // Task6b — fetch 자체가 실패해도(fallback 경로) 폼 제출은 완료된 것이므로 동일하게 발화.
    trackMoonlightEvent('birth_form_completed', {
      from,
      sourceSessionId: fallbackId,
      focusTopic: profile.focusTopic,
      calendarType: profile.calendarType,
      timeRule: profile.timeRule,
      unknownBirthTime: profile.unknownBirthTime,
      layout: 'single',
    });
    return buildSajuPostSubmitHref(fallbackId, {
      focusTopic: draft.focusTopic,
      product,
      plan,
      from,
    });
  }

  const data = await response.json();
  if (!response.ok || !data.id) {
    throw new Error(data.error ?? '사주 결과를 생성하지 못했습니다.');
  }

  if (shouldAutoSavePersonalProfile(draft.loadedProfileSource)) {
    void fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: draft.nickname.trim() || '나',
        calendarType: draft.calendarType,
        timeRule: draft.timeRule,
        unknownBirthTime: readingInput.unknownTime,
        birthYear: readingInput.year,
        birthMonth: readingInput.month,
        birthDay: readingInput.day,
        birthHour: readingInput.hour ?? null,
        birthMinute: readingInput.minute ?? null,
        birthLocationCode: readingInput.birthLocation?.code ?? draft.birthLocationCode ?? null,
        birthLocationLabel: readingInput.birthLocation?.label ?? '',
        birthLatitude: readingInput.birthLocation?.latitude ?? null,
        birthLongitude: readingInput.birthLocation?.longitude ?? null,
        solarTimeMode: readingInput.solarTimeMode ?? 'standard',
        gender: readingInput.gender ?? null,
      }),
    }).catch(() => undefined);
  }

  // Task6b — 인입 퍼널 회귀 수정: 제출 성공 시 birth_form_completed 복원.
  trackMoonlightEvent('birth_form_completed', {
    from,
    sourceSessionId: data.id,
    focusTopic: profile.focusTopic,
    calendarType: profile.calendarType,
    timeRule: profile.timeRule,
    unknownBirthTime: profile.unknownBirthTime,
    layout: 'single',
  });

  return buildSajuPostSubmitHref(data.id, {
    focusTopic: draft.focusTopic,
    product,
    plan,
    from,
  });
}
