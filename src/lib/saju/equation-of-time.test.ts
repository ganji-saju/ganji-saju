// 2026-05-15 PR 8 — 균시차 + 진태양시 보정 검증.
import assert from 'node:assert/strict';
import {
  gregorianToJDN,
  equationOfTimeMinutes,
  trueSolarTimeOffsetMinutes,
} from './equation-of-time';

declare const test: (name: string, fn: () => void) => void;

test('gregorianToJDN - 알려진 율리우스 적일', () => {
  // 1900-01-01 → JDN 2415021 (spec doc §6-1)
  assert.equal(gregorianToJDN(1900, 1, 1), 2415021);
  // 2000-01-01 → JDN 2451545 (J2000 표준)
  assert.equal(gregorianToJDN(2000, 1, 1), 2451545);
});

test('equationOfTimeMinutes - 연중 ±16분 범위', () => {
  // 2026년 1월~12월 매월 15일 EoT 가 -16 ~ +17 범위에 있어야 함.
  for (let m = 1; m <= 12; m += 1) {
    const jd = gregorianToJDN(2026, m, 15) - 0.5; // 자정 UT
    const eot = equationOfTimeMinutes(jd);
    assert.ok(eot > -20 && eot < 20, `2026-${m}-15 EoT 범위 초과: ${eot}`);
  }
});

test('equationOfTimeMinutes - 알려진 극값 시점 검증', () => {
  // EoT 는 약 4번 0점 통과 (4/15·6/13·9/1·12/25 부근).
  // 2026-02-11 부근 최저값 (~-14분), 2026-11-03 부근 최고값 (~+16분).
  const feb = equationOfTimeMinutes(gregorianToJDN(2026, 2, 11) - 0.5);
  const nov = equationOfTimeMinutes(gregorianToJDN(2026, 11, 3) - 0.5);
  assert.ok(feb < -10, `2월 중순 EoT 음수: got=${feb}`);
  assert.ok(nov > 10, `11월 초 EoT 양수: got=${nov}`);
});

test('trueSolarTimeOffsetMinutes - 서울 (126.978°, KST) 경도 보정 -32분', () => {
  // 균시차 없이 경도 보정만으로 -32 ± 18 분 (균시차 변동).
  const offset = trueSolarTimeOffsetMinutes({
    longitude: 126.978,
    year: 2026,
    month: 5,
    day: 15,
    hour: 12,
  });
  // 서울 5월 15일 EoT 약 +3.5분, 경도 -32분 → 합 ≈ -28분.
  assert.ok(offset >= -48 && offset <= -16, `서울 진태양시 보정 범위 ${offset}`);
});

test('trueSolarTimeOffsetMinutes - 표준 자오선 (135°) 출생은 경도 0 + EoT 만', () => {
  // 동경 135° = 한국 표준 자오선 정확히. 경도 보정 = 0, 균시차만 남음.
  const offset = trueSolarTimeOffsetMinutes({
    longitude: 135,
    year: 2026,
    month: 5,
    day: 15,
    hour: 12,
  });
  assert.ok(Math.abs(offset) < 18, `표준 자오선 + 5월 EoT 범위 초과: ${offset}`);
});
