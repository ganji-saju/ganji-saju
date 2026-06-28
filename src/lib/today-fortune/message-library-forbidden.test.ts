// 회귀 가드 — 카테고리·일진 메시지 라이브러리에 단정/doom 금지어 미노출.
//   2026-06-28 최종 전수검사: category/iljin 메시지에 '절대/무조건' 잔존(가드 미적용 파일) →
//   완화('되도록'·'삼가세요' 등) 후 이 테스트로 락. (한자는 '수성(守城)'처럼 한글 병기라 제외)
import assert from 'node:assert/strict';
import { CATEGORY_MESSAGE_LIBRARY } from './category-message-library';
import { ILJIN_MESSAGE_LIBRARY } from './iljin-message-library';

declare const test: (name: string, fn: () => void) => void;

// iljin-case-meanings.test.ts 와 동일한 금지어 집합.
const FORBIDDEN_TOKENS = ['반드시', '절대', '100%', '무조건', '대박', '암흑기', '죽음', '불행'];

function* walkStrings(node: unknown): Generator<string> {
  if (typeof node === 'string') {
    yield node;
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) yield* walkStrings(item);
    return;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) yield* walkStrings(value);
  }
}

test('CATEGORY/ILJIN 메시지 라이브러리: 단정/doom 금지어 0', () => {
  const sources: Array<{ name: string; lib: unknown }> = [
    { name: 'CATEGORY_MESSAGE_LIBRARY', lib: CATEGORY_MESSAGE_LIBRARY },
    { name: 'ILJIN_MESSAGE_LIBRARY', lib: ILJIN_MESSAGE_LIBRARY },
  ];
  let scanned = 0;
  for (const { name, lib } of sources) {
    for (const text of walkStrings(lib)) {
      scanned += 1;
      for (const token of FORBIDDEN_TOKENS) {
        assert.ok(
          !text.includes(token),
          `${name}: 금지어 "${token}" 노출 → "${text}"`
        );
      }
    }
  }
  assert.ok(scanned > 0, '스캔된 메시지가 0건 — import/구조 확인 필요');
});

// 깨진 띄어쓰기 회귀 가드(완화 치환 시 '되도록' 뒤 공백 누락 사고 방지).
test('CATEGORY/ILJIN 메시지 라이브러리: 되도록 뒤 공백 누락 없음', () => {
  for (const lib of [CATEGORY_MESSAGE_LIBRARY, ILJIN_MESSAGE_LIBRARY]) {
    for (const text of walkStrings(lib)) {
      assert.ok(
        !/되도록[가-힣]/.test(text),
        `'되도록' 뒤 공백 누락 → "${text}"`
      );
    }
  }
});
