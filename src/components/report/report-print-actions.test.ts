// 2026-09-03 — PDF 저장 화면 액션 바가 모바일에서 다시 3줄로 쌓이는 회귀 가드.
//
// 왜: 전역 `.gangi-primary-button / .gangi-secondary-button` 은 `width: 100%`
//   (src/app/styles/subpages.css) 라 버튼 3개를 그냥 나열하면 모바일에서 세 줄로
//   쌓인다. sticky 바 하나가 화면 1/3 을 먹고 리포트 본문을 가렸다.
//   ⚠️ 두 전역 파일 다 `@layer` 밖이라 Tailwind 유틸리티(`w-auto`)로는 못 이긴다 —
//   폭 override 는 반드시 CSS 로 남아 있어야 한다. 지우면 조용히 되돌아간다.
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

test('PDF 저장 바: 전역 width:100% 를 이기는 CSS override 가 남아 있다', () => {
  const block = printCss.match(
    /\.pdf-print-actions \.gangi-primary-button,\s*\n\s*\.pdf-print-actions \.gangi-secondary-button \{([^}]*)\}/
  );
  assert.ok(block, '.pdf-print-actions 안쪽 버튼 override 블록이 있어야 한다');
  assert.match(block[1], /width:\s*auto/, 'width: auto 로 전역 width:100% 를 덮어야 한다');
});
