import test from 'node:test';
import assert from 'node:assert/strict';
import type { LifetimeHealthRhythmSection } from '@/domain/saju/report/lifetime-types';
import { enhanceLifetimeChapter7WithLLM } from './enhance-lifetime-chapter7';
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

const original: LifetimeHealthRhythmSection = {
  headline: '건강 리듬',
  summary: '쇠 축의 리듬이 흐트러지면 생활 템포가 어긋나기 쉬운 명식. (기존)',
  warningSignals: '수면 부족 신호',
  recoveryRoutine: '가벼운 유산소',
  habitPoints: ['아침 햇살 받기'],
  basis: [],
};

const baseInput: ChapterLLMInput = {
  chapterId: 7,
  chapter: { title: '건강 리듬', lens: '신체 결', forbiddenTopics: ['구체적 질병 진단 - 절대 금지'] },
  saju: {
    pillars: { year: '임술', month: '신축', day: '기사', hour: '무진' },
    dayMaster: { stem: '기', element: '흙의 결', metaphor: '' },
    fiveElements: { dominant: '흙의 결', weakest: '쇠의 결', supportElements: [], distribution: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 } },
    pattern: { label: '정인격', plainCue: '' },
    yongsin: { primary: '햇살의 결', reason: '' },
    strength: '균형이 잡힌 편',
    tenGods: { dominant: '정인', shortageList: [] },
    notableSinsals: [],
  },
  userContext: { name: null, age: null, relationshipStatus: null, occupation: null, currentConcern: 'health' },
};

const ENHANCED = '흙이 과한 결이라 둔감해지는 신호가 먼저 와요. 가벼운 유산소를 주 3회 두는 게 회복 축이에요.';

test('enhanceLifetimeChapter7WithLLM — 성공 시 summary 교체', async () => {
  const client = new MockClient([ENHANCED]);
  const result = await enhanceLifetimeChapter7WithLLM(original, baseInput, client);
  assert.equal(result.source, 'llm');
  assert.equal(result.healthRhythm.summary, ENHANCED);
  assert.equal(result.healthRhythm.recoveryRoutine, original.recoveryRoutine);
});

test('enhanceLifetimeChapter7WithLLM — chapterId !== 7 시 throw', async () => {
  const client = new MockClient([ENHANCED]);
  try {
    await enhanceLifetimeChapter7WithLLM(original, { ...baseInput, chapterId: 1 }, client);
    assert.fail('throw 되어야 함');
  } catch (error) {
    assert.match((error as Error).message, /chapterId.*7/);
  }
});

test('enhanceLifetimeChapter7WithLLM — 의료법 가드: 단정 표현 fail 시 fallback', async () => {
  // '반드시' 는 FORBIDDEN_ABSOLUTE_PHRASES — validator fail.
  const violating = '반드시 매일 운동하세요. 그렇지 않으면 큰 문제가 생깁니다.';
  const client = new MockClient([violating, violating, violating]);
  const result = await enhanceLifetimeChapter7WithLLM(original, baseInput, client, { maxRetries: 2 });
  assert.equal(result.source, 'fallback');
  assert.equal(result.healthRhythm.summary, original.summary);
});
