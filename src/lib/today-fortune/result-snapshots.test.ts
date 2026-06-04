import assert from 'node:assert/strict';
import type { BirthInput } from '@/lib/saju/types';
import {
  applyDisplayNameToInput,
  buildTodayFortuneResultSnapshotHref,
  buildTodayFortuneResultSnapshotScopeKey,
  buildTodayFortuneResultSnapshotSummary,
} from './result-snapshots';

declare const test: (name: string, fn: () => void) => void;

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
