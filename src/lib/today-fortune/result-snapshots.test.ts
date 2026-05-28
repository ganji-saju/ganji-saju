import assert from 'node:assert/strict';
import {
  buildTodayFortuneResultSnapshotHref,
  buildTodayFortuneResultSnapshotScopeKey,
  buildTodayFortuneResultSnapshotSummary,
} from './result-snapshots';

declare const test: (name: string, fn: () => void) => void;

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
