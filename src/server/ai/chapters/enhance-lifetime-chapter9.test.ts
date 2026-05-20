import test from 'node:test';
import assert from 'node:assert/strict';
import type { LifetimeStrategySection } from '@/domain/saju/report/lifetime-types';
import {
  enhanceLifetimeChapter9WithLLM,
} from './enhance-lifetime-chapter9';
import type { ChapterLLMClient } from './generate-chapter';
import type { ChapterLLMInput, ChapterPriorDigest } from './chapter-input-types';

class MockClient implements ChapterLLMClient {
  callCount = 0;
  lastUserMessage: string | null = null;
  constructor(private readonly responses: string[]) {}
  async generate(_system: string, user: string): Promise<string> {
    this.lastUserMessage = user;
    const idx = Math.min(this.callCount, this.responses.length - 1);
    this.callCount++;
    return this.responses[idx] ?? '';
  }
}

const originalStrategy: LifetimeStrategySection = {
  headline: '평생 활용 전략',
  summary:
    '이 사주는 성향 해설보다 사용법이 더 중요합니다. 화 기운을 언제 살리고, 금 기운이 흔들릴 때 무엇을 지킬지가 핵심입니다. (기존 deterministic 본문)',
  useWhenStrong: ['새 시작 작게', '말 정리부터'],
  defendWhenShaken: ['수면 먼저', '천천히 맞추기'],
  rememberRules: [
    '강한 토 기운은 무리하게 쓰기보다 방향을 정하고 쓸 때 오래 갑니다.',
    '화 기운을 생활 루틴으로 만들수록 명식의 장점이 살아납니다.',
    '쇠의 축이 약해지는 날에는 속도보다 리듬을 먼저 바로잡는 편이 좋습니다.',
    '관계와 일에서 서운함을 결론처럼 말하기보다 사실과 기준을 먼저 정리해야 합니다.',
    '지금의 갑오 대운은 단기 반응보다 장기 기준을 바로 세울수록 힘을 실어줍니다.',
  ],
  basis: ['일주 기사', '정인격', '갑오 대운'],
};

const priorDigests: ChapterPriorDigest[] = [
  { chapterId: 1, title: '타고난 성향', digest: '돌봄과 배움이 본질' },
  { chapterId: 2, title: '기운의 균형', digest: '토 기운 강 / 금 기운 부족' },
  { chapterId: 3, title: '역할과 보완 힌트', digest: '정인격 역할 반복' },
  { chapterId: 4, title: '관계 패턴', digest: '관계 = 챙기는 자리' },
  { chapterId: 5, title: '재물 감각', digest: '안정 자산형 — 자기계발 비용 분리' },
  { chapterId: 6, title: '직업 방향', digest: '일 = 학습·후원 환경' },
  { chapterId: 7, title: '건강 리듬', digest: '흙 과한 결의 둔감 / 가벼운 유산소' },
];

