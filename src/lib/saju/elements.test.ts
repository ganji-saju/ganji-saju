import test from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENT_INFO } from './elements';

// 2026-05-19 톤 invariant — naming-migration.md (옵션 A) 의 자연 비유 라벨 강제.
//   본문 인용 시 한국어 접속 조사 "X와 Y" 충돌을 일으키던 옛 "X과/와 Y" 패턴
//   재발 방지.

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

test('ELEMENT_INFO 5 라벨이 모두 ㄹ 받침으로 끝남 (호출처 "이/을" 조사 호환)', () => {
  // elements/page.tsx 등이 `${name}이 강하고`, `${name}을 채우면` 패턴 사용.
  // 자연스러우려면 라벨 끝이 ㄹ 받침이어야 자연.
  for (const [key, value] of Object.entries(ELEMENT_INFO)) {
    const lastChar = value.name.charAt(value.name.length - 1);
    const code = lastChar.charCodeAt(0);
    assert.ok(code >= 0xAC00 && code <= 0xD7A3, `[${key}] 마지막 글자 한글 아님: '${lastChar}'`);
    const jongseong = (code - 0xAC00) % 28;
    // 28 자모 중 8 = ㄹ
    assert.equal(
      jongseong,
      8,
      `ELEMENT_INFO[${key}].name = '${value.name}' — 끝 글자 받침이 ㄹ 이어야 함 (실제: jongseong=${jongseong})`
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

test('ELEMENT_INFO 5 라벨이 자연 비유 키워드 (새싹/햇살/흙/쇠/물) 포함', () => {
  // 옵션 A (자연 비유) 정착 검증 — 다른 옵션으로 회귀 시 fail.
  const expected: Record<string, string> = {
    목: '새싹',
    화: '햇살',
    토: '흙',
    금: '쇠',
    수: '물',
  };
  for (const [key, keyword] of Object.entries(expected)) {
    const label = ELEMENT_INFO[key as keyof typeof ELEMENT_INFO].name;
    assert.ok(
      label.includes(keyword),
      `ELEMENT_INFO[${key}].name = '${label}' — '${keyword}' 키워드 포함 필요 (자연 비유 정착)`
    );
  }
});
