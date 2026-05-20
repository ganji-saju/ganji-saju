import test from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENT_INFO } from './elements';

// 2026-05-20 톤 invariant — 한국 사주 사이트 표준 표기 "X 기운" 정착 검증.
//   사용자 피드백: 자연 비유 ("쇠의 결") 이 명리학 익숙도 ↓ → 한글 표기로 전환.
//   본문 인용 시 한국어 접속 조사 "X와 Y" 충돌을 일으키던 옛 "X과/와 Y" 패턴은
//   여전히 금지.

test('ELEMENT_INFO 5 라벨이 "X과/와 Y" 두 단어 구조가 아님', () => {
  // "결단과 마무리", "지혜와 유연" 같은 옛 형태 금지.
  // 한국어 단어 + "과"/"와" + 공백 + 한국어 단어 패턴 차단.
  const FORBIDDEN_PATTERN = /^[가-힣]+[과와]\s[가-힣]/;
  for (const [key, value] of Object.entries(ELEMENT_INFO)) {
    assert.ok(
      !FORBIDDEN_PATTERN.test(value.name),
      `ELEMENT_INFO[${key}].name = '${value.name}' — "X과/와 Y" 구조 금지`
    );
  }
});

test('ELEMENT_INFO 5 라벨이 모두 ㄴ 받침으로 끝남 (호출처 "이/을" 조사 호환)', () => {
  // 한국 사주 사이트 표준 표기 "X 기운". "기운" 끝의 "운" = ㄴ 받침.
  //   `${name}이 강하고`, `${name}을 채우면` 모두 자연.
  for (const [key, value] of Object.entries(ELEMENT_INFO)) {
    const lastChar = value.name.charAt(value.name.length - 1);
    const code = lastChar.charCodeAt(0);
    assert.ok(code >= 0xAC00 && code <= 0xD7A3, `[${key}] 마지막 글자 한글 아님: '${lastChar}'`);
    const jongseong = (code - 0xAC00) % 28;
    // 28 자모 중 4 = ㄴ
    assert.equal(
      jongseong,
      4,
      `ELEMENT_INFO[${key}].name = '${value.name}' — 끝 글자 받침이 ㄴ 이어야 함 (실제: jongseong=${jongseong})`
    );
  }
});

test('ELEMENT_INFO 5 라벨이 한자 0건', () => {
  // 본문 한자 노출 차단의 일환 — 라벨 자체에 한자 금지.
  const HANJA_PATTERN = /[一-鿿]/;
  for (const [key, value] of Object.entries(ELEMENT_INFO)) {
    assert.ok(
      !HANJA_PATTERN.test(value.name),
      `ELEMENT_INFO[${key}].name = '${value.name}' — 한자 노출 금지`
    );
  }
});

test('ELEMENT_INFO 5 라벨이 한글 표기 "X 기운" 형태', () => {
  // 2026-05-20 V2-5 PR O — 자연 비유 → 한국 사주 사이트 표준 표기. 회귀 가드.
  const expected: Record<string, string> = {
    목: '목 기운',
    화: '화 기운',
    토: '토 기운',
    금: '금 기운',
    수: '수 기운',
  };
  for (const [key, expectedName] of Object.entries(expected)) {
    const label = ELEMENT_INFO[key as keyof typeof ELEMENT_INFO].name;
    assert.equal(
      label,
      expectedName,
      `ELEMENT_INFO[${key}].name = '${label}' — 표준 표기 '${expectedName}' 이어야 함`
    );
  }
});

// 2026-05-20 — keyword 도 한글 1글자 (목/화/토/금/수) 로 통일.
test('ELEMENT_INFO 5 entry 가 keyword 한 단어 (공백 없음) 정의', () => {
  const expected: Record<string, string> = {
    목: '목',
    화: '화',
    토: '토',
    금: '금',
    수: '수',
  };
  for (const [key, expectedKeyword] of Object.entries(expected)) {
    const entry = ELEMENT_INFO[key as keyof typeof ELEMENT_INFO];
    assert.equal(
      entry.keyword,
      expectedKeyword,
      `ELEMENT_INFO[${key}].keyword 가 '${expectedKeyword}' 이어야 함 (실제 '${entry.keyword}')`
    );
    assert.ok(
      !/\s/.test(entry.keyword),
      `ELEMENT_INFO[${key}].keyword 에 공백 금지 (본문 합성용 한 단어)`
    );
  }
});
