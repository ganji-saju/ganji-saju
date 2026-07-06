import assert from 'node:assert/strict';
import type { BirthInput } from '@/lib/saju/types';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { ReadingRecord } from '@/lib/saju/readings';
import {
  applyDisplayNameToInput,
  buildTodayFortuneResultSnapshotHref,
  buildTodayFortuneResultSnapshotScopeKey,
  buildTodayFortuneResultSnapshotSummary,
  buildTodayFortuneSnapshotContent,
  resolveSnapshotInputName,
} from './result-snapshots';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const BASE_INPUT = {
  year: 1990,
  month: 5,
  day: 5,
  hour: 10,
  minute: 0,
  gender: 'male',
} as BirthInput;

// Bug A (detail page) — 오늘 payload 엔 이름이 없어 persisted reading.input.name=undefined →
//   snapshot detail hero 가 '달빛이'. snapshot 시점 profile.display_name 으로 보강.
test('applyDisplayNameToInput: 표시 이름이 있으면 input.name 주입(trim)', () => {
  assert.equal(applyDisplayNameToInput(BASE_INPUT, '김영민').name, '김영민');
  assert.equal(applyDisplayNameToInput(BASE_INPUT, '  이순신  ').name, '이순신');
});

test('applyDisplayNameToInput: 비거나 공백이면 원본 유지(달빛이 fallback 경로)', () => {
  assert.equal(applyDisplayNameToInput(BASE_INPUT, '').name, undefined);
  assert.equal(applyDisplayNameToInput(BASE_INPUT, null).name, undefined);
  assert.equal(applyDisplayNameToInput(BASE_INPUT, undefined).name, undefined);
  // 이미 이름이 있으면 빈 표시이름으로 덮어쓰지 않는다.
  assert.equal(applyDisplayNameToInput({ ...BASE_INPUT, name: '기존' }, '   ').name, '기존');
});

test('today fortune snapshot scope is separated by reading, date, and concern', () => {
  const base = buildTodayFortuneResultSnapshotScopeKey({
    readingKey: '1982-1-29-8-m45-male-keyqa',
    occurredOn: '2026-05-28',
    concernId: 'general',
  });
  const nextDay = buildTodayFortuneResultSnapshotScopeKey({
    readingKey: '1982-1-29-8-m45-male-keyqa',
    occurredOn: '2026-05-29',
    concernId: 'general',
  });
  const differentConcern = buildTodayFortuneResultSnapshotScopeKey({
    readingKey: '1982-1-29-8-m45-male-keyqa',
    occurredOn: '2026-05-28',
    concernId: 'money_spend',
  });

  assert.equal(base, 'today-detail:1982-1-29-8-m45-male-keyqa:2026-05-28:general');
  assert.notEqual(base, nextDay);
  assert.notEqual(base, differentConcern);
});

test('today fortune snapshot href opens the immutable vault replay route', () => {
  assert.equal(
    buildTodayFortuneResultSnapshotHref('snapshot-id-1'),
    '/today-fortune/snapshots/snapshot-id-1'
  );
});

test('today fortune snapshot summary mentions preserved date', () => {
  assert.equal(
    buildTodayFortuneResultSnapshotSummary('2026-05-28'),
    '2026-05-28에 보관된 오늘운세 상세 풀이'
  );
});

// 2026-06-05 Bug A 재발(전 결제 후 hero 가 '달빛이') —
//   스냅샷 이름 해석이 profile.display_name 단일 소스라 소셜 로그인(display_name 미설정)
//   유저는 '달빛이'로 떨어졌다. today-fortune API 와 동일하게 소셜 메타데이터까지 본다.
// 2026-07-07 — detail '오늘의 흐름'(premium iljin) 이 '선생님 님' 으로 나오던 버그 회귀 가드.
//   근인: buildTodayFortuneSnapshotContent 가 free 엔 namedInput(이름 보강)을 넘기면서
//   premium 엔 reading.input(이름 없음)을 넘겨, iljin 메시지 "[이름] 님" 이 '선생님' fallback.
//   free·premium 모두 표시 이름으로 치환돼야 한다.
test('snapshot premium 오늘의 흐름: reading.input 에 이름 없어도 표시 이름 치환(선생님 fallback 방지)', async () => {
  const input = { ...BASE_INPUT } as BirthInput; // name 없음(오늘 payload)
  const sajuData = calculateSajuDataV1(input);
  const reading = {
    id: 'reading-1',
    userId: 'user-1',
    input,
    sajuData,
    grounding: null,
    kasiComparison: null,
    result: {} as never,
    metadata: {} as never,
    chaptersEnvelope: null,
  } as unknown as ReadingRecord;

  const content = await buildTodayFortuneSnapshotContent({
    reading,
    sourceSessionId: 'sess-1',
    concernId: 'general',
    counselorId: null,
    now: new Date('2026-07-07T03:00:00Z'),
    nameDeps: {
      loadProfileDisplayName: async () => '김영민',
      loadAuthMetadata: async () => null,
    },
  });

  const premiumMessages = content.premiumResult.todayIljinReading?.messages ?? [];
  const joined = premiumMessages.join(' ');
  assert.ok(premiumMessages.length > 0, 'premium 오늘의 흐름 메시지가 있어야 함');
  assert.ok(!joined.includes('선생님'), `premium 메시지에 선생님 fallback 이 남음: ${joined}`);
  assert.ok(joined.includes('김영민'), `premium 메시지에 표시 이름이 치환돼야 함: ${joined}`);
  // free 와 premium 이 같은 이름을 쓰는지도 확인(회귀 방지).
  assert.equal(content.freeResult.userName, '김영민');
});

test('resolveSnapshotInputName: display_name 비어도 소셜 메타 이름으로 보강(전 달빛이 방지)', async () => {
  const name = await resolveSnapshotInputName('user-1', {
    loadProfileDisplayName: async () => '',
    loadAuthMetadata: async () => ({ name: '김영민' }),
  });
  assert.equal(name, '김영민');
});

test('resolveSnapshotInputName: profile.display_name 이 소셜 메타보다 우선', async () => {
  const name = await resolveSnapshotInputName('user-1', {
    loadProfileDisplayName: async () => '이순신',
    loadAuthMetadata: async () => ({ name: '김영민' }),
  });
  assert.equal(name, '이순신');
});

test('resolveSnapshotInputName: 둘 다 비면 undefined(달빛이 fallback 경로 유지)', async () => {
  const name = await resolveSnapshotInputName('user-1', {
    loadProfileDisplayName: async () => '',
    loadAuthMetadata: async () => null,
  });
  assert.equal(name, undefined);
});

test('resolveSnapshotInputName: userId 없으면 조회 없이 undefined', async () => {
  const name = await resolveSnapshotInputName(null, {
    loadProfileDisplayName: async () => '이순신',
    loadAuthMetadata: async () => ({ name: '김영민' }),
  });
  assert.equal(name, undefined);
});

test('resolveSnapshotInputName: 프로필 조회 실패해도 소셜 메타로 보강(비차단)', async () => {
  const name = await resolveSnapshotInputName('user-1', {
    loadProfileDisplayName: async () => {
      throw new Error('profile lookup failed');
    },
    loadAuthMetadata: async () => ({ full_name: '홍길동' }),
  });
  assert.equal(name, '홍길동');
});
