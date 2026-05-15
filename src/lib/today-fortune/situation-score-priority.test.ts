// 2026-05-16 PR #149 (Part C) — 영역 점수 재정렬 + perspective 한 줄 검증.
import assert from 'node:assert/strict';
import {
  buildPerspectiveLine,
  reorderTodayScoresBySituation,
} from './situation-score-priority';
import type { TodayScoreItem } from './types';

declare const test: (name: string, fn: () => void) => void;

const sampleScores: TodayScoreItem[] = [
  { key: 'overall', label: '총운', score: 75, summary: '' },
  { key: 'love', label: '연애', score: 70, summary: '' },
  { key: 'wealth', label: '재물', score: 68, summary: '' },
  { key: 'career', label: '직장', score: 72, summary: '' },
  { key: 'relationship', label: '인간관계', score: 65, summary: '' },
  { key: 'condition', label: '컨디션', score: 80, summary: '' },
];

test('reorderTodayScoresBySituation - situation null → 기본 순서 유지', () => {
  const result = reorderTodayScoresBySituation(sampleScores, null);
  assert.deepEqual(
    result.map((s) => s.key),
    ['overall', 'love', 'wealth', 'career', 'relationship', 'condition']
  );
});

test('reorderTodayScoresBySituation - 사업·이직 고민 → career 최상위', () => {
  const result = reorderTodayScoresBySituation(sampleScores, {
    currentConcern: 'business',
  });
  assert.equal(result[0]!.key, 'overall'); // overall 은 항상 앞
  assert.equal(result[1]!.key, 'career'); // career 가 그 다음
});

test('reorderTodayScoresBySituation - 건강 고민 → condition 최상위', () => {
  const result = reorderTodayScoresBySituation(sampleScores, {
    currentConcern: 'health',
  });
  assert.equal(result[1]!.key, 'condition');
});

test('reorderTodayScoresBySituation - 직장인 + 연애 중 → career, love 가 위로', () => {
  const result = reorderTodayScoresBySituation(sampleScores, {
    occupation: 'employee',
    relationshipStatus: 'dating',
  });
  // career(+3) + love(+3+1) — love 가 4 로 가장 높음
  const orderAfterOverall = result.slice(1).map((s) => s.key);
  assert.ok(
    orderAfterOverall.indexOf('love') < orderAfterOverall.indexOf('wealth'),
    `love 가 wealth 보다 위 (실제: ${orderAfterOverall.join(',')})`
  );
  assert.ok(
    orderAfterOverall.indexOf('career') < orderAfterOverall.indexOf('wealth'),
    `career 가 wealth 보다 위`
  );
});

test('reorderTodayScoresBySituation - 재물 고민 → wealth 최상위', () => {
  const result = reorderTodayScoresBySituation(sampleScores, {
    currentConcern: 'wealth',
  });
  assert.equal(result[1]!.key, 'wealth');
});

test('reorderTodayScoresBySituation - 자녀 고민 → relationship 위로', () => {
  const result = reorderTodayScoresBySituation(sampleScores, {
    currentConcern: 'family',
  });
  const orderAfterOverall = result.slice(1).map((s) => s.key);
  assert.equal(orderAfterOverall[0], 'relationship');
});

test('reorderTodayScoresBySituation - 안정 정렬 (같은 priority 면 BASE_ORDER)', () => {
  const result = reorderTodayScoresBySituation(sampleScores, {
    occupation: 'homemaker', // priority 변화 없음
  });
  assert.deepEqual(
    result.map((s) => s.key),
    ['overall', 'love', 'wealth', 'career', 'relationship', 'condition']
  );
});

test('reorderTodayScoresBySituation - overall 없어도 안전', () => {
  const noOverall = sampleScores.filter((s) => s.key !== 'overall');
  const result = reorderTodayScoresBySituation(noOverall, {
    currentConcern: 'business',
  });
  assert.equal(result[0]!.key, 'career');
});

test('buildPerspectiveLine - 미입력 → null', () => {
  assert.equal(buildPerspectiveLine(null), null);
  assert.equal(buildPerspectiveLine({}), null);
});

test('buildPerspectiveLine - 직장인 + 사업 고민', () => {
  const line = buildPerspectiveLine({
    occupation: 'employee',
    currentConcern: 'business',
  });
  assert.ok(line);
  assert.ok(line!.includes('직장인'));
  assert.ok(line!.includes('사업·이직 고민'));
  assert.ok(line!.endsWith('관점에서'));
});

test('buildPerspectiveLine - 자유 입력 concernNote 우선', () => {
  const line = buildPerspectiveLine({
    currentConcern: 'other',
    concernNote: '대학원 진학 vs 취업 사이',
  });
  assert.ok(line);
  assert.ok(line!.includes('대학원 진학 vs 취업'));
  assert.ok(line!.includes('고민'));
});

test('buildPerspectiveLine - 일부만 입력해도 ·로 자연 결합', () => {
  const line1 = buildPerspectiveLine({ occupation: 'student' });
  assert.equal(line1, '학생 관점에서');

  const line2 = buildPerspectiveLine({
    relationshipStatus: 'dating',
    occupation: 'employee',
  });
  assert.ok(line2!.includes(' · '));
});
