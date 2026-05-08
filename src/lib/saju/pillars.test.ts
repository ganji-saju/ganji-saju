import assert from 'node:assert/strict';
import { fromSlug, toSlug } from './pillars';

declare const test: (name: string, fn: () => void) => void;

test('saju slug preserves custom birth coordinates for longitude correction', () => {
  const slug = toSlug({
    year: 1982,
    month: 1,
    day: 29,
    hour: 0,
    minute: 10,
    gender: 'male',
    birthLocation: {
      code: 'custom',
      label: '목포',
      latitude: 34.8118,
      longitude: 126.3922,
      timezone: 'Asia/Seoul',
    },
    solarTimeMode: 'longitude',
  });

  assert.equal(
    slug,
    '1982-1-29-0-m10-male-loccustom-lat34p8118-lon126p3922-solarlongitude-key0v2kscd'
  );

  const parsed = fromSlug(slug);
  assert.equal(parsed?.birthLocation?.code, 'custom');
  assert.equal(parsed?.birthLocation?.latitude, 34.8118);
  assert.equal(parsed?.birthLocation?.longitude, 126.3922);
  assert.equal(parsed?.solarTimeMode, 'longitude');
});

test('saju slug marks unknown birth time before hash token', () => {
  const slug = toSlug({
    year: 1982,
    month: 1,
    day: 29,
    unknownTime: true,
    gender: 'male',
  });

  assert.equal(slug, '1982-1-29-unknown_time-male-key1l5ob1x');

  const parsed = fromSlug(slug);
  assert.equal(parsed?.unknownTime, true);
  assert.equal(parsed?.hour, undefined);
  assert.equal(parsed?.gender, 'male');
});
