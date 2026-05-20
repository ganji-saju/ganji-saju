import test from 'node:test';
import assert from 'node:assert/strict';
import type { LifetimeWealthStyleSection } from '@/domain/saju/report/lifetime-types';
import type { ChapterLLMInput } from './chapter-input-types';
import type { ChapterLLMClient } from './generate-chapter';
import { enhanceLifetimeChapter5WithLLM } from './enhance-lifetime-chapter5';
import { CHAPTER_META } from './chapter-prompts';

// 2026-05-20 V2-5 PR J — 챕터 5 (재물 감각) LLM enhancement 테스트.

const fixtureWealth: LifetimeWealthStyleSection = {
  headline: '재물 감각',
  summary: '원본 deterministic 본문',
  earningStyle: '버는 결 설명',
  keepingStyle: '지키는 결 설명',
  spendingMistakes: '지출 mistakes 설명',
  operatingStyle: '운영 강점 설명',
  basis: ['wealthReport 헤드라인', '용신 보조'],
};

const fixtureInput: ChapterLLMInput = {
  chapterId: 5,
  chapter: CHAPTER_META[5],
  saju: {
    pillars: { year: '임술', month: '신축', day: '계묘', hour: '병진' },
    dayMaster: { stem: '계', element: '수 기운', metaphor: '' },
    fiveElements: {
      dominant: '수 기운', weakest: '금 기운', supportElements: [],
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
    relationshipStatus: null, occupation: 'employee', currentConcern: 'wealth',
  },
};

test('enhanceLifetimeChapter5WithLLM — 성공 시 summary 만 교체, 다른 field 보존', async () => {
  const llmBody = '본문은 흐름을 만들어 운영하는 결입니다. 작은 흐름을 차곡차곡 모으는 방식이 본인 결과 가장 잘 맞고, 한 번에 크게 벌리려 할 때 새는 결이 생깁니다.';
  const fakeClient: ChapterLLMClient = {
    async generate() {
      return llmBody;
    },
  };

  const result = await enhanceLifetimeChapter5WithLLM(fixtureWealth, fixtureInput, fakeClient);

  assert.equal(result.source, 'llm');
  assert.equal(result.wealthStyle.summary, llmBody);
  assert.equal(result.wealthStyle.headline, fixtureWealth.headline);
  assert.equal(result.wealthStyle.earningStyle, fixtureWealth.earningStyle);
  assert.equal(result.wealthStyle.keepingStyle, fixtureWealth.keepingStyle);
  assert.equal(result.wealthStyle.spendingMistakes, fixtureWealth.spendingMistakes);
  assert.equal(result.wealthStyle.operatingStyle, fixtureWealth.operatingStyle);
  assert.deepEqual(result.wealthStyle.basis, fixtureWealth.basis);
});

test('enhanceLifetimeChapter5WithLLM — LLM 실패 시 source=fallback, 원본 summary 보존', async () => {
  const failingClient: ChapterLLMClient = {
    async generate() {
      throw new Error('OpenAI timeout');
    },
  };

  const result = await enhanceLifetimeChapter5WithLLM(fixtureWealth, fixtureInput, failingClient);

  assert.equal(result.source, 'fallback');
  assert.equal(result.wealthStyle.summary, fixtureWealth.summary);
});

test('enhanceLifetimeChapter5WithLLM — input.chapterId !== 5 시 에러', async () => {
  const badInput = { ...fixtureInput, chapterId: 4 as const };
  const fakeClient: ChapterLLMClient = {
    async generate() {
      return '...';
    },
  };

  await assert.rejects(
    () => enhanceLifetimeChapter5WithLLM(fixtureWealth, badInput as ChapterLLMInput, fakeClient),
    /chapterId 는 5/
  );
});
