import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChapterUserMessage,
  generateChapter,
  type ChapterLLMClient,
  type ChapterOutput,
} from './generate-chapter';
import type { ChapterLLMInput } from './chapter-input-types';

// 2026-05-19 (다) 2차 — generateChapter 인프라 검증 (실제 LLM 호출 없이 mock).

class MockClient implements ChapterLLMClient {
  callCount = 0;
  lastSystemPrompt = '';
  lastUserMessage = '';
  constructor(private readonly responses: string[]) {}
  async generate(systemPrompt: string, userMessage: string): Promise<string> {
    this.lastSystemPrompt = systemPrompt;
    this.lastUserMessage = userMessage;
    const idx = Math.min(this.callCount, this.responses.length - 1);
    this.callCount++;
    return this.responses[idx] ?? '';
  }
}

const baseInput: ChapterLLMInput = {
  chapterId: 1,
  chapter: {
    title: '타고난 성향',
    lens: '마음의 결',
    forbiddenTopics: ['관계', '재물'],
  },
  saju: {
    pillars: { year: '임술', month: '신축', day: '기사', hour: '무진' },
    dayMaster: { stem: '기', element: '흙의 결', metaphor: '따뜻하게 익히는 흙' },
    fiveElements: {
      dominant: '흙의 결',
      weakest: '쇠의 결',
      supportElements: ['햇살의 결'],
      distribution: { 목: 0.1, 화: 0.2, 토: 0.4, 금: 0.1, 수: 0.2 },
    },
    pattern: { label: '정인격', plainCue: '돌봄·후원·배움의 결' },
    yongsin: { primary: '햇살의 결', reason: '흙이 차가워질 때 햇살이 보강' },
    strength: '균형이 잡힌 편',
    tenGods: { dominant: '정인', shortageList: ['식신', '상관'] },
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

const CLEAN_BODY =
  '테스트님의 사주는 흙의 결을 중심으로 정인의 결이 또렷이 흐릅니다. 가까운 사람을 돌보는 패턴이 반복돼요. 무게가 누적되기 쉬우니 한 줄로 한계를 적어두는 게 좋아요.';

test('buildChapterUserMessage — 사주 데이터 + 사용자 컨텍스트 + structure guide 포함', () => {
  const message = buildChapterUserMessage(baseInput);
  assert.ok(message.includes('사주 데이터'));
  assert.ok(message.includes('사용자 컨텍스트'));
  assert.ok(message.includes('흙의 결'));
  assert.ok(message.includes('정인격'));
  assert.ok(message.includes('테스트'));
  assert.ok(message.includes('출력 가이드'));
});

test('buildChapterUserMessage — 9장 synthesis 시 priorChapterDigests 포함', () => {
  const synthesisInput: ChapterLLMInput = {
    ...baseInput,
    chapterId: 9,
    chapter: { title: '평생 활용 전략', lens: 'synthesis', forbiddenTopics: ['복사'] },
    priorChapterDigests: [
      { chapterId: 1, title: '타고난 성향', digest: '돌봄과 배움이 본질' },
      { chapterId: 2, title: '기운의 균형', digest: '흙 강 / 쇠 부족' },
    ],
  };
  const message = buildChapterUserMessage(synthesisInput);
  assert.ok(message.includes('1~7장 핵심 결론'));
  assert.ok(message.includes('1. 타고난 성향 — 돌봄과 배움이 본질'));
  assert.ok(message.includes('2. 기운의 균형 — 흙 강 / 쇠 부족'));
});

test('generateChapter — happy path: 첫 호출 통과 → source=llm, retries=0', async () => {
  const client = new MockClient([CLEAN_BODY]);
  const result: ChapterOutput = await generateChapter(baseInput, client);

  assert.equal(result.source, 'llm');
  assert.equal(result.retries, 0);
  assert.equal(result.body, CLEAN_BODY);
  assert.equal(result.chapterId, 1);
  assert.equal(result.title, '타고난 성향');
  assert.equal(result.validationFailures.length, 0);
  assert.equal(client.callCount, 1);
});

test('generateChapter — 재생성: 첫 호출 fail (한자) → 두 번째 통과', async () => {
  const dirty = '丙申 대운 기반으로 풀이합니다. 한자 노출 fail.';
  const client = new MockClient([dirty, CLEAN_BODY]);
  const result = await generateChapter(baseInput, client);

  assert.equal(result.source, 'llm');
  assert.equal(result.retries, 1);
  assert.equal(result.body, CLEAN_BODY);
  assert.equal(client.callCount, 2);
});

test('generateChapter — 모두 fail → fallbackBody 사용 (source=fallback)', async () => {
  const dirty1 = '丙申 한자 1';
  const dirty2 = '丁酉 한자 2';
  const dirty3 = '戊戌 한자 3';
  const fallback = '선생님의 사주는 흙의 결을 중심으로 정인의 결이 또렷이 흐릅니다.';
  const client = new MockClient([dirty1, dirty2, dirty3]);
  const result = await generateChapter(baseInput, client, {
    maxRetries: 2,
    fallbackBody: fallback,
  });

  assert.equal(result.source, 'fallback');
  assert.equal(result.retries, 3, '0+1+2 = 3 attempts (maxRetries+1)');
  assert.equal(result.body, fallback);
  assert.ok(result.validationFailures.length > 0, '마지막 fail 정보 보존');
  assert.equal(client.callCount, 3);
});

test('generateChapter — fallback 미제공 시 body=빈 문자열', async () => {
  const dirty = '丙申';
  const client = new MockClient([dirty, dirty, dirty]);
  const result = await generateChapter(baseInput, client, { maxRetries: 1 });

  assert.equal(result.source, 'fallback');
  assert.equal(result.body, '');
});

test('generateChapter — system prompt 가 챕터 lens 와 forbiddenTopics 포함', async () => {
  const client = new MockClient([CLEAN_BODY]);
  await generateChapter(baseInput, client);

  // CHAPTER_META[1] 의 lens / forbiddenTopics 가 system prompt 에 들어가는지
  assert.ok(client.lastSystemPrompt.includes('마음의 결'));
  assert.ok(client.lastSystemPrompt.includes('관계 — 4장 영역'));
});

test('generateChapter — cross-chapter rule: 두 챕터 첫 문장 일치 시 fail', async () => {
  const sharedFirst = '돌봄과 배움이 본질입니다.';
  const chapter4Body = `${sharedFirst} 관계 측면에서는 또렷이 작동.`;
  const chapter1Body = `${sharedFirst} 성향 측면에서는 더 깊이 드러납니다.`;
  const client = new MockClient([chapter4Body, '관계 결의 본질이 또렷합니다. 본인 마음 챙김 필요합니다.']);

  const result = await generateChapter(
    { ...baseInput, chapterId: 4, chapter: { title: '관계', lens: 'lens', forbiddenTopics: ['x'] } },
    client,
    {
      crossChapterContext: {
        allChapters: [chapter1Body, chapter4Body, '', '', '', '', '', '', ''],
        punchLines: [],
      },
    }
  );

  // 첫 시도가 chapter1 과 첫 문장 일치 → fail. 두 번째는 다른 본문 → pass.
  assert.equal(result.retries, 1, '재생성 1회');
  assert.equal(result.source, 'llm');
});

test('generateChapter — punch-copy 중복 rule: 두 챕터 동일 punch-copy 포함 시 fail', async () => {
  const punch = '배움과 도움을 크게 쓰는 편';
  const chapter1Body = `선생님은 ${punch}이라 부드럽게 흐릅니다.`;
  const chapter5Body = `재물 흐름도 ${punch}으로 풀려요.`;
  const cleanRetry = '돈의 결은 안정 자산으로 풀려요. 적립 패턴이 본인에 맞습니다.';

  const client = new MockClient([chapter5Body, cleanRetry]);
  const result = await generateChapter(
    { ...baseInput, chapterId: 5, chapter: { title: '재물', lens: 'lens', forbiddenTopics: ['x'] } },
    client,
    {
      crossChapterContext: {
        allChapters: [chapter1Body, '', '', '', chapter5Body, '', '', '', ''],
        punchLines: [punch],
      },
    }
  );

  assert.equal(result.retries, 1, '재생성 1회');
  assert.equal(result.source, 'llm');
});
