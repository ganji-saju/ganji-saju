import assert from 'node:assert/strict';
import { guardianForZodiac, guardianFromYearBranch } from './guardians';
import { ZODIAC, type ZodiacKey } from '@/components/gangi/zodiac-data';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 2026-08-25 — 수호신 배정의 정직성 가드: 12지지 전수가 각자 자기 수호신으로,
//   이미지 경로는 실제 커밋된 자산 명명({zodiacKey}.jpg)과 일치해야 한다.

test('12지지 전수가 자기 띠 수호신으로 배정된다', () => {
  for (const [key, meta] of Object.entries(ZODIAC) as [
    ZodiacKey,
    (typeof ZODIAC)[ZodiacKey],
  ][]) {
    const guardian = guardianFromYearBranch(meta.han);
    assert.ok(guardian, `${meta.han} 배정 실패`);
    assert.equal(guardian.key, key);
    assert.equal(guardian.han, meta.han);
    assert.equal(guardian.animalKo, meta.ko);
    assert.equal(guardian.image, `/images/gangi/guardians/${key}.jpg`);
    assert.ok(guardian.persona.length > 0, `${key} persona 누락`);
  }
});

test('지지가 아닌 입력은 null — 깨진 수호신 카드를 만들지 않는다', () => {
  assert.equal(guardianFromYearBranch('甲'), null); // 천간
  assert.equal(guardianFromYearBranch(''), null);
  assert.equal(guardianFromYearBranch('용'), null); // 한글
});

test('guardianForZodiac 와 지지 경유 배정이 동일 결과', () => {
  assert.deepEqual(guardianFromYearBranch('寅'), guardianForZodiac('tiger'));
});
