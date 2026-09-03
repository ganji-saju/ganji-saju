// 2026-09-03 — 전역 버튼 폭 기본값 회귀 가드.
//
// 왜: `.gangi-primary-button / .gangi-secondary-button` 에 `width: 100%` 가 박혀 있어서
//   버튼 2개 이상을 flex row 나 블록에 나열하면 **모든 폭에서** 세로로 쌓였다
//   (PDF 저장 바 #782, /sample-report, /dialogue/safe-redirect 가 전부 같은 원인).
//
//   ⚠️ subpages.css 는 `@layer` 밖이라, 여기 `width` 선언이 남아 있으면 Tailwind
//   유틸리티로 못 푼다. `width: auto` 로 바꾸는 것으로도 부족하다 — 선언이 존재하는
//   한 `w-full` 마저 진다. 실측(playwright):
//     레이어 밖 `width:100%` + `.w-auto`  → 400px (안 먹음)
//     선언 삭제            + `.w-full`   → 400px (먹음)
//   그래서 **선언 자체가 없어야** 한다. 되살리면 위 세 화면이 조용히 되돌아간다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

declare const test: (name: string, fn: () => void) => void;

const subpages = readFileSync('src/app/styles/subpages.css', 'utf8');
const pricing = readFileSync('src/app/pricing/page.tsx', 'utf8');

function sharedButtonRule(): string {
  const m = subpages.match(
    /\.gangi-primary-button,\s*\n\.gangi-secondary-button \{([^}]*)\}/
  );
  assert.ok(m, 'subpages.css 의 공용 버튼 규칙을 찾지 못했다');
  return m[1];
}

test('전역 버튼: 공용 규칙에 width 선언이 없다(기본값 auto)', () => {
  assert.ok(
    !/\bwidth\s*:/.test(sharedButtonRule()),
    'width 선언이 있으면 레이어 밖이라 w-full/w-auto 로 못 푼다 — 선언 자체를 두지 마라'
  );
});

test('전역 버튼: 폭이 필요한 블록 컨테이너는 w-full 을 명시한다', () => {
  // /pricing 플랜 카드 CTA — 부모(.gangi-card-panel)가 블록이라 stretch 가 안 걸린다.
  // 안 붙이면 결제 버튼이 글자 폭(~102px)으로 쪼그라든다.
  const ctas = pricing.match(/gangi-(primary|secondary)-button mt-4[^'"]*/g) ?? [];
  assert.ok(ctas.length >= 2, `플랜 카드 CTA 를 찾지 못했다: ${ctas.length}개`);
  for (const cls of ctas) {
    assert.match(cls, /\bw-full\b/, `플랜 카드 결제 CTA 에 w-full 이 빠졌다: "${cls}"`);
  }
});
