import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
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
    assert.equal(guardian.seal, `/images/gangi/guardians/seals/${key}.png`);
    // 2026-08-26 — 표정 변형 2종. 없는 파일을 가리키면 배선한 화면이 깨진 이미지를 그린다.
    assert.equal(guardian.moods.serious, `/images/gangi/guardians/${key}-serious.jpg`);
    assert.equal(guardian.moods.smile, `/images/gangi/guardians/${key}-smile.jpg`);
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

// 2026-08-26 — 표정 변형 24장이 **실제로 커밋돼 있는지** 파일로 확인한다.
//   경로 문자열만 맞추는 테스트는 자산이 빠진 채 배포되면 조용히 통과하고,
//   화면에는 깨진 이미지가 뜬다(타로 덱 자산 가드와 같은 이유).
test('표정 변형 자산 24장이 실제 파일로 존재한다', () => {
  for (const key of Object.keys(ZODIAC) as ZodiacKey[]) {
    const guardian = guardianForZodiac(key);
    for (const [mood, href] of Object.entries(guardian.moods)) {
      const filePath = path.join(process.cwd(), 'public', href);
      assert.ok(existsSync(filePath), `${key}-${mood} 자산 없음: ${href}`);
    }
  }
});
