import test from 'node:test';
import assert from 'node:assert/strict';
import type { LifetimeRelationshipPatternSection } from '@/domain/saju/report/lifetime-types';
import type { ChapterLLMInput } from './chapter-input-types';
import type { ChapterLLMClient } from './generate-chapter';
import { enhanceLifetimeChapter4WithLLM } from './enhance-lifetime-chapter4';
import { CHAPTER_META } from './chapter-prompts';

// 2026-05-20 V2-5 PR J — 챕터 4 (관계 패턴) LLM enhancement 테스트.
//   PR #261 의 enhanceLifetimeChapter1 패턴 동일. summary 만 교체, 다른 field 보존.

const fixtureRelationship: LifetimeRelationshipPatternSection = {
  headline: '관계 패턴',
  summary: '원본 deterministic 본문',
  distanceStyle: '거리감 조절 설명',
  expressionStyle: '표현 방식 설명',
  conflictTriggers: '충돌 trigger 설명',
  longevityGuide: '오래가는 관계 핵심',
  basis: ['relationshipReport 헤드라인', 'loveReport 요약'],
};

const fixtureInput: ChapterLLMInput = {
  chapterId: 4,
  chapter: CHAPTER_META[4],
  saju: {
    pillars: { year: '임술', month: '신축', day: '계묘', hour: '병진' },
    dayMaster: { stem: '계', element: '물의 결', metaphor: '' },
    fiveElements: {
      dominant: '물의 결', weakest: '쇠의 결', supportElements: [],
      distribution: { 목: 0.2, 화: 0.1, 토: 0.2, 금: 0.1, 수: 0.4 },
    },
    pattern: { label: '식신격', plainCue: '' },
    yongsin: { primary: '金', reason: '' },
    strength: '에너지가 강한 편',
    tenGods: { dominant: '식신', shortageList: ['관성'] },
    notableSinsals: [],
  },
  userContext: {
    name: null, age: null,
    relationshipStatus: 'single', occupation: null, currentConcern: null,
  },
};

test('enhanceLifetimeChapter4WithLLM — LLM 성공 시 summary 만 교체, 다른 field 보존', async () => {
  const llmBody = '본문은 거리감을 두고 신중하게 접근하는 결입니다. 가까운 사람과는 따뜻한 표현, 거리 둔 사이는 신중함을 유지하는 패턴이 자연스럽게 흐릅니다.';
  const fakeClient: ChapterLLMClient = {
    async generate() {
      return llmBody;
    },
  };

  const result = await enhanceLifetimeChapter4WithLLM(
    fixtureRelationship, fixtureInput, fakeClient
  );

  assert.equal(result.source, 'llm');
  assert.equal(result.relationshipPattern.summary, llmBody);
  // 다른 field 보존
  assert.equal(result.relationshipPattern.headline, fixtureRelationship.headline);
  assert.equal(result.relationshipPattern.distanceStyle, fixtureRelationship.distanceStyle);
  assert.equal(result.relationshipPattern.expressionStyle, fixtureRelationship.expressionStyle);
  assert.equal(result.relationshipPattern.conflictTriggers, fixtureRelationship.conflictTriggers);
  assert.equal(result.relationshipPattern.longevityGuide, fixtureRelationship.longevityGuide);
  assert.deepEqual(result.relationshipPattern.basis, fixtureRelationship.basis);
});

test('enhanceLifetimeChapter4WithLLM — LLM 실패 시 source=fallback, 원본 summary 보존', async () => {
  const failingClient: ChapterLLMClient = {
    async generate() {
      throw new Error('OpenAI timeout');
    },
  };

  const result = await enhanceLifetimeChapter4WithLLM(
    fixtureRelationship, fixtureInput, failingClient
  );

  assert.equal(result.source, 'fallback');
  assert.equal(result.relationshipPattern.summary, fixtureRelationship.summary);
});

test('enhanceLifetimeChapter4WithLLM — input.chapterId !== 4 시 에러', async () => {
  const badInput = { ...fixtureInput, chapterId: 1 as const };
  const fakeClient: ChapterLLMClient = {
    async generate() {
      return '...';
    },
  };

  await assert.rejects(
    () => enhanceLifetimeChapter4WithLLM(fixtureRelationship, badInput as ChapterLLMInput, fakeClient),
    /chapterId 는 4/
  );
});
