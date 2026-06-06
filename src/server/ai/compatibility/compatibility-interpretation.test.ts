import assert from 'node:assert/strict';
import { buildCompatibilityInterpretation, type CompatibilityPerson } from '@/lib/compatibility';
import type { ChapterLLMClient } from '../chapters/generate-chapter';
import { buildCompatibilityInterpretationInput } from './compatibility-interpretation-content';
import { buildCompatibilityInterpretationCacheKey } from './compatibility-interpretation-cache';
import {
  parseCompatibilitySections,
  validateCompatibilitySections,
} from './compatibility-interpretation-validator';
import { generateCompatibilityInterpretation } from './generate-compatibility-interpretation';
import { createInMemoryCompatibilityInterpretationCacheStore } from './compatibility-interpretation-cache-store';

declare const test: (name: string, fn: () => Promise<void> | void) => void;

const PERSON_A: CompatibilityPerson = { name: '가영', birthInput: { year: 1990, month: 4, day: 12, hour: 9, gender: 'female' } };
const PERSON_B: CompatibilityPerson = { name: '나준', birthInput: { year: 1988, month: 9, day: 3, hour: 14, gender: 'male' } };

function interp(
  slug: 'lover' | 'family' | 'friend' | 'partner',
  a: CompatibilityPerson = PERSON_A,
  b: CompatibilityPerson = PERSON_B
) {
  return buildCompatibilityInterpretation(slug, a, b);
}

// 유효한 LLM 응답(검증 통과용): 한자/명리어/일일톤/자극어 0건, 각 본문 60~420자.
function validLlmJson(): string {
  const body =
    '두 분은 서로의 속도가 조금 달라서 처음에는 답답함이 생기기 쉽습니다. ' +
    '그럴 때 바로 결론을 내리기보다 먼저 마음을 짧게 확인하고 천천히 맞춰가면 ' +
    '관계가 한결 부드러워지고 신뢰도 차곡차곡 쌓입니다.';
  return JSON.stringify({
    sections: [
      { title: '서운함이 쌓이는 순간', body },
      { title: '가까워지는 대화법', body },
      { title: '오래 가는 거리 조절', body },
    ],
  });
}

function fakeClient(response: string): ChapterLLMClient {
  return { async generate() { return response; } };
}

test('compat interpretation: 캐시 키는 두 사람 순서에 무관(A↔B 동일)하고 관계유형이 다르면 달라짐', () => {
  const ab = buildCompatibilityInterpretationInput(interp('lover', PERSON_A, PERSON_B), '가영', '나준');
  const ba = buildCompatibilityInterpretationInput(interp('lover', PERSON_B, PERSON_A), '나준', '가영');
  assert.equal(
    buildCompatibilityInterpretationCacheKey(ab),
    buildCompatibilityInterpretationCacheKey(ba),
    '순서만 바꾼 같은 커플의 캐시 키가 달라짐'
  );

  const family = buildCompatibilityInterpretationInput(interp('family', PERSON_A, PERSON_B), '가영', '나준');
  assert.notEqual(
    buildCompatibilityInterpretationCacheKey(ab),
    buildCompatibilityInterpretationCacheKey(family),
    '관계유형이 달라도 캐시 키가 동일'
  );
});

test('compat interpretation: 파서가 코드펜스/머리말이 섞인 응답에서도 sections 를 추출', () => {
  const wrapped = '```json\n' + validLlmJson() + '\n```';
  const parsed = parseCompatibilitySections(wrapped);
  assert.ok(parsed, '코드펜스 응답 파싱 실패');
  assert.equal(parsed?.length, 3);
  assert.ok((parsed?.[0].title.length ?? 0) > 0);
});

test('compat interpretation: validator 가 한자 포함 본문을 거부', () => {
  const parsed = parseCompatibilitySections(
    JSON.stringify({
      sections: [
        { title: '한자 섞임', body: '두 분의 甲 기운이 만나 어쩌고 저쩌고 한자가 들어간 잘못된 본문입니다. '.repeat(2) },
        { title: '정상', body: '정상적인 본문이지만 위 섹션이 한자라 전체가 폐기되어야 합니다. 충분히 길게 적어 길이 조건은 통과시킵니다.' },
        { title: '정상2', body: '세 번째 섹션도 충분히 길게 작성해 길이 조건만큼은 만족시키되 한자는 넣지 않습니다 그래도 위 한자 때문에 실패해야 합니다.' },
      ],
    })
  );
  assert.ok(parsed);
  const result = validateCompatibilitySections(parsed!);
  assert.equal(result.ok, false, '한자 본문이 검증을 통과함');
});

