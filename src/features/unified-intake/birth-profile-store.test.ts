// 2026-08-31 — 🔴 본인 프로필 덮어쓰기 사고 가드.
//   가족 칩으로 채운 폼('family' 소스)이 제출되면 본인 프로필 자동저장을 건너뛰어야 한다.
//   소스가 normalize/저장 왕복에서 유실되면(기본 'manual' 회귀) 자동저장이 다시 살아나
//   가족 사주가 본인 프로필을 덮어쓴다 — 실제 발생했던 사고.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { shouldAutoSavePersonalProfile } from '@/features/saju-intake/onboarding-storage';
import { createEmptyBirthProfile, normalizeBirthProfile } from './birth-profile-store';

declare const test: (name: string, fn: () => void) => void;

test('loadedProfileSource 는 normalize 왕복에서 유실되지 않는다', () => {
  assert.equal(createEmptyBirthProfile().loadedProfileSource, 'manual');
  assert.equal(
    normalizeBirthProfile({ ...createEmptyBirthProfile(), loadedProfileSource: 'family' })
      .loadedProfileSource,
    'family'
  );
  assert.equal(
    normalizeBirthProfile({ ...createEmptyBirthProfile(), loadedProfileSource: 'self' })
      .loadedProfileSource,
    'self'
  );
});

test('family 소스는 본인 프로필 자동저장 대상이 아니다', () => {
  assert.equal(shouldAutoSavePersonalProfile('family'), false);
  assert.equal(shouldAutoSavePersonalProfile('manual'), true);
  assert.equal(shouldAutoSavePersonalProfile('self'), true);
});

test('제출 경로는 draft 가 아니라 원본 profile 의 소스로 자동저장을 판정한다', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/features/unified-intake/submit-saju.ts'),
    'utf8'
  );
  assert.ok(
    source.includes('shouldAutoSavePersonalProfile(profile.loadedProfileSource)'),
    'draft.loadedProfileSource 로 되돌리면 소스 유실(항상 manual)로 덮어쓰기 사고가 재발한다'
  );
});
