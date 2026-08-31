// 2026-08-31 — 멤버십 가족 열람 범위의 매칭 시맨틱 고정.
//   규칙: 프로필(본인/가족) → BirthInput → 사주 정체성(4기둥+성별)이 현재 reading 과
//   같으면 열람. 이름·분(같은 시진)·입력 경로 차이는 흡수, 생시가 기둥을 바꾸면 거부.
import assert from 'node:assert/strict';
import type { FamilyProfile } from '@/lib/profile';
import { hasCoreBirthProfile, toBirthInputFromProfile } from '@/lib/profile';
import { sajuIdentityKey } from '@/lib/saju/reading-identity';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => void) => void;

function familyProfile(overrides: Partial<FamilyProfile> = {}): FamilyProfile {
  return {
    id: 'fam-1',
    label: '어머니',
    relationship: '부모',
    calendarType: 'solar',
    timeRule: 'standard',
    birthYear: 1965,
    birthMonth: 7,
    birthDay: 21,
    birthHour: 10,
    birthMinute: 30,
    birthLocationCode: null,
    birthLocationLabel: '',
    birthLatitude: null,
    birthLongitude: null,
    solarTimeMode: 'standard',
    gender: 'female',
    note: '',
    createdAt: '2026-08-31T00:00:00Z',
    ...overrides,
  };
}

function profileIdentity(profile: FamilyProfile) {
  assert.ok(hasCoreBirthProfile(profile), '테스트 프로필 출생정보 미완성');
  return sajuIdentityKey(toBirthInputFromProfile(profile));
}

function readingInput(overrides: Partial<BirthInput> = {}): BirthInput {
  return {
    name: '테스트어머니',
    calendarType: 'solar',
    timeRule: 'standard',
    year: 1965,
    month: 7,
    day: 21,
    hour: 10,
    minute: 5,
    gender: 'female',
    ...overrides,
  } as BirthInput;
}

test('가족 프로필과 같은 사주의 reading 은 이름·분(같은 시진) 차이를 흡수해 매칭된다', () => {
  const familyIdentity = profileIdentity(familyProfile());
  const currentIdentity = sajuIdentityKey(readingInput());
  assert.ok(familyIdentity, '프로필 정체성 계산 실패');
  assert.equal(familyIdentity, currentIdentity);
});

test('생시가 시진(기둥)을 바꾸면 다른 사주로 판정된다 — 멤버십 가족 범위 밖', () => {
  const familyIdentity = profileIdentity(familyProfile());
  const differentHour = sajuIdentityKey(readingInput({ hour: 23, minute: 30 }));
  assert.ok(differentHour, '비교 정체성 계산 실패');
  assert.notEqual(familyIdentity, differentHour);
});

test('성별이 다르면 같은 생년월일시라도 다른 사주로 판정된다', () => {
  const familyIdentity = profileIdentity(familyProfile());
  const differentGender = sajuIdentityKey(readingInput({ gender: 'male' }));
  assert.notEqual(familyIdentity, differentGender);
});
