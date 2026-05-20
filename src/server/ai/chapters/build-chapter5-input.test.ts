import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildChapter5Input } from './build-chapter5-input';

// 2026-05-20 V2-5 PR J — 챕터 5 (재물 감각) LLM 입력 converter 테스트.

test('buildChapter5Input — fixture 사주에서 ChapterLLMInput{chapterId:5} 정상 빌드', () => {
  const data = calculateSajuDataV1({
    year: 1982, month: 1, day: 29, hour: 8, gender: 'male',
  });

  const input = buildChapter5Input(data, null, { name: '테스트', age: 43 });

  assert.equal(input.chapterId, 5);
  assert.equal(input.chapter.title, '재물 감각');
  assert.ok(input.chapter.lens.length > 0);
  assert.ok(input.chapter.forbiddenTopics.length > 0);

  // pillars 한자 → 한글
  assert.ok(/^[가-힣]+$/.test(input.saju.pillars.year));
});

test('buildChapter5Input — occupation 매핑 (employee / self-employed / student / job-seeking 그대로)', () => {
  const data = calculateSajuDataV1({
    year: 1990, month: 6, day: 15, hour: 14, gender: 'female',
  });

  for (const occ of ['employee', 'self-employed', 'student', 'job-seeking'] as const) {
    const input = buildChapter5Input(data, { occupation: occ }, {});
    assert.equal(input.userContext.occupation, occ, `occupation=${occ}`);
  }

  // homemaker / other → null narrowing
  const homemaker = buildChapter5Input(data, { occupation: 'homemaker' }, {});
  assert.equal(homemaker.userContext.occupation, null);
});

test('buildChapter5Input — currentConcern wealth/business 직통, romance→love 매핑', () => {
  const data = calculateSajuDataV1({
    year: 1985, month: 3, day: 10, hour: 12, gender: 'male',
  });

  const wealth = buildChapter5Input(data, { currentConcern: 'wealth' }, {});
  assert.equal(wealth.userContext.currentConcern, 'wealth');

  const business = buildChapter5Input(data, { currentConcern: 'business' }, {});
  assert.equal(business.userContext.currentConcern, 'business');

  const romance = buildChapter5Input(data, { currentConcern: 'romance' }, {});
  assert.equal(romance.userContext.currentConcern, 'love');
});
