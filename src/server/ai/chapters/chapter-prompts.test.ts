import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMON_SYSTEM_PROMPT,
  CHAPTER_META,
  CHAPTER_OUTPUT_SPECS,
  buildChapterSystemPrompt,
} from './chapter-prompts';
import type { ChapterId } from './chapter-input-types';

const ALL_CHAPTER_IDS: ChapterId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

test('CHAPTER_META 가 9 챕터 모두 정의', () => {
  for (const id of ALL_CHAPTER_IDS) {
    const meta = CHAPTER_META[id];
    assert.ok(meta, `챕터 ${id} 메타 누락`);
    assert.ok(meta.title.length > 0, `챕터 ${id} title 빈 문자열`);
    assert.ok(meta.lens.length > 0, `챕터 ${id} lens 빈 문자열`);
    assert.ok(meta.forbiddenTopics.length > 0, `챕터 ${id} forbiddenTopics 빈 배열`);
  }
});

test('CHAPTER_OUTPUT_SPECS 가 9 챕터 모두 정의', () => {
  for (const id of ALL_CHAPTER_IDS) {
    const spec = CHAPTER_OUTPUT_SPECS[id];
    assert.ok(spec, `챕터 ${id} 출력 spec 누락`);
    assert.ok(spec.structureGuide.length > 0, `챕터 ${id} structureGuide 빈 문자열`);
  }
});

test('COMMON_SYSTEM_PROMPT 가 핵심 7 룰 모두 포함', () => {
  const requiredRules = [
    '한자 금지',
    '오행 라벨 한글 표기 강제',
    '영어 단어 금지',
    '단정형 금지',
    '공포 표현 금지',
    '호명',
    '명리 술어 + 일상어 병기',
  ];
  for (const rule of requiredRules) {
    assert.ok(
      COMMON_SYSTEM_PROMPT.includes(rule),
      `공통 prompt 에 '${rule}' 규칙 누락`
    );
  }
});

test('COMMON_SYSTEM_PROMPT 가 한글 표기 5 라벨 모두 포함', () => {
  // 2026-05-20 V2-5 PR O — 자연 비유 → 한국 사주 사이트 표준 표기.
  const required = ['목 기운', '화 기운', '토 기운', '금 기운', '수 기운'];
  for (const label of required) {
    assert.ok(
      COMMON_SYSTEM_PROMPT.includes(label),
      `공통 prompt 에 '${label}' 라벨 누락`
    );
  }
});

test('COMMON_SYSTEM_PROMPT 가 옛 "X과 Y" 라벨 5종 모두 금지 명시', () => {
  // 1번 룰의 자연 비유 강제 부분에서 옛 라벨 금지를 명시해야 함
  assert.ok(
    COMMON_SYSTEM_PROMPT.includes('결단과 마무리') ||
      COMMON_SYSTEM_PROMPT.includes('옛 라벨 금지'),
    "공통 prompt 가 옛 'X과 Y' 라벨 금지를 명시해야 함"
  );
});

test('buildChapterSystemPrompt — 9 챕터 모두 build 성공', () => {
  for (const id of ALL_CHAPTER_IDS) {
    const prompt = buildChapterSystemPrompt(id);
    assert.ok(prompt.length > 0, `챕터 ${id} system prompt 빈 문자열`);
    assert.ok(prompt.includes('한자 금지'), `챕터 ${id} prompt 가 공통 규칙 누락`);
    assert.ok(prompt.includes(CHAPTER_META[id].title), `챕터 ${id} prompt 가 챕터 title 누락`);
    assert.ok(prompt.includes(CHAPTER_META[id].lens), `챕터 ${id} prompt 가 lens 누락`);
  }
});

test('buildChapterSystemPrompt — 챕터별 forbiddenTopics 가 prompt 에 모두 포함', () => {
  for (const id of ALL_CHAPTER_IDS) {
    const prompt = buildChapterSystemPrompt(id);
    for (const topic of CHAPTER_META[id].forbiddenTopics) {
      assert.ok(
        prompt.includes(topic),
        `챕터 ${id} prompt 에 forbiddenTopic '${topic}' 누락`
      );
    }
  }
});

test('챕터 1~7 의 digestFormat 정의됨, 챕터 9 는 null', () => {
  for (const id of [1, 2, 3, 4, 5, 6, 7] as ChapterId[]) {
    assert.ok(
      CHAPTER_OUTPUT_SPECS[id].digestFormat,
      `챕터 ${id} 의 digestFormat 필요 (9장 synthesis 입력용)`
    );
  }
  assert.equal(
    CHAPTER_OUTPUT_SPECS[9].digestFormat,
    null,
    '챕터 9 는 다른 챕터의 합 — digestFormat 없음'
  );
});

test('CHAPTER_META 의 forbiddenTopics 가 cross-reference 차단 — 챕터 N 이 다른 챕터의 영역을 명시', () => {
  // 1장은 4,5,6,7,8장의 forbiddenTopics 가 있어야 함 (성격 외 영역 금지)
  // 7장은 의료 진단 금지 (가장 중요)
  const chapter7Topics = CHAPTER_META[7].forbiddenTopics.join(' ');
  assert.ok(
    chapter7Topics.includes('질병') || chapter7Topics.includes('의료'),
    '챕터 7 (건강) 의 forbiddenTopics 가 의료적 단정 금지를 명시해야 함'
  );

  // 9장은 1~8장 본문 복사 금지를 명시
  const chapter9Topics = CHAPTER_META[9].forbiddenTopics.join(' ');
  assert.ok(
    chapter9Topics.includes('복사') || chapter9Topics.includes('재인용'),
    '챕터 9 (synthesis) 의 forbiddenTopics 가 1~8장 복사 금지를 명시해야 함'
  );
});
