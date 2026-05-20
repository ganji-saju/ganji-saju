import test from 'node:test';
import assert from 'node:assert/strict';
import type { LifetimePatternAndYongsinSection } from '@/domain/saju/report/lifetime-types';
import { enhanceLifetimeChapter3WithLLM } from './enhance-lifetime-chapter3';
import type { ChapterLLMClient } from './generate-chapter';
import type { ChapterLLMInput } from './chapter-input-types';

class MockClient implements ChapterLLMClient {
  callCount = 0;
  constructor(private readonly responses: string[]) {}
  async generate(): Promise<string> {
    const idx = Math.min(this.callCount, this.responses.length - 1);
    this.callCount++;
    return this.responses[idx] ?? '';
  }
}

const original: LifetimePatternAndYongsinSection = {
  headline: '역할과 보완 힌트',
  summary: '정인격 — 돌봄·후원·배움의 결이 반복되는 역할입니다. (기존 deterministic)',
  patternRole: '학습·강의·돌봄 환경에서 빛남',
  yongsinDirection: '햇살의 결 보강',
  choiceRule: '기준을 먼저 정하고 시작',
  supportSymbols: [],
  cautionSymbols: [],
  practicalActions: [],
  detailLines: [],
  basis: [],
};

const baseInput: ChapterLLMInput = {
  chapterId: 3,
  chapter: { title: '역할과 보완 힌트', lens: '반복되는 역할', forbiddenTopics: [] },
  saju: {
    pillars: { year: '임술', month: '신축', day: '기사', hour: '무진' },
    dayMaster: { stem: '기', element: '흙의 결', metaphor: '' },
    fiveElements: { dominant: '흙의 결', weakest: '쇠의 결', supportElements: [], distribution: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 } },
    pattern: { label: '정인격', plainCue: '돌봄' },
    yongsin: { primary: '햇살의 결', reason: '' },
    strength: '균형이 잡힌 편',
    tenGods: { dominant: '정인', shortageList: [] },
    notableSinsals: [],
  },
  userContext: { name: null, age: null, relationshipStatus: null, occupation: null, currentConcern: null },
};

const ENHANCED = '선생님은 살면서 돌봄과 후원의 역할이 반복돼요. 학습 환경에서 강점이 살아납니다.';

test('enhanceLifetimeChapter3WithLLM — 성공 시 summary 교체, 다른 필드 보존', async () => {
  const client = new MockClient([ENHANCED]);
  const result = await enhanceLifetimeChapter3WithLLM(original, baseInput, client);
  assert.equal(result.source, 'llm');
  assert.equal(result.patternAndYongsin.summary, ENHANCED);
  assert.equal(result.patternAndYongsin.patternRole, original.patternRole);
  assert.equal(result.patternAndYongsin.yongsinDirection, original.yongsinDirection);
});

test('enhanceLifetimeChapter3WithLLM — chapterId !== 3 시 throw', async () => {
  const client = new MockClient([ENHANCED]);
  try {
    await enhanceLifetimeChapter3WithLLM(original, { ...baseInput, chapterId: 1 }, client);
    assert.fail('throw 되어야 함');
  } catch (error) {
    assert.match((error as Error).message, /chapterId.*3/);
  }
});
