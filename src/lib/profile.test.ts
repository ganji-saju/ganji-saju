import assert from 'node:assert/strict';
import { toSlug } from '@/lib/saju/pillars';
import { toBirthInputFromProfile, type UserProfile } from './profile';

declare const test: (name: string, fn: () => void) => void;

function createProfile(
  overrides: Partial<Omit<UserProfile, 'birthYear' | 'birthMonth' | 'birthDay'>> & {
    birthYear?: number;
    birthMonth?: number;
    birthDay?: number;
  } = {}
): UserProfile & { birthYear: number; birthMonth: number; birthDay: number } {
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

test('toBirthInputFromProfile preserves solar profiles as the existing engine contract', () => {
  const input = toBirthInputFromProfile(createProfile());

  assert.equal(input.year, 1982);
  assert.equal(input.month, 1);
  assert.equal(input.day, 29);
  assert.equal(input.hour, 8);
  assert.equal(input.minute, 45);
  assert.equal(input.name, '테스트');
  assert.equal(input.solarTimeMode, 'standard');
  assert.equal(toSlug(input), '1982-1-29-8-m45-male-key03773a8');
});

test('toBirthInputFromProfile converts lunar profiles before returning BirthInput', () => {
  const input = toBirthInputFromProfile(
    createProfile({
      calendarType: 'lunar',
      birthYear: 1982,
      birthMonth: 1,
      birthDay: 5,
    })
  );

  assert.equal(input.year, 1982);
  assert.equal(input.month, 1);
  assert.equal(input.day, 29);
});

test('toBirthInputFromProfile derives longitude correction from timeRule and location', () => {
  const input = toBirthInputFromProfile(
    createProfile({
      timeRule: 'trueSolarTime',
      birthLocationCode: 'seoul',
      birthLocationLabel: '서울',
      birthLatitude: 37.5665,
      birthLongitude: 126.978,
    })
  );

  assert.equal(input.solarTimeMode, 'longitude');
  assert.equal(input.birthLocation?.label, '서울');
});
