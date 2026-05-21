import assert from 'node:assert/strict';
import {
  validateOhaengGuidance,
  hasHardOhaengGuidanceViolation,
} from './ohaeng-guidance-validator';

// 2026-05-21 — 오행 가이드 naming-policy 검증(Phase 5). total-review 룰 재사용.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('validateOhaengGuidance: 정상 일상어 통과', () => {
  const r = validateOhaengGuidance(
    '토 기운이 도드라지는 사주예요. 안정의 힘이 강점으로 작동합니다. 부족한 수 기운을 채워 주면 흐름이 부드러워집니다.'
  );
  assert.ok(r.ok, r.reasons.join(' / '));
});

test('validateOhaengGuidance: 한자 누출 차단', () => {
  assert.equal(validateOhaengGuidance('土 기운이 강한 사주예요').ok, false);
});

test('validateOhaengGuidance: "X의 기운"(naming-policy §2) 차단', () => {
  assert.equal(validateOhaengGuidance('토의 기운이 강합니다').ok, false);
});

test('validateOhaengGuidance: 명리 술어(용신/신강) 차단', () => {
  assert.equal(validateOhaengGuidance('용신이 토라서 신강한 사주예요').ok, false);
});

test('validateOhaengGuidance: 자극/단정(대박/반드시) 차단', () => {
  assert.equal(validateOhaengGuidance('대박 나는 사주, 반드시 바뀝니다').ok, false);
});

test('validateOhaengGuidance: 일일 톤(오늘은) 차단', () => {
  assert.equal(validateOhaengGuidance('오늘은 토 기운이 좋은 날입니다').ok, false);
});

test('hasHardOhaengGuidanceViolation: 한자 true / 정상 false', () => {
  assert.equal(hasHardOhaengGuidanceViolation('金 기운'), true);
  assert.equal(hasHardOhaengGuidanceViolation('금 기운이 강한 사주예요'), false);
});
