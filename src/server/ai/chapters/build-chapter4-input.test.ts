import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildChapter4Input } from './build-chapter4-input';

// 2026-05-20 V2-5 PR J — 챕터 4 (관계 패턴) LLM 입력 converter 테스트.
//   build-chapter1-input.test 패턴 그대로. chapterId / chapter meta 만 다름.

test('buildChapter4Input — fixture 사주에서 ChapterLLMInput{chapterId:4} 정상 빌드', () => {
  const data = calculateSajuDataV1({
    year: 1982, month: 1, day: 29, hour: 8, gender: 'male',
  });

  const input = buildChapter4Input(data, null, { name: '테스트', age: 43 });

  assert.equal(input.chapterId, 4);
  assert.equal(input.chapter.title, '관계 패턴');
  assert.ok(input.chapter.lens.length > 0);
  assert.ok(input.chapter.forbiddenTopics.length > 0);

  // pillars 한자 → 한글
  assert.ok(/^[가-힣]+$/.test(input.saju.pillars.year), `year 한글: ${input.saju.pillars.year}`);
  assert.ok(/^[가-힣]+$/.test(input.saju.pillars.day), `day 한글: ${input.saju.pillars.day}`);

  // dayMaster 자연 비유 라벨
  assert.match(input.saju.dayMaster.element, / 기운$/);

  // fiveElements distribution 5 entry 모두 정의됨
  for (const key of ['목', '화', '토', '금', '수'] as const) {
    const value = input.saju.fiveElements.distribution[key];
    assert.ok(typeof value === 'number', `distribution.${key} 가 숫자`);
    assert.ok(value >= 0 && value <= 1, `distribution.${key}=${value} 가 0~1`);
  }

  // userContext
  assert.equal(input.userContext.name, '테스트');
  assert.equal(input.userContext.age, 43);
  assert.equal(input.userContext.relationshipStatus, null);
});

test('buildChapter4Input — relationshipStatus 매핑 (married / single / dating 모두 그대로 전달)', () => {
  const data = calculateSajuDataV1({
    year: 1990, month: 6, day: 15, hour: 14, gender: 'female',
  });

  const married = buildChapter4Input(data, { relationshipStatus: 'married' }, {});
  assert.equal(married.userContext.relationshipStatus, 'married');

  const single = buildChapter4Input(data, { relationshipStatus: 'single' }, {});
  assert.equal(single.userContext.relationshipStatus, 'single');

  const dating = buildChapter4Input(data, { relationshipStatus: 'dating' }, {});
  assert.equal(dating.userContext.relationshipStatus, 'dating');
});

test('buildChapter4Input — userSituation null 안전', () => {
  const data = calculateSajuDataV1({
    year: 1985, month: 3, day: 10, hour: 12, gender: 'male',
  });

  const input = buildChapter4Input(data, null, {});

  assert.equal(input.userContext.relationshipStatus, null);
  assert.equal(input.userContext.occupation, null);
  assert.equal(input.userContext.currentConcern, null);
});

// 🟡 대운 다양성 — 직렬 생성 시 앞 챕터 digest 를 4번째 인자로 받아 input 에 실음.
//   (ch4/ch5 는 buildChapter1Input 위임이 아닌 독립 구현 경로라 별도 검증.)
test('buildChapter4Input — priorChapterDigests 전달/미전달 분기', () => {
  const data = calculateSajuDataV1({
    year: 1982, month: 1, day: 29, hour: 8, gender: 'male',
  });
  const priors = [
    { chapterId: 1 as const, title: '타고난 성향', digest: '돌봄과 배움이 본질' },
    { chapterId: 3 as const, title: '역할과 보완 힌트', digest: '정인격 역할 반복' },
  ];
  const withPriors = buildChapter4Input(data, null, {}, priors);
  assert.deepEqual(withPriors.priorChapterDigests, priors);

  const withoutPriors = buildChapter4Input(data, null, {});
  assert.equal(withoutPriors.priorChapterDigests, undefined);
});
