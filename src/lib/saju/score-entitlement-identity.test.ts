import assert from 'node:assert/strict';
import { resolveScoreFactorUnlockByIdentity } from './score-factor-access';
import { resolveScoreTotalUnlockByIdentity } from './score-unlock-access';
import { sajuIdentityFromReadingKey } from './reading-identity';

declare const test: (name: string, fn: () => void) => void;

// 2026-06-22 — 이용권을 사주 정체성으로 매칭(번들 score-factor ↔ 분만 다른 사주 점수 게이트
//   grandfather 이중과금 버그 수정). 실측 readingKey 사용.
const NO_MINUTE = '1982-1-29-8-male-loccustom-lat37p5667-lon126p9783-solarlongitude-key0huq4u4';
const MINUTE_45 = '1982-1-29-8-m45-male-loccustom-lat37p5667-lon126p9783-solarlongitude-key1v9gtb7';
const OTHER_SAJU = '1990-5-5-14-female-loccustom-lat37p5667-lon126p9783-solarlongitude-keyaaaaaaa';

const FACTORS = ['F1', 'F2', 'F3', 'F4', 'F5'] as const;
const bundleFactorScopes = FACTORS.map((f) => `score:${NO_MINUTE}:${f}`);
const idMinute45 = sajuIdentityFromReadingKey(MINUTE_45);

test('번들 score-factor(분 없음) → 분만 다른 같은 사주 게이트 전부 해제 (정체성 grandfather)', () => {
  const map = resolveScoreFactorUnlockByIdentity({
    currentReadingKey: MINUTE_45,
    currentIdentity: idMinute45,
    scopeKeys: bundleFactorScopes,
  });
  assert.deepEqual(map, { F1: true, F2: true, F3: true, F4: true, F5: true });
});

test('다른 사주의 score-factor 는 해제하지 않음', () => {
  const map = resolveScoreFactorUnlockByIdentity({
    currentReadingKey: MINUTE_45,
    currentIdentity: idMinute45,
    scopeKeys: FACTORS.map((f) => `score:${OTHER_SAJU}:${f}`),
  });
  assert.deepEqual(map, { F1: false, F2: false, F3: false, F4: false, F5: false });
});

test('일부 요소만 보유 → 해당 요소만 해제', () => {
  const map = resolveScoreFactorUnlockByIdentity({
    currentReadingKey: MINUTE_45,
    currentIdentity: idMinute45,
    scopeKeys: [`score:${NO_MINUTE}:F1`, `score:${NO_MINUTE}:F3`],
  });
  assert.deepEqual(map, { F1: true, F2: false, F3: true, F4: false, F5: false });
});

test('score-total(분 없음) → 분만 다른 같은 사주 해제 (정체성)', () => {
  assert.equal(
    resolveScoreTotalUnlockByIdentity({
      currentReadingKey: MINUTE_45,
      currentIdentity: idMinute45,
      scopeKeys: [`reading:${NO_MINUTE}`],
    }),
    true
  );
});

test('다른 사주의 score-total 은 해제하지 않음', () => {
  assert.equal(
    resolveScoreTotalUnlockByIdentity({
      currentReadingKey: MINUTE_45,
      currentIdentity: idMinute45,
      scopeKeys: [`reading:${OTHER_SAJU}`],
    }),
    false
  );
});

test('exact readingKey 매칭 — 정체성 계산 불가(null)여도 같은 키면 해제(회귀 안전망)', () => {
  assert.equal(
    resolveScoreTotalUnlockByIdentity({
      currentReadingKey: NO_MINUTE,
      currentIdentity: null,
      scopeKeys: [`reading:${NO_MINUTE}`],
    }),
    true
  );
});
