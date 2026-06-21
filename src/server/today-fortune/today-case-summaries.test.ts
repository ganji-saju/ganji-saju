import assert from 'node:assert/strict';
import { parseBirthInputDraft } from '@/domain/saju/validators/birth-input';
import { buildFreshTodaySajuData } from '@/server/today-fortune/fresh-saju-data';
import { buildTodayCaseSummaries } from '@/server/today-fortune/today-case-summaries';

declare const test: (name: string, fn: () => void) => void;

const FIXED_NOW = new Date('2026-06-22T10:00:00+09:00');

function createSampleSajuData() {
  const parsed = parseBirthInputDraft(
    {
      year: '1982',
      month: '1',
      day: '29',
      hour: '8',
      minute: '45',
      gender: 'male',
      birthLocationCode: 'seoul',
      birthLocationLabel: '서울특별시',
      birthLatitude: '37.5665',
      birthLongitude: '126.9780',
      unknownTime: false,
      jasiMethod: 'unified',
      solarTimeMode: 'standard',
    },
    { requireGender: false }
  );
  if (!parsed.ok) throw new Error('sample birth input should be valid');
  return buildFreshTodaySajuData(parsed.input, { now: FIXED_NOW });
}

test('buildTodayCaseSummaries returns string[]', () => {
  const sajuData = createSampleSajuData();
  const result = buildTodayCaseSummaries({ sajuData, options: { now: FIXED_NOW } });
  assert.ok(Array.isArray(result), 'should return array');
});

test('buildTodayCaseSummaries is non-empty for a normal chart', () => {
  const sajuData = createSampleSajuData();
  const result = buildTodayCaseSummaries({ sajuData, options: { now: FIXED_NOW } });
  assert.ok(result.length > 0, `expected non-empty, got ${result.length}`);
});

test('every entry is non-empty string with no Chinese characters', () => {
  const sajuData = createSampleSajuData();
  const result = buildTodayCaseSummaries({ sajuData, options: { now: FIXED_NOW } });
  for (const s of result) {
    assert.ok(s.length > 0, 'each entry must be non-empty');
    assert.ok(!/[一-鿿]/.test(s), `entry must not contain Chinese/Hanja: "${s}"`);
  }
});

test('length is at most 10', () => {
  const sajuData = createSampleSajuData();
  const result = buildTodayCaseSummaries({ sajuData, options: { now: FIXED_NOW } });
  assert.ok(result.length <= 10, `length ${result.length} exceeds max 10`);
});

test('results are deterministic across two calls', () => {
  const sajuData = createSampleSajuData();
  const first = buildTodayCaseSummaries({ sajuData, options: { now: FIXED_NOW } });
  const second = buildTodayCaseSummaries({ sajuData, options: { now: FIXED_NOW } });
  assert.deepEqual(first, second, 'two calls with same input should return identical results');
});
