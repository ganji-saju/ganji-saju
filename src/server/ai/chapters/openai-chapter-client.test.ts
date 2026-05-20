import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OpenAIChapterClient,
  OpenAIChapterClientError,
} from './openai-chapter-client';

// 2026-05-19 (다) 3차 — OpenAIChapterClient 의 throw 동작 검증.
//   환경변수 미설정 시 ai_not_configured throw — 실제 OpenAI 호출은 별도 integration 테스트.

const originalApiKey = process.env.OPENAI_API_KEY;

function clearOpenAIKey() {
  delete process.env.OPENAI_API_KEY;
}

function restoreOpenAIKey() {
  if (originalApiKey !== undefined) {
    process.env.OPENAI_API_KEY = originalApiKey;
  } else {
    delete process.env.OPENAI_API_KEY;
  }
}

test('OpenAIChapterClient — OPENAI_API_KEY 미설정 시 ai_not_configured throw', async () => {
  clearOpenAIKey();
  const client = new OpenAIChapterClient();
  try {
    await client.generate('system', 'user');
    assert.fail('throw 되어야 함');
  } catch (error) {
    assert.ok(error instanceof OpenAIChapterClientError);
    assert.equal(
      (error as OpenAIChapterClientError).fallbackReason,
      'ai_not_configured'
    );
  } finally {
    restoreOpenAIKey();
  }
});

test('OpenAIChapterClientError — name 과 fallbackReason 보존', () => {
  const error = new OpenAIChapterClientError('test msg', 'openai_error');
  assert.equal(error.name, 'OpenAIChapterClientError');
  assert.equal(error.message, 'test msg');
  assert.equal(error.fallbackReason, 'openai_error');
});

test('OpenAIChapterClientError — fallbackReason 누락 시 null', () => {
  const error = new OpenAIChapterClientError('msg only');
  assert.equal(error.fallbackReason, null);
});

test('OpenAIChapterClient — options 기본값 적용', () => {
  // constructor 가 throw 없이 동작하면 OK (실제 호출은 별도 integration 테스트)
  const client = new OpenAIChapterClient();
  assert.ok(client instanceof OpenAIChapterClient);
});

test('OpenAIChapterClient — options 커스텀 (model, temperature, maxOutputTokens) 받음', () => {
  const client = new OpenAIChapterClient({
    model: 'gpt-5.2',
    temperature: 0.7,
    maxOutputTokens: 500,
    timeoutMs: 10_000,
  });
  assert.ok(client instanceof OpenAIChapterClient);
});

// 2026-05-20 V2-5 PR N — JSON mode 옵션 검증.
test('OpenAIChapterClient — useJsonMode 옵션 기본 활성 (constructor 통과)', () => {
  const client = new OpenAIChapterClient({ useJsonMode: true });
  assert.ok(client instanceof OpenAIChapterClient);
});

test('OpenAIChapterClient — useJsonMode=false 도 constructor 통과 (이전 호환)', () => {
  const client = new OpenAIChapterClient({ useJsonMode: false });
  assert.ok(client instanceof OpenAIChapterClient);
});
