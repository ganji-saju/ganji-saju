import assert from 'node:assert/strict';
import { sajuIdentityKey, sajuIdentityFromReadingKey } from './reading-identity';
import { fromSlug } from './pillars';

declare const test: (name: string, fn: () => void) => void;

// 2026-06-22 — 이용권을 'reading 입력 문자열(readingKey)'이 아니라 '실제 사주(4기둥)'에
//   묶기 위한 정체성 키. 번들(score-factor)이 분 정밀도 다른 사주 점수 게이트에서
//   grandfather 되지 못해 이중과금되던 버그 수정의 핵심 순수 로직.

// 실측 데이터(PR #448 후속 인시던트): 같은 사람·같은 시각인데 한쪽은 분 없음, 한쪽은 m45.
const NO_MINUTE = '1982-1-29-8-male-loccustom-lat37p5667-lon126p9783-solarlongitude-key0huq4u4';
const MINUTE_45 = '1982-1-29-8-m45-male-loccustom-lat37p5667-lon126p9783-solarlongitude-key1v9gtb7';

test('실제 버그 readingKey 2종(분만 다름, 같은 시주) → 동일 사주 정체성', () => {
  const a = sajuIdentityFromReadingKey(NO_MINUTE);
  const b = sajuIdentityFromReadingKey(MINUTE_45);
  assert.ok(a, 'NO_MINUTE 정체성이 null 이면 안 됨');
  assert.equal(a, b);
});

test('다른 시(時) → 다른 정체성', () => {
  const eight = sajuIdentityFromReadingKey(NO_MINUTE);
  const fourteen = sajuIdentityFromReadingKey(
    '1982-1-29-14-male-loccustom-lat37p5667-lon126p9783-solarlongitude-keyzzzzzzz'
  );
  assert.ok(eight && fourteen);
  assert.notEqual(eight, fourteen);
});

test('다른 성별 → 다른 정체성', () => {
  const input = fromSlug(NO_MINUTE);
  assert.ok(input);
  const male = sajuIdentityKey(input);
  const female = sajuIdentityKey({ ...input, gender: 'female' });
  assert.notEqual(male, female);
});

test('파싱 불가 readingKey → null', () => {
  assert.equal(sajuIdentityFromReadingKey('garbage'), null);
  assert.equal(sajuIdentityFromReadingKey(''), null);
  assert.equal(sajuIdentityFromReadingKey(null), null);
});
