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

test('궁합 관계 그림 4종이 모두 존재한다', () => {
  for (const key of ['lover', 'family', 'friend', 'partner']) {
    const file = path.join(ICONS, 'relationship', `${key}.webp`);
    assert.ok(fs.existsSync(file), `관계 자산 누락: ${key}.webp`);
  }
});

test('궁합 표면에 장식 이모지가 남아 있지 않다', () => {
  // 2026-09-01 대표 지시: "지금 이모지는 촌스러워 전체 분위기와 안 어울린다" → 그림/먹선으로 교체.
  // ⚠️2026-09-01 실측 — 이모지가 **콘텐츠 데이터**(moonlight.ts)에 숨어 있어 화면 파일만 훑었을 때
  //   /compatibility/input 이 그대로 남았다(대표 재제보). 데이터 파일도 스캔 대상에 넣는다.
  const files = [
    'src/app/compatibility/page.tsx',
    'src/app/compatibility/input/page.tsx',
    'src/app/star-sign/compat/[a]/[b]/page.tsx',
    'src/features/compatibility/compatibility-input-client.tsx',
    'src/content/moonlight.ts',
  ];
  // 컬러 이모지만 잡는다 — ✓ ✦ › 같은 타이포그래피 기호는 먹 톤과 어울려 유지한다.
  const TYPOGRAPHIC = new Set(['✓', '✦', '✧', '›', '·', '→', '↑', '⚠']);
  const decorative = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const file of files) {
    let source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    // 콘텐츠 데이터 파일은 궁합 관계 정의 블록만 본다 — 다른 표면(꿈·타로·FAQ)의 이모지는 별건이다.
    if (file.endsWith('moonlight.ts')) {
      const start = source.indexOf('export const COMPATIBILITY_RELATIONSHIPS');
      assert.ok(start >= 0, 'COMPATIBILITY_RELATIONSHIPS 블록을 찾지 못했다');
      source = source.slice(start, source.indexOf('] as const;', start));
    }
    const offenders = source
      .split('\n')
      .filter((line) => {
        if (line.trim().startsWith('//') || line.includes('*')) return false;
        const hits = [...line].filter((ch) => decorative.test(ch));
        return hits.some((ch) => !TYPOGRAPHIC.has(ch));
      });
    assert.equal(
      offenders.length,
      0,
      `${file} 에 장식 이모지가 남았다: ${offenders.map((l) => l.trim()).join(' | ')}`
    );
  }
});

test('칩 자산은 작게 유지한다(장당 40KB 이하 — 목록에 12개가 한 번에 뜬다)', () => {
  for (const group of ['zodiac', 'star-sign', 'relationship']) {
    for (const file of fs.readdirSync(path.join(ICONS, group))) {
      const size = fs.statSync(path.join(ICONS, group, file)).size;
      assert.ok(size <= 40 * 1024, `${group}/${file} 가 ${Math.round(size / 1024)}KB — 재인코딩 필요`);
    }
  }
});

test('별자리 표면에 유니코드 기호 렌더가 남아 있지 않다(전면 그림 통일)', () => {
  // 2026-09-01 대표 지시: 작은 자리도 크기를 키워 전부 그림으로 통일.
  //   symbol 을 화면에 직접 찍는 자리가 되살아나면 통일이 깨진다(폴백 prop 전달은 허용).
  const files = [
    'src/app/star-sign/page.tsx',
    'src/app/star-sign/[slug]/page.tsx',
    'src/app/star-sign/[slug]/cross/page.tsx',
    'src/app/star-sign/compat/page.tsx',
    'src/app/star-sign/compat/[a]/[b]/page.tsx',
    'src/components/star-sign/my-star-sign-card.tsx',
    'src/components/star-sign/my-favorite-signs-strip.tsx',
    'src/components/star-sign/star-sign-daily-digest-card.tsx',
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    // 폴백 prop 전달(symbol={meta.symbol})은 허용 — 화면에 직접 찍는 줄만 잡는다.
    const offenders = source
      .split('\n')
      .filter((line) => /\{[^}]*\bsymbol\b[^}]*\}/.test(line) && !/symbol=\{/.test(line));
    assert.equal(
      offenders.length,
      0,
      `${file} 에 기호 직접 렌더가 남았다: ${offenders.map((l) => l.trim()).join(' | ')}`
    );
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
