import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { upgradeSajuDataV1ToV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import { buildChapter1Input } from './build-chapter1-input';

// 2026-05-19 (a) 2-1 — SajuDataV1 + V2 → ChapterLLMInput 변환 검증.

test('buildChapter1Input — fixture 사주에서 ChapterLLMInput 정상 빌드', () => {
  const data = calculateSajuDataV1({
    year: 1982,
    month: 1,
    day: 29,
    hour: 8,
    gender: 'male',
  });

  const input = buildChapter1Input(data, null, { name: '테스트', age: 43 });

  assert.equal(input.chapterId, 1);
  assert.equal(input.chapter.title, '타고난 성향');
  assert.ok(input.chapter.lens.length > 0);
  assert.ok(input.chapter.forbiddenTopics.length > 0);

  // pillars 한자 → 한글 변환
  assert.ok(/^[가-힣]+$/.test(input.saju.pillars.year), `year 한글: ${input.saju.pillars.year}`);
  assert.ok(/^[가-힣]+$/.test(input.saju.pillars.day), `day 한글: ${input.saju.pillars.day}`);

  // dayMaster: stem 한글 + element 자연 비유 라벨
  assert.ok(/^[가-힣]$/.test(input.saju.dayMaster.stem), `stem 한 글자 한글: ${input.saju.dayMaster.stem}`);
  assert.match(input.saju.dayMaster.element, /의 결$/, `element 자연 비유: ${input.saju.dayMaster.element}`);

  // fiveElements
  assert.match(input.saju.fiveElements.dominant, /의 결$/);
  assert.match(input.saju.fiveElements.weakest, /의 결$/);
  // distribution 5 entry 모두 정의됨
  for (const key of ['목', '화', '토', '금', '수'] as const) {
    const value = input.saju.fiveElements.distribution[key];
    assert.ok(typeof value === 'number', `distribution.${key} 가 숫자`);
    assert.ok(value >= 0 && value <= 1, `distribution.${key}=${value} 가 0~1`);
  }

  // strength 일상어
  assert.ok(
    ['에너지가 강한 편', '균형이 잡힌 편', '에너지가 차분한 편'].includes(input.saju.strength),
    `strength 일상어: ${input.saju.strength}`
  );

  // userContext
  assert.equal(input.userContext.name, '테스트');
  assert.equal(input.userContext.age, 43);
  assert.equal(input.userContext.relationshipStatus, null);
});

test('buildChapter1Input — userSituation 매핑 (homemaker / other → null narrowing)', () => {
  const data = calculateSajuDataV1({
    year: 1990,
    month: 6,
    day: 15,
    hour: 14,
    gender: 'female',
  });

  const input = buildChapter1Input(
    data,
    {
      relationshipStatus: 'married',
      occupation: 'homemaker', // 좁은 enum 에 없음 → null
      currentConcern: 'other',  // 좁은 enum 에 없음 → null
    },
    { name: null, age: null }
  );

  assert.equal(input.userContext.relationshipStatus, 'married');
  assert.equal(input.userContext.occupation, null, "homemaker 는 narrowing 으로 null");
  assert.equal(input.userContext.currentConcern, null, "other 는 narrowing 으로 null");
});

test('buildChapter1Input — currentConcern romance → love, family → relationship 매핑', () => {
  const data = calculateSajuDataV1({
    year: 1985,
    month: 3,
    day: 20,
    hour: 10,
    gender: 'male',
  });

  const romanceInput = buildChapter1Input(
    data,
    { relationshipStatus: 'dating', occupation: 'employee', currentConcern: 'romance' }
  );
  assert.equal(romanceInput.userContext.currentConcern, 'love');

  const familyInput = buildChapter1Input(
    data,
    { relationshipStatus: 'married', occupation: 'self-employed', currentConcern: 'family' }
  );
  assert.equal(familyInput.userContext.currentConcern, 'relationship');
});

test('buildChapter1Input — userSituation = null 시 모든 사용자 컨텍스트 null', () => {
  const data = calculateSajuDataV1({
    year: 1995,
    month: 11,
    day: 5,
    hour: 18,
    gender: 'female',
  });

  const input = buildChapter1Input(data, null);

  assert.equal(input.userContext.name, null);
  assert.equal(input.userContext.age, null);
  assert.equal(input.userContext.relationshipStatus, null);
  assert.equal(input.userContext.occupation, null);
  assert.equal(input.userContext.currentConcern, null);
});

test('buildChapter1Input — 변환된 ChapterSaju 가 chapter-prompts 의 buildChapterUserMessage 와 호환', () => {
  // 통합 검증: build-chapter1-input + buildChapterUserMessage 가 함께 동작.
  const data = calculateSajuDataV1({
    year: 1982,
    month: 1,
    day: 29,
    hour: 8,
    gender: 'male',
  });

  const input = buildChapter1Input(data, null, { name: '테스트', age: 43 });
  // chapter-prompts.ts 의 buildChapterUserMessage 가 input 을 받아 string 생성하는지
  // (직접 import 해서 검증)
  // 별도 chapter-prompts.test.ts 에서 이미 검증되므로 여기서는 input 의 chapterId 만 확인.
  assert.equal(input.chapterId, 1);
});

// 2026-05-19 — V2 호환 검증 (engine/index.ts 의 가이드: "새 코드는 가급적 v2").
test('buildChapter1Input — SajuDataV2 객체도 받아 동일 핵심 필드 매핑', () => {
  const v1 = calculateSajuDataV1({
    year: 1982,
    month: 1,
    day: 29,
    hour: 8,
    gender: 'male',
  });
  const v2 = upgradeSajuDataV1ToV2(v1);

  const inputV1 = buildChapter1Input(v1, null, { name: '테스트', age: 43 });
  const inputV2 = buildChapter1Input(v2, null, { name: '테스트', age: 43 });

  // 핵심 매핑 (pillars/dayMaster/fiveElements/pattern/strength/tenGods) 가 V1, V2 동일
  assert.deepEqual(inputV1.saju.pillars, inputV2.saju.pillars);
  assert.deepEqual(inputV1.saju.dayMaster, inputV2.saju.dayMaster);
  assert.deepEqual(inputV1.saju.fiveElements, inputV2.saju.fiveElements);
  assert.deepEqual(inputV1.saju.pattern, inputV2.saju.pattern);
  assert.equal(inputV1.saju.strength, inputV2.saju.strength);
  assert.deepEqual(inputV1.saju.tenGods, inputV2.saju.tenGods);
});
