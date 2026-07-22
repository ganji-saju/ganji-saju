import assert from 'node:assert/strict';
import {
  sajuIdentityKey,
  sajuIdentityFromReadingKey,
  readingKeyMatchesCurrentSaju,
} from './reading-identity';
import { fromSlug, toSlug } from './pillars';

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

// 🔴 회귀 가드(2026-07-22) — lifetime/월간달력/올해핵심 이용권 매칭 공용 로직.
//   구매(이름 있는 readingId)와 열람(이름 없는 raw slug)에서 readingKey 해시가 갈려도
//   같은 사주면 이용권이 이어져야 한다("구매했는데 안 보임" 방지). 다른 사주는 거부.
test('readingKeyMatchesCurrentSaju — 정확일치 / 이름 해시 드리프트 흡수 / 다른 사주 거부', () => {
  const base = { year: 1990, month: 5, day: 20, hour: 14, minute: 30, gender: 'male' as const };
  const withName = toSlug({ ...base, name: '홍길동' }); // 저장 키(이름 포함 해시)
  const noName = toSlug(base); // 열람 키(이름 없음 → 다른 해시)
  const identity = sajuIdentityFromReadingKey(noName);

  assert.notEqual(withName, noName); // 드리프트 전제
  // 정확일치
  assert.equal(readingKeyMatchesCurrentSaju(withName, [withName], identity), true);
  // 이름 드리프트: 저장(withName) vs 현재(noName) — 정확일치 실패해도 사주 정체성으로 매칭
  assert.equal(readingKeyMatchesCurrentSaju(withName, [noName], identity), true);
  // 다른 사주(생년 다름 → 다른 기둥)는 거부
  const other = toSlug({ ...base, year: 1991 });
  assert.equal(readingKeyMatchesCurrentSaju(other, [noName], identity), false);
  // identity 없고 정확일치도 아니면 false(방어)
  assert.equal(readingKeyMatchesCurrentSaju(withName, [noName], null), false);
  assert.equal(readingKeyMatchesCurrentSaju(null, [noName], identity), false);
});
