import assert from 'node:assert/strict';
import { parseBirthInputDraft } from './birth-input';

declare const test: (name: string, fn: () => void) => void;

test('parseBirthInputDraft accepts preset birth location and longitude correction mode', () => {
  const parsed = parseBirthInputDraft({
    name: ' 홍길동 ',
    year: '1982',
    month: '1',
    day: '29',
    hour: '8',
    minute: '30',
    gender: 'male',
    birthLocationCode: 'seoul',
    solarTimeMode: 'longitude',
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.equal(parsed.input.birthLocation?.label, '서울');
  assert.equal(parsed.input.solarTimeMode, 'longitude');
  assert.equal(parsed.input.name, '홍길동');
});

test('parseBirthInputDraft keeps direct birthLocation object from resolved input', () => {
  const parsed = parseBirthInputDraft({
    year: 1982,
    month: 1,
    day: 29,
    hour: 8,
    minute: 30,
    gender: 'male',
    birthLocation: {
      code: 'seoul',
      label: '서울',
      latitude: 37.5665,
      longitude: 126.978,
      timezone: 'Asia/Seoul',
    },
    solarTimeMode: 'longitude',
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.equal(parsed.input.birthLocation?.label, '서울');
  assert.equal(parsed.input.birthLocation?.latitude, 37.5665);
  assert.equal(parsed.input.solarTimeMode, 'longitude');
});

test('parseBirthInputDraft rejects invalid custom coordinates', () => {
  const parsed = parseBirthInputDraft({
    year: '1982',
    month: '1',
    day: '29',
    hour: '8',
    birthLocationCode: 'custom',
    birthLocationLabel: '테스트',
    birthLatitude: '120',
    birthLongitude: '126.9',
    solarTimeMode: 'longitude',
  });

  assert.equal(parsed.ok, false);
});
