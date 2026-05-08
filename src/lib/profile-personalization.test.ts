import assert from 'node:assert/strict';
import type { UserProfile } from '@/lib/profile';
import {
  buildProfileReadingSlug,
  buildStarSignSlugFromProfile,
  buildZodiacSlugFromProfile,
  deriveZodiacSlugFromBirthInput,
  deriveStarSignSlug,
  deriveZodiacSlug,
} from './profile-personalization';

declare const test: (name: string, fn: () => void) => void;

function createProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    displayName: '테스트',
    preferredCounselor: null,
    calendarType: 'solar',
    timeRule: 'standard',
    birthYear: 1982,
    birthMonth: 1,
    birthDay: 29,
    birthHour: 8,
    birthMinute: 45,
    birthLocationCode: '',
    birthLocationLabel: '',
    birthLatitude: null,
    birthLongitude: null,
    solarTimeMode: 'standard',
    gender: 'male',
    note: '',
    ...overrides,
  };
}

test('deriveStarSignSlug resolves western sign boundaries correctly', () => {
  assert.equal(deriveStarSignSlug(1, 29), 'aquarius');
  assert.equal(deriveStarSignSlug(12, 30), 'capricorn');
  assert.equal(deriveStarSignSlug(3, 21), 'aries');
});

test('deriveZodiacSlug resolves simple calendar-year zodiac fallback', () => {
  assert.equal(deriveZodiacSlug(1982), 'dog');
  assert.equal(deriveZodiacSlug(1984), 'rat');
  assert.equal(deriveZodiacSlug(1991), 'goat');
});

test('profile personalization helpers build slugs from saved MY profile', () => {
  const profile = createProfile();

  assert.equal(buildStarSignSlugFromProfile(profile), 'aquarius');
  assert.equal(buildZodiacSlugFromProfile(profile), 'rooster');
  assert.equal(buildProfileReadingSlug(profile), '1982-1-29-8-m45-male-key03773a8');
});

test('deriveZodiacSlugFromBirthInput follows saju year pillar instead of simple calendar year', () => {
  assert.equal(
    deriveZodiacSlugFromBirthInput({
      year: 1982,
      month: 1,
      day: 29,
      hour: 8,
      minute: 45,
      gender: 'male',
    }),
    'rooster'
  );
});

test('profile personalization helpers stay null when core birth profile is missing', () => {
  const profile = createProfile({
    birthYear: null,
    birthMonth: null,
    birthDay: null,
  });

  assert.equal(buildStarSignSlugFromProfile(profile), null);
  assert.equal(buildZodiacSlugFromProfile(profile), null);
  assert.equal(buildProfileReadingSlug(profile), null);
});
