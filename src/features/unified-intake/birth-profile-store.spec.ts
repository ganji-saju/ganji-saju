import { describe, it, expect, beforeEach } from 'vitest';
import {
  BIRTH_PROFILE_STORAGE_KEY,
  createEmptyBirthProfile,
  normalizeBirthProfile,
  hasCompleteBirthProfile,
  loadBirthProfile,
  saveBirthProfile,
  clearBirthProfile,
  applyProfileToSajuDraft,
  applyProfileToTodayPayload,
} from './birth-profile-store';
import {
  createInitialOnboardingDraft,
  RECENT_GUEST_INPUT_STORAGE_KEY,
} from '@/features/saju-intake/onboarding-storage';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

beforeEach(() => {
  // 저장소 모듈이 window.localStorage 를 읽으므로 node 환경에 shim 주입.
  (globalThis as unknown as { window: { localStorage: MemStorage } }).window = {
    localStorage: new MemStorage(),
  };
});

function completeProfile() {
  return normalizeBirthProfile({
    name: '홍길동',
    year: '1990', month: '3', day: '15',
    hour: '9', unknownBirthTime: false,
    gender: 'male',
    birthLocationCode: 'KR-11', birthLocationLabel: '서울',
    birthLatitude: '37.5', birthLongitude: '127.0',
  });
}

describe('birth-profile-store', () => {
  it('normalize fills defaults and clamps unknowns', () => {
    const p = normalizeBirthProfile({ calendarType: 'bogus' as never, focusTopic: 'nope' as never });
    expect(p.calendarType).toBe('solar');
    expect(p.focusTopic).toBe('today');
    expect(p.name).toBe('');
  });

  it('hasCompleteBirthProfile requires date+gender+location', () => {
    expect(hasCompleteBirthProfile(createEmptyBirthProfile())).toBe(false);
    expect(hasCompleteBirthProfile(completeProfile())).toBe(true);
  });

  it('save then load round-trips a complete profile', () => {
    saveBirthProfile(completeProfile());
    const loaded = loadBirthProfile();
    expect(loaded?.name).toBe('홍길동');
    expect(loaded?.birthLocationCode).toBe('KR-11');
  });

  it('load absorbs legacy saju recent-guest-input when own key missing', () => {
    const legacy = { ...createInitialOnboardingDraft(), year: '1988', month: '6', day: '2', gender: 'female', birthLocationCode: 'KR-26', birthLocationLabel: '부산', nickname: '순이' };
    window.localStorage.setItem(RECENT_GUEST_INPUT_STORAGE_KEY, JSON.stringify(legacy));
    const loaded = loadBirthProfile();
    expect(loaded?.year).toBe('1988');
    expect(loaded?.name).toBe('순이');
    // absorption persists to the new key
    expect(window.localStorage.getItem(BIRTH_PROFILE_STORAGE_KEY)).not.toBeNull();
  });

  it('applyProfileToSajuDraft maps name→nickname and unknown time clears hour', () => {
    const p = normalizeBirthProfile({ ...completeProfile(), unknownBirthTime: true, hour: '' });
    const draft = applyProfileToSajuDraft(createInitialOnboardingDraft(), p);
    expect(draft.nickname).toBe('홍길동');
    expect(draft.hour).toBe('');
  });

  it('applyProfileToTodayPayload carries unknownBirthTime through', () => {
    const base = applyProfileToTodayPayload(
      { concernId: 'general', calendarType: 'solar', timeRule: 'standard', year: '', month: '', day: '', hour: '', minute: '', unknownBirthTime: false, gender: '', birthLocationCode: '', birthLocationLabel: '', birthLatitude: '', birthLongitude: '' },
      completeProfile()
    );
    expect(base.year).toBe('1990');
    expect(base.gender).toBe('male');
  });

  it('clear removes the key', () => {
    saveBirthProfile(completeProfile());
    clearBirthProfile();
    expect(loadBirthProfile()).toBeNull();
  });
});
