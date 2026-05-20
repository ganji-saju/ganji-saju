import test from 'node:test';
import assert from 'node:assert/strict';
import type { LifetimeCareerDirectionSection } from '@/domain/saju/report/lifetime-types';
import { enhanceLifetimeChapter6WithLLM } from './enhance-lifetime-chapter6';
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

const original: LifetimeCareerDirectionSection = {
  headline: '직업 방향',
  summary: '학습과 후원이 결합되는 일에서 본인의 강점이 가장 잘 살아나는 명식입니다. (기존)',
  fitStructure: '안정적 조직',
  endureVsShine: '오래 버틸 수 있는 자리',
  independenceStyle: '독립보다 협업',
  recognitionStyle: '꾸준한 누적',
  basis: [],
};

const baseInput: ChapterLLMInput = {
  chapterId: 6,
  chapter: { title: '직업 방향', lens: '일의 방식', forbiddenTopics: [] },
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
  userContext: { name: null, age: null, relationshipStatus: null, occupation: 'employee', currentConcern: null },
};

const ENHANCED = '학습·후원 환경에서 강점이 빛납니다. 자기 결단을 일정 시점에 맡기는 일은 부담이 큽니다.';

test('enhanceLifetimeChapter6WithLLM — 성공 시 summary 교체', async () => {
  const client = new MockClient([ENHANCED]);
  const result = await enhanceLifetimeChapter6WithLLM(original, baseInput, client);
  assert.equal(result.source, 'llm');
  assert.equal(result.careerDirection.summary, ENHANCED);
  assert.equal(result.careerDirection.fitStructure, original.fitStructure);
});

test('enhanceLifetimeChapter6WithLLM — chapterId !== 6 시 throw', async () => {
  const client = new MockClient([ENHANCED]);
  try {
    await enhanceLifetimeChapter6WithLLM(original, { ...baseInput, chapterId: 1 }, client);
    assert.fail('throw 되어야 함');
  } catch (error) {
    assert.match((error as Error).message, /chapterId.*6/);
  }
});
