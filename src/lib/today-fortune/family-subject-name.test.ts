// 2026-08-31 — 🔴 "가족 사주를 봤는데 계정 주인 이름이 뜬다" 회귀 가드.
//   원인 구조: 이름 해석이 "이 계정의 이름"을 답하고 "이 사주 주인의 이름"을 답하지 않았다.
//   무료 hero 는 폼 이름(clientName), 유료 상세·달력은 스냅샷 경로(resolveNamedReadingInput)로
//   갈라져 있어 한쪽만 고치면 같은 날 무료="어머니" / 유료="김영민" 불일치가 생긴다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  applyDisplayNameToInput,
  resolveNamedReadingInput,
  type SnapshotDisplayNameDeps,
} from './result-snapshots';
import { todayFortuneCacheVersion } from '@/server/ai/today-fortune/cache';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const MOTHER: BirthInput = {
  calendarType: 'solar',
  timeRule: 'standard',
  year: 1965,
  month: 7,
  day: 21,
  hour: 10,
  minute: 30,
  gender: 'female',
} as BirthInput;

function deps(over: Partial<SnapshotDisplayNameDeps> = {}): SnapshotDisplayNameDeps {
  return {
    loadProfileDisplayName: async () => '김영민', // 계정 주인
    loadAuthMetadata: async () => ({ name: '소셜김영민' }),
    loadSubjectName: async () => null,
    loadRunDisplayName: async () => null,
    ...over,
  };
}

test('가족 사주 스냅샷은 등록된 가족 이름으로 호명한다(계정 주인 이름 아님)', async () => {
  const named = await resolveNamedReadingInput(
    MOTHER,
    'user-1',
    deps({ loadSubjectName: async () => '어머니' })
  );
  assert.equal(named.name, '어머니');
});

test('등록 가족이 아니면 계정 표시명으로 폴백한다(달빛이 회귀 방지)', async () => {
  const named = await resolveNamedReadingInput(MOTHER, 'user-1', deps());
  assert.equal(named.name, '김영민');
});

test('가족 조회가 실패해도 이름 해석은 계정 표시명으로 graceful degrade', async () => {
  const named = await resolveNamedReadingInput(
    MOTHER,
    'user-1',
    deps({
      loadSubjectName: async () => {
        throw new Error('boom');
      },
    })
  );
  assert.equal(named.name, '김영민');
});

test('등록 가족이 아니어도 그 실행에 쓴 폼 이름으로 호명한다(무료↔결제 상세 불일치 방지)', async () => {
  const named = await resolveNamedReadingInput(
    MOTHER,
    'user-1',
    deps({ loadRunDisplayName: async () => '철수' }),
    'session-1'
  );
  assert.equal(named.name, '철수');
});

test('실행 기록이 없으면 계정 표시명으로 폴백한다', async () => {
  const named = await resolveNamedReadingInput(
    MOTHER,
    'user-1',
    deps({ loadRunDisplayName: async () => null }),
    'session-1'
  );
  assert.equal(named.name, '김영민');
});

test('원본 reading.input 에 이름이 있으면 계정 표시명이 덮어쓰지 않는다', async () => {
  const withName = { ...MOTHER, name: '박순자' };
  assert.equal(applyDisplayNameToInput(withName, '김영민').name, '박순자');
  const named = await resolveNamedReadingInput(withName, 'user-1', deps());
  assert.equal(named.name, '박순자');
});

test('오늘운세 LLM 캐시 키는 사주 주체를 포함한다(같은 날 가족 교차 서빙 차단)', () => {
  const self = todayFortuneCacheVersion('v1', 'subject-self');
  const family = todayFortuneCacheVersion('v1', 'subject-family');
  assert.notEqual(self, family);
  // 주체를 못 구하면 기존 키 유지(캐시 동작 자체는 보존).
  assert.equal(todayFortuneCacheVersion('v1', null), 'v1');
});

test('배선 가드 — 오늘운세 라우트·스냅샷·달력이 주체 기반 해석을 유지한다', () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

  assert.ok(
    read('src/app/api/today-fortune/route.ts').includes('subjectKey: sajuIdentityKey(parsed.input)'),
    'LLM 캐시 키에서 주체가 빠지면 같은 날 다른 가족이 첫 사람 본문을 받는다'
  );
  const snapshots = read('src/lib/today-fortune/result-snapshots.ts');
  assert.ok(
    /resolveNamedReadingInput\(\s*reading\.input,\s*reading\.userId,\s*nameDeps,\s*sourceSessionId/.test(
      snapshots
    ),
    '스냅샷이 계정 주인 이름 단독 해석으로 되돌아가면 유료 상세가 남의 이름으로 각인된다'
  );
  // localStorage("내 정보" 자동채움)에 가족 제출이 남으면 재방문 폼이 가족으로 뜬다.
  assert.ok(
    read('src/features/unified-intake/unified-intake.tsx').includes(
      'if (shouldAutoSavePersonalProfile(profile.loadedProfileSource)) saveBirthProfile(profile)'
    ),
    '가족 제출이 내 정보 저장소를 덮어쓰면 재방문 시 가족 이름으로 채워진다'
  );
});
