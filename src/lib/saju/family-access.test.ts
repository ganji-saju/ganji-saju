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

// 2026-08-31 제보 — 가족 칩 slug 는 이름을 해시로만 담아 /saju/[slug] 복원 시 input.name 이
// 비고, 화면 호명이 전부 '달빛이님'으로 떨어졌다. 수정 = 정체성 매칭으로 subjectName 해석.
// 배선이 input.name 단독으로 되돌아가면 재발하므로 소스 스캔으로 고정한다.
import fs from 'node:fs';
import path from 'node:path';

test('사주 화면 호명은 subjectName(정체성 매칭) 배선을 유지한다', () => {
  const resultPage = fs.readFileSync(
    path.join(process.cwd(), 'src/app/saju/[slug]/page.tsx'),
    'utf8'
  );
  assert.ok(
    resultPage.includes('`${subjectName ?? MOONLIGHT_FALLBACK_DISPLAY_NAME}님 사주`'),
    '/saju/[slug] 헤더가 subjectName 을 쓰지 않으면 가족 사주가 달빛이님으로 재발한다'
  );
  assert.ok(
    resultPage.includes('viewerName={subjectName ?? MOONLIGHT_FALLBACK_DISPLAY_NAME}'),
    '수호신 카드 호명이 subjectName 배선을 잃었다'
  );

  const deepPage = fs.readFileSync(
    path.join(process.cwd(), 'src/app/saju/[slug]/deep/page.tsx'),
    'utf8'
  );
  assert.ok(
    deepPage.includes('resolveFamilySubjectName(input)'),
    '대운 페이지가 정체성 매칭 호명을 잃었다'
  );

  // LLM 총평에는 뷰어 의존 이름 주입 금지(캐시 키가 slug 파생 — 남의 이름 든 본문 서빙 위험).
  assert.ok(
    resultPage.includes('userName: input.name?.trim() || null'),
    'LLM 총평 userName 은 input.name 유지가 정본 — subjectName 주입은 캐시 오염'
  );
});
