// 2026-07-03 — 오늘운세 공개 공유 티저의 수신자 재현성 회귀 가드.
// 공유 페이지 조합(fromSlug → loadSajuDataV2 → buildTodayFortuneFreeResult({now}))이
// (1) shareSlug 라운드트립 가능하고 (2) 같은 고정 날짜면 항상 같은 한줄·점수를 내는지.
import assert from 'node:assert/strict';
import { fromSlug } from '@/lib/saju/pillars';
import { loadSajuDataV2 } from '@/domain/saju/engine';
import { buildTodayFortuneFreeResult } from '@/server/today-fortune/build-today-fortune';
import { parseShareDateKey } from './share-date';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const INPUT: BirthInput = { year: 1992, month: 5, day: 21, hour: 14, gender: 'female' };

function buildTeaser(input: BirthInput, dateKey: string) {
  const sajuData = loadSajuDataV2(input, null);
  return buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'general',
    sourceSessionId: 'shared-teaser',
    calendarType: 'solar',
    timeRule: 'standard',
    now: parseShareDateKey(dateKey)!,
  });
}

test('공유 티저 — free result 의 shareSlug 는 fromSlug 로 복원 가능', () => {
  const free = buildTeaser(INPUT, '2026-07-01');
  assert.ok(free.shareSlug);
  const restored = fromSlug(free.shareSlug!);
  assert.ok(restored);
  assert.equal(restored.year, 1992);
  assert.equal(restored.month, 5);
  assert.equal(restored.day, 21);
  assert.equal(restored.hour, 14);
});

test('공유 티저 — 고정 날짜 재계산은 결정론(수신자=발신자 동일 결과)', () => {
  const a = buildTeaser(INPUT, '2026-07-01');
  const restored = fromSlug(a.shareSlug!)!;
  const b = buildTeaser(restored, '2026-07-01');
  assert.equal(b.dateKey, a.dateKey);
  assert.equal(b.oneLine.headline, a.oneLine.headline);
  assert.deepEqual(
    b.scores.map((s) => [s.key, s.score]),
    a.scores.map((s) => [s.key, s.score])
  );
});

test('공유 티저 — dateKey 는 고정한 날짜를 따른다(오늘 아님)', () => {
  const free = buildTeaser(INPUT, '2026-07-01');
  assert.equal(free.dateKey, '2026-07-01');
});
