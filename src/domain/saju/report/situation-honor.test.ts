// 2026-05-16 PR #150 (B1) — situation 호명 helper 검증.
import assert from 'node:assert/strict';
import {
  buildHonorificPrefix,
  buildSituationActionLine,
  buildSituationClosing,
} from './situation-honor';

declare const test: (name: string, fn: () => void) => void;

test('buildHonorificPrefix - situation null → 빈 문자열', () => {
  assert.equal(buildHonorificPrefix({ situation: null }), '');
  assert.equal(buildHonorificPrefix({ situation: undefined }), '');
});

test('buildHonorificPrefix - occupation + name → "직장인이신 김영민님, "', () => {
  const result = buildHonorificPrefix({
    situation: { occupation: 'employee' },
    userName: '김영민',
  });
  assert.equal(result, '직장인이신 김영민님, ');
});

test('buildHonorificPrefix - occupation only (name 없음) → "직장인이신 분께, "', () => {
  const result = buildHonorificPrefix({
    situation: { occupation: 'self-employed' },
  });
  assert.equal(result, '자영업·프리랜서이신 분께, ');
});

test('buildHonorificPrefix - occupation 우선 (relationship 도 있어도)', () => {
  const result = buildHonorificPrefix({
    situation: { occupation: 'student', relationshipStatus: 'dating' },
    userName: '하리',
  });
  assert.ok(result.includes('학생이신'));
  assert.ok(!result.includes('연애 중')); // occupation 만 사용
});

test('buildHonorificPrefix - relationship only (occupation 없음)', () => {
  const result = buildHonorificPrefix({
    situation: { relationshipStatus: 'married' },
    userName: '민수',
  });
  assert.equal(result, '기혼이신 민수님, ');
});

test('buildHonorificPrefix - occupation other (빈 라벨) + relationship → relationship 사용', () => {
  const result = buildHonorificPrefix({
    situation: { occupation: 'other', relationshipStatus: 'single' },
  });
  assert.equal(result, '솔로이신 분께, ');
});

test('buildHonorificPrefix - 모두 미입력 → ""', () => {
  const result = buildHonorificPrefix({ situation: {} });
  assert.equal(result, '');
});

test('buildSituationActionLine - concern 없음 → null', () => {
  assert.equal(buildSituationActionLine({ situation: null }), null);
  assert.equal(buildSituationActionLine({ situation: {} }), null);
});

test('buildSituationActionLine - concern + yongsin', () => {
  const result = buildSituationActionLine({
    situation: { currentConcern: 'business' },
    yongsinPrimary: '식상',
  });
  assert.ok(result);
  assert.ok(result!.includes('사업·이직'));
  assert.ok(result!.includes('식상'));
});

test('buildSituationActionLine - concern but yongsin 없음 → 일반 문구', () => {
  const result = buildSituationActionLine({
    situation: { currentConcern: 'health' },
  });
  assert.ok(result);
  assert.ok(result!.includes('건강·멘탈'));
  assert.ok(!result!.includes('null'));
});

test('buildSituationActionLine - concern other + concernNote (20자 truncate)', () => {
  const result = buildSituationActionLine({
    situation: {
      currentConcern: 'other',
      concernNote: '대학원 진학 vs 취업 사이에서 고민 중',
    },
    yongsinPrimary: '인성',
  });
  assert.ok(result);
  // 20자 truncate 확인
  assert.ok(result!.includes('대학원 진학 vs 취업'));
});

test('buildSituationClosing - situation 있으면 한 줄 반환 (호명 1회 규칙으로 closing 자체 호명 제거)', () => {
  // 2026-05-20 V2-5 PR V — closing 의 ${name}님 재호명 제거. 호명은 headline 의
  //   honorificPrefix 에서 1회만 등장. closing 은 메타 안내 ("이 풀이는 입력하신
  //   현재 상황을 함께 반영했어요.") 만 반환.
  const a = buildSituationClosing({
    situation: { occupation: 'employee' },
    userName: '영민',
  });
  assert.ok(a);
  // 호명 미포함 확인 (이전과 반대 — closing 에서 ${name}님 제거됨)
  assert.ok(!a!.includes('영민님'), 'closing 에 재호명 미포함');
  assert.ok(a!.includes('입력하신'), '메타 안내 ("입력하신") 포함');

  const b = buildSituationClosing({ situation: { occupation: 'employee' } });
  assert.ok(b);
  assert.ok(!b!.includes('null'));
});

test('buildSituationClosing - situation null → null', () => {
  assert.equal(buildSituationClosing({ situation: null }), null);
});
