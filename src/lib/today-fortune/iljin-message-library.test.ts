// 2026-05-23 — 일진 메시지 라이브러리 텍스트 품질 회귀 가드.
//   naming-policy §2: 오행은 "X 기운"(목/화/토/금/수 + 기운). "X의 기운"(조사 의) 금지.
//   배경: S36/S37 케이스가 "[오행]의 기운" 템플릿을 써서 "화의 기운" 처럼 렌더됐고,
//   [오행] 미지정(택일/캘린더 경로)일 때는 "  기운이"(이중 공백)로 깨졌다.
import assert from 'node:assert/strict';
import { ILJIN_MESSAGE_LIBRARY, substituteVariables } from './iljin-message-library';

declare const test: (name: string, fn: () => void) => void;

const ELEMENTS = ['목', '화', '토', '금', '수'] as const;

test('iljin 라이브러리: "X의 기운"(조사 의) 신조어 형태가 템플릿에 없음', () => {
  for (const [caseId, pool] of Object.entries(ILJIN_MESSAGE_LIBRARY)) {
    for (const tpl of pool) {
      assert.ok(
        !/\[오행\]의 기운/.test(tpl),
        `${caseId}: "[오행]의 기운" 형 잔존 → "[오행] 기운" 으로 정정 필요: "${tpl}"`
      );
    }
  }
});

test('substituteVariables: [오행] 치환 시 "X 기운" 으로 정상 렌더(화의 기운 류 없음)', () => {
  for (const [caseId, pool] of Object.entries(ILJIN_MESSAGE_LIBRARY)) {
    for (const tpl of pool) {
      for (const el of ELEMENTS) {
        const out = substituteVariables(tpl, { name: '김민수', element: el });
        // 조사 "의" 가 낀 "X의 기운" 금지 (단, 흡수/도화 같은 합성어는 허용 — 앞 글자 경계 검사).
        assert.ok(
          !new RegExp(`(?<![가-힣])${el}의 기운`).test(out),
          `${caseId}/${el}: "${el}의 기운" 렌더됨: "${out}"`
        );
      }
    }
  }
});

test('substituteVariables: [오행] 미지정 시 이중 공백/꼬리 공백 없이 정리됨', () => {
  for (const [caseId, pool] of Object.entries(ILJIN_MESSAGE_LIBRARY)) {
    for (const tpl of pool) {
      const out = substituteVariables(tpl, { name: '김민수' });
      assert.ok(!/ {2,}/.test(out), `${caseId}: 이중 공백 잔존: "${out}"`);
      assert.equal(out, out.trim(), `${caseId}: 앞뒤 공백 잔존: "${out}"`);
      // [오행] placeholder 가 그대로 노출되지 않음
      assert.ok(!out.includes('[오행]'), `${caseId}: [오행] placeholder 미치환: "${out}"`);
    }
  }
});
