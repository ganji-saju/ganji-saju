import { describe, expect, it } from 'vitest';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';
import { toSlug } from '@/lib/saju/pillars';
import { createInitialOnboardingDraft } from '@/features/saju-intake/onboarding-storage';
import { applyProfileToSajuDraft, type UnifiedBirthProfile } from '@/features/unified-intake/birth-profile-store';
import { toPartnerBirthInput, type PartnerBirthForm } from './partner-birth';

// 간지사주 /saju/new 제출 경로(submit-saju.ts)를 그대로 재현 — 출생지 없이 입력한 경우.
function slugViaGanjiIntake(form: PartnerBirthForm) {
  const profile = {
    ...form, name: '', birthLocationCode: '', birthLocationLabel: '', birthLatitude: '', birthLongitude: '',
    timeRule: 'standard', solarTimeMode: 'standard',
  } as unknown as UnifiedBirthProfile;
  const d = applyProfileToSajuDraft(createInitialOnboardingDraft(), profile);
  const parsed = resolveUnifiedBirthInput(
    {
      calendarType: d.calendarType, timeRule: d.timeRule, year: d.year, month: d.month, day: d.day,
      hour: d.hour, minute: d.minute, unknownBirthTime: d.hour === '', gender: d.gender,
      birthLocationCode: d.birthLocationCode, birthLocationLabel: d.birthLocationLabel,
      birthLatitude: d.birthLatitude, birthLongitude: d.birthLongitude,
    },
    { requireGender: true },
  );
  if (!parsed.ok) throw new Error(parsed.error);
  return toSlug(parsed.input);
}

const base: PartnerBirthForm = { calendarType: 'lunar', year: '1990', month: '5', day: '15', hour: '14', unknownBirthTime: false, gender: 'female' };

describe('toPartnerBirthInput', () => {
  it.each([
    ['음력', base],
    ['양력', { ...base, calendarType: 'solar' as const }],
    ['시간 모름', { ...base, unknownBirthTime: true, hour: '' }],
    ['시간 모름인데 시간 값이 남아 있음', { ...base, unknownBirthTime: true, hour: '9' }],
  ])('%s — 간지사주 입력과 같은 사주 주소', (_label, form) => {
    const result = toPartnerBirthInput(form);
    expect(result.ok).toBe(true);
    if (result.ok) expect(toSlug(result.input)).toBe(slugViaGanjiIntake({ ...form, hour: form.unknownBirthTime ? '' : form.hour }));
  });

  it('음력 1990-5-15 14시 여성 = 1990-6-7-14-female-… (실측 고정값)', () => {
    const result = toPartnerBirthInput(base);
    expect(result.ok && toSlug(result.input).startsWith('1990-6-7-14-female-')).toBe(true);
  });

  it('없는 날짜는 간지사주와 같은 안내', () => {
    expect(toPartnerBirthInput({ ...base, calendarType: 'solar', month: '2', day: '31' })).toEqual({ ok: false, error: '생년월일을 다시 확인해 주세요.' });
  });

  it('성별 없으면 실패', () => {
    expect(toPartnerBirthInput({ ...base, gender: '' }).ok).toBe(false);
  });
});

describe('음력 없는 날짜', () => {
  it('음력 1990-4-30 은 던지지 않고 다시 확인 안내', () => {
    expect(toPartnerBirthInput({ ...base, month: '4', day: '30' })).toEqual({ ok: false, error: '생년월일을 다시 확인해 주세요.' });
  });
});