test('compat interpretation: 플래그 OFF 면 결정론 fallback(섹션=lib deepSections)', async () => {
  const interpretation = interp('lover');
  const result = await generateCompatibilityInterpretation({
    interpretation,
    selfName: '가영',
    partnerName: '나준',
    env: {} as NodeJS.ProcessEnv, // 플래그 미설정 → OFF
  });
  assert.equal(result.source, 'fallback');
  assert.deepEqual(
    result.sections.map((s) => s.body),
    interpretation.deepSections.map((s) => s.body),
    'fallback 섹션이 결정론 deepSections 와 다름'
  );
});

test('compat interpretation: 플래그 ON + 유효 LLM 응답 → llm 섹션, 재호출 시 캐시 hit', async () => {
  const interpretation = interp('lover');
  const cacheStore = createInMemoryCompatibilityInterpretationCacheStore();
  const env = { OPENAI_INTERPRET_COMPATIBILITY: '1' } as unknown as NodeJS.ProcessEnv;

  const first = await generateCompatibilityInterpretation({
    interpretation,
    selfName: '가영',
    partnerName: '나준',
    env,
    client: fakeClient(validLlmJson()),
    cacheStore,
  });
  assert.equal(first.source, 'llm');
  assert.equal(first.sections.length, 3);
  assert.match(first.sections[0].key, /^llm-/);

  // 두 번째 호출은 클라이언트가 throw 해도 캐시 hit 이어야 한다(재과금 방지).
  const second = await generateCompatibilityInterpretation({
    interpretation,
    selfName: '가영',
    partnerName: '나준',
    env,
    client: { async generate() { throw new Error('호출되면 안 됨'); } },
    cacheStore,
  });
  assert.equal(second.source, 'cache');
  assert.deepEqual(second.sections, first.sections);
});

test('compat interpretation: 플래그 ON + 깨진 응답 → 재시도 후 결정론 fallback', async () => {
  const interpretation = interp('partner');
  const result = await generateCompatibilityInterpretation({
    interpretation,
    selfName: '가영',
    partnerName: '나준',
    env: { OPENAI_INTERPRET_COMPATIBILITY: '1' } as unknown as NodeJS.ProcessEnv,
    client: fakeClient('이것은 JSON 이 아닙니다'),
    cacheStore: createInMemoryCompatibilityInterpretationCacheStore(),
    maxRetries: 1,
  });
  assert.equal(result.source, 'fallback');
  assert.deepEqual(
    result.sections.map((s) => s.body),
    interpretation.deepSections.map((s) => s.body)
  );
});

test('compat interpretation: 검증 실패→fallback 은 source=fallback + 사유로 계측된다(무음 fallback 가시화)', async () => {
  const calls: Array<{ source: string; feature: string; fallbackReason?: string | null }> = [];
  const recordRun = (async (input: { source: string; feature: string; fallbackReason?: string | null }) => {
    calls.push(input);
  }) as unknown as Parameters<typeof generateCompatibilityInterpretation>[0]['recordRun'];

  const result = await generateCompatibilityInterpretation({
    interpretation: interp('lover'),
    selfName: '가영',
    partnerName: '나준',
    env: { OPENAI_INTERPRET_COMPATIBILITY: '1' } as unknown as NodeJS.ProcessEnv,
    client: fakeClient('이것은 JSON 이 아닙니다'),
    cacheStore: createInMemoryCompatibilityInterpretationCacheStore(),
    maxRetries: 1,
    userId: 'user-123',
    recordRun,
  });

  assert.equal(result.source, 'fallback');
  const fallbackCalls = calls.filter((c) => c.source === 'fallback' && c.feature === 'compatibility');
  assert.equal(fallbackCalls.length, 1, '검증 실패 fallback 이 1회 계측되어야 함');
  assert.ok(
    typeof fallbackCalls[0].fallbackReason === 'string' && fallbackCalls[0].fallbackReason.length > 0,
    'fallbackReason 이 기록되어야 함'
  );
});

test('compat interpretation: 플래그 OFF fallback 도 llm_disabled 사유로 계측된다(OFF vs 무트래픽 구분)', async () => {
  const calls: Array<{ source: string; feature: string; fallbackReason?: string | null }> = [];
  const recordRun = (async (input: { source: string; feature: string; fallbackReason?: string | null }) => {
    calls.push(input);
  }) as unknown as Parameters<typeof generateCompatibilityInterpretation>[0]['recordRun'];

  const result = await generateCompatibilityInterpretation({
    interpretation: interp('lover'),
    selfName: '가영',
    partnerName: '나준',
    env: {} as NodeJS.ProcessEnv, // 플래그 OFF
    recordRun,
  });
  assert.equal(result.source, 'fallback');
  assert.equal(calls.length, 1, '플래그 OFF 경로도 1회 계측되어야 함');
  assert.equal(calls[0].source, 'fallback');
  assert.equal(calls[0].feature, 'compatibility');
  assert.equal(calls[0].fallbackReason, 'llm_disabled');
});
