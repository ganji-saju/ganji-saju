// 2026-09-03 — PDF 저장 화면 액션 바가 모바일에서 다시 3줄로 쌓이는 회귀 가드.
//
// 왜: 전역 `.gangi-primary-button / .gangi-secondary-button` 의 `width: 100%` 때문에
//   버튼 3개가 **모든 폭에서** 세 줄로 쌓였고, sticky 바가 리포트 본문을 가렸다.
//   전역 선언은 삭제했다(가드: src/lib/gangi-button-width.test.ts). 여기서는 이 바의
//   배치(3칸 그리드)와 모바일 전용 축소만 고정한다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

declare const test: (name: string, fn: () => void) => void;

const component = readFileSync('src/components/report/report-print-actions.tsx', 'utf8');
const printCss = readFileSync('src/app/styles/responsive-print.css', 'utf8');

test('PDF 저장 바: 버튼 3개가 모바일에서 한 줄(3칸 그리드)에 들어간다', () => {
  assert.ok(
    /grid grid-cols-3/.test(component),
    '버튼 묶음이 grid-cols-3 이어야 모바일에서 한 줄에 3개가 들어간다'
  );
});

// 2026-09-03 (2차) — 전역 `width: 100%` 자체를 subpages.css 에서 삭제해, 이 바만의
// 폭 override 는 필요 없어졌다. 폭 기본값 가드는 gangi-button-width.test.ts 로 옮겼다.
// 여기 남은 건 이 바 고유의 모바일 축소뿐이다.

// 리뷰에서 실제로 잡힌 실수(2026-09-03): 처음엔 축소 값을 `min-width: 640px` 쪽에도
// 넣어 데스크톱 버튼까지 1.05rem → 0.92rem 으로 줄였다. 그 값은 readability.css 가
// 의도적으로 올린 것이라 건드리면 안 된다. 축소는 모바일 전용으로 남아야 한다.
test('PDF 저장 바: 크기 축소는 모바일에만 걸린다(데스크톱 readability 값 보존)', () => {
  const shrink = printCss.match(
    /@media \(max-width: 639px\) \{\s*\n\s*\.pdf-print-actions \.gangi-primary-button,/
  );
  assert.ok(shrink, '축소 블록은 @media (max-width: 639px) 안에 있어야 한다');
  assert.ok(
    !/@media \(min-width: 640px\) \{\s*\n\s*\.pdf-print-actions \.gangi-(primary|secondary)-button/.test(
      printCss
    ),
    'min-width:640px 에서 .pdf-print-actions 버튼 크기를 덮으면 안 된다'
  );
});
