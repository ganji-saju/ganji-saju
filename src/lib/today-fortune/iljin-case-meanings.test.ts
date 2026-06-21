// 일진 케이스 중립 의미 라벨 맵 — 회귀 테스트.
// naming-policy: 한자 금지 · 단정/doom 표현 금지 · 모든 50개 케이스 존재.
import assert from 'node:assert/strict';
import { ILJIN_CASE_MEANINGS, getIljinCaseMeaning } from './iljin-case-meanings';

declare const test: (name: string, fn: () => void) => void;

const FORBIDDEN_TOKENS = ['반드시', '절대', '100%', '무조건', '대박', '암흑기', '죽음', '불행'];

test('ILJIN_CASE_MEANINGS: 50개 케이스 모두 존재하고 값이 비어있지 않음', () => {
  const entries = Object.entries(ILJIN_CASE_MEANINGS);
  assert.equal(entries.length, 50, `케이스 수가 50이 아님: ${entries.length}`);
  for (const [id, label] of entries) {
    assert.ok(
      typeof label === 'string' && label.length > 0,
      `${id}: 라벨이 비어있음`
    );
  }
});

test('ILJIN_CASE_MEANINGS: 모든 라벨에 한자 없음', () => {
  for (const [id, label] of Object.entries(ILJIN_CASE_MEANINGS)) {
    assert.ok(
      !/[一-鿿]/.test(label),
      `${id}: 한자 포함됨 → "${label}"`
    );
  }
});

test('ILJIN_CASE_MEANINGS: 모든 라벨에 금지 단어 없음', () => {
  for (const [id, label] of Object.entries(ILJIN_CASE_MEANINGS)) {
    for (const token of FORBIDDEN_TOKENS) {
      assert.ok(
        !label.includes(token),
        `${id}: 금지어 "${token}" 포함됨 → "${label}"`
      );
    }
  }
});

test('getIljinCaseMeaning: 알려진 케이스는 비어있지 않은 문자열 반환', () => {
  const result = getIljinCaseMeaning('S11_CHEONGAN_HAP');
  assert.ok(typeof result === 'string' && result.length > 0, `S11_CHEONGAN_HAP 라벨 없음: "${result}"`);
});

test('getIljinCaseMeaning: 알 수 없는 ID 는 빈 문자열 반환', () => {
  const result = getIljinCaseMeaning('NOPE' as any);
  assert.equal(result, '', `알 수 없는 ID 가 빈 문자열이 아님: "${result}"`);
});
