import assert from 'node:assert/strict';
import { Lunar } from 'lunar-typescript';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuReport } from '@/domain/saju/report';
import { parseBirthInputDraft } from '@/domain/saju/validators/birth-input';
import { toSlug } from '@/lib/saju/pillars';
import {
  resolveUnifiedBirthInput,
  toBirthInputDraftFromUnifiedEntry,
  type UnifiedBirthEntryDraft,
} from './unified-birth-entry';

declare const test: (name: string, fn: () => void) => void;

const solarDraft: UnifiedBirthEntryDraft = {
  calendarType: 'solar',
  timeRule: 'standard',
  year: '1982',
  month: '1',
  day: '29',
  hour: '8',
  minute: '45',
  unknownBirthTime: false,
  gender: 'male',
  birthLocationCode: '',
  birthLocationLabel: '',
  birthLatitude: '',
  birthLongitude: '',
};

test('unified birth resolver preserves existing solar input behavior', () => {
  const resolved = resolveUnifiedBirthInput(solarDraft, { requireGender: false });
  const legacy = parseBirthInputDraft(
    {
      year: '1982',
      month: '1',
      day: '29',
      hour: '8',
      minute: '45',
      unknownTime: false,
      jasiMethod: 'unified',
      gender: 'male',
      birthLocationCode: '',
      birthLocationLabel: '',
      birthLatitude: '',
      birthLongitude: '',
      solarTimeMode: 'standard',
    },
    { requireGender: false }
  );

  assert.equal(resolved.ok, true);
  assert.equal(legacy.ok, true);

  if (!resolved.ok || !legacy.ok) return;

  assert.deepEqual(resolved.input, legacy.input);
  assert.equal(toSlug(resolved.input), toSlug(legacy.input));

  const nextData = normalizeToSajuDataV1(resolved.input, null);
  const legacyData = normalizeToSajuDataV1(legacy.input, null);
  const nextReport = buildSajuReport(resolved.input, nextData, 'today');
  const legacyReport = buildSajuReport(legacy.input, legacyData, 'today');

  assert.equal(nextData.pillars.day.ganzi, legacyData.pillars.day.ganzi);
  assert.equal(nextData.yongsin?.primary.label, legacyData.yongsin?.primary.label);
  assert.equal(nextReport.headline, legacyReport.headline);
  assert.equal(nextReport.primaryAction.description, legacyReport.primaryAction.description);
});

test('unified birth resolver maps trueSolarTime and earlyZi into the existing engine contract', () => {
  const resolved = resolveUnifiedBirthInput(
    {
      ...solarDraft,
      birthLocationCode: 'seoul',
      birthLocationLabel: '서울',
      birthLatitude: '37.5665',
      birthLongitude: '126.978',
      timeRule: 'trueSolarTime',
    },
    { requireGender: false }
  );
  const earlyZiDraft = toBirthInputDraftFromUnifiedEntry({
    ...solarDraft,
    hour: '23',
    minute: '10',
    timeRule: 'earlyZi',
  });

  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;

  assert.equal(resolved.input.solarTimeMode, 'longitude');
  assert.equal(resolved.normalizedBirthDraft?.solarTimeMode, 'longitude');
  assert.equal(earlyZiDraft.jasiMethod, 'split');
});

test('unified birth resolver converts lunar input before handing it to the shared parser', () => {
  const expectedSolar = Lunar.fromYmd(1982, 1, 5).getSolar();
  const lunarResolved = resolveUnifiedBirthInput(
    {
      ...solarDraft,
      calendarType: 'lunar',
      year: '1982',
      month: '1',
      day: '5',
    },
    { requireGender: false }
  );

  assert.equal(lunarResolved.ok, true);
  if (!lunarResolved.ok) return;

  assert.equal(lunarResolved.input.year, expectedSolar.getYear());
  assert.equal(lunarResolved.input.month, expectedSolar.getMonth());
  assert.equal(lunarResolved.input.day, expectedSolar.getDay());
  assert.equal(lunarResolved.normalizedBirthDraft.year, String(expectedSolar.getYear()));
  assert.equal(lunarResolved.normalizedBirthDraft.month, String(expectedSolar.getMonth()));
  assert.equal(lunarResolved.normalizedBirthDraft.day, String(expectedSolar.getDay()));
});

test('음력에 없는 날짜는 던지지 않고 실패 결과를 돌려준다', () => {
  for (const [month, day] of [['4', '30'], ['5', '31'], ['13', '1']]) {
    const result = resolveUnifiedBirthInput({ ...solarDraft, calendarType: 'lunar', year: '1990', month, day }, { requireGender: true });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, '생년월일을 다시 확인해 주세요.');
      assert.equal(result.calendarType, 'lunar');
    }
  }
});