const baseInput: ChapterLLMInput = {
  chapterId: 9,
  chapter: {
    title: '평생 활용 전략',
    lens: '1~8장의 모든 결을 관통하는 평생 의사결정 원칙 3~5개',
    forbiddenTopics: [
      '1~8장 본문의 단순 복사·재인용 — 금지',
      '새로운 정보 추가 — 금지 (다른 챕터에 있어야 할 내용)',
    ],
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
  priorChapterDigests: priorDigests,
};

const ENHANCED_BODY =
  '테스트님의 평생 결을 관통하는 원칙은 세 가지입니다. 책임은 미리 글로 적고 시작하세요. 금 기운을 의식적으로 채우세요. 자기계발과 돌봄 비용을 같은 지갑에서 빼지 마세요.';

test('enhanceLifetimeChapter9WithLLM — LLM 성공 시 summary 만 교체, 다른 field 보존', async () => {
  const client = new MockClient([ENHANCED_BODY]);
  const result = await enhanceLifetimeChapter9WithLLM(
    originalStrategy,
    baseInput,
    client
  );

  assert.equal(result.source, 'llm');
  assert.equal(result.retries, 0);
  assert.equal(result.lifetimeStrategy.summary, ENHANCED_BODY);
  // 다른 필드 보존
  assert.equal(result.lifetimeStrategy.headline, originalStrategy.headline);
  assert.deepEqual(result.lifetimeStrategy.useWhenStrong, originalStrategy.useWhenStrong);
  assert.deepEqual(result.lifetimeStrategy.defendWhenShaken, originalStrategy.defendWhenShaken);
  assert.deepEqual(result.lifetimeStrategy.rememberRules, originalStrategy.rememberRules);
  assert.deepEqual(result.lifetimeStrategy.basis, originalStrategy.basis);
});

test('enhanceLifetimeChapter9WithLLM — LLM 실패 시 source=fallback, 원본 summary 보존', async () => {
  const dirty1 = '丙申 한자 1';
  const dirty2 = '丁酉 한자 2';
  const dirty3 = '戊戌 한자 3';
  const client = new MockClient([dirty1, dirty2, dirty3]);
  const result = await enhanceLifetimeChapter9WithLLM(
    originalStrategy,
    baseInput,
    client,
    { maxRetries: 2 }
  );

  assert.equal(result.source, 'fallback');
  assert.equal(result.lifetimeStrategy.summary, originalStrategy.summary);
});

test('enhanceLifetimeChapter9WithLLM — chapterId 가 9 이 아니면 throw', async () => {
  const client = new MockClient([ENHANCED_BODY]);
  const wrongInput: ChapterLLMInput = { ...baseInput, chapterId: 1 };
  try {
    await enhanceLifetimeChapter9WithLLM(originalStrategy, wrongInput, client);
    assert.fail('throw 되어야 함');
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.match((error as Error).message, /chapterId.*9/);
  }
});

test('enhanceLifetimeChapter9WithLLM — priorChapterDigests 누락 시 throw', async () => {
  const client = new MockClient([ENHANCED_BODY]);
  const noPriors: ChapterLLMInput = { ...baseInput, priorChapterDigests: undefined };
  try {
    await enhanceLifetimeChapter9WithLLM(originalStrategy, noPriors, client);
    assert.fail('throw 되어야 함 (priorChapterDigests 필수)');
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.match((error as Error).message, /priorChapterDigests/);
  }
});

test('enhanceLifetimeChapter9WithLLM — priorChapterDigests 빈 배열도 throw', async () => {
  const client = new MockClient([ENHANCED_BODY]);
  const emptyPriors: ChapterLLMInput = { ...baseInput, priorChapterDigests: [] };
  try {
    await enhanceLifetimeChapter9WithLLM(originalStrategy, emptyPriors, client);
    assert.fail('throw 되어야 함 (priorChapterDigests 비어있음)');
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.match((error as Error).message, /priorChapterDigests/);
  }
});

test('enhanceLifetimeChapter9WithLLM — user message 에 priorChapterDigests 가 포함됨 (synthesis 입력)', async () => {
  const client = new MockClient([ENHANCED_BODY]);
  await enhanceLifetimeChapter9WithLLM(originalStrategy, baseInput, client);

  assert.ok(client.lastUserMessage);
  // generate-chapter.buildChapterUserMessage 가 priorChapterDigests 를 user message
  // 에 'X. {title} — {digest}' 형식으로 추가하는지 확인.
  assert.match(client.lastUserMessage!, /1\. 타고난 성향/);
  assert.match(client.lastUserMessage!, /돌봄과 배움이 본질/);
  assert.match(client.lastUserMessage!, /7\. 건강 리듬/);
});

test('enhanceLifetimeChapter9WithLLM — 재시도 후 통과 시 retries 보고', async () => {
  const dirty = '丙申 한자';
  const client = new MockClient([dirty, ENHANCED_BODY]);
  const result = await enhanceLifetimeChapter9WithLLM(
    originalStrategy,
    baseInput,
    client
  );

  assert.equal(result.source, 'llm');
  assert.equal(result.retries, 1);
  assert.equal(result.lifetimeStrategy.summary, ENHANCED_BODY);
});
