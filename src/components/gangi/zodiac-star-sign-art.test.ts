// 2026-09-01 — 띠·별자리 칩이 이모지/기호에서 민화 그림으로 교체됐다.
//   키 하나라도 자산이 없으면 그 칩만 조용히 깨진 이미지로 뜬다(화면에서만 드러남) → 파일 존재를 고정한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

declare const test: (name: string, fn: () => void) => void;

const ZODIAC_KEYS = [
  'rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake',
  'horse', 'sheep', 'monkey', 'rooster', 'dog', 'pig',
];
const STAR_SIGN_KEYS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

const ICONS = path.join(process.cwd(), 'public/images/gangi/icons');

test('띠 동물 그림 12종이 모두 존재한다', () => {
  for (const key of ZODIAC_KEYS) {
    const file = path.join(ICONS, 'zodiac', `${key}.webp`);
    assert.ok(fs.existsSync(file), `띠 자산 누락: ${key}.webp`);
  }
});

test('별자리 그림 12종이 모두 존재한다', () => {
  for (const key of STAR_SIGN_KEYS) {
    const file = path.join(ICONS, 'star-sign', `${key}.webp`);
    assert.ok(fs.existsSync(file), `별자리 자산 누락: ${key}.webp`);
  }
});

test('칩 자산은 작게 유지한다(장당 40KB 이하 — 목록에 12개가 한 번에 뜬다)', () => {
  for (const group of ['zodiac', 'star-sign']) {
    for (const file of fs.readdirSync(path.join(ICONS, group))) {
      const size = fs.statSync(path.join(ICONS, group, file)).size;
      assert.ok(size <= 40 * 1024, `${group}/${file} 가 ${Math.round(size / 1024)}KB — 재인코딩 필요`);
    }
  }
});

test('배선 가드 — 칩이 이모지/기호 렌더로 되돌아가지 않는다', () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
  assert.ok(
    read('src/components/gangi/gangi-ui.tsx').includes('/images/gangi/icons/zodiac/'),
    '띠 칩이 이모지 렌더로 회귀했다'
  );
  assert.ok(
    read('src/components/gangi/gangi-star-sign.tsx').includes('/images/gangi/icons/star-sign/'),
    '별자리 칩이 기호 렌더로 회귀했다'
  );
});
