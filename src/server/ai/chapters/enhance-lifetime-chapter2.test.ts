import test from 'node:test';
import assert from 'node:assert/strict';
import type { LifetimeStrengthBalanceSection } from '@/domain/saju/report/lifetime-types';
import { enhanceLifetimeChapter2WithLLM } from './enhance-lifetime-chapter2';
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

const original: LifetimeStrengthBalanceSection = {
  headline: '기운의 균형',
  summary: '토 기운이 강하고 금 기운이 부족한 명식입니다. (기존 deterministic 본문)',
  strongAxis: '흙',
  weakAxis: '쇠',
  energyDrain: '책임 누적',
  recovery: '쇠 보강',
  balanceGuide: ['주간 우선순위 3개 적기'],
  elementHighlights: ['흙 40% · 강 · 4점'],
  basis: ['흙 강 · 쇠 약'],
};

const baseInput: ChapterLLMInput = {
  chapterId: 2,
  chapter: {
    title: '기운의 균형',
    lens: '오행 5 기운의 강약',
    forbiddenTopics: ['성격 묘사', '관계/재물/직업'],
  },
  saju: {
    pillars: { year: '임술', month: '신축', day: '기사', hour: '무진' },
    dayMaster: { stem: '기', element: '토 기운', metaphor: '따뜻하게 익히는 흙' },
    fiveElements: {
      dominant: '토 기운', weakest: '금 기운', supportElements: [],
      distribution: { 목: 0.1, 화: 0.2, 토: 0.4, 금: 0.1, 수: 0.2 },
    },
    pattern: { label: '정인격', plainCue: '돌봄·후원의 결' },
    yongsin: { primary: '화 기운', reason: '흙 보강' },
    strength: '균형이 잡힌 편',
    tenGods: { dominant: '정인', shortageList: ['식신'] },
    notableSinsals: [],
  },
  userContext: { name: '테스트', age: 33, relationshipStatus: 'single', occupation: 'employee', currentConcern: null },
};

const ENHANCED = '토 기운이 또렷이 흐르는 명식입니다. 금 기운이 부족해 우선순위가 모호해지기 쉬워요. 주간 3가지 안 할 일을 적는 루틴이 도움돼요.';

test('enhanceLifetimeChapter2WithLLM — LLM 성공 시 summary 만 교체', async () => {
  const client = new MockClient([ENHANCED]);
  const result = await enhanceLifetimeChapter2WithLLM(original, baseInput, client);
  assert.equal(result.source, 'llm');
  assert.equal(result.strengthBalance.summary, ENHANCED);
  assert.equal(result.strengthBalance.headline, original.headline);
  assert.equal(result.strengthBalance.strongAxis, original.strongAxis);
  assert.deepEqual(result.strengthBalance.balanceGuide, original.balanceGuide);
});

test('enhanceLifetimeChapter2WithLLM — chapterId !== 2 시 throw', async () => {
  const client = new MockClient([ENHANCED]);
  try {
    await enhanceLifetimeChapter2WithLLM(original, { ...baseInput, chapterId: 1 }, client);
    assert.fail('throw 되어야 함');
  } catch (error) {
    assert.match((error as Error).message, /chapterId.*2/);
  }
});

test('enhanceLifetimeChapter2WithLLM — LLM 실패 시 source=fallback, 원본 보존', async () => {
  const client = new MockClient(['丙 한자', '丁 한자', '戊 한자']);
  const result = await enhanceLifetimeChapter2WithLLM(original, baseInput, client, { maxRetries: 2 });
  assert.equal(result.source, 'fallback');
  assert.equal(result.strengthBalance.summary, original.summary);
});
