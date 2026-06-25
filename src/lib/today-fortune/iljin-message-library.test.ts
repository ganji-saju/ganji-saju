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

// 2026-06-26 — plain 톤 통일 가드. 일진 메시지가 오늘 자세히보기(결제)에 노출되므로
//   명리 전문어(십성·신살·합충형해·용신/기신)와 한자를 쓰지 않는다("알아들을 수 있는 문장").
//   naming-policy: 오행 "X 기운"(목/화/토/금/수)은 허용 → 정규식에 오행 글자 미포함.
const MYEONGRI_JARGON =
  /비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인|천을귀인|문창|양인|백호|괴강|공망|망신|도화|역마|화개|삼합|육합|방합|원진|자형|용신|기신|조후|일진|사주/;
const CJK = /[㐀-鿿]/;

test('iljin 라이브러리: plain 톤 — 명리 전문어/한자 노출 0 (결제 풀이 통일)', () => {
  for (const [caseId, pool] of Object.entries(ILJIN_MESSAGE_LIBRARY)) {
    for (const tpl of pool) {
      const out = substituteVariables(tpl, { name: '김민수', element: '목' });
      assert.doesNotMatch(out, MYEONGRI_JARGON, `${caseId}: 명리 전문어 노출(plain 위반): "${out}"`);
      assert.doesNotMatch(out, CJK, `${caseId}: 한자 노출(plain 위반): "${out}"`);
    }
  }
});
