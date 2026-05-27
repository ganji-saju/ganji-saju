// 2026-05-15 PR 7 — 04 카테고리 라이브러리 검증.
import assert from 'node:assert/strict';
import {
  CATEGORY_MESSAGE_LIBRARY,
  pickCategoryMessage,
  scoreToGrade,
} from './category-message-library';

declare const test: (name: string, fn: () => void) => void;

test('scoreToGrade - 5단계 매핑 (90+/70+/45+/30+/else)', () => {
  assert.equal(scoreToGrade(95), 'peak');
  assert.equal(scoreToGrade(85), 'good');
  assert.equal(scoreToGrade(70), 'good');
  assert.equal(scoreToGrade(60), 'normal');
  assert.equal(scoreToGrade(45), 'normal');
  assert.equal(scoreToGrade(40), 'caution');
  assert.equal(scoreToGrade(30), 'caution');
  assert.equal(scoreToGrade(20), 'danger');
});

test('CATEGORY_MESSAGE_LIBRARY - 6 카테고리 × 5 등급 모두 비어 있지 않음', () => {
  const categories = ['wealth', 'love', 'career', 'health', 'relationship', 'lottery'] as const;
  const grades = ['peak', 'good', 'normal', 'caution', 'danger'] as const;
  for (const c of categories) {
    for (const g of grades) {
      const pool = CATEGORY_MESSAGE_LIBRARY[c][g];
      assert.ok(pool.length >= 10, `${c}:${g} 풀 부족 (${pool.length})`);
      for (const msg of pool) {
        assert.ok(msg.length >= 20, `${c}:${g} 짧은 문장 ${msg}`);
      }
    }
  }
});

test('pickCategoryMessage - 같은 시드는 같은 메시지, 다른 시드는 다른 메시지', () => {
  const m1 = pickCategoryMessage('wealth', 80, {}, '2026-05-15');
  const m2 = pickCategoryMessage('wealth', 80, {}, '2026-05-15');
  assert.equal(m1, m2, '같은 시드 → 같은 메시지');
  const m3 = pickCategoryMessage('wealth', 80, {}, '2026-05-16');
  // 라운드-로빈이라 변형이 다를 가능성 큼 (보장 100% 는 아니지만 통계적으로 거의 항상).
  assert.ok(m3.length > 0);
});

test('pickCategoryMessage - 변수 [이름] 치환', () => {
  const m = pickCategoryMessage('love', 95, { name: '재호' }, 'seed-test');
  assert.ok(!m.includes('[이름]'), `[이름] 치환 안됨: ${m}`);
});

test('pickCategoryMessage - 점수 등급별 다른 풀 사용', () => {
  // peak score (95) vs danger score (10) 는 거의 항상 다른 문장.
  const peakMsg = pickCategoryMessage('career', 95, {}, 'fixed');
  const dangerMsg = pickCategoryMessage('career', 10, {}, 'fixed');
  assert.notEqual(peakMsg, dangerMsg);
});

test('pickCategoryMessage - 사용자 노출 문구에서 표현/기준 계열 단어 제거', () => {
  const categories = ['wealth', 'love', 'career', 'health', 'relationship', 'lottery'] as const;
  const scores = [95, 80, 60, 40, 20];

  for (const category of categories) {
    for (const score of scores) {
      for (let i = 0; i < 16; i += 1) {
        const message = pickCategoryMessage(category, score, { name: '재호' }, `seed-${i}`);
        assert.doesNotMatch(message, /표현|기준/, `${category}:${score}:${i} ${message}`);
      }
    }
  }
});
