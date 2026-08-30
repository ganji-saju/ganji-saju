import assert from 'node:assert/strict';
import { AI_FALLBACK_REASONS, aiFallbackCopy } from './fallback-copy';

// 2026-08-31 — 8/31 한도 초과 장애의 재발 방지 가드.
//   그날 사용자에게 나간 문구는 "잠시 후 다시 질문해 주세요" 였는데, 한도 초과는
//   기다린다고 풀리지 않는다(운영자 결제 필요). 문구가 거짓이었다.
//   여기서 고정하는 건 문장 자체가 아니라 **규칙**이다: 재시도가 소용없는 사유엔
//   재시도를 권하지 않는다.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 재시도를 권하는 표현. retryHelps=false 인 사유의 문구에 이게 들어가면 거짓 안내다.
const RETRY_PROMPTS = ['잠시 후', '잠시후', '잠시 뒤', '다시 시도해 주세요', '다시 질문해 주세요'];

test('재시도가 소용없는 사유는 재시도를 권하지 않는다', () => {
  for (const reason of AI_FALLBACK_REASONS) {
    const copy = aiFallbackCopy(reason);
    if (copy.retryHelps) continue;
    for (const prompt of RETRY_PROMPTS) {
      assert.ok(
        !copy.message.includes(prompt),
        `${reason}: 재시도해도 결과가 같은데 "${prompt}" 로 재시도를 권하고 있다 — ${copy.message}`
      );
    }
  }
});

test('한도 초과는 재시도로 풀리지 않는다', () => {
  assert.equal(aiFallbackCopy('quota_exceeded').retryHelps, false);
  assert.equal(aiFallbackCopy('ai_not_configured').retryHelps, false);
  // 일시적 오류는 재시도가 실제로 도움이 된다 — 여기까지 막으면 과잉이다.
  assert.equal(aiFallbackCopy('openai_error').retryHelps, true);
  assert.equal(aiFallbackCopy('empty_ai_response').retryHelps, true);
});

test('벤더명·내부 운영 상태를 노출하지 않는다', () => {
  // 2026-08-11 결정: 어떤 LLM 업체를 쓰는지, 우리 결제 한도가 어떤 상태인지 알릴 이유가 없다.
  const forbidden = /openai|gpt|anthropic|claude|api\s*key|결제 한도|사용량 한도|크레딧/i;
  for (const reason of AI_FALLBACK_REASONS) {
    const { message } = aiFallbackCopy(reason);
    assert.ok(!forbidden.test(message), `${reason}: 내부 정보가 노출된다 — ${message}`);
  }
});

test('알 수 없는 사유도 문구를 준다', () => {
  assert.ok(aiFallbackCopy(null).message.length > 0);
  assert.ok(aiFallbackCopy(undefined).message.length > 0);
});
