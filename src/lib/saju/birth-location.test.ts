import assert from 'node:assert/strict';
import {
  buildBirthTimeCorrection,
  getBirthCalculationDateTime,
  getBirthLocationPreset,
  getSolarTimeOffsetMinutes,
  resolveBirthLocationInput,
} from './birth-location';

declare const test: (name: string, fn: () => void) => void;

test('longitude correction uses Korea standard meridian for Seoul', () => {
  assert.equal(getSolarTimeOffsetMinutes({ longitude: 126.978 }), -32);
});

test('birth time correction can move a Seoul birth across the previous day boundary', () => {
  const seoul = getBirthLocationPreset('seoul');
  assert.ok(seoul);

  const correction = buildBirthTimeCorrection({
    year: 1982,
    month: 1,
    day: 29,
    hour: 0,
    minute: 10,
    birthLocation: seoul,
    solarTimeMode: 'longitude',
  });

  assert.equal(correction?.offsetMinutes, -32);
  assert.deepEqual(correction?.adjustedBirth, {
    year: 1982,
    month: 1,
    day: 28,
    hour: 23,
    minute: 38,
  });
});

test('standard mode keeps the civil birth time unchanged', () => {
  const seoul = getBirthLocationPreset('seoul');
  const calculationTime = getBirthCalculationDateTime({
    year: 1982,
    month: 1,
    day: 29,
    hour: 0,
    minute: 10,
    birthLocation: seoul,
    solarTimeMode: 'standard',
  });

  assert.deepEqual(calculationTime, {
    year: 1982,
    month: 1,
    day: 29,
    hour: 0,
    minute: 10,
  });
});

// 🔴 2026-08-29 회귀 — '좌표 찾기'로 고른 출생지로는 회원가입이 안 됐다.
//   검색 결과는 code='custom' + 좌표만 남기는데 서버가 프리셋 표에서만 찾아
//   "출생지를 선택해 주세요."로 거절했다(프리셋 칩은 통과). 화면엔 좌표가 떠 있는데
//   그걸로는 가입이 안 되는 상태였다.
test('출생지: 검색으로 고른 custom 좌표를 받는다', () => {
  const picked = resolveBirthLocationInput({
    code: 'custom',
    label: '수원시 장안구',
    latitude: '37.3039',
    longitude: '126.9737',
  });
  assert.ok(picked, 'custom 좌표가 거절되면 검색 선택이 다시 죽는다');
  assert.equal(picked.label, '수원시 장안구');
  assert.equal(picked.latitude, 37.3039);
  assert.equal(picked.longitude, 126.9737);
});

test('출생지: 프리셋 코드가 좌표보다 우선한다', () => {
  const seoul = resolveBirthLocationInput({
    code: 'seoul',
    label: '엉뚱한 이름',
    latitude: 0,
    longitude: 0,
  });
  assert.ok(seoul);
  assert.equal(seoul.label, '서울');
  assert.equal(seoul.latitude, 37.5665);
});

test('출생지: 좌표가 없거나 범위를 벗어나면 거절한다', () => {
  // 신뢰 경계다 — 라벨만 있고 좌표가 없으면 사주 계산이 조용히 틀어진다.
  assert.equal(resolveBirthLocationInput({ code: 'custom', label: '어딘가' }), null);
  assert.equal(
    resolveBirthLocationInput({ code: 'custom', label: '어딘가', latitude: '', longitude: '' }),
    null
  );
  assert.equal(
    resolveBirthLocationInput({ code: 'custom', label: '어딘가', latitude: 'abc', longitude: '127' }),
    null
  );
  assert.equal(
    resolveBirthLocationInput({ code: 'custom', label: '어딘가', latitude: 91, longitude: 127 }),
    null
  );
  assert.equal(
    resolveBirthLocationInput({ code: 'custom', label: '', latitude: 37.5, longitude: 127 }),
    null
  );
});
