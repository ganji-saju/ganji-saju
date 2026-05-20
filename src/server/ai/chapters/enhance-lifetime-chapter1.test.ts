import test from 'node:test';
import assert from 'node:assert/strict';
import type { LifetimeCoreIdentitySection } from '@/domain/saju/report/lifetime-types';
import {
  enhanceLifetimeChapter1WithLLM,
} from './enhance-lifetime-chapter1';
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

const originalCoreIdentity: LifetimeCoreIdentitySection = {
  headline: '기 일간 · 정인격 — 돌봄과 배움의 결',
  summary:
    '선생님은 살면서 돌봄·후원·배움의 역할이 반복해서 들어옵니다. (기존 deterministic 본문)',
  reactionStyle: '깊이 들으면서 천천히 결정하는 편',
  bestEnvironment: '학습·멘토링·후원 환경에서 결이 잘 풀립니다',
  weakPattern: '책임을 너무 많이 짊어진 다음 갑자기 거리를 두는 패턴',
  basis: ['일주 기사', '정인격', '신중 균형'],
};

const baseInput: ChapterLLMInput = {
  chapterId: 1,
  chapter: {
    title: '타고난 성향',
    lens: '마음의 결',
    forbiddenTopics: ['관계', '재물'],
  },
  saju: {
    pillars: { year: '임술', month: '신축', day: '기사', hour: '무진' },
    dayMaster: { stem: '기', element: '토 기운', metaphor: '따뜻하게 익히는 흙' },
    fiveElements: {
      dominant: '토 기운',
      weakest: '금 기운',
      supportElements: ['화 기운'],
      distribution: { 목: 0.1, 화: 0.2, 토: 0.4, 금: 0.1, 수: 0.2 },
    },
    pattern: { label: '정인격', plainCue: '돌봄·후원·배움의 결' },
    yongsin: { primary: '화 기운', reason: '흙이 차가워질 때 햇살이 보강' },
    strength: '균형이 잡힌 편',
    tenGods: { dominant: '정인', shortageList: ['식신'] },
    notableSinsals: [],
  },
  userContext: {
    name: '테스트',
    age: 33,
    relationshipStatus: 'single',
    occupation: 'employee',
    currentConcern: null,
  },
};

const ENHANCED_BODY =
  '테스트님의 사주는 토 기운을 중심으로 정인의 결이 또렷이 흐릅니다. 가까운 사람을 돌보는 패턴이 반복돼요. 책임을 미리 글로 적어두는 게 좋아요.';

test('enhanceLifetimeChapter1WithLLM — LLM 성공 시 summary 만 enhanced 본문으로 교체', async () => {
  const client = new MockClient([ENHANCED_BODY]);
  const result = await enhanceLifetimeChapter1WithLLM(
    originalCoreIdentity,
    baseInput,
    client
  );

  assert.equal(result.source, 'llm');
  assert.equal(result.retries, 0);
  assert.equal(result.coreIdentity.summary, ENHANCED_BODY);
  // 다른 필드는 그대로
  assert.equal(result.coreIdentity.headline, originalCoreIdentity.headline);
  assert.equal(result.coreIdentity.reactionStyle, originalCoreIdentity.reactionStyle);
  assert.equal(result.coreIdentity.bestEnvironment, originalCoreIdentity.bestEnvironment);
  assert.equal(result.coreIdentity.weakPattern, originalCoreIdentity.weakPattern);
  assert.deepEqual(result.coreIdentity.basis, originalCoreIdentity.basis);
});

test('enhanceLifetimeChapter1WithLLM — LLM 실패 시 원본 summary 유지 (source=fallback)', async () => {
  const dirty1 = '丙申 한자 1';
  const dirty2 = '丁酉 한자 2';
  const dirty3 = '戊戌 한자 3';
  const client = new MockClient([dirty1, dirty2, dirty3]);
  const result = await enhanceLifetimeChapter1WithLLM(
    originalCoreIdentity,
    baseInput,
    client,
    { maxRetries: 2 }
  );

  assert.equal(result.source, 'fallback');
  assert.equal(result.coreIdentity.summary, originalCoreIdentity.summary);
});

test('enhanceLifetimeChapter1WithLLM — chapterId 가 1 이 아니면 throw', async () => {
  const client = new MockClient([ENHANCED_BODY]);
  const wrongInput: ChapterLLMInput = { ...baseInput, chapterId: 4 };
  try {
    await enhanceLifetimeChapter1WithLLM(originalCoreIdentity, wrongInput, client);
    assert.fail('throw 되어야 함');
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.match((error as Error).message, /chapterId.*1/);
  }
});

test('enhanceLifetimeChapter1WithLLM — LLM 응답이 빈 문자열일 때 원본 유지', async () => {
  const client = new MockClient(['', '', '']);
  const result = await enhanceLifetimeChapter1WithLLM(
    originalCoreIdentity,
    baseInput,
    client,
    { maxRetries: 2 }
  );

  // 빈 string 은 validator 통과 가능 (한자/X과/영어/단정 모두 0건) 이라
  // source 가 llm 일 수 있으나, body 가 빈 문자열이면 원본 summary 사용 (|| fallback)
  assert.equal(result.coreIdentity.summary, originalCoreIdentity.summary);
});

test('enhanceLifetimeChapter1WithLLM — 재시도 후 통과 시 retries 보고', async () => {
  const dirty = '丙申 한자';
  const client = new MockClient([dirty, ENHANCED_BODY]);
  const result = await enhanceLifetimeChapter1WithLLM(
    originalCoreIdentity,
    baseInput,
    client
  );

  assert.equal(result.source, 'llm');
  assert.equal(result.retries, 1);
  assert.equal(result.coreIdentity.summary, ENHANCED_BODY);
});
